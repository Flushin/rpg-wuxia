// Ultimate (golpe especial da seita): barra que enche com skills que acertam e é solta só pelo jogador.
// Regras em docs/decisoes/personagem-e-combate.md ("Ultimate"). Por enquanto só a Tormenta tem.
import ultJson from '../data/ultimates.json';
import { localize } from './i18n';

export interface UltimateDef {
  id: string;
  name: string;
  unlock: number;
  color: string;
  description: string;
  /** skills que acertam pelo menos um monstro para encher a barra */
  charge: number;
  /** raio em tiles em volta do personagem */
  radius: number;
  /** segundos de raios (o personagem fica parado na pose) */
  duration: number;
  /** raios ao longo da duração, cada um em todos os monstros do raio */
  strikes: number;
  strikeMult: number;
  /** estouro no fim */
  finalMult: number;
  /** até quantos monstros levam o dano cheio; acima disso o dano total é dividido */
  fullTargets: number;
  /** segundos sem combate até a barra começar a esvaziar */
  idleDelay: number;
  /** pontos de carga perdidos por segundo depois disso */
  idleDrain: number;
}

export const ULTIMATES = localize('ultimates', ultJson) as unknown as Record<string, UltimateDef>;
export const ultimateOf = (classId: string): UltimateDef | undefined => ULTIMATES[classId];

/** Multiplicador de dano por monstro com `n` monstros no raio (dano total dividido acima de fullTargets). */
export const ultSplit = (def: UltimateDef, n: number) => (n > def.fullTargets ? def.fullTargets / n : 1);
