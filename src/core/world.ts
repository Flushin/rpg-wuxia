import { CLASSES, MONSTERS, PROGRESSION, type MonsterDef } from './data';
import { L } from './i18n';
import { distributeByRatio } from './distribute';
import { rollAttack, type AttackResult } from './combat';
import { screenToTile } from './iso';
import type { GameMap } from './map';
import { findPath, isWalkable, type Avoid } from './pathfinding';
import { GLOBAL_COOLDOWN, SKILLS, SKILL_MAX_LEVEL, classActives, skillScale, skillXpToNext, type SkillDef, type SkillState } from './skills';
import { BAG_SIZE, BASES, GROUND_SECONDS, POTIONS, SLOTS, STACK_MAX, STARTING_KIT, STARTING_WEAPON, baseOf, buyPrice, equipmentBaseIds, isBroken, isPotionId, itemColor, itemName,
  itemStats, makeEquipment, makePotion, maxDurability, repairCost, rollRarity, sanitizeItem, sellValue, sortedBag, WEAR_PER_HIT } from './items';
import { AutoCombat, TOWN_MAPS as AUTO_TOWNS } from './auto';
import { computeOffline, type OfflineResult } from './offline';
import { Rng } from './rng';
import { computeDerived, emptyElements } from './stats';
import { ATTR_KEYS, ELEMENTS, type AttrKey, type Attributes, type BuffKind, type Entity, type GameEvent, type GroundItem, type ItemInstance, type Point, type PotionKind, type Rarity, type SaveData, type SkillFailReason, type Slot, type Telegraph } from './types';

