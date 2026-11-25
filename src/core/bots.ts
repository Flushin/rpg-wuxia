// Bots de combate (masmorra em equipe e arena; regras em docs/decisoes/masmorras.md e docs/decisoes/arena.md).
// Três partes, todas sem tela:
//  1) makeBot: monta o bot (atributos pelas mesmas fórmulas do jogador, equipamento incomum + até 1 raro sem
//     upgrade/gemas/relíquia, poções pequenas);
//  2) botThink: a IA — decide UMA ação por quadro (poção, skill, golpe, andar) a partir do que vê; serve como
//     aliado (segue o líder e ataca o alvo dele) e como inimigo (arena: o alvo é o adversário);
//  3) simulateFight: luta headless simples (andar em linha reta, sem mapa) para checagens e balanceamento.
// A integração com o World (pathfinding, efeitos, desenho) fica para a masmorra em equipe.
import { CLASSES, totalFreePoints } from './data';
import { distributeByRatio } from './distribute';
import { RARITIES, SLOTS, equipmentBaseIds, baseOf, itemStats, makeEquipment, POTIONS } from './items';
import { expectedDamage, rollAttack, type Combatant } from './combat';
import { Rng } from './rng';
import { SKILLS, SKILL_MAX_LEVEL, GLOBAL_COOLDOWN, skillScale, type SkillDef } from './skills';
import { CRIT_TOTAL_MAX, computeDerived, emptyElements } from './stats';
import { ATTR_KEYS, type Attributes, type Entity, type ItemInstance, type Slot } from './types';

/** Poções que o bot carrega: só as pequenas (decisão de 25/11/2026). */
export const BOT_POTIONS = { hp: 'pocao_hp_p', mp: 'pocao_mp_p' } as const;
export const BOT_POTION_COUNT = { hp: 6, mp: 6 };
/** Bebe poção de vida abaixo desta fração (e de mana quando não paga a skill mais barata e está abaixo da fração). */
export const BOT_HP_POTION_AT = 0.4;
export const BOT_MP_POTION_AT = 0.3;
/** Alcance em que o aliado enxerga monstros sozinho e distância máxima do líder antes de largar a luta. */
export const BOT_AGGRO = 7;
export const BOT_LEASH = 12;
/** Distância a que o aliado segue o líder quando não há luta. */
export const BOT_FOLLOW = 2.2;
/** Chance de uma das peças vir Rara (as outras são Incomuns). */
export const BOT_RARE_CHANCE = 0.5;

export type BotTeam = 'ally' | 'enemy';
export interface Bot {
  e: Entity;
  classId: string;
  team: BotTeam;
  /** posição na formação em volta do líder (0..n) */
  slot: number;
  gear: Partial<Record<Slot, ItemInstance>>;
  skillLevel: number;
  /** recarga restante por skill ativa (id -> s) e recarga global */
  cds: Record<string, number>;
  gcd: number;
  potions: { hp: number; mp: number };
  potionCd: number;
  /** cura/mana ao longo do tempo das poções (pontos por segundo e segundos restantes) */
  hot: { hp: number; mp: number; left: number; leftMp: number };
  lifeSteal: number;
  /** dano recebido a menos (passiva do Titã) */
  damageTaken: number;
}

export type BotAction =
  | { kind: 'none' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; targetId: number }
  | { kind: 'skill'; skillId: string; targetId: number | null }
  | { kind: 'potion'; potion: 'hp' | 'mp' };

/** Nível das skills ativas do bot: cresce devagar com o nível (bot ajuda, não carrega). */
export const botSkillLevel = (level: number) => Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(level / 4)));

/** Nível do bot aliado da masmorra: meio da faixa, sem passar do nível do jogador. */
export const botLevelFor = (range: [number, number], playerLevel: number) =>
  Math.max(1, Math.min(playerLevel, Math.round((range[0] + range[1]) / 2)));

/** Sorteia `n` classes diferentes da do jogador (e entre si enquanto houver classes). */
export function pickBotClasses(playerClass: string, n: number, rng: Rng): string[] {
  const pool = Object.keys(CLASSES).filter((c) => c !== playerClass),
    out: string[] = [];
  let bag: string[] = [];
  while (out.length < n) {
    if (!bag.length) bag = [...(pool.length ? pool : Object.keys(CLASSES))];
    out.push(bag.splice(Math.floor(rng.next() * bag.length), 1)[0]);
  }
  return out;
}

