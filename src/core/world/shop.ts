// Loja e ferreiro: comprar, vender e consertar.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { BASES, POTIONS, SLOTS, buyPrice, makePotion, maxDurability, repairCost, sellValue } from '../items';
import { type ItemInstance } from '../types';
import type { ActionError } from '../types';
import type { World } from '../world';
import { econItem } from './ledger';

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
  const it = makePotion(potionId, qty);
  w.addItem(it);
  w.econ({ src: 'shop', ref: potionId, gold: -cost, itemsIn: [econItem(it)] });
  w.emit({ type: 'trade', kind: 'buy', gold: cost });
  return null;
}

export function sell(w: World, bagIndex: number, qty = 1): ActionError | null {
  if (w.npcRole() !== 'vendedor') return { code: 'talkToSeller' };
  sellRaw(w, bagIndex, qty);
  return null;
}

// venda instantânea pelo preço do vendedor (auto-combate / ganho offline)
export function sellRaw(w: World, bagIndex: number, qty = 1): number {
  const it = w.bag[bagIndex];
  if (!it) return 0;
  const n = Math.max(1, Math.min(qty, it.qty ?? 1)),
    gold = sellValue(it) * n;
  w.removeFromBag(bagIndex, n);
  w.gold += gold;
  w.econ({ src: 'sell', gold, itemsOut: [econItem({ ...it, qty: n })] });
  w.bumpInv();
  w.emit({ type: 'trade', kind: 'sell', gold });
  return gold;
}

// vende um item que nem chegou a entrar na mochila
export function sellValueNow(w: World, it: ItemInstance): number {
  const gold = sellValue(it) * (it.qty ?? 1);
  w.gold += gold;
  w.econ({ src: 'sell', gold, itemsOut: [econItem(it)] }); // a entrada foi anotada por quem criou o item
  w.bumpInv();
  w.emit({ type: 'trade', kind: 'sell', gold });
  return gold;
}

export function repairTargets(w: World): ItemInstance[] {
  return [...SLOTS.map((s) => w.equipment[s]), ...w.bag].filter((i): i is ItemInstance => !!i && !!BASES[i.baseId]);
}

export function repair(w: World, it: ItemInstance): ActionError | null {
  if (w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  const cost = repairCost(it);
  if (cost <= 0) return null;
  if (w.gold < cost) return { code: 'noGold' };
  w.gold -= cost;
  w.econ({ src: 'repair', ref: it.baseId, gold: -cost });
  it.durability = maxDurability(it);
  w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'repair', gold: cost });
  return null;
}

export function repairAllCost(w: World): number {
  return repairTargets(w).reduce((a, i) => a + repairCost(i), 0);
}

export function repairAll(w: World): ActionError | null {
  if (w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  const cost = repairAllCost(w);
  if (cost <= 0) return null;
  if (w.gold < cost) return { code: 'noGold' };
  w.gold -= cost;
  w.econ({ src: 'repair', ref: 'all', gold: -cost });
  for (const i of repairTargets(w)) i.durability = maxDurability(i);
  w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'repair', gold: cost });
  return null;
}
