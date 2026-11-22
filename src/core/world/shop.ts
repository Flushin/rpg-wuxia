// Loja e ferreiro: comprar, vender e consertar.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import {
  BASES,
  POTIONS,
  itemHasGems,
  SLOTS,
  buyPrice,
  makePotion,
  maxDurability,
  repairCost,
  sellValue,
} from '../items';
import { type ItemInstance } from '../types';
import type { ActionError } from '../types';
import type { World } from '../world';

export function buy(w: World, potionId: string, qty: number): ActionError | null {
  if (w.npcRole() !== 'vendedor') return { code: 'talkToSeller' };
  return purchase(w, potionId, qty);
}

// compra sem exigir a janela do NPC aberta (usado pelo auto-combate ao chegar no vendedor)
export function purchase(w: World, potionId: string, qty: number): ActionError | null {
  if (!POTIONS[potionId] || qty < 1) return null;
  const cost = buyPrice(potionId) * qty;
  if (w.gold < cost) return { code: 'noGold' };
  if (!w.canFit(potionId, qty)) return { code: 'bagFull' };
  w.gold -= cost;
  w.addItem(makePotion(potionId, qty));
  w.emit({ type: 'trade', kind: 'buy', gold: cost });
  return null;
}

export function sell(w: World, bagIndex: number, qty = 1): ActionError | null {
  if (w.npcRole() !== 'vendedor') return { code: 'talkToSeller' };
  const it = w.bag[bagIndex];
  if (it?.rarity === 'epico') return { code: 'epicLocked' };
  if (it?.locked) return { code: 'itemLocked' };
  if (it && itemHasGems(it)) return { code: 'hasGems' };
  if (!it) return null;
  const n = Math.max(1, Math.min(qty, it.qty ?? 1)),
    price = sellValue(it);
  sellRaw(w, bagIndex, n);
  // recompra (sessão): guarda a cópia vendida pelo mesmo preço; os mais novos primeiro
  w.buyback.unshift({ item: { ...it, qty: it.qty ? n : undefined }, price: price * n });
  if (w.buyback.length > BUYBACK_MAX) w.buyback.length = BUYBACK_MAX;
  return null;
}

/** Quantos itens vendidos o vendedor guarda para recomprar (só nesta sessão; não vai para o save). */
export const BUYBACK_MAX = 10;

export function buyBack(w: World, idx: number): ActionError | null {
  if (w.npcRole() !== 'vendedor') return { code: 'talkToSeller' };
  const e = w.buyback[idx];
  if (!e) return null;
  if (w.gold < e.price) return { code: 'noGold' };
  if (!w.canFit(e.item.baseId, e.item.qty ?? 1)) return { code: 'bagFull' };
  w.gold -= e.price;
  w.buyback.splice(idx, 1);
  w.addItem({ ...e.item });
  w.emit({ type: 'trade', kind: 'buy', gold: e.price });
  return null;
}

// venda instantânea pelo preço do vendedor (auto-combate / ganho offline)
export function sellRaw(w: World, bagIndex: number, qty = 1): number {
  const it = w.bag[bagIndex];
  if (!it || it.rarity === 'epico' || it.locked || itemHasGems(it)) return 0; // Épico e trancado não se vendem (nem pelo auto)
  const n = Math.max(1, Math.min(qty, it.qty ?? 1)),
    gold = sellValue(it) * n;
  w.removeFromBag(bagIndex, n);
  w.gold += gold;
  w.bumpInv();
  w.emit({ type: 'trade', kind: 'sell', gold });
  return gold;
}

// vende um item que nem chegou a entrar na mochila
export function sellValueNow(w: World, it: ItemInstance): number {
  const gold = sellValue(it) * (it.qty ?? 1);
  w.gold += gold;
  w.bumpInv();
  w.emit({ type: 'trade', kind: 'sell', gold });
  return gold;
}

export function repairTargets(w: World): ItemInstance[] {
  return [...SLOTS.map((s) => w.equipment[s]), ...w.bag].filter((i): i is ItemInstance => !!i && !!BASES[i.baseId]);
}

export function repair(w: World, it: ItemInstance): ActionError | null {
  if (w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  const cost = repairCost(it, w.owner());
  if (cost <= 0) return null;
  if (w.gold < cost) return { code: 'noGold' };
  w.gold -= cost;
  it.durability = maxDurability(it);
  w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'repair', gold: cost });
  return null;
}

export function repairAllCost(w: World): number {
  return repairTargets(w).reduce((a, i) => a + repairCost(i, w.owner()), 0);
}

export function repairAll(w: World): ActionError | null {
  if (w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  const cost = repairAllCost(w);
  if (cost <= 0) return null;
  if (w.gold < cost) return { code: 'noGold' };
  w.gold -= cost;
  for (const i of repairTargets(w)) i.durability = maxDurability(i);
  w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'repair', gold: cost });
  return null;
}
