export type Element = 'fire' | 'ice' | 'thunder' | 'poison';
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'poison'];
export type AttrKey = 'strength' | 'intelligence' | 'stamina' | 'agility' | 'willpower';
export const ATTR_KEYS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
export type Attributes = Record<AttrKey, number>;
export type ElementMap = Record<Element, number>;
export type DamageType = 'physical' | 'spiritual';
export interface Point { x: number; y: number }

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
}

export type GameEvent =
  | { type: 'attack'; fromId: number; toId: number; ranged: boolean }
  | { type: 'hit'; targetId: number; targetKind: Entity['kind']; x: number; y: number; amount: number; crit: boolean }
  | { type: 'miss'; targetId: number; targetKind: Entity['kind']; x: number; y: number }
  | { type: 'death'; id: number }
  | { type: 'kill'; monsterId: string }
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
  | { type: 'shieldAbsorb'; targetId: number; amount: number; x: number; y: number };

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
}
