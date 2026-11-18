import skillsJson from '../data/skills.json';
import { localize } from './i18n';
import { bal, balanceSkills } from './balance';
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
balanceSkills(SKILLS); // multiplicadores de src/data/balance.json
const BY_ID = new Map(
  Object.values(SKILLS)
    .flat()
    .map((d) => [d.id, d]),
);
/** Skill de qualquer seita pelo id. */
export const skillById = (id: string): SkillDef | undefined => BY_ID.get(id);
export const SKILL_MAX_LEVEL = 15;
export const GLOBAL_COOLDOWN = 0.5;
export const LEVEL_BONUS = 0.08;

export const skillScale = (level: number) => 1 + LEVEL_BONUS * bal('skills.bonus_por_nivel') * (Math.max(1, level) - 1);
// usos para subir do nível `level` para o próximo: ×1,5 por nível até o 10; do 10 ao 15 cresce ×1,4 (um pouco mais
// rápido que manter ×1,5, decidido pelo Lucas em 18/11/2026). "xp.skills" +10% = cada uso vale 10% a mais
// (o requisito cai na mesma proporção).
export const skillXpToNext = (level: number) =>
  Math.max(
    1,
    Math.round(
      (level < 10 ? 20 * Math.pow(1.5, level - 1) : 20 * Math.pow(1.5, 8) * Math.pow(1.4, level - 9)) /
        bal('xp.skills'),
    ),
  );
export const classActives = (classId: string) => (SKILLS[classId] ?? []).filter((s) => s.type === 'active');
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2 || name.split(/\s+/).length === 1)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
