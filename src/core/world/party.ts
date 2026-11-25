// Masmorra em equipe (docs/decisoes/masmorras.md, "Masmorra em equipe (bots)"): o jogador entra com 3 bots
// aliados (src/core/bots.ts). Aqui ficam a criação do grupo, o quadro de cada bot (IA -> ação no mundo, com
// caminho pelo mapa e as skills de verdade), a morte do bot e o reviver (segurar perto dele).
import { botActives, botDrink, botLevelFor, botThink, dist, makeBot, pickBotClasses, tickBot, type Bot } from '../bots';
import { expectedDamage } from '../combat';
import { MONSTERS } from '../data';
import { dungeonById } from '../dungeons';
import { GLOBAL_COOLDOWN, skillScale, type SkillDef } from '../skills';
import type { Entity } from '../types';
import { findPath, isWalkable } from '../pathfinding';
import type { World } from '../world';

/** Tamanho do grupo de bots (o jogador + 3). */
export const PARTY_BOTS = 3;
/** Reviver: segurar perto do bot caído por estes segundos; ele volta com esta fração da vida e da mana. */
export const REVIVE_SECONDS = 3;
export const REVIVE_HP = 0.5;
/** Distância máxima do bot caído para reviver. */
export const REVIVE_REACH = 1.8;
/** Mana dos bots: 1% da máxima por segundo (o jogador só regenera com passiva; sem isso o bot zera cedo). */
export const BOT_MANA_REGEN = 0.01;

/** Cria o grupo de bots para a masmorra (classes sorteadas, nível do meio da faixa até o do jogador). */
export function makeParty(w: World, dungeonId: string): Bot[] {
  const d = dungeonById(dungeonId);
  if (!d) return [];
  const lv = botLevelFor(d.levels, w.player.level);
  return pickBotClasses(w.classId, PARTY_BOTS, w.rng).map((c, i) => makeBot(c, lv, 'ally', w.rng, i));
}

/** Põe os bots em volta do jogador (depois da troca de mapa). */
export function placeParty(w: World) {
  const p = w.player;
  w.party.forEach((b, i) => {
    const a = (i * 2 * Math.PI) / PARTY_BOTS + Math.PI / 2;
    for (const r of [1.2, 0.8, 0.4, 0]) {
      const x = p.x + Math.cos(a) * r,
        y = p.y + Math.sin(a) * r;
      if (r === 0 || isWalkable(w.map, x, y)) {
        b.e.x = x;
        b.e.y = y;
        break;
      }
    }
    b.e.path = [];
  });
}

/** Monstros que o bot enxerga: os que já estão lutando ou o alvo do jogador (o grupo não puxa monstro sozinho). */
function enemiesFor(w: World): Entity[] {
  return w.monsters.filter((m) => !m.dead && (m.ai === 'chase' || m.id === w.targetId));
}

export function tickParty(w: World, dt: number) {
  if (!w.party.length) return;
  const enemies = enemiesFor(w),
    allies = [w.player, ...w.party.map((b) => b.e)].filter((e) => !e.dead);
  for (const b of w.party) {
    const e = b.e;
    tickBot(b, dt);
    w.tickBuffs(e, dt);
    if (e.dead || w.player.dead) continue;
    e.mana = Math.min(e.derived.maxMana, e.mana + e.derived.maxMana * BOT_MANA_REGEN * dt);
    if (w.isStunned(e)) continue;
    const a = botThink(b, { leader: w.player, leaderTargetId: w.targetId, enemies, allies });
    if (a.kind === 'potion') {
      if (botDrink(b, a.potion)) w.emit({ type: 'botPotion', botId: e.id, kind: a.potion });
    } else if (a.kind === 'move') {
      e.repathCd -= dt;
      const goal = e.path[e.path.length - 1];
      if (e.repathCd <= 0 || !goal || dist(goal, a) > 0.8) {
        e.repathCd = 0.3;
        e.path = findPath(w.map, e, a);
      }
      w.followPath(e, dt, 1);
    } else if (a.kind === 'attack') {
      const t = w.monsters.find((m) => m.id === a.targetId && !m.dead);
      if (t && e.attackCd <= 0 && dist(e, t) <= e.attackRange) {
        e.path = [];
        e.attackCd = e.attackInterval;
        w.attack(e, t);
      }
    } else if (a.kind === 'skill') {
      const def = botActives(b).find((s) => s.id === a.skillId);
      if (def) castBotSkill(w, b, def, w.monsters.find((m) => m.id === a.targetId && !m.dead) ?? null);
    }
  }
  tickRevive(w, dt);
}

/** Skill do bot no mundo: mesmos efeitos da skill do jogador (golpes, área, avanço, enfraquecer, veneno, atordoar,
 *  escudo e cura), no nível de skill do bot. */
