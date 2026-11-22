// Ultimate (golpe especial da seita): barra que enche com skills que acertam e é solta só pelo jogador.
// Regras em docs/decisoes/personagem-e-combate.md ("Ultimate"). Cada seita tem uma, em src/data/ultimates.json.
import ultJson from '../data/ultimates.json';
import { localize } from './i18n';
import type { BuffKind } from './types';

/** efeito num monstro atingido (mesmo formato do `debuff` das skills) */
export interface UltDebuff {
  kind: BuffKind;
  value: number;
  duration: number;
}

export interface UltimateDef {
  id: string;
  name: string;
  unlock: number;
  /** cores do botão/arco e do efeito: principal, brilho em volta, miolo claro, fundo da barra e texto sobre a cor */
  color: string;
  glow: string;
  core: string;
  dark: string;
  ink: string;
  /** ideograma no botão e no arco */
  icon: string;
  /** efeito visual em src/render/skillFx.ts */
  fx: string;
  /** sons (chaves de public/audio/sfx) da pose, de cada golpe e do estouro */
  sounds: { start: string; strike: string; final: string };
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
  /** efeito em cada golpe que acerta (ex.: lentidão da Geada) */
  strikeDebuff?: UltDebuff;
  /** estouro no fim */
  finalMult: number;
  /** efeito no estouro (ex.: congelar = atordoar) */
  finalDebuff?: UltDebuff;
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
