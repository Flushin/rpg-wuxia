export type Element = 'fire' | 'ice' | 'thunder' | 'poison';
/** Projétil dos monstros à distância: flecha, gelo (espectro), veneno (Serpente de Jade), qi (Grou Espiritual). */
export type ProjectileKind = 'arrow' | 'ice' | 'poison' | 'qi';
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'poison'];
export type AttrKey = 'strength' | 'intelligence' | 'stamina' | 'agility' | 'willpower';
export const ATTR_KEYS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
export type Attributes = Record<AttrKey, number>;
export type ElementMap = Record<Element, number>;
export type DamageType = 'physical' | 'spiritual';
export interface Point {
  x: number;
  y: number;
}

export type Slot = 'colar' | 'tronco' | 'arma' | 'cabeca' | 'calca' | 'bota';
export type Rarity = 'comum' | 'incomum' | 'raro';
export interface Bonus {
  stat: string;
  value: number;
}
// Instância de item. Poções usam qty (empilham); equipamentos usam rarity/bonuses/durability.
export interface ItemInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  bonuses: Bonus[];
  ilvl: number;
  durability: number;
  qty?: number;
  /** melhoria do ferreiro (+1 a +10, marco 9); sem = +0 */
  plus?: number;
}
export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item?: ItemInstance;
  gold?: number;
  expires: number;
}
export type PotionKind = 'hp' | 'mp';

export interface Derived {
  maxHp: number;
  maxMana: number;
  physAtk: number;
  spiritAtk: number;
  physDef: number;
  spiritDef: number;
  hit: number;
  evasion: number;
  critChance: number;
  critDamage: number;
}

export type BuffKind = 'defReduction' | 'slow' | 'shield' | 'poison' | 'stun' | 'regen';
// value: fração (defReduction/slow), pontos de absorção restantes (shield), dano por segundo (poison),
// vida por segundo (regen); stun não usa value
export interface Buff {
  id: string;
  kind: BuffKind;
  value: number;
  remaining: number;
  duration: number;
  /** poison: segundos até o próximo tique de dano */
  tick?: number;
}
export type SkillFailReason = 'mana' | 'cooldown' | 'notarget' | 'locked' | 'blocked';

export type AiState = 'idle' | 'wander' | 'chase' | 'return';

export interface Entity {
  id: number;
  kind: 'player' | 'monster' | 'npc';
  name: string;
  level: number;
  x: number;
  y: number;
  hp: number;
  mana: number;
  dead: boolean;
  attrs: Attributes;
  derived: Derived;
  elemAtk: ElementMap;
  elemRes: ElementMap;
  damageType: DamageType;
  element: Element | null;
  attackRange: number;
  attackWhileMoving: boolean;
  attackInterval: number;
  attackCd: number;
  moveSpeed: number;
  path: Point[];
  repathCd: number;
  // monstros
  monsterId: string;
  home: Point;
  ai: AiState;
  aiTimer: number;
  respawnAt: number;
  buffs: Buff[];
  group: number; // 0 = sem grupo; monstros do mesmo grupo entram em combate juntos
  summoned: boolean;
  /** chefe em fúria (boss.enrage); volta ao normal quando a luta reseta */
  enraged?: boolean;
  /** chefe com golpe em linha (boss.line): quantos golpes marcados já deu, para alternar círculo e linha */
  strikes?: number;
  /** chefe do Trial: nível do Trial e XP; vida, ataque e defesas vêm de src/core/trial.ts */
  trial?: { tier: number; xp: number };
  spawnKey: string; // "mapa#índice" do ponto de spawn (renascimento com tempo); '' = sem ponto
  levels?: [number, number]; // faixa de nível do ponto do mapa (marco 9); sem = a do monstro
  // NPCs
  npcId: string; // id em npcs.json / papel (ferreiro, vendedor, mestre_lamina, morador1...)
  wander: number; // raio em tiles para andar pela cidade (0 = parado)
}

