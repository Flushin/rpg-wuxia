// Mecânicas: combate e atributos, morte e durabilidade, forja e economia, auto-combate e ganho offline.
// Tabelas e exemplos saem das fórmulas do jogo; as que são cópias (marcadas) são conferidas por tools/wiki-check.ts.
import { bal } from '../core/balance';
import { computeDerived, emptyAttrs } from '../core/stats';
import {
  BASES,
  CLASSES,
  CONSUMABLES,
  EQUIP_TIERS,
  GROUND_SECONDS,
  MERCHANT,
  MONSTERS,
  POTIONS,
  PROGRESSION,
  RARITIES,
  REPAIR_COST_PER_POINT,
  SELL_RATIO,
  STAT_LABELS,
  UPGRADE_STEP,
  WEAR_PER_HIT,
  esc,
  iconHtml,
  type AttrKey,
} from './data';
import { statsAt } from './monsters';
import {
  TRIAL_BOSSES,
  TRIAL_EQUIP_REQ_LEVEL,
  TRIAL_MIN_LEVEL,
  TRIAL_STATS,
  TRIAL_TIERS,
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
};
const levelFactor = (reqLevel: number) => 1 + reqLevel / 5;
const fGold = (v: number, reqLevel: number) => Math.round(v * levelFactor(reqLevel) * bal('forja.ouro'));
type Mats = Record<string, number>;
const clean = (m: Mats): Mats => Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0));
export function upgradeCost(reqLevel: number, plus: number) {
  return {
    mats: clean({
      minerio_ferro: 2 + 2 * plus,
      cristal_gelo: plus >= 4 ? plus - 3 : 0,
      essencia_qi: plus >= 7 ? 1 : 0,
    }),
    gold: fGold(FORGE.upgradeGold.base + FORGE.upgradeGold.perPlus * plus, reqLevel),
    chance: Math.min(1, FORGE.upgradeChance[plus] * bal('forja.chance')),
  };
}
export const rarityCost = (reqLevel: number, from: string) =>
  from === 'comum'
    ? { mats: { minerio_ferro: 12, cristal_gelo: 1 } as Mats, gold: fGold(FORGE.rarityGold.incomum, reqLevel) }
    : {
        mats: { minerio_ferro: 20, cristal_gelo: 4, essencia_qi: 1 } as Mats,
        gold: fGold(FORGE.rarityGold.raro, reqLevel),
      };
export const rerollCost = (reqLevel: number, rarity: string) =>
  rarity === 'incomum'
    ? { mats: { minerio_ferro: 6, cristal_gelo: 1 } as Mats, gold: fGold(FORGE.rerollGold.incomum, reqLevel) }
    : { mats: { minerio_ferro: 10, cristal_gelo: 2 } as Mats, gold: fGold(FORGE.rerollGold.raro, reqLevel) };
export const salvageYield = (reqLevel: number, rarity: string, plus: number): Mats =>
  clean({
    minerio_ferro:
      1 + Math.floor(reqLevel / 5) + (rarity === 'incomum' ? 2 : rarity === 'raro' ? 3 : 0) + Math.floor(plus / 2),
    cristal_gelo: (reqLevel >= 10 ? 1 : 0) + (rarity === 'raro' ? 1 : 0) + (plus >= 6 ? 1 : 0),
  });
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
];

