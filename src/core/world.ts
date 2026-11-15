import { CLASSES, MONSTERS, PROGRESSION, type MonsterDef } from './data';
import { distributeByRatio } from './distribute';
import { rollAttack, type AttackResult } from './combat';
import { screenToTile } from './iso';
import type { GameMap } from './map';
import { findPath, isWalkable } from './pathfinding';
import { GLOBAL_COOLDOWN, SKILLS, SKILL_MAX_LEVEL, classActives, skillScale, skillXpToNext, type SkillDef, type SkillState } from './skills';
import { Rng } from './rng';
import { computeDerived, emptyElements } from './stats';
import { ATTR_KEYS, type AttrKey, type Attributes, type BuffKind, type Entity, type GameEvent, type Point, type SaveData, type SkillFailReason } from './types';

export const STEP = 1 / 60;
const TARGET_RANGE = 14;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const TOWN_MAPS = new Set(['cidade']);
const TOWN_REGEN = 0.03; // 3% por segundo
const DASH_STOP = 1.0; // distância final do Passo Fantasma até o alvo

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
  audio = { sfx: 80, music: 50, muted: false };
  monsters: Entity[] = [];
  npcs: Entity[] = [];
  events: GameEvent[] = [];
  time = 0;
  targetId: number | null = null;
  skills: Record<string, SkillState> = {};
  gcd = 0;
  private pendingSkill: number | null = null;
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
    for (const s of SKILLS[classId] ?? []) this.skills[s.id] = { level: 1, xp: 0, cd: 0 };
    this.recalc(this.player, false);
  }

  static create(maps: Record<string, GameMap>, name: string, classId: string): World {
    const w = new World(maps, name, classId, 1, { ...CLASSES[classId].baseAttributes });
    w.changeMap('cidade');
    for (const s of SKILLS[classId] ?? []) if (s.unlock <= 1) w.events.push({ type: 'skillUnlocked', skillId: s.id });
    return w;
  }

  static fromSave(maps: Record<string, GameMap>, s: SaveData): World {
    const w = new World(maps, s.name, s.classId, s.level, { ...s.attributes });
    w.xp = s.xp; w.freePoints = s.freePoints;
    w.ratioCursor = s.ratioCursor ?? 0; w.seenTips = [...(s.seenTips ?? [])]; w.tipsEnabled = s.tipsEnabled ?? true;
    w.audio = { sfx: s.audio?.sfx ?? 80, music: s.audio?.music ?? 50, muted: s.audio?.muted ?? false };
    for (const [id, st] of Object.entries(s.skills ?? {})) {
      const cur = w.skills[id];
      if (!cur) continue;
      cur.level = Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(Number(st.level) || 1)));
      cur.xp = cur.level >= SKILL_MAX_LEVEL ? 0 : Math.max(0, Number(st.xp) || 0);
    }
    w.recalc(w.player, false);
    w.changeMap(maps[s.mapId] ? s.mapId : 'cidade');
    return w;
  }

  serialize(): SaveData {
    return {
      version: 1, name: this.player.name, classId: this.classId, level: this.player.level, xp: this.xp,
      freePoints: this.freePoints, attributes: { ...this.player.attrs }, mapId: this.mapId, lastSeen: Date.now(),
      skills: Object.fromEntries(Object.entries(this.skills).map(([id, st]) => [id, { level: st.level, xp: st.xp }])),
      ratioCursor: this.ratioCursor, seenTips: [...this.seenTips], tipsEnabled: this.tipsEnabled, audio: { ...this.audio },
    };
  }

  // ---------- comandos ----------
  moveTo(x: number, y: number) {
    if (this.player.dead) return;
    if (!this.player.attackWhileMoving) this.autoAttack = false;
    this.pendingSkill = null;
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
    if (id === null) { this.targetId = null; this.autoAttack = false; this.pendingSkill = null; return; }
    const m = this.monsters.find((e) => e.id === id);
    if (!m || m.dead) return;
    if (this.targetId !== id) this.pendingSkill = null;
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

  // ---------- skills ----------
  classSkills(): SkillDef[] { return SKILLS[this.classId] ?? []; }
  activeSkills(): SkillDef[] { return classActives(this.classId); }
  isUnlocked(def: SkillDef) { return this.player.level >= def.unlock; }
  // ativa: sobe pelo uso; passiva: acompanha o nível do personagem
  skillLevel(def: SkillDef): number {
    if (def.type === 'passive') return Math.max(1, Math.min(SKILL_MAX_LEVEL, this.player.level - def.unlock + 1));
    return this.skills[def.id]?.level ?? 1;
  }
  skillXpNeed(def: SkillDef): number | null {
    if (def.type === 'passive') return null;
    const l = this.skillLevel(def);
    return l >= SKILL_MAX_LEVEL ? null : skillXpToNext(l);
  }
  passiveValue(key: 'attackSpeed' | 'crit' | 'manaRegen'): number {
    let v = 0;
    for (const d of this.classSkills()) {
      const base = d.type === 'passive' ? d.passive?.[key] : undefined;
      if (base && this.isUnlocked(d)) v += base * skillScale(this.skillLevel(d));
    }
    return v;
  }

  hasBuff(e: Entity, kind: BuffKind) { return e.buffs.some((b) => b.kind === kind); }
  addBuff(e: Entity, id: string, kind: BuffKind, value: number, duration: number) {
    const old = e.buffs.find((b) => b.id === id && b.kind === kind);
    if (old) { old.value = value; old.remaining = old.duration = duration; }
    else e.buffs.push({ id, kind, value, remaining: duration, duration });
    this.events.push({ type: 'buffApplied', targetId: e.id, id, kind, duration });
  }
  private tickBuffs(e: Entity, dt: number) {
    if (!e.buffs.length) return;
    for (const b of e.buffs) b.remaining -= dt;
    const gone = e.buffs.filter((b) => b.remaining <= 0 || (b.kind === 'shield' && b.value <= 0));
    if (!gone.length) return;
    e.buffs = e.buffs.filter((b) => !gone.includes(b));
    for (const b of gone) this.events.push({ type: 'buffExpired', targetId: e.id, id: b.id, kind: b.kind });
  }
  private speedMul(e: Entity) {
    let m = 1;
    for (const b of e.buffs) if (b.kind === 'slow') m *= 1 - b.value;
    return m;
  }
  private defender(t: Entity) {
    const red = t.buffs.filter((b) => b.kind === 'defReduction').reduce((a, b) => a + b.value, 0);
    if (!red) return t;
    const k = Math.max(0, 1 - red);
    return { ...t, derived: { ...t.derived, physDef: t.derived.physDef * k, spiritDef: t.derived.spiritDef * k } };
  }
  private absorb(e: Entity, amount: number): number {
    let rem = amount;
    for (const b of e.buffs) {
      if (b.kind !== 'shield' || rem <= 0) continue;
      const a = Math.min(b.value, rem);
      b.value -= a; rem -= a;
    }
    if (rem < amount) this.events.push({ type: 'shieldAbsorb', targetId: e.id, amount: amount - rem, x: e.x, y: e.y });
    return rem;
  }

  skillReach(def: SkillDef): number { return def.range === 'melee' ? this.player.attackRange : (def.range ?? 0); }

  private fail(def: SkillDef, reason: SkillFailReason) { this.events.push({ type: 'skillFail', skillId: def.id, reason }); }

  useSkill(slot: number) {
    const p = this.player, def = this.activeSkills()[slot];
    if (!def || p.dead) return;
    if (!this.isUnlocked(def)) return this.fail(def, 'locked');
    const st = this.skills[def.id];
    if (st.cd > 0 || this.gcd > 0) return this.fail(def, 'cooldown');
    if (p.mana < (def.mana ?? 0)) return this.fail(def, 'mana');
    if (def.target === 'none') { this.castSkill(def, null); return; }
    const t = this.getTarget();
    if (!t) return this.fail(def, 'notarget');
    if (dist(p, t) <= this.skillReach(def)) { this.pendingSkill = null; this.castSkill(def, t); return; }
    this.pendingSkill = slot; // anda até o alvo e lança em seguida
  }

  // retorna true se está andando até o alvo (consome o movimento do tick)
  private tickPending(dt: number, t: Entity | null, moving: boolean): boolean {
    const p = this.player, def = this.pendingSkill === null ? undefined : this.activeSkills()[this.pendingSkill];
    if (!def || !t) { this.pendingSkill = null; return false; }
    if (dist(p, t) <= this.skillReach(def)) {
      if (this.gcd > 0 || this.skills[def.id].cd > 0) return false;
      this.pendingSkill = null;
      if (p.mana < (def.mana ?? 0)) this.fail(def, 'mana');
      else this.castSkill(def, t);
      return false;
    }
    if (moving) { if (!p.attackWhileMoving) this.pendingSkill = null; return false; }
    p.repathCd -= dt;
    if (p.repathCd <= 0 || !p.path.length) { p.repathCd = 0.3; p.path = findPath(this.map, p, t); }
    this.chasing = true;
    this.followPath(p, dt, 1);
    return true;
  }

  private clearLine(a: Point, b: Point) {
    const n = Math.ceil(dist(a, b) / 0.25);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (!isWalkable(this.map, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false;
    }
    return true;
  }

  private castSkill(def: SkillDef, t: Entity | null) {
    const p = this.player, st = this.skills[def.id], scale = skillScale(st.level);
    const around = def.area === 'self' ? p : def.area === 'target' ? t : null;
    let victims: Entity[] = t ? [t] : [];
    if (around) {
      victims = this.monsters.filter((m) => !m.dead && dist(m, around) <= (def.radius ?? 0));
      if (!victims.length) return this.fail(def, 'notarget');
    }
    let dest: Point | null = null;
    if (def.dash && t) {
      const d = dist(p, t);
      if (d > DASH_STOP) {
        const k = (d - DASH_STOP) / d;
        dest = { x: p.x + (t.x - p.x) * k, y: p.y + (t.y - p.y) * k };
        if (!isWalkable(this.map, dest.x, dest.y) || !this.clearLine(p, dest)) return this.fail(def, 'blocked');
      }
    }
    p.mana -= def.mana ?? 0;
    st.cd = def.cooldown ?? 0; this.gcd = GLOBAL_COOLDOWN;
    p.attackCd = Math.max(p.attackCd, 0.3);
    this.events.push({ type: 'skillCast', skillId: def.id, casterId: p.id, x: p.x, y: p.y, targetId: t?.id ?? null, tx: (t ?? p).x, ty: (t ?? p).y, ranged: p.attackRange > 3 });
    if (dest) {
      this.events.push({ type: 'dash', fromX: p.x, fromY: p.y, toX: dest.x, toY: dest.y });
      p.x = dest.x; p.y = dest.y; p.path = [];
    }
    for (const v of victims) {
      for (const pct of def.hits ?? []) {
        if (v.dead) break;
        const r = this.attack(p, v, pct * scale, true);
        if (r.hit && !v.dead && def.debuff) this.addBuff(v, def.id, def.debuff.kind, def.debuff.value, def.debuff.duration);
      }
    }
    if (def.shield) this.addBuff(p, def.id, 'shield', p.derived.maxHp * def.shield.percent * scale, def.shield.duration);
    this.gainSkillXp(def, st);
  }

  private gainSkillXp(def: SkillDef, st: SkillState) {
    if (st.level >= SKILL_MAX_LEVEL) return;
    st.xp++;
    for (let need = skillXpToNext(st.level); st.level < SKILL_MAX_LEVEL && st.xp >= need; need = skillXpToNext(st.level)) {
      st.xp -= need; st.level++;
      this.events.push({ type: 'skillLevelUp', skillId: def.id, level: st.level });
    }
    if (st.level >= SKILL_MAX_LEVEL) st.xp = 0;
  }

  private applyPassives() {
    const p = this.player;
    p.derived = { ...p.derived, critChance: Math.min(0.95, p.derived.critChance + this.passiveValue('crit')) };
    p.attackInterval = CLASSES[this.classId].attackInterval / (1 + this.passiveValue('attackSpeed'));
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
    this.gcd = Math.max(0, this.gcd - dt);
    for (const st of Object.values(this.skills)) st.cd = Math.max(0, st.cd - dt);
    this.tickBuffs(this.player, dt);
    for (const m of this.monsters) this.tickBuffs(m, dt);
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
    } else if (!TOWN_MAPS.has(this.mapId)) {
      p.mana = Math.min(d.maxMana, p.mana + d.maxMana * this.passiveValue('manaRegen') * dt);
    }
    const t = this.getTarget();
    if (this.targetId !== null && !t) { this.targetId = null; this.autoAttack = false; }
    const mi = this.moveInput, moving = !!(mi.x || mi.y);
    if (this.pendingSkill !== null && this.tickPending(dt, t, moving || (p.attackWhileMoving && p.path.length > 0))) return;
    if (moving) {
      p.path = [];
      this.step(p, mi.x, mi.y, p.moveSpeed * this.speedMul(p) * dt);
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

  private attack(a: Entity, t: Entity, mult = 1, skill = false): AttackResult {
    const r = rollAttack(a, this.defender(t), this.rng);
    if (r.hit && mult !== 1) r.amount = Math.max(1, Math.round(r.amount * mult));
    if (!skill) this.events.push({ type: 'attack', fromId: a.id, toId: t.id, ranged: a.attackRange > 3 });
    if (r.hit) {
      const dealt = t.kind === 'player' ? this.absorb(t, r.amount) : r.amount;
      t.hp -= dealt;
      if (dealt > 0) this.events.push({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: r.crit });
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
    return r;
  }

  private killMonster(m: Entity) {
    const def = MONSTERS[m.monsterId];
    m.dead = true; m.hp = 0; m.path = []; m.buffs = [];
    m.respawnAt = this.time + def.respawnSeconds;
    if (this.targetId === m.id) { this.targetId = null; this.autoAttack = false; }
    this.events.push({ type: 'death', id: m.id });
    this.events.push({ type: 'kill', monsterId: m.monsterId });
    this.gainXp(def.xpBase + def.xpPerLevel * (m.level - 1));
  }

  private killPlayer() {
    const p = this.player;
    p.dead = true; p.hp = 0; p.path = []; p.buffs = []; this.pendingSkill = null; this.moveInput = { x: 0, y: 0 };
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
      for (const s of this.classSkills()) if (s.unlock === p.level) this.events.push({ type: 'skillUnlocked', skillId: s.id });
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
    if (e.kind === 'player') this.applyPassives();
  }

  // ---------- mapa / entidades ----------
  changeMap(mapId: string, x?: number, y?: number) {
    this.mapId = mapId; this.map = this.maps[mapId];
    const sp = this.map.objects.find((o) => o.type === 'spawn');
    const p = this.player;
    p.x = x ?? sp?.x ?? 1.5; p.y = y ?? sp?.y ?? 1.5; p.path = [];
    this.moveInput = { x: 0, y: 0 };
    this.targetId = null; this.autoAttack = false; this.pendingSkill = null; this.portalCd = 1;
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
      path: [], repathCd: 0, monsterId: '', home: { x: 0, y: 0 }, ai: 'idle', aiTimer: 0, respawnAt: 0, buffs: [],
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
    m.buffs = []; m.dead = false; m.x = m.home.x; m.y = m.home.y; m.ai = 'idle'; m.aiTimer = 2; m.path = []; m.attackCd = 1;
  }

  // ---------- movimento ----------
  private followPath(e: Entity, dt: number, mul: number) {
    let rem = e.moveSpeed * mul * this.speedMul(e) * dt;
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