export type GameEvent =
  | { type: 'attack'; fromId: number; toId: number; ranged: boolean }
  | {
      type: 'hit';
      targetId: number;
      targetKind: Entity['kind'];
      x: number;
      y: number;
      amount: number;
      crit: boolean;
      /** tique de veneno (número verde) */
      poison?: boolean;
    }
  | { type: 'miss'; targetId: number; targetKind: Entity['kind']; x: number; y: number }
  | { type: 'death'; id: number }
  | { type: 'kill'; monsterId: string; level?: number }
  | { type: 'quest'; kind: 'accepted' | 'progress' | 'ready' | 'completed'; questId: string; name: string }
  | { type: 'xp'; amount: number }
  /** points: pontos livres ganhos; pose: primeira do lote (pose + parado); replay: animação do ganho offline (sem aviso) */
  | { type: 'levelup'; level: number; points: number; pose: boolean }
  /** XP guardada pagou mais um nível: `ready` níveis prontos, o próximo é `level` */
  | { type: 'levelReady'; ready: number; level: number }
  /** XP cheia (XP_BANK_LEVELS níveis prontos): `lost` de XP se perdeu */
  | { type: 'xpFull'; lost: number }
  | { type: 'playerDeath' }
  | { type: 'mapChange'; mapId: string }
  | { type: 'portalLocked'; name: string; minLevel: number }
  /** pisou no Portal das Masmorras: a interface abre o menu de escolha (World.dungeonMenu) */
  | { type: 'dungeonMenu' }
  /** entrou numa masmorra (já pagou a entrada) */
  | { type: 'dungeonEnter'; dungeonId: string; cost: number }
  /** chefe da masmorra derrotado */
  | { type: 'dungeonCleared'; dungeonId: string }
  /** pisou no portal do Trial (saída sul da vila): a interface abre o menu de chefe e nível (World.trialMenu) */
  | { type: 'trialMenu' }
  /** entrou no Trial (já pagou a entrada) */
  | { type: 'trialEnter'; bossId: string; tier: number; cost: number }
  /** venceu o chefe do Trial: o próximo nível desse chefe fica liberado */
  | { type: 'trialCleared'; bossId: string; tier: number }
  /** tentou ligar o Auto dentro de uma masmorra */
  | { type: 'autoBlocked' }
  | {
      type: 'skillCast';
      skillId: string;
      casterId: number;
      x: number;
      y: number;
      targetId: number | null;
      tx: number;
      ty: number;
      ranged: boolean;
    }
  | { type: 'skillFail'; skillId: string; reason: SkillFailReason }
  | { type: 'skillLevelUp'; skillId: string; level: number }
  | { type: 'skillUnlocked'; skillId: string }
  | { type: 'dash'; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'buffApplied'; targetId: number; id: string; kind: BuffKind; duration: number }
  | { type: 'buffExpired'; targetId: number; id: string; kind: BuffKind }
  | { type: 'shieldAbsorb'; targetId: number; amount: number; x: number; y: number }
  | { type: 'drop'; x: number; y: number; color: string }
  | { type: 'itemPickup'; baseId: string; name: string; color: string; qty: number; potion: boolean; rarity?: Rarity }
  | { type: 'goldPickup'; amount: number }
  | { type: 'bagFull' }
  | { type: 'groundGone'; id: number }
  | { type: 'equipChange' }
  | { type: 'potionUsed'; id: string; kind: PotionKind }
  | { type: 'potionFail'; kind: PotionKind; reason: 'none' | 'cooldown' | 'full' }
  | { type: 'npcOpen'; npcId: string; entityId: number }
  | { type: 'npcClose' }
  | { type: 'trade'; kind: 'buy' | 'sell'; gold: number }
  | { type: 'repair'; gold: number }
  | { type: 'forge'; kind: 'upgrade' | 'rarity' | 'reroll' | 'salvage'; success: boolean; plus: number; rarity: Rarity }
  | { type: 'durabilityLost' }
  | { type: 'autoState'; state: AutoState }
  | { type: 'autoStopped'; reason: 'broken' }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; kind: ProjectileKind }
  | { type: 'telegraph'; id: number; x: number; y: number; radius: number; delay: number; shape?: 'line' }
  | { type: 'telegraphResolved'; id: number; x: number; y: number; radius: number; hit: boolean }
  | { type: 'bossArena' }
  | { type: 'bossSummon'; ids: number[]; name: string }
  /** chefe entrou em fúria (boss.enrage) */
  | { type: 'bossEnrage'; id: number; name: string }
  | { type: 'bossDefeated'; name: string; respawnAt: number };

