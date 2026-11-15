import { ATTR_KEYS, type AttrKey, type Attributes } from './types';
import { emptyAttrs } from './stats';

export function ratioSequence(ratio: Partial<Record<AttrKey, number>>): AttrKey[] {
  const seq: AttrKey[] = [];
  for (const k of ATTR_KEYS) for (let i = 0; i < (ratio[k] ?? 0); i++) seq.push(k);
  return seq;
}

// Distribui pontos em round-robin segundo a proporção; o cursor mantém o ciclo entre chamadas.
export function distributeByRatio(points: number, ratio: Partial<Record<AttrKey, number>>, cursor: number): { added: Attributes; spent: number; cursor: number } {
  const seq = ratioSequence(ratio), added = emptyAttrs();
  if (!seq.length || points <= 0) return { added, spent: 0, cursor };
  let c = ((cursor % seq.length) + seq.length) % seq.length;
  for (let i = 0; i < points; i++) { added[seq[c]]++; c = (c + 1) % seq.length; }
  return { added, spent: points, cursor: c };
}