/** Melhor base de cada parte para o nível (arma da seita), Incomum; no máximo uma peça Rara; +0, sem gemas. */
export function botGear(classId: string, level: number, rng: Rng): Partial<Record<Slot, ItemInstance>> {
  const el = CLASSES[classId].element,
    out: Partial<Record<Slot, ItemInstance>> = {},
    rare = rng.next() < BOT_RARE_CHANCE ? SLOTS[Math.floor(rng.next() * SLOTS.length)] : null;
  for (const sl of SLOTS) {
    const ids = equipmentBaseIds(sl as Slot).filter((id) => {
      const b = baseOf({ baseId: id } as ItemInstance)!;
      return b.reqLevel <= level && (!b.sect || b.sect === classId);
    });
    if (!ids.length) continue;
    const best = ids.reduce((a, b) =>
      baseOf({ baseId: b } as ItemInstance)!.reqLevel > baseOf({ baseId: a } as ItemInstance)!.reqLevel ? b : a,
    );
    const rarity = sl === rare && RARITIES.raro ? 'raro' : 'incomum';
    out[sl as Slot] = makeEquipment(best, rarity, el, rng);
  }
  return out;
}

let nextBotId = 1_000_000;

/** Monta um bot pronto para lutar (vida e mana cheias). */
export function makeBot(classId: string, level: number, team: BotTeam, rng: Rng, slot = 0): Bot {
  const c = CLASSES[classId];
  if (!c) throw new Error(`classe desconhecida: ${classId}`);
  const attrs = {} as Attributes;
  for (const k of ATTR_KEYS) attrs[k] = c.baseAttributes[k] + (level - 1) * c.levelUpAttributes[k];
  const pts = distributeByRatio(totalFreePoints(level), c.recommendedRatio ?? {}, 0).added;
  for (const k of ATTR_KEYS) attrs[k] += pts[k];
  const gear = botGear(classId, level, rng);
  const g: Record<string, number> = {};
  for (const it of Object.values(gear)) for (const [k, v] of Object.entries(itemStats(it!))) g[k] = (g[k] ?? 0) + v;
  const eff = { ...attrs };
  for (const k of ATTR_KEYS) eff[k] += g[k] ?? 0;
  const d = computeDerived(eff);
  for (const k of [
    'maxHp',
    'maxMana',
    'physAtk',
    'spiritAtk',
    'physDef',
    'spiritDef',
    'hit',
    'evasion',
    'critChance',
    'critDamage',
  ] as const)
    d[k] += g[k] ?? 0;
  // passivas: acompanham o nível, como as do jogador
  const passive = (key: 'attackSpeed' | 'crit' | 'maxHp' | 'damageTaken' | 'manaRegen') => {
    let v = 0;
    for (const s of SKILLS[classId] ?? [])
      if (s.type === 'passive' && level >= s.unlock && s.passive?.[key])
        v += s.passive[key]! * skillScale(Math.min(SKILL_MAX_LEVEL, level - s.unlock + 1));
    return v;
  };
  d.critChance = Math.min(CRIT_TOTAL_MAX, d.critChance + passive('crit'));
  d.maxHp = Math.round(d.maxHp * (1 + passive('maxHp')));
  const elemAtk = { ...emptyElements(), ...c.elementAttack };
  for (const el of Object.keys(elemAtk) as (keyof typeof elemAtk)[]) elemAtk[el] += g[`elem_${el}`] ?? 0;
  const e: Entity = {
    id: nextBotId++,
    kind: 'bot',
    name: c.name,
    level,
    x: 0,
    y: 0,
    hp: d.maxHp,
    mana: d.maxMana,
    dead: false,
    attrs,
    derived: d,
    elemAtk,
    elemRes: emptyElements(),
    damageType: c.damageType,
    element: c.element,
    attackRange: c.attackRange,
    attackWhileMoving: !!c.attackWhileMoving,
    attackInterval: c.attackInterval / (1 + passive('attackSpeed')),
    attackCd: 0,
    moveSpeed: c.moveSpeed,
    path: [],
    repathCd: 0,
    monsterId: '',
    home: { x: 0, y: 0 },
    ai: 'idle',
    aiTimer: 0,
    respawnAt: 0,
    buffs: [],
    group: 0,
    summoned: false,
    spawnKey: '',
    npcId: '',
    wander: 0,
  };
  return {
    e,
    classId,
    team,
    slot,
    gear,
    skillLevel: botSkillLevel(level),
    cds: {},
    gcd: 0,
    potions: { ...BOT_POTION_COUNT },
    potionCd: 0,
    hot: { hp: 0, mp: 0, left: 0, leftMp: 0 },
    lifeSteal: c.lifeSteal ?? 0,
    damageTaken: passive('damageTaken'),
  };
}

