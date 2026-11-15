import type { AttrKey, Element } from '../core/types';
export const ATTR_LABELS: Record<AttrKey, string> = {
  strength: 'Força', intelligence: 'Inteligência', stamina: 'Vigor', agility: 'Agilidade', willpower: 'Vontade',
};
export const ATTR_HINTS: Record<AttrKey, string> = {
  strength: 'dano físico', intelligence: 'dano espiritual', stamina: 'HP e defesa física',
  agility: 'acerto, chance e dano de crítico', willpower: 'mana e defesa espiritual',
};
export const ELEMENT_LABELS: Record<Element, string> = { fire: 'Fogo', ice: 'Gelo', thunder: 'Trovão', poison: 'Veneno' };
export const DAMAGE_LABELS = { physical: 'Físico', spiritual: 'Espiritual' } as const;
