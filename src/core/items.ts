import itemsJson from '../data/items.json';
import { L, localize } from './i18n';
import { balanceItems } from './balance';
import { CLASSES } from './data';
import type { Rng } from './rng';
import type { Bonus, ItemInstance, PotionKind, Rarity, Slot } from './types';

export interface ItemBase {
  name: string;
  slot: Slot;
  sect?: string;
  reqLevel: number;
  durability: number;
  value: number;
  stats: Record<string, number>;
}
export interface PotionDef {
  name: string;
  kind: PotionKind;
  percent: number;
  duration: number;
  cooldown: number;
  price: number;
  color: string;
}
export interface RarityDef {
  name: string;
  color: string;
  weight: number;
  bonuses: number;
  valueMul: number;
}
export type MaterialTier = 'comum' | 'raro' | 'especial';
export interface MaterialDef {
  name: string;
  tier: MaterialTier;
  value: number;
  color: string;
  desc: string;
}
export interface ConsumableDef {
  name: string;
  price: number;
  color: string;
  desc: string;
}
export interface MerchantDef {
  stockMin: number;
  stockMax: number;
  refreshMinutes: number;
  rareChance: number;
  priceMul: number;
  materials: Record<string, number>;
}
interface BonusDef {
  stat: string;
  min: number;
  max: number;
}

const J = localize('items', itemsJson) as unknown as {
  slots: Slot[];
  slotNames: Record<Slot, string>;
  bagSize: number;
  stackMax: number;
  sellRatio: number;
  repairCostPerPoint: number;
  groundSeconds: number;
  wearPerHit: number;
  startingKit: Record<string, number>;
  startingWeapon: Record<string, string>;
  rarities: Record<Rarity, RarityDef>;
  epicNames: Record<string, string>;
  epicBonuses: Record<string, string[]>;
  bonusPool: BonusDef[];
  bases: Record<string, ItemBase>;
  potions: Record<string, PotionDef>;
  materials: Record<string, MaterialDef>;
  consumables: Record<string, ConsumableDef>;
  merchant: MerchantDef;
  upgradeStep: number;
};
balanceItems(J); // multiplicadores de src/data/balance.json
export const SLOTS = J.slots,
  SLOT_NAMES = J.slotNames,
  /** Espaços de cada aba da mochila (equipamento, consumíveis, materiais). */
  BAG_TAB_SIZE = J.bagSize,
  STACK_MAX = J.stackMax;
export const WEAR_PER_HIT = J.wearPerHit;
export const GROUND_SECONDS = J.groundSeconds,
  STARTING_KIT = J.startingKit,
  STARTING_WEAPON = J.startingWeapon;
export const RARITIES = J.rarities,
  BASES = J.bases,
  POTIONS = J.potions,
  MATERIALS = J.materials,
  CONSUMABLES = J.consumables,
  MERCHANT = J.merchant;
/** Melhoria máxima (+10) e quanto cada nível soma aos stats da base (marco 9, craft). */
export const MAX_PLUS = 10;
export const UPGRADE_STEP = J.upgradeStep;
/** Raridades do sorteio normal de drop e da forja (subir raridade). O Épico fica de fora: tem drop próprio. */
export const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'raro'];
/** Ordem de exibição (mochila): todas as raridades, Épico no topo. */
const RARITY_RANK: Rarity[] = ['comum', 'incomum', 'raro', 'epico'];
export const isEpic = (it: ItemInstance) => it.rarity === 'epico';
/** Ícone do Épico (fixo, desenhado em tools/sprites/icons.py): epico_<slot>; arma: epico_arma_<seita>. */
export const epicIconId = (it: ItemInstance) => {
  const b = BASES[it.baseId];
  return b ? `epico_${b.slot === 'arma' && b.sect ? `arma_${b.sect}` : b.slot}` : it.baseId;
};
/** Nome do Épico: um por slot; a arma tem um por seita (chave arma_<classe>). */
export const epicName = (slot: Slot, sect?: string) =>
  J.epicNames[slot === 'arma' && sect ? `arma_${sect}` : slot] ?? J.epicNames[slot] ?? slot;
