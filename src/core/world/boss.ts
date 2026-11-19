// Chefe (General de Terracota): golpes marcados no chão, invocação e arena.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { MONSTERS, type MonsterDef } from '../data';
import { bal } from '../balance';
import { isWalkable } from '../pathfinding';
import { type Entity, type Point, type Telegraph } from '../types';
import type { World } from '../world';
import { dist } from './geometry';

// ---------- chefe ----------
export function tickBossExtras(w: World, m: Entity, def: MonsterDef, dt: number) {
  const b = def.boss!,
    p = w.player;
  if (m.ai === 'chase') {
    m.aiTimer -= dt;
    if (m.aiTimer <= 0 && !p.dead) {
      m.aiTimer = m.hp <= m.derived.maxHp * b.summon.atHpPct ? b.aoe.intervalPhase2 : b.aoe.interval;
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
    if (!w.bossSummoned && m.hp <= m.derived.maxHp * b.summon.atHpPct) summonAdds(w, m, b.summon);
  }
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
    w.applyMonsterLevel(e, sdef, sm.level);
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
    const hit = !!owner && !owner.dead && !p.dead && dist(p, t) <= t.radius;
    w.emit({ type: 'telegraphResolved', id: t.id, x: t.x, y: t.y, radius: t.radius, hit });
    if (hit && owner) directDamage(w, owner, p, t.mult);
  }
}

// dano que não erra (golpes marcados no chão): ataque do dono × mult, reduzido pela defesa
export function directDamage(w: World, a: Entity, t: Entity, mult: number) {
  const physical = a.damageType === 'physical';
  const atk = physical ? a.derived.physAtk : a.derived.spiritAtk,
    df = physical ? t.derived.physDef : t.derived.spiritDef;
  const amount = Math.max(1, Math.round(atk * mult * bal('dano.monstros', a.monsterId) * (1 - df / (df + 100))));
  const dealt = w.absorb(t, amount);
  t.hp -= dealt;
  if (dealt > 0)
    w.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: false });
  w.lastDamaged = w.time;
  w.wearGear();
  if (t.hp <= 0) w.killPlayer();
}

// chefe engajado (para a barra grande no topo)
export function engagedBoss(w: World): Entity | null {
  return (
    w.monsters.find((m) => !m.dead && !!MONSTERS[m.monsterId]?.boss && (m.ai === 'chase' || m.hp < m.derived.maxHp)) ??
    null
  );
}
