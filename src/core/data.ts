import classesJson from '../data/classes.json';
import monstersJson from '../data/monsters.json';
import progressionJson from '../data/progression.json';
import { localize } from './i18n';
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
  scale?: number; // tamanho do sprite
  defMul?: { phys: number; spirit: number }; // multiplicadores sobre a defesa derivada
  keepDistance?: number; // arqueiro: recua se o jogador chegar mais perto que isso
  projectile?: 'arrow';
  groupAggro?: boolean; // monstros do mesmo grupo (propriedade "group" do mapa) entram juntos
  boss?: {
    arenaRadius: number; // área do chefe (leash e auto-combate evita)
    aoe: { radius: number; delay: number; mult: number; interval: number; intervalPhase2: number };
    summon: { monsterId: string; count: number; level: number; atHpPct: number };
  };
  loot?: {
    gold?: { min: number; max: number; perLevel?: number }; // perLevel: soma (nível-1)*perLevel aos dois limites
    potions?: { id: string; chance: number; minMonsterLevel?: number }[];
    equipment?: EquipDrop | EquipDrop[];
    guaranteed?: { rarity: 'comum' | 'incomum' | 'raro'; reqLevel: number }; // 1 item garantido (slot aleatório)
  };
}
export interface EquipDrop { chance: number; maxReqLevel: number; minReqLevel?: number; minMonsterLevel?: number }
export interface Progression { levelCap: number; xpToNext: number[]; freePointsPerLevel: number }

export const CLASSES = localize('classes', classesJson) as unknown as Record<string, ClassDef>;
export const MONSTERS = localize('monsters', monstersJson) as unknown as Record<string, MonsterDef>;
export const PROGRESSION = progressionJson as Progression;
