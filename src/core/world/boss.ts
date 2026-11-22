// Chefes: golpes marcados no chão (círculo e linha), invocação, fúria e arena.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { MONSTERS, type MonsterDef } from '../data';
import { bal } from '../balance';
import { isWalkable } from '../pathfinding';
import { type Entity, type Point, type Telegraph } from '../types';
import type { World } from '../world';
import { dist } from './geometry';
import { trialSummonLevel } from '../trial';

// ---------- chefe ----------
export function tickBossExtras(w: World, m: Entity, def: MonsterDef, dt: number) {
  const b = def.boss!,
    p = w.player;
  if (m.ai === 'chase') {
    m.aiTimer -= dt;
    if (m.aiTimer <= 0 && !p.dead) {
      const phase2 = m.hp <= m.derived.maxHp * phase2Pct(def);
      m.aiTimer = phase2 ? b.aoe.intervalPhase2 : b.aoe.interval;
      m.strikes = (m.strikes ?? 0) + 1;
      if (b.line && m.strikes % 2 === 0) lineStrike(w, m, b.line);
      else {
        const t: Telegraph = {
          id: w.nextTelegraph++,
          x: p.x,
          y: p.y,
          radius: b.aoe.radius,
          delay: b.aoe.delay,
          remaining: b.aoe.delay,
          ownerId: m.id,
          mult: b.aoe.mult,
        };
        w.telegraphs.push(t);
        w.emit({ type: 'telegraph', id: t.id, x: t.x, y: t.y, radius: t.radius, delay: t.delay });
      }
    }
    if (b.summon && !w.bossSummoned && m.hp <= m.derived.maxHp * b.summon.atHpPct) summonAdds(w, m, b.summon);
    if (b.enrage && !m.enraged && m.hp <= m.derived.maxHp * b.enrage.atHpPct) enrage(w, m, def);
  }
}

/** Vida (fração) em que o chefe passa para a fase 2 (golpes mais frequentes): a da invocação, da fúria ou do leque. */
export const phase2Pct = (def: MonsterDef) =>
  def.boss?.summon?.atHpPct ?? def.boss?.enrage?.atHpPct ?? def.boss?.line?.fanAtHpPct ?? 0.5;

type LineDef = NonNullable<NonNullable<MonsterDef['boss']>['line']>;

/** Golpe em linha: do chefe na direção do jogador; com pouca vida, leque de várias linhas. Desvia-se para o lado. */
export function lineStrike(w: World, m: Entity, l: LineDef) {
  const p = w.player,
    base = Math.atan2(p.y - m.y, p.x - m.x) || 0,
    n = m.hp <= m.derived.maxHp * l.fanAtHpPct ? l.fanCount : 1;
  for (let i = 0; i < n; i++) {
    const t: Telegraph = {
      id: w.nextTelegraph++,
      x: m.x,
      y: m.y,
      radius: l.width / 2,
      delay: l.delay,
      remaining: l.delay,
      ownerId: m.id,
      mult: l.mult,
      shape: 'line',
      angle: base + (i - (n - 1) / 2) * l.fanSpread,
      length: l.length,
    };
    w.telegraphs.push(t);
    w.emit({ type: 'telegraph', id: t.id, x: t.x, y: t.y, radius: t.radius, delay: t.delay, shape: 'line' });
  }
}

/** O ponto está dentro da área marcada (margin: folga em tiles, para quem desvia com antecedência)? */
export function inTelegraph(t: Telegraph, q: Point, margin = 0): boolean {
  if (t.shape !== 'line') return dist(q, t) <= t.radius + margin;
  const a = t.angle ?? 0,
    dx = q.x - t.x,
    dy = q.y - t.y,
    along = dx * Math.cos(a) + dy * Math.sin(a),
    across = -dx * Math.sin(a) + dy * Math.cos(a);
  return along >= -margin && along <= (t.length ?? 0) + margin && Math.abs(across) <= t.radius + margin;
}

