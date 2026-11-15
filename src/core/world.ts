import { CLASSES, MONSTERS, PROGRESSION, type MonsterDef } from './data';
import { distributeByRatio } from './distribute';
import { rollAttack } from './combat';
import { screenToTile } from './iso';
import type { GameMap } from './map';
import { findPath, isWalkable } from './pathfinding';
import { Rng } from './rng';
import { computeDerived, emptyElements } from './stats';
import { ATTR_KEYS, type AttrKey, type Attributes, type Entity, type GameEvent, type Point, type SaveData } from './types';

export const STEP = 1 / 60;
const TARGET_RANGE = 14;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const TOWN_MAPS = new Set(['cidade']);
const TOWN_REGEN = 0.03; // 3% por segundo

export class World {
  mapId = 'cidade';
  map: GameMap;
  player!: Entity;
  classId: string;
  xp = 0;
  freePoints = 0;
  ratioCursor = 0;
  seenTips: string[] = [];
  tipsEnabled = true;
  monsters: Entity[] = [];
  npcs: Entity[] = [];
  events: GameEvent[] = [];
  time = 0;
  targetId: number | null = null;
  autoAttack = false;
  private chasing = false;
  private moveInput: Point = { x: 0, y: 0 };
  private respawnTimer = 0;
  private portalCd = 0;
  private lastDamaged = -99;
  private acc = 0;
  private nextId = 2;
  private rng = new Rng((Date.now() & 0xffffffff) >>> 0);

  private constructor(private maps: Record<string, GameMap>, name: string, classId: string, level: number, attrs: Attributes) {
    this.classId = classId;
    this.map = maps[this.mapId];
    this.player = this.makePlayer(name, classId, level, attrs);
  }

  static create(maps: Record<string, GameMap>, name: string, classId: string): World {
    const w = new World(maps, name, classId, 1, { ...CLASSES[classId].baseAttributes });
    w.changeMap('cidade');
    return w;
  }

  static fromSave(maps: Record<string, GameMap>, s: SaveData): World {
    const w = new World(maps, s.name, s.classId, s.level, { ...s.attributes });
    w.xp = s.xp; w.freePoints = s.freePoints;
    w.ratioCursor = s.ratioCursor ?? 0; w.seenTips = [...(s.seenTips ?? [])]; w.tipsEnabled = s.tipsEnabled ?? true;
    w.changeMap(maps[s.mapId] ? s.mapId : 'cidade');
    return w;
  }

  serialize(): SaveData {
    return {
      version: 1, name: this.player.name, classId: this.classId, level: this.player.level, xp: this.xp,
      freePoints: this.freePoints, attributes: { ...this.player.attrs }, mapId: this.mapId, lastSeen: Date.now(),
      ratioCursor: this.ratioCursor, seenTips: [...this.seenTips], tipsEnabled: this.tipsEnabled,
    };
  }

  // ---------- comandos ----------
  moveTo(x: number, y: number) {
    if (this.player.dead) return;
    if (!this.player.attackWhileMoving) this.autoAttack = false;
    this.chasing = false;
    this.moveInput = { x: 0, y: 0 };
    this.player.path = findPath(this.map, this.player, { x, y });
  }

  // vetor em espaço de tela (joystick); convertido para tiles
  setMoveInput(sx: number, sy: number) {
    const t = screenToTile(sx, sy), l = Math.hypot(t.x, t.y);
    this.moveInput = l < 0.001 ? { x: 0, y: 0 } : { x: t.x / l, y: t.y / l };
  }

  setTarget(id: number | null) {
    if (id === null) { this.targetId = null; this.autoAttack = false; return; }
    const m = this.monsters.find((e) => e.id === id);
    if (!m || m.dead) return;
    this.targetId = id; this.autoAttack = true;
  }

  getTarget(): Entity | null {
    const t = this.monsters.find((m) => m.id === this.targetId);
    return t && !t.dead ? t : null;
  }

  private nearbyMonsters(): Entity[] {
    return this.monsters.filter((m) => !m.dead && dist(m, this.player) <= TARGET_RANGE).sort((a, b) => dist(a, this.player) - dist(b, this.player));
  }

  cycleTarget() {
    const c = this.nearbyMonsters();
    if (!c.length) return;
    const i = c.findIndex((m) => m.id === this.targetId);
    this.setTarget(c[(i + 1) % c.length].id);
  }

  attackNearest() {
    if (this.getTarget()) { this.autoAttack = true; return; }
    const c = this.nearbyMonsters();
    if (c.length) this.setTarget(c[0].id);
  }

