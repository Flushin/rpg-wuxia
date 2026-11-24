// Mecânicas: combate e atributos, morte e durabilidade, forja e economia, auto-combate e ganho offline.
// Tabelas e exemplos saem das fórmulas do jogo; as que são cópias (marcadas) são conferidas por tools/wiki-check.ts.
import { BUYBACK_MAX } from '../core/world/shop';
import { BOSS_PCT_HP } from '../core/world/boss';
import { TELEPORT_COST } from '../core/teleport';
import { bal } from '../core/balance';
import { CRIT_AGILITY_MAX, CRIT_TOTAL_MAX, computeDerived, emptyAttrs } from '../core/stats';
import { SKILL_MAX_LEVEL, skillScale } from '../core/skills';
import {
  BASES,
  CLASSES,
  BONUS_POOL,
  SKILLS,
  CONSUMABLES,
  ELEMENT_NAMES,
  EPIC,
  EPIC_BONUSES,
  EPIC_NAMES,
  EQUIP_TIERS,
  GEM_CFG,
  gemValue,
  sellPrice,
  GROUND_SECONDS,
  MERCHANT,
  MONSTERS,
  POTIONS,
  PROGRESSION,
  freePointsText,
  RARITIES,
  REPAIR_COST_PER_POINT,
  SELL_RATIO,
  SLOT_NAMES,
  STAT_LABELS,
  UPGRADE_STEP,
  WEAR_PER_HIT,
  esc,
  iconHtml,
  type AttrKey,
} from './data';
import { statsAt } from './monsters';
import {
  LEVELUP_POSE_S,
  MOUNTS,
  RELIC_DROP,
  RELIC_RARITIES,
  RELIC_REQ_LEVEL,
  RELICS,
  XP_BANK_LEVELS,
  relicEffectText,
} from '../core/data';
import {
  TRIAL_BOSSES,
  trialEquipReqLevel,
  TRIAL_MIN_LEVEL,
  TRIAL_STATS,
  TRIAL_TIERS,
  TRIAL_COST_GROWTH,
  trialBossLevel,
  trialCost,
  trialDropPct,
  trialGold,
  trialStats,
  trialSummonLevel,
  trialWeakness,
  trialXp,
} from '../core/trial';
import { itemLink } from './ui';
import { MAPS_CONFIG, MAP_IDS } from '../core/mapsConfig';
const MAP_TITLES: Record<string, string> = {
  bambu: 'Bosque de Bambu Sombrio',
  pico: 'Pico da Névoa',
  vale: 'Vale das Cinzas Rubras',
  palacio: 'Ruínas do Palácio Celeste',
};