export function castBotSkill(w: World, b: Bot, def: SkillDef, t: Entity | null) {
  const e = b.e,
    scale = skillScale(b.skillLevel);
  if (def.target === 'target' && !def.area && !t) return;
  const around = def.area === 'self' ? e : def.area === 'target' ? (t ?? e) : null;
  let victims: Entity[] = t ? [t] : [];
  if (around) victims = w.monsters.filter((m) => !m.dead && dist(m, around) <= (def.radius ?? 0));
  if (def.dash && t) {
    const d = dist(e, t);
    if (d > 1) {
      const k = (d - 1) / d,
        dest = { x: e.x + (t.x - e.x) * k, y: e.y + (t.y - e.y) * k };
      if (!isWalkable(w.map, dest.x, dest.y)) return;
      w.emit({ type: 'dash', fromX: e.x, fromY: e.y, toX: dest.x, toY: dest.y });
      e.x = dest.x;
      e.y = dest.y;
      e.path = [];
    }
  }
  e.mana -= def.mana ?? 0;
  b.cds[def.id] = def.cooldown ?? 0;
  b.gcd = GLOBAL_COOLDOWN;
  e.attackCd = Math.max(e.attackCd, 0.3);
  w.emit({
    type: 'skillCast',
    skillId: def.id,
    casterId: e.id,
    x: e.x,
    y: e.y,
    targetId: t?.id ?? null,
    tx: (t ?? e).x,
    ty: (t ?? e).y,
    ranged: e.attackRange > 3,
  });
  for (const v of victims) {
    if (!def.hits?.length) {
      applyOnHit(w, e, def, v, scale);
      if (!v.dead && v.ai !== 'return') w.aggroBy(v, e);
      continue;
    }
    for (const pct of def.hits) {
      if (v.dead) break;
      const r = w.attack(e, v, pct * scale, true);
      if (r.hit && !v.dead) applyOnHit(w, e, def, v, scale);
    }
  }
  if (def.shield) w.addBuff(e, def.id, 'shield', e.derived.maxHp * def.shield.percent * scale, def.shield.duration);
  if (def.heal)
    w.addBuff(e, def.id, 'regen', (e.derived.maxHp * def.heal.percent * scale) / def.heal.duration, def.heal.duration);
}

function applyOnHit(w: World, e: Entity, def: SkillDef, v: Entity, scale: number) {
  if (v.dead) return;
  if (def.debuff) w.addBuff(v, `${def.id}#${e.id}`, def.debuff.kind, def.debuff.value, def.debuff.duration);
  if (def.poison) {
    const res = Math.min(0.9, MONSTERS[v.monsterId]?.poisonRes ?? 0);
    const total = expectedDamage(e, v) * def.poison.percent * scale * (1 - res);
    w.addBuff(v, `${def.id}#${e.id}`, 'poison', total / def.poison.duration, def.poison.duration);
  }
  if (def.stun) w.addBuff(v, def.id, 'stun', 0, def.stun);
}

/** Bot caiu: fica no chão até ser revivido (ou até o fim da corrida). */
export function killBot(w: World, e: Entity) {
  e.dead = true;
  e.hp = 0;
  e.path = [];
  e.buffs = [];
  w.emit({ type: 'botDeath', botId: e.id, name: e.name });
  for (const m of w.monsters) if (m.foeId === e.id) m.foeId = undefined;
}

/** Luta em andamento: algum monstro perseguindo alguém. Acabada a luta, cada bot pode ser revivido de novo. */
export const inFight = (w: World) => w.monsters.some((m) => !m.dead && m.ai === 'chase');

/** Bot caído ao alcance que ainda pode ser revivido nesta luta (null se nenhum). */
export function revivable(w: World): Bot | null {
  if (w.player.dead || !w.party.length) return null;
  let best: Bot | null = null,
    bd = REVIVE_REACH;
  for (const b of w.party)
    if (b.e.dead && !w.revivedInFight.has(b.e.id) && dist(b.e, w.player) <= bd) [best, bd] = [b, dist(b.e, w.player)];
  return best;
}

function tickRevive(w: World, dt: number) {
  if (!inFight(w)) w.revivedInFight.clear();
  const b = w.reviving ? revivable(w) : null;
  if (!b || w.moveInput.x || w.moveInput.y) {
    w.reviveT = 0;
    return;
  }
  w.player.path = [];
  w.reviveT += dt;
  if (w.reviveT < REVIVE_SECONDS) return;
  w.reviveT = 0;
  w.reviving = false;
  w.revivedInFight.add(b.e.id);
  b.e.dead = false;
  b.e.hp = Math.round(b.e.derived.maxHp * REVIVE_HP);
  b.e.mana = Math.max(b.e.mana, Math.round(b.e.derived.maxMana * REVIVE_HP));
  b.hot.left = b.hot.leftMp = 0;
  w.emit({ type: 'botRevive', botId: b.e.id, name: b.e.name });
}

/** Monstro escolhe quem persegue: quem o atacou primeiro (foeId) enquanto estiver vivo, senão o mais próximo
 *  entre o jogador e os bots. */
export function foeOf(w: World, m: Entity): Entity {
  const p = w.player;
  if (!w.party.length) return p;
  if (m.foeId !== undefined && m.foeId !== p.id) {
    const b = w.party.find((x) => x.e.id === m.foeId && !x.e.dead);
    if (b) return b.e;
    m.foeId = undefined;
  }
  if (m.foeId === p.id && !p.dead) return p;
  let best = p,
    bd = p.dead ? Infinity : dist(m, p);
  for (const b of w.party) if (!b.e.dead && dist(m, b.e) < bd - 0.5) [best, bd] = [b.e, dist(m, b.e)];
  return best;
}

/** Distância do monstro ao membro do grupo mais próximo (para acordar ao ver um bot). */
export const nearestPartyDist = (w: World, m: Entity) =>
  Math.min(Infinity, ...w.party.filter((b) => !b.e.dead).map((b) => dist(m, b.e)));