/** Centro da área marcada (para mostrar o texto do impacto): o meio da linha ou o centro do círculo. */
export function telegraphCenter(t: Telegraph): Point {
  if (t.shape !== 'line') return { x: t.x, y: t.y };
  const a = t.angle ?? 0,
    h = (t.length ?? 0) / 2;
  return { x: t.x + Math.cos(a) * h, y: t.y + Math.sin(a) * h };
}

/** Lugar andável mais perto de `from` fora de todas as áreas marcadas (desvio do Auto e da simulação). */
export function safeSpot(w: World, from: Point, margin = 0.4): Point | null {
  for (const r of [1, 1.6, 2.3, 3.1, 4])
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2,
        q = { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r };
      if (isWalkable(w.map, q.x, q.y) && !w.telegraphs.some((t) => inTelegraph(t, q, margin))) return q;
    }
  return null;
}

/** Fúria: golpes mais rápidos e mais fortes e passo mais rápido até a luta resetar (resetBoss). */
export function enrage(w: World, m: Entity, def: MonsterDef) {
  const e = def.boss!.enrage!;
  m.enraged = true;
  m.attackInterval = def.attackInterval * e.attackIntervalMul;
  m.moveSpeed = def.moveSpeed * e.moveSpeedMul;
  m.derived.physAtk *= e.damageMul;
  m.derived.spiritAtk *= e.damageMul;
  w.emit({ type: 'bossEnrage', id: m.id, name: m.name });
}

// Golpe em área de monstro comum (Yeti, marco 9): com o jogador perto, marca um círculo em volta de si e bate
// depois do aviso. O ataque normal continua. O círculo some se o monstro morrer antes (tickTelegraphs).
export function tickSlam(w: World, m: Entity, def: MonsterDef, dt: number) {
  const s = def.slam!,
    p = w.player;
  if (m.ai !== 'chase' || p.dead) return; // o tempo do primeiro golpe é marcado ao entrar em combate (World.aggro)
  m.aiTimer -= dt;
  if (m.aiTimer > 0 || dist(m, p) > s.radius + 0.5) return;
  if (w.telegraphs.some((t) => t.ownerId === m.id)) return;
  m.aiTimer = s.interval;
  const t: Telegraph = {
    id: w.nextTelegraph++,
    x: m.x,
    y: m.y,
    radius: s.radius,
    delay: s.delay,
    remaining: s.delay,
    ownerId: m.id,
    mult: s.mult,
  };
  w.telegraphs.push(t);
  w.emit({ type: 'telegraph', id: t.id, x: t.x, y: t.y, radius: t.radius, delay: t.delay });
}

export function summonAdds(w: World, boss: Entity, sm: { monsterId: string; count: number; level: number }) {
  w.bossSummoned = true;
  const sdef = MONSTERS[sm.monsterId],
    ids: number[] = [];
  for (let i = 0; i < sm.count; i++) {
    const a = (i / sm.count) * Math.PI * 2 + 0.7;
    let pos: Point = { x: boss.x + Math.cos(a) * 2.2, y: boss.y + Math.sin(a) * 2.2 };
    if (!isWalkable(w.map, pos.x, pos.y)) pos = { x: boss.x, y: boss.y };
    const e = w.makeMonster(sdef, pos);
    w.applyMonsterLevel(e, sdef, boss.trial ? trialSummonLevel(boss.level) : sm.level); // Trial: 3 níveis abaixo do chefe
    e.home = { ...boss.home };
    e.summoned = true;
    e.ai = 'chase';
    e.respawnAt = Infinity;
    w.monsters.push(e);
    ids.push(e.id);
  }
  w.emit({ type: 'bossSummon', ids, name: boss.name });
}

export function resetBoss(w: World, m: Entity) {
  w.bossSummoned = false;
  m.strikes = 0;
  if (m.enraged) {
    const def = MONSTERS[m.monsterId],
      hp = m.hp;
    m.enraged = false;
    m.attackInterval = def.attackInterval;
    m.moveSpeed = def.moveSpeed;
    w.applyMonsterLevel(m, def, m.level); // refaz ataque/defesa sem o bônus da fúria
    m.hp = hp;
  }
  w.telegraphs = w.telegraphs.filter((t) => t.ownerId !== m.id);
  w.monsters = w.monsters.filter((x) => !x.summoned);
  m.aiTimer = 0;
}

