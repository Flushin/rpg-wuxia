import {
  CLASSES,
  LEVELUP_POSE_S,
  MONSTERS,
  XP_BANK_LEVELS,
  levelsReadyFor,
  xpBankCap,
  NPC_TEXT,
  PROGRESSION,
  SKINS,
  MOUNTS,
  RELICS,
  RELIC_DROP,
  RELIC_REQ_LEVEL,
  type RelicEffectKind,
  type RelicPvpStat,
  freePointsAt,
  totalFreePoints,
  type MonsterDef,
} from './data';

export { LEVELUP_POSE_S, XP_BANK_LEVELS };
import { tn } from './i18n';
import { distributeByRatio } from './distribute';
import { expectedDamage, rollAttack, type AttackResult } from './combat';
import { ultimateOf, ultSplit, type UltDebuff, type UltimateDef } from './ultimate';
import { screenToTile } from './iso';
import type { GameMap } from './map';
import { findPath, insideAvoid, isWalkable, reachableNear, type Avoid } from './pathfinding';
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
import {
  BAG_SIZE,
  type BagTab,
  SLOTS,
  STARTING_KIT,
  STARTING_WEAPON,
  makeEquipment,
  type ItemOwner,
  makePotion,
  maxDurability,
  isStackId,
  itemHasGems,
} from './items';
import { AutoCombat } from './auto';
import { HOME_MAP, MAPS_CONFIG, TOWN_MAPS, homeTownOf, portalMinLevel } from './mapsConfig';
import { dungeonById, isDungeonMap } from './dungeons';
import { teleportBlock, teleportById, teleportCost } from './teleport';
import {
  TRIAL_MAP,
  TRIAL_MIN_LEVEL,
  isTrialBoss,
  trialBossLevel,
  trialCost,
  trialStats,
  trialUnlocked,
  trialXp,
  validTier,
  type TrialProgress,
} from './trial';
import { Rng } from './rng';
import * as saveCodec from './world/saveCodec';
import * as offlineApply from './world/offlineApply';
import { RESUME_OFFLINE_MIN_MS } from './offline';
import * as npcs from './world/npcs';
import * as boss from './world/boss';
import * as quests from './world/quests';
import * as shop from './world/shop';
import * as forge from './world/forge';
import * as gems from './world/gems';
import * as merchant from './world/merchant';
import { dist } from './world/geometry';
import * as inventory from './world/inventory';
import * as party from './world/party';
import { clearSeal, sealedBoss, setupSeal, tickSeal, type Seal } from './world/seal';
import * as arenaW from './world/arena';
import { ARENA_COUNTDOWN, newArenaState, type ArenaState } from './arena';
import type { Bot } from './bots';
import { type QuestDef, type QuestPhase, type QuestState } from './quests';
import { CRIT_TOTAL_MAX, computeDerived, emptyElements } from './stats';
import { bal } from './balance';
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

export const TOWN_REGEN = 0.03; // 3% por segundo (a wiki mostra; tools/wiki-check.ts confere)
const POISON_TICK = 1; // segundos entre os tiques de veneno
const DASH_STOP = 1.0; // distância final do Passo do Raio até o alvo
const NPC_REACH = 1.8; // distância para abrir a janela do NPC
const NPC_LEAVE = 3; // janela fecha ao se afastar mais que isso
export const DEATH_DURABILITY_LOSS = 0.1;
const NPC_WALK_SPEED = 1.3; // moradores andando pela cidade
const BOSS_LEASH_SLACK = 3; // chefe só larga o jogador além do raio da arena + isto (tiles)
const BOSS_LEASH_GRACE = 3; // ...e depois de tantos segundos seguidos lá fora
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
  /** níveis prontos para subir depois da volta e se a XP encheu (o excesso se perdeu) */
  levelsReady: number;
  xpCapped: boolean;
  gold: number;
  items: { name: string; color: string; rarity: Rarity; qty: number }[];
  potionsUsed: Record<PotionKind, number>;
  soldCount: number;
  soldGold: number;
  /** teto de ouro da volta (abates + vendas) e se foi atingido */
  goldCap: number;
  goldCapped: boolean;
}

export class World {
  mapId = HOME_MAP;
  map: GameMap;
  player!: Entity;
  classId: string;
  xp = 0;
  freePoints = 0;
  /** segundos que ainda faltam da pose de subida de nível (não vai para o save) */
  levelUpPose = 0;
  /** ultimate: carga atual (0..def.charge), soltura em andamento e último momento de combate (não vão para o save) */
  ultCharge = 0;
  ultCast: { t: number; hits: Map<number, number>; x: number; y: number } | null = null;
  lastCombat = -99;
  /** montado pelo botão (🐎 / tecla H); entrar em combate desmonta e só volta pelo botão */
  riding = false;
  private ridingSince = 0;
  ratioCursor = 0;
  seenTips: string[] = [];
  tipsEnabled = true;
  audio = { sfx: 20, music: 40, muted: false };
  monsters: Entity[] = [];
  npcs: Entity[] = [];
  events: GameEvent[] = [];
  time = 0;
  targetId: number | null = null;
  skills: Record<string, SkillState> = {};
  gcd = 0;
  gold = 0;
  /** skins compradas e a vestida (null = traje da seita); ver SKINS */
  skinsOwned: string[] = [];
  skin: string | null = null;
  /** montarias compradas (MOUNTS); a primeira é a usada. Montado = fora de combate há mountDelay s (isMounted) */
  mountsOwned: string[] = [];
  /** relíquias obtidas (RELICS) e a equipada (null = espaço vazio); Porto Noturno, etapa 4 */
  relicsOwned: string[] = [];
  relic: string | null = null;
  /** fragmentos de lendária (id da relíquia → quantidade) */
  relicShards: Record<string, number> = {};
  private relicBreathCd = 0; // Último fôlego (Coração do Dragão)
  private relicPulseT = 0; // Muralha imperial (Selo de Jade): segundos até o próximo escudo
  private relicSkillCount = 0; // Ritmo do qilin (Pérola do Qilin)
  bag: (ItemInstance | null)[] = Array(BAG_SIZE).fill(null);
  /** vendidos nesta sessão que o vendedor recompra pelo mesmo preço (não vai para o save) */
  buyback: { item: ItemInstance; price: number }[] = [];
  /** uids de equipamentos pegos nesta sessão e ainda não vistos na mochila (ponto de "novo") */
  newItems = new Set<string>();
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
  /** segundos seguidos com o jogador fora da arena (com folga) durante a luta com o chefe */
  private bossAwayT = 0;
  /** chefes mortos: id do monstro → ms (relógio real) do renascimento (marco 9: um por chefe) */
  bossRespawn: Record<string, number> = {};
  /** O renascimento mais distante entre os chefes mortos (0 = todos vivos). */
  get bossRespawnAtMs(): number {
    return Math.max(0, ...Object.values(this.bossRespawn));
  }
  // monstros comuns mortos: "mapa#índice" → ms (relógio real) do renascimento; conta mesmo fora do mapa
  respawnAtMs: Record<string, number> = {};
  clock: () => number = () => Date.now();
  quest: QuestState = { stage: 0, status: 'pending', progress: 0 }; // missão atual da cadeia (marco 7)
  merchant: merchant.MerchantState | null = null; // estoque do Mercador Ambulante (marco 9); sorteado ao abrir
  autoAttack = false;
  /** menu das masmorras aberto (o jogador pisou no Portal das Masmorras); fecha ao sair de cima do portal */
  dungeonMenu = false;
  /** masmorra em equipe: bots aliados (src/core/world/party.ts); vazio fora do modo equipe */
  party: Bot[] = [];
  /** selo da arena do chefe na masmorra (src/core/world/seal.ts); null fora dela */
  seal: Seal | null = null;
  /** arena do Porto Noturno: progresso salvo e a luta em andamento (src/core/world/arena.ts) */
  arena: ArenaState = newArenaState();
  arenaFight: arenaW.ArenaFight | null = null;
  /** corrida atual é em equipe (monstros com mais vida: balance.json equipe.*) */
  teamRun = false;
  /** jogador segurando o botão de reviver; tempo segurado; bots já revividos nesta luta */
  reviving = false;
  reviveT = 0;
  revivedInFight = new Set<number>();
  /** menu do Trial aberto (o jogador pisou no portal sul da vila); fecha ao sair de cima do portal */
  trialMenu = false;
  /** corrida do Trial em andamento (chefe e nível escolhidos); null fora do Trial */
  trialRun: { bossId: string; tier: number } | null = null;
  /** chefe do Trial vencido: janela "próximo nível / sair" (torre de chefes); null sem pergunta pendente */
  trialPrompt: { bossId: string; tier: number } | null = null;
  /** maior nível do Trial vencido de cada chefe (salvo) */
  trialProgress: TrialProgress = {};
  /** tempo de jogo (s, só com o jogo aberto): com o auto ligado e com o auto desligado (jogo ativo) */
  playTime = { auto: 0, manual: 0 };

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
  /** Só para o drop do Épico: separado de `rng` para não mudar a sequência dos outros sorteios (drops e combate). */
  epicRng = new Rng((Date.now() ^ 0x5bd1e995) >>> 0);