const n1 = (v: number) => String(+v.toFixed(1)).replace('.', ',');
const pc = (v: number) => `${n1(v * 100)}%`;
const kv = (rows: [string, string][]) =>
  `<table class="tbl kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
const formula = (f: string) => `<div class="formula">${f}</div>`;

// ---------- cópias de regras do jogo (conferidas por tools/wiki-check.ts) ----------
/** hitChance em src/core/combat.ts */
export const hitChance = (hit: number, evasion: number) => Math.max(0.05, Math.min(0.95, 0.5 + (hit - evasion) / 200));
/** constantes de src/core/world.ts */
export const TOWN_REGEN = 0.03;
export const DEATH_DURABILITY_LOSS = 0.1;
const RESPAWN_SECONDS = 3;
const REGEN_DELAY = 5;
/** FORGE e custos em src/core/world/forge.ts */
export const FORGE = {
  upgradeChance: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],
  upgradeGold: { base: 30, perPlus: 30 },
  rarityGold: { incomum: 200, raro: 600 } as Record<string, number>,
  rerollGold: { incomum: 100, raro: 200 } as Record<string, number>,
  epicGoldMul: 2,
  epicRerollMul: 3,
};
/** Bônus do Épico para a classe no nível (1,3 × máximo do Raro). */
export function epicBonusesAt(classId: string, level: number) {
  const scale = 1 + 0.2 * (Math.max(1, level) - 1);
  return (EPIC_BONUSES[classId] ?? []).map((s) => {
    const d = BONUS_POOL.find((p) => p.stat === s)!,
      v = d.max * scale * EPIC.mul;
    return {
      stat: s === 'elemAtk' ? `elem_${CLASSES[classId].element}` : s,
      value: d.max >= 1 ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000,
    };
  });
}
const levelFactor = (reqLevel: number) => 1 + reqLevel / 5;
const fGold = (v: number, reqLevel: number) => Math.round(v * levelFactor(reqLevel) * bal('forja.ouro'));
type Mats = Record<string, number>;
const clean = (m: Mats): Mats => Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0));
/** Material raro: Cristal de Gelo nos itens nv 1–15, Jade da Névoa nos nv 20+ (JADE_FROM_LEVEL em forge.ts). */
const JADE_FROM_LEVEL = 20;
const rareMat = (reqLevel: number) => (reqLevel >= JADE_FROM_LEVEL ? 'jade_nevoa' : 'cristal_gelo');
/** Itens nv 35+ pedem o dobro do material raro (RARE_DOUBLE_FROM_LEVEL em forge.ts). */
const RARE_DOUBLE_FROM_LEVEL = 35;
const rq = (reqLevel: number, n: number) => (reqLevel >= RARE_DOUBLE_FROM_LEVEL ? 2 * n : n);
export function upgradeCost(reqLevel: number, plus: number) {
  return {
    mats: clean({
      minerio_ferro: 2 + 2 * plus,
      [rareMat(reqLevel)]: rq(reqLevel, plus >= 4 ? plus - 3 : 0),
      essencia_qi: plus >= 7 ? 1 : 0,
    }),
    gold: fGold(FORGE.upgradeGold.base + FORGE.upgradeGold.perPlus * plus, reqLevel),
    chance: Math.min(1, FORGE.upgradeChance[plus] * bal('forja.chance')),
  };
}
export const rarityCost = (reqLevel: number, from: string) =>
  from === 'comum'
    ? {
        mats: { minerio_ferro: 12, [rareMat(reqLevel)]: rq(reqLevel, 1) } as Mats,
        gold: fGold(FORGE.rarityGold.incomum, reqLevel),
      }
    : {
        mats: { minerio_ferro: 20, [rareMat(reqLevel)]: rq(reqLevel, 4), essencia_qi: 1 } as Mats,
        gold: fGold(FORGE.rarityGold.raro, reqLevel),
      };
export const rerollCost = (reqLevel: number, rarity: string) =>
  rarity === 'incomum'
    ? {
        mats: { minerio_ferro: 6, [rareMat(reqLevel)]: rq(reqLevel, 1) } as Mats,
        gold: fGold(FORGE.rerollGold.incomum, reqLevel),
      }
    : {
        mats: { minerio_ferro: 10, [rareMat(reqLevel)]: rq(reqLevel, 2) } as Mats,
        gold: fGold(FORGE.rerollGold.raro, reqLevel),
      };
export const salvageYield = (reqLevel: number, rarity: string, plus: number): Mats => {
  const hi = rarity === 'raro' || rarity === 'epico';
  return clean({
    minerio_ferro: 1 + Math.floor(reqLevel / 5) + (rarity === 'incomum' ? 2 : hi ? 3 : 0) + Math.floor(plus / 2),
    [rareMat(reqLevel)]: rq(reqLevel, (reqLevel >= 10 ? 1 : 0) + (hi ? 1 : 0) + (plus >= 6 ? 1 : 0)),
    essencia_qi: rarity === 'epico' ? 1 : 0,
  });
};
/** LOW_WEAR_FROM_LEVEL e LOW_WEAR_MUL em src/core/world/inventory.ts (nível 40): itens nv 35+ gastam metade. */
export const LOW_WEAR_FROM_LEVEL = 35;
export const LOW_WEAR_MUL = 0.5;
/** OFFLINE_TIERS e OFFLINE_GOLD_CAP_HOURS em src/core/offline.ts */
export const OFFLINE_TIERS = [
  { untilH: 12, eff: 0.6 },
  { untilH: 18, eff: 0.4 },
  { untilH: 24, eff: 0.2 },
].map((t) => ({ ...t, eff: Math.min(1, t.eff * bal('offline.eficiencia')) }));
export const OFFLINE_GOLD_CAP_HOURS = 3;
/** padrões de src/core/auto.ts */
const AUTO_MAX_LEVEL_GAP = 2;
const AUTO_MAX_LEVEL_LIMIT = 5;

const mats = (m: Mats) =>
  Object.entries(m)
    .map(([id, q]) => `${iconHtml(id, 'sm')}×${q}`)
    .join(' ') || '—';

// ---------- páginas ----------
const TOPICS = [
  { id: 'combate', label: 'Combate e atributos', icon: 'skill_corte_duplo' },
  { id: 'morte', label: 'Morte, vida e durabilidade', icon: 'pocao_hp_g' },
  { id: 'forja', label: 'Forja e economia', icon: 'minerio_ferro' },
  { id: 'auto', label: 'Auto-combate e ganho offline', icon: 'pergaminho_retorno' },
  { id: 'trial', label: 'Trial (desafio de chefes)', icon: 'essencia_qi' },
  { id: 'epico', label: 'Equipamento Épico', icon: 'epico_colar' },
  { id: 'gemas', label: 'Gemas e encaixes', icon: 'po_estrela' },
  { id: 'montarias', label: 'Montarias', icon: 'pergaminho_retorno' },
  { id: 'reliquias', label: 'Relíquias', icon: 'colar_jade' },
];

export { EPIC };

export function mechanicsPage(topic?: string): string {
  const t = TOPICS.find((x) => x.id === topic);
  const tabs = `<nav class="tabs">${TOPICS.map((x) => `<a class="${x.id === topic ? 'on' : ''}" href="#/mecanicas/${x.id}">${x.label}</a>`).join('')}</nav>`;
  if (!t)
    return `<h1>Mecânicas</h1><p class="intro">Como o jogo funciona por dentro. As fórmulas e números aqui são os do jogo.</p>
      <div class="grid cats">${TOPICS.map((x) => `<a class="card-link" href="#/mecanicas/${x.id}">${iconHtml(x.icon, 'sm')}<b>${x.label}</b></a>`).join('')}</div>`;
  const body = { combate, morte, forja, auto, trial, epico, gemas, montarias, reliquias }[t.id as 'combate']();
  return `<a class="back" href="#/mecanicas">‹ Mecânicas</a><h1>${t.label}</h1>${tabs}${body}`;
}

/** Gemas e encaixes (Porto Noturno): regras em src/core/world/gems.ts; números de items.json "gems". */
function gemas(): string {
  const lvs = GEM_CFG.levelNames,
    fmtG = (n: number) => n.toLocaleString('pt-BR'),
    gem = (c: string, l = '') =>
      `<span style="display:inline-block;width:10px;height:10px;transform:rotate(45deg);background:${c};margin-right:6px;border:1px solid #0006"></span>${l}`;
  const val = (stat: string, v: number) => (stat === 'critChance' ? `${+(v * 100).toFixed(1)}%` : `${v}`);
  const rows = Object.values(GEM_CFG.types)
    .map((t) => {
      const stats = Object.keys(t.stats);
      return `<tr><td>${gem(t.color)}<b>${esc(t.name)}</b></td><td>${stats.map((k) => esc(STAT_LABELS[k] ?? k)).join(' + ')}</td>${lvs
        .map((_, i) => `<td>+${val(stats[0], t.stats[stats[0]][i])}</td>`)
        .join('')}</tr>`;
    })
    .join('');
  const price = lvs
    .map((l, i) => {
      const fuse = i ? fmtG(Math.round(gemValue(i + 1) * GEM_CFG.fuseCostPct)) : '—';
      return `<tr><td>${l}</td><td>${fmtG(gemValue(i + 1))}</td><td>${i ? `${GEM_CFG.fuse}× ${lvs[i - 1]} + ${fuse} ouro` : `${fmtG(GEM_CFG.price)} ouro no Joalheiro`}</td><td>${fmtG(Math.round(gemValue(i + 1) * GEM_CFG.removeCostPct))}</td><td>${sellPrice(gemValue(i + 1))}</td></tr>`;
    })
    .join('');
  const sock = (['comum', 'incomum', 'raro', 'epico'] as const)
    .map(
      (r) =>
        `<td style="color:${RARITIES[r].color}">${esc(RARITIES[r].name)}: <b>${GEM_CFG.socketsByRarity[r]}</b></td>`,
    )
    .join('');
  const open = GEM_CFG.socketCost
    .map(
      (c, i) =>
        `<li>${i + 1}º encaixe: <b>${fmtG(c.gold)} ouro</b>${Object.keys(c.mats).length ? ' + ' + mats(c.mats) : ''}</li>`,
    )
    .join('');
  return `<section class="panel"><h2>O que é</h2>
      <p>Equipamentos ganham <b>encaixes</b> no <a href="#/npc/ferreiro_mestre">Ferreiro-mestre</a>, e cada encaixe recebe uma <b>gema</b>,
      que soma atributos ao item. As gemas são vendidas pelo <a href="#/npc/joalheiro">Joalheiro</a> e vão de nível ${lvs[0]} a ${lvs[lvs.length - 1]}.
      Ficam na aba de materiais da mochila e empilham. Item quebrado (durabilidade 0) perde também o efeito das gemas.</p></section>
    <section class="panel"><h2>Gemas</h2><div class="scroll"><table class="tbl"><thead><tr><th>Gema</th><th>Atributo</th>${lvs.map((l) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted">Ônix soma o valor nas duas defesas; Topázio, na precisão e na esquiva. Cornalina, Água-marinha, Citrino e Malaquita somam ataque de Fogo, Gelo, Trovão e Veneno (o dano elemental só sai no elemento da sua seita).</p></section>
    <section class="panel"><h2>Comprar e fundir</h2><p>O Joalheiro só vende gemas de nível ${lvs[0]}. <b>${GEM_CFG.fuse} gemas iguais</b> viram 1 do nível
      seguinte, pagando ${pc(GEM_CFG.fuseCostPct)} do valor da gema nova. Ele também vende ${itemLink('po_estrela')} por ${fmtG(GEM_CFG.starDustPrice)} ouro.</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Nível</th><th>Valor</th><th>Como conseguir</th><th>Retirar (ouro)</th><th>Venda</th></tr></thead><tbody>${price}</tbody></table></div></section>
    <section class="panel"><h2>Encaixes</h2><p>Máximo por raridade:</p><table class="tbl"><tbody><tr>${sock}</tr></tbody></table>
      <p>Abrir (um de cada vez, na ordem):</p><ul>${open}</ul>
      <p><b>Colocar</b> uma gema num encaixe vazio é grátis. <b><b>Não dá para repetir</b> o mesmo tipo de gema no mesmo item (nem em níveis diferentes). <b>Retirar</b> custa ${pc(GEM_CFG.removeCostPct)} do valor da gema, que volta inteira para a mochila.
      Item com gema <b>não pode ser vendido, destruído nem desmontado</b> (nem pelo Auto): retire as gemas antes.</p></section>`;
}

function reliquias(): string {
  const rows = Object.values(RELICS)
    .map((r) => {
      const rar = RELIC_RARITIES[r.rarity];
      const stats = Object.entries(r.stats)
        .map(([k, v]) => `+${k === 'critChance' ? `${+(v * 100).toFixed(1)}%` : v} ${esc(STAT_LABELS[k] ?? k)}`)
        .join(', ');
      const where = r.rarity === 'lendaria' ? 'Drop de chefe' : `${r.price.toLocaleString('pt-BR')} ouro`;
      return `<tr><td>${r.icon} <b style="color:${rar.color}">${esc(r.name)}</b></td><td>${esc(rar.name)}</td><td>${stats}</td><td>${esc(relicEffectText(r))}</td><td>${where}</td></tr>`;
    })
    .join('');
  return `<section class="panel"><h2>Relíquias</h2>
      <p>Um espaço de equipamento próprio, abaixo do corpo na janela do Personagem, liberado no <b>nível ${RELIC_REQ_LEVEL}</b>.
      Cada relíquia dá atributos fixos e <b>um efeito único</b> (roubo de vida, velocidade de ataque, recarga das skills ou vida máxima em %).</p>
      <ul><li><b>Comuns e raras:</b> vendidas pelo <a href="#/npc/antiquario">Antiquário Lao</a>, no bairro sul do <a href="#/mapa/porto">Porto Noturno</a>.</li>
      <li><b>Lendárias:</b> não estão à venda. Cada chefe derrotado (do mundo, de masmorra ou do Trial) com você no nível ${RELIC_DROP.minPlayerLevel} tem
      ${Math.round(RELIC_DROP.chance * 100)}% de chance de dar uma lendária que você ainda não tem.</li>
      <li>Compradas ou ganhas uma vez, ficam na sua coleção para sempre; troque a equipada quando quiser, sem custo.</li>
      <li>Sem durabilidade, forja nem encaixe de gemas; não ocupam a mochila e não podem ser vendidas.</li></ul>
      <table><tr><th>Relíquia</th><th>Raridade</th><th>Atributos</th><th>Efeito</th><th>Onde</th></tr>${rows}</table></section>`;
}

function montarias(): string {
  const rows = Object.values(MOUNTS)
    .map(
      (m) =>
        `<tr><td><b>${esc(m.name)}</b></td><td>${m.price.toLocaleString('pt-BR')} ouro</td><td>+${Math.round(m.speedBonus * bal('montaria.velocidade') * 100)}%</td><td>${m.mountDelay} s</td></tr>`,
    )
    .join('');
  return `<section class="panel"><h2>Montarias</h2>
      <p>Vendidas pelo <a href="#/npc/estabulo">Cavalariço Ma</a>, no estábulo do <a href="#/mapa/porto">Porto Noturno</a> (nível 50). Compradas uma vez, valem para sempre e em todos os mapas.</p>
      <ul><li><b>Montar pelo botão:</b> o botão do cavalo, ao lado do Auto (tecla H no computador), sobe e desce da montaria. Para montar, é preciso estar alguns segundos sem dar nem levar golpes.</li>
      <li><b>Só fora de combate:</b> ao golpear ou ser golpeado, desmonta na hora e volta à velocidade normal; para montar de novo, toque no botão.</li>
      <li>A montaria só muda a velocidade de andar; não dá atributos nem muda o combate. O Auto também anda montado.</li></ul>
      <table><tr><th>Montaria</th><th>Preço</th><th>Velocidade fora de combate</th><th>Monta após</th></tr>${rows}</table></section>`;
}

function epico(): string {
  const col = RARITIES.epico.color,
    lvs = [1, 10, 20, 30],
    SECT = ['lamina', 'pavilhao', 'tita', 'vibora'];
  const names = [
    ...['colar', 'tronco', 'cabeca', 'calca', 'bota'].map((s) => [SLOT_NAMES[s], EPIC_NAMES[s], s]),
    ...SECT.map((c) => [`Arma (${esc(CLASSES[c].name)})`, EPIC_NAMES[`arma_${c}`], `arma_${c}`]),
  ]
    .map(
      ([a, b, k]) =>
        `<tr><td>${a}</td><td><a href="#/item/epico_${k}">${iconHtml(`epico_${k}`, 'sm')} <b style="color:${col}">${esc(b)}</b></a></td></tr>`,
    )
    .join('');
  const bon = SECT.map((c) => {
    const st = epicBonusesAt(c, 1).map((b) => esc(STAT_LABELS[b.stat] ?? b.stat));
    return `<tr><td>${esc(CLASSES[c].name)}</td><td>${st.join(' + ')}</td>${lvs
      .map(
        (lv) =>
          `<td>${epicBonusesAt(c, lv)
            .map((b) => `+${b.value}`)
            .join(' / ')}</td>`,
      )
      .join('')}</tr>`;
  }).join('');
  return `<section class="panel"><h2>O que é</h2>
      <p>A raridade <b style="color:${col}">${esc(RARITIES.epico.name)}</b> (roxa) fica acima do Raro. O item <b>não tem nível</b>: acompanha o
      nível do personagem para sempre, então nunca fica velho. Ele usa a peça da sua faixa (a mesma que um Raro do seu nível teria; muda nos
      níveis ${EQUIP_TIERS.filter((t) => t > 1).join(', ')}), com os atributos <b>×${n1(EPIC.mul)}</b>, e cai com 2 bônus feitos para a sua classe
      (dá para trocá-los na forja), cada um ${n1(EPIC.mul)} × o máximo que um Raro do seu nível sortearia. Equipa em qualquer nível (a arma só na própria seita).</p></section>
    <section class="panel"><h2>Como cai</h2><ul>
      <li>Qualquer monstro: <b>${pc(EPIC.chanceMob)}</b> por abate. Chefes (mapa, masmorra e <a href="#/mecanicas/trial">Trial</a>): <b>${pc(EPIC.chanceBoss)}</b>.</li>
      <li>Só jogando: com o <a href="#/mecanicas/auto">Auto</a> ligado e no ganho offline não cai. Ajudantes invocados por chefes também não dão.</li>
      <li>O monstro precisa ter nível igual ou maior que o seu menos ${EPIC.maxLevelsBelow}.</li>
      <li>A peça é sorteada entre todas as que você usa (armas só da sua seita). Sem garantia: é raro de propósito.</li>
      <li>Mochila cheia: ele fica no chão por ${EPIC.groundSeconds / 60} minutos (os outros itens, ${GROUND_SECONDS} s). Sair do mapa limpa o chão.</li></ul></section>
    <section class="panel"><h2>Nomes</h2><table class="tbl"><tbody>${names}</tbody></table></section>
    <section class="panel"><h2>Bônus por classe</h2><div class="scroll"><table class="tbl"><thead><tr><th>Seita</th><th>Bônus</th>${lvs.map((lv) => `<th>Nível ${lv}</th>`).join('')}</tr></thead><tbody>${bon}</tbody></table></div>
      <p class="muted">Elemento de cada seita: ${SECT.map((c) => `${esc(CLASSES[c].name)} ${ELEMENT_NAMES[CLASSES[c].element]}`).join(', ')}. Os bônus seguem a classe de quem está usando o item.</p></section>
    <section class="panel"><h2>Forja</h2><p>Cai +0 e melhora até +10 no ferreiro, com os materiais e as chances do Raro da sua faixa e <b>${FORGE.epicGoldMul}× o ouro</b>.
      Não sobe de raridade e <b>não pode ser vendido</b>. Conserto pelo seu nível. Ver <a href="#/mecanicas/forja">Forja</a>.</p>
      <p><b>Trocar bônus:</b> sorteia 2 atributos diferentes do pool de bônus (podem sair outros que não os da classe), com a mesma força épica
      e acompanhando o seu nível. Custa <b>${FORGE.epicRerollMul}×</b> os materiais e o ouro da troca de um Raro da sua faixa.</p>
      <p><b>Desmontar:</b> rende como um Raro da sua faixa mais 1 ${itemLink('essencia_qi')}. O ferreiro pede confirmação duas vezes.</p></section>`;
}

/** Seção "Crítico" de Combate: de onde vem a chance de crítico e os dois tetos. */
function critico(): string {
  const base = computeDerived(emptyAttrs());
  const perAgi = computeDerived({ ...emptyAttrs(), agility: 1 });
  const perChance = perAgi.critChance - base.critChance,
    perDmg = perAgi.critDamage - base.critDamage;
  const agiCap = Math.ceil((CRIT_AGILITY_MAX - base.critChance) / perChance - 1e-9);
  const weapons = Object.entries(BASES)
    .filter(([, b]) => b.slot === 'arma' && b.stats?.critChance)
    .sort(([, a], [, b]) => a.reqLevel - b.reqLevel);
  const byLevel = [...new Set(weapons.map(([, b]) => b.reqLevel))]
    .map((lv) => {
      const ws = weapons.filter(([, b]) => b.reqLevel === lv);
      const v = ws[0][1].stats!.critChance!;
      return `<tr><td>${lv}</td><td>${ws.map(([, b]) => esc(b.name)).join(', ')}</td><td>+${pc(v)}</td><td>+${pc(v * (1 + UPGRADE_STEP * 10))}</td><td>+${pc(v * (1 + UPGRADE_STEP * 10) * EPIC.mul)}</td></tr>`;
    })
    .join('');
  const bonus = BONUS_POOL.find((b) => b.stat === 'critChance');
  const passives = Object.entries(SKILLS).flatMap(([c, list]) =>
    list
      .filter((d) => d.type === 'passive' && d.passive?.crit)
      .map(
        (d) =>
          `<li><b>${esc(d.name)}</b> (passiva da ${esc(CLASSES[c].name)}, nível ${d.unlock}): +${pc(d.passive!.crit!)} no nível 1 da skill, +${pc(
            d.passive!.crit! * skillScale(SKILL_MAX_LEVEL),
          )} no nível ${SKILL_MAX_LEVEL}.</li>`,
      ),
  );
  const top = weapons[weapons.length - 1]?.[1].stats?.critChance ?? 0,
    topWeapon = top * (1 + UPGRADE_STEP * 10) * EPIC.mul;
  const pas =
    Object.values(SKILLS)
      .flat()
      .reduce((m, d) => Math.max(m, d.type === 'passive' ? (d.passive?.crit ?? 0) : 0), 0) *
    skillScale(SKILL_MAX_LEVEL);
  const ex = `Exemplo: ${agiCap} de Agilidade (${pc(CRIT_AGILITY_MAX)}) + a arma Épica +10 mais alta (+${pc(topWeapon)})${
    pas ? ` + passiva no nível ${SKILL_MAX_LEVEL} (+${pc(pas)})` : ''
  } = <b>${pc(Math.min(CRIT_TOTAL_MAX, CRIT_AGILITY_MAX + topWeapon + pas))}</b>; o resto só vem de bônus de crítico nas outras peças.`;
  return `<section class="panel"><h2>Crítico</h2>
      <p>Um golpe crítico multiplica o dano pelo <b>Dano crítico</b>. A chance de crítico soma três fontes e tem <b>dois tetos</b>.</p>
      <h3>1. Agilidade (até ${pc(CRIT_AGILITY_MAX)})</h3>
      ${formula(`Chance de crítico = ${pc(base.critChance)} + ${pc(perChance)} por ponto de Agilidade (máximo ${pc(CRIT_AGILITY_MAX)})`)}
      <p>O teto de <b>${pc(CRIT_AGILITY_MAX)}</b> chega com <b>${agiCap} de Agilidade</b> (somando base, níveis, pontos e equipamento).
      Acima disso a Agilidade <b>não dá mais chance de crítico</b>, mas continua dando <b>+${pc(perDmg)} de Dano crítico</b> por ponto (sem limite),
      além de Precisão e Esquiva.</p>
      ${formula(`Dano crítico = ${pc(base.critDamage)} + ${pc(perDmg)} por ponto de Agilidade`)}
      <h3>2. Equipamento</h3>
      <p>Soma por cima do teto da Agilidade. As armas a partir do nível ${weapons[0]?.[1].reqLevel ?? '?'} têm chance de crítico na base, que a
      <a href="#/mecanicas/forja">forja</a> aumenta (${pc(UPGRADE_STEP)} do valor por +) e o <a href="#/mecanicas/epico">Épico</a> multiplica por ${n1(EPIC.mul)}:</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Nível</th><th>Armas</th><th>+0</th><th>+10</th><th>Épico +10</th></tr></thead><tbody>${byLevel}</tbody></table></div>
      ${bonus ? `<p>Itens Incomuns e Raros também podem sortear o bônus <b>Chance de crítico</b> (de +${pc(bonus.min)} a +${pc(bonus.max)}, crescendo com o nível do item), em qualquer peça.</p>` : ''}
      <h3>3. Passivas</h3><ul>${passives.join('') || '<li>Nenhuma no momento.</li>'}</ul>
      <h3>Teto final: ${pc(CRIT_TOTAL_MAX)}</h3>
      <p>Somando tudo, a chance de crítico nunca passa de <b>${pc(CRIT_TOTAL_MAX)}</b>. ${ex} Para subir mais, o caminho é equipamento com crítico,
      não mais Agilidade. A ficha do personagem mostra o valor final.</p></section>`;
}

function combate(): string {
  const ATTRS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
  const base = computeDerived(emptyAttrs());
  const per = ATTRS.map((a) => {
    const d = computeDerived({ ...emptyAttrs(), [a]: 1 });
    const gives = (Object.keys(d) as (keyof typeof d)[])
      .filter((k) => d[k] !== base[k])
      .map((k) => {
        const diff = d[k] - base[k];
        const pctStat = k === 'critChance' || k === 'critDamage';
        return `+${pctStat ? pc(diff) : n1(diff)} ${STAT_LABELS[k] ?? k}`;
      });
    return `<tr><th>${STAT_LABELS[a]}</th><td>${gives.join(', ')}</td></tr>`;
  }).join('');
  // exemplo: Tormenta nível 1 contra Lobo nível 1
  const cls = CLASSES.lamina,
    me = computeDerived({ ...cls.baseAttributes });
  const wolf = MONSTERS.lobo ? statsAt(MONSTERS.lobo, 1).d : null;
  const elem = cls.elementAttack[cls.element] ?? 0;
  const ex = wolf
    ? (() => {
        const red = 1 - wolf.physDef / (wolf.physDef + 100);
        const avg = me.physAtk * red + elem;
        return `<h3>Exemplo</h3><p>Uma ${esc(cls.name)} de nível 1 (Precisão ${me.hit}, Ataque físico ${me.physAtk}, +${elem} de Trovão) contra um Lobo de nível 1
          (Esquiva ${wolf.evasion}, Defesa física ${n1(wolf.physDef)}):</p><ul>
          <li>Chance de acertar: 50% + (${me.hit} − ${wolf.evasion}) ÷ 200 = <b>${pc(hitChance(me.hit, wolf.evasion))}</b></li>
          <li>Defesa do lobo: ${n1(wolf.physDef)} ÷ (${n1(wolf.physDef)} + 100) = ${pc(1 - red)} de redução</li>
          <li>Dano médio: ${me.physAtk} × ${n1(red * 100)}% + ${elem} = <b>${n1(avg)}</b> (de ${n1(me.physAtk * 0.9 * red + elem)} a ${n1(me.physAtk * 1.1 * red + elem)});
          crítico (${pc(me.critChance)} de chance) faz ${pc(me.critDamage)} disso.</li>
          <li>Um lobo de nível 1 tem ${MONSTERS.lobo ? statsAt(MONSTERS.lobo, 1).d.maxHp : '?'} de vida.</li></ul>`;
      })()
    : '';
  const xpRows = PROGRESSION.xpToNext.map((v, i) => `<tr><td>${i + 1} → ${i + 2}</td><td>${v}</td></tr>`).join('');
  return `<section class="panel"><h2>Atributos</h2>
      <p>Cada ponto em um atributo dá:</p><table class="tbl kv">${per}</table>
      <p class="muted">Base com 0 em tudo: ${base.maxHp} de vida, ${base.maxMana} de mana, ${base.physAtk} de ataque, ${base.hit} de precisão,
      ${pc(base.critChance)} de crítico (ver <b>Crítico</b> abaixo) e dano crítico de ${pc(base.critDamage)}.
      Equipamentos somam atributos e status direto.</p></section>
    <section class="panel"><h2>Acerto</h2>${formula('Chance de acertar = 50% + (Precisão do atacante − Esquiva do alvo) ÷ 200')}
      <p>Fica sempre entre <b>5%</b> e <b>95%</b>. Vale para você e para os monstros.</p></section>
${critico()}
    <section class="panel"><h2>Dano</h2>
      ${formula('Dano = Ataque × (90% a 110%) × (1 − Defesa ÷ (Defesa + 100)) + Ataque elemental')}
      <ul><li>Dano <b>físico</b> usa Ataque físico contra Defesa física; <b>espiritual</b> usa Ataque espiritual contra Defesa espiritual.</li>
      <li>O <b>ataque elemental</b> (Fogo, Gelo, Trovão ou Veneno, conforme a seita) entra inteiro, sem defesa.</li>
      <li><b>Crítico:</b> multiplica o golpe pelo Dano crítico.</li>
      <li><b>Skills</b> causam uma porcentagem desse dano (ex.: 180%) e ficam 8% mais fortes a cada nível da skill. Ver <a href="#/skills">Skills</a>.</li>
      <li><b>Ultimate</b> (a partir do nível 10, uma por seita): uma barra que enche com skills que acertam e, cheia, solta um golpe de área com a mesma conta das skills; a da Geada também deixa os monstros lentos e os congela no fim, a do Titã os mantém atordoados e a da Víbora os envenena. Só o jogador solta; o Auto nunca usa. Ver a página de cada <a href="#/seitas">seita</a>.</li>
      <li>Alguns monstros têm defesa física ou espiritual multiplicada: a página de cada <a href="#/monstros">monstro</a> diz qual tipo de dano funciona melhor.</li>
      <li><b>Escudos</b> absorvem o dano antes da vida. <b>Redução de defesa</b> diminui as duas defesas do alvo. <b>Lentidão</b> e <b>atordoamento</b> não mudam o dano.</li>
      <li><b>Aura elemental</b>: a cada 100 de Ataque do elemento da seita a aura em volta do personagem cresce um nível, até o máximo com 600 ou mais. Tormenta: faíscas e raios; Geada: flocos, névoa fria e cristais orbitando; Titã: brasas, chamas nos pés e espiral de fogo; Víbora: bolhas, gotas e poça tóxica com névoa verde. É só visual, funciona com qualquer traje e pode ser desligada nas Configurações.</li>
      ${cls.lifeSteal ? `<li><b>Roubo de vida</b> (Tormenta): ${pc(cls.lifeSteal)} do dano causado volta como vida (só o dano que o alvo ainda podia levar; o excesso não cura).</li>` : ''}</ul>${ex}</section>
    <section class="panel"><h2>Níveis</h2><p>Nível máximo <b>${PROGRESSION.levelCap}</b>. A cada nível você ganha os atributos automáticos da sua <a href="#/seitas">seita</a>
      e <b>${freePointsText()}</b> para distribuir (o <a href="#/npc/monge_pagode">Monge do Pagode</a>, na Cidadela de Jade, devolve todos os pontos distribuídos por ${PROGRESSION.attrResetCost.toLocaleString('pt-BR')} de ouro). Quem já estava no nível 20 antes do nível máximo subir para 30 continua no 20, com a barra do 21 em 0%. XP vem de monstros e de <a href="#/missoes">missões</a>.</p>
      <p><b>Você escolhe a hora de subir.</b> A XP fica guardada: quando ela paga um nível, o seu quadro (canto de cima, à esquerda) brilha em dourado
      e um aviso aparece. Clique/toque no quadro (ou aperte <b>U</b>) para subir um nível. Dá para guardar até <b>${XP_BANK_LEVELS} níveis prontos</b>;
      com a XP cheia, os monstros, as missões e o ganho offline <b>não dão mais XP</b> (o excesso se perde) e cada abate avisa "XP cheia" até você subir.</p>
      <p>Ao subir de nível o personagem ergue os braços envolto em luz dourada e fica <b>parado por ${String(LEVELUP_POSE_S).replace('.', ',')} s</b> (o Auto espera),
      bom para prints e vídeos. Nos níveis 10, 20 e 30 a luz é maior e mais longa.</p>
      <details class="more"><summary>XP para cada nível</summary><table class="tbl"><thead><tr><th>Nível</th><th>XP</th></tr></thead><tbody>${xpRows}</tbody></table></details></section>`;
}

function morte(): string {
  const loss = DEATH_DURABILITY_LOSS * bal('desgaste.equipamento');
  const repair = (lv: number, missing: number) => Math.max(1, Math.ceil(missing * lv * REPAIR_COST_PER_POINT));
  const dur = Object.values(BASES)[0]?.durability ?? 100;
  const rows = EQUIP_TIERS.map(
    (lv) => `<tr><td>${lv}</td><td>${repair(lv, dur * loss)} ouro</td><td>${repair(lv, dur)} ouro</td></tr>`,
  ).join('');
  const pots = Object.entries(POTIONS)
    .map(
      ([id, p]) =>
        `<li>${itemLink(id)}: ${pc(p.percent)} da ${p.kind === 'hp' ? 'vida' : 'mana'} em ${p.duration} s, ${p.price} ouro</li>`,
    )
    .join('');
  return `<section class="panel"><h2>Ao morrer</h2><ul>
      <li>Depois de ${RESPAWN_SECONDS} s você volta à <a href="#/mapa/cidade">Vila das Nuvens</a> com vida e mana cheias. Nos mapas além do portão leste da <a href="#/mapa/cidadela">Cidadela de Jade</a> (<a href="#/mapa/vale">Vale das Cinzas Rubras</a> e <a href="#/mapa/palacio">Ruínas do Palácio Celeste</a>), volta à Cidadela; o Pergaminho de Retorno também leva para lá.</li>
      <li>Cada item equipado perde <b>${pc(loss)} da durabilidade máxima</b>.</li>
      <li>Você <b>não</b> perde XP, ouro nem itens. Efeitos de poção ativos acabam.</li></ul></section>
    <section class="panel"><h2>Durabilidade</h2><ul>
      <li>Cada golpe que você <b>leva</b> tira ${n1(WEAR_PER_HIT * bal('desgaste.equipamento'))} de durabilidade de um item equipado sorteado; itens de nível <b>${LOW_WEAR_FROM_LEVEL}</b> ou mais perdem só <b>${pc(LOW_WEAR_MUL)}</b> disso (o Épico conta pela faixa do seu nível). Golpe <b>todo absorvido por um escudo</b> (Pele de Ferro, Véu de Névoa…) não desgasta.</li>
      <li>Com durabilidade <b>0</b>, o item para de dar bônus (mas não some). Um aviso ⚠ aparece no topo da tela quando algo está gasto.</li>
      <li>O <a href="#/npc/ferreiro">Ferreiro</a> conserta:</li></ul>
      ${formula('Conserto = durabilidade que falta × nível do item × ' + n1(REPAIR_COST_PER_POINT * bal('conserto.custo')) + ' (arredondado para cima)')}
      <table class="tbl"><thead><tr><th>Nível do item</th><th>Depois de 1 morte</th><th>Item quebrado (0 → ${dur})</th></tr></thead><tbody>${rows}</tbody></table></section>
    <section class="panel"><h2>Recuperar vida e mana</h2><ul>
      <li>Na <b>vila</b>: ${pc(TOWN_REGEN)} da vida e da mana por segundo, depois de ${REGEN_DELAY} s sem levar dano.</li>
      <li>Fora da vila, só com poções (e a passiva <a href="#/skill/meditacao_celeste">Mente Serena</a>, da Geada, para mana).</li>
      <li>Poções curam aos poucos. Um efeito de cada tipo por vez: tomar outra do mesmo tipo reinicia o efeito.</li></ul>
      <ul>${pots}</ul>
      <p class="muted">Itens que caem no chão somem depois de ${GROUND_SECONDS} s.</p></section>`;
}

function forja(): string {
  const lvs = EQUIP_TIERS;
  const up = Array.from({ length: FORGE.upgradeChance.length }, (_, plus) => {
    const c = upgradeCost(1, plus);
    return `<tr><td>+${plus} → +${plus + 1}</td><td>${pc(c.chance)}</td><td>${mats(c.mats)}</td>${lvs.map((lv) => `<td>${upgradeCost(lv, plus).gold}</td>`).join('')}</tr>`;
  }).join('');
  const goldHead = lvs.map((lv) => `<th>Ouro (item nv ${lv})</th>`).join('');
  const rr = (label: string, f: (lv: number) => { mats: Mats; gold: number }) =>
    `<tr><td>${label}</td><td>${mats(f(1).mats)}</td>${lvs.map((lv) => `<td>${f(lv).gold}</td>`).join('')}</tr>`;
  const sal = (['comum', 'incomum', 'raro', 'epico'] as const)
    .map(
      (r) =>
        `<tr><td style="color:${RARITIES[r].color}">${RARITIES[r].name}</td>${lvs.map((lv) => `<td>${mats(salvageYield(lv, r, 0))}</td>`).join('')}</tr>`,
    )
    .join('');
  const rarRows = Object.values(RARITIES)
    .filter((r) => r.valueMul > 0) // Épico não se vende
    .map(
      (r) =>
        `<tr><td style="color:${r.color}">${esc(r.name)}</td><td>×${n1(r.valueMul)}</td><td>${pc(SELL_RATIO * r.valueMul)}</td><td>${r.valueMul > 1 ? `${pc(MERCHANT.priceMul * r.valueMul)}` : '—'}</td></tr>`,
    )
    .join('');
  return `<section class="panel"><h2>Melhorar (+1 a +10)</h2>
      <p>Cada + soma <b>${pc(UPGRADE_STEP)}</b> aos atributos base do item (não aos bônus aleatórios). Materiais e ouro são cobrados antes;
      se <b>falhar</b>, o item fica como estava (não quebra nem perde +). Os materiais da tabela são os de itens até o nível 15; em itens de
      nível ${JADE_FROM_LEVEL} ou mais, o ${itemLink('jade_nevoa')} entra no lugar do ${itemLink('cristal_gelo')} (mesma quantidade; em itens de nível ${RARE_DOUBLE_FROM_LEVEL} ou mais, o <b>dobro</b>), aqui e em subir raridade, trocar bônus e desmontar.
      O <a href="#/mecanicas/epico" style="color:${RARITIES.epico.color}">Épico</a> usa a faixa do seu nível e custa <b>${FORGE.epicGoldMul}× o ouro</b> para melhorar e <b>${FORGE.epicRerollMul}×</b> materiais e ouro para trocar bônus; não sobe raridade. Desmontado, rende como um Raro + 1 ${itemLink('essencia_qi')}.</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Melhoria</th><th>Chance</th><th>Materiais</th>${goldHead}</tr></thead><tbody>${up}</tbody></table></div></section>
    <section class="panel"><h2>Subir raridade e trocar bônus</h2>
      <p><b>Subir raridade</b> (Comum → Incomum → Raro) dá um bônus aleatório novo e mantém os que o item já tem. <b>Trocar bônus</b> sorteia de novo
      todos os bônus de um item Incomum ou Raro (a quantidade continua a mesma). Os dois sempre funcionam.</p>
      <div class="scroll"><table class="tbl"><thead><tr><th></th><th>Materiais</th>${goldHead}</tr></thead><tbody>
      ${rr('Comum → Incomum', (lv) => rarityCost(lv, 'comum'))}${rr('Incomum → Raro', (lv) => rarityCost(lv, 'incomum'))}
      ${rr('Trocar bônus (Incomum)', (lv) => rerollCost(lv, 'incomum'))}${rr('Trocar bônus (Raro)', (lv) => rerollCost(lv, 'raro'))}</tbody></table></div></section>
    <section class="panel"><h2>Desmontar</h2><p>Transforma um equipamento em materiais. Itens com + devolvem um pouco mais (+1 minério a cada 2 +, +1 cristal ou jade a partir do +6).</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Raridade</th>${lvs.map((lv) => `<th>Item nv ${lv}</th>`).join('')}</tr></thead><tbody>${sal}</tbody></table></div></section>
    <section class="panel"><h2>Comprar e vender</h2><ul>
      <li>O <a href="#/npc/vendedor">Vendedor de Poções</a> compra qualquer item por <b>${pc(SELL_RATIO)}</b> do valor de referência (vezes o multiplicador da raridade).
        Na aba Vender há venda em lote dos equipamentos Comuns (ou Comuns + Incomuns), que deixa de fora os itens com + e os trancados.</li>
      <li><b>Recomprar:</b> os últimos ${BUYBACK_MAX} itens que você vendeu ao vendedor voltam pelo mesmo preço, na aba Recomprar, até fechar o jogo (vendas do Auto não entram).</li>
      <li><b>Cadeado:</b> na mochila, o botão Trancar protege um equipamento: trancado, ele não pode ser vendido (nem pelo Auto), destruído nem desmontado.</li>
      <li><b>Destruir:</b> o botão Destruir da mochila apaga um item sem ganho; Épicos não podem ser destruídos (só desmontados no ferreiro).</li>
      <li>O <a href="#/npc/mercador">Mercador Ambulante</a> vende equipamentos Incomuns e Raros por <b>${n1(MERCHANT.priceMul)}×</b> o valor, renovando a cada ${MERCHANT.refreshMinutes} min,
        e sempre tem ${Object.keys(MERCHANT.materials).map(itemLink).join(', ')} e ${Object.keys(CONSUMABLES).map(itemLink).join(', ')}.</li></ul>
      <table class="tbl"><thead><tr><th>Raridade</th><th>Multiplicador</th><th>Venda (% do valor)</th><th>Mercador (% do valor)</th></tr></thead><tbody>${rarRows}</tbody></table>
      <p class="muted">O valor de referência de cada item está na página dele, em <a href="#/itens">Itens</a>.</p></section>`;
}

function auto(): string {
  const tiers = OFFLINE_TIERS.map(
    (t, i) => `<tr><td>${i ? OFFLINE_TIERS[i - 1].untilH : 0} a ${t.untilH} h</td><td>${pc(t.eff)}</td></tr>`,
  ).join('');
  return `<section class="panel"><h2>Auto-combate</h2><p>Liga no botão <b>Auto</b> (ou tecla Z). Com o jogo aberto, o personagem caça sozinho no mapa todo.
      O botão ☰ ao lado abre o menu de opções. Qualquer movimento manual pausa o auto. Nas masmorras (<a href="#/mapa/gruta">Desfiladeiro</a>, <a href="#/mapa/mosteiro">Mosteiro</a>, <a href="#/mapa/covil">Covil</a>) e no <a href="#/mecanicas/trial">Trial</a> o auto não funciona.</p><ul>
      <li><b>Alvos:</b> ataca o monstro mais perto, até <b>${AUTO_MAX_LEVEL_GAP} níveis acima</b> do seu (ajustável de +0 a +${AUTO_MAX_LEVEL_LIMIT}).
        Monstros 2+ níveis abaixo ("cinzas") ficam por último. Evita caminhos que atraem grupos. Nunca ataca chefes.</li>
      <li><b>Revide:</b> por padrão, revida quem o atacar; dá para limitar ao nível máximo ou desligar e, nesse caso, escolher entre continuar, se afastar ou voltar à vila.</li>
      <li><b>Skills e poções:</b> você escolhe quais skills ele usa e com quanto de vida/mana toma poção (padrão: vida abaixo de 40%, mana abaixo de 30%).
        Escudos saem ao levar dano em combate (vida abaixo de 90%) ou com 2+ monstros atacando; curas, com a vida abaixo de 60%. O auto guarda mana para eles enquanto estão prontos.</li>
      <li><b>Sem poções:</b> volta à vila, compra a quantidade definida no menu (se tiver ouro) e retorna.</li>
      <li><b>Mochila cheia:</b> quando a aba de equipamentos lota, volta à vila, vende no vendedor os equipamentos Comuns (opção para vender Incomuns também; itens trancados ficam) e retorna. Raros nunca são vendidos: se só sobrarem eles, continua caçando e os drops que não couberem ficam no chão.</li>
      <li><b>Morte:</b> volta da vila e continua, desde que nenhum item equipado esteja com durabilidade 0. Se estiver, para e espera você.</li>
      <li>Ligado na vila, vai sozinho para o melhor mapa de caça para o seu nível.</li>
      <li><b>Teleporte:</b> o auto só usa o <a href="#/npc/caminhos">Mestre dos Caminhos</a> quando o mapa de caça não tem caminho a pé (hoje todos têm).
        Nesse caso, paga os ${TELEPORT_COST} de ouro sozinho; sem ouro, caça onde dá para ir andando.</li>
      <li>As skills ganham experiência normalmente no auto-combate.</li>
      <li><b>Economia de bateria:</b> com o auto caçando e sem tocar na tela por um tempo (⚙ Configurações: 30 s, 1 min — padrão —, 2 min ou desligado), o jogo entra no <b>modo descanso</b>: tela preta com o resumo do que foi ganho, a bateria atual do aparelho e quanto dela foi gasto durante o descanso (quando o navegador informa), a 10 quadros por segundo e sem nenhum som. A caça rende o mesmo (drops de material incluídos, pois o jogo segue aberto). Um toque volta ao normal; se o auto parar ou o personagem cair, o jogo volta sozinho. Com o auto ligado, o celular não apaga a tela sozinho (apagada, o jogo iria para segundo plano e contaria como offline).</li></ul></section>
    <section class="panel"><h2>Ganho offline</h2><p>Se você fechar o jogo com o auto-combate ligado num mapa de caça, ao voltar recebe XP, ouro e itens pelo tempo fora,
      calculados pelo ritmo que o auto estava tendo (monstros por minuto, XP, ouro, drops e poções por abate).</p>
      <table class="tbl"><thead><tr><th>Tempo fora</th><th>Eficiência</th></tr></thead><tbody>${tiers}<tr><td>mais de ${OFFLINE_TIERS[OFFLINE_TIERS.length - 1].untilH} h</td><td>0%</td></tr></tbody></table>
      <ul><li><b>Mapas do nível 20 ao 30:</b> caçando no ${MAP_IDS.filter((id) => (MAPS_CONFIG[id].offlineMul ?? 1) < 1)
        .map((id) => `<a href="#/mapa/${id}">${esc(MAP_TITLES[id] ?? id)}</a>`)
        .join(
          ' e no ',
        )}, a eficiência é <b>${pc(MAPS_CONFIG.bambu.offlineMul ?? 1)}</b> da tabela acima (ex.: ${pc(OFFLINE_TIERS[0].eff * (MAPS_CONFIG.bambu.offlineMul ?? 1))} nas primeiras ${OFFLINE_TIERS[0].untilH} h).</li>
      <li><b>Teto de ouro:</b> cada volta dá no máximo ${OFFLINE_GOLD_CAP_HOURS} h de ouro de caça no seu ritmo.</li>
      <li><b>Itens:</b> só poções e equipamentos Comuns. Materiais, consumíveis e equipamentos Incomuns/Raros só caem jogando.</li>
      <li>Offline não há morte nem desgaste. Gasta poções; se acabarem, os ganhos continuam.</li>
      <li>As skills <b>não</b> ganham experiência offline.</li>
      <li>Offline o personagem <b>não sobe de nível</b>: a XP vai para a XP guardada (até ${XP_BANK_LEVELS} níveis prontos; o resto se perde) e você sobe quando quiser.</li>
      <li>Ao minimizar o app ou trocar de aba, o ganho conta se você ficar fora pelo menos 5 minutos. No computador vale também fechar a aba e o tempo em que a proteção de tela, o bloqueio ou a suspensão pararam o jogo.</li></ul></section>`;
}

/** Trial (src/core/trial.ts, World.enterTrial/spawnTrialBoss, inventory.trialLoot). */
function trial(): string {
  const S = TRIAL_STATS,
    pct2 = (v: number) => v.toFixed(2).replace('.', ',');
  const tiers = Array.from({ length: TRIAL_TIERS }, (_, i) => i + 1)
    .map((t) => {
      const st = trialStats(MONSTERS.rei_bandidos, trialBossLevel(t)),
        [g0, g1] = trialGold(t);
      return `<tr><td>${t}</td><td>${trialBossLevel(t)}</td><td>${trialCost(t)}</td><td>+${pct2(trialDropPct(t))}%</td><td>${st.hp}</td><td>${Math.max(st.physDef, st.spiritDef)} / ${Math.min(st.physDef, st.spiritDef)}</td><td>${g0}–${g1}</td></tr>`;
    })
    .join('');
  const bosses = TRIAL_BOSSES.map((id) => {
    const m = MONSTERS[id],
      b = m.boss!,
      mech = ['círculos'];
    if (b.line) mech.push('linha / leque');
    if (b.summon) mech.push(`invoca ${b.summon.count}`);
    if (b.enrage) mech.push('fúria');
    return `<tr><td><a href="#/monstro/${id}">${m.name}</a></td><td><b>${trialWeakness(m) === 'physical' ? 'Físico' : 'Espiritual'}</b></td><td>${n1(m.attackInterval)} s</td><td>${n1(m.moveSpeed)}</td><td>${mech.join(', ')}</td></tr>`;
  }).join('');
  return `<section class="panel"><h2>O que é</h2><p>Uma arena onde você escolhe <b>qual chefe</b> enfrentar e em <b>qual nível</b>.
      O portal fica na saída sul da <a href="#/mapa/cidade">vila</a>; pisar nele abre o menu. Precisa ser nível <b>${TRIAL_MIN_LEVEL}</b>.</p><ul>
      <li><b>${TRIAL_TIERS} níveis por chefe:</b> no nível 1 o chefe é nível ${trialBossLevel(1)}; cada nível do Trial sobe o chefe em 1 (nível ${TRIAL_TIERS} = chefe ${trialBossLevel(TRIAL_TIERS)}).</li>
      <li><b>Liberação:</b> vencer o nível N de um chefe libera o N+1 <b>daquele chefe</b>. O progresso fica salvo.</li>
      <li><b>Entrada:</b> ${trialCost(1)} de ouro no nível 1, +${Math.round((TRIAL_COST_GROWTH - 1) * 100)}% a cada nível (${trialCost(TRIAL_TIERS)} no nível ${TRIAL_TIERS}); o chefe devolve só 40–60% da entrada em ouro: farmar o Trial <b>gasta</b> ouro.</li>
      <li>Como nas masmorras: o <a href="#/mecanicas/auto">Auto</a> não funciona, nada renasce e morrer, sair pelo portal ou fechar o jogo encerra a luta (paga de novo para tentar).</li>
      <li><b>Torre de chefes:</b> ao vencer, uma janela pergunta se você quer seguir para o próximo nível (paga a entrada dele e o chefe volta na hora, sem sair da arena) repetir o mesmo nível (bom para farmar) ou sair do Trial (volta para a vila). O portal da entrada também leva de volta.</li></ul></section>
    <section class="panel"><h2>Ponto fraco</h2><p>No Trial todos os chefes têm a <b>mesma vida e o mesmo dano por segundo</b> no mesmo nível. O que muda é o jeito de lutar e o ponto fraco:
      defesa alta contra um tipo de dano e baixa contra o outro. Tormenta, Titã e Víbora causam dano físico; Geada, espiritual.
      Quem bate mais devagar bate mais forte (dano proporcional ao intervalo entre golpes). Além disso, todo golpe de chefe tira <b>${Math.round(BOSS_PCT_HP.basic * 100)}% da sua vida máxima</b> por golpe normal (proporcional ao intervalo) e ${Math.round(BOSS_PCT_HP.telegraph * 100)}% por 1× de dano dos golpes marcados no chão, sem redução pela defesa (valores para chefe nível ${BOSS_PCT_HP.fullLevel}+; menos nos níveis abaixo). A defesa reduz só a outra parte do golpe.</p>
      <table class="tbl"><thead><tr><th>Chefe</th><th>Fraco contra</th><th>Golpe a cada</th><th>Passo</th><th>Mecânicas</th></tr></thead><tbody>${bosses}</tbody></table>
      <p class="muted">Ajudantes invocados vêm ${trialBossLevel(1) - trialSummonLevel(trialBossLevel(1))} níveis abaixo do chefe.</p></section>
    <section class="panel"><h2>Níveis</h2>
      ${formula(`vida = ${S.hp} × ${n1(S.hpGrowth)}<sup>(nível do chefe − 21)</sup> · ataque = ${S.atk} × ${String(S.atkGrowth).replace('.', ',')}<sup>(nível − 21)</sup> × intervalo / ${n1(S.refInterval)} · defesa forte ${S.defStrong}, fraca ${S.defWeak}, × ${String(S.defGrowth).replace('.', ',')}<sup>(nível − 21)</sup>`)}
      <table class="tbl"><thead><tr><th>Nível</th><th>Chefe</th><th>Entrada</th><th>Bônus de drop</th><th>Vida</th><th>Defesa forte / fraca</th><th>Ouro</th></tr></thead><tbody>${tiers}</tbody></table></section>
    <section class="panel"><h2>Recompensa</h2><ul>
      <li>Ouro da tabela acima e ${trialXp(1)} de XP no nível 1 (+${trialXp(2) - trialXp(1)} por nível).</li>
      <li>1 equipamento <b>Raro</b> garantido e 1 equipamento de raridade sorteada, os dois de nível ${trialEquipReqLevel(1)} nos níveis 1–5 do Trial, de nível ${trialEquipReqLevel(6)} nos níveis 6–14 e de nível ${trialEquipReqLevel(TRIAL_TIERS)} nos níveis 15–${TRIAL_TIERS} (a base mais alta do jogo; da sua seita, se for arma), com os bônus do <b>nível do chefe</b> (${trialBossLevel(1)}–${trialBossLevel(TRIAL_TIERS)}): mais fortes que os mesmos itens caídos no mundo.</li>
      <li>Os materiais de forja do chefe (os mesmos do mundo).</li>
      <li><b>Bônus de drop:</b> a chance de equipamento e de material é multiplicada por 1 + o bônus do nível (12% no nível 1, +0,3 ponto por nível: 12,30%, 12,60% … ${pct2(trialDropPct(TRIAL_TIERS))}% no ${TRIAL_TIERS}). O <b>Épico</b> não entra no bônus: continua 1% por chefe. O que passa de 100% vira chance de cair <b>mais um</b>: no nível 1, 12% de chance de um segundo equipamento sorteado e de um lote extra de cada material.</li></ul></section>`;
}
