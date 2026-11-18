import { CLASSES, MONSTERS, NPC_TEXT, PROGRESSION, type MonsterDef } from './data';
import { tn } from './i18n';
import { distributeByRatio } from './distribute';
import { expectedDamage, rollAttack, type AttackResult } from './combat';
import { screenToTile } from './iso';
import type { GameMap } from './map';
import { findPath, insideAvoid, isWalkable, type Avoid } from './pathfinding';
import {
  GLOBAL_COOLDOWN,
  SKILLS,
  SKILL_MAX_LEVEL,
  classActives,
  skillScale,
  skillXpToNext,
  type PassiveBonus,
  type SkillDef,
  type SkillState,
} from './skills';
import { BAG_SIZE, SLOTS, STARTING_KIT, STARTING_WEAPON, makeEquipment, makePotion, maxDurability } from './items';
import { AutoCombat } from './auto';
import { HOME_MAP, TOWN_MAPS } from './mapsConfig';
import { Rng } from './rng';
import * as saveCodec from './world/saveCodec';
import * as offlineApply from './world/offlineApply';
import { RESUME_OFFLINE_MIN_MS } from './offline';
import * as npcs from './world/npcs';
import * as boss from './world/boss';
import * as quests from './world/quests';
import * as shop from './world/shop';
import { dist } from './world/geometry';
import * as inventory from './world/inventory';
import { type QuestDef, type QuestPhase, type QuestState } from './quests';
import { computeDerived, emptyElements } from './stats';
import {
  ATTR_KEYS,
  ELEMENTS,
  type AttrKey,
  type ActionError,
  type Attributes,
  type BuffKind,
  type Entity,
  type GameEvent,
  type GroundItem,
  type ItemInstance,
  type Point,
  type PotionKind,
  type Rarity,
  type SaveData,
  type SkillFailReason,
  type Slot,
  type Telegraph,
} from './types';

export const STEP = 1 / 60;
const TARGET_RANGE = 14;

const TOWN_REGEN = 0.03; // 3% por segundo
const POISON_TICK = 1; // segundos entre os tiques de veneno
const DASH_STOP = 1.0; // distância final do Passo do Raio até o alvo
const NPC_REACH = 1.8; // distância para abrir a janela do NPC
const NPC_LEAVE = 3; // janela fecha ao se afastar mais que isso
const DEATH_DURABILITY_LOSS = 0.1;
const NPC_WALK_SPEED = 1.3; // moradores andando pela cidade
export interface PotionFx {
  id: string;
  remaining: number;
  rate: number;
}
export interface OfflineReport {
  elapsedMs: number;
  effMin: number;
  efficiency: number;
  kills: number;
  xp: number;
  levelsGained: number;
  newLevel: number;
  gold: number;
  items: { name: string; color: string; rarity: Rarity; qty: number }[];
  potionsUsed: Record<PotionKind, number>;
  soldCount: number;
  soldGold: number;
}

export class World {
  mapId = HOME_MAP;
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
  equipment: Record<Slot, ItemInstance | null> = {
    colar: null,
    tronco: null,
    arma: null,
    cabeca: null,
    calca: null,
    bota: null,
  };
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
  // monstros comuns mortos: "mapa#índice" → ms (relógio real) do renascimento; conta mesmo fora do mapa
  respawnAtMs: Record<string, number> = {};
  clock: () => number = () => Date.now();
  quest: QuestState = { stage: 0, status: 'pending', progress: 0 }; // missão atual da cadeia (marco 7)
  autoAttack = false;

  // ---- estado interno: usado só pelo World e pelos módulos de src/core/world/ (a interface não mexe) ----
  bossSummoned = false;
  nextTelegraph = 1;
  npcGoal: number | null = null;
  nextGround = 1;
  pendingSkill: number | null = null;
  chasing = false;
  moveInput: Point = { x: 0, y: 0 };
  lastDamaged = -99;
  rng = new Rng((Date.now() & 0xffffffff) >>> 0);
  npcRng = new Rng(7); // só para os moradores andarem (não mexe no sorteio do combate)

  // ---- privados do World
  private arenaSeen = false;
  private respawnTimer = 0;
  private portalCd = 0;
  private acc = 0;
  private nextId = 2;

  private constructor(
    readonly maps: Record<string, GameMap>,
    name: string,
    classId: string,
    level: number,
    attrs: Attributes,
  ) {
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
    w.player.hp = w.player.derived.maxHp;
    w.player.mana = w.player.derived.maxMana;
    w.changeMap(HOME_MAP);
    for (const s of SKILLS[classId] ?? []) if (s.unlock <= 1) w.events.push({ type: 'skillUnlocked', skillId: s.id });
    return w;
  }

  // offline=false: não aplica ganho offline (só o último personagem jogado recebe)
  static fromSave(maps: Record<string, GameMap>, s: SaveData, now = Date.now(), offline = true): World {
    const w = new World(maps, s.name, s.classId, s.level, { ...s.attributes });
    saveCodec.restore(w, s, now);
    w.offlineReport = offline ? w.applyOffline(now, s.lastSeen, s.auto) : null;
    return w;
  }

  // ---------- saveCodec: src/core/world/saveCodec.ts ----------
  serialize(): SaveData {
    return saveCodec.serialize(this);
  }

  emit(ev: GameEvent) {
    this.events.push(ev);
    this.auto.observe(ev);
  }