export function mechanicsPage(topic?: string): string {
  const t = TOPICS.find((x) => x.id === topic);
  const tabs = `<nav class="tabs">${TOPICS.map((x) => `<a class="${x.id === topic ? 'on' : ''}" href="#/mecanicas/${x.id}">${x.label}</a>`).join('')}</nav>`;
  if (!t)
    return `<h1>Mecânicas</h1><p class="intro">Como o jogo funciona por dentro. As fórmulas e números aqui são os do jogo.</p>
      <div class="grid cats">${TOPICS.map((x) => `<a class="card-link" href="#/mecanicas/${x.id}">${iconHtml(x.icon, 'sm')}<b>${x.label}</b></a>`).join('')}</div>`;
  const body = { combate, morte, forja, auto, trial }[t.id as 'combate']();
  return `<a class="back" href="#/mecanicas">‹ Mecânicas</a><h1>${t.label}</h1>${tabs}${body}`;
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
      ${pc(base.critChance)} de crítico (máximo ${pc(computeDerived({ ...emptyAttrs(), agility: 1e4 }).critChance)}) e dano crítico de ${pc(base.critDamage)}.
      Equipamentos somam atributos e status direto.</p></section>
    <section class="panel"><h2>Acerto</h2>${formula('Chance de acertar = 50% + (Precisão do atacante − Esquiva do alvo) ÷ 200')}
      <p>Fica sempre entre <b>5%</b> e <b>95%</b>. Vale para você e para os monstros.</p></section>
    <section class="panel"><h2>Dano</h2>
      ${formula('Dano = Ataque × (90% a 110%) × (1 − Defesa ÷ (Defesa + 100)) + Ataque elemental')}
      <ul><li>Dano <b>físico</b> usa Ataque físico contra Defesa física; <b>espiritual</b> usa Ataque espiritual contra Defesa espiritual.</li>
      <li>O <b>ataque elemental</b> (Fogo, Gelo, Trovão ou Veneno, conforme a seita) entra inteiro, sem defesa.</li>
      <li><b>Crítico:</b> multiplica o golpe pelo Dano crítico.</li>
      <li><b>Skills</b> causam uma porcentagem desse dano (ex.: 180%) e ficam 8% mais fortes a cada nível da skill. Ver <a href="#/skills">Skills</a>.</li>
      <li>Alguns monstros têm defesa física ou espiritual multiplicada: a página de cada <a href="#/monstros">monstro</a> diz qual tipo de dano funciona melhor.</li>
      <li><b>Escudos</b> absorvem o dano antes da vida. <b>Redução de defesa</b> diminui as duas defesas do alvo. <b>Lentidão</b> e <b>atordoamento</b> não mudam o dano.</li>
      ${cls.lifeSteal ? `<li><b>Roubo de vida</b> (Tormenta): ${pc(cls.lifeSteal)} do dano causado volta como vida.</li>` : ''}</ul>${ex}</section>
    <section class="panel"><h2>Níveis</h2><p>Nível máximo <b>${PROGRESSION.levelCap}</b>. A cada nível você ganha os atributos automáticos da sua <a href="#/seitas">seita</a>
      e <b>${PROGRESSION.freePointsPerLevel} pontos</b> para distribuir. XP vem de monstros e de <a href="#/missoes">missões</a>.</p>
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
      <li>Depois de ${RESPAWN_SECONDS} s você volta à <a href="#/mapa/cidade">Vila das Nuvens</a> com vida e mana cheias.</li>
      <li>Cada item equipado perde <b>${pc(loss)} da durabilidade máxima</b>.</li>
      <li>Você <b>não</b> perde XP, ouro nem itens. Efeitos de poção ativos acabam.</li></ul></section>
    <section class="panel"><h2>Durabilidade</h2><ul>
      <li>Cada golpe que você <b>leva</b> tira ${n1(WEAR_PER_HIT * bal('desgaste.equipamento'))} de durabilidade de um item equipado sorteado.</li>
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
  const sal = (['comum', 'incomum', 'raro'] as const)
    .map(
      (r) =>
        `<tr><td style="color:${RARITIES[r].color}">${RARITIES[r].name}</td>${lvs.map((lv) => `<td>${mats(salvageYield(lv, r, 0))}</td>`).join('')}</tr>`,
    )
    .join('');
  const rarRows = Object.values(RARITIES)
    .map(
      (r) =>
        `<tr><td style="color:${r.color}">${esc(r.name)}</td><td>×${n1(r.valueMul)}</td><td>${pc(SELL_RATIO * r.valueMul)}</td><td>${r.valueMul > 1 ? `${pc(MERCHANT.priceMul * r.valueMul)}` : '—'}</td></tr>`,
    )
    .join('');
  return `<section class="panel"><h2>Melhorar (+1 a +10)</h2>
      <p>Cada + soma <b>${pc(UPGRADE_STEP)}</b> aos atributos base do item (não aos bônus aleatórios). Materiais e ouro são cobrados antes;
      se <b>falhar</b>, o item fica como estava (não quebra nem perde +).</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Melhoria</th><th>Chance</th><th>Materiais</th>${goldHead}</tr></thead><tbody>${up}</tbody></table></div></section>
    <section class="panel"><h2>Subir raridade e trocar bônus</h2>
      <p><b>Subir raridade</b> (Comum → Incomum → Raro) dá um bônus aleatório novo e mantém os que o item já tem. <b>Trocar bônus</b> sorteia de novo
      todos os bônus de um item Incomum ou Raro (a quantidade continua a mesma). Os dois sempre funcionam.</p>
      <div class="scroll"><table class="tbl"><thead><tr><th></th><th>Materiais</th>${goldHead}</tr></thead><tbody>
      ${rr('Comum → Incomum', (lv) => rarityCost(lv, 'comum'))}${rr('Incomum → Raro', (lv) => rarityCost(lv, 'incomum'))}
      ${rr('Trocar bônus (Incomum)', (lv) => rerollCost(lv, 'incomum'))}${rr('Trocar bônus (Raro)', (lv) => rerollCost(lv, 'raro'))}</tbody></table></div></section>
    <section class="panel"><h2>Desmontar</h2><p>Transforma um equipamento em materiais. Itens com + devolvem um pouco mais (+1 minério a cada 2 +, +1 cristal a partir do +6).</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Raridade</th>${lvs.map((lv) => `<th>Item nv ${lv}</th>`).join('')}</tr></thead><tbody>${sal}</tbody></table></div></section>
    <section class="panel"><h2>Comprar e vender</h2><ul>
      <li>O <a href="#/npc/vendedor">Vendedor de Poções</a> compra qualquer item por <b>${pc(SELL_RATIO)}</b> do valor de referência (vezes o multiplicador da raridade).</li>
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
      <li><b>Mochila cheia:</b> quando a aba de equipamentos lota, volta à vila, vende no vendedor os equipamentos Comuns (opção para vender Incomuns também) e retorna. Raros nunca são vendidos: se só sobrarem eles, continua caçando e os drops que não couberem ficam no chão.</li>
      <li><b>Morte:</b> volta da vila e continua, desde que nenhum item equipado esteja com durabilidade 0. Se estiver, para e espera você.</li>
      <li>Ligado na vila, vai sozinho para o melhor mapa de caça para o seu nível.</li>
      <li>As skills ganham experiência normalmente no auto-combate.</li>
      <li><b>Economia de bateria:</b> com o auto caçando e sem tocar na tela por um tempo (⚙ Configurações: 30 s, 1 min — padrão —, 2 min ou desligado), o jogo entra no <b>modo descanso</b>: tela preta com o resumo do que foi ganho, a bateria atual do aparelho e quanto dela foi gasto durante o descanso (quando o navegador informa), a 10 quadros por segundo e sem nenhum som. A caça rende o mesmo (drops de material incluídos, pois o jogo segue aberto). Um toque volta ao normal; se o auto parar ou o personagem cair, o jogo volta sozinho. Com o auto ligado, o celular não apaga a tela sozinho (apagada, o jogo iria para segundo plano e contaria como offline).</li></ul></section>
    <section class="panel"><h2>Ganho offline</h2><p>Se você fechar o jogo com o auto-combate ligado num mapa de caça, ao voltar recebe XP, ouro e itens pelo tempo fora,
      calculados pelo ritmo que o auto estava tendo (monstros por minuto, XP, ouro, drops e poções por abate).</p>
      <table class="tbl"><thead><tr><th>Tempo fora</th><th>Eficiência</th></tr></thead><tbody>${tiers}<tr><td>mais de ${OFFLINE_TIERS[OFFLINE_TIERS.length - 1].untilH} h</td><td>0%</td></tr></tbody></table>
      <ul><li><b>Teto de ouro:</b> cada volta dá no máximo ${OFFLINE_GOLD_CAP_HOURS} h de ouro de caça no seu ritmo.</li>
      <li><b>Itens:</b> só poções e equipamentos Comuns. Materiais, consumíveis e equipamentos Incomuns/Raros só caem jogando.</li>
      <li>Offline não há morte nem desgaste. Gasta poções; se acabarem, os ganhos continuam.</li>
      <li>As skills <b>não</b> ganham experiência offline.</li>
      <li>Ao minimizar o app, o ganho conta se você ficar fora pelo menos 5 minutos.</li></ul></section>`;
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
      <li><b>Entrada:</b> ${trialCost(1)} de ouro no nível 1, +${trialCost(2) - trialCost(1)} por nível.</li>
      <li>Como nas masmorras: o <a href="#/mecanicas/auto">Auto</a> não funciona, nada renasce e morrer, sair pelo portal ou fechar o jogo encerra a luta (paga de novo para tentar).</li>
      <li>Depois da vitória, a saída é o portal da entrada (ao sul da arena).</li></ul></section>
    <section class="panel"><h2>Ponto fraco</h2><p>No Trial todos os chefes têm a <b>mesma vida e o mesmo dano por segundo</b> no mesmo nível. O que muda é o jeito de lutar e o ponto fraco:
      defesa alta contra um tipo de dano e baixa contra o outro. Tormenta, Titã e Víbora causam dano físico; Geada, espiritual.
      Quem bate mais devagar bate mais forte (dano proporcional ao intervalo entre golpes).</p>
      <table class="tbl"><thead><tr><th>Chefe</th><th>Fraco contra</th><th>Golpe a cada</th><th>Passo</th><th>Mecânicas</th></tr></thead><tbody>${bosses}</tbody></table>
      <p class="muted">Ajudantes invocados vêm ${trialBossLevel(1) - trialSummonLevel(trialBossLevel(1))} níveis abaixo do chefe.</p></section>
    <section class="panel"><h2>Níveis</h2>
      ${formula(`vida = ${S.hp} × ${n1(S.hpGrowth)}<sup>(nível do chefe − 21)</sup> · ataque = ${S.atk} × ${String(S.atkGrowth).replace('.', ',')}<sup>(nível − 21)</sup> × intervalo / ${n1(S.refInterval)} · defesa forte ${S.defStrong}, fraca ${S.defWeak}, × ${String(S.defGrowth).replace('.', ',')}<sup>(nível − 21)</sup>`)}
      <table class="tbl"><thead><tr><th>Nível</th><th>Chefe</th><th>Entrada</th><th>Bônus de drop</th><th>Vida</th><th>Defesa forte / fraca</th><th>Ouro</th></tr></thead><tbody>${tiers}</tbody></table></section>
    <section class="panel"><h2>Recompensa</h2><ul>
      <li>Ouro da tabela acima e ${trialXp(1)} de XP no nível 1 (+${trialXp(2) - trialXp(1)} por nível).</li>
      <li>1 equipamento <b>Raro</b> garantido e 1 equipamento de raridade sorteada, os dois de nível ${TRIAL_EQUIP_REQ_LEVEL} (da sua seita, se for arma), com os bônus do <b>nível do chefe</b> (21–30): mais fortes que os nível ${TRIAL_EQUIP_REQ_LEVEL} comuns.</li>
      <li>Os materiais de forja do chefe (os mesmos do mundo).</li>
      <li><b>Bônus de drop:</b> a chance de equipamento e de material é multiplicada por 1 + o bônus do nível (12% no nível 1; a cada nível o bônus cresce 5%: 12,60%, 13,23% … ${pct2(trialDropPct(TRIAL_TIERS))}%). O que passa de 100% vira chance de cair <b>mais um</b>: no nível 1, 12% de chance de um segundo equipamento sorteado e de um lote extra de cada material.</li></ul></section>`;
}
