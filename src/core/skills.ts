import skillsJson from '../data/skills.json';
import type { BuffKind } from './types';

export interface SkillDef {
  id: string; name: string; type: 'active' | 'passive'; unlock: number; color: string; fx?: string; description: string;
  mana?: number; cooldown?: number;
  target?: 'target' | 'none'; range?: 'melee' | number; dash?: boolean;
  area?: 'self' | 'target'; radius?: number;
  hits?: number[];
  debuff?: { kind: BuffKind; value: number; duration: number };
  shield?: { percent: number; duration: number };
  passive?: { attackSpeed?: number; crit?: number; manaRegen?: number };
}
export interface SkillState { level: number; xp: number; cd: number }

export const SKILLS = skillsJson as unknown as Record<string, SkillDef[]>;
export const SKILL_MAX_LEVEL = 10;
export const GLOBAL_COOLDOWN = 0.5;
export const LEVEL_BONUS = 0.08;

export const skillScale = (level: number) => 1 + LEVEL_BONUS * (Math.max(1, level) - 1);
export const skillXpToNext = (level: number) => Math.round(20 * Math.pow(1.5, level - 1));
export const classActives = (classId: string) => (SKILLS[classId] ?? []).filter((s) => s.type === 'active');
export const initials = (name: string) => name.split(/\s+/).filter((w) => w.length > 2 || name.split(/\s+/).length === 1).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
