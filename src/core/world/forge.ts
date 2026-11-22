// Forja do ferreiro (marco 9, craft): melhorar (+1 a +10), subir raridade, trocar bônus e desmontar.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
// Regras em docs/decisoes/roadmap-titas-pos-nivel-10.md ("Craft (marco 9)"). Os números ficam em FORGE, abaixo.
import { CLASSES } from '../data';
import { bal } from '../balance';
import {
  BASES,
  MATERIALS,
  MAX_PLUS,
  RARITIES,
  RARITY_ORDER,
  epicTierBase,
  makeStack,
  epicBonusStats,
  rollBonuses,
  rollEpicBonusStats,
  type ItemOwner,
} from '../items';
import type { ActionError, ItemInstance, Rarity } from '../types';
import type { World } from '../world';

export type Mats = Record<string, number>;
export interface ForgeCost {
  mats: Mats;
  gold: number;
  /** chance de sucesso (0–1); só a melhoria pode falhar */
  chance: number;
}
export type ForgeKind = 'upgrade' | 'rarity' | 'reroll' | 'salvage';

export const FORGE = {
  /** chance de sucesso de +n para +n+1 (índice n) */
  upgradeChance: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],
  /** ouro da melhoria de +n: (base + porNível × n) × fator do nível do item; cobrado mesmo se falhar */
  upgradeGold: { base: 30, perPlus: 30 },
  rarityGold: { incomum: 200, raro: 600 } as Record<Rarity, number>,
  rerollGold: { incomum: 100, raro: 200 } as Record<Rarity, number>,
  /** Épico: melhorar custa o ouro do Raro da faixa × isto (materiais e chance iguais). */
  epicGoldMul: 2,
  /** Épico: trocar bônus custa materiais e ouro da troca do Raro da faixa × isto (no lugar de epicGoldMul). */
  epicRerollMul: 3,
};
const ORE = 'minerio_ferro',
  CRYSTAL = 'cristal_gelo',
  JADE = 'jade_nevoa',
  ESSENCE = 'essencia_qi';
/** Itens deste nível em diante usam Jade da Névoa no lugar do Cristal de Gelo (nível 30, etapa 3). */
export const JADE_FROM_LEVEL = 20;
/** Material raro da forja do item: Cristal de Gelo (nv 1–15) ou Jade da Névoa (nv 20+). */
export const rareMat = (reqLevel: number) => (reqLevel >= JADE_FROM_LEVEL ? JADE : CRYSTAL);
/** Itens deste nível em diante pedem o dobro do material raro, em toda receita e no desmonte (nível 40, etapa 3). */
export const RARE_DOUBLE_FROM_LEVEL = 35;
/** Quantidade de material raro: ×2 nos itens nv 35+. */
export const rareQty = (reqLevel: number, n: number) => (reqLevel >= RARE_DOUBLE_FROM_LEVEL ? 2 * n : n);
/** Nível da base para a forja; o Épico usa a peça da faixa do nível de quem usa (sem dono: a própria base). */
const forgeLevel = (it: ItemInstance, owner?: ItemOwner) =>
  BASES[it.rarity === 'epico' && owner ? epicTierBase(it, owner.level) : it.baseId]?.reqLevel ?? 1;
const rare = (it: ItemInstance, owner?: ItemOwner) => rareMat(forgeLevel(it, owner));
const rq = (it: ItemInstance, n: number, owner?: ItemOwner) => rareQty(forgeLevel(it, owner), n);

/** Itens de nível mais alto custam mais ouro na forja: ×1 no nível 1, ×2 no 5 … ×6 no 25, ×8 no 35. */
const levelFactor = (it: ItemInstance, owner?: ItemOwner) => 1 + forgeLevel(it, owner) / 5;
const gold = (n: number, it: ItemInstance, owner?: ItemOwner) =>
  Math.round(n * levelFactor(it, owner) * bal('forja.ouro') * (it.rarity === 'epico' ? FORGE.epicGoldMul : 1));
const clean = (m: Mats): Mats => Object.fromEntries(Object.entries(m).filter(([, n]) => n > 0));