  // ---------- comandos ----------
  // andar do auto-combate (não pausa o auto)
  autoMove(x: number, y: number, viaPortal = false) {
    if (!this.player.dead) this.player.path = this.findPathFor(this.player, { x, y }, viaPortal);
  }
  // o auto-combate nunca entra na área do chefe e só atravessa portais de propósito (viaPortal)
  private findPathFor(from: Point, to: Point, viaPortal = false): Point[] {
    if (this.auto.state !== 'on') return findPath(this.map, from, to);
    const avoid: Avoid[] = this.arenas.map((a) => ({ ...a, r: a.r + 1.5 }));
    // só os tiles do próprio portal (antes era um círculo largo em volta: monstro parado ali ficava inalcançável)
    if (!viaPortal)
      for (const o of this.map.objects) if (o.type === 'portal') avoid.push({ x: o.x, y: o.y, w: o.w, h: o.h, r: 0 });
    return findPath(this.map, from, to, avoid.length ? avoid : undefined);
  }
  // comprimento do caminho até o ponto (Infinity se inalcançável); usado pelo auto para escolher o alvo "mais perto" de verdade
  /** Caminho do jogador até `to` (lista de pontos; vazia = sem caminho ou já está lá). */
  pathFromPlayer(to: Point): Point[] {
    return this.findPathFor(this.player, to);
  }
  pathLength(to: Point): number {
    const path = this.findPathFor(this.player, to);
    if (!path.length) return dist(this.player, to) < 1 ? 0 : Infinity;
    let len = 0,
      a: Point = this.player;
    for (const q of path) {
      len += dist(a, q);
      a = q;
    }
    return len;
  }
  inArena(pt: Point, margin = 0): boolean {
    return this.arenas.some((a) => dist(a, pt) <= a.r + margin);
  }

  moveTo(x: number, y: number) {
    if (this.player.dead) return;
    this.auto.manualMove();
    if (!this.player.attackWhileMoving) this.autoAttack = false;
    this.pendingSkill = null;
    this.npcGoal = null;
    this.chasing = false;
    this.moveInput = { x: 0, y: 0 };
    this.player.path = findPath(this.map, this.player, { x, y });
  }

  // vetor em espaço de tela (joystick); convertido para tiles
  setMoveInput(sx: number, sy: number) {
    const t = screenToTile(sx, sy),
      l = Math.hypot(t.x, t.y);
    this.moveInput = l < 0.001 ? { x: 0, y: 0 } : { x: t.x / l, y: t.y / l };
    if (l >= 0.001) {
      this.npcGoal = null;
      this.auto.manualMove();
    }
  }

  setTarget(id: number | null) {
    if (id === null) {
      this.targetId = null;
      this.autoAttack = false;
      this.pendingSkill = null;
      return;
    }
    const m = this.monsters.find((e) => e.id === id);
    if (!m || m.dead) return;
    this.npcGoal = null;
    if (this.targetId !== id) this.pendingSkill = null;
    this.targetId = id;
    this.autoAttack = true;
  }

  getTarget(): Entity | null {
    const t = this.monsters.find((m) => m.id === this.targetId);
    return t && !t.dead ? t : null;
  }

  private nearbyMonsters(): Entity[] {
    return this.monsters
      .filter((m) => !m.dead && dist(m, this.player) <= TARGET_RANGE)
      .sort((a, b) => dist(a, this.player) - dist(b, this.player));
  }

  cycleTarget() {
    const c = this.nearbyMonsters();
    if (!c.length) return;
    const i = c.findIndex((m) => m.id === this.targetId);
    this.setTarget(c[(i + 1) % c.length].id);
  }

  attackNearest() {
    if (this.getTarget()) {
      this.autoAttack = true;
      return;
    }
    const c = this.nearbyMonsters();
    if (c.length) this.setTarget(c[0].id);
  }

  spendPoint(k: AttrKey) {
    if (this.freePoints <= 0) return;
    this.freePoints--;
    this.player.attrs[k]++;
    this.recalc(this.player, true);
  }

  distributeRecommended() {
    if (this.freePoints <= 0) return;
    const r = distributeByRatio(this.freePoints, CLASSES[this.classId].recommendedRatio ?? {}, this.ratioCursor);
    if (!r.spent) return;
    for (const k of ATTR_KEYS) this.player.attrs[k] += r.added[k];
    this.freePoints -= r.spent;
    this.ratioCursor = r.cursor;
    this.recalc(this.player, true);
  }

  // ---------- skills ----------
  classSkills(): SkillDef[] {
    return SKILLS[this.classId] ?? [];
  }
  activeSkills(): SkillDef[] {
    return classActives(this.classId);
  }
  isUnlocked(def: SkillDef) {
    return this.player.level >= def.unlock;
  }
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
  passiveValue(key: keyof PassiveBonus): number {
    let v = 0;
    for (const d of this.classSkills()) {
      const base = d.type === 'passive' ? d.passive?.[key] : undefined;
      if (base && this.isUnlocked(d)) v += base * skillScale(this.skillLevel(d));
    }
    return v;
  }

