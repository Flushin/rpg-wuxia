// Dados da wiki: lidos dos mesmos JSON do jogo (src/data/), em português. Nada aqui é escrito à mão,
// exceto os rótulos e as descrições de papel dos NPCs (npcs.ts). Mudou um número no JSON, a wiki muda junto.
import itemsJson from '../data/items.json';
import monstersJson from '../data/monsters.json';
import npcsJson from '../data/npcs.json';
import questsJson from '../data/quests.json';
import classesJson from '../data/classes.json';
import atlas from '../data/sprites/icones.json';

export interface Base {
  name: string;
  slot: string;
  sect?: string;
  reqLevel: number;
  durability: number;
  value: number;
  stats: Record<string, number>;
}
export interface Potion {
  name: string;
  kind: string;
  percent: number;
  duration: number;
  cooldown: number;
  price: number;
}
export interface Material {
  name: string;
  tier: string;
  value: number;
  desc: string;
}
export interface Consumable {
  name: string;
  price: number;
  desc: string;
}
interface EquipDrop {
  chance: number;
  maxReqLevel: number;
  minReqLevel?: number;
  minMonsterLevel?: number;
}
export interface Monster {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  boss?: unknown;
  loot: {
    gold?: { min: number; max: number };
    potions?: { id: string; chance: number; minMonsterLevel?: number }[];
    materials?: { id: string; chance: number; min?: number; max?: number }[];
    equipment?: EquipDrop | EquipDrop[];
    guaranteed?: { rarity: string; reqLevel: number };
  };
}
export interface Quest {
  id: string;
  giver: string;
  turnIn: string;
  minLevel: number;
  name: string;
  goal: string;
  objective: { type: string; monster?: string; npc?: string; map?: string; count?: number };
  reward: { xp: number; gold: number; item?: string; itemLevel?: number };
}

const I = itemsJson as unknown as {
  slotNames: Record<string, string>;
  sellRatio: number;
  repairCostPerPoint: number;
  rarities: Record<string, { name: string; color: string; weight: number; bonuses: number; valueMul: number }>;
  bonusPool: { stat: string; min: number; max: number }[];
  bases: Record<string, Base>;
  potions: Record<string, Potion>;
  materials: Record<string, Material>;
  consumables: Record<string, Consumable>;
  merchant: {
    stockMin: number;
    stockMax: number;
    refreshMinutes: number;
    rareChance: number;
    priceMul: number;
    materials: Record<string, number>;
  };
  upgradeStep: number;
};

export const SLOT_NAMES = I.slotNames;
export const RARITIES = I.rarities;
export const BONUS_POOL = I.bonusPool;
export const SELL_RATIO = I.sellRatio;
export const MERCHANT = I.merchant;
export const BASES = I.bases;
export const POTIONS = I.potions;
export const MATERIALS = I.materials;
export const CONSUMABLES = I.consumables;
export const MONSTERS = monstersJson as unknown as Record<string, Monster>;
export const QUESTS = (questsJson as unknown as { chain: Quest[] }).chain;
export const CLASSES = classesJson as unknown as Record<string, { name: string; element: string; color: string }>;
export const NPC_TEXT = npcsJson as unknown as {
  masters: Record<string, { name: string; title: string; greeting: string; intro: string; tips?: string[] }>;
  npcs: Record<string, { name: string; lines: string[] }>;
};

export const STAT_LABELS: Record<string, string> = {
  strength: 'Força',
  intelligence: 'Inteligência',
  stamina: 'Vigor',
  agility: 'Agilidade',
  willpower: 'Vontade',
  maxHp: 'Vida máxima',
  maxMana: 'Mana máxima',
  physAtk: 'Ataque físico',
  spiritAtk: 'Ataque espiritual',
  physDef: 'Defesa física',
  spiritDef: 'Defesa espiritual',
  hit: 'Precisão',
  evasion: 'Esquiva',
  critChance: 'Chance de crítico',
  critDamage: 'Dano crítico',
  elem_fire: 'Ataque de Fogo',
  elem_ice: 'Ataque de Gelo',
  elem_thunder: 'Ataque de Trovão',
  elem_poison: 'Ataque de Veneno',
  elemAtk: 'Ataque do elemento da sua seita',
};
const PERCENT = new Set(['critChance', 'critDamage']);
export const fmtStatValue = (stat: string, v: number) =>
  PERCENT.has(stat) ? `${+(v * 100).toFixed(1)}%` : String(+v.toFixed(2));
export const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