/** Melhorar +n → +n+1 (máximo +10). Épico: custo da faixa do nível de `owner`, ouro × FORGE.epicGoldMul. */
export function upgradeCost(it: ItemInstance, owner?: ItemOwner): ForgeCost | null {
  const n = it.plus ?? 0;
  if (!BASES[it.baseId] || n >= MAX_PLUS) return null;
  return {
    mats: clean({ [ORE]: 2 + 2 * n, [rare(it, owner)]: rq(it, n >= 4 ? n - 3 : 0, owner), [ESSENCE]: n >= 7 ? 1 : 0 }),
    gold: gold(FORGE.upgradeGold.base + FORGE.upgradeGold.perPlus * n, it, owner),
    chance: Math.min(1, FORGE.upgradeChance[n] * bal('forja.chance')),
  };
}

/** Comum → Incomum → Raro (ganha um bônus aleatório novo; os que já tem ficam). */
export function rarityCost(it: ItemInstance): ForgeCost | null {
  if (!BASES[it.baseId] || it.rarity === 'raro' || it.rarity === 'epico') return null;
  return it.rarity === 'comum'
    ? { mats: { [ORE]: 12, [rare(it)]: rq(it, 1) }, gold: gold(FORGE.rarityGold.incomum, it), chance: 1 }
    : { mats: { [ORE]: 20, [rare(it)]: rq(it, 4), [ESSENCE]: 1 }, gold: gold(FORGE.rarityGold.raro, it), chance: 1 };
}

/** Sorteia de novo todos os bônus de um item Incomum ou Raro (a quantidade continua a mesma). */
export function rerollCost(it: ItemInstance, owner?: ItemOwner): ForgeCost | null {
  if (!BASES[it.baseId] || it.rarity === 'comum') return null;
  if (it.rarity === 'epico') {
    // 3× a troca do Raro da faixa do nível de quem usa (materiais e ouro; sem o ×2 de ouro da melhoria)
    const k = FORGE.epicRerollMul,
      g = Math.round(FORGE.rerollGold.raro * levelFactor(it, owner) * bal('forja.ouro') * k);
    return { mats: { [ORE]: 10 * k, [rare(it, owner)]: rq(it, 2, owner) * k }, gold: g, chance: 1 };
  }
  return it.rarity === 'incomum'
    ? { mats: { [ORE]: 6, [rare(it)]: rq(it, 1) }, gold: gold(FORGE.rerollGold.incomum, it), chance: 1 }
    : { mats: { [ORE]: 10, [rare(it)]: rq(it, 2) }, gold: gold(FORGE.rerollGold.raro, it), chance: 1 };
}

/** Materiais que desmontar o item devolve. Épico: como um Raro da faixa do nível de `owner`, + 1 Essência de Qi. */
export function salvageYield(it: ItemInstance, owner?: ItemOwner): Mats {
  if (!BASES[it.baseId]) return {};
  const lv = forgeLevel(it, owner),
    r = it.rarity,
    hi = r === 'raro' || r === 'epico';
  return clean({
    [ORE]: 1 + Math.floor(lv / 5) + (r === 'incomum' ? 2 : hi ? 3 : 0) + Math.floor((it.plus ?? 0) / 2),
    [rare(it, owner)]: rareQty(lv, (lv >= 10 ? 1 : 0) + (hi ? 1 : 0) + ((it.plus ?? 0) >= 6 ? 1 : 0)),
    [ESSENCE]: r === 'epico' ? 1 : 0,
  });
}

export function matCount(w: World, id: string): number {
  return w.potionCount(id);
}
export function hasMats(w: World, m: Mats): boolean {
  return Object.entries(m).every(([id, n]) => matCount(w, id) >= n);
}
function takeMats(w: World, m: Mats) {
  for (const [id, n] of Object.entries(m)) {
    let left = n;
    for (let i = w.bag.length - 1; i >= 0 && left > 0; i--) {
      const b = w.bag[i];
      if (!b || b.baseId !== id) continue;
      const k = Math.min(left, b.qty ?? 1);
      w.removeFromBag(i, k);
      left -= k;
    }
  }
}

/** Item que o ferreiro pode trabalhar: equipado ou na mochila. */
function owned(w: World, it: ItemInstance): boolean {
  return w.bag.includes(it) || Object.values(w.equipment).includes(it);
}

