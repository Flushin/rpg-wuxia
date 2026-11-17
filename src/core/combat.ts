import type { Derived, DamageType, Element, ElementMap } from './types';
import type { Rng } from './rng';

export interface Combatant {
  derived: Derived;
  damageType: DamageType;
  element: Element | null;
  elemAtk: ElementMap;
  elemRes: ElementMap;
}
export interface AttackResult {
  hit: boolean;
  crit: boolean;
  amount: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const hitChance = (hit: number, evasion: number) => clamp(0.5 + (hit - evasion) / 200, 0.05, 0.95);

export function rollAttack(att: Combatant, def: Combatant, rng: Rng): AttackResult {
  if (rng.next() > hitChance(att.derived.hit, def.derived.evasion)) return { hit: false, crit: false, amount: 0 };
  const physical = att.damageType === 'physical';
  const atk = physical ? att.derived.physAtk : att.derived.spiritAtk;
  const df = physical ? def.derived.physDef : def.derived.spiritDef;
  let dmg = atk * rng.range(0.9, 1.1) * (1 - df / (df + 100));
  if (att.element) dmg += att.elemAtk[att.element] * (1 - clamp(def.elemRes[att.element], 0, 90) / 100);
  const crit = rng.next() < att.derived.critChance;
  if (crit) dmg *= att.derived.critDamage;
  return { hit: true, crit, amount: Math.max(1, Math.round(dmg)) };
}
