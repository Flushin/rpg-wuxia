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
  | { type: 'mapChange'; mapId: string };

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
}
