// Páginas de monstros: lista por mapa e página de cada monstro (atributos por nível, comportamento, drops, missões).
import { BOSS_PCT_HP, bossPctScale } from '../core/world/boss';
import { bal } from '../core/balance';
import { computeDerived } from '../core/stats';
import type { Attributes } from '../core/types';
import { EPIC, EQUIP_TIERS, MONSTERS, QUESTS, RARITIES, esc, type Monster } from './data';
import { loadMaps, type WikiMap } from './maps';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { DUNGEON_EQUIP_DROP_MUL } from '../core/dungeons';
import { RELIC_DROP, RELIC_RARITIES, RELICS } from '../core/data';
import { TRIAL_TIERS, isTrialBoss, trialBossLevel, trialWeakness, trialXp } from '../core/trial';
import { spriteHtml } from './npcs';
import { chance, itemLink, questList, spoiler } from './ui';

// Nome do sprite em monsters.json -> folha em public/sprites/ (cópia de BY_TEXTURE em src/render/sprites.ts).
export const SHEETS: Record<string, string> = {
  wolf: 'lobo',
  'bandit-sword': 'bandido_espadachim',
  'bandit-archer': 'bandido_arqueiro',
  terracotta: 'terracota',
  general: 'general',
  'ice-spectre': 'espectro_gelo',
  yeti: 'yeti',
  'fallen-disciple': 'discipulo_caido',
  'fallen-abbot': 'abade_caido',
  'shadow-assassin': 'assassino_sombras',
  'jade-serpent': 'serpente_jade',
  'spirit-crane': 'grou_espiritual',
  'jade-guardian': 'guardiao_jade',
  'mist-lord': 'senhor_nevoa',
  'ash-wanderer': 'andarilho_cinzas',
  'crimson-monk': 'monge_fogo_rubro',
  'celestial-guard': 'guarda_celeste',
  'frost-moon-sorceress': 'feiticeira_lua_fria',
  'crimson-emperor': 'imperador_carmesim',
};
/** Quadro parado virado em 3/4 (direção 1), que mostra melhor o monstro que o de frente. */
export const monsterSprite = (m: Monster, cls = '') => spriteHtml(SHEETS[m.sprite] ?? m.id, cls, 'idle_1_0');

const list = () => Object.values(MONSTERS);
/** Quem invoca este monstro (chefes que chamam ajudantes). */
const summoners = (id: string) => list().filter((m) => m.boss?.summon?.monsterId === id);
/** Monstros "secretos": chefes e os ajudantes que só aparecem na luta contra um chefe (nenhum ponto no mapa). */
export const isSpoiler = (m: Monster, maps: WikiMap[]) =>
  !!m.boss || (summoners(m.id).length > 0 && !maps.some((mp) => mp.spawns.some((s) => s.monster === m.id)));

/** Faixa de níveis em que o monstro aparece: pontos do mapa (que podem mudar a faixa) e invocações. */
function levelRange(m: Monster, maps: WikiMap[]): [number, number] {
  const lv: number[] = [];
  for (const map of maps)
    for (const s of map.spawns)
      if (s.monster === m.id) lv.push(s.minLevel ?? m.minLevel, s.maxLevel ?? s.minLevel ?? m.maxLevel);
  for (const b of summoners(m.id)) lv.push(b.boss!.summon!.level);
  return lv.length ? [Math.min(...lv), Math.max(...lv)] : [m.minLevel, m.maxLevel];
}
const lvText = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** Mesma conta de applyMonsterLevel (src/core/world.ts); conferida por tools/wiki-check.ts. */
export function statsAt(m: Monster, level: number) {
  const a = {} as Attributes;
  for (const k of Object.keys(m.baseAttributes) as (keyof Attributes)[])
    a[k] = Math.round(m.baseAttributes[k] + m.perLevel[k] * (level - 1));
  const d = computeDerived(a);
  d.maxHp = Math.max(1, Math.round(d.maxHp * bal('vida.monstros', m.id)));
  if (m.defMul) {
    d.physDef *= m.defMul.phys;
    d.spiritDef *= m.defMul.spirit;
  }
  const g = m.loot.gold,
    add = (g?.perLevel ?? 0) * (level - 1);
  return {
    d,
    xp: Math.round(m.xpBase + m.xpPerLevel * (level - 1)),
    gold: g ? [Math.round(g.min + add), Math.round(g.max + add)] : null,
  };
}

