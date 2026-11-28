// Bônus de XP e de ouro ganhos (Fundador hoje; itens/poções vendidos no futuro). Cada fonte entra em activeBuffs();
// o jogo multiplica tudo e mostra o multiplicador no número que aparece ao ganhar (eventFeedback/rewards).
import type { World } from './world';
import { founderGoldMul, founderXpMul } from './founder';

export interface Buff {
  id: string;
  xpMul: number;
  goldMul: number;
}

/** Bônus ativos agora. Para um item novo: acrescente uma fonte aqui (ex.: w.buffs com tempo restante). */
export function activeBuffs(w: World): Buff[] {
  const out: Buff[] = [];
  const fx = founderXpMul(w),
    fg = founderGoldMul(w);
  if (fx > 1 || fg > 1) out.push({ id: 'fundador', xpMul: fx, goldMul: fg });
  return out;
}

export const xpMul = (w: World) => activeBuffs(w).reduce((m, b) => m * b.xpMul, 1);
export const goldMul = (w: World) => activeBuffs(w).reduce((m, b) => m * b.goldMul, 1);
/** Ouro ganho já com os bônus. */
export const withGoldBonus = (w: World, g: number) => Math.round(g * goldMul(w));