// Círculo de aviso no chão (golpe em área do chefe)
export interface Telegraph {
  id: number;
  x: number;
  y: number;
  radius: number;
  delay: number;
  remaining: number;
  ownerId: number;
  mult: number;
  /** golpe em linha (Rei dos Bandidos): retângulo que sai de (x, y) na direção angle, com length de comprimento e
   * meia-largura radius. Sem shape = círculo de raio radius centrado em (x, y). */
  shape?: 'line';
  angle?: number;
  length?: number;
}

export type AutoState = 'off' | 'on' | 'pausado';
export interface AutoConfig {
  skillsOff: string[]; // skills ativas desligadas no menu (o resto é usado)
  hpThreshold: number;
  mpThreshold: number; // % abaixo da qual bebe poção
  buyHp: number;
  buyMp: number; // quantidade comprada por viagem à vila
  sellIncomum: boolean;
  // escolha de alvo e revide (18/11/2026); os padrões reproduzem o comportamento antigo
  maxLevelAbove: number; // nível máximo dos alvos acima do personagem (0..5)
  grayMode: AutoGrayMode; // monstros 2+ níveis abaixo
  retaliate: AutoRetaliate; // revidar quem ataca
  onStrongAggro: AutoStrongAggro; // monstro acima do limite atacando (se não revida sempre)
  crowdAvoid: AutoCrowdAvoid; // peso de evitar atrair grupos
}
export type AutoGrayMode = 'last' | 'ignore' | 'normal';
export type AutoRetaliate = 'always' | 'inRange' | 'never';
export type AutoStrongAggro = 'keep' | 'flee' | 'town';
export type AutoCrowdAvoid = 'off' | 'low' | 'high';
// Balde de ~60 s de auto-combate ativo em mapa de caça (janela móvel de ~30 min)
export interface AutoBucket {
  sec: number;
  kills: number;
  xp: number;
  gold: number;
  potHp: number;
  potMp: number;
  levelSum: number;
  drops: Record<string, number>;
}
export interface AutoRate {
  killsPerMin: number;
  xpPerKill: number;
  goldPerKill: number;
  potHpPerKill: number;
  potMpPerKill: number;
  monLevel: number;
  sampleMin: number;
  drops: { baseId: string; rarity: Rarity; perKill: number }[];
}
export interface AutoSave {
  active: boolean;
  mapId: string;
  config?: Partial<AutoConfig>;
  buckets?: AutoBucket[];
}

export interface SaveData {
  version: number; // CHARACTER_SAVE_VERSION ao salvar; saves antigos passam por migrateCharacter (core/saveFormat.ts)
  name: string;
  classId: string;
  level: number;
  xp: number;
  freePoints: number;
  attributes: Attributes;
  mapId: string;
  lastSeen: number;
  ratioCursor?: number;
  seenTips?: string[];
  tipsEnabled?: boolean;
  skills?: Record<string, { level: number; xp: number }>;
  audio?: { sfx: number; music: number; muted: boolean };
  gold?: number;
  bag?: (ItemInstance | null)[];
  equipment?: Partial<Record<Slot, ItemInstance>>;
  auto?: AutoSave;
  bossRespawnAt?: number; // ms (relógio real) em que o General renasce (saves antigos; desde o marco 9 = bossRespawns.general_terracota)
  bossRespawns?: Record<string, number>; // id do chefe → ms (relógio real) em que renasce (marco 9)
  respawns?: Record<string, number>; // "mapa#índice" → ms (relógio real) em que o monstro comum renasce
  quest?: { stage: number; status: string; progress: number }; // cadeia principal de missões (marco 7)
  /** estoque do Mercador Ambulante (marco 9): janela de renovação e ofertas (item, preço, vendido) */
  /** Trial: maior nível vencido de cada chefe (id do chefe → 1–10) */
  trialProgress?: Record<string, number>;
  merchant?: { period: number; offers: { item: ItemInstance; price: number; sold: boolean }[] };
}

/** Por que uma ação de inventário/loja/ferreiro não aconteceu. A interface traduz (src/ui/actionError.ts). */
export type ActionError =
  | { code: 'notEquippable' }
  | { code: 'needLevel'; level: number }
  | { code: 'sectOnly'; sect: string }
  | { code: 'bagFull' }
  | { code: 'noGold' }
  | { code: 'talkToSeller' }
  | { code: 'talkToBlacksmith' }
  | { code: 'cannotForge' }
  | { code: 'noMaterials' }
  | { code: 'talkToMerchant' }
  | { code: 'soldOut' }
  | { code: 'trialLocked' };
