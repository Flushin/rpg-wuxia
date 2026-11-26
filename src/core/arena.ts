// Arena do Porto Noturno (docs/decisoes/arena.md): 1v1 contra um bot de outra seita. O poder do jogador nunca muda;
// o bot recebe de ARENA_POWER_MIN a ARENA_POWER_MAX do poder do jogador conforme os pontos (ELO). Vencer sobe os
// pontos e o bot fica mais forte, então cada jogador para perto de 50% de vitórias. Aqui ficam as regras puras;
// a luta no mundo fica em src/core/world/arena.ts.
import arenaJson from '../data/arena.json';
import { localize } from './i18n';
import { expectedDamage } from './combat';
import { bal } from './balance';
import type { Entity } from './types';
import type { Bot } from './bots';

/** Pontos de quem nunca lutou. */
export const ARENA_START = 1000;
/** Poder do bot em relação ao do jogador: de 80% a 130%. */
export const ARENA_POWER_MIN = 0.8;
export const ARENA_POWER_MAX = 1.2;
/** Cada ARENA_POWER_STEP pontos acima/abaixo de ARENA_START = +/-5% de poder do bot. */
export const ARENA_POWER_STEP = 100;
/** Sorteio da força do bot em volta dos pontos do jogador (vencer um bot mais forte vale mais). */
export const ARENA_SPREAD = 150;
/** ELO: fator K e limites de pontos por luta. */
export const ARENA_K = 40;
export const ARENA_DELTA_MIN = 10;
export const ARENA_DELTA_MAX = 30;
/** Moeda da arena por luta. */
export const ARENA_COINS = { win: 30, loss: 10 };
/** Luta longa demais: acaba e vence quem tiver mais vida (em %). */
export const ARENA_TIME_LIMIT = 120;
/** Todo dano na arena (dos dois lados) é multiplicado por um fator calculado na entrada: o golpe normal do jogador
 *  levaria ARENA_TTK segundos para tirar a vida dele mesmo. Assim a duração não depende do equipamento (com muito
 *  crítico e elemento uma skill matava no primeiro golpe). Vale igual para os dois: o poder relativo não muda. */
export const ARENA_TTK = 60;
export const arenaDamageMul = (player: Entity, bot: Entity) =>
  Math.min(1, player.derived.maxHp / (basicDps(player, bot) * ARENA_TTK));
/** Contagem antes da luta começar (s); ninguém anda nem ataca. */
export const ARENA_COUNTDOWN = 3;

export interface ArenaTitle {
  name: string;
  price: number;
  minPoints: number;
  color: string;
}
export const ARENA_TITLES = localize('arenaTitles', arenaJson.titles) as Record<string, ArenaTitle>;

/** Faixas do ranking (pelos pontos). */
export const ARENA_RANKS: { min: number; name: string; en: string; color: string }[] = [
  { min: 0, name: 'Bronze', en: 'Bronze', color: '#cd8b57' },
  { min: 900, name: 'Prata', en: 'Silver', color: '#c9d4e0' },
  { min: 1100, name: 'Ouro', en: 'Gold', color: '#ffd23f' },
  { min: 1300, name: 'Jade', en: 'Jade', color: '#7ee0b0' },
  { min: 1500, name: 'Lenda', en: 'Legend', color: '#e6a6ff' },
];
export const arenaRank = (points: number) => [...ARENA_RANKS].reverse().find((r) => points >= r.min)!;

/** Progresso salvo da arena. */
export interface ArenaState {
  points: number;
  coins: number;
  wins: number;
  losses: number;
  titles: string[];
  title: string | null;
}
export const newArenaState = (): ArenaState => ({
  points: ARENA_START,
  coins: 0,
  wins: 0,
  losses: 0,
  titles: [],
  title: null,
});

/** Poder do bot para uma força (em pontos): 80% a 130% do jogador. */
export const arenaPower = (rating: number) =>
  Math.max(ARENA_POWER_MIN, Math.min(ARENA_POWER_MAX, 1 + ((rating - ARENA_START) / ARENA_POWER_STEP) * 0.05));

/** Chance esperada de vitória (ELO) contra um bot de força `bot`. */
export const arenaExpected = (points: number, bot: number) => 1 / (1 + 10 ** ((bot - points) / 400));

/** Pontos ganhos (positivo) ou perdidos (negativo) na luta. */
export function arenaDelta(points: number, bot: number, win: boolean): number {
  const e = arenaExpected(points, bot),
    raw = Math.round(ARENA_K * (win ? 1 - e : e)),
    d = Math.max(ARENA_DELTA_MIN, Math.min(ARENA_DELTA_MAX, raw));
  return win ? d : -d;
}

const critMul = (e: Entity) => 1 + Math.min(1, e.derived.critChance) * Math.max(0, e.derived.critDamage - 1);
/** Dano por segundo do golpe normal de `a` em `t` (com crítico médio). */
export const basicDps = (a: Entity, t: Entity) => (expectedDamage(a, t) * critMul(a)) / a.attackInterval;

/** Ajusta o bot ao poder do jogador: defesas iguais às do jogador; vida e dano do golpe = raiz de `power` vezes os
 *  do jogador (poder = vida × dano, então o bot fica com `power` vezes o poder dele). O jogador não muda. */
export function scaleArenaBot(b: Bot, player: Entity, power: number, playerClass: string) {
  const e = b.e,
    d = e.derived,
    pd = player.derived,
    // calibragem por seita (balance.json arena.poder_bot.<seita>): "100%" = luta equilibrada para aquela seita
    k = Math.sqrt(power * bal('arena.poder_bot', playerClass));
  d.physDef = pd.physDef;
  d.spiritDef = pd.spiritDef;
  d.evasion = pd.evasion;
  d.hit = pd.hit;
  e.elemRes = { ...player.elemRes };
  d.maxHp = Math.round(pd.maxHp * k);
  e.hp = d.maxHp;
  // ataque: copia o perfil ofensivo do jogador (ataque, elemento, crítico) para o tipo de dano/elemento do bot,
  // vezes k. Antes o bot só igualava o DPS do golpe normal pelo ataque e, contra jogador de muito elemento e
  // crítico, ficava com ataque 10× maior: as skills (que escalam por ataque) matavam no primeiro golpe.
  const atk = player.damageType === 'physical' ? pd.physAtk : pd.spiritAtk,
    elem = player.element ? player.elemAtk[player.element] : 0;
  d.physAtk = d.spiritAtk = atk * k;
  for (const el of Object.keys(e.elemAtk) as (keyof typeof e.elemAtk)[]) e.elemAtk[el] = 0;
  if (e.element) e.elemAtk[e.element] = elem * k;
  d.critChance = pd.critChance;
  d.critDamage = pd.critDamage;
}
