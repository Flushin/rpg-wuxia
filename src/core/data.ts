import classesJson from '../data/classes.json';
import monstersJson from '../data/monsters.json';
import progressionJson from '../data/progression.json';
import type { AttrKey, Attributes, DamageType, Element, ElementMap } from './types';

export interface ClassDef {
  id: string; name: string; description: string; rangeLabel: string;
  damageType: DamageType; element: Element;
  attackRange: number; attackWhileMoving?: boolean; attackInterval: number; moveSpeed: number; color: string;
  baseAttributes: Attributes; levelUpAttributes: Attributes;
  elementAttack: Partial<ElementMap>;
  recommended: { attr: AttrKey; reason: string }[];
  optional: { attr: AttrKey; reason: string }[];
  recommendedRatio: Partial<Record<AttrKey, number>>;
}
export interface MonsterDef {
  id: string; name: string; sprite: string; minLevel: number; maxLevel: number;
  baseAttributes: Attributes; perLevel: Attributes; damageType: DamageType;
  aggroRange: number; leashRange: number; attackRange: number; attackInterval: number;
  moveSpeed: number; xpBase: number; xpPerLevel: number; respawnSeconds: number;
}
export interface Progression { levelCap: number; xpToNext: number[]; freePointsPerLevel: number }

export const CLASSES = classesJson as unknown as Record<string, ClassDef>;
export const MONSTERS = monstersJson as unknown as Record<string, MonsterDef>;
export const PROGRESSION = progressionJson as Progression;