export async function monsterIndexPage(): Promise<string> {
  const maps = await loadMaps();
  const card = (m: Monster) =>
    `<a class="card-link mon-card" href="#/monstro/${m.id}">${monsterSprite(m)}<b>${esc(m.name)}</b><small>nível ${lvText(levelRange(m, maps))}</small></a>`;
  const shown = new Set<string>();
  const sections = maps
    .map((map) => {
      const ids = [...new Set(map.spawns.map((s) => s.monster))].filter((id) => MONSTERS[id]);
      const open = ids.map((id) => MONSTERS[id]).filter((m) => !isSpoiler(m, maps));
      open.forEach((m) => shown.add(m.id));
      return open.length ? `<h2>${esc(map.name)}</h2><div class="grid mon-grid">${open.map(card).join('')}</div>` : '';
    })
    .join('');
  const secret = list().filter((m) => isSpoiler(m, maps));
  const rest = list().filter((m) => !shown.has(m.id) && !isSpoiler(m, maps));
  return `<h1>Monstros</h1><p class="intro">Onde cada monstro aparece, quanto aguenta, como luta e o que deixa cair.
    O nível do monstro é sorteado dentro da faixa toda vez que ele renasce.</p>${sections}
    ${rest.length ? `<h2>Outros</h2><div class="grid mon-grid">${rest.map(card).join('')}</div>` : ''}
    ${secret.length ? `<h2>Chefes</h2>${spoiler(`<div class="grid mon-grid">${secret.map(card).join('')}</div>`, `Mostrar chefes (${secret.length})`)}` : ''}`;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const s1 = (v: number) => String(+v.toFixed(1));

/** Comportamento em frases curtas, a partir dos dados de combate. */
function behavior(m: Monster): string[] {
  const out: string[] = [];
  const ranged = m.attackRange > 3;
  out.push(
    `${m.damageType === 'physical' ? 'Dano <b>físico</b>' : 'Dano <b>espiritual</b>'}, ${ranged ? `ataca <b>de longe</b> (alcance ${s1(m.attackRange)})` : 'ataca <b>corpo a corpo</b>'}, um golpe a cada ${s1(m.attackInterval)} s.`,
  );
  out.push(`Percebe você a ${s1(m.aggroRange)} de distância.`);
  if (m.keepDistance) out.push('Recua para manter distância quando você se aproxima.');
  if (m.groupAggro) out.push('Anda em grupo: atacar um faz o grupo todo vir atrás de você.');
  if (m.poisonRes)
    out.push(
      `<b>Resiste a veneno:</b> o veneno das skills e o dano de veneno rendem ${Math.round(m.poisonRes * 100)}% menos nele.`,
    );
  if (m.onHit?.slow)
    out.push(
      `Cada acerto deixa você <b>${Math.round(m.onHit.slow * 100)}% mais lento</b> por ${s1(m.onHit.duration)} s.`,
    );
  if (m.slam)
    out.push(
      `A cada ${s1(m.slam.interval)} s, marca o chão ao redor (raio ${s1(m.slam.radius)}) e golpeia após ${s1(m.slam.delay)} s, com ${m.slam.mult}× o dano: saia do círculo.`,
    );
  if (m.defMul) {
    const w = (v: number, what: string) =>
      v > 1.2 ? `${what} <b>alta</b> (×${s1(v)})` : v < 0.8 ? `${what} <b>baixa</b> (×${s1(v)})` : '';
    const parts = [w(m.defMul.phys, 'defesa física'), w(m.defMul.spirit, 'defesa espiritual')].filter(Boolean);
    if (parts.length)
      out.push(
        `${cap(parts.join(' e '))}${m.defMul.phys > m.defMul.spirit * 1.5 ? ': dano espiritual funciona melhor.' : m.defMul.spirit > m.defMul.phys * 1.5 ? ': dano físico funciona melhor.' : '.'}`,
      );
  }
  return out;
}

function bossMechanics(m: Monster, inDungeon: boolean): string {
  const b = m.boss!;
  const pc = (v: number) => `${+(v * 100).toFixed(1)}%`;
  const li: string[] = [`Luta dentro de uma arena (raio ${b.arenaRadius}).`];
  const k = bossPctScale(m.minLevel);
  if (k > 0)
    li.push(
      `Golpes dele tiram também uma parte da sua <b>vida máxima</b>, que a defesa não reduz: ${pc(BOSS_PCT_HP.basic * (m.attackInterval / BOSS_PCT_HP.refInterval) * k)} por golpe normal e ${pc(BOSS_PCT_HP.telegraph * k)} por 1× de dano dos golpes marcados no chão. No Trial vale sempre o valor total.`,
    );
  if (b.aoe && b.line) {
    const l = b.line;
    li.push(
      `A cada ${s1(b.aoe.interval)} s marca um golpe no chão, alternando: um círculo vermelho (raio ${s1(b.aoe.radius)}, ${b.aoe.mult}× o dano) em cima de você e uma <b>linha</b> que sai dele na sua direção (${s1(l.length)} de comprimento, ${s1(l.width)} de largura, ${l.mult}× o dano). Os dois acertam após ${s1(b.aoe.delay)} e ${s1(l.delay)} s. Da linha, desvie para o lado.`,
      `Com ${Math.round(l.fanAtHpPct * 100)}% da vida a linha vira um <b>leque</b> de ${l.fanCount} linhas${b.aoe.intervalPhase2 ? ` e os golpes vêm a cada ${s1(b.aoe.intervalPhase2)} s` : ''}: fique entre elas, longe do chefe, ou atrás dele.`,
    );
  } else if (b.aoe)
    li.push(
      `A cada ${s1(b.aoe.interval)} s marca um círculo vermelho (raio ${s1(b.aoe.radius)}) que explode após ${s1(b.aoe.delay)} s com ${b.aoe.mult}× o dano. Saia de dentro dele!`,
    );
  if (b.summon) {
    const s = MONSTERS[b.summon.monsterId];
    li.push(
      `Com ${Math.round(b.summon.atHpPct * 100)}% da vida, chama ${b.summon.count} <a href="#/monstro/${s?.id}">${esc(s?.name ?? b.summon.monsterId)}</a> (nível ${b.summon.level})${b.aoe?.intervalPhase2 ? ` e passa a marcar círculos a cada ${s1(b.aoe.intervalPhase2)} s` : ''}.`,
    );
  }
  if (b.enrage) {
    const e = b.enrage,
      pc = (x: number) => Math.round(x * 100);
    li.push(
      `Com ${pc(e.atHpPct)}% da vida entra em <b>fúria</b> (fica avermelhado): golpes ${pc(1 / e.attackIntervalMul - 1)}% mais rápidos, ${pc(e.damageMul - 1)}% mais fortes e passo ${pc(e.moveSpeedMul - 1)}% mais rápido${b.aoe?.intervalPhase2 ? `; passa a marcar círculos a cada ${s1(b.aoe.intervalPhase2)} s` : ''}. A fúria só acaba se a luta recomeçar.`,
    );
  }
  li.push(
    inDungeon
      ? 'Chefe de masmorra: não renasce; está de volta a cada nova entrada.'
      : `Renasce ${Math.round(m.respawnSeconds / 60)} minutos depois de derrotado.`,
  );
  if (isTrialBoss(m.id))
    li.push(
      `No <a href="#/mecanicas/trial">Trial</a> volta nos níveis ${trialBossLevel(1)} a ${trialBossLevel(TRIAL_TIERS)}, com as mesmas mecânicas e dá ${trialXp(1).toLocaleString('pt-BR')} a ${trialXp(TRIAL_TIERS).toLocaleString('pt-BR')} de XP (não a da tabela acima). Ponto fraco: dano <b>${trialWeakness(m) === 'physical' ? 'físico' : 'espiritual'}</b>.`,
    );
  return `<ul>${li.map((x) => `<li>${x}</li>`).join('')}</ul>`;
}

function drops(m: Monster): string {
  const L = m.loot,
    rows: string[] = [];
  for (const p of L.potions ?? [])
    rows.push(
      `<li>${itemLink(p.id)} — <b>${chance(p.chance)}</b>${p.minMonsterLevel ? ` <small class="muted">(nível ${p.minMonsterLevel}+)</small>` : ''}</li>`,
    );
  for (const mt of L.materials ?? [])
    rows.push(`<li>${itemLink(mt.id)}${mt.min ? ` ×${mt.min}–${mt.max}` : ''} — <b>${chance(mt.chance)}</b></li>`);
  const eqs = L.equipment ? (Array.isArray(L.equipment) ? L.equipment : [L.equipment]) : [];
  for (const e of eqs) {
    const tiers = EQUIP_TIERS.filter((t) => t <= e.maxReqLevel && t >= (e.minReqLevel ?? 0));
    rows.push(
      `<li>Equipamento de nível ${tiers.join(', ')} — <b>${chance(e.chance)}</b>${e.minMonsterLevel ? ` <small class="muted">(nível ${e.minMonsterLevel}+)</small>` : ''}
       <small class="muted">· tipo sorteado; ver <a href="#/itens/equip">Equipamentos</a></small></li>`,
    );
  }
  // Épico (src/core/world/inventory.ts rollEpic): todo monstro, chefe 1%; só jogando
  rows.push(
    `<li><a href="#/mecanicas/epico" style="color:${RARITIES.epico.color}">Equipamento Épico</a> — <b>${chance(m.boss ? EPIC.chanceBoss : EPIC.chanceMob)}</b>
     <small class="muted">· só jogando, monstro até ${EPIC.maxLevelsBelow} níveis abaixo do seu${summoners(m.id).length ? '; não quando invocado por um chefe' : ''}</small></li>`,
  );
  // fragmentos da relíquia lendária deste chefe (src/core/world.ts rollRelicDrop)
  for (const r of Object.values(RELICS).filter((x) => x.boss === m.id))
    rows.push(
      `<li><a href="#/mecanicas/reliquias" style="color:${RELIC_RARITIES[r.rarity].color}">${r.icon} Fragmento: ${esc(r.name)}</a> — <b>garantido</b>
       <small class="muted">· você no nível ${RELIC_DROP.minPlayerLevel}+; ${RELIC_DROP.perKill} por vitória (${RELIC_DROP.perKillDungeon} em masmorra), ${RELIC_DROP.fragments} montam a relíquia; ${chance(RELIC_DROP.fullChance)} de cair inteira</small></li>`,
    );
  if (L.guaranteed)
    rows.push(
      `<li><b style="color:${RARITIES[L.guaranteed.rarity]?.color}">1 equipamento ${esc(RARITIES[L.guaranteed.rarity]?.name ?? '')}</b> de nível ${L.guaranteed.reqLevel} — <b>garantido</b></li>`,
    );
  return rows.length ? `<ul class="drops">${rows.join('')}</ul>` : '<p class="muted">Não deixa cair itens.</p>';
}

export async function monsterPage(id: string): Promise<string | null> {
  const m = MONSTERS[id];
  if (!m) return null;
  const maps = await loadMaps();
  const [lo, hi] = levelRange(m, maps);
  const A = statsAt(m, lo),
    B = statsAt(m, hi),
    two = lo !== hi;
  const cell = (f: (x: typeof A) => string) => `<td>${f(A)}</td>${two ? `<td>${f(B)}</td>` : ''}`;
  const atk = m.damageType === 'physical' ? 'physAtk' : 'spiritAtk';
  const stats = `<table class="tbl stats"><thead><tr><th></th><th>Nível ${lo}</th>${two ? `<th>Nível ${hi}</th>` : ''}</tr></thead><tbody>
    <tr><th>Vida</th>${cell((x) => String(x.d.maxHp))}</tr>
    <tr><th>${m.damageType === 'physical' ? 'Ataque físico' : 'Ataque espiritual'}</th>${cell((x) => String(Math.round(x.d[atk])))}</tr>
    <tr><th>Defesa física</th>${cell((x) => s1(x.d.physDef))}</tr>
    <tr><th>Defesa espiritual</th>${cell((x) => s1(x.d.spiritDef))}</tr>
    <tr><th>Precisão</th>${cell((x) => String(x.d.hit))}</tr>
    <tr><th>Esquiva</th>${cell((x) => String(x.d.evasion))}</tr>
    <tr><th>XP</th>${cell((x) => String(x.xp))}</tr>
    ${m.loot.gold ? `<tr><th>Ouro</th>${cell((x) => `${x.gold![0]}–${x.gold![1]}`)}</tr>` : ''}
  </tbody></table>`;
  const where = maps.filter((mp) => mp.spawns.some((s) => s.monster === id));
  const sum = summoners(id);
  const called = sum
    .map((b) => `<li>Chamado pelo <a href="#/monstro/${b.id}">${esc(b.name)}</a> durante a luta</li>`)
    .join('');
  // num monstro comum, quem o chama (um chefe) é spoiler; na página secreta, já está tudo escondido
  const whereHtml =
    where
      .map(
        (mp) =>
          `<li><b>${esc(mp.name)}</b> — ${mp.spawns.filter((s) => s.monster === id).length} ponto(s) no mapa</li>`,
      )
      .join('') +
    (where.some((mp) => MAPS_CONFIG[mp.id]?.dungeon) && !m.boss
      ? `<li class="muted">Na masmorra não renasce (instância) e tem +${Math.round((DUNGEON_EQUIP_DROP_MUL - 1) * 100)}% de chance de equipamento.</li>`
      : '') +
    (called && where.length
      ? `</ul>${spoiler(`<ul>${called}</ul>`, 'Também aparece numa luta de chefe')}<ul>`
      : called);
  const qs = QUESTS.filter((q) => q.objective.monster === id);
  const body = `
    <section class="panel"><h2>Onde aparece</h2><ul>${whereHtml || '<li class="muted">Desconhecido</li>'}</ul>
      ${m.boss ? '' : `<p class="muted">Renasce ${m.respawnSeconds} s depois de derrotado.</p>`}</section>
    <section class="panel"><h2>Atributos</h2>${stats}</section>
    <section class="panel"><h2>Como luta</h2><ul>${behavior(m)
      .map((x) => `<li>${x}</li>`)
      .join('')}</ul>
      ${
        m.boss
          ? `<h3>Mecânicas de chefe</h3>${bossMechanics(
              m,
              where.some((mp) => MAPS_CONFIG[mp.id]?.dungeon),
            )}`
          : ''
      }</section>
    <section class="panel"><h2>Drops</h2>${drops(m)}</section>
    ${qs.length ? `<section class="panel"><h2>Missões</h2>${questList(qs)}</section>` : ''}`;
  const head = `<a class="back" href="#/monstros">‹ Monstros</a>
    <div class="detail-head">${monsterSprite(m, 'big')}<div><h1>${esc(m.name)}</h1>
    <div class="sub">${m.boss ? 'Chefe · ' : ''}nível ${lvText([lo, hi])}</div></div></div>`;
  return head + (isSpoiler(m, maps) ? spoiler(body, 'Esta página tem spoilers de chefe. Mostrar mesmo assim') : body);
}