/** Skills ativas que o bot já tem (pelo nível). */
export const botActives = (b: Bot): SkillDef[] =>
  (SKILLS[b.classId] ?? []).filter((s) => s.type === 'active' && b.e.level >= s.unlock);

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const reach = (b: Bot, s: SkillDef) =>
  s.range === 'melee' || s.range === undefined ? b.e.attackRange : (s.range as number);

/** O que a IA enxerga a cada quadro. */
export interface BotView {
  /** líder a seguir (jogador); null na arena */
  leader: Entity | null;
  /** alvo atual do líder (o bot ajuda nele) */
  leaderTargetId: number | null;
  enemies: Entity[];
  /** aliados vivos (inclui o líder), para saber quem está apanhando */
  allies: Entity[];
}

/** Escolhe o alvo: o do líder; senão o inimigo que está perto de um aliado; senão o mais próximo ao alcance. */
export function botTarget(b: Bot, v: BotView): Entity | null {
  const alive = v.enemies.filter((m) => !m.dead);
  if (!alive.length) return null;
  if (v.leaderTargetId != null) {
    const t = alive.find((m) => m.id === v.leaderTargetId);
    if (t) return t;
  }
  if (!v.leader) return alive.reduce((a, m) => (dist(b.e, m) < dist(b.e, a) ? m : a));
  let best: Entity | null = null,
    bd = Infinity;
  for (const m of alive) {
    const d = Math.min(dist(b.e, m), ...v.allies.map((a) => dist(a, m) + 2));
    if (d < bd) [best, bd] = [m, d];
  }
  return bd <= BOT_AGGRO ? best : null;
}

/** A IA: uma ação por chamada. Não muda nada; quem executa é o World ou simulateFight. */
export function botThink(b: Bot, v: BotView): BotAction {
  const e = b.e;
  if (e.dead || e.buffs.some((x) => x.kind === 'stun')) return { kind: 'none' };
  const actives = botActives(b),
    cheapest = Math.min(...actives.map((s) => s.mana ?? 0), Infinity);
  // 1) poções (só as pequenas; uma por vez, sem empilhar cura em andamento)
  if (b.potionCd <= 0) {
    if (e.hp < e.derived.maxHp * BOT_HP_POTION_AT && b.potions.hp > 0 && b.hot.left <= 0)
      return { kind: 'potion', potion: 'hp' };
    if (e.mana < cheapest && e.mana < e.derived.maxMana * BOT_MP_POTION_AT && b.potions.mp > 0 && b.hot.leftMp <= 0)
      return { kind: 'potion', potion: 'mp' };
  }
  // 2) longe demais do líder: volta (larga a luta)
  if (v.leader && dist(e, v.leader) > BOT_LEASH) return followLeader(b, v.leader);
  const t = botTarget(b, v);
  if (!t) return v.leader ? followLeader(b, v.leader) : { kind: 'none' };
  const dt = dist(e, t);
  // 3) skills: escudo quando apanha, área com 2+ inimigos, senão a mais forte pronta ao alcance
  if (b.gcd <= 0) {
    const ready = actives.filter((s) => (b.cds[s.id] ?? 0) <= 0 && e.mana >= (s.mana ?? 0));
    const shield = ready.find((s) => s.shield);
    if (shield && e.hp < e.derived.maxHp * 0.7 && !e.buffs.some((x) => x.kind === 'shield'))
      return { kind: 'skill', skillId: shield.id, targetId: null };
    const heal = ready.find((s) => s.heal);
    if (heal && e.hp < e.derived.maxHp * 0.5 && !e.buffs.some((x) => x.kind === 'regen'))
      return { kind: 'skill', skillId: heal.id, targetId: null };
    const near = (r: number, c: { x: number; y: number }) => v.enemies.filter((m) => !m.dead && dist(m, c) <= r).length;
    let bestS: SkillDef | null = null,
      bestV = 0;
    for (const s of ready) {
      if (s.shield || s.heal || (!s.hits && !s.poison)) continue;
      const power = (s.hits ?? []).reduce((a, h) => a + h, 0) + (s.poison?.percent ?? 0);
      let val = 0;
      if (s.area === 'self') {
        const n = near(s.radius ?? 2.5, e);
        val = n >= 2 ? power * n : n === 1 ? power * 0.8 : 0;
      } else if (dt <= reach(b, s) || (s.dash && dt <= reach(b, s))) {
        val = power * (s.area === 'target' ? Math.max(1, near(s.radius ?? 2.5, t)) : 1);
        if (s.poison && t.buffs.some((x) => x.kind === 'poison')) val *= 0.5;
        if (s.debuff && t.buffs.some((x) => x.kind === s.debuff!.kind)) val *= 0.7;
      }
      if (val > bestV) [bestS, bestV] = [s, val];
    }
    if (bestS) return { kind: 'skill', skillId: bestS.id, targetId: bestS.target === 'target' ? t.id : null };
  }
  // 4) golpe normal ao alcance; senão chega perto (à distância fica a ~80% do alcance)
  if (dt <= e.attackRange) return e.attackCd <= 0 ? { kind: 'attack', targetId: t.id } : { kind: 'none' };
  const want = Math.max(0.8, e.attackRange * 0.8),
    k = (dt - want) / dt;
  return { kind: 'move', x: e.x + (t.x - e.x) * k, y: e.y + (t.y - e.y) * k };
}