  hasBuff(e: Entity, kind: BuffKind) {
    return e.buffs.some((b) => b.kind === kind);
  }
  addBuff(e: Entity, id: string, kind: BuffKind, value: number, duration: number) {
    const old = e.buffs.find((b) => b.id === id && b.kind === kind);
    if (old) {
      old.value = value;
      old.remaining = old.duration = duration;
    } else e.buffs.push({ id, kind, value, remaining: duration, duration });
    this.emit({ type: 'buffApplied', targetId: e.id, id, kind, duration });
  }
  private tickBuffs(e: Entity, dt: number) {
    if (!e.buffs.length) return;
    for (const b of e.buffs) {
      b.remaining -= dt;
      if (b.kind === 'regen' && !e.dead) e.hp = Math.min(e.derived.maxHp, e.hp + b.value * dt);
      if (b.kind === 'poison' && !e.dead) {
        b.tick = (b.tick ?? POISON_TICK) - dt;
        if (b.tick <= 0) {
          b.tick += POISON_TICK;
          this.poisonTick(e, b.value * POISON_TICK);
        }
      }
    }
    const gone = e.buffs.filter((b) => b.remaining <= 0 || (b.kind === 'shield' && b.value <= 0));
    if (!gone.length) return;
    e.buffs = e.buffs.filter((b) => !gone.includes(b));
    for (const b of gone) this.emit({ type: 'buffExpired', targetId: e.id, id: b.id, kind: b.kind });
  }
  /** Um tique de veneno: dano direto (sem acerto/erro nem defesa; já foi calculado ao aplicar). */
  private poisonTick(e: Entity, amount: number) {
    const dealt = Math.max(1, Math.round(amount));
    e.hp -= dealt;
    this.emit({
      type: 'hit',
      targetId: e.id,
      targetKind: e.kind,
      x: e.x,
      y: e.y,
      amount: dealt,
      crit: false,
      poison: true,
    });
    if (e.kind === 'monster' && e.hp <= 0) this.killMonster(e);
  }
  isStunned(e: Entity) {
    return e.buffs.some((b) => b.kind === 'stun');
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
  /** Interno: usado pelos módulos de src/core/world/. */
  absorb(e: Entity, amount: number): number {
    let rem = amount;
    for (const b of e.buffs) {
      if (b.kind !== 'shield' || rem <= 0) continue;
      const a = Math.min(b.value, rem);
      b.value -= a;
      rem -= a;
    }
    if (rem < amount) this.emit({ type: 'shieldAbsorb', targetId: e.id, amount: amount - rem, x: e.x, y: e.y });
    return rem;
  }

  skillReach(def: SkillDef): number {
    return def.range === 'melee' ? this.player.attackRange : (def.range ?? 0);
  }

  private fail(def: SkillDef, reason: SkillFailReason) {
    this.emit({ type: 'skillFail', skillId: def.id, reason });
  }

  useSkill(slot: number) {
    const p = this.player,
      def = this.activeSkills()[slot];
    if (!def || p.dead) return;
    if (!this.isUnlocked(def)) return this.fail(def, 'locked');
    const st = this.skills[def.id];
    if (st.cd > 0 || this.gcd > 0) return this.fail(def, 'cooldown');
    if (p.mana < (def.mana ?? 0)) return this.fail(def, 'mana');
    if (def.target === 'none') {
      this.castSkill(def, null);
      return;
    }
    const t = this.getTarget();
    if (def.area) {
      // skill de área nunca exige alvo: no alvo se estiver no alcance, senão em volta do personagem
      this.pendingSkill = null;
      this.castSkill(def, t && dist(p, t) <= this.skillReach(def) ? t : null);
      return;
    }
    if (!t) return this.fail(def, 'notarget');
    if (dist(p, t) <= this.skillReach(def)) {
      this.pendingSkill = null;
      this.castSkill(def, t);
      return;
    }
    this.pendingSkill = slot; // anda até o alvo e lança em seguida
  }

  // retorna true se está andando até o alvo (consome o movimento do tick)
  private tickPending(dt: number, t: Entity | null, moving: boolean): boolean {
    const p = this.player,
      def = this.pendingSkill === null ? undefined : this.activeSkills()[this.pendingSkill];
    if (!def || !t) {
      this.pendingSkill = null;
      return false;
    }
    if (dist(p, t) <= this.skillReach(def)) {
      if (this.gcd > 0 || this.skills[def.id].cd > 0) return false;
      this.pendingSkill = null;
      if (p.mana < (def.mana ?? 0)) this.fail(def, 'mana');
      else this.castSkill(def, t);
      return false;
    }
    if (moving) {
      if (!p.attackWhileMoving) this.pendingSkill = null;
      return false;
    }
    p.repathCd -= dt;
    if (p.repathCd <= 0 || !p.path.length) {
      p.repathCd = 0.3;
      p.path = this.findPathFor(p, t);
    }
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
    const p = this.player,
      st = this.skills[def.id],
      scale = skillScale(st.level);
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
    st.cd = def.cooldown ?? 0;
    this.gcd = GLOBAL_COOLDOWN;
    p.attackCd = Math.max(p.attackCd, 0.3);
    this.emit({
      type: 'skillCast',
      skillId: def.id,
      casterId: p.id,
      x: p.x,
      y: p.y,
      targetId: t?.id ?? null,
      tx: (t ?? p).x,
      ty: (t ?? p).y,
      ranged: p.attackRange > 3,
    });
    if (dest) {
      this.emit({ type: 'dash', fromX: p.x, fromY: p.y, toX: dest.x, toY: dest.y });
      p.x = dest.x;
      p.y = dest.y;
      p.path = [];
    }
    for (const v of victims) {
      if (!def.hits?.length) {
        // sem golpe (Névoa Tóxica): os efeitos pegam em todos da área, sem rolar acerto
        this.applyOnHit(def, v, scale);
        if (!v.dead && v.ai !== 'return') this.aggro(v);
        continue;
      }
      for (const pct of def.hits) {
        if (v.dead) break;
        const r = this.attack(p, v, pct * scale, true);
        if (r.hit && !v.dead) this.applyOnHit(def, v, scale);
      }
    }
    if (def.shield)
      this.addBuff(p, def.id, 'shield', p.derived.maxHp * def.shield.percent * scale, def.shield.duration);
    if (def.heal)
      this.addBuff(
        p,
        def.id,
        'regen',
        (p.derived.maxHp * def.heal.percent * scale) / def.heal.duration,
        def.heal.duration,
      );
    if (victims.length || def.shield || def.heal) this.gainSkillXp(def, st); // sem acertar ninguém não ganha xp (evita treinar skill no vazio)
  }

  /** Efeitos de uma skill num alvo atingido: enfraquecer/lentidão, veneno e atordoar. */
  private applyOnHit(def: SkillDef, v: Entity, scale: number) {
    if (v.dead) return;
    if (def.debuff) this.addBuff(v, def.id, def.debuff.kind, def.debuff.value, def.debuff.duration);
    if (def.poison) {
      const total = expectedDamage(this.player, this.defender(v)) * def.poison.percent * scale;
      this.addBuff(v, def.id, 'poison', total / def.poison.duration, def.poison.duration);
    }
    if (def.stun) this.addBuff(v, def.id, 'stun', 0, def.stun);
  }

  private gainSkillXp(def: SkillDef, st: SkillState) {
    if (st.level >= SKILL_MAX_LEVEL) return;
    st.xp++;
    for (
      let need = skillXpToNext(st.level);
      st.level < SKILL_MAX_LEVEL && st.xp >= need;
      need = skillXpToNext(st.level)
    ) {
      st.xp -= need;
      st.level++;
      this.emit({ type: 'skillLevelUp', skillId: def.id, level: st.level });
    }
    if (st.level >= SKILL_MAX_LEVEL) st.xp = 0;
  }

  private applyPassives() {
    const p = this.player;
    p.derived = { ...p.derived, critChance: Math.min(0.95, p.derived.critChance + this.passiveValue('crit')) };
    p.attackInterval = CLASSES[this.classId].attackInterval / (1 + this.passiveValue('attackSpeed'));
    const hpBonus = this.passiveValue('maxHp');
    if (hpBonus) {
      p.derived = { ...p.derived, maxHp: Math.round(p.derived.maxHp * (1 + hpBonus)) };
      p.hp = Math.min(p.hp, p.derived.maxHp);
    }
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
    this.closeNpc();
    this.npcGoal = null;
    if (lost) {
      this.recalc(this.player, false);
      this.invVersion++;
      this.emit({ type: 'durabilityLost' });
    }
  }

  // ---------- simulação ----------
  advance(dt: number) {
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= STEP) {
      this.tick(STEP);
      this.acc -= STEP;
    }
  }

