import skillsJson from '../data/skills.json';
import { localize } from './i18n';
import type { BuffKind } from './types';

export interface SkillDef {
  id: string;
  name: string;
  type: 'active' | 'passive';
  unlock: number;
  color: string;
  fx?: string;
  description: string;
  mana?: number;
  cooldown?: number;
  target?: 'target' | 'none';
  range?: 'melee' | number;
  dash?: boolean;
  area?: 'self' | 'target';
  radius?: number;
  hits?: number[];
  debuff?: { kind: BuffKind; value: number; duration: number };
  shield?: { percent: number; duration: number };
  /** veneno: `percent` do dano normal, espalhado em tiques de 1 s durante `duration` (Víbora) */
  poison?: { percent: number; duration: number };
  /** atordoa o alvo atingido por estes segundos: não anda nem ataca (Titã) */
  stun?: number;
  /** cura `percent` do HP máximo ao longo de `duration` segundos (Víbora) */
  heal?: { percent: number; duration: number };
  passive?: PassiveBonus;
}
export interface PassiveBonus {
  attackSpeed?: number;
  crit?: number;
  manaRegen?: number;
  /** fração a menos de dano recebido (Titã) */
  damageTaken?: number;
  /** fração a mais de HP máximo (Titã) */
  maxHp?: number;
  /** fração a mais de dano em alvos envenenados (Víbora) */
  poisonedBonus?: number;
}
export interface SkillState {
  level: number;
  xp: number;
  cd: number;
}

export const SKILLS = localize('skills', skillsJson) as unknown as Record<string, SkillDef[]>;
const BY_ID = new Map(
  Object.values(SKILLS)
    .flat()
    .map((d) => [d.id, d]),
);
/** Skill de qualquer seita pelo id. */
export const skillById = (id: string): SkillDef | undefined => BY_ID.get(id);
export const SKILL_MAX_LEVEL = 10;
export const GLOBAL_COOLDOWN = 0.5;
export const LEVEL_BONUS = 0.08;

export const skillScale = (level: number) => 1 + LEVEL_BONUS * (Math.max(1, level) - 1);
export const skillXpToNext = (level: number) => Math.round(20 * Math.pow(1.5, level - 1));
export const classActives = (classId: string) => (SKILLS[classId] ?? []).filter((s) => s.type === 'active');
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2 || name.split(/\s+/).length === 1)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