function followLeader(b: Bot, l: Entity): BotAction {
  const ang = (b.slot * 2 * Math.PI) / 3 + Math.PI / 2,
    p = { x: l.x + Math.cos(ang) * 1.5, y: l.y + Math.sin(ang) * 1.5 };
  return dist(b.e, l) > BOT_FOLLOW || dist(b.e, p) > 1.5 ? { kind: 'move', x: p.x, y: p.y } : { kind: 'none' };
}

/** Passa o tempo do bot: recargas, poções (cura ao longo do tempo), efeitos. */
export function tickBot(b: Bot, dt: number) {
  const e = b.e;
  b.gcd = Math.max(0, b.gcd - dt);
  b.potionCd = Math.max(0, b.potionCd - dt);
  e.attackCd = Math.max(0, e.attackCd - dt);
  for (const id of Object.keys(b.cds)) b.cds[id] = Math.max(0, b.cds[id] - dt);
  if (e.dead) return;
  if (b.hot.left > 0) {
    const s = Math.min(dt, b.hot.left);
    e.hp = Math.min(e.derived.maxHp, e.hp + b.hot.hp * s);
    b.hot.left -= s;
  }
  if (b.hot.leftMp > 0) {
    const s = Math.min(dt, b.hot.leftMp);
    e.mana = Math.min(e.derived.maxMana, e.mana + b.hot.mp * s);
    b.hot.leftMp -= s;
  }
}

/** Bebe uma poção pequena (gasta do estoque do bot). */
export function botDrink(b: Bot, kind: 'hp' | 'mp'): boolean {
  if (b.potionCd > 0 || b.potions[kind] <= 0) return false;
  const p = POTIONS[BOT_POTIONS[kind]];
  b.potions[kind]--;
  b.potionCd = p.cooldown;
  const max = kind === 'hp' ? b.e.derived.maxHp : b.e.derived.maxMana;
  if (kind === 'hp') [b.hot.hp, b.hot.left] = [(max * p.percent) / p.duration, p.duration];
  else [b.hot.mp, b.hot.leftMp] = [(max * p.percent) / p.duration, p.duration];
  return true;
}

// ---------------------------------------------------------------- simulação headless
export interface SimUnit {
  e: Entity;
  bot?: Bot;
  team: BotTeam;
  /** monstro: id de quem ele está atacando */
  aggro?: number;
}
export interface SimStats {
  seconds: number;
  winner: BotTeam | null;
  skillsUsed: Record<string, number>;
  potions: number;
  attacks: number;
  deaths: Record<number, boolean>;
  damage: Record<number, number>;
}

const asCombatant = (e: Entity): Combatant => e;

