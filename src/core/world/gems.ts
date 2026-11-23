// Gemas e encaixes (Porto Noturno, etapa 2; regras em docs/decisoes/gemas.md).
// Joalheiro: vende gemas de nível I e Pó de Estrela; funde 3 gemas iguais em 1 do nível seguinte.
// Ferreiro-mestre: abre encaixes (ouro + material), coloca e retira gemas (retirar devolve a gema e custa ouro).
import { GEMS, GEM_CFG, GEM_MAX_LEVEL, MATERIALS, gemId, makeStack, maxSockets } from '../items';
import type { ActionError, ItemInstance } from '../types';
import type { World } from '../world';
import { hasMats, matCount, takeMats } from './forge';

export const STAR_DUST = 'po_estrela';
/** O que o Joalheiro vende: gemas de nível I (preço base) e Pó de Estrela. */
export const jewelerGoods = (): { id: string; price: number }[] => [
  ...Object.keys(GEM_CFG.types).map((t) => ({ id: gemId(t, 1), price: GEM_CFG.price })),
  ...(MATERIALS[STAR_DUST] ? [{ id: STAR_DUST, price: GEM_CFG.starDustPrice }] : []),
];
export const jewelerPrice = (id: string) => jewelerGoods().find((g) => g.id === id)?.price ?? 0;
/** Ouro para fundir: fração do valor da gema que sai. */
export const fuseCost = (id: string) => {
  const g = GEMS[id];
  return g && g.level < GEM_MAX_LEVEL ? Math.round(GEMS[gemId(g.type, g.level + 1)].value * GEM_CFG.fuseCostPct) : 0;
};
export const removeCost = (id: string) => Math.round((GEMS[id]?.value ?? 0) * GEM_CFG.removeCostPct);
/** Custo de abrir o próximo encaixe do item; null se já está no máximo da raridade. */
export function socketCost(it: ItemInstance): { gold: number; mats: Record<string, number> } | null {
  const n = it.gems?.length ?? 0;
  if (n >= maxSockets(it)) return null;
  return GEM_CFG.socketCost[n] ?? null;
}

/** O item já tem uma gema desse tipo (qualquer nível)? Gemas repetidas no mesmo item são bloqueadas. */
export const hasGemType = (it: ItemInstance, type: string) => !!it.gems?.some((g) => g && GEMS[g]?.type === type);

const owned = (w: World, it: ItemInstance) => w.bag.includes(it) || Object.values(w.equipment).includes(it);
function changed(w: World, it: ItemInstance) {
  if (Object.values(w.equipment).includes(it)) w.recalc(w.player, false);
  w.bumpInv();
}

export function buyGem(w: World, id: string, qty = 1): ActionError | null {
  if (w.npcRole() !== 'joalheiro') return { code: 'talkToJeweler' };
  const price = jewelerPrice(id);
  if (!price || qty < 1) return null;
  if (w.gold < price * qty) return { code: 'noGold' };
  if (!w.canFit(id, qty)) return { code: 'bagFull' };
  w.gold -= price * qty;
  w.addItem(makeStack(id, qty));
  w.emit({ type: 'trade', kind: 'buy', gold: price * qty });
  return null;
}

/** Funde GEM_CFG.fuse gemas iguais em 1 do nível seguinte. */
export function fuseGem(w: World, id: string): ActionError | null {
  if (w.npcRole() !== 'joalheiro') return { code: 'talkToJeweler' };
  const g = GEMS[id];
  if (!g) return null;
  if (g.level >= GEM_MAX_LEVEL) return { code: 'gemMaxLevel' };
  if (matCount(w, id) < GEM_CFG.fuse) return { code: 'noMaterials' };
  const cost = fuseCost(id),
    out = gemId(g.type, g.level + 1);
  if (w.gold < cost) return { code: 'noGold' };
  takeMats(w, { [id]: GEM_CFG.fuse });
  if (!w.canFit(out, 1)) {
    w.addItem(makeStack(id, GEM_CFG.fuse)); // devolve (as 3 liberam pelo menos o espaço de 1)
    return { code: 'bagFull' };
  }
  w.gold -= cost;
  w.addItem(makeStack(out, 1));
  w.bumpInv();
  return null;
}

export function openSocket(w: World, it: ItemInstance): ActionError | null {
  if (w.npcRole() !== 'ferreiro_mestre') return { code: 'talkToMasterSmith' };
  if (!owned(w, it)) return { code: 'cannotForge' };
  const cost = socketCost(it);
  if (!cost) return { code: 'socketsMax' };
  if (!hasMats(w, cost.mats)) return { code: 'noMaterials' };
  if (w.gold < cost.gold) return { code: 'noGold' };
  takeMats(w, cost.mats);
  w.gold -= cost.gold;
  it.gems = [...(it.gems ?? []), null];
  changed(w, it);
  return null;
}

/** Coloca uma gema da mochila no primeiro encaixe vazio (ou no `slot` dado, se vazio). */
export function insertGem(w: World, it: ItemInstance, id: string, slot = -1): ActionError | null {
  if (w.npcRole() !== 'ferreiro_mestre') return { code: 'talkToMasterSmith' };
  if (!owned(w, it) || !GEMS[id]) return { code: 'cannotForge' };
  const gems = it.gems ?? [];
  const i = slot >= 0 ? (gems[slot] === null ? slot : -1) : gems.indexOf(null);
  if (i < 0) return { code: 'noSocket' };
  if (hasGemType(it, GEMS[id].type)) return { code: 'gemDuplicate' };
  if (matCount(w, id) < 1) return { code: 'noMaterials' };
  takeMats(w, { [id]: 1 });
  gems[i] = id;
  it.gems = gems;
  changed(w, it);
  return null;
}

/** Retira a gema do encaixe `slot`: volta inteira para a mochila e custa ouro. */
export function removeGem(w: World, it: ItemInstance, slot: number): ActionError | null {
  if (w.npcRole() !== 'ferreiro_mestre') return { code: 'talkToMasterSmith' };
  const id = it.gems?.[slot];
  if (!owned(w, it) || !id) return { code: 'cannotForge' };
  const cost = removeCost(id);
  if (w.gold < cost) return { code: 'noGold' };
  if (!w.canFit(id, 1)) return { code: 'bagFull' };
  w.gold -= cost;
  it.gems![slot] = null;
  w.addItem(makeStack(id, 1));
  changed(w, it);
  return null;
}