export const STEP = 1 / 60;
const TARGET_RANGE = 14;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const TOWN_MAPS = AUTO_TOWNS;
const TOWN_REGEN = 0.03; // 3% por segundo
const DASH_STOP = 1.0; // distância final do Passo do Raio até o alvo
const NPC_REACH = 1.8; // distância para abrir a janela do NPC
const NPC_LEAVE = 3; // janela fecha ao se afastar mais que isso
const DEATH_DURABILITY_LOSS = 0.1;
const NPC_ROLES: Record<string, string> = { 'Ferreiro': 'ferreiro', 'Vendedor de Poções': 'vendedor', 'Ancião': 'anciao' };
export interface PotionFx { id: string; remaining: number; rate: number }
export interface OfflineReport {
  elapsedMs: number; effMin: number; efficiency: number; kills: number; xp: number; levelsGained: number; newLevel: number; gold: number;
  items: { name: string; color: string; rarity: Rarity; qty: number }[];
  potionsUsed: Record<PotionKind, number>; soldCount: number; soldGold: number;
}

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
  gold = 0;
  bag: (ItemInstance | null)[] = Array(BAG_SIZE).fill(null);
  equipment: Record<Slot, ItemInstance | null> = { colar: null, tronco: null, arma: null, cabeca: null, calca: null, bota: null };
  ground: GroundItem[] = [];
  invVersion = 0; // sobe a cada mudança de inventário/equipamento/ouro (a UI usa para redesenhar)
  potionFx: Record<PotionKind, PotionFx | null> = { hp: null, mp: null };
  potionCd: Record<PotionKind, number> = { hp: 0, mp: 0 };
  openNpc: Entity | null = null;
  auto: AutoCombat;
  offlineReport: OfflineReport | null = null;
  telegraphs: Telegraph[] = [];
  arenas: Avoid[] = []; // áreas de chefe do mapa atual
  bossRespawnAtMs = 0; // relógio real (ms) em que o chefe renasce; 0 = vivo
  clock: () => number = () => Date.now();
  private bossSummoned = false;
  private arenaSeen = false;
  private nextTelegraph = 1;
  private npcGoal: number | null = null;
  private nextGround = 1;
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
    this.auto = new AutoCombat(this, classId);
    this.map = maps[this.mapId];
    this.player = this.makePlayer(name, classId, level, attrs);
    for (const s of SKILLS[classId] ?? []) this.skills[s.id] = { level: 1, xp: 0, cd: 0 };
    this.recalc(this.player, false);
  }

  static create(maps: Record<string, GameMap>, name: string, classId: string): World {
    const w = new World(maps, name, classId, 1, { ...CLASSES[classId].baseAttributes });
    for (const [id, n] of Object.entries(STARTING_KIT)) w.addItem(makePotion(id, n));
    const wid = STARTING_WEAPON[classId];
    if (wid) w.equipment.arma = makeEquipment(wid, 'comum', null, w.rng);
    w.recalc(w.player, false);
    w.player.hp = w.player.derived.maxHp; w.player.mana = w.player.derived.maxMana;
    w.changeMap('cidade');
    for (const s of SKILLS[classId] ?? []) if (s.unlock <= 1) w.events.push({ type: 'skillUnlocked', skillId: s.id });
    return w;
  }

  // offline=false: não aplica ganho offline (só o último personagem jogado recebe)
  static fromSave(maps: Record<string, GameMap>, s: SaveData, now = Date.now(), offline = true): World {
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
    w.gold = Math.max(0, Math.floor(Number(s.gold) || 0));
    (Array.isArray(s.bag) ? s.bag : []).slice(0, BAG_SIZE).forEach((raw, i) => { w.bag[i] = sanitizeItem(raw); });
    for (const sl of SLOTS) {
      const it = sanitizeItem(s.equipment?.[sl]);
      if (it && BASES[it.baseId]?.slot === sl) w.equipment[sl] = it;
    }
    w.recalc(w.player, false);
    w.player.hp = Math.min(w.player.hp, w.player.derived.maxHp);
    w.clock = () => now;
    w.bossRespawnAtMs = Number.isFinite(Number(s.bossRespawnAt)) ? Math.max(0, Number(s.bossRespawnAt)) : 0;
    w.changeMap(maps[s.mapId] ? s.mapId : 'cidade');
    w.clock = () => Date.now();
    w.auto.load(s.auto);
    w.offlineReport = offline ? w.applyOffline(now, s.lastSeen, s.auto) : null;
    return w;
  }

  serialize(): SaveData {
    return {
      version: 1, name: this.player.name, classId: this.classId, level: this.player.level, xp: this.xp,
      freePoints: this.freePoints, attributes: { ...this.player.attrs }, mapId: this.mapId, lastSeen: Date.now(),
      skills: Object.fromEntries(Object.entries(this.skills).map(([id, st]) => [id, { level: st.level, xp: st.xp }])),
      ratioCursor: this.ratioCursor, seenTips: [...this.seenTips], tipsEnabled: this.tipsEnabled, audio: { ...this.audio },
      gold: this.gold, bag: JSON.parse(JSON.stringify(this.bag)),
      equipment: JSON.parse(JSON.stringify(Object.fromEntries(SLOTS.filter((sl) => this.equipment[sl]).map((sl) => [sl, this.equipment[sl]])))),
      auto: this.auto.serialize(), bossRespawnAt: this.bossRespawnAtMs > this.clock() ? this.bossRespawnAtMs : undefined,
    };
  }

  emit(ev: GameEvent) { this.events.push(ev); this.auto.observe(ev); }

  // ---------- comandos ----------
  // andar do auto-combate (não pausa o auto)
  autoMove(x: number, y: number, viaPortal = false) { if (!this.player.dead) this.player.path = this.pf(this.player, { x, y }, viaPortal); }
  // o auto-combate nunca entra na área do chefe e só atravessa portais de propósito (viaPortal)
  private pf(from: Point, to: Point, viaPortal = false): Point[] {
    if (this.auto.state !== 'on') return findPath(this.map, from, to);
    const avoid: Avoid[] = this.arenas.map((a) => ({ ...a, r: a.r + 1.5 }));
    if (!viaPortal) for (const o of this.map.objects) if (o.type === 'portal') avoid.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.max(o.w, o.h) / 2 + 0.6 });
    return findPath(this.map, from, to, avoid.length ? avoid : undefined);
  }
  // comprimento do caminho até o ponto (Infinity se inalcançável); usado pelo auto para escolher o alvo "mais perto" de verdade
  pathLength(to: Point): number {
    const path = this.pf(this.player, to);
    if (!path.length) return dist(this.player, to) < 1 ? 0 : Infinity;
    let len = 0, a: Point = this.player;
    for (const q of path) { len += dist(a, q); a = q; }
    return len;
  }
  inArena(pt: Point, margin = 0): boolean { return this.arenas.some((a) => dist(a, pt) <= a.r + margin); }

  moveTo(x: number, y: number) {
    if (this.player.dead) return;
    this.auto.manualMove();
    if (!this.player.attackWhileMoving) this.autoAttack = false;
    this.pendingSkill = null; this.npcGoal = null;
    this.chasing = false;
    this.moveInput = { x: 0, y: 0 };
    this.player.path = findPath(this.map, this.player, { x, y });
  }

  // vetor em espaço de tela (joystick); convertido para tiles
  setMoveInput(sx: number, sy: number) {
    const t = screenToTile(sx, sy), l = Math.hypot(t.x, t.y);
    this.moveInput = l < 0.001 ? { x: 0, y: 0 } : { x: t.x / l, y: t.y / l };
    if (l >= 0.001) { this.npcGoal = null; this.auto.manualMove(); }
  }

  setTarget(id: number | null) {
    if (id === null) { this.targetId = null; this.autoAttack = false; this.pendingSkill = null; return; }
    const m = this.monsters.find((e) => e.id === id);
    if (!m || m.dead) return;
    this.npcGoal = null;
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
    this.emit({ type: 'buffApplied', targetId: e.id, id, kind, duration });
  }
  private tickBuffs(e: Entity, dt: number) {
    if (!e.buffs.length) return;
    for (const b of e.buffs) b.remaining -= dt;
    const gone = e.buffs.filter((b) => b.remaining <= 0 || (b.kind === 'shield' && b.value <= 0));
    if (!gone.length) return;
    e.buffs = e.buffs.filter((b) => !gone.includes(b));
    for (const b of gone) this.emit({ type: 'buffExpired', targetId: e.id, id: b.id, kind: b.kind });
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
    if (rem < amount) this.emit({ type: 'shieldAbsorb', targetId: e.id, amount: amount - rem, x: e.x, y: e.y });
    return rem;
  }

  skillReach(def: SkillDef): number { return def.range === 'melee' ? this.player.attackRange : (def.range ?? 0); }

  private fail(def: SkillDef, reason: SkillFailReason) { this.emit({ type: 'skillFail', skillId: def.id, reason }); }

  useSkill(slot: number) {
    const p = this.player, def = this.activeSkills()[slot];
    if (!def || p.dead) return;
    if (!this.isUnlocked(def)) return this.fail(def, 'locked');
    const st = this.skills[def.id];
    if (st.cd > 0 || this.gcd > 0) return this.fail(def, 'cooldown');
    if (p.mana < (def.mana ?? 0)) return this.fail(def, 'mana');
    if (def.target === 'none') { this.castSkill(def, null); return; }
    const t = this.getTarget();
    if (def.area) { // skill de área nunca exige alvo: no alvo se estiver no alcance, senão em volta do personagem
      this.pendingSkill = null;
      this.castSkill(def, t && dist(p, t) <= this.skillReach(def) ? t : null); return;
    }
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
    if (p.repathCd <= 0 || !p.path.length) { p.repathCd = 0.3; p.path = this.pf(p, t); }
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
    const around = def.area === 'self' ? p : def.area === 'target' ? (t ?? p) : null;
    let victims: Entity[] = t ? [t] : [];
    if (around) victims = this.monsters.filter((m) => !m.dead && dist(m, around) <= (def.radius ?? 0));
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
    this.emit({ type: 'skillCast', skillId: def.id, casterId: p.id, x: p.x, y: p.y, targetId: t?.id ?? null, tx: (t ?? p).x, ty: (t ?? p).y, ranged: p.attackRange > 3 });
    if (dest) {
      this.emit({ type: 'dash', fromX: p.x, fromY: p.y, toX: dest.x, toY: dest.y });
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
    if (victims.length || def.shield) this.gainSkillXp(def, st); // sem acertar ninguém não ganha xp (evita treinar skill no vazio)
  }

  private gainSkillXp(def: SkillDef, st: SkillState) {
    if (st.level >= SKILL_MAX_LEVEL) return;
    st.xp++;
    for (let need = skillXpToNext(st.level); st.level < SKILL_MAX_LEVEL && st.xp >= need; need = skillXpToNext(st.level)) {
      st.xp -= need; st.level++;
      this.emit({ type: 'skillLevelUp', skillId: def.id, level: st.level });
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

  // cada item equipado perde 10% da durabilidade máxima
  onPlayerDeath(): void {
    let lost = false;
    for (const sl of SLOTS) {
      const it = this.equipment[sl];
      if (!it) continue;
      it.durability = Math.max(0, it.durability - maxDurability(it) * DEATH_DURABILITY_LOSS);
      lost = true;
    }
    this.potionFx = { hp: null, mp: null };
    this.closeNpc(); this.npcGoal = null;
    if (lost) { this.recalc(this.player, false); this.invVersion++; this.emit({ type: 'durabilityLost' }); }
  }

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
    this.potionCd.hp = Math.max(0, this.potionCd.hp - dt); this.potionCd.mp = Math.max(0, this.potionCd.mp - dt);
    if (!this.player.dead) { this.tickPotions(dt); this.tickGround(); }
    if (this.openNpc && (this.player.dead || dist(this.openNpc, this.player) > NPC_LEAVE)) this.closeNpc();
    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    } else {
      this.auto.tick(dt);
      this.tickPlayer(dt);
      this.checkPortals();
      if (this.arenas.length && !this.arenaSeen && this.inArena(this.player)) { this.arenaSeen = true; this.emit({ type: 'bossArena' }); }
    }
    for (const m of this.monsters) this.tickMonster(m, dt);
    this.tickTelegraphs(dt);
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
    if (this.npcGoal !== null) {
      const n = this.npcs.find((e) => e.id === this.npcGoal);
      if (!n || moving) this.npcGoal = null;
      else {
        if (dist(p, n) <= NPC_REACH) { p.path = []; this.npcGoal = null; this.openNpcWindow(n); return; }
        p.repathCd -= dt;
        if (p.repathCd <= 0 || !p.path.length) { p.repathCd = 0.3; p.path = this.pf(p, n); }
        this.followPath(p, dt, 1);
        return;
      }
    }
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
      if (p.repathCd <= 0 || !p.path.length) { p.repathCd = 0.3; p.path = this.pf(p, t); }
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
    const boss = def.boss;
    if (boss) this.tickBossExtras(m, def, dt);
    const wake = !boss || (!p.dead && dist(p, m.home) <= boss.arenaRadius); // chefe só acorda com o jogador na arena
    if (m.ai === 'idle') {
      if (pd < def.aggroRange && wake) { this.aggro(m); return; }
      m.aiTimer -= dt;
      if (m.aiTimer <= 0 && !boss) {
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
      if (p.dead || dist(m, m.home) > def.leashRange || (boss && !wake)) {
        m.ai = 'return'; m.path = findPath(this.map, m, m.home);
        return;
      }
      if (def.keepDistance && pd < def.keepDistance && dist(m, m.home) < def.leashRange * 0.8) {
        // arqueiro: recua um pouco mantendo distância e continua atirando
        m.path = [];
        this.step(m, (m.x - p.x) / Math.max(0.01, pd), (m.y - p.y) / Math.max(0.01, pd), m.moveSpeed * 0.9 * this.speedMul(m) * dt);
        if (m.attackCd <= 0 && pd <= m.attackRange) { m.attackCd = m.attackInterval; this.attack(m, p); }
      } else if (pd <= m.attackRange) {
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
      if (!m.path.length || dist(m, m.home) < 0.3) {
        m.path = []; m.ai = 'idle'; m.aiTimer = 1; m.hp = m.derived.maxHp;
        if (boss) this.resetBoss(m);
      }
    }
  }

  private aggro(m: Entity) {
    if (m.ai !== 'chase' && MONSTERS[m.monsterId]?.boss) m.aiTimer = 3;
    m.ai = 'chase'; m.repathCd = 0; m.path = [];
    if (m.group && MONSTERS[m.monsterId]?.groupAggro) {
      for (const o of this.monsters) if (o !== m && o.group === m.group && !o.dead && (o.ai === 'idle' || o.ai === 'wander')) { o.ai = 'chase'; o.repathCd = 0; o.path = []; }
    }
  }

  // ---------- chefe ----------
  private tickBossExtras(m: Entity, def: MonsterDef, dt: number) {
    const b = def.boss!, p = this.player;
    if (m.ai === 'chase') {
      m.aiTimer -= dt;
      if (m.aiTimer <= 0 && !p.dead) {
        m.aiTimer = m.hp <= m.derived.maxHp * b.summon.atHpPct ? b.aoe.intervalPhase2 : b.aoe.interval;
        const t: Telegraph = { id: this.nextTelegraph++, x: p.x, y: p.y, radius: b.aoe.radius, delay: b.aoe.delay, remaining: b.aoe.delay, ownerId: m.id, mult: b.aoe.mult };
        this.telegraphs.push(t);
        this.emit({ type: 'telegraph', id: t.id, x: t.x, y: t.y, radius: t.radius, delay: t.delay });
      }
      if (!this.bossSummoned && m.hp <= m.derived.maxHp * b.summon.atHpPct) this.summonAdds(m, b.summon);
    }
  }
  private summonAdds(boss: Entity, sm: { monsterId: string; count: number; level: number }) {
    this.bossSummoned = true;
    const sdef = MONSTERS[sm.monsterId], ids: number[] = [];
    for (let i = 0; i < sm.count; i++) {
      const a = (i / sm.count) * Math.PI * 2 + 0.7;
      let pos: Point = { x: boss.x + Math.cos(a) * 2.2, y: boss.y + Math.sin(a) * 2.2 };
      if (!isWalkable(this.map, pos.x, pos.y)) pos = { x: boss.x, y: boss.y };
      const e = this.makeMonster(sdef, pos);
      this.applyMonsterLevel(e, sdef, sm.level);
      e.home = { ...boss.home }; e.summoned = true; e.ai = 'chase'; e.respawnAt = Infinity;
      this.monsters.push(e); ids.push(e.id);
    }
    this.emit({ type: 'bossSummon', ids });
  }
  private resetBoss(m: Entity) {
    this.bossSummoned = false;
    this.telegraphs = this.telegraphs.filter((t) => t.ownerId !== m.id);
    this.monsters = this.monsters.filter((x) => !x.summoned);
    m.aiTimer = 0;
  }
  private tickTelegraphs(dt: number) {
    if (!this.telegraphs.length) return;
    const p = this.player;
    for (const t of [...this.telegraphs]) {
      t.remaining -= dt;
      if (t.remaining > 0) continue;
      this.telegraphs = this.telegraphs.filter((x) => x !== t);
      const owner = this.monsters.find((e) => e.id === t.ownerId);
      const hit = !!owner && !owner.dead && !p.dead && dist(p, t) <= t.radius;
      this.emit({ type: 'telegraphResolved', id: t.id, x: t.x, y: t.y, radius: t.radius, hit });
      if (hit && owner) this.directDamage(owner, p, t.mult);
    }
  }
  // dano que não erra (golpes marcados no chão): ataque do dono × mult, reduzido pela defesa
  private directDamage(a: Entity, t: Entity, mult: number) {
    const physical = a.damageType === 'physical';
    const atk = physical ? a.derived.physAtk : a.derived.spiritAtk, df = physical ? t.derived.physDef : t.derived.spiritDef;
    const amount = Math.max(1, Math.round(atk * mult * (1 - df / (df + 100))));
    const dealt = this.absorb(t, amount);
    t.hp -= dealt;
    if (dealt > 0) this.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: false });
    this.lastDamaged = this.time;
    this.wearGear();
    if (t.hp <= 0) this.killPlayer();
  }
  // chefe engajado (para a barra grande no topo)
  engagedBoss(): Entity | null {
    return this.monsters.find((m) => !m.dead && !!MONSTERS[m.monsterId]?.boss && (m.ai === 'chase' || m.hp < m.derived.maxHp)) ?? null;
  }
  private wearGear() {
    if (WEAR_PER_HIT <= 0) return;
    const worn = SLOTS.map((sl) => this.equipment[sl]).filter((i): i is ItemInstance => !!i && i.durability > 0);
    if (!worn.length) return;
    const it = worn[Math.min(worn.length - 1, Math.floor(this.rng.next() * worn.length))];
    it.durability = Math.max(0, it.durability - WEAR_PER_HIT);
    if (it.durability <= 0) this.recalc(this.player, false);
    this.bumpInv();
  }

  private attack(a: Entity, t: Entity, mult = 1, skill = false): AttackResult {
    const r = rollAttack(a, this.defender(t), this.rng);
    if (r.hit && mult !== 1) r.amount = Math.max(1, Math.round(r.amount * mult));
    if (!skill) this.emit({ type: 'attack', fromId: a.id, toId: t.id, ranged: a.attackRange > 3 });
    if (a.kind === 'monster' && MONSTERS[a.monsterId]?.projectile) this.emit({ type: 'projectile', fromX: a.x, fromY: a.y, toX: t.x, toY: t.y, kind: 'arrow' });
    if (r.hit && t.kind === 'player' && a.kind === 'monster') this.wearGear();
    if (r.hit) {
      const dealt = t.kind === 'player' ? this.absorb(t, r.amount) : r.amount;
      t.hp -= dealt;
      if (dealt > 0) this.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: r.crit });
    } else {
      this.emit({ type: 'miss', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y });
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
    m.respawnAt = m.summoned ? Infinity : this.time + def.respawnSeconds;
    if (def.boss) {
      this.bossRespawnAtMs = this.clock() + def.respawnSeconds * 1000;
      this.telegraphs = []; this.monsters = this.monsters.filter((x) => !x.summoned || x.dead);
      this.emit({ type: 'bossDefeated', respawnAt: this.bossRespawnAtMs });
    }
    if (this.targetId === m.id) { this.targetId = null; this.autoAttack = false; }
    this.emit({ type: 'death', id: m.id });
    this.emit({ type: 'kill', monsterId: m.monsterId, level: m.level });
    this.gainXp(def.xpBase + def.xpPerLevel * (m.level - 1));
    this.dropLoot(m, def);
    if (m.summoned) this.monsters = this.monsters.filter((x) => x !== m);
  }

  private killPlayer() {
    const p = this.player;
    p.dead = true; p.hp = 0; p.path = []; p.buffs = []; this.pendingSkill = null; this.moveInput = { x: 0, y: 0 };
    this.targetId = null; this.autoAttack = false; this.respawnTimer = 3;
    this.emit({ type: 'playerDeath' });
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
    this.emit({ type: 'xp', amount: n });
    for (let need = this.xpToNext(); need !== null && this.xp >= need; need = this.xpToNext()) {
      this.xp -= need; p.level++;
      const up = CLASSES[this.classId].levelUpAttributes;
      for (const k of ATTR_KEYS) p.attrs[k] += up[k];
      this.freePoints += PROGRESSION.freePointsPerLevel;
      this.recalc(p, false);
      p.hp = p.derived.maxHp; p.mana = p.derived.maxMana;
      this.emit({ type: 'levelup', level: p.level });
      for (const s of this.classSkills()) if (s.unlock === p.level) this.emit({ type: 'skillUnlocked', skillId: s.id });
    }
    if (p.level >= PROGRESSION.levelCap) this.xp = 0;
  }

  private recalc(e: Entity, keepGain: boolean) {
    const old = e.derived;
    if (e.kind === 'player') this.applyGear(e); else e.derived = computeDerived(e.attrs);
    if (keepGain) {
      e.hp += Math.max(0, e.derived.maxHp - old.maxHp);
      e.mana += Math.max(0, e.derived.maxMana - old.maxMana);
    }
    e.hp = Math.min(e.hp, e.derived.maxHp); e.mana = Math.min(e.mana, e.derived.maxMana);
    if (e.kind === 'player') this.applyPassives();
  }

  // stats dos equipamentos (só itens com durabilidade > 0)
  gearStats(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const sl of SLOTS) {
      const it = this.equipment[sl];
      if (!it || isBroken(it)) continue;
      for (const [k, v] of Object.entries(itemStats(it))) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  }

  private applyGear(e: Entity) {
    const g = this.gearStats(), eff = { ...e.attrs };
    for (const k of ATTR_KEYS) eff[k] += g[k] ?? 0;
    const d = computeDerived(eff);
    for (const k of ['maxHp', 'maxMana', 'physAtk', 'spiritAtk', 'physDef', 'spiritDef', 'hit', 'evasion', 'critChance', 'critDamage'] as const) d[k] += g[k] ?? 0;
    d.critChance = Math.min(0.95, d.critChance);
    e.derived = d;
    e.elemAtk = { ...emptyElements(), ...CLASSES[this.classId].elementAttack };
    for (const el of ELEMENTS) e.elemAtk[el] += g[`elem_${el}`] ?? 0;
  }

  // ---------- inventário ----------
  private bumpInv() { this.invVersion++; }

  sortBag() { this.bag = sortedBag(this.bag); this.bumpInv(); }

  freeSlots(): number { return this.bag.filter((b) => !b).length; }
  canFit(baseId: string, qty = 1): boolean {
    if (!isPotionId(baseId)) return this.freeSlots() >= 1;
    let room = this.freeSlots() * STACK_MAX;
    for (const b of this.bag) if (b && b.baseId === baseId) room += STACK_MAX - (b.qty ?? 1);
    return room >= qty;
  }
  // adiciona na mochila (potions empilham até 99). Sem eventos.
  addItem(item: ItemInstance): boolean {
    const qty = item.qty ?? 1;
    if (!this.canFit(item.baseId, qty)) return false;
    if (isPotionId(item.baseId)) {
      let rem = qty;
      for (const b of this.bag) {
        if (rem <= 0) break;
        if (b && b.baseId === item.baseId && (b.qty ?? 1) < STACK_MAX) { const a = Math.min(rem, STACK_MAX - (b.qty ?? 1)); b.qty = (b.qty ?? 1) + a; rem -= a; }
      }
      while (rem > 0) {
        const i = this.bag.findIndex((b) => !b), a = Math.min(rem, STACK_MAX);
        this.bag[i] = { ...item, uid: i === 0 && a === qty ? item.uid : makePotion(item.baseId).uid, qty: a }; rem -= a;
      }
    } else this.bag[this.bag.findIndex((b) => !b)] = item;
    this.bumpInv();
    return true;
  }
  potionCount(baseId: string): number { return this.bag.reduce((a, b) => a + (b && b.baseId === baseId ? (b.qty ?? 1) : 0), 0); }
  kindCount(kind: PotionKind): number { return Object.keys(POTIONS).filter((id) => POTIONS[id].kind === kind).reduce((a, id) => a + this.potionCount(id), 0); }

  private removeFromBag(i: number, qty = 1) {
    const b = this.bag[i];
    if (!b) return;
    if (b.qty && b.qty > qty) b.qty -= qty; else this.bag[i] = null;
    this.bumpInv();
  }

  private collect(item: ItemInstance, x: number, y: number) {
    this.auto.recordDrop(item);
    let placed = this.addItem(item);
    if (!placed && this.auto.sellingActive) { // auto-combate: mochila cheia vende o que a regra permite
      this.auto.makeRoom();
      placed = this.addItem(item);
      if (!placed && this.auto.sellable(item)) { this.sellValueNow(item); return; }
    }
    if (placed) {
      this.emit({ type: 'itemPickup', baseId: item.baseId, name: itemName(item), color: itemColor(item), qty: item.qty ?? 1, potion: isPotionId(item.baseId), rarity: item.rarity });
    } else {
      this.ground.push({ id: this.nextGround++, x, y, item, expires: this.time + GROUND_SECONDS });
      this.emit({ type: 'bagFull' });
    }
  }

  private tickGround() {
    if (!this.ground.length) return;
    const p = this.player;
    for (const g of [...this.ground]) {
      if (this.time >= g.expires) { this.ground = this.ground.filter((x) => x !== g); this.emit({ type: 'groundGone', id: g.id }); continue; }
      if (g.item && dist(g, p) < 0.9 && this.addItem(g.item)) {
        const it = g.item;
        this.ground = this.ground.filter((x) => x !== g);
        this.emit({ type: 'groundGone', id: g.id });
        this.emit({ type: 'itemPickup', baseId: it.baseId, name: itemName(it), color: itemColor(it), qty: it.qty ?? 1, potion: isPotionId(it.baseId), rarity: it.rarity });
      }
    }
  }

  private dropLoot(m: Entity, def: MonsterDef) {
    const L = def.loot;
    if (!L) return;
    const spot = () => ({ x: m.x + this.rng.range(-0.4, 0.4), y: m.y + this.rng.range(-0.4, 0.4) });
    if (L.gold) {
      const add = (L.gold.perLevel ?? 0) * (m.level - 1);
      const g = this.rng.int(Math.round(L.gold.min + add), Math.round(L.gold.max + add));
      if (g > 0) { this.gold += g; this.bumpInv(); this.emit({ type: 'drop', x: m.x, y: m.y, color: '#ffd23f' }); this.emit({ type: 'goldPickup', amount: g }); }
    }
    for (const pd of L.potions ?? []) {
      if (pd.minMonsterLevel && m.level < pd.minMonsterLevel) continue;
      if (this.rng.next() >= pd.chance) continue;
      const s = spot();
      this.emit({ type: 'drop', x: s.x, y: s.y, color: POTIONS[pd.id]?.color ?? '#fff' });
      this.collect(makePotion(pd.id, 1), s.x, s.y);
    }
    const sectOk = (id: string) => !BASES[id].sect || BASES[id].sect === this.classId;
    const give = (id: string, rarity: Rarity, ilvl = m.level) => {
      const it = makeEquipment(id, rarity, CLASSES[this.classId].element, this.rng, ilvl);
      const s = spot();
      this.emit({ type: 'drop', x: s.x, y: s.y, color: itemColor(it) });
      this.collect(it, s.x, s.y);
    };
    const eqs = L.equipment ? (Array.isArray(L.equipment) ? L.equipment : [L.equipment]) : [];
    for (const eq of eqs) {
      if (eq.minMonsterLevel && m.level < eq.minMonsterLevel) continue;
      if (this.rng.next() >= eq.chance) continue;
      const ids = equipmentBaseIds().filter((id) => BASES[id].reqLevel <= eq.maxReqLevel && BASES[id].reqLevel >= (eq.minReqLevel ?? 0) && sectOk(id));
      if (ids.length) give(ids[Math.min(ids.length - 1, Math.floor(this.rng.next() * ids.length))], rollRarity(this.rng));
    }
    if (L.guaranteed) { // 1 item garantido de slot aleatório (arma só da seita do jogador)
      const ids = equipmentBaseIds().filter((id) => BASES[id].reqLevel === L.guaranteed!.reqLevel && sectOk(id));
      if (ids.length) give(ids[Math.min(ids.length - 1, Math.floor(this.rng.next() * ids.length))], L.guaranteed.rarity, L.guaranteed.reqLevel);
    }
  }

  // retorna mensagem de erro (PT-BR) ou null se deu certo
  canEquip(it: ItemInstance): string | null {
    const b = baseOf(it);
    if (!b) return L('Este item não é equipável', 'This item cannot be equipped');
    if (this.player.level < b.reqLevel) return L(`Requer nível ${b.reqLevel}`, `Requires level ${b.reqLevel}`);
    if (b.sect && b.sect !== this.classId) return L(`Apenas para ${CLASSES[b.sect]?.name ?? b.sect}`, `Only for ${CLASSES[b.sect]?.name ?? b.sect}`);
    return null;
  }
  equip(bagIndex: number): string | null {
    const it = this.bag[bagIndex];
    if (!it) return null;
    const err = this.canEquip(it);
    if (err) return err;
    const slot = BASES[it.baseId].slot;
    this.bag[bagIndex] = this.equipment[slot];
    this.equipment[slot] = it;
    this.afterEquip();
    return null;
  }
  unequip(slot: Slot): string | null {
    const it = this.equipment[slot];
    if (!it) return null;
    const i = this.bag.findIndex((b) => !b);
    if (i < 0) return L('Mochila cheia', 'Bag full');
    this.bag[i] = it; this.equipment[slot] = null;
    this.afterEquip();
    return null;
  }
  private afterEquip() {
    this.recalc(this.player, false);
    this.bumpInv();
    this.emit({ type: 'equipChange' });
  }

  // ---------- poções ----------
  usePotion(kind: PotionKind, baseId?: string): boolean {
    const p = this.player;
    if (p.dead) return false;
    if (this.potionCd[kind] > 0) { this.emit({ type: 'potionFail', kind, reason: 'cooldown' }); return false; }
    const ids = baseId ? [baseId] : Object.keys(POTIONS).filter((id) => POTIONS[id].kind === kind);
    const id = ids.find((x) => POTIONS[x]?.kind === kind && this.potionCount(x) > 0);
    if (!id) { this.emit({ type: 'potionFail', kind, reason: 'none' }); return false; }
    const full = kind === 'hp' ? p.hp >= p.derived.maxHp - 0.01 : p.mana >= p.derived.maxMana - 0.01;
    if (full) { this.emit({ type: 'potionFail', kind, reason: 'full' }); return false; }
    const d = POTIONS[id];
    this.removeFromBag(this.bag.findIndex((b) => b && b.baseId === id));
    const max = kind === 'hp' ? p.derived.maxHp : p.derived.maxMana;
    this.potionFx[kind] = { id, remaining: d.duration, rate: (max * d.percent) / d.duration }; // reinicia o efeito
    this.potionCd[kind] = d.cooldown;
    this.emit({ type: 'potionUsed', id, kind });
    return true;
  }

  private tickPotions(dt: number) {
    const p = this.player;
    for (const kind of ['hp', 'mp'] as PotionKind[]) {
      const fx = this.potionFx[kind];
      if (!fx) continue;
      const step = Math.min(dt, fx.remaining), amt = fx.rate * step;
      if (kind === 'hp') p.hp = Math.min(p.derived.maxHp, p.hp + amt); else p.mana = Math.min(p.derived.maxMana, p.mana + amt);
      fx.remaining -= dt;
      if (fx.remaining <= 0) this.potionFx[kind] = null;
    }
  }

  // ---------- NPCs ----------
  interactNpc(entityId: number) {
    const n = this.npcs.find((e) => e.id === entityId);
    if (!n || this.player.dead) return;
    this.auto.manualMove();
    this.pendingSkill = null; this.chasing = false; this.autoAttack = false; this.targetId = null;
    this.moveInput = { x: 0, y: 0 }; this.player.path = [];
    this.npcGoal = entityId;
  }
  npcRole(n: Entity | null = this.openNpc): string { return n ? NPC_ROLES[n.name] ?? '' : ''; }
  private openNpcWindow(n: Entity) {
    if (this.openNpc === n) return;
    this.openNpc = n;
    this.emit({ type: 'npcOpen', npcId: this.npcRole(n), entityId: n.id });
  }
  closeNpc() {
    if (!this.openNpc) return;
    this.openNpc = null;
    this.emit({ type: 'npcClose' });
  }

  buy(potionId: string, qty: number): string | null {
    if (this.npcRole() !== 'vendedor') return L('Fale com o vendedor', 'Talk to the seller');
    return this.purchase(potionId, qty);
  }
  // compra sem exigir a janela do NPC aberta (usado pelo auto-combate ao chegar no vendedor)
  purchase(potionId: string, qty: number): string | null {
    if (!POTIONS[potionId] || qty < 1) return null;
    const cost = buyPrice(potionId) * qty;
    if (this.gold < cost) return L('Ouro insuficiente', 'Not enough gold');
    if (!this.canFit(potionId, qty)) return L('Mochila cheia', 'Bag full');
    this.gold -= cost;
    this.addItem(makePotion(potionId, qty));
    this.emit({ type: 'trade', kind: 'buy', gold: cost });
    return null;
  }
  sell(bagIndex: number, qty = 1): string | null {
    if (this.npcRole() !== 'vendedor') return L('Fale com o vendedor', 'Talk to the seller');
    this.sellRaw(bagIndex, qty);
    return null;
  }
  // venda instantânea pelo preço do vendedor (auto-combate / ganho offline)
  sellRaw(bagIndex: number, qty = 1): number {
    const it = this.bag[bagIndex];
    if (!it) return 0;
    const n = Math.max(1, Math.min(qty, it.qty ?? 1)), gold = sellValue(it) * n;
    this.removeFromBag(bagIndex, n);
    this.gold += gold; this.bumpInv();
    this.emit({ type: 'trade', kind: 'sell', gold });
    return gold;
  }
  // vende um item que nem chegou a entrar na mochila
  sellValueNow(it: ItemInstance): number {
    const gold = sellValue(it) * (it.qty ?? 1);
    this.gold += gold; this.bumpInv();
    this.emit({ type: 'trade', kind: 'sell', gold });
    return gold;
  }

  // ---------- ganho offline ----------
  private applyOffline(now: number, lastSeen: number, saved: SaveData['auto']): OfflineReport | null {
    if (!saved?.active || !saved.mapId || TOWN_MAPS.has(saved.mapId) || !this.maps[saved.mapId]) return null;
    const rate = this.auto.rate();
    if (!rate) return null;
    const elapsedMs = Math.max(0, now - (Number(lastSeen) || now)); // relógio adulterado: negativo vira 0
    const res: OfflineResult = computeOffline({
      elapsedMs, rate, level: this.player.level, xp: this.xp,
      potions: { hp: this.kindCount('hp'), mp: this.kindCount('mp') }, seed: (now ^ Math.floor(this.xp * 7919)) >>> 0,
    });
    if (res.kills < 1) return null;
    const lvl0 = this.player.level;
    this.gold += res.gold;
    this.gainXp(res.xp);
    const items: OfflineReport['items'] = [];
    let soldCount = 0, soldGold = 0;
    const sell = (it: ItemInstance) => { soldCount += it.qty ?? 1; soldGold += this.sellValueNow(it); };
    for (const d of res.drops) {
      const isPot = isPotionId(d.baseId);
      for (let i = 0; i < (isPot ? 1 : d.qty); i++) {
        const it = isPot ? makePotion(d.baseId, d.qty) : makeEquipment(d.baseId, d.rarity, CLASSES[this.classId].element, this.rng, rate.monLevel);
        let placed = this.addItem(it);
        if (!placed) { this.auto.makeRoom(); placed = this.addItem(it); }
        if (!placed) { sell(it); continue; }
        const e = items.find((x) => x.name === itemName(it) && x.rarity === it.rarity);
        if (e) e.qty += it.qty ?? 1; else items.push({ name: itemName(it), color: itemColor(it), rarity: it.rarity, qty: it.qty ?? 1 });
      }
    }
    const used: Record<PotionKind, number> = { hp: 0, mp: 0 };
    for (const k of ['hp', 'mp'] as PotionKind[]) {
      for (let n = res.potionsUsed[k]; n > 0; n--) {
        const i = this.bag.findIndex((b) => b && POTIONS[b.baseId]?.kind === k);
        if (i < 0) break;
        this.removeFromBag(i); used[k]++;
      }
    }
    this.player.hp = this.player.derived.maxHp; this.player.mana = this.player.derived.maxMana;
    this.events.length = 0; // sem toasts de nível/skill atrás do resumo
    return { elapsedMs, effMin: res.effMin, efficiency: res.efficiency, kills: res.kills, xp: res.xp, levelsGained: this.player.level - lvl0, newLevel: this.player.level,
      gold: res.gold, items, potionsUsed: used, soldCount, soldGold };
  }
  private repairTargets(): ItemInstance[] {
    return [...SLOTS.map((s) => this.equipment[s]), ...this.bag].filter((i): i is ItemInstance => !!i && !!BASES[i.baseId]);
  }
  repair(it: ItemInstance): string | null {
    if (this.npcRole() !== 'ferreiro') return L('Fale com o ferreiro', 'Talk to the blacksmith');
    const cost = repairCost(it);
    if (cost <= 0) return null;
    if (this.gold < cost) return L('Ouro insuficiente', 'Not enough gold');
    this.gold -= cost; it.durability = maxDurability(it);
    this.recalc(this.player, false); this.bumpInv();
    this.emit({ type: 'repair', gold: cost });
    return null;
  }
  repairAllCost(): number { return this.repairTargets().reduce((a, i) => a + repairCost(i), 0); }
  repairAll(): string | null {
    if (this.npcRole() !== 'ferreiro') return L('Fale com o ferreiro', 'Talk to the blacksmith');
    const cost = this.repairAllCost();
    if (cost <= 0) return null;
    if (this.gold < cost) return L('Ouro insuficiente', 'Not enough gold');
    this.gold -= cost;
    for (const i of this.repairTargets()) i.durability = maxDurability(i);
    this.recalc(this.player, false); this.bumpInv();
    this.emit({ type: 'repair', gold: cost });
    return null;
  }
  lowDurability(): boolean {
    return SLOTS.some((s) => { const i = this.equipment[s]; return !!i && i.durability <= maxDurability(i) * 0.2; });
  }

  // ---------- mapa / entidades ----------
  changeMap(mapId: string, x?: number, y?: number) {
    this.mapId = mapId; this.map = this.maps[mapId];
    const sp = this.map.objects.find((o) => o.type === 'spawn');
    const p = this.player;
    p.x = x ?? sp?.x ?? 1.5; p.y = y ?? sp?.y ?? 1.5; p.path = [];
    this.moveInput = { x: 0, y: 0 };
    this.targetId = null; this.autoAttack = false; this.pendingSkill = null; this.portalCd = 1;
    this.monsters = []; this.npcs = []; this.ground = []; this.openNpc = null; this.npcGoal = null;
    this.telegraphs = []; this.arenas = []; this.bossSummoned = false; this.arenaSeen = false;
    if (this.bossRespawnAtMs && this.bossRespawnAtMs <= this.clock()) this.bossRespawnAtMs = 0;
    for (const o of this.map.objects) {
      if (o.type === 'monsterSpawn') {
        const def = MONSTERS[String(o.props.monster)];
        if (!def) continue;
        const m = this.makeMonster(def, { x: o.x, y: o.y });
        m.group = Number(o.props.group) || 0;
        this.monsters.push(m);
        if (def.boss) {
          this.arenas.push({ x: o.x, y: o.y, r: def.boss.arenaRadius });
          if (this.bossRespawnAtMs > this.clock()) { m.dead = true; m.hp = 0; m.respawnAt = this.time + (this.bossRespawnAtMs - this.clock()) / 1000; }
        }
      } else if (o.type === 'npc') {
        this.npcs.push({ ...this.blank('npc', o.name, 1), x: o.x, y: o.y });
      }
    }
    this.emit({ type: 'mapChange', mapId });
  }

  private blank(kind: Entity['kind'], name: string, level: number): Entity {
    const attrs: Attributes = { strength: 1, intelligence: 1, stamina: 1, agility: 1, willpower: 1 };
    return {
      id: this.nextId++, kind, name, level, x: 0, y: 0, hp: 1, mana: 0, dead: false, attrs,
      derived: computeDerived(attrs), elemAtk: emptyElements(), elemRes: emptyElements(),
      damageType: 'physical', element: null, attackRange: 1, attackWhileMoving: false, attackInterval: 1, attackCd: 0, moveSpeed: 3,
      path: [], repathCd: 0, monsterId: '', home: { x: 0, y: 0 }, ai: 'idle', aiTimer: 0, respawnAt: 0, buffs: [], group: 0, summoned: false,
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
    if (def.defMul) { e.derived.physDef *= def.defMul.phys; e.derived.spiritDef *= def.defMul.spirit; }
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
    if (def.boss) { this.bossRespawnAtMs = 0; this.resetBoss(m); }
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
