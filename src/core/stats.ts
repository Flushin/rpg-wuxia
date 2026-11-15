import type { Attributes, Derived, ElementMap } from './types';

export const emptyElements = (): ElementMap => ({ fire: 0, ice: 0, thunder: 0, poison: 0 });
export const emptyAttrs = (): Attributes => ({ strength: 0, intelligence: 0, stamina: 0, agility: 0, willpower: 0 });

// Única função de stats derivados.
export function computeDerived(a: Attributes): Derived {
  return {
    maxHp: 50 + a.stamina * 10,
    maxMana: 20 + a.willpower * 5,
    physAtk: 2 + a.strength * 2,
    spiritAtk: 2 + a.intelligence * 2,
    physDef: a.stamina * 1,
    spiritDef: a.willpower * 1,
    hit: 80 + a.agility * 2,
    evasion: a.agility * 1,
    critChance: Math.min(0.6, 0.05 + a.agility * 0.005),
    critDamage: 1.5 + a.agility * 0.02,
  };
}

// Origem de cada atributo: base da classe + níveis (automáticos e pontos distribuídos) + equipamento.
// `gear` são os bônus dos equipamentos (itens quebrados já ficam fora). total = base + levels + equip.
export interface AttrParts { base: number; levels: number; equip: number; total: number }
export function attrBreakdown(attrs: Attributes, base: Attributes, gear: Record<string, number>): Record<keyof Attributes, AttrParts> {
  const out = {} as Record<keyof Attributes, AttrParts>;
  for (const k of Object.keys(attrs) as (keyof Attributes)[]) {
    const equip = gear[k] ?? 0;
    out[k] = { base: base[k], levels: attrs[k] - base[k], equip, total: attrs[k] + equip };
  }
  return out;
}