  spendPoint(k: AttrKey) {
    if (this.freePoints <= 0) return;
    this.freePoints--; this.player.attrs[k]++;
    this.recalc(this.player, true);
  }

  distributeRecommended() {
    if (this.freePoints <= 0) return;
    const r = distributeByRatio(this.freePoints, CLASSES[this.classId].recommendedRatio ?? {}, this.ratioCursor);
    if (!r.spent) return;
    for (const k of ATTR_KEYS) this.player.attrs[k] += r.added[k];
    this.freePoints -= r.spent; this.ratioCursor = r.cursor;
    this.recalc(this.player, true);
  }

  xpToNext(): number | null {
    const p = this.player;
    return p.level >= PROGRESSION.levelCap ? null : PROGRESSION.xpToNext[p.level - 1];
  }

  // TODO: perda de durabilidade dos itens ao morrer.
  onPlayerDeath(): void {}

  // ---------- simulação ----------
  advance(dt: number) {
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= STEP) { this.tick(STEP); this.acc -= STEP; }
  }

  tick(dt: number) {
    this.time += dt;
    this.portalCd = Math.max(0, this.portalCd - dt);
    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    } else {
      this.tickPlayer(dt);
      this.checkPortals();
    }
    for (const m of this.monsters) this.tickMonster(m, dt);
  }

  private tickPlayer(dt: number) {
    const p = this.player, d = p.derived;
    p.attackCd = Math.max(0, p.attackCd - dt);
    // HP e mana só regeneram na cidade
    if (TOWN_MAPS.has(this.mapId) && this.time - this.lastDamaged > 5) {
      p.hp = Math.min(d.maxHp, p.hp + d.maxHp * TOWN_REGEN * dt);
      p.mana = Math.min(d.maxMana, p.mana + d.maxMana * TOWN_REGEN * dt);
    }
    const t = this.getTarget();
    if (this.targetId !== null && !t) { this.targetId = null; this.autoAttack = false; }
    const mi = this.moveInput;
    if (mi.x || mi.y) {
      p.path = [];
      this.step(p, mi.x, mi.y, p.moveSpeed * dt);
      if (p.attackWhileMoving && this.autoAttack && t) this.attackIfInRange(p, t);
      else this.autoAttack = false;
      return;
    }
    // ranged: andando por clique, continua atacando o alvo se estiver no alcance
    if (p.attackWhileMoving && this.autoAttack && t && p.path.length && !this.chasing) {
      this.attackIfInRange(p, t);
      this.followPath(p, dt, 1);
      return;
    }
    this.chasing = false;
    if (this.autoAttack && t) {
      if (dist(p, t) <= p.attackRange) {
        p.path = [];
        if (p.attackCd <= 0) { p.attackCd = p.attackInterval; this.attack(p, t); }
        return;
      }
      p.repathCd -= dt;
      if (p.repathCd <= 0 || !p.path.length) { p.repathCd = 0.3; p.path = findPath(this.map, p, t); }
      this.chasing = true;
    }
    this.followPath(p, dt, 1);
  }

  private attackIfInRange(p: Entity, t: Entity) {
    if (p.attackCd <= 0 && dist(p, t) <= p.attackRange) { p.attackCd = p.attackInterval; this.attack(p, t); }
  }

  private checkPortals() {
    if (this.portalCd > 0) return;
    const p = this.player;
    for (const o of this.map.objects) {
      if (o.type !== 'portal' || p.x < o.x || p.x >= o.x + o.w || p.y < o.y || p.y >= o.y + o.h) continue;
      this.changeMap(String(o.props.target), Number(o.props.targetX), Number(o.props.targetY));
      return;
    }
  }

  private tickMonster(m: Entity, dt: number) {
    const def = MONSTERS[m.monsterId], p = this.player;
    if (m.dead) { if (this.time >= m.respawnAt) this.respawn(m, def); return; }
    m.attackCd = Math.max(0, m.attackCd - dt);
    const pd = p.dead ? Infinity : dist(m, p);
    if (m.ai === 'idle') {
      if (pd < def.aggroRange) { this.aggro(m); return; }
      m.aiTimer -= dt;
      if (m.aiTimer <= 0) {
        const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(1, 3.5);
        const w = { x: m.home.x + Math.cos(a) * r, y: m.home.y + Math.sin(a) * r };
        if (isWalkable(this.map, w.x, w.y)) { m.path = [w]; m.ai = 'wander'; }
        else m.aiTimer = 1;
      }
    } else if (m.ai === 'wander') {
      if (pd < def.aggroRange) { this.aggro(m); return; }
      this.followPath(m, dt, 0.5);
      if (!m.path.length) { m.ai = 'idle'; m.aiTimer = this.rng.range(2, 5); }
    } else if (m.ai === 'chase') {
      if (p.dead || dist(m, m.home) > def.leashRange) {
        m.ai = 'return'; m.path = findPath(this.map, m, m.home);
        return;
      }
      if (pd <= m.attackRange) {
        m.path = [];
        if (m.attackCd <= 0) { m.attackCd = m.attackInterval; this.attack(m, p); }
      } else {
        m.repathCd -= dt;
        if (m.repathCd <= 0 || !m.path.length) { m.repathCd = 0.4; m.path = findPath(this.map, m, p); }
        this.followPath(m, dt, 1);
      }
    } else {
      m.hp = Math.min(m.derived.maxHp, m.hp + m.derived.maxHp * 0.25 * dt);
      this.followPath(m, dt, 1.3);
      if (!m.path.length || dist(m, m.home) < 0.3) { m.path = []; m.ai = 'idle'; m.aiTimer = 1; m.hp = m.derived.maxHp; }
    }
  }

  private aggro(m: Entity) { m.ai = 'chase'; m.repathCd = 0; m.path = []; }

  private attack(a: Entity, t: Entity) {
    const r = rollAttack(a, t, this.rng);
    this.events.push({ type: 'attack', fromId: a.id, toId: t.id, ranged: a.attackRange > 3 });
    if (r.hit) {
      t.hp -= r.amount;
      this.events.push({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: r.amount, crit: r.crit });
    } else {
      this.events.push({ type: 'miss', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y });
    }
    if (t.kind === 'monster') {
      if (t.ai !== 'return') this.aggro(t);
      if (t.hp <= 0) this.killMonster(t);
    } else {
      this.lastDamaged = this.time;
      if (t.hp <= 0) this.killPlayer();
    }
  }

  private killMonster(m: Entity) {
    const def = MONSTERS[m.monsterId];
    m.dead = true; m.hp = 0; m.path = [];
    m.respawnAt = this.time + def.respawnSeconds;
    if (this.targetId === m.id) { this.targetId = null; this.autoAttack = false; }
    this.events.push({ type: 'death', id: m.id });
    this.events.push({ type: 'kill', monsterId: m.monsterId });
    this.gainXp(def.xpBase + def.xpPerLevel * (m.level - 1));
  }

  private killPlayer() {
    const p = this.player;
    p.dead = true; p.hp = 0; p.path = []; this.moveInput = { x: 0, y: 0 };
    this.targetId = null; this.autoAttack = false; this.respawnTimer = 3;
    this.events.push({ type: 'playerDeath' });
    this.onPlayerDeath();
  }

  private respawnPlayer() {
    const p = this.player;
    p.dead = false; p.hp = p.derived.maxHp; p.mana = p.derived.maxMana;
    this.changeMap('cidade');
  }

  private gainXp(n: number) {
    const p = this.player;
    if (p.level >= PROGRESSION.levelCap) return;
    this.xp += n;
    this.events.push({ type: 'xp', amount: n });
    for (let need = this.xpToNext(); need !== null && this.xp >= need; need = this.xpToNext()) {
      this.xp -= need; p.level++;
      const up = CLASSES[this.classId].levelUpAttributes;
      for (const k of ATTR_KEYS) p.attrs[k] += up[k];
      this.freePoints += PROGRESSION.freePointsPerLevel;
      this.recalc(p, false);
      p.hp = p.derived.maxHp; p.mana = p.derived.maxMana;
      this.events.push({ type: 'levelup', level: p.level });
    }
    if (p.level >= PROGRESSION.levelCap) this.xp = 0;
  }

  private recalc(e: Entity, keepGain: boolean) {
    const old = e.derived;
    e.derived = computeDerived(e.attrs);
    if (keepGain) {
      e.hp += Math.max(0, e.derived.maxHp - old.maxHp);
      e.mana += Math.max(0, e.derived.maxMana - old.maxMana);
    }
    e.hp = Math.min(e.hp, e.derived.maxHp); e.mana = Math.min(e.mana, e.derived.maxMana);
  }

  // ---------- mapa / entidades ----------
  changeMap(mapId: string, x?: number, y?: number) {
    this.mapId = mapId; this.map = this.maps[mapId];
    const sp = this.map.objects.find((o) => o.type === 'spawn');
    const p = this.player;
    p.x = x ?? sp?.x ?? 1.5; p.y = y ?? sp?.y ?? 1.5; p.path = [];
    this.moveInput = { x: 0, y: 0 };
    this.targetId = null; this.autoAttack = false; this.portalCd = 1;
    this.monsters = []; this.npcs = [];
    for (const o of this.map.objects) {
      if (o.type === 'monsterSpawn') {
        const def = MONSTERS[String(o.props.monster)];
        if (def) this.monsters.push(this.makeMonster(def, { x: o.x, y: o.y }));
      } else if (o.type === 'npc') {
        this.npcs.push({ ...this.blank('npc', o.name, 1), x: o.x, y: o.y });
      }
    }
    this.events.push({ type: 'mapChange', mapId });
  }

  private blank(kind: Entity['kind'], name: string, level: number): Entity {
    const attrs: Attributes = { strength: 1, intelligence: 1, stamina: 1, agility: 1, willpower: 1 };
    return {
      id: this.nextId++, kind, name, level, x: 0, y: 0, hp: 1, mana: 0, dead: false, attrs,
      derived: computeDerived(attrs), elemAtk: emptyElements(), elemRes: emptyElements(),
      damageType: 'physical', element: null, attackRange: 1, attackWhileMoving: false, attackInterval: 1, attackCd: 0, moveSpeed: 3,
      path: [], repathCd: 0, monsterId: '', home: { x: 0, y: 0 }, ai: 'idle', aiTimer: 0, respawnAt: 0,
    };
  }

  private makePlayer(name: string, classId: string, level: number, attrs: Attributes): Entity {
    const c = CLASSES[classId];
    const e = this.blank('player', name, level);
    e.id = 1; e.attrs = attrs; e.derived = computeDerived(attrs);
    e.elemAtk = { ...emptyElements(), ...c.elementAttack };
    e.damageType = c.damageType; e.element = c.element;
    e.attackRange = c.attackRange; e.attackWhileMoving = !!c.attackWhileMoving; e.attackInterval = c.attackInterval; e.moveSpeed = c.moveSpeed;
    e.hp = e.derived.maxHp; e.mana = e.derived.maxMana;
    return e;
  }

  private applyMonsterLevel(e: Entity, def: MonsterDef, level: number) {
    e.level = level;
    for (const k of ATTR_KEYS) e.attrs[k] = Math.round(def.baseAttributes[k] + def.perLevel[k] * (level - 1));
    e.derived = computeDerived(e.attrs);
    e.hp = e.derived.maxHp;
  }

  private makeMonster(def: MonsterDef, home: Point): Entity {
    const e = this.blank('monster', def.name, 1);
    e.monsterId = def.id; e.home = { ...home }; e.x = home.x; e.y = home.y;
    e.damageType = def.damageType; e.attackRange = def.attackRange; e.attackInterval = def.attackInterval; e.moveSpeed = def.moveSpeed;
    e.aiTimer = this.rng.range(0.5, 4);
    this.applyMonsterLevel(e, def, this.rng.int(def.minLevel, def.maxLevel));
    return e;
  }

  private respawn(m: Entity, def: MonsterDef) {
    this.applyMonsterLevel(m, def, this.rng.int(def.minLevel, def.maxLevel));
    m.dead = false; m.x = m.home.x; m.y = m.home.y; m.ai = 'idle'; m.aiTimer = 2; m.path = []; m.attackCd = 1;
  }

  // ---------- movimento ----------
  private followPath(e: Entity, dt: number, mul: number) {
    let rem = e.moveSpeed * mul * dt;
    while (rem > 0 && e.path.length) {
      const w = e.path[0], dx = w.x - e.x, dy = w.y - e.y, d = Math.hypot(dx, dy);
      if (d <= rem) { e.x = w.x; e.y = w.y; rem -= d; e.path.shift(); }
      else { e.x += (dx / d) * rem; e.y += (dy / d) * rem; rem = 0; }
    }
  }

  private step(e: Entity, dx: number, dy: number, d: number) {
    const nx = e.x + dx * d, ny = e.y + dy * d;
    if (isWalkable(this.map, nx, ny)) { e.x = nx; e.y = ny; }
    else if (isWalkable(this.map, nx, e.y)) e.x = nx;
    else if (isWalkable(this.map, e.x, ny)) e.y = ny;
  }
}
