export type Element = 'fire' | 'ice' | 'thunder' | 'poison';
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'poison'];
export type AttrKey = 'strength' | 'intelligence' | 'stamina' | 'agility' | 'willpower';
export const ATTR_KEYS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
export type Attributes = Record<AttrKey, number>;
export type ElementMap = Record<Element, number>;
export type DamageType = 'physical' | 'spiritual';
export interface Point { x: number; y: number }

export type Slot = 'colar' | 'tronco' | 'arma' | 'cabeca' | 'calca' | 'bota';
export type Rarity = 'comum' | 'incomum' | 'raro';
export interface Bonus { stat: string; value: number }
// Instância de item. Poções usam qty (empilham); equipamentos usam rarity/bonuses/durability.
export interface ItemInstance {
  uid: string; baseId: string; rarity: Rarity; bonuses: Bonus[]; ilvl: number; durability: number; qty?: number;
}
export interface GroundItem { id: number; x: number; y: number; item?: ItemInstance; gold?: number; expires: number }
export type PotionKind = 'hp' | 'mp';

export interface Derived {
  maxHp: number; maxMana: number;
  physAtk: number; spiritAtk: number;
  physDef: number; spiritDef: number;
  hit: number; evasion: number;
  critChance: number; critDamage: number;
}

export type BuffKind = 'defReduction' | 'slow' | 'shield';
// value: fração (defReduction/slow) ou pontos de absorção restantes (shield)
export interface Buff { id: string; kind: BuffKind; value: number; remaining: number; duration: number }
export type SkillFailReason = 'mana' | 'cooldown' | 'notarget' | 'locked' | 'blocked';

export type AiState = 'idle' | 'wander' | 'chase' | 'return';

export interface Entity {
  id: number;
  kind: 'player' | 'monster' | 'npc';
  name: string;
  level: number;
  x: number; y: number;
  hp: number; mana: number;
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
  spawnKey: string; // "mapa#índice" do ponto de spawn (renascimento com tempo); '' = sem ponto
}

export type GameEvent =
  | { type: 'attack'; fromId: number; toId: number; ranged: boolean }
  | { type: 'hit'; targetId: number; targetKind: Entity['kind']; x: number; y: number; amount: number; crit: boolean }
  | { type: 'miss'; targetId: number; targetKind: Entity['kind']; x: number; y: number }
  | { type: 'death'; id: number }
  | { type: 'kill'; monsterId: string; level?: number }
  | { type: 'xp'; amount: number }
  | { type: 'levelup'; level: number }
  | { type: 'playerDeath' }
  | { type: 'mapChange'; mapId: string }
  | { type: 'skillCast'; skillId: string; casterId: number; x: number; y: number; targetId: number | null; tx: number; ty: number; ranged: boolean }
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
  | { type: 'durabilityLost' }
  | { type: 'autoState'; state: AutoState }
  | { type: 'autoStopped'; reason: 'broken' }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; kind: 'arrow' }
  | { type: 'telegraph'; id: number; x: number; y: number; radius: number; delay: number }
  | { type: 'telegraphResolved'; id: number; x: number; y: number; radius: number; hit: boolean }
  | { type: 'bossArena' }
  | { type: 'bossSummon'; ids: number[] }
  | { type: 'bossDefeated'; respawnAt: number };

// Círculo de aviso no chão (golpe em área do chefe)
export interface Telegraph { id: number; x: number; y: number; radius: number; delay: number; remaining: number; ownerId: number; mult: number }

export type AutoState = 'off' | 'on' | 'pausado';
export interface AutoConfig {
  skillsOff: string[]; // skills ativas desligadas no menu (o resto é usado)
  hpThreshold: number; mpThreshold: number; // % abaixo da qual bebe poção
  buyHp: number; buyMp: number; // quantidade comprada por viagem à vila
  sellIncomum: boolean;
}
// Balde de ~60 s de auto-combate ativo em mapa de caça (janela móvel de ~30 min)
export interface AutoBucket { sec: number; kills: number; xp: number; gold: number; potHp: number; potMp: number; levelSum: number; drops: Record<string, number> }
export interface AutoRate {
  killsPerMin: number; xpPerKill: number; goldPerKill: number; potHpPerKill: number; potMpPerKill: number; monLevel: number; sampleMin: number;
  drops: { baseId: string; rarity: Rarity; perKill: number }[];
}
export interface AutoSave { active: boolean; mapId: string; config?: Partial<AutoConfig>; buckets?: AutoBucket[] }

export interface SaveData {
  version: 1;
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
  bossRespawnAt?: number; // ms (relógio real) em que o chefe renasce
  respawns?: Record<string, number>; // "mapa#índice" → ms (relógio real) em que o monstro comum renasce
}
