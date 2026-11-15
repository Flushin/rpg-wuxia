import itemsJson from '../data/items.json';
import type { Rng } from './rng';
import type { Bonus, ItemInstance, PotionKind, Rarity, Slot } from './types';

export interface ItemBase {
  name: string; slot: Slot; sect?: string; reqLevel: number; durability: number; value: number; stats: Record<string, number>;
}
export interface PotionDef { name: string; kind: PotionKind; percent: number; duration: number; cooldown: number; price: number; color: string }
export interface RarityDef { name: string; color: string; weight: number; bonuses: number; valueMul: number }
interface BonusDef { stat: string; min: number; max: number }

const J = itemsJson as unknown as {
  slots: Slot[]; slotNames: Record<Slot, string>; bagSize: number; stackMax: number; sellRatio: number; repairCostPerPoint: number;
  groundSeconds: number; startingKit: Record<string, number>; startingWeapon: Record<string, string>;
  rarities: Record<Rarity, RarityDef>; bonusPool: BonusDef[]; bases: Record<string, ItemBase>; potions: Record<string, PotionDef>;
};
export const SLOTS = J.slots, SLOT_NAMES = J.slotNames, BAG_SIZE = J.bagSize, STACK_MAX = J.stackMax;
export const GROUND_SECONDS = J.groundSeconds, STARTING_KIT = J.startingKit, STARTING_WEAPON = J.startingWeapon;
export const RARITIES = J.rarities, BASES = J.bases, POTIONS = J.potions;
export const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'raro'];
export const isPotionId = (id: string) => id in POTIONS;

export const STAT_LABELS: Record<string, string> = {
  strength: 'Força', intelligence: 'Inteligência', stamina: 'Vigor', agility: 'Agilidade', willpower: 'Vontade',
  maxHp: 'Vida máxima', maxMana: 'Mana máxima', physAtk: 'Ataque físico', spiritAtk: 'Ataque espiritual',
  physDef: 'Defesa física', spiritDef: 'Defesa espiritual', hit: 'Precisão', evasion: 'Esquiva',
  critChance: 'Chance de crítico', critDamage: 'Dano crítico',
  elem_fire: 'Ataque de Fogo', elem_ice: 'Ataque de Gelo', elem_thunder: 'Ataque de Trovão', elem_poison: 'Ataque de Veneno',
};
const PERCENT_STATS = new Set(['critChance', 'critDamage']);
export const fmtStatValue = (stat: string, v: number) => PERCENT_STATS.has(stat) ? `${+(v * 100).toFixed(1)}%` : String(+v.toFixed(2));
export const fmtStat = (stat: string, v: number) => `${v >= 0 ? '+' : '−'}${fmtStatValue(stat, Math.abs(v))} ${STAT_LABELS[stat] ?? stat}`;

export const baseOf = (it: ItemInstance): ItemBase | undefined => BASES[it.baseId];
export const potionOf = (it: ItemInstance): PotionDef | undefined => POTIONS[it.baseId];
export const itemName = (it: ItemInstance) => (BASES[it.baseId] ?? POTIONS[it.baseId])?.name ?? it.baseId;
export const itemColor = (it: ItemInstance) => POTIONS[it.baseId]?.color ?? RARITIES[it.rarity].color;
export const maxDurability = (it: ItemInstance) => BASES[it.baseId]?.durability ?? 0;
export const isBroken = (it: ItemInstance) => !!BASES[it.baseId] && it.durability <= 0;

// nível do item = maior entre o nível exigido da base e o do drop
let uidCounter = 0;
export const newUid = () => `${Date.now().toString(36)}-${(uidCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function makePotion(baseId: string, qty = 1): ItemInstance {
  return { uid: newUid(), baseId, rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty };
}

export function rollRarity(rng: Rng): Rarity {
  const total = RARITY_ORDER.reduce((a, r) => a + RARITIES[r].weight, 0);
  let x = rng.next() * total;
  for (const r of RARITY_ORDER) { x -= RARITIES[r].weight; if (x < 0) return r; }
  return 'comum';
}

export function rollBonuses(count: number, ilvl: number, element: string | null, rng: Rng): Bonus[] {
  const pool = [...J.bonusPool], out: Bonus[] = [], scale = 1 + 0.2 * (Math.max(1, ilvl) - 1);
  while (out.length < count && pool.length) {
    const d = pool.splice(Math.min(pool.length - 1, Math.floor(rng.next() * pool.length)), 1)[0];
    const stat = d.stat === 'elemAtk' ? `elem_${element ?? 'fire'}` : d.stat;
    let v = rng.range(d.min, d.max) * scale;
    v = d.max >= 1 ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
    out.push({ stat, value: v });
  }
  return out;
}

export function makeEquipment(baseId: string, rarity: Rarity, element: string | null, rng: Rng, dropLevel = 1): ItemInstance {
  const b = BASES[baseId], ilvl = Math.max(b.reqLevel, dropLevel);
  return { uid: newUid(), baseId, rarity, ilvl, durability: b.durability, bonuses: rollBonuses(RARITIES[rarity].bonuses, ilvl, element, rng) };
}

// atributos/stats nominais (base + bônus), ignorando durabilidade
export function itemStats(it: ItemInstance): Record<string, number> {
  const out: Record<string, number> = {};
  const b = BASES[it.baseId];
  if (!b) return out;
  for (const [k, v] of Object.entries(b.stats)) out[k] = (out[k] ?? 0) + v;
  for (const bo of it.bonuses) out[bo.stat] = (out[bo.stat] ?? 0) + bo.value;
  return out;
}

export const buyPrice = (id: string) => POTIONS[id]?.price ?? 0;
// valor de venda de UMA unidade
export function sellValue(it: ItemInstance): number {
  const p = POTIONS[it.baseId];
  if (p) return Math.max(1, Math.floor(p.price * J.sellRatio));
  const b = BASES[it.baseId];
  return b ? Math.max(1, Math.floor(b.value * RARITIES[it.rarity].valueMul * J.sellRatio)) : 0;
}
export function repairCost(it: ItemInstance): number {
  const b = BASES[it.baseId];
  if (!b) return 0;
  const missing = Math.max(0, b.durability - it.durability);
  return missing <= 0 ? 0 : Math.max(1, Math.ceil(missing * Math.max(1, it.ilvl) * J.repairCostPerPoint));
}

export const equipmentBaseIds = (slot?: Slot) => Object.keys(BASES).filter((id) => !slot || BASES[id].slot === slot);

// valida/saneia um item vindo de save
export function sanitizeItem(raw: unknown): ItemInstance | null {
  const r = raw as Partial<ItemInstance> | null;
  if (!r || typeof r.baseId !== 'string') return null;
  const rarity: Rarity = r.rarity && r.rarity in RARITIES ? r.rarity : 'comum';
  if (POTIONS[r.baseId]) return { uid: String(r.uid ?? newUid()), baseId: r.baseId, rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty: Math.max(1, Math.min(STACK_MAX, Math.floor(Number(r.qty) || 1))) };
  const b = BASES[r.baseId];
  if (!b) return null;
  const bonuses = (Array.isArray(r.bonuses) ? r.bonuses : []).filter((x) => x && typeof x.stat === 'string' && Number.isFinite(x.value)).map((x) => ({ stat: x.stat, value: +x.value }));
  const dur = Number.isFinite(r.durability) ? Math.max(0, Math.min(b.durability, Number(r.durability))) : b.durability;
  return { uid: String(r.uid ?? newUid()), baseId: r.baseId, rarity, bonuses, ilvl: Math.max(b.reqLevel, Math.floor(Number(r.ilvl) || 1)), durability: dur };
}