export const isPotionId = (id: string) => id in POTIONS;
export const isMaterialId = (id: string) => id in MATERIALS;
/** Empilha na mochila (até STACK_MAX): poções e materiais de forja. */
export const isConsumableId = (id: string) => id in CONSUMABLES;
export const isStackId = (id: string) => id in POTIONS || id in MATERIALS || id in CONSUMABLES;

/** Abas da mochila: cada uma tem BAG_TAB_SIZE espaços próprios. */
export type BagTab = 'equip' | 'pot' | 'mat';
export const BAG_TABS: BagTab[] = ['equip', 'pot', 'mat'];
/** Total de espaços (todas as abas juntas, num array só). */
export const BAG_SIZE = BAG_TAB_SIZE * BAG_TABS.length;
export const bagTabOf = (baseId: string): BagTab =>
  baseId in POTIONS || baseId in CONSUMABLES ? 'pot' : baseId in MATERIALS ? 'mat' : 'equip';

export const STAT_LABELS: Record<string, string> = {
  strength: L('Força', 'Strength'),
  intelligence: L('Inteligência', 'Intelligence'),
  stamina: L('Vigor', 'Stamina'),
  agility: L('Agilidade', 'Agility'),
  willpower: L('Vontade', 'Willpower'),
  maxHp: L('Vida máxima', 'Max health'),
  maxMana: L('Mana máxima', 'Max mana'),
  physAtk: L('Ataque físico', 'Physical attack'),
  spiritAtk: L('Ataque espiritual', 'Spiritual attack'),
  physDef: L('Defesa física', 'Physical defense'),
  spiritDef: L('Defesa espiritual', 'Spiritual defense'),
  hit: L('Precisão', 'Accuracy'),
  evasion: L('Esquiva', 'Evasion'),
  critChance: L('Chance de crítico', 'Crit chance'),
  critDamage: L('Dano crítico', 'Crit damage'),
  elem_fire: L('Ataque de Fogo', 'Fire Attack'),
  elem_ice: L('Ataque de Gelo', 'Ice Attack'),
  elem_thunder: L('Ataque de Trovão', 'Thunder Attack'),
  elem_poison: L('Ataque de Veneno', 'Poison Attack'),
};
const PERCENT_STATS = new Set(['critChance', 'critDamage']);
export const fmtStatValue = (stat: string, v: number) =>
  PERCENT_STATS.has(stat) ? `${+(v * 100).toFixed(1)}%` : String(+v.toFixed(2));
export const fmtStat = (stat: string, v: number) =>
  `${v >= 0 ? '+' : '−'}${fmtStatValue(stat, Math.abs(v))} ${STAT_LABELS[stat] ?? stat}`;

export const baseOf = (it: ItemInstance): ItemBase | undefined => BASES[it.baseId];
export const potionOf = (it: ItemInstance): PotionDef | undefined => POTIONS[it.baseId];
export const itemName = (it: ItemInstance) => {
  const eb = it.rarity === 'epico' ? BASES[it.baseId] : undefined;
  const n = eb
    ? epicName(eb.slot, eb.sect)
    : ((BASES[it.baseId] ?? POTIONS[it.baseId] ?? MATERIALS[it.baseId] ?? CONSUMABLES[it.baseId])?.name ?? it.baseId);
  return it.plus ? `${n} +${it.plus}` : n;
};
export const itemColor = (it: ItemInstance) =>
  POTIONS[it.baseId]?.color ??
  MATERIALS[it.baseId]?.color ??
  CONSUMABLES[it.baseId]?.color ??
  RARITIES[it.rarity].color;
export const maxDurability = (it: ItemInstance) => BASES[it.baseId]?.durability ?? 0;
export const isBroken = (it: ItemInstance) => !!BASES[it.baseId] && it.durability <= 0;