/** Aplica o golpe de `a` em `t` com multiplicador; devolve o dano. */
function strike(a: SimUnit, t: SimUnit, mul: number, rng: Rng, st: SimStats): number {
  const r = rollAttack(asCombatant(a.e), asCombatant(t.e), rng);
  if (!r.hit) return 0;
  let dmg = r.amount * mul;
  const red = t.e.buffs.find((x) => x.kind === 'defReduction');
  if (red) dmg *= 1 + red.value * 0.5;
  if (t.bot) dmg *= 1 - t.bot.damageTaken;
  const sh = t.e.buffs.find((x) => x.kind === 'shield');
  if (sh) {
    const ab = Math.min(sh.value, dmg);
    sh.value -= ab;
    dmg -= ab;
    if (sh.value <= 0) sh.remaining = 0;
  }
  dmg = Math.round(dmg);
  t.e.hp -= dmg;
  st.damage[a.e.id] = (st.damage[a.e.id] ?? 0) + dmg;
  if (a.bot?.lifeSteal) a.e.hp = Math.min(a.e.derived.maxHp, a.e.hp + dmg * a.bot.lifeSteal);
  if (t.team === 'enemy' && !t.bot) t.aggro ??= a.e.id;
  if (t.e.hp <= 0) {
    t.e.hp = 0;
    t.e.dead = true;
    st.deaths[t.e.id] = true;
  }
  return dmg;
}

function addBuff(e: Entity, kind: Entity['buffs'][number]['kind'], value: number, duration: number) {
  e.buffs = e.buffs.filter((x) => x.kind !== kind);
  e.buffs.push({ id: kind, kind, value, remaining: duration, duration, tick: 1 });
}

/** Executa a skill do bot na simulação (efeitos simplificados, fiéis aos números do skills.json). */
function castSim(u: SimUnit, s: SkillDef, targetId: number | null, all: SimUnit[], rng: Rng, st: SimStats) {
  const b = u.bot!,
    e = u.e,
    scale = skillScale(b.skillLevel);
  e.mana -= s.mana ?? 0;
  b.cds[s.id] = s.cooldown ?? 0;
  b.gcd = GLOBAL_COOLDOWN;
  st.skillsUsed[s.id] = (st.skillsUsed[s.id] ?? 0) + 1;
  if (s.shield) addBuff(e, 'shield', e.derived.maxHp * s.shield.percent * scale, s.shield.duration);
  if (s.heal) addBuff(e, 'regen', (e.derived.maxHp * s.heal.percent * scale) / s.heal.duration, s.heal.duration);
  if (!s.hits && !s.poison) return;
  const foes = all.filter((x) => x.team !== u.team && !x.e.dead);
  const t = foes.find((x) => x.e.id === targetId) ?? null;
  if (s.dash && t) {
    const d = dist(e, t.e),
      k = Math.max(0, (d - 1) / d);
    e.x += (t.e.x - e.x) * k;
    e.y += (t.e.y - e.y) * k;
  }
  const center = s.area === 'self' ? e : t?.e;
  const hitList = s.area && center ? foes.filter((x) => dist(x.e, center) <= (s.radius ?? 2.5)) : t ? [t] : [];
  for (const x of hitList) {
    let total = 0;
    for (const h of s.hits ?? []) total += strike(u, x, h * scale, rng, st);
    if (x.e.dead) continue;
    if (!s.hits) total = expectedDamage(e, x.e) * scale; // só veneno: base no golpe normal
    if (s.debuff) addBuff(x.e, s.debuff.kind, s.debuff.value, s.debuff.duration);
    if (s.stun) addBuff(x.e, 'stun', 0, s.stun);
    if (s.poison && total > 0)
      addBuff(x.e, 'poison', (total * s.poison.percent) / s.poison.duration, s.poison.duration);
  }
}

/** IA mínima de monstro para a simulação: ataca quem bateu nele primeiro (ou o mais próximo). */
function monsterAct(m: SimUnit, all: SimUnit[], rng: Rng, st: SimStats, dt: number) {
  const foes = all.filter((x) => x.team !== m.team && !x.e.dead);
  if (!foes.length) return;
  let t = foes.find((x) => x.e.id === m.aggro);
  if (!t) {
    t = foes.reduce((a, x) => (dist(m.e, x.e) < dist(m.e, a.e) ? x : a));
    m.aggro = t.e.id;
  }
  moveOrHit(m, t, all, rng, st, dt);
}