// ---------- Itens ----------
export type ItemKind = 'equip' | 'potion' | 'material' | 'consumable';
export const KIND_NAMES: Record<ItemKind, string> = {
  equip: 'Equipamento',
  potion: 'Poção',
  material: 'Material',
  consumable: 'Consumível',
};
export function itemKind(id: string): ItemKind | null {
  if (id in BASES) return 'equip';
  if (id in POTIONS) return 'potion';
  if (id in MATERIALS) return 'material';
  if (id in CONSUMABLES) return 'consumable';
  return null;
}
export const itemName = (id: string) =>
  BASES[id]?.name ?? POTIONS[id]?.name ?? MATERIALS[id]?.name ?? CONSUMABLES[id]?.name ?? id;
export const allItemIds = () => [
  ...Object.keys(BASES),
  ...Object.keys(POTIONS),
  ...Object.keys(MATERIALS),
  ...Object.keys(CONSUMABLES),
];

/** Venda no Vendedor de Poções (mesma conta de sellValue em src/core/items.ts). */
export const sellPrice = (value: number, mul = 1) => Math.max(1, Math.floor(value * mul * SELL_RATIO + 1e-9));
/** Preço no Mercador Ambulante (offerPrice em src/core/world/merchant.ts). */
export const merchantPrice = (value: number, rarity: string) =>
  Math.max(1, Math.round(value * RARITIES[rarity].valueMul * MERCHANT.priceMul));

/** Níveis de equipamento existentes (1, 5, 10, 15...). */
export const EQUIP_TIERS = [...new Set(Object.values(BASES).map((b) => b.reqLevel))].sort((a, b) => a - b);

export interface DropSource {
  monster: string;
  chance: number; // por abate
  note?: string;
  boss: boolean;
}

/** Monstros que deixam cair este item, com a chance por abate. */
export function dropsOf(id: string): DropSource[] {
  const out: DropSource[] = [];
  const b = BASES[id];
  for (const m of Object.values(MONSTERS)) {
    const boss = !!m.boss;
    const L = m.loot;
    if (b) {
      const eqs = L.equipment ? (Array.isArray(L.equipment) ? L.equipment : [L.equipment]) : [];
      for (const eq of eqs) {
        if (b.reqLevel > eq.maxReqLevel || b.reqLevel < (eq.minReqLevel ?? 0)) continue;
        const note = eq.minMonsterLevel ? `só monstros de nível ${eq.minMonsterLevel}+` : undefined;
        out.push({ monster: m.id, chance: eq.chance, note, boss });
      }
      if (L.guaranteed && L.guaranteed.reqLevel === b.reqLevel)
        out.push({
          monster: m.id,
          chance: 1,
          note: `1 item ${RARITIES[L.guaranteed.rarity].name.toLowerCase()} garantido, de um tipo sorteado`,
          boss,
        });
    }
    for (const p of L.potions ?? [])
      if (p.id === id)
        out.push({
          monster: m.id,
          chance: p.chance,
          note: p.minMonsterLevel ? `só monstros de nível ${p.minMonsterLevel}+` : undefined,
          boss,
        });
    for (const mt of L.materials ?? [])
      if (mt.id === id)
        out.push({
          monster: m.id,
          chance: mt.chance,
          note: mt.min ? `${mt.min} a ${mt.max} unidades` : undefined,
          boss,
        });
  }
  return out;
}

/** Missões cujo objetivo ou recompensa envolve este item (por enquanto: recompensas de equipamento por slot). */
export function questRewardsFor(id: string): Quest[] {
  const b = BASES[id];
  if (!b) return [];
  return QUESTS.filter((q) => q.reward.item === b.slot && (q.reward.itemLevel ?? 5) === b.reqLevel);
}

// ---------- NPCs ----------
/** Papel "mestre" nas missões = o mestre da seita do jogador. */
export const questsOfNpc = (npc: string) => {
  const role = npc.startsWith('mestre_') ? 'mestre' : npc;
  return QUESTS.filter((q) => q.giver === role || q.turnIn === role);
};

// ---------- Ícones ----------
const A = atlas as { cols: number; rows: number; index: Record<string, number> };
export function iconHtml(name: string, cls = ''): string {
  const k = A.index[name];
  if (k === undefined) return `<i class="ico ${cls} none"></i>`;
  const c = k % A.cols,
    r = Math.floor(k / A.cols);
  return `<i class="ico ${cls}" style="background-position:${(c / (A.cols - 1)) * 100}% ${(r / (A.rows - 1)) * 100}%;background-size:${A.cols * 100}% ${A.rows * 100}%"></i>`;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