  // ---- privados do World
  private arenaSeen = false;
  /** jogador estava dentro da arena no tick anterior (bossArenaEnter dispara a cada entrada com o chefe vivo) */
  private wasInArena = false;
  private respawnTimer = 0;
  private portalCd = 0;
  /** está em cima de um portal de menu: o menu só abre de novo depois de sair e pisar outra vez */
  private onMenuPortal = false;
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
    if (!m || m.dead || sealedBoss(this, m)) return;
    this.npcGoal = null;
    if (this.targetId !== id) this.pendingSkill = null;
    this.targetId = id;
    this.autoAttack = true;
  }

  getTarget(): Entity | null {
    const t = this.monsters.find((m) => m.id === this.targetId);
    return t && !t.dead ? t : null;
  }

  /** Chefe vivo da arena em que o jogador está (null fora da arena). */
  arenaBoss(): Entity | null {
    if (!this.arenas.length || !this.inArena(this.player)) return null;
    return (
      this.monsters.find((m) => !m.dead && !!MONSTERS[m.monsterId]?.boss && this.inArena(m) && !sealedBoss(this, m)) ??
      null
    );
  }

  /** Com o chefe vivo e o jogador na arena, só vale mirar o que está dentro dela (nada de bicho do lado de fora). */
  targetable(m: Entity): boolean {
    if (sealedBoss(this, m)) return false; // chefe atrás do selo da masmorra
    return !this.arenaBoss() || this.inArena(m, 1);
  }

  /**
   * Alvos ao alcance, do melhor para o pior: na arena o chefe vem primeiro e o lado de fora nem entra;
   * depois quem já está brigando comigo, chefes, e por fim a distância pelo caminho (parede conta:
   * monstro sem caminho vai para o fim da fila).
   */
  private nearbyMonsters(): Entity[] {
    const p = this.player,
      boss = this.arenaBoss();
    const score = (m: Entity): number => {
      const d = dist(m, p);
      let walk = d < 1 ? d : this.pathLength(m);
      if (!Number.isFinite(walk)) walk = d + 100; // atrás de parede / sem acesso
      let s = walk;
      if (m === boss) s -= 1000;
      else if (MONSTERS[m.monsterId]?.boss) s -= 200;
      if (m.ai === 'chase') s -= 50;
      return s;
    };
    return this.monsters
      .filter((m) => !m.dead && dist(m, p) <= TARGET_RANGE && (!boss || this.inArena(m, 1)) && !sealedBoss(this, m))
      .map((m) => ({ m, s: score(m) }))
      .sort((a, b) => a.s - b.s)
      .map((c) => c.m);
  }

  cycleTarget() {
    const c = this.nearbyMonsters();
    if (!c.length) return;
    const i = c.findIndex((m) => m.id === this.targetId);
    this.setTarget(c[(i + 1) % c.length].id);
  }

  attackNearest() {
    const t = this.getTarget();
    if (t && this.targetable(t)) {
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

  /** Pontos livres gastos em cada atributo: atributo atual menos a base da seita e os ganhos automáticos por nível. */
  spentPoints(): Record<AttrKey, number> {
    const cls = CLASSES[this.classId],
      p = this.player;
    const out = {} as Record<AttrKey, number>;
    for (const k of ATTR_KEYS)
      out[k] = Math.max(0, p.attrs[k] - cls.baseAttributes[k] - (p.level - 1) * cls.levelUpAttributes[k]);
    return out;
  }

  /** Monge do Pagode (Cidadela): cobra PROGRESSION.attrResetCost e devolve todos os pontos livres para redistribuir. */
  resetAttributes(): ActionError | null {
    if (this.npcRole() !== 'meridianos') return { code: 'talkToMonk' };
    const spent = this.spentPoints();
    if (!ATTR_KEYS.some((k) => spent[k] > 0)) return { code: 'nothingToReset' };
    const cost = PROGRESSION.attrResetCost;
    if (this.gold < cost) return { code: 'noGold' };
    const cls = CLASSES[this.classId],
      p = this.player;
    this.gold -= cost;
    for (const k of ATTR_KEYS) p.attrs[k] = cls.baseAttributes[k] + (p.level - 1) * cls.levelUpAttributes[k];
    this.freePoints = totalFreePoints(p.level);
    this.recalc(p, true);
    this.bumpInv();
    this.emit({ type: 'trade', kind: 'buy', gold: cost });
    return null;
  }

  /** Governador Bai (Cidadela): compra um traje da própria seita (sem efeito no combate). */
  buySkin(id: string): ActionError | null {
    if (this.npcRole() !== 'governador') return { code: 'talkToGovernor' };
    const s = SKINS[id];
    if (!s) return { code: 'notEquippable' };
    if (s.sect !== this.classId) return { code: 'sectOnly', sect: s.sect };
    if (this.skinsOwned.includes(id)) return { code: 'skinOwned' };
    if (this.gold < s.price) return { code: 'noGold' };
    this.gold -= s.price;
    this.skinsOwned.push(id);
    this.bumpInv();
    this.emit({ type: 'trade', kind: 'buy', gold: s.price });
    this.wearSkin(id);
    return null;
  }

  /** Veste um traje comprado (null = volta ao traje da seita). Vale em qualquer lugar. */
  wearSkin(id: string | null) {
    const next = id && this.skinsOwned.includes(id) && SKINS[id]?.sect === this.classId ? id : null;
    if (next === this.skin) return;
    this.skin = next;
    this.bumpInv();
    this.emit({ type: 'skinChange' });
  }

  /** Cavalariço Ma (estábulo): compra uma montaria. Ela é usada sozinha fora de combate. */
  buyMount(id: string): ActionError | null {
    if (this.npcRole() !== 'estabulo') return { code: 'talkToStable' };
    const m = MOUNTS[id];
    if (!m) return { code: 'notEquippable' };
    if (this.mountsOwned.includes(id)) return { code: 'mountOwned' };
    if (m.exclusive) return { code: 'founderOnly' };
    if (this.gold < m.price) return { code: 'noGold' };
    this.gold -= m.price;
    this.mountsOwned.push(id);
    this.bumpInv();
    this.emit({ type: 'trade', kind: 'buy', gold: m.price });
    this.emit({ type: 'skinChange' }); // a cena carrega a folha da montaria e redesenha o jogador
    return null;
  }

  /** Antiquário Lao: compra uma relíquia comum ou rara (lendária só cai de chefes). Fica na coleção. */
  buyRelic(id: string): ActionError | null {
    if (this.npcRole() !== 'antiquario') return { code: 'talkToAntiquary' };
    const r = RELICS[id];
    if (!r || r.rarity === 'lendaria') return { code: 'notEquippable' };
    if (this.relicsOwned.includes(id)) return { code: 'relicOwned' };
    if (this.player.level < RELIC_REQ_LEVEL) return { code: 'needLevel', level: RELIC_REQ_LEVEL };
    if (this.gold < r.price) return { code: 'noGold' };
    this.gold -= r.price;
    this.relicsOwned.push(id);
    this.bumpInv();
    this.emit({ type: 'trade', kind: 'buy', gold: r.price });
    return null;
  }

  /** Equipa uma relíquia da coleção (null = tira). Troca à vontade, em qualquer lugar. */
  equipRelic(id: string | null): ActionError | null {
    if (id !== null) {
      if (!this.relicsOwned.includes(id)) return { code: 'relicNotOwned' };
      if (this.player.level < RELIC_REQ_LEVEL) return { code: 'needLevel', level: RELIC_REQ_LEVEL };
    }
    if (this.relic === id) return null;
    this.relic = id;
    this.relicSkillCount = 0;
    this.relicPulseT = 0;
    this.player.buffs = this.player.buffs.filter((b) => !b.id.startsWith('relic_'));
    this.recalc(this.player, false);
    this.bumpInv();
    this.emit({ type: 'equipChange' });
    return null;
  }

  /** Valor do efeito único da relíquia equipada (0 se não for desse tipo ou se não houver). */
  relicEffect(kind: RelicEffectKind): number {
    const r = this.relic ? RELICS[this.relic] : undefined;
    return r && r.effect.kind === kind ? r.effect.value : 0;
  }

  /** Atributo de PvP da relíquia equipada (tenacidade, resiliência, penetração; fração, 0 se não tiver). */
  relicStat(k: RelicPvpStat): number {
    const r = this.relic ? RELICS[this.relic] : undefined;
    return r?.stats[k] ?? 0;
  }

  /** Interno: chefe derrotado com o jogador no nível RELIC_DROP.minPlayerLevel+ dá fragmentos da lendária dele
   * (2 em masmorra) e tem RELIC_DROP.fullChance de dar a peça inteira, se o jogador ainda não a tiver. */
  private rollRelicDrop(bossId: string) {
    if (this.player.level < RELIC_DROP.minPlayerLevel) return;
    const id = Object.keys(RELICS).find((k) => RELICS[k].boss === bossId);
    if (!id) return;
    if (!this.relicsOwned.includes(id) && this.rng.next() < RELIC_DROP.fullChance) {
      this.relicsOwned.push(id);
      this.bumpInv();
      this.emit({ type: 'relicDrop', name: RELICS[id].name });
      return;
    }
    const n = this.dungeonId ? RELIC_DROP.perKillDungeon : RELIC_DROP.perKill;
    this.relicShards[id] = (this.relicShards[id] ?? 0) + n;
    this.bumpInv();
    this.emit({ type: 'relicFragment', name: RELICS[id].name, count: n, total: this.relicShards[id] });
  }

  /** Antiquário Lao: monta a lendária com RELIC_DROP.fragments fragmentos. */
  assembleRelic(id: string): ActionError | null {
    if (this.npcRole() !== 'antiquario') return { code: 'talkToAntiquary' };
    const r = RELICS[id];
    if (!r || r.rarity !== 'lendaria') return { code: 'notEquippable' };
    if (this.relicsOwned.includes(id)) return { code: 'relicOwned' };
    if ((this.relicShards[id] ?? 0) < RELIC_DROP.fragments) return { code: 'relicShards', need: RELIC_DROP.fragments };
    this.relicShards[id] -= RELIC_DROP.fragments;
    if (!this.relicShards[id]) delete this.relicShards[id];
    this.relicsOwned.push(id);
    this.bumpInv();
    this.emit({ type: 'relicDrop', name: r.name });
    return null;
  }

  /** Antiquário Lao: compra os fragmentos de uma lendária que o jogador já tem (sobras). */
  sellRelicShards(id: string): ActionError | null {
    if (this.npcRole() !== 'antiquario') return { code: 'talkToAntiquary' };
    const n = this.relicShards[id] ?? 0;
    if (!this.relicsOwned.includes(id) || n <= 0) return { code: 'relicNotOwned' };
    const gold = n * RELIC_DROP.fragmentPrice;
    delete this.relicShards[id];
    this.gold += gold;
    this.bumpInv();
    this.emit({ type: 'trade', kind: 'sell', gold });
    return null;
  }

  /** Interno: efeitos da lendária que correm no tempo (Último fôlego, Muralha imperial). */
  private tickRelic(dt: number) {
    const p = this.player,
      r = this.relic ? RELICS[this.relic] : undefined;
    this.relicBreathCd = Math.max(0, this.relicBreathCd - dt);
    if (!r || p.dead || p.hp <= 0) return;
    const e = r.effect;
    if (e.kind === 'lastBreath' && this.relicBreathCd <= 0 && p.hp < p.derived.maxHp * (e.below ?? 0)) {
      const dur = e.duration ?? 1;
      this.addBuff(p, 'relic_last_breath', 'regen', (p.derived.maxHp * e.value) / dur, dur);
      this.relicBreathCd = e.cooldown ?? 0;
    } else if (e.kind === 'shieldPulse') {
      this.relicPulseT -= dt;
      if (this.relicPulseT <= 0) {
        const every = e.every ?? 30;
        this.relicPulseT = every;
        this.addBuff(p, 'relic_shield', 'shield', p.derived.maxHp * e.value, every);
      }
    }
  }

  /** Interno: Ritmo do qilin. Devolve o multiplicador desta skill e conta as skills usadas. */
  private relicRhythm(): number {
    const p = this.player,
      r = this.relic ? RELICS[this.relic] : undefined;
    const charged = p.buffs.find((b) => b.kind === 'empower');
    if (charged) {
      p.buffs = p.buffs.filter((b) => b !== charged);
      this.emit({ type: 'buffExpired', targetId: p.id, id: charged.id, kind: 'empower' });
      return 1 + charged.value;
    }
    if (r?.effect.kind !== 'skillRhythm') return 1;
    if (++this.relicSkillCount >= (r.effect.every ?? 4)) {
      this.relicSkillCount = 0;
      this.addBuff(p, 'relic_rhythm', 'empower', r.effect.value, 9999);
    }
    return 1;
  }

  /** montaria em uso agora (null = a pé): montou pelo botão, tem montaria e está vivo */
  mountNow(): string | null {
    const id = this.mountsOwned[0];
    if (!this.riding || !id || !MOUNTS[id] || this.player.hp <= 0) return null;
    return id;
  }

  /** Botão de montar/desmontar. Montar exige estar fora de combate há mountDelay s. */
  toggleMount(): ActionError | null {
    const id = this.mountsOwned[0];
    const m = id ? MOUNTS[id] : undefined;
    if (!m) return { code: 'noMount' };
    if (this.riding) {
      this.riding = false;
      return null;
    }
    if (this.player.hp <= 0) return { code: 'noMount' };
    if (this.time - this.lastCombat < m.mountDelay) return { code: 'mountCombat' };
    this.riding = true;
    this.ridingSince = this.time;
    return null;
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
    // tenacidade da relíquia: atordoar e lentidão duram menos no jogador
    if (e === this.player && (kind === 'stun' || kind === 'slow')) duration *= 1 - this.relicStat('tenacity');
    const old = e.buffs.find((b) => b.id === id && b.kind === kind);
    if (old) {
      old.value = value;
      old.remaining = old.duration = duration;
    } else e.buffs.push({ id, kind, value, remaining: duration, duration });
    this.emit({ type: 'buffApplied', targetId: e.id, id, kind, duration, refresh: !!old });
  }
  /** Interno: usado pelos módulos de src/core/world/. */
  tickBuffs(e: Entity, dt: number) {
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
    for (const b of gone)
      this.emit({
        type: 'buffExpired',
        targetId: e.id,
        id: b.id,
        kind: b.kind,
        broken: b.kind === 'shield' && b.value <= 0,
      });
  }
  /** Um tique de veneno: dano direto (sem acerto/erro nem defesa; já foi calculado ao aplicar). */
  private poisonTick(e: Entity, amount: number) {
    const dealt = Math.max(1, Math.round(amount * (this.arenaFight?.dmg ?? 1)));
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
    else if (e.kind === 'bot' && e.hp <= 0) party.killBot(this, e);
  }
  isStunned(e: Entity) {
    return e.buffs.some((b) => b.kind === 'stun');
  }
  private speedMul(e: Entity) {
    let m = 1;
    for (const b of e.buffs) if (b.kind === 'slow') m *= 1 - b.value;
    if (e === this.player) {
      const mt = this.mountNow();
      if (mt) m *= 1 + MOUNTS[mt].speedBonus * bal('montaria.velocidade');
    }
    return m;
  }
  /** redução de dano recebido do jogador (passivas) */
  damageTakenRed(): number {
    return this.passiveValue('damageTaken') || 0;
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
    if (!def || p.dead || this.levelUpPose > 0 || this.ultCast || this.arenaLocked()) return;
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
    st.cd = (def.cooldown ?? 0) * (1 - this.relicEffect('cooldown'));
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
    let landed = false;
    const rhythm = this.relicRhythm();
    for (const v of victims) {
      if (!def.hits?.length) {
        // sem golpe (Névoa Tóxica): os efeitos pegam em todos da área, sem rolar acerto
        this.applyOnHit(def, v, scale);
        if (!v.dead && v.ai !== 'return') this.aggro(v);
        continue;
      }
      for (const pct of def.hits) {
        if (v.dead) break;
        const r = this.attack(p, v, pct * scale * rhythm, true);
        if (r.hit) landed = true;
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
    if (victims.length || def.shield || def.heal) this.gainSkillXp(def, st);
    if (landed) this.chargeUltimate(); // sem acertar ninguém não ganha xp (evita treinar skill no vazio)
  }

  /** Efeitos de uma skill num alvo atingido: enfraquecer/lentidão, veneno e atordoar. */
  private applyOnHit(def: SkillDef, v: Entity, scale: number) {
    if (v.dead) return;
    if (def.debuff) this.addBuff(v, def.id, def.debuff.kind, def.debuff.value, def.debuff.duration);
    if (def.poison) {
      const res = v.kind === 'monster' ? Math.min(0.9, MONSTERS[v.monsterId]?.poisonRes ?? 0) : 0;
      const total =
        expectedDamage(this.player, this.defender(v)) *
        def.poison.percent *
        scale *
        bal('dano.jogador', this.classId) *
        (1 - res);
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

  // ---------- ultimate (src/core/ultimate.ts; só o jogador solta, o Auto nunca) ----------
  ultimate(): UltimateDef | undefined {
    return ultimateOf(this.classId);
  }
  ultUnlocked(): boolean {
    const u = this.ultimate();
    return !!u && this.player.level >= u.unlock;
  }
  /** 0..1 */
  ultFill(): number {
    const u = this.ultimate();
    return u ? Math.min(1, this.ultCharge / u.charge) : 0;
  }
  ultReady(): boolean {
    return this.ultUnlocked() && this.ultFill() >= 1;
  }
  private chargeUltimate() {
    const u = this.ultimate();
    if (!u || !this.ultUnlocked() || this.ultCast) return;
    this.ultCharge = Math.min(u.charge, this.ultCharge + 1);
  }
  /** fora de combate por idleDelay s, a barra esvazia aos poucos */
  private drainUltimate(dt: number) {
    const u = this.ultimate();
    if (!u || this.ultCast || this.ultCharge <= 0 || this.time - this.lastCombat < u.idleDelay) return;
    this.ultCharge = Math.max(0, this.ultCharge - u.idleDrain * dt);
  }
  useUltimate(): boolean {
    const p = this.player,
      u = this.ultimate();
    if (!u || p.dead || this.ultCast || this.levelUpPose > 0 || this.arenaLocked()) return false;
    if (!this.ultReady()) return false;
    this.ultCharge = 0;
    this.pendingSkill = null;
    this.autoAttack = false;
    p.path = [];
    this.ultCast = { t: 0, hits: new Map(), x: p.x, y: p.y };
    this.lastCombat = this.time;
    this.emit({ type: 'ultimate', sect: this.classId, phase: 'start', x: p.x, y: p.y, radius: u.radius, targets: [] });
    return true;
  }
  private tickUltimate(dt: number) {
    const c = this.ultCast!,
      u = this.ultimate()!,
      p = this.player;
    c.t += dt;
    // cada monstro leva seus raios num compasso próprio (fase pelo id): os raios caem intercalados, sem pausa
    const every = u.duration / u.strikes,
      inside = this.ultInside(u),
      k = ultSplit(u, inside.length);
    for (const m of inside) {
      const done = c.hits.get(m.id) ?? 0,
        phase = (m.id * 0.618034) % 1;
      if (done >= u.strikes || c.t < every * (done + phase)) continue;
      c.hits.set(m.id, done + 1);
      this.emit({
        type: 'ultimate',
        sect: this.classId,
        phase: 'strike',
        x: c.x,
        y: c.y,
        radius: u.radius,
        targets: [{ x: m.x, y: m.y }],
      });
      this.ultHit(m, u.strikeMult * k, u.strikeDebuff, k);
      this.lastCombat = this.time;
    }
    if (c.t >= u.duration) {
      this.ultFinal(u);
      this.ultCast = null;
    }
    p.attackCd = Math.max(p.attackCd, 0.3);
  }
  /** golpe da ultimate: conta das skills, sem roubo de vida; o efeito (lentidão, congelar...) só se acertar */
  private ultHit(m: Entity, mult: number, debuff?: UltDebuff, split = 1): boolean {
    const r = this.attack(this.player, m, mult, true, false);
    if (!debuff || !r.hit || m.dead) return r.hit;
    let value = debuff.value;
    if (debuff.kind === 'poison') {
      // veneno: value = fração do dano (como o "poison.percent" das skills), espalhada pela duração
      const res = m.kind === 'monster' ? Math.min(0.9, MONSTERS[m.monsterId]?.poisonRes ?? 0) : 0;
      value =
        (expectedDamage(this.player, this.defender(m)) *
          debuff.value *
          split *
          bal('dano.jogador', this.classId) *
          (1 - res)) /
        debuff.duration;
    }
    this.addBuff(m, `ult_${this.classId}`, debuff.kind, value, debuff.duration);
    return r.hit;
  }
  private ultInside(u: UltimateDef) {
    const c = this.ultCast!;
    return this.monsters.filter((m) => !m.dead && dist(m, c) <= u.radius);
  }
  /** estouro final em todos os monstros do raio; a carga não sobe com o dano da própria ultimate */
  private ultFinal(u: UltimateDef) {
    const c = this.ultCast!,
      inside = this.ultInside(u),
      k = ultSplit(u, inside.length);
    // golpeia antes de avisar o desenho: o alvo leva `hit` (errou = sem efeito, ex.: não congela)
    const targets = inside.map((m) => ({ x: m.x, y: m.y, hit: this.ultHit(m, u.finalMult * k, u.finalDebuff, k) }));
    this.emit({ type: 'ultimate', sect: this.classId, phase: 'final', x: c.x, y: c.y, radius: u.radius, targets });
    this.lastCombat = this.time;
  }

  private applyPassives() {
    const p = this.player;
    p.derived = {
      ...p.derived,
      critChance: Math.min(CRIT_TOTAL_MAX, p.derived.critChance + this.passiveValue('crit')),
    };
    p.attackInterval =
      CLASSES[this.classId].attackInterval / (1 + this.passiveValue('attackSpeed') + this.relicEffect('attackSpeed'));
    const hpBonus = this.passiveValue('maxHp') + this.relicEffect('maxHpPct'),
      hpMul = (1 + hpBonus) * bal('vida.jogador', this.classId);
    if (hpMul !== 1) {
      p.derived = { ...p.derived, maxHp: Math.round(p.derived.maxHp * hpMul) };
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
      it.durability = Math.max(
        0,
        it.durability - maxDurability(it) * DEATH_DURABILITY_LOSS * bal('desgaste.equipamento'),
      );
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
    if (this.riding && (this.lastCombat > this.ridingSince || this.player.hp <= 0)) this.riding = false; // combate desmonta
    if (this.auto.state === 'on') this.playTime.auto += dt;
    else this.playTime.manual += dt;
    this.drainUltimate(dt);
    this.gcd = Math.max(0, this.gcd - dt);
    for (const st of Object.values(this.skills)) st.cd = Math.max(0, st.cd - dt);
    this.tickBuffs(this.player, dt);
    this.tickRelic(dt);
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
    } else if (this.ultCast) {
      this.tickUltimate(dt); // ultimate: parado na pose, nem o auto nem o jogador agem
    } else if (this.levelUpPose > 0) {
      this.levelUpPose = Math.max(0, this.levelUpPose - dt); // pose de subida de nível: nem o auto nem o jogador agem
    } else {
      this.auto.tick(dt);
      this.tickPlayer(dt);
      this.checkPortals();
      const inArena = this.arenas.length > 0 && this.inArena(this.player);
      if (inArena && !this.arenaSeen) {
        this.arenaSeen = true;
        this.emit({ type: 'bossArena' });
      }
      if (
        inArena &&
        !this.wasInArena &&
        this.monsters.some((m) => !m.dead && MONSTERS[m.monsterId]?.boss && !sealedBoss(this, m))
      )
        this.emit({ type: 'bossArenaEnter' });
      this.wasInArena = inArena;
    }
    party.tickParty(this, dt);
    tickSeal(this);
    arenaW.tickArena(this, dt);
    for (const m of this.monsters) if (m.kind === 'monster') this.tickMonster(m, dt); // o bot da arena anda sozinho
    for (const n of this.npcs) if (n.wander > 0) this.tickWalker(n, dt);
    this.tickTelegraphs(dt);
  }

  private tickPlayer(dt: number) {
    const p = this.player,
      d = p.derived;
    p.attackCd = Math.max(0, p.attackCd - dt);
    if (this.arenaLocked()) {
      p.path = []; // contagem da arena (ou luta acabada): ninguém anda nem ataca
      return;
    }
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
    if (this.reviving && !moving && party.revivable(this)) {
      // reviver um bot (masmorra em equipe): parado, sem atacar, até completar (src/core/world/party.ts)
      p.path = [];
      return;
    }
    if (this.pendingSkill !== null && this.tickPending(dt, t, moving || (p.attackWhileMoving && p.path.length > 0)))
      return;
    if (this.npcGoal !== null) {
      const n = this.npcs.find((e) => e.id === this.npcGoal);
      if (!n || moving) this.npcGoal = null;
      else {
        // NPC com ponto de conversa (barraca): só abre ao chegar nele, do lado do balcão
        const spot = n.spot ?? null;
        if (spot ? dist(p, spot) <= 0.75 : dist(p, n) <= NPC_REACH) {
          p.path = [];
          this.npcGoal = null;
          this.openNpcWindow(n);
          return;
        }
        p.repathCd -= dt;
        if (p.repathCd <= 0 || !p.path.length) {
          p.repathCd = 0.3;
          // sem ponto: o tile alcançável mais perto do NPC (o "mais perto" cru podia ficar atrás de parede/objeto)
          const goal = spot ?? reachableNear(this.map, p, n) ?? n;
          p.path = this.findPathFor(p, goal);
          // chegou ao ponto mais perto possível (NPC cercado: fica além do alcance normal)
          if (!spot && goal !== n && dist(p, goal) <= 0.75) {
            p.path = [];
            this.npcGoal = null;
            this.openNpcWindow(n);
            return;
          }
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
    const p = this.player;
    // portal de menu (masmorras, Trial): abre o menu ao pisar; fecha ao se afastar (folga de 1,5 tile)
    let onMenu: string | null = null;
    for (const o of this.map.objects) {
      if (o.type !== 'portal' || !o.props.menu) continue;
      const trial = o.props.menu === 'trial',
        dx = Math.max(o.x - p.x, 0, p.x - (o.x + o.w)),
        dy = Math.max(o.y - p.y, 0, p.y - (o.y + o.h));
      if (dx === 0 && dy === 0) onMenu = String(o.props.menu);
      else if (Math.hypot(dx, dy) > 1.5) {
        if (trial) this.trialMenu = false;
        else this.dungeonMenu = false;
      }
    }
    if (!onMenu) this.onMenuPortal = false;
    else if (!this.onMenuPortal && this.portalCd <= 0) {
      this.onMenuPortal = true;
      p.path = [];
      if (onMenu === 'trial') {
        this.trialMenu = true;
        this.emit({ type: 'trialMenu' });
      } else {
        this.dungeonMenu = true;
        this.emit({ type: 'dungeonMenu' });
      }
    }
    if (this.portalCd > 0) return;
    for (const o of this.map.objects) {
      if (o.type !== 'portal' || o.props.menu || p.x < o.x || p.x >= o.x + o.w || p.y < o.y || p.y >= o.y + o.h)
        continue;
      const minLevel = portalMinLevel(o);
      if (p.level < minLevel) {
        // portal trancado: avisa e espera um pouco antes de avisar de novo (o jogador pode continuar em cima dele)
        this.portalCd = 3;
        this.emit({ type: 'portalLocked', name: tn(o.name), minLevel });
        return;
      }
      this.changeMap(String(o.props.target), Number(o.props.targetX), Number(o.props.targetY));
      return;
    }
  }

  /** Menu das masmorras: paga a entrada e entra numa instância nova (monstros todos vivos). */
  /** Entra na masmorra; `team` = modo equipe, com 3 bots aliados (src/core/world/party.ts). */
  enterDungeon(id: string, team = false): ActionError | null {
    const d = dungeonById(id);
    if (!d || !this.maps[d.map] || this.player.dead) return null;
    if (this.player.level < d.minLevel) return { code: 'needLevel', level: d.minLevel };
    if (this.gold < d.cost) return { code: 'noGold' };
    this.gold -= d.cost;
    this.bumpInv();
    this.dungeonMenu = false;
    this.auto.disable(); // o Auto não funciona na masmorra
    this.teamRun = team;
    this.party = team ? party.makeParty(this, d.id) : [];
    this.changeMap(d.map);
    this.emit({ type: 'dungeonEnter', dungeonId: d.id, cost: d.cost, team });
    return null;
  }

  /** Teleporte do Mestre dos Caminhos: paga a viagem e vai de uma cidade direto ao mapa escolhido (src/core/teleport.ts). */
  travelTo(map: string): ActionError | null {
    const d = teleportById(map);
    if (!d || !this.maps[d.map] || this.player.dead || !TOWN_MAPS.has(this.mapId) || d.map === this.mapId) return null;
    const block = teleportBlock(d, this.player.level, this.gold);
    if (block) return block;
    const cost = teleportCost(d);
    this.gold -= cost;
    this.bumpInv();
    this.changeMap(d.map, d.x, d.y);
    this.emit({ type: 'teleport', map: d.map, cost });
    return null;
  }

  /** Menu do Trial: paga a entrada e entra na arena com o chefe e o nível escolhidos (nível liberado pelo progresso). */
  enterTrial(bossId: string, tier: number): ActionError | null {
    if (!isTrialBoss(bossId) || !validTier(tier) || !this.maps[TRIAL_MAP] || this.player.dead) return null;
    if (this.player.level < TRIAL_MIN_LEVEL) return { code: 'needLevel', level: TRIAL_MIN_LEVEL };
    if (tier > trialUnlocked(this.trialProgress, bossId)) return { code: 'trialLocked' };
    const cost = trialCost(tier);
    if (this.gold < cost) return { code: 'noGold' };
    this.gold -= cost;
    this.bumpInv();
    this.trialMenu = false;
    this.auto.disable(); // o Auto não funciona no Trial
    this.trialRun = { bossId, tier };
    this.changeMap(TRIAL_MAP);
    this.emit({ type: 'trialEnter', bossId, tier, cost });
    return null;
  }

  /** Torre do Trial: paga a entrada do nível seguinte (ou do mesmo, com repeat) e o chefe surge de novo na arena. */
  trialNext(repeat = false): ActionError | null {
    const p = this.trialPrompt,
      tier = repeat ? (p?.tier ?? 0) : (p?.tier ?? 0) + 1;
    if (!p || !this.trialRun || this.player.dead || !validTier(tier)) return null;
    const cost = trialCost(tier);
    if (this.gold < cost) return { code: 'noGold' };
    this.gold -= cost;
    this.bumpInv();
    this.trialPrompt = null;
    this.trialRun = { bossId: p.bossId, tier };
    // arena zerada como numa entrada nova: chefe novo, sem ajudantes, marcas ou invocação da luta anterior
    this.telegraphs = [];
    this.arenas = [];
    this.monsters = [];
    this.bossSummoned = false;
    this.arenaSeen = false;
    this.wasInArena = false;
    this.targetId = null;
    this.autoAttack = false;
    this.pendingSkill = null;
    this.spawnTrialBoss(p.bossId, tier);
    this.emit({ type: 'trialEnter', bossId: p.bossId, tier, cost });
    return null;
  }

  /** Sai do Trial pela janela do fim da luta (vai para o portal do Trial na vila). */
  leaveTrial() {
    if (!this.trialRun) return;
    this.trialPrompt = null;
    this.changeMap('cidade', 16, 27.5);
  }

  /** Masmorra do mapa atual (null fora de uma). */
  /** Quem usa os itens (o Épico acompanha nível e classe do personagem). */
  owner(): ItemOwner {
    return { level: this.player.level, classId: this.classId };
  }
  get dungeonId(): string | null {
    return isDungeonMap(this.mapId) ? this.mapId : null;
  }

  private tickMonster(m: Entity, dt: number) {
    const def = MONSTERS[m.monsterId],
      p = party.foeOf(this, m); // jogador ou, na masmorra em equipe, o bot que ele persegue
    if (m.dead) {
      if (this.time >= m.respawnAt) this.respawn(m, def);
      return;
    }
    m.attackCd = Math.max(0, m.attackCd - dt);
    if (this.isStunned(m)) return; // atordoado (Titã): não anda nem ataca
    const pd = p.dead ? Infinity : dist(m, p);
    const boss = def.boss;
    if (boss) this.tickBossExtras(m, def, dt);
    else if (def.slam) this.tickSlam(m, def, dt);
    const fromHome = this.player.dead ? Infinity : dist(this.player, m.home);
    const wake = !boss || (fromHome <= boss.arenaRadius && !sealedBoss(this, m)); // chefe só acorda com o jogador na arena
    // chefe em combate só desiste com o jogador bem fora da arena (folga + alguns segundos): desviar de um golpe
    // marcado perto dos braseiros não reseta mais a luta
    let gaveUp = false;
    if (boss && m.ai === 'chase') {
      this.bossAwayT = fromHome > boss.arenaRadius + BOSS_LEASH_SLACK ? this.bossAwayT + dt : 0;
      gaveUp = this.player.dead || this.bossAwayT >= BOSS_LEASH_GRACE;
    }
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
      if (boss ? gaveUp : p.dead || dist(m, m.home) > def.leashRange) {
        this.bossAwayT = 0;
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
      if (boss && wake) {
        // voltou para a arena enquanto o chefe recuava: a luta continua (sem curar tudo)
        this.aggro(m);
        return;
      }
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

  /** Interno: monstro atingido por `by` (o primeiro a bater vira quem ele persegue). */
  aggroBy(m: Entity, by: Entity) {
    if (m.ai !== 'chase' || m.foeId === undefined) m.foeId = by.id;
    this.aggro(m);
  }

  private aggro(m: Entity) {
    const md = MONSTERS[m.monsterId];
    if (m.ai !== 'chase' && md?.boss) m.aiTimer = 3;
    else if (m.ai !== 'chase' && md?.slam) m.aiTimer = 1.5;
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
  tickSlam(m: Entity, def: MonsterDef, dt: number) {
    return boss.tickSlam(this, m, def, dt);
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
  freeSlots(tab: BagTab = 'equip'): number {
    return inventory.freeSlots(this, tab);
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

  /** Interno: usado pelos módulos de src/core/world/. */
  attack(a: Entity, t: Entity, mult = 1, skill = false, leech = true): AttackResult {
    if (sealedBoss(this, t)) return { hit: false, crit: false, amount: 0 }; // selo da masmorra protege o chefe
    let df = this.defender(t);
    const pen = a.kind === 'player' ? this.relicStat('penetration') : 0; // relíquia: ignora parte da defesa
    if (pen)
      df = {
        ...df,
        derived: {
          ...df.derived,
          physDef: df.derived.physDef * (1 - pen),
          spiritDef: df.derived.spiritDef * (1 - pen),
        },
      };
    const r = rollAttack(a, df, this.rng);
    // resiliência da relíquia: corta parte do bônus do crítico recebido pelo jogador
    const res = r.crit && t.kind === 'player' ? this.relicStat('resilience') : 0;
    if (res) {
      const cd = a.derived.critDamage;
      r.amount = Math.max(1, Math.round((r.amount * (1 + (cd - 1) * (1 - res))) / cd));
    }
    if (r.hit && a.kind === 'player' && this.hasBuff(t, 'poison')) {
      const bonus = this.passiveValue('poisonedBonus');
      if (bonus) mult *= 1 + bonus;
    }
    // balanceamento (src/data/balance.json): dano de quem ataca
    if (a.kind === 'player') mult *= bal('dano.jogador', this.classId);
    else if (a.kind === 'monster') mult *= bal('dano.monstros', a.monsterId);
    // chefe: soma % da vida máxima do jogador ao golpe normal (src/core/world/boss.ts BOSS_PCT_HP)
    if (r.hit && !skill) r.amount += Math.round(boss.bossBasicPctDamage(a, t) * (r.crit ? a.derived.critDamage : 1));
    if (this.arenaFight) mult *= this.arenaFight.dmg; // arena: dano reduzido dos dois lados (src/core/arena.ts)
    if (r.hit && mult !== 1) r.amount = Math.max(1, Math.round(r.amount * mult));
    if (r.hit && t.kind === 'bot') {
      const red = this.botOf(t)?.damageTaken ?? 0;
      if (red) r.amount = Math.max(1, Math.round(r.amount * (1 - red)));
    }
    if (r.hit && t.kind === 'player') {
      const red = this.damageTakenRed();
      if (red) r.amount = Math.max(1, Math.round(r.amount * (1 - red)));
    }
    if (!skill)
      this.emit({
        type: 'attack',
        fromId: a.id,
        toId: t.id,
        ranged: a.attackRange > 3,
        // só para o som de ataque de cada monstro (src/data/audio.json "monsterAttack")
        monster: a.kind === 'monster' ? a.monsterId : undefined,
      });
    const proj = a.kind === 'monster' ? MONSTERS[a.monsterId]?.projectile : undefined;
    if (proj) this.emit({ type: 'projectile', fromX: a.x, fromY: a.y, toX: t.x, toY: t.y, kind: proj });
    if (r.hit) {
      const dealt = t.kind === 'player' || t.kind === 'bot' ? this.absorb(t, r.amount) : r.amount;
      // desgaste: só golpe que passa do escudo (o escudo protege o equipamento; decidido pelo Lucas em 19/11/2026)
      if (t.kind === 'player' && a.kind === 'monster' && dealt > 0) this.wearGear();
      const hpBefore = Math.max(0, t.hp);
      t.hp -= dealt;
      if (dealt > 0)
        this.emit({ type: 'hit', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y, amount: dealt, crit: r.crit });
      // roubo de vida da seita (Tormenta): parte do dano causado volta como vida;
      // conta só o dano que o alvo podia levar (excesso sobre a vida restante não cura)
      const ls =
        a.kind === 'player' && leech
          ? (CLASSES[this.classId].lifeSteal ?? 0) + this.relicEffect('lifeSteal')
          : a.kind === 'bot' && leech
            ? (this.botOf(a)?.lifeSteal ?? 0)
            : 0;
      const stolen = Math.min(dealt, hpBefore);
      if (ls > 0 && stolen > 0 && !a.dead) a.hp = Math.min(a.derived.maxHp, a.hp + stolen * ls);
      // golpe que deixa lento (Espectro de gelo, marco 9)
      const oh = a.kind === 'monster' && !skill ? MONSTERS[a.monsterId]?.onHit : undefined;
      if (oh && t.hp > 0) this.addBuff(t, a.monsterId, 'slow', oh.slow, oh.duration);
    } else {
      this.emit({ type: 'miss', targetId: t.id, targetKind: t.kind, x: t.x, y: t.y });
    }
    if (a.kind === 'player' || t.kind === 'player') this.lastCombat = this.time;
    if (t.kind === 'monster') {
      if (t.ai !== 'return') this.aggroBy(t, a);
      if (t.hp <= 0) this.killMonster(t);
    } else if (t.kind === 'bot') {
      if (t.hp <= 0) party.killBot(this, t);
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
    const dungeon = this.dungeonId; // masmorra: instância, nada renasce (nem conta nos relógios de renascimento)
    m.respawnAt = m.summoned || dungeon ? Infinity : this.time + def.respawnSeconds;
    if (!dungeon && !m.summoned && !def.boss && m.spawnKey)
      this.respawnAtMs[m.spawnKey] = this.clock() + def.respawnSeconds * 1000;
    if (def.boss) {
      const at = dungeon ? 0 : this.clock() + def.respawnSeconds * 1000;
      if (!dungeon) this.bossRespawn[def.id] = at;
      this.telegraphs = [];
      this.monsters = this.monsters.filter((x) => !x.summoned || x.dead);
      this.emit({ type: 'bossDefeated', name: m.name, respawnAt: at });
      this.rollRelicDrop(def.id);
      if (this.trialRun) {
        const { bossId, tier } = this.trialRun;
        this.trialProgress[bossId] = Math.max(this.trialProgress[bossId] ?? 0, tier);
        this.trialPrompt = { bossId, tier };
        this.emit({ type: 'trialCleared', bossId, tier });
      } else if (dungeon) this.emit({ type: 'dungeonCleared', dungeonId: dungeon });
    }
    if (this.targetId === m.id) {
      this.targetId = null;
      this.autoAttack = false;
    }
    this.emit({ type: 'death', id: m.id });
    this.emit({ type: 'kill', monsterId: m.monsterId, level: m.level });
    this.questKill(m.monsterId);
    this.gainXp(m.trial ? m.trial.xp : Math.round(def.xpBase + def.xpPerLevel * (m.level - 1)));
    this.dropLoot(m, def);
    if (m.summoned) this.monsters = this.monsters.filter((x) => x !== m);
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  /** Arena: contagem antes da luta ou resultado na tela; o jogador fica parado. */
  arenaLocked(): boolean {
    const f = this.arenaFight;
    return !!f && (f.over || f.t < ARENA_COUNTDOWN);
  }

  /** Interno: bot aliado (masmorra em equipe) ou o inimigo da arena dono desta entidade. */
  botOf(e: Entity): Bot | null {
    return this.party.find((b) => b.e === e) ?? (this.arenaFight?.bot.e === e ? this.arenaFight.bot : null);
  }

  // ---------- arena do Porto Noturno: src/core/world/arena.ts ----------
  enterArena(): ActionError | null {
    return arenaW.enterArena(this);
  }
  buyArenaTitle(id: string): ActionError | null {
    return arenaW.buyArenaTitle(this, id);
  }
  wearArenaTitle(id: string | null) {
    arenaW.wearArenaTitle(this, id);
  }

  killPlayer() {
    if (this.arenaFight) {
      // na arena ninguém morre: a luta acaba em derrota, sem penalidade (src/core/world/arena.ts)
      arenaW.finishArena(this, false);
      return;
    }
    this.ultCast = null;
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
    this.changeMap(homeTownOf(this.mapId)); // nível 40: nos mapas além da Cidadela, renasce na Cidadela
  }

  /** Interno: usado pelos módulos de src/core/world/. A XP fica guardada (o jogador sobe quando quiser, levelUp()),
   *  até XP_BANK_LEVELS níveis prontos; o que passar disso se perde e avisa ('xpFull'). */
  gainXp(n: number) {
    if (this.player.level >= PROGRESSION.levelCap || n <= 0) return;
    const before = this.levelsReady(),
      add = Math.min(n, Math.max(0, this.xpBankCap() - this.xp));
    this.xp += add;
    if (add > 0) this.emit({ type: 'xp', amount: add });
    const ready = this.levelsReady();
    if (ready > before) this.emit({ type: 'levelReady', ready, level: this.player.level + 1 });
    if (add < n) this.emit({ type: 'xpFull', lost: n - add });
  }

  /** XP máxima guardada (XP_BANK_LEVELS níveis). */
  xpBankCap(): number {
    return xpBankCap(this.player.level);
  }

  /** Quantos níveis a XP guardada já paga. */
  levelsReady(): number {
    return levelsReadyFor(this.player.level, this.xp);
  }

  /** O jogador sobe um nível com a XP guardada (botão do HUD): pose e animação. Não sobe morto nem durante a pose. */
  levelUp(): boolean {
    if (this.player.dead || this.levelUpPose > 0 || !this.levelsReady()) return false;
    this.applyLevel(true);
    this.levelUpPose = LEVELUP_POSE_S;
    return true;
  }

  /** Sobe todos os níveis prontos de uma vez (simulações, testes e trapaças de desenvolvimento): uma animação por
   *  nível, em fila; só a primeira tem a pose. */
  levelUpAll(): number {
    let n = 0;
    while (this.levelsReady() > 0) this.applyLevel(n++ === 0);
    if (n && !this.player.dead) this.levelUpPose = LEVELUP_POSE_S;
    return n;
  }

  private applyLevel(pose: boolean) {
    const p = this.player;
    this.xp -= PROGRESSION.xpToNext[p.level - 1];
    p.level++;
    const up = CLASSES[this.classId].levelUpAttributes;
    for (const k of ATTR_KEYS) p.attrs[k] += up[k];
    this.freePoints += freePointsAt(p.level);
    this.recalc(p, false);
    p.hp = p.derived.maxHp;
    p.mana = p.derived.maxMana;
    this.emit({ type: 'levelup', level: p.level, points: freePointsAt(p.level), pose });
    for (const s of this.classSkills()) if (s.unlock === p.level) this.emit({ type: 'skillUnlocked', skillId: s.id });
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
    d.critChance = Math.min(CRIT_TOTAL_MAX, d.critChance);
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
  // destrói o item (a pilha inteira) da mochila, sem ganho: libera espaço longe da vila
  destroyItem(bagIndex: number): boolean {
    const it = this.bag[bagIndex];
    if (!it || it.locked || it.rarity === 'epico' || itemHasGems(it)) return false; // Épico não se destrói: só desmonta no ferreiro
    this.removeFromBag(bagIndex, it.qty ?? 1);
    this.bumpInv();
    return true;
  }
  buyBack(idx: number): ActionError | null {
    return shop.buyBack(this, idx);
  }
  /** Tranca/destranca um equipamento da mochila (cadeado). */
  toggleLock(bagIndex: number): boolean {
    const it = this.bag[bagIndex];
    if (!it || isStackId(it.baseId)) return false;
    if (it.locked) delete it.locked;
    else it.locked = true;
    this.bumpInv();
    return true;
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

  // ---------- forja (marco 9): src/core/world/forge.ts ----------
  forgeUpgrade(it: ItemInstance, force = false): ActionError | null {
    return forge.upgrade(this, it, force);
  }
  forgeRarity(it: ItemInstance, force = false): ActionError | null {
    return forge.raiseRarity(this, it, force);
  }
  forgeReroll(it: ItemInstance, force = false): ActionError | null {
    return forge.reroll(this, it, force);
  }
  forgeSalvage(bagIndex: number, force = false): ActionError | null {
    return forge.salvage(this, bagIndex, force);
  }

  // ---------- gemas e encaixes (Porto Noturno): src/core/world/gems.ts ----------
  buyGem(id: string, qty = 1): ActionError | null {
    return gems.buyGem(this, id, qty);
  }
  fuseGem(id: string): ActionError | null {
    return gems.fuseGem(this, id);
  }
  openSocket(it: ItemInstance): ActionError | null {
    return gems.openSocket(this, it);
  }
  insertGem(it: ItemInstance, id: string, slot = -1): ActionError | null {
    return gems.insertGem(this, it, id, slot);
  }
  removeGem(it: ItemInstance, slot: number): ActionError | null {
    return gems.removeGem(this, it, slot);
  }

  // ---------- Mercador Ambulante (marco 9): src/core/world/merchant.ts ----------
  merchantStock(): merchant.MerchantState {
    return merchant.merchantStock(this);
  }
  merchantBuy(idx: number, force = false): ActionError | null {
    return merchant.buyOffer(this, idx, force);
  }
  merchantBuyGoods(id: string, qty: number, force = false): ActionError | null {
    return merchant.buyGoods(this, id, qty, force);
  }
  useReturnScroll(bagIndex: number): boolean {
    return merchant.useReturnScroll(this, bagIndex);
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
    this.ultCast = null;
    if (!isDungeonMap(mapId)) {
      // saiu da masmorra (ou morreu): a corrida em equipe acaba
      this.party = [];
      this.teamRun = false;
    }
    this.reviving = false;
    this.reviveT = 0;
    this.revivedInFight.clear();
    clearSeal(this);
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
    this.dungeonMenu = false;
    this.trialMenu = false;
    this.onMenuPortal = false;
    this.trialPrompt = null;
    if (!MAPS_CONFIG[mapId]?.trial) this.trialRun = null; // saiu do Trial: a corrida acaba
    this.telegraphs = [];
    this.arenas = [];
    this.bossSummoned = false;
    this.arenaSeen = false;
    this.wasInArena = false;
    const now = this.clock();
    for (const [k, t] of Object.entries(this.bossRespawn)) if (t <= now) delete this.bossRespawn[k];
    for (const [k, t] of Object.entries(this.respawnAtMs)) if (t <= now) delete this.respawnAtMs[k];
    this.map.objects.forEach((o, idx) => {
      if (o.type === 'monsterSpawn') {
        const def = MONSTERS[String(o.props.monster)];
        if (!def) return;
        const lv = Number(o.props.minLevel) || 0,
          lv2 = Number(o.props.maxLevel) || 0;
        const m = this.makeMonster(def, { x: o.x, y: o.y }, lv ? [lv, Math.max(lv, lv2 || lv)] : undefined);
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
          const bt = this.bossRespawn[def.id] ?? 0;
          if (bt > now) {
            m.dead = true;
            m.hp = 0;
            m.respawnAt = this.time + (bt - now) / 1000;
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
          npcRole: o.props.role ? String(o.props.role) : undefined,
          wander: Number(o.props.wander) || 0,
          face: o.props.face === undefined ? undefined : Number(o.props.face),
          spot: Array.isArray(o.props.spot) ? { x: Number(o.props.spot[0]), y: Number(o.props.spot[1]) } : undefined,
        };
        n.home = { x: o.x, y: o.y };
        n.moveSpeed = NPC_WALK_SPEED;
        n.aiTimer = this.npcRng.range(0.5, 4);
        this.npcs.push(n);
      }
    });
    if (this.trialRun && MAPS_CONFIG[mapId]?.trial) this.spawnTrialBoss(this.trialRun.bossId, this.trialRun.tier);
    setupSeal(this);
    if (this.party.length) party.placeParty(this);
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
    e.derived.maxHp = Math.max(1, Math.round(e.derived.maxHp * bal('vida.monstros', def.id)));
    // masmorra em equipe: só a vida aumenta (ataque e defesa iguais); valores em balance.json equipe.*
    if (this.teamRun && isDungeonMap(this.mapId))
      e.derived.maxHp = Math.round(e.derived.maxHp * bal(def.boss ? 'equipe.vida_chefe' : 'equipe.vida_comuns'));
    if (def.defMul) {
      e.derived.physDef *= def.defMul.phys;
      e.derived.spiritDef *= def.defMul.spirit;
    }
    if (def.poisonRes) e.elemRes.poison = Math.round(100 * Math.min(0.9, def.poisonRes)); // dano elemental de veneno
    if (e.trial) {
      // chefe do Trial: vida, ataque e defesas do nível escolhido (src/core/trial.ts)
      const t = trialStats(def, level);
      e.derived.maxHp = Math.max(1, Math.round(t.hp * bal('vida.monstros', def.id)));
      e.derived.physAtk = e.derived.spiritAtk = t.atk;
      e.derived.physDef = t.physDef;
      e.derived.spiritDef = t.spiritDef;
    }
    e.hp = e.derived.maxHp;
  }

  /** Chefe do Trial no centro da arena, no nível do Trial escolhido (não renasce: a corrida acaba ao vencê-lo). */
  private spawnTrialBoss(bossId: string, tier: number) {
    const def = MONSTERS[bossId],
      a = MAPS_CONFIG[this.mapId]?.arena;
    if (!def?.boss || !a) return;
    const level = trialBossLevel(tier);
    const m = this.makeMonster(def, { x: a.x, y: a.y }, [level, level]);
    m.trial = { tier, xp: trialXp(tier) };
    this.applyMonsterLevel(m, def, level);
    this.monsters.push(m);
    this.arenas.push({ x: a.x, y: a.y, r: def.boss.arenaRadius });
  }

  /** Interno: usado pelos módulos de src/core/world/. */
  makeMonster(def: MonsterDef, home: Point, levels?: [number, number]): Entity {
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
    if (levels) e.levels = levels;
    this.applyMonsterLevel(e, def, this.rollLevel(e, def));
    return e;
  }

  /** Nível sorteado: a faixa do ponto do mapa (propriedades minLevel/maxLevel, marco 9) ou a do monstro. */
  private rollLevel(e: Entity, def: MonsterDef): number {
    const [a, b] = e.levels ?? [def.minLevel, def.maxLevel];
    return this.rng.int(a, b);
  }

  private respawn(m: Entity, def: MonsterDef) {
    this.applyMonsterLevel(m, def, this.rollLevel(m, def));
    if (def.boss) {
      delete this.bossRespawn[def.id];
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