function moveOrHit(u: SimUnit, t: SimUnit, _all: SimUnit[], rng: Rng, st: SimStats, dt: number) {
  const d = dist(u.e, t.e);
  if (d <= u.e.attackRange) {
    if (u.e.attackCd <= 0) {
      strike(u, t, 1, rng, st);
      u.e.attackCd = u.e.attackInterval;
      st.attacks++;
    }
  } else stepTo(u.e, t.e.x, t.e.y, dt, u.e.attackRange * 0.8);
}

function stepTo(e: Entity, x: number, y: number, dt: number, stopAt = 0) {
  const slow = e.buffs.find((b) => b.kind === 'slow')?.value ?? 0,
    d = Math.hypot(x - e.x, y - e.y),
    go = Math.min(Math.max(0, d - stopAt), e.moveSpeed * (1 - slow) * dt);
  if (d > 1e-6) {
    e.x += ((x - e.x) / d) * go;
    e.y += ((y - e.y) / d) * go;
  }
}

function tickBuffs(u: SimUnit, dt: number, st: SimStats) {
  const e = u.e;
  for (const b of e.buffs) {
    b.remaining -= dt;
    if (b.kind === 'poison' && !e.dead) {
      b.tick = (b.tick ?? 1) - dt;
      if (b.tick <= 0) {
        b.tick += 1;
        e.hp -= b.value;
        if (e.hp <= 0) {
          e.hp = 0;
          e.dead = true;
          st.deaths[e.id] = true;
        }
      }
    }
    if (b.kind === 'regen' && !e.dead) e.hp = Math.min(e.derived.maxHp, e.hp + b.value * dt);
  }
  e.buffs = e.buffs.filter((b) => b.remaining > 0);
}

/**
 * Luta headless entre dois lados até um ser eliminado (ou acabar o tempo). Aliados usam o primeiro bot/`leader`
 * como líder. Regeneração de mana: 1%/s da máxima (aproximação do jogo fora da cidade).
 */
export function simulateFight(
  units: SimUnit[],
  rng: Rng,
  opts: { maxSeconds?: number; leaderId?: number; dt?: number } = {},
): SimStats {
  const dt = opts.dt ?? 0.1,
    maxS = opts.maxSeconds ?? 300,
    st: SimStats = { seconds: 0, winner: null, skillsUsed: {}, potions: 0, attacks: 0, deaths: {}, damage: {} };
  for (; st.seconds < maxS; st.seconds += dt) {
    for (const u of units) {
      tickBuffs(u, dt, st);
      if (u.bot) tickBot(u.bot, dt);
      else u.e.attackCd = Math.max(0, u.e.attackCd - dt);
      if (!u.e.dead) u.e.mana = Math.min(u.e.derived.maxMana, u.e.mana + u.e.derived.maxMana * 0.01 * dt);
    }
    for (const u of units) {
      if (u.e.dead || u.e.buffs.some((b) => b.kind === 'stun')) continue;
      if (!u.bot) {
        monsterAct(u, units, rng, st, dt);
        continue;
      }
      const leader = units.find((x) => x.e.id === opts.leaderId && x.team === u.team && !x.e.dead)?.e ?? null;
      const view: BotView = {
        leader: leader && leader !== u.e ? leader : null,
        leaderTargetId: null,
        enemies: units.filter((x) => x.team !== u.team).map((x) => x.e),
        allies: units.filter((x) => x.team === u.team && !x.e.dead).map((x) => x.e),
      };
      const a = botThink(u.bot, view);
      if (a.kind === 'potion') st.potions += botDrink(u.bot, a.potion) ? 1 : 0;
      else if (a.kind === 'move') stepTo(u.e, a.x, a.y, dt);
      else if (a.kind === 'attack') {
        const t = units.find((x) => x.e.id === a.targetId);
        if (t) moveOrHit(u, t, units, rng, st, dt);
      } else if (a.kind === 'skill') {
        const s = botActives(u.bot).find((x) => x.id === a.skillId);
        if (s) castSim(u, s, a.targetId, units, rng, st);
      }
    }
    const alive = (tm: BotTeam) => units.some((u) => u.team === tm && !u.e.dead);
    if (!alive('ally') || !alive('enemy')) {
      st.winner = alive('ally') ? 'ally' : alive('enemy') ? 'enemy' : null;
      break;
    }
  }
  return st;
}
