// Mercador Ambulante (marco 9): estoque sorteado de 4–6 equipamentos (quase todos Raros, do nível do jogador) que
// renova a cada hora real (conta também com o jogo fechado), materiais raros de forja e pergaminho de retorno.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { CLASSES } from '../data';
import {
  BASES,
  CONSUMABLES,
  MERCHANT,
  RARITIES,
  equipmentBaseIds,
  makeEquipment,
  makeStack,
  sanitizeItem,
} from '../items';
import { HOME_MAP, TOWN_MAPS } from '../mapsConfig';
import type { ActionError, ItemInstance } from '../types';
import type { World } from '../world';

export interface MerchantOffer {
  item: ItemInstance;
  price: number;
  sold: boolean;
}
export interface MerchantState {
  /** número da janela de renovação (relógio real ÷ duração da janela) em que o estoque foi sorteado */
  period: number;
  offers: MerchantOffer[];
}

const periodMs = () => MERCHANT.refreshMinutes * 60_000;
export const merchantPeriod = (now: number) => Math.floor(now / periodMs());
/** ms até a próxima renovação do estoque */
export const merchantRefreshIn = (now: number) => periodMs() - (now % periodMs());

/** Nível dos equipamentos do estoque: o maior nível de base que o personagem já pode usar (1, 5, 10 ou 15). */
export function stockLevel(level: number): number {
  const lv = [...new Set(Object.values(BASES).map((b) => b.reqLevel))].filter((l) => l <= level);
  return Math.max(1, ...lv);
}

export const offerPrice = (it: ItemInstance) =>
  Math.max(1, Math.round((BASES[it.baseId]?.value ?? 0) * RARITIES[it.rarity].valueMul * MERCHANT.priceMul));

function roll(w: World): MerchantOffer[] {
  const lv = stockLevel(w.player.level),
    rng = w.rng;
  const ids = equipmentBaseIds().filter(
    (id) => BASES[id].reqLevel === lv && (!BASES[id].sect || BASES[id].sect === w.classId),
  );
  const n = rng.int(MERCHANT.stockMin, MERCHANT.stockMax),
    out: MerchantOffer[] = [];
  const pool = [...ids];
  for (let i = 0; i < n && ids.length; i++) {
    if (!pool.length) pool.push(...ids); // poucos tipos: pode repetir a base (com bônus diferentes)
    const id = pool.splice(Math.min(pool.length - 1, Math.floor(rng.next() * pool.length)), 1)[0];
    const rarity = rng.next() < MERCHANT.rareChance ? 'raro' : 'incomum';
    const item = makeEquipment(id, rarity, CLASSES[w.classId].element, rng, lv);
    out.push({ item, price: offerPrice(item), sold: false });
  }
  return out;
}

/** Estoque atual; sorteia de novo se a janela de renovação mudou desde o último sorteio. */
export function merchantStock(w: World): MerchantState {
  const p = merchantPeriod(w.clock.now());
  if (!w.merchant || w.merchant.period !== p) w.merchant = { period: p, offers: roll(w) };
  return w.merchant;
}

/** Itens que o mercador sempre tem: materiais raros e consumíveis (id → preço). */
export function merchantGoods(): Record<string, number> {
  return {
    ...MERCHANT.materials,
    ...Object.fromEntries(Object.entries(CONSUMABLES).map(([id, c]) => [id, c.price])),
  };
}

const atMerchant = (w: World, force: boolean) => force || w.npcRole() === 'mercador';

export function buyOffer(w: World, idx: number, force = false): ActionError | null {
  if (!atMerchant(w, force)) return { code: 'talkToMerchant' };
  const o = merchantStock(w).offers[idx];
  if (!o) return null;
  if (o.sold) return { code: 'soldOut' };
  if (w.gold < o.price) return { code: 'noGold' };
  if (!w.canFit(o.item.baseId)) return { code: 'bagFull' };
  w.gold -= o.price;
  o.sold = true;
  w.addItem({ ...o.item });
  w.emit({ type: 'trade', kind: 'buy', gold: o.price });
  return null;
}

export function buyGoods(w: World, id: string, qty: number, force = false): ActionError | null {
  if (!atMerchant(w, force)) return { code: 'talkToMerchant' };
  const price = merchantGoods()[id];
  if (!price || qty < 1) return null;
  const cost = price * qty;
  if (w.gold < cost) return { code: 'noGold' };
  if (!w.canFit(id, qty)) return { code: 'bagFull' };
  w.gold -= cost;
  w.addItem(makeStack(id, qty));
  w.emit({ type: 'trade', kind: 'buy', gold: cost });
  return null;
}

/** Pergaminho de retorno: volta para a vila (não funciona já na vila nem morto). */
export function useReturnScroll(w: World, bagIndex: number): boolean {
  const it = w.bag[bagIndex];
  if (!it || it.baseId !== 'pergaminho_retorno' || w.player.dead || TOWN_MAPS.has(w.mapId)) return false;
  w.removeFromBag(bagIndex);
  w.auto.manualMove();
  w.changeMap(HOME_MAP);
  return true;
}

export function serializeMerchant(w: World): MerchantState | undefined {
  return w.merchant ? JSON.parse(JSON.stringify(w.merchant)) : undefined;
}

export function restoreMerchant(raw: unknown): MerchantState | null {
  const r = raw as Partial<MerchantState> | null;
  if (!r || !Number.isFinite(Number(r.period)) || !Array.isArray(r.offers)) return null;
  const offers: MerchantOffer[] = [];
  for (const o of r.offers.slice(0, MERCHANT.stockMax)) {
    const item = sanitizeItem(o?.item);
    if (item && BASES[item.baseId]) offers.push({ item, price: offerPrice(item), sold: !!o.sold });
  }
  return { period: Math.floor(Number(r.period)), offers };
}
