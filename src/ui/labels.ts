import { L } from '../core/i18n';
import type { AttrKey, Element } from '../core/types';
export const ATTR_LABELS: Record<AttrKey, string> = {
  strength: L('Força', 'Strength'),
  intelligence: L('Inteligência', 'Intelligence'),
  stamina: L('Vigor', 'Stamina'),
  agility: L('Agilidade', 'Agility'),
  willpower: L('Vontade', 'Willpower'),
};
export const ATTR_HINTS: Record<AttrKey, string> = {
  strength: L('dano físico', 'physical damage'),
  intelligence: L('dano espiritual', 'spiritual damage'),
  stamina: L('HP e defesa física', 'HP and physical defense'),
  agility: L('acerto, chance e dano de crítico', 'accuracy, crit chance and crit damage'),
  willpower: L('mana e defesa espiritual', 'mana and spiritual defense'),
};
export const ELEMENT_LABELS: Record<Element, string> = {
  fire: L('Fogo', 'Fire'),
  ice: L('Gelo', 'Ice'),
  thunder: L('Trovão', 'Thunder'),
  poison: L('Veneno', 'Poison'),
};
export const DAMAGE_LABELS = { physical: L('Físico', 'Physical'), spiritual: L('Espiritual', 'Spiritual') } as const;

// Botão X no canto superior direito das janelas (fica visível ao rolar). `attr` é o atributo que o painel já escuta para fechar.
export const closeX = (attr: string) =>
  `<button class="win-x" ${attr} aria-label="${L('Fechar', 'Close')}" title="${L('Fechar', 'Close')}">✕</button>`;
