// Trial: arena onde o jogador escolhe um dos chefes do jogo e um nível de 1 a 10 (chefe nível 21 a 30).
// Regras (aprovadas pelo Lucas em 19/11/2026): portal na saída sul da vila (menu); personagem nível 20+; entrada em
// ouro que sobe a cada nível; vencer o nível N de um chefe libera o N+1 daquele chefe (progresso salvo); a chance de
// drop de equipamento e material ganha +12% no nível 1 e esse bônus
// cresce 5% a cada nível (12,60%, 13,23% … 18,62% no nível 10). Instância como as masmorras
// (Auto não funciona, nada renasce, morrer/sair/fechar o jogo encerra a corrida).
//
// Balanceamento (docs/balanceamento.md, seção "Trial"): no Trial todos os chefes têm a mesma vida e o mesmo dano por
// segundo para o nível escolhido; cada um mantém as mecânicas (círculos, linhas, invocação, fúria, velocidade) e o
// ponto fraco: defesa alta contra um tipo de dano (físico ou espiritual) e baixa contra o outro.
import { MONSTERS, type MonsterDef } from './data';

export const TRIAL_MAP = 'trial';
export const TRIAL_TIERS = 10;
/** nível mínimo do personagem para entrar */
export const TRIAL_MIN_LEVEL = 20;

/** Chefes do Trial: todos os chefes do jogo, do mais fraco ao mais forte no mundo aberto/masmorra. */
export const TRIAL_BOSSES: string[] = Object.values(MONSTERS)
  .filter((m) => !!m.boss)
  .sort((a, b) => a.minLevel - b.minLevel || a.boss!.aoe.mult - b.boss!.aoe.mult)
  .map((m) => m.id);

export const isTrialBoss = (id: string) => TRIAL_BOSSES.includes(id);
export const validTier = (tier: number) => Number.isInteger(tier) && tier >= 1 && tier <= TRIAL_TIERS;

/** Nível do chefe no nível N do Trial: 21 no nível 1 até 30 no nível 10. */
export const trialBossLevel = (tier: number) => 20 + tier;
/** Ouro cobrado para entrar no nível N: 1000 no nível 1, +200 por nível (2800 no 10). */
export const trialCost = (tier: number) => 1000 + 200 * (tier - 1);
/** Bônus de drop (equipamento e material): 12% no nível 1 e, a cada nível, +5% sobre o bônus anterior
 *  (12,60% no 2 … 18,62% no 10). Multiplicador da chance: 1 + bônus. */
export const trialDropMul = (tier: number) => 1 + 0.12 * 1.05 ** (tier - 1);
/** Bônus de drop em %, com 2 casas (12,00 … 18,62), para o menu e a wiki. */
export const trialDropPct = (tier: number) => Math.round((trialDropMul(tier) - 1) * 10000) / 100;

// ---------- força do chefe por nível ----------
/** Números do chefe no nível 21 do Trial e o crescimento por nível acima disso. */
export const TRIAL_STATS = {
  hp: 9000,
  hpGrowth: 1.1,
  /** ataque (físico) de um chefe que bate a cada REF_INTERVAL s; quem bate mais devagar bate mais forte */
  atk: 58,
  atkGrowth: 1.065,
  refInterval: 2.4,
  /** defesa contra o tipo de dano em que o chefe é forte e contra o do ponto fraco */
  defStrong: 300,
  defWeak: 110,
  defGrowth: 1.04,
};

/** O ponto fraco do chefe: o tipo de dano contra o qual a defesa dele é menor (a mesma do jogo normal). */
/** Só o que o Trial lê do chefe (a wiki passa o tipo dela). */
type BossLike = Pick<MonsterDef, 'baseAttributes' | 'defMul' | 'attackInterval'>;

export function trialWeakness(def: BossLike): 'physical' | 'spiritual' {
  const physDef = def.baseAttributes.stamina * (def.defMul?.phys ?? 1),
    spiritDef = def.baseAttributes.willpower * (def.defMul?.spirit ?? 1);
  return physDef <= spiritDef ? 'physical' : 'spiritual';
}

export interface TrialStats {
  hp: number;
  atk: number;
  physDef: number;
  spiritDef: number;
}

/** Vida, ataque e defesas do chefe no nível (21–30) do Trial. */
export function trialStats(def: BossLike, level: number): TrialStats {
  const S = TRIAL_STATS,
    n = level - 21,
    strong = Math.round(S.defStrong * S.defGrowth ** n),
    weak = Math.round(S.defWeak * S.defGrowth ** n),
    physWeak = trialWeakness(def) === 'physical';
  return {
    hp: Math.round(S.hp * S.hpGrowth ** n),
    atk: Math.round(S.atk * S.atkGrowth ** n * (def.attackInterval / S.refInterval)),
    physDef: physWeak ? weak : strong,
    spiritDef: physWeak ? strong : weak,
  };
}

/** Nível dos ajudantes invocados no Trial: 3 abaixo do chefe. */
export const trialSummonLevel = (bossLevel: number) => bossLevel - 3;

// ---------- recompensa ----------
/** XP e ouro do chefe no nível N (o ouro cobre a entrada com um pouco de sobra). */
export const trialXp = (tier: number) => 9000 + 1000 * (tier - 1);
export const trialGold = (tier: number): [number, number] => [
  Math.round(trialCost(tier) * 1.0),
  Math.round(trialCost(tier) * 1.3),
];
/** Drop normal do chefe no Trial (antes do bônus): 1 Raro garantido, 1 equipamento de raridade sorteada e os materiais
 *  do chefe. Bases nv 20 nos níveis 1–5 do Trial e nv 25 nos 6–10 (nível 30, etapa 3); os itens saem com o nível do
 *  chefe (bônus mais altos). */
export const trialEquipReqLevel = (tier: number) => (tier <= 5 ? 20 : 25);

/** Progresso salvo: maior nível vencido de cada chefe (0 = nenhum). Libera até o seguinte. */
export type TrialProgress = Record<string, number>;
export const trialUnlocked = (progress: TrialProgress, bossId: string) =>
  Math.min(TRIAL_TIERS, (progress[bossId] ?? 0) + 1);

export function sanitizeTrialProgress(raw: unknown): TrialProgress {
  const out: TrialProgress = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Math.floor(Number(v));
    if (isTrialBoss(k) && n > 0) out[k] = Math.min(TRIAL_TIERS, n);
  }
  return out;
}