  tick(dt: number) {
    this.time += dt;
    this.gcd = Math.max(0, this.gcd - dt);
    for (const st of Object.values(this.skills)) st.cd = Math.max(0, st.cd - dt);
    this.tickBuffs(this.player, dt);
    for (const m of this.monsters) this.tickBuffs(m, dt);
    this.portalCd = Math.max(0, this.portalCd - dt);
    this.potionCd.hp = Math.max(0, this.potionCd.hp - dt);
    this.potionCd.mp = Math.max(0, this.potionCd.mp - dt);
    if (!this.player.dead) {
      this.tickPotions(dt);
      this.tickGround();
    }
    if (this.openNpc && (this.player.dead || dist(this.openNpc, this.player) > NPC_LEAVE)) this.closeNpc();
    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    } else {
      this.auto.tick(dt);
      this.tickPlayer(dt);
      this.checkPortals();
      if (this.arenas.length && !this.arenaSeen && this.inArena(this.player)) {
        this.arenaSeen = true;
        this.emit({ type: 'bossArena' });
      }
    }
    for (const m of this.monsters) this.tickMonster(m, dt);
    for (const n of this.npcs) if (n.wander > 0) this.tickWalker(n, dt);
    this.tickTelegraphs(dt);
  }

  private tickPlayer(dt: number) {
    const p = this.player,
      d = p.derived;
    p.attackCd = Math.max(0, p.attackCd - dt);
    // HP e mana só regeneram na cidade
    if (TOWN_MAPS.has(this.mapId) && this.time - this.lastDamaged > 5) {
      p.hp = Math.min(d.maxHp, p.hp + d.maxHp * TOWN_REGEN * dt);
      p.mana = Math.min(d.maxMana, p.mana + d.maxMana * TOWN_REGEN * dt);
    } else if (!TOWN_MAPS.has(this.mapId)) {
      p.mana = Math.min(d.maxMana, p.mana + d.maxMana * this.passiveValue('manaRegen') * dt);
    }
    const t = this.getTarget();
    if (this.targetId !== null && !t) {
      this.targetId = null;
      this.autoAttack = false;
    }
    const mi = this.moveInput,
      moving = !!(mi.x || mi.y);
    if (this.pendingSkill !== null && this.tickPending(dt, t, moving || (p.attackWhileMoving && p.path.length > 0)))
      return;
    if (this.npcGoal !== null) {
      const n = this.npcs.find((e) => e.id === this.npcGoal);
      if (!n || moving) this.npcGoal = null;
      else {
        if (dist(p, n) <= NPC_REACH) {
          p.path = [];
          this.npcGoal = null;
          this.openNpcWindow(n);
          return;
        }
        p.repathCd -= dt;
        if (p.repathCd <= 0 || !p.path.length) {
          p.repathCd = 0.3;
          p.path = this.findPathFor(p, n);
        }
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
        if (p.attackCd <= 0) {
          p.attackCd = p.attackInterval;
          this.attack(p, t);
        }
        return;
      }
      p.repathCd -= dt;
      if (p.repathCd <= 0 || !p.path.length) {
        p.repathCd = 0.3;
        p.path = this.findPathFor(p, t);
      }
      this.chasing = true;
    }
    this.followPath(p, dt, 1);
  }

  private attackIfInRange(p: Entity, t: Entity) {
    if (p.attackCd <= 0 && dist(p, t) <= p.attackRange) {
      p.attackCd = p.attackInterval;
      this.attack(p, t);
    }
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
    const def = MONSTERS[m.monsterId],
      p = this.player;
    if (m.dead) {
      if (this.time >= m.respawnAt) this.respawn(m, def);
      return;
    }
    m.attackCd = Math.max(0, m.attackCd - dt);
    if (this.isStunned(m)) return; // atordoado (Titã): não anda nem ataca
    const pd = p.dead ? Infinity : dist(m, p);
    const boss = def.boss;
    if (boss) this.tickBossExtras(m, def, dt);
    const wake = !boss || (!p.dead && dist(p, m.home) <= boss.arenaRadius); // chefe só acorda com o jogador na arena
    if (m.ai === 'idle') {
      if (pd < def.aggroRange && wake) {
        this.aggro(m);
        return;
      }
      m.aiTimer -= dt;
      if (m.aiTimer <= 0 && !boss) {
        const a = this.rng.range(0, Math.PI * 2),
          r = this.rng.range(1, 3.5);
        const w = { x: m.home.x + Math.cos(a) * r, y: m.home.y + Math.sin(a) * r };
        if (isWalkable(this.map, w.x, w.y) && !this.nearPortal(w)) {
          m.path = [w];
          m.ai = 'wander';
        } else m.aiTimer = 1;
      }
    } else if (m.ai === 'wander') {
      if (pd < def.aggroRange) {
        this.aggro(m);
        return;
      }
      this.followPath(m, dt, 0.5);
      if (!m.path.length) {
        m.ai = 'idle';
        m.aiTimer = this.rng.range(2, 5);
      }
    } else if (m.ai === 'chase') {
      if (p.dead || dist(m, m.home) > def.leashRange || (boss && !wake)) {
        m.ai = 'return';
        m.path = findPath(this.map, m, m.home);
        return;
      }
      if (def.keepDistance && pd < def.keepDistance && dist(m, m.home) < def.leashRange * 0.8) {
        // arqueiro: recua um pouco mantendo distância e continua atirando
        m.path = [];
        this.step(
          m,
          (m.x - p.x) / Math.max(0.01, pd),
          (m.y - p.y) / Math.max(0.01, pd),
          m.moveSpeed * 0.9 * this.speedMul(m) * dt,
        );
        if (m.attackCd <= 0 && pd <= m.attackRange) {
          m.attackCd = m.attackInterval;
          this.attack(m, p);
        }
      } else if (pd <= m.attackRange) {
        m.path = [];
        if (m.attackCd <= 0) {
          m.attackCd = m.attackInterval;
          this.attack(m, p);
        }
      } else {
        m.repathCd -= dt;
        if (m.repathCd <= 0 || !m.path.length) {
          m.repathCd = 0.4;
          m.path = findPath(this.map, m, p);
        }
        this.followPath(m, dt, 1);
      }
    } else {
      m.hp = Math.min(m.derived.maxHp, m.hp + m.derived.maxHp * 0.25 * dt);
      this.followPath(m, dt, 1.3);
      if (!m.path.length || dist(m, m.home) < 0.3) {
        m.path = [];
        m.ai = 'idle';
        m.aiTimer = 1;
        m.hp = m.derived.maxHp;
        if (boss) this.resetBoss(m);
      }
    }
  }

  private aggro(m: Entity) {
    if (m.ai !== 'chase' && MONSTERS[m.monsterId]?.boss) m.aiTimer = 3;
    m.ai = 'chase';
    m.repathCd = 0;
    m.path = [];
    if (m.group && MONSTERS[m.monsterId]?.groupAggro) {
      for (const o of this.monsters)
        if (o !== m && o.group === m.group && !o.dead && (o.ai === 'idle' || o.ai === 'wander')) {
          o.ai = 'chase';
          o.repathCd = 0;
          o.path = [];
        }
    }
  }

  // ---------- boss: src/core/world/boss.ts ----------
  tickBossExtras(m: Entity, def: MonsterDef, dt: number) {
    return boss.tickBossExtras(this, m, def, dt);
  }
  resetBoss(m: Entity) {
    return boss.resetBoss(this, m);
  }
  tickTelegraphs(dt: number) {
    return boss.tickTelegraphs(this, dt);
  }
  engagedBoss(): Entity | null {
    return boss.engagedBoss(this);
  }

  // ---------- inventário: src/core/world/inventory.ts ----------
  wearGear() {
    return inventory.wearGear(this);
  }
  gearStats(): Record<string, number> {
    return inventory.gearStats(this);
  }
  sortBag() {
    return inventory.sortBag(this);
  }
  freeSlots(): number {
    return inventory.freeSlots(this);
  }
  canFit(baseId: string, qty = 1): boolean {
    return inventory.canFit(this, baseId, qty);
  }
  addItem(item: ItemInstance): boolean {
    return inventory.addItem(this, item);
  }
  potionCount(baseId: string): number {
    return inventory.potionCount(this, baseId);
  }
  kindCount(kind: PotionKind): number {
    return inventory.kindCount(this, kind);
  }
  removeFromBag(i: number, qty = 1) {
    return inventory.removeFromBag(this, i, qty);
  }
  collect(item: ItemInstance, x: number, y: number) {
    return inventory.collect(this, item, x, y);
  }
  tickGround() {
    return inventory.tickGround(this);
  }
  dropLoot(m: Entity, def: MonsterDef) {
    return inventory.dropLoot(this, m, def);
  }
  canEquip(it: ItemInstance): ActionError | null {
    return inventory.canEquip(this, it);
  }
  equip(bagIndex: number): ActionError | null {
    return inventory.equip(this, bagIndex);
  }
  unequip(slot: Slot): ActionError | null {
    return inventory.unequip(this, slot);
  }
  usePotion(kind: PotionKind, baseId?: string): boolean {
    return inventory.usePotion(this, kind, baseId);
  }
  tickPotions(dt: number) {
    return inventory.tickPotions(this, dt);
  }
  lowDurability(): boolean {
    return inventory.lowDurability(this);
  }

  private attack(a: Entity, t: Entity, mult = 1, skill = false): AttackResult {
    const r = rollAttack(a, this.defender(t), this.rng);
    if (r.hit && a.kind === 'player' && this.hasBuff(t, 'poison')) {
      const bonus = this.passiveValue('poisonedBonus');
      if (bonus) mult *= 1 + bonus;
    }
    if (r.hit && mult !== 1) r.amount = Math.max(1, Math.round(r.amount * mult));
    if (r.hit && t.kind === 'player') {
      const red = this.passiveValue('damageTaken');
      if (red) r.amount = Math.max(1, Math.round(r.amount * (1 - red)));
    }
    if (!skill) this.emit({ type: 'attack', fromId: a.id, toId: t.id, ranged: a.attackRange > 3 });
    if (a.kind === 'monster' && MONSTERS[a.monsterId]?.projectile)
      this.emit({ type: 'projectile', fromX: a.x, fromY: a.y, toX: t.x, toY: t.y, kind: 'arrow' });
    if (r.hit && t.kind === 'player' && a.kind === 'monster') this.wearGear();
    if (r.hit) {
      const dealt = t.kind === 'player' ? this.absorb(t, r.amount) : r.amount;
      t.hp -= dealt;
      if (dealt > 0)
        this.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: r.crit });
      // roubo de vida da seita (Tormenta): parte do dano causado volta como vida
      const ls = a.kind === 'player' ? (CLASSES[this.classId].lifeSteal ?? 0) : 0;
      if (ls > 0 && dealt > 0 && !a.dead) a.hp = Math.min(a.derived.maxHp, a.hp + dealt * ls);
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

  // ---------- quests: src/core/world/quests.ts ----------
  questView(): {
    def: QuestDef | null;
    phase: QuestPhase;
    progress: number;
    count: number;
    giver: string;
    turnIn: string;
  } {
    return quests.questView(this);
  }
  questMark(npcId: string): '!' | '?' | null {
    return quests.questMark(this, npcId);
  }
  questTalkTarget(): string {
    return quests.questTalkTarget(this);
  }
  questAccept(force = false): boolean {
    return quests.questAccept(this, force);
  }
  questTurnIn(force = false): boolean {
    return quests.questTurnIn(this, force);
  }
  questKill(monsterId: string) {
    return quests.questKill(this, monsterId);
  }
  questTalk(npcId: string) {
    return quests.questTalk(this, npcId);
  }
  questReach(mapId: string) {
    return quests.questReach(this, mapId);
  }

  private killMonster(m: Entity) {
    const def = MONSTERS[m.monsterId];
    m.dead = true;
    m.hp = 0;
    m.path = [];
    m.buffs = [];
    m.respawnAt = m.summoned ? Infinity : this.time + def.respawnSeconds;
    if (!m.summoned && !def.boss && m.spawnKey) this.respawnAtMs[m.spawnKey] = this.clock() + def.respawnSeconds * 1000;
    if (def.boss) {
      this.bossRespawnAtMs = this.clock() + def.respawnSeconds * 1000;
      this.telegraphs = [];
      this.monsters = this.monsters.filter((x) => !x.summoned || x.dead);
      this.emit({ type: 'bossDefeated', respawnAt: this.bossRespawnAtMs });
    }
    if (this.targetId === m.id) {
      this.targetId = null;
      this.autoAttack = false;
    }
    this.emit({ type: 'death', id: m.id });
    this.emit({ type: 'kill', monsterId: m.monsterId, level: m.level });
    this.questKill(m.monsterId);
    this.gainXp(def.xpBase + def.xpPerLevel * (m.level - 1));
    this.dropLoot(m, def);
    if (m.summoned) this.monsters = this.monsters.filter((x) => x !== m);
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  killPlayer() {
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    p.path = [];
    p.buffs = [];
    this.pendingSkill = null;
    this.moveInput = { x: 0, y: 0 };
    this.targetId = null;
    this.autoAttack = false;
    this.respawnTimer = 3;
    this.emit({ type: 'playerDeath' });
    this.onPlayerDeath();
  }

  private respawnPlayer() {
    const p = this.player;
    p.dead = false;
    p.hp = p.derived.maxHp;
    p.mana = p.derived.maxMana;
    this.changeMap(HOME_MAP);
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  gainXp(n: number) {
    const p = this.player;
    if (p.level >= PROGRESSION.levelCap) return;
    this.xp += n;
    this.emit({ type: 'xp', amount: n });
    for (let need = this.xpToNext(); need !== null && this.xp >= need; need = this.xpToNext()) {
      this.xp -= need;
      p.level++;
      const up = CLASSES[this.classId].levelUpAttributes;
      for (const k of ATTR_KEYS) p.attrs[k] += up[k];
      this.freePoints += PROGRESSION.freePointsPerLevel;
      this.recalc(p, false);
      p.hp = p.derived.maxHp;
      p.mana = p.derived.maxMana;
      this.emit({ type: 'levelup', level: p.level });
      for (const s of this.classSkills()) if (s.unlock === p.level) this.emit({ type: 'skillUnlocked', skillId: s.id });
    }
    if (p.level >= PROGRESSION.levelCap) this.xp = 0;
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  recalc(e: Entity, keepGain: boolean) {
    const old = e.derived;
    if (e.kind === 'player') this.applyGear(e);
    else e.derived = computeDerived(e.attrs);
    if (keepGain) {
      e.hp += Math.max(0, e.derived.maxHp - old.maxHp);
      e.mana += Math.max(0, e.derived.maxMana - old.maxMana);
    }
    e.hp = Math.min(e.hp, e.derived.maxHp);
    e.mana = Math.min(e.mana, e.derived.maxMana);
    if (e.kind === 'player') this.applyPassives();
  }

  private applyGear(e: Entity) {
    const g = this.gearStats(),
      eff = { ...e.attrs };
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
    d.critChance = Math.min(0.95, d.critChance);
    e.derived = d;
    e.elemAtk = { ...emptyElements(), ...CLASSES[this.classId].elementAttack };
    for (const el of ELEMENTS) e.elemAtk[el] += g[`elem_${el}`] ?? 0;
  }

  // ---------- inventário ----------
  /** Interno: usado pelos módulos de src/core/world/. */
  bumpInv() {
    this.invVersion++;
  }

  // ---------- npcs: src/core/world/npcs.ts ----------
  interactNpc(entityId: number) {
    return npcs.interactNpc(this, entityId);
  }
  npcRole(n: Entity | null = this.openNpc): string {
    return npcs.npcRole(this, n);
  }
  openNpcWindow(n: Entity) {
    return npcs.openNpcWindow(this, n);
  }
  closeNpc() {
    return npcs.closeNpc(this);
  }
  tickWalker(n: Entity, dt: number) {
    return npcs.tickWalker(this, n, dt);
  }

  // ---------- shop: src/core/world/shop.ts ----------
  buy(potionId: string, qty: number): ActionError | null {
    return shop.buy(this, potionId, qty);
  }
  purchase(potionId: string, qty: number): ActionError | null {
    return shop.purchase(this, potionId, qty);
  }
  sell(bagIndex: number, qty = 1): ActionError | null {
    return shop.sell(this, bagIndex, qty);
  }
  sellRaw(bagIndex: number, qty = 1): number {
    return shop.sellRaw(this, bagIndex, qty);
  }
  sellValueNow(it: ItemInstance): number {
    return shop.sellValueNow(this, it);
  }
  repair(it: ItemInstance): ActionError | null {
    return shop.repair(this, it);
  }
  repairAllCost(): number {
    return shop.repairAllCost(this);
  }
  repairAll(): ActionError | null {
    return shop.repairAll(this);
  }

  // ---------- offlineApply: src/core/world/offlineApply.ts ----------
  applyOffline(now: number, lastSeen: number, saved: SaveData['auto']): OfflineReport | null {
    return offlineApply.applyOffline(this, now, lastSeen, saved);
  }
  /**
   * Voltou do segundo plano: mesmo cálculo de quando o jogo abre, se ficou fora RESUME_OFFLINE_MIN_MS ou mais
   * com o auto ligado. `autoAtPause` é o auto.serialize() do momento em que saiu. Com relatório, o auto fica
   * esperando o resumo ser fechado (auto.resume()).
   */
  applyResumeOffline(now: number, pausedAt: number, autoAtPause: SaveData['auto']): OfflineReport | null {
    if (now - pausedAt < RESUME_OFFLINE_MIN_MS) return null;
    const rep = this.applyOffline(now, pausedAt, autoAtPause);
    if (rep) this.auto.holdForReport();
    return rep;
  }

  // ---------- mapa / entidades ----------
  changeMap(mapId: string, x?: number, y?: number) {
    this.mapId = mapId;
    this.map = this.maps[mapId];
    const sp = this.map.objects.find((o) => o.type === 'spawn');
    const p = this.player;
    p.x = x ?? sp?.x ?? 1.5;
    p.y = y ?? sp?.y ?? 1.5;
    p.path = [];
    this.moveInput = { x: 0, y: 0 };
    this.targetId = null;
    this.autoAttack = false;
    this.pendingSkill = null;
    this.portalCd = 1;
    this.monsters = [];
    this.npcs = [];
    this.ground = [];
    this.openNpc = null;
    this.npcGoal = null;
    this.telegraphs = [];
    this.arenas = [];
    this.bossSummoned = false;
    this.arenaSeen = false;
    if (this.bossRespawnAtMs && this.bossRespawnAtMs <= this.clock()) this.bossRespawnAtMs = 0;
    const now = this.clock();
    for (const [k, t] of Object.entries(this.respawnAtMs)) if (t <= now) delete this.respawnAtMs[k];
    this.map.objects.forEach((o, idx) => {
      if (o.type === 'monsterSpawn') {
        const def = MONSTERS[String(o.props.monster)];
        if (!def) return;
        const m = this.makeMonster(def, { x: o.x, y: o.y });
        m.group = Number(o.props.group) || 0;
        m.spawnKey = `${mapId}#${idx}`;
        this.monsters.push(m);
        const until = this.respawnAtMs[m.spawnKey];
        if (!def.boss && until > now) {
          m.dead = true;
          m.hp = 0;
          m.respawnAt = this.time + (until - now) / 1000;
        }
        if (def.boss) {
          this.arenas.push({ x: o.x, y: o.y, r: def.boss.arenaRadius });
          if (this.bossRespawnAtMs > this.clock()) {
            m.dead = true;
            m.hp = 0;
            m.respawnAt = this.time + (this.bossRespawnAtMs - this.clock()) / 1000;
          }
        }
      } else if (o.type === 'npc') {
        const id = String(o.props.npc ?? '');
        const txt = id.startsWith('mestre_') ? NPC_TEXT.masters[id.slice(7)] : NPC_TEXT.npcs[id];
        const n = {
          ...this.blank('npc', txt?.name ?? tn(o.name), 1),
          x: o.x,
          y: o.y,
          npcId: id,
          wander: Number(o.props.wander) || 0,
        };
        n.home = { x: o.x, y: o.y };
        n.moveSpeed = NPC_WALK_SPEED;
        n.aiTimer = this.npcRng.range(0.5, 4);
        this.npcs.push(n);
      }
    });
    this.emit({ type: 'mapChange', mapId });
    this.questReach(mapId);
  }

  private blank(kind: Entity['kind'], name: string, level: number): Entity {
    const attrs: Attributes = { strength: 1, intelligence: 1, stamina: 1, agility: 1, willpower: 1 };
    return {
      id: this.nextId++,
      kind,
      name,
      level,
      x: 0,
      y: 0,
      hp: 1,
      mana: 0,
      dead: false,
      attrs,
      derived: computeDerived(attrs),
      elemAtk: emptyElements(),
      elemRes: emptyElements(),
      damageType: 'physical',
      element: null,
      attackRange: 1,
      attackWhileMoving: false,
      attackInterval: 1,
      attackCd: 0,
      moveSpeed: 3,
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
  }

  private makePlayer(name: string, classId: string, level: number, attrs: Attributes): Entity {
    const c = CLASSES[classId];
    const e = this.blank('player', name, level);
    e.id = 1;
    e.attrs = attrs;
    e.derived = computeDerived(attrs);
    e.elemAtk = { ...emptyElements(), ...c.elementAttack };
    e.damageType = c.damageType;
    e.element = c.element;
    e.attackRange = c.attackRange;
    e.attackWhileMoving = !!c.attackWhileMoving;
    e.attackInterval = c.attackInterval;
    e.moveSpeed = c.moveSpeed;
    e.hp = e.derived.maxHp;
    e.mana = e.derived.maxMana;
    return e;
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  applyMonsterLevel(e: Entity, def: MonsterDef, level: number) {
    e.level = level;
    for (const k of ATTR_KEYS) e.attrs[k] = Math.round(def.baseAttributes[k] + def.perLevel[k] * (level - 1));
    e.derived = computeDerived(e.attrs);
    if (def.defMul) {
      e.derived.physDef *= def.defMul.phys;
      e.derived.spiritDef *= def.defMul.spirit;
    }
    e.hp = e.derived.maxHp;
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  makeMonster(def: MonsterDef, home: Point): Entity {
    const e = this.blank('monster', def.name, 1);
    e.monsterId = def.id;
    e.home = { ...home };
    e.x = home.x;
    e.y = home.y;
    e.damageType = def.damageType;
    e.attackRange = def.attackRange;
    e.attackInterval = def.attackInterval;
    e.moveSpeed = def.moveSpeed;
    e.aiTimer = this.rng.range(0.5, 4);
    this.applyMonsterLevel(e, def, this.rng.int(def.minLevel, def.maxLevel));
    return e;
  }

  private respawn(m: Entity, def: MonsterDef) {
    this.applyMonsterLevel(m, def, this.rng.int(def.minLevel, def.maxLevel));
    if (def.boss) {
      this.bossRespawnAtMs = 0;
      this.resetBoss(m);
    }
    if (m.spawnKey) delete this.respawnAtMs[m.spawnKey];
    m.buffs = [];
    m.dead = false;
    m.x = m.home.x;
    m.y = m.home.y;
    m.ai = 'idle';
    m.aiTimer = 2;
    m.path = [];
    m.attackCd = 1;
  }

  // ---------- movimento ----------
  /** Interno: usado pelos módulos de src/core/world/. */
  followPath(e: Entity, dt: number, mul: number) {
    let rem = e.moveSpeed * mul * this.speedMul(e) * dt;
    while (rem > 0 && e.path.length) {
      const w = e.path[0],
        dx = w.x - e.x,
        dy = w.y - e.y,
        d = Math.hypot(dx, dy);
      if (d <= rem) {
        e.x = w.x;
        e.y = w.y;
        rem -= d;
        e.path.shift();
      } else {
        e.x += (dx / d) * rem;
        e.y += (dy / d) * rem;
        rem = 0;
      }
    }
  }

  private step(e: Entity, dx: number, dy: number, d: number) {
    const nx = e.x + dx * d,
      ny = e.y + dy * d;
    // monstro recuando (arqueiro) não entra na área do portal: lá o personagem corpo a corpo não o alcança
    const ok =
      e === this.player || this.nearPortal(e)
        ? isWalkable
        : (m: GameMap, x: number, y: number) => isWalkable(m, x, y) && !this.nearPortal({ x, y });
    if (ok(this.map, nx, ny)) {
      e.x = nx;
      e.y = ny;
    } else if (ok(this.map, nx, e.y)) e.x = nx;
    else if (ok(this.map, e.x, ny)) e.y = ny;
  }
  /** Ponto na área de um portal (o retângulo + 1 tile em volta). Monstros não param nem recuam para lá. */
  nearPortal(pt: Point): boolean {
    return this.map.objects.some(
      (o) => o.type === 'portal' && insideAvoid({ x: o.x, y: o.y, w: o.w, h: o.h, r: 1 }, pt.x, pt.y),
    );
  }
}