function check(w: World, it: ItemInstance, cost: ForgeCost | null, force: boolean): ActionError | null {
  if (!force && w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  if (!cost || !owned(w, it)) return { code: 'cannotForge' };
  if (!hasMats(w, cost.mats)) return { code: 'noMaterials' };
  if (w.gold < cost.gold) return { code: 'noGold' };
  return null;
}

function done(w: World, it: ItemInstance, kind: ForgeKind, success: boolean) {
  if (Object.values(w.equipment).includes(it)) w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'forge', kind, success, plus: it.plus ?? 0, rarity: it.rarity });
}

/** Melhorar (+1). Cobra materiais e ouro antes de sortear; falhou: o item fica como estava (não quebra nem volta). */
export function upgrade(w: World, it: ItemInstance, force = false): ActionError | null {
  const cost = upgradeCost(it, w.owner()),
    err = check(w, it, cost, force);
  if (err || !cost) return err;
  takeMats(w, cost.mats);
  w.gold -= cost.gold;
  const ok = w.rng.next() < cost.chance;
  if (ok) it.plus = (it.plus ?? 0) + 1;
  done(w, it, 'upgrade', ok);
  return null;
}

export function raiseRarity(w: World, it: ItemInstance, force = false): ActionError | null {
  const cost = rarityCost(it),
    err = check(w, it, cost, force);
  if (err || !cost) return err;
  takeMats(w, cost.mats);
  w.gold -= cost.gold;
  const next = RARITY_ORDER[RARITY_ORDER.indexOf(it.rarity) + 1];
  const extra = Math.max(0, RARITIES[next].bonuses - it.bonuses.length);
  it.bonuses = [
    ...it.bonuses,
    ...rollBonuses(
      extra,
      it.ilvl,
      CLASSES[w.classId].element,
      w.rng,
      it.bonuses.map((b) => b.stat),
    ),
  ];
  it.rarity = next;
  done(w, it, 'rarity', true);
  return null;
}

export function reroll(w: World, it: ItemInstance, force = false): ActionError | null {
  const cost = rerollCost(it, w.owner()),
    err = check(w, it, cost, force);
  if (err || !cost) return err;
  takeMats(w, cost.mats);
  w.gold -= cost.gold;
  if (it.rarity === 'epico') {
    // mesma quantidade de antes; evita sair exatamente o mesmo par
    const cur = epicBonusStats(w.owner(), it).slice().sort().join();
    let next = rollEpicBonusStats(cur.split(',').length, w.rng);
    for (
      let i = 0;
      i < 5 &&
      next
        .map((b) => b.stat)
        .sort()
        .join() === cur;
      i++
    )
      next = rollEpicBonusStats(next.length, w.rng);
    it.bonuses = next;
  } else it.bonuses = rollBonuses(RARITIES[it.rarity].bonuses, it.ilvl, CLASSES[w.classId].element, w.rng);
  done(w, it, 'reroll', true);
  return null;
}

/** Desmonta um item da mochila (equipado não). Os materiais vão para a mochila; o espaço do item fica livre antes. */
export function salvage(w: World, bagIndex: number, force = false): ActionError | null {
  const it = w.bag[bagIndex];
  if (!force && w.npcRole() !== 'ferreiro') return { code: 'talkToBlacksmith' };
  if (!it || !BASES[it.baseId]) return { code: 'cannotForge' };
  if (it.locked) return { code: 'itemLocked' };
  const got = salvageYield(it, w.owner());
  w.bag[bagIndex] = null;
  const lost: Mats = {};
  for (const [id, n] of Object.entries(got)) if (!w.addItem(makeStack(id, n))) lost[id] = n;
  if (Object.keys(lost).length) {
    // sem espaço para os materiais: desfaz (devolve o item e tira o que entrou)
    takeMats(w, Object.fromEntries(Object.entries(got).filter(([id]) => !lost[id])));
    w.bag[bagIndex] = it;
    w.bumpInv();
    return { code: 'bagFull' };
  }
  done(w, it, 'salvage', true);
  return null;
}

export const materialName = (id: string) => MATERIALS[id]?.name ?? id;
