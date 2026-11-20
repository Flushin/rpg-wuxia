import { PROGRESSION, levelsReadyFor, xpBankCap } from './data';
import { BASES, POTIONS } from './items';
import { Rng } from './rng';
import { bal, balanceOffline } from './balance';
import type { AutoRate, PotionKind, Rarity } from './types';

// Eficiência por faixa de tempo fora: 60% até 12 h, 40% de 12 a 18 h, 20% de 18 a 24 h, 0 depois.
export const OFFLINE_TIERS: { untilH: number; eff: number }[] = [
  { untilH: 12, eff: 0.6 },
  { untilH: 18, eff: 0.4 },
  { untilH: 24, eff: 0.2 },
];
balanceOffline(OFFLINE_TIERS); // multiplicadores de src/data/balance.json
export const MAX_OFFLINE_DROPS = 2000;
/** Teto de ouro por volta do offline, em horas de ouro de caça no ritmo medido (abates + vendas automáticas). */
export const OFFLINE_GOLD_CAP_HOURS = 3;

/** Ouro máximo que uma volta do offline pode dar, pelo ritmo medido do auto (acompanha o nível sozinho). */
export function offlineGoldCap(rate: AutoRate): number {
  return Math.max(
    0,
    Math.floor(rate.killsPerMin * 60 * rate.goldPerKill * OFFLINE_GOLD_CAP_HOURS * bal('offline.teto_ouro')),
  );
}
/** Ao voltar do segundo plano (app minimizado, aba escondida): ganho offline só se ficou fora pelo menos isto (P3). */
export const RESUME_OFFLINE_MIN_MS = 5 * 60_000;

/**
 * O que pode cair offline: só poções e equipamento Comum. Material, consumível e equipamento
 * Incomum/Raro ficam para quem joga (ou deixa o auto ligado com o jogo aberto).
 */
export function offlineDropAllowed(baseId: string, rarity: Rarity): boolean {
  if (POTIONS[baseId]) return true;
  return baseId in BASES && rarity === 'comum';
}

export interface OfflineInput {
  elapsedMs: number;
  rate: AutoRate;
  level: number;
  xp: number;
  potions: Record<PotionKind, number>;
  seed: number;
  /** multiplica a eficiência (mapa de caça com offlineMul em mapsConfig; nível 30: 5/6 nos mapas 20–30) */
  effMul?: number;
}
export interface OfflineResult {
  elapsedMin: number;
  effMin: number;
  efficiency: number;
  kills: number;
  xp: number;
  gold: number;
  /** teto de ouro desta volta (abates + vendas automáticas) */
  goldCap: number;
  /** XP guardada depois da volta, níveis que ela paga e se encheu (o excesso se perdeu) */
  newXp: number;
  levelsReady: number;
  xpCapped: boolean;
  drops: { baseId: string; rarity: Rarity; qty: number }[];
  potionsUsed: Record<PotionKind, number>;
}

// minutos efetivos de caça; tempo negativo (relógio adulterado) vira 0
export function effectiveMinutes(elapsedMs: number): number {
  const h = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs / 3.6e6 : 0;
  let prev = 0,
    out = 0;
  for (const t of OFFLINE_TIERS) {
    out += Math.max(0, Math.min(h, t.untilH) - prev) * t.eff;
    prev = t.untilH;
  }
  return out * 60;
}

export function computeOffline(inp: OfflineInput): OfflineResult {
  const { rate } = inp,
    rng = new Rng(inp.seed >>> 0);
  const elapsedMin = Number.isFinite(inp.elapsedMs) && inp.elapsedMs > 0 ? inp.elapsedMs / 60000 : 0;
  const effMin = effectiveMinutes(inp.elapsedMs) * Math.max(0, inp.effMul ?? 1);
  const kills = Math.max(0, Math.floor(rate.killsPerMin * effMin + 1e-6));
  const goldCap = offlineGoldCap(rate);
  const gold = Math.min(goldCap, Math.floor(kills * rate.goldPerKill));
  // XP guardada (o jogador sobe de nível quando quiser): até XP_BANK_LEVELS níveis prontos, o excesso se perde
  const raw = inp.level < PROGRESSION.levelCap ? Math.floor(kills * rate.xpPerKill) : 0;
  const gained = Math.min(raw, Math.max(0, xpBankCap(inp.level) - inp.xp));
  const x = inp.xp + gained;
  const drops: OfflineResult['drops'] = [];
  const potionDrops: Record<PotionKind, number> = { hp: 0, mp: 0 };
  for (const d of rate.drops) {
    if (!offlineDropAllowed(d.baseId, d.rarity)) continue;
    const exp = kills * d.perKill;
    const qty = Math.min(MAX_OFFLINE_DROPS, Math.floor(exp) + (rng.next() < exp - Math.floor(exp) ? 1 : 0));
    if (qty <= 0) continue;
    drops.push({ baseId: d.baseId, rarity: d.rarity, qty });
    const pd = POTIONS[d.baseId];
    if (pd) potionDrops[pd.kind] += qty;
  }
  const potionsUsed: Record<PotionKind, number> = { hp: 0, mp: 0 };
  potionsUsed.hp = Math.min(Math.round(kills * rate.potHpPerKill), inp.potions.hp + potionDrops.hp);
  potionsUsed.mp = Math.min(Math.round(kills * rate.potMpPerKill), inp.potions.mp + potionDrops.mp);
  return {
    elapsedMin,
    effMin,
    efficiency: elapsedMin > 0 ? effMin / elapsedMin : 0,
    kills,
    xp: gained,
    gold,
    goldCap,
    newXp: x,
    levelsReady: levelsReadyFor(inp.level, x),
    xpCapped: gained < raw,
    drops,
    potionsUsed,
  };
}