export function tickTelegraphs(w: World, dt: number) {
  if (!w.telegraphs.length) return;
  const p = w.player;
  for (const t of [...w.telegraphs]) {
    t.remaining -= dt;
    if (t.remaining > 0) continue;
    w.telegraphs = w.telegraphs.filter((x) => x !== t);
    const owner = w.monsters.find((e) => e.id === t.ownerId);
    const hit = !!owner && !owner.dead && !p.dead && inTelegraph(t, p),
      c = telegraphCenter(t);
    w.emit({ type: 'telegraphResolved', id: t.id, x: c.x, y: c.y, radius: t.radius, hit });
    if (hit && owner) directDamage(w, owner, p, t.mult);
  }
}

/** Dano extra dos chefes em % da vida máxima de quem leva o golpe (não é reduzido pela defesa; a parte normal do golpe
 *  continua reduzida pela defesa física/espiritual). Faz o chefe assustar mesmo com equipamento forte.
 *  - basic: golpe normal de um chefe que bate a cada refInterval s (quem bate mais devagar tira mais por golpe)
 *  - telegraph: golpe marcado no chão (círculo/linha), por 1× de mult (um círculo de 2× tira o dobro) */
export const BOSS_PCT_HP = { basic: 0.04, refInterval: 2.4, telegraph: 0.09, fromLevel: 10, fullLevel: 30 };

/** Quanto da % vale para um chefe deste nível: 0 até fromLevel, sobe em linha até 1 no fullLevel (chefes iniciais
 *  não mudam; os de fim de jogo e o Trial levam tudo). */
export const bossPctScale = (level: number) =>
  Math.max(0, Math.min(1, (level - BOSS_PCT_HP.fromLevel) / (BOSS_PCT_HP.fullLevel - BOSS_PCT_HP.fromLevel)));

/** Parte em % da vida do golpe normal de um chefe (0 para monstro comum ou alvo que não é o jogador). */
export function bossBasicPctDamage(a: Entity, t: Entity): number {
  if (a.kind !== 'monster' || t.kind !== 'player' || !MONSTERS[a.monsterId]?.boss) return 0;
  const def = MONSTERS[a.monsterId]!;
  return t.derived.maxHp * BOSS_PCT_HP.basic * (def.attackInterval / BOSS_PCT_HP.refInterval) * bossPctScale(a.level);
}

// dano que não erra (golpes marcados no chão): ataque do dono × mult, reduzido pela defesa; chefe soma % da vida
export function directDamage(w: World, a: Entity, t: Entity, mult: number) {
  const physical = a.damageType === 'physical';
  const atk = physical ? a.derived.physAtk : a.derived.spiritAtk,
    df = physical ? t.derived.physDef : t.derived.spiritDef;
  const pct =
    t.kind === 'player' && MONSTERS[a.monsterId]?.boss
      ? t.derived.maxHp * BOSS_PCT_HP.telegraph * mult * bossPctScale(a.level)
      : 0;
  const amount = Math.max(
    1,
    Math.round(
      (atk * mult * (1 - df / (df + 100)) + pct) * bal('dano.monstros', a.monsterId) * (1 - w.damageTakenRed()),
    ),
  );
  const dealt = w.absorb(t, amount);
  t.hp -= dealt;
  if (dealt > 0)
    w.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: false });
  w.lastDamaged = w.time;
  if (dealt > 0) w.wearGear(); // golpe todo absorvido pelo escudo não desgasta
  if (t.hp <= 0) w.killPlayer();
}

// chefe engajado (para a barra grande no topo)
export function engagedBoss(w: World): Entity | null {
  return (
    w.monsters.find((m) => !m.dead && !!MONSTERS[m.monsterId]?.boss && (m.ai === 'chase' || m.hp < m.derived.maxHp)) ??
    null
  );
}
