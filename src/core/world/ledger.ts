// Registro de eventos econômicos (roadmap M0, E1d): tudo o que faz o personagem ganhar ou gastar XP, ouro ou itens.
// Serve para o servidor auditar um envio (somar o registro e comparar com a diferença entre dois saves) e para a
// verificação de plausibilidade (XP/h e ouro/h contra o tools/fixtures/plausibility.json).
// Fica só na memória, com limite; quem consome (no futuro, o envio à nuvem) chama w.drainLedger(). Não vai no save.
import type { Rarity } from '../types';

export type EconSource =
  | 'kill' // XP de abate
  | 'loot' // ouro e itens que caíram do monstro
  | 'quest' // recompensa de missão
  | 'offline' // ganho offline (resumo inteiro numa entrada)
  | 'shop' // comprar poção no vendedor
  | 'sell' // vender (vendedor, auto-combate ou ganho offline com a mochila cheia)
  | 'repair' // conserto no ferreiro
  | 'merchant' // compra no Mercador Ambulante
  | 'forge'; // melhorar, raridade, refazer bônus, desmontar

export interface EconItem {
  baseId: string;
  qty: number;
  rarity?: Rarity;
  ilvl?: number;
  plus?: number;
  uid?: string;
}

export interface EconEntry {
  /** relógio do World (ms) */
  t: number;
  src: EconSource;
  /** monstro, missão, poção, tipo de forja... */
  ref?: string;
  xp?: number;
  /** com sinal: + ganhou, − gastou */
  gold?: number;
  /** itens que entraram (ou que foram criados para o personagem) */
  itemsIn?: EconItem[];
  /** itens que saíram (vendidos, materiais gastos, item desmontado) */
  itemsOut?: EconItem[];
  /** forja: a melhoria deu certo? */
  ok?: boolean;
}

/** Máximo de entradas na memória; acima disso as mais antigas saem e ledgerDropped conta quantas. */
export const LEDGER_MAX = 5000;

export const econItem = (it: {
  baseId: string;
  qty?: number;
  rarity?: Rarity;
  ilvl?: number;
  plus?: number;
  uid?: string;
}): EconItem => {
  const e: EconItem = { baseId: it.baseId, qty: it.qty ?? 1 };
  if (it.rarity && it.rarity !== 'comum') e.rarity = it.rarity;
  if (it.ilvl && it.ilvl > 1) e.ilvl = it.ilvl;
  if (it.plus) e.plus = it.plus;
  if (it.uid) e.uid = it.uid;
  return e;
};

/** Soma de um trecho do registro (para conferir contra a diferença entre dois saves). */
export function sumLedger(entries: EconEntry[]) {
  let xp = 0,
    gold = 0;
  const items: Record<string, number> = {};
  for (const e of entries) {
    xp += e.xp ?? 0;
    gold += e.gold ?? 0;
    for (const it of e.itemsIn ?? []) items[it.baseId] = (items[it.baseId] ?? 0) + it.qty;
    for (const it of e.itemsOut ?? []) items[it.baseId] = (items[it.baseId] ?? 0) - it.qty;
  }
  return { xp, gold, items };
}