// nível do item = maior entre o nível exigido da base e o do drop
let uidCounter = 0;
export const newUid = () =>
  `${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function makePotion(baseId: string, qty = 1): ItemInstance {
  return { uid: newUid(), baseId, rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty };
}
/** Pilha de poção ou de material. */
export const makeStack = makePotion;

export function rollRarity(rng: Rng): Rarity {
  const total = RARITY_ORDER.reduce((a, r) => a + RARITIES[r].weight, 0);
  let x = rng.next() * total;
  for (const r of RARITY_ORDER) {
    x -= RARITIES[r].weight;
    if (x < 0) return r;
  }
  return 'comum';
}

export function rollBonuses(
  count: number,
  ilvl: number,
  element: string | null,
  rng: Rng,
  exclude: string[] = [],
): Bonus[] {
  const pool = J.bonusPool.filter(
      (d) => !exclude.includes(d.stat === 'elemAtk' ? `elem_${element ?? 'fire'}` : d.stat),
    ),
    out: Bonus[] = [],
    scale = 1 + 0.2 * (Math.max(1, ilvl) - 1);
  while (out.length < count && pool.length) {
    const d = pool.splice(Math.min(pool.length - 1, Math.floor(rng.next() * pool.length)), 1)[0];
    const stat = d.stat === 'elemAtk' ? `elem_${element ?? 'fire'}` : d.stat;
    let v = rng.range(d.min, d.max) * scale;
    v = d.max >= 1 ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
    out.push({ stat, value: v });
  }
  return out;
}

export function makeEquipment(
  baseId: string,
  rarity: Rarity,
  element: string | null,
  rng: Rng,
  dropLevel = 1,
): ItemInstance {
  const b = BASES[baseId],
    ilvl = Math.max(b.reqLevel, dropLevel);
  return {
    uid: newUid(),
    baseId,
    rarity,
    ilvl,
    durability: b.durability,
    bonuses: rollBonuses(RARITIES[rarity].bonuses, ilvl, element, rng),
  };
}

/** Épico recém-dropado: +0, durabilidade cheia, sem bônus guardados (vêm da classe de quem usa); ilvl é só o nível
 *  do personagem no drop (informativo: stats e conserto usam o nível atual). */
export function makeEpic(baseId: string, level: number): ItemInstance {
  return {
    uid: newUid(),
    baseId,
    rarity: 'epico',
    bonuses: [],
    ilvl: Math.max(1, level),
    durability: BASES[baseId].durability,
  };
}
/** Chance de Épico por monstro morto jogando (não no auto nem offline); chefe = qualquer monstro com `boss`. */
export const EPIC_CHANCE = { mob: 0.005, boss: 0.01 };
/** O monstro precisa ter nível ≥ nível do personagem − isto (evita farm de monstro fraco). */
export const EPIC_MAX_LEVELS_BELOW = 10;
/** Épico no chão (mochila cheia): segundos até sumir (os outros itens: GROUND_SECONDS). */
export const EPIC_GROUND_SECONDS = 600;

/** Quem usa o item: o Épico calcula stats e bônus pelo nível e pela classe dele. */
export interface ItemOwner {
  level: number;
  classId: string;
}
/** Épico: quanto mais forte que um Raro do mesmo nível (base e bônus no máximo do Raro). */
export const EPIC_MUL = 1.3;
/** Peça da faixa do Épico: a base do mesmo slot (arma: da mesma seita) com o maior nível exigido até o nível do
 *  personagem, a mesma que um Raro daquele nível teria. Muda a cada 5 níveis (nome do ícone e stats da base). */
export function epicTierBase(it: ItemInstance, level: number): string {
  const b = BASES[it.baseId];
  if (!b) return it.baseId;
  let best = '',
    lowest = '';
  for (const [id, x] of Object.entries(BASES)) {
    if (x.slot !== b.slot || (x.sect ?? '') !== (b.sect ?? '')) continue;
    if (!lowest || x.reqLevel < BASES[lowest].reqLevel) lowest = id;
    if (x.reqLevel <= level && (!best || x.reqLevel > BASES[best].reqLevel)) best = id;
  }
  return best || lowest || it.baseId;
}
/** Bônus fixos do Épico para a classe de quem usa: 1,3 × o máximo que um Raro sortearia no mesmo nível. */
export function epicBonuses(owner: ItemOwner): Bonus[] {
  const el = CLASSES[owner.classId]?.element ?? null,
    scale = 1 + 0.2 * (Math.max(1, owner.level) - 1);
  return (J.epicBonuses[owner.classId] ?? []).flatMap((s) => {
    const d = J.bonusPool.find((p) => p.stat === s);
    if (!d) return [];
    const stat = s === 'elemAtk' ? `elem_${el ?? 'fire'}` : s,
      v = d.max * scale * EPIC_MUL;
    return [{ stat, value: d.max >= 1 ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000 }];
  });
}
const NO_OWNER: ItemOwner = { level: 1, classId: '' };

/** Atributos/stats nominais (base com a melhoria + bônus), ignorando durabilidade. O Épico precisa de `owner`
 *  (sem ele: nível 1, sem bônus); `withBonuses = false` devolve só a base (janela do item). */
export function itemStats(it: ItemInstance, owner?: ItemOwner, withBonuses = true): Record<string, number> {
  const out: Record<string, number> = {};
  const b = BASES[it.baseId];
  if (!b) return out;
  if (it.rarity === 'epico') {
    const o = owner ?? NO_OWNER,
      tb = BASES[epicTierBase(it, o.level)];
    for (const [k, v] of Object.entries(tb.stats)) {
      const x = upgraded(v, it.plus ?? 0) * EPIC_MUL;
      out[k] = (out[k] ?? 0) + (Math.abs(v) >= 1 ? Math.round(x) : Math.round(x * 1000) / 1000);
    }
    if (withBonuses && owner) for (const bo of epicBonuses(owner)) out[bo.stat] = (out[bo.stat] ?? 0) + bo.value;
    return out;
  }
  for (const [k, v] of Object.entries(b.stats)) out[k] = (out[k] ?? 0) + upgraded(v, it.plus ?? 0);
  if (withBonuses) for (const bo of it.bonuses) out[bo.stat] = (out[bo.stat] ?? 0) + bo.value;
  return out;
}

/** Stat da base com a melhoria: frações com 3 casas; inteiros arredondados, subindo pelo menos 1 a cada 3 níveis
 *  (senão um +1 de Vontade nunca mudaria). */
function upgraded(v: number, plus: number): number {
  if (!plus) return v;
  if (Math.abs(v) >= 1) return v + Math.max(Math.round(v * UPGRADE_STEP * plus), Math.floor(plus / 3));
  return Math.round(v * (1 + UPGRADE_STEP * plus) * 1000) / 1000;
}

export const buyPrice = (id: string) => POTIONS[id]?.price ?? 0;
// valor de venda de UMA unidade
export function sellValue(it: ItemInstance): number {
  const p = POTIONS[it.baseId];
  if (p) return Math.max(1, Math.floor(p.price * J.sellRatio + 1e-9));
  const m = MATERIALS[it.baseId];
  if (m) return Math.max(1, Math.floor(m.value * J.sellRatio + 1e-9));
  const c = CONSUMABLES[it.baseId];
  if (c) return Math.max(1, Math.floor(c.price * J.sellRatio + 1e-9));
  const b = BASES[it.baseId];
  if (it.rarity === 'epico') return 0; // Épico não se vende
  return b ? Math.max(1, Math.floor(b.value * RARITIES[it.rarity].valueMul * J.sellRatio + 1e-9)) : 0;
}
/** Conserto; o Épico usa o nível de quem usa no lugar do nível do item (como um Raro dropado nesse nível). */
export function repairCost(it: ItemInstance, owner?: ItemOwner): number {
  const b = BASES[it.baseId];
  if (!b) return 0;
  const missing = Math.max(0, b.durability - it.durability),
    lv = it.rarity === 'epico' && owner ? owner.level : it.ilvl;
  return missing <= 0 ? 0 : Math.max(1, Math.ceil(missing * Math.max(1, lv) * J.repairCostPerPoint));
}

export const equipmentBaseIds = (slot?: Slot) => Object.keys(BASES).filter((id) => !slot || BASES[id].slot === slot);

// valida/saneia um item vindo de save
export function sanitizeItem(raw: unknown): ItemInstance | null {
  const r = raw as Partial<ItemInstance> | null;
  if (!r || typeof r.baseId !== 'string') return null;
  const rarity: Rarity = r.rarity && r.rarity in RARITIES ? r.rarity : 'comum';
  if (isStackId(r.baseId))
    return {
      uid: String(r.uid ?? newUid()),
      baseId: r.baseId,
      rarity: 'comum',
      bonuses: [],
      ilvl: 1,
      durability: 0,
      qty: Math.max(1, Math.min(STACK_MAX, Math.floor(Number(r.qty) || 1))),
    };
  const b = BASES[r.baseId];
  if (!b) return null;
  const bonuses = (Array.isArray(r.bonuses) ? r.bonuses : [])
    .filter((x) => x && typeof x.stat === 'string' && Number.isFinite(x.value))
    .map((x) => ({ stat: x.stat, value: +x.value }));
  const dur = Number.isFinite(r.durability) ? Math.max(0, Math.min(b.durability, Number(r.durability))) : b.durability;
  return {
    uid: String(r.uid ?? newUid()),
    baseId: r.baseId,
    rarity,
    bonuses,
    ilvl: Math.max(b.reqLevel, Math.floor(Number(r.ilvl) || 1)),
    durability: dur,
    ...(Number(r.plus) >= 1 ? { plus: Math.min(MAX_PLUS, Math.floor(Number(r.plus))) } : {}),
  };
}

// ordem da mochila: equipamentos (ordem dos slots), depois poções; raridade (raro primeiro) e nível (maior primeiro)
export function sortedBag(bag: (ItemInstance | null)[]): (ItemInstance | null)[] {
  const items: ItemInstance[] = [];
  const stacks = new Map<string, ItemInstance>();
  for (const it of bag) {
    if (!it) continue;
    if (!isStackId(it.baseId)) {
      items.push(it);
      continue;
    }
    // junta poções do mesmo tipo em pilhas de até STACK_MAX
    let left = it.qty ?? 1;
    for (let n = 0; left > 0; n++) {
      const k = `${it.baseId}#${n}`,
        cur = stacks.get(k);
      if (!cur) {
        stacks.set(k, { ...it, qty: Math.min(left, STACK_MAX) });
        left -= STACK_MAX;
        break;
      }
      const add = Math.min(left, STACK_MAX - (cur.qty ?? 1));
      if (add > 0) {
        cur.qty = (cur.qty ?? 1) + add;
        left -= add;
      }
    }
  }
  const potKeys = Object.keys(POTIONS),
    conKeys = Object.keys(CONSUMABLES),
    matKeys = Object.keys(MATERIALS);
  const rank = (it: ItemInstance) =>
    isPotionId(it.baseId)
      ? 100 + potKeys.indexOf(it.baseId)
      : isConsumableId(it.baseId)
        ? 150 + conKeys.indexOf(it.baseId)
        : isMaterialId(it.baseId)
          ? 200 + matKeys.indexOf(it.baseId)
          : SLOTS.indexOf(BASES[it.baseId].slot);
  const all = [...items, ...stacks.values()].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      RARITY_RANK.indexOf(b.rarity) - RARITY_RANK.indexOf(a.rarity) ||
      b.ilvl - a.ilvl ||
      (b.plus ?? 0) - (a.plus ?? 0) ||
      (BASES[a.baseId]?.name ?? '').localeCompare(BASES[b.baseId]?.name ?? ''),
  );
  return [...all, ...Array(Math.max(0, bag.length - all.length)).fill(null)];
}
