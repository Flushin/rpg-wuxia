// Dados da wiki: lidos dos mesmos JSON do jogo (src/data/), em português, com o mesmo balanceamento.
// Mudou um número no JSON, a wiki muda junto. Escrito à mão: rótulos, textos de papel dos NPCs (npcs.ts) e
// algumas fórmulas copiadas do jogo (marcadas), que tools/wiki-check.ts (npm run check:wiki) confere.
import itemsRaw from '../data/items.json';
import monstersRaw from '../data/monsters.json';
import npcsJson from '../data/npcs.json';
import questsRaw from '../data/quests.json';
import classesRaw from '../data/classes.json';
import skillsRaw from '../data/skills.json';
import progressionRaw from '../data/progression.json';
import atlas from '../data/sprites/icones.json';
import {
  bal,
  balanceClasses,
  balanceItems,
  balanceMonsters,
  balanceProgression,
  balanceQuests,
  balanceSkills,
} from '../core/balance';

// Cópias: o balanceamento abaixo muda os objetos, e no teste (tools/wiki-check.ts) o jogo também aplica o seu.
const itemsJson = structuredClone(itemsRaw),
  monstersJson = structuredClone(monstersRaw),
  questsJson = structuredClone(questsRaw),
  classesJson = structuredClone(classesRaw),
  skillsJson = structuredClone(skillsRaw),
  progressionJson = structuredClone(progressionRaw);

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
export interface EquipDrop {
  chance: number;
  maxReqLevel: number;
  minReqLevel?: number;
  minMonsterLevel?: number;
}
type Attrs = { strength: number; intelligence: number; stamina: number; agility: number; willpower: number };
export interface BossDef {
  arenaRadius: number;
  aoe?: { radius: number; delay: number; mult: number; interval: number; intervalPhase2?: number };
  summon?: { monsterId: string; count: number; level: number; atHpPct: number };
  enrage?: { atHpPct: number; attackIntervalMul: number; damageMul: number; moveSpeedMul: number };
  line?: {
    length: number;
    width: number;
    delay: number;
    mult: number;
    fanAtHpPct: number;
    fanCount: number;
    fanSpread: number;
  };
}
export interface Monster {
  id: string;
  name: string;
  sprite: string;
  minLevel: number;
  maxLevel: number;
  baseAttributes: Attrs;
  perLevel: Attrs;
  damageType: 'physical' | 'spiritual';
  aggroRange: number;
  attackRange: number;
  attackInterval: number;
  moveSpeed: number;
  xpBase: number;
  xpPerLevel: number;
  respawnSeconds: number;
  defMul?: { phys: number; spirit: number };
  projectile?: string;
  poisonRes?: number;
  keepDistance?: number;
  groupAggro?: boolean;
  onHit?: { slow: number; duration: number };
  slam?: { radius: number; delay: number; mult: number; interval: number };
  boss?: BossDef;
  loot: {
    gold?: { min: number; max: number; perLevel?: number };
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
  offer: string;
  done: string;
  objective: { type: string; monster?: string; npc?: string; map?: string; count?: number };
  reward: { xp: number; gold: number; item?: string; itemLevel?: number };
}

const I = itemsJson as unknown as {
  slotNames: Record<string, string>;
  startingWeapon: Record<string, string>;
  sellRatio: number;
  repairCostPerPoint: number;
  wearPerHit: number;
  groundSeconds: number;
  rarities: Record<string, { name: string; color: string; weight: number; bonuses: number; valueMul: number }>;
  bonusPool: { stat: string; min: number; max: number }[];
  epicNames: Record<string, string>;
  epicBonuses: Record<string, string[]>;
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

// Mesmos multiplicadores de src/data/balance.json que o jogo aplica ao carregar (a wiki é outra página, então
// aplica uma vez aqui). As regras aplicadas na hora do uso (ex.: vida dos monstros) usam bal() nas páginas.
balanceItems(I as unknown as Parameters<typeof balanceItems>[0]);
balanceMonsters(monstersJson as unknown as Parameters<typeof balanceMonsters>[0]);
balanceClasses(classesJson as unknown as Parameters<typeof balanceClasses>[0]);
balanceSkills(skillsJson as unknown as Parameters<typeof balanceSkills>[0]);
balanceProgression(progressionJson as unknown as Parameters<typeof balanceProgression>[0]);
balanceQuests((questsJson as unknown as { chain: Parameters<typeof balanceQuests>[0] }).chain);

export const SLOT_NAMES = I.slotNames;
export const STARTING_WEAPON = I.startingWeapon;
export const RARITIES = I.rarities;
export const BONUS_POOL = I.bonusPool;
export const EPIC_NAMES = I.epicNames;
export const EPIC_BONUSES = I.epicBonuses;
/** Os 9 Épicos (um por slot; arma por seita). O id é o mesmo do ícone (epico_<slot> / epico_arma_<seita>). */
export const EPIC_ITEMS: { id: string; slot: string; sect?: string; name: string }[] = [
  ...['colar', 'tronco', 'cabeca', 'calca', 'bota'].map((slot) => ({
    id: `epico_${slot}`,
    slot,
    name: I.epicNames[slot],
  })),
  ...['lamina', 'pavilhao', 'tita', 'vibora'].map((sect) => ({
    id: `epico_arma_${sect}`,
    slot: 'arma',
    sect,
    name: I.epicNames[`arma_${sect}`],
  })),
];
/** Base da faixa do Épico no nível (cópia de epicTierBase em src/core/items.ts): mesmo slot (arma: mesma seita), maior
 *  nível exigido até o nível do personagem. */
export function epicTierBase(slot: string, sect: string | undefined, level: number): string {
  let best = '',
    lowest = '';
  for (const [id, b] of Object.entries(I.bases)) {
    if (b.slot !== slot || (b.sect ?? '') !== (sect ?? '')) continue;
    if (!lowest || b.reqLevel < I.bases[lowest].reqLevel) lowest = id;
    if (b.reqLevel <= level && (!best || b.reqLevel > I.bases[best].reqLevel)) best = id;
  }
  return best || lowest;
}
/** Atributos do Épico no +0 (sem os bônus da classe): base da faixa × EPIC.mul (cópia de itemStats em src/core/items.ts). */
export function epicTierStats(slot: string, sect: string | undefined, level: number): Record<string, number> {
  const b = I.bases[epicTierBase(slot, sect, level)];
  return Object.fromEntries(
    Object.entries(b.stats).map(([k, v]) => {
      const x = v * EPIC.mul;
      return [k, Math.abs(v) >= 1 ? Math.round(x) : Math.round(x * 1000) / 1000];
    }),
  );
}
/** Épico: cópia das regras de src/core/items.ts (EPIC_*) e src/core/world/inventory.ts (rollEpic). */
export const EPIC = { mul: 1.3, chanceMob: 0.005, chanceBoss: 0.01, maxLevelsBelow: 10, groundSeconds: 600 };
export const SELL_RATIO = I.sellRatio;
export const REPAIR_COST_PER_POINT = I.repairCostPerPoint;
export const WEAR_PER_HIT = I.wearPerHit;
export const GROUND_SECONDS = I.groundSeconds;
export const UPGRADE_STEP = I.upgradeStep;
export const MERCHANT = I.merchant;
export const BASES = I.bases;
export const POTIONS = I.potions;
export const MATERIALS = I.materials;
export const CONSUMABLES = I.consumables;
export const MONSTERS = monstersJson as unknown as Record<string, Monster>;
export const QUESTS = (questsJson as unknown as { chain: Quest[] }).chain;
export type AttrKey = 'strength' | 'intelligence' | 'stamina' | 'agility' | 'willpower';
export interface ClassDef {
  id: string;
  name: string;
  description: string;
  rangeLabel: string;
  damageType: 'physical' | 'spiritual';
  element: string;
  attackRange: number;
  attackInterval: number;
  attackWhileMoving?: boolean;
  moveSpeed: number;
  lifeSteal?: number;
  color: string;
  baseAttributes: Record<AttrKey, number>;
  levelUpAttributes: Record<AttrKey, number>;
  elementAttack: Record<string, number>;
  recommended: { attr: AttrKey; reason: string }[];
  optional: { attr: AttrKey; reason: string }[];
}
export const CLASSES = classesJson as unknown as Record<string, ClassDef>;
/** Ordem das seitas no jogo (SECT_ORDER em src/core/data.ts). */
export const SECT_ORDER = ['lamina', 'pavilhao', 'tita', 'vibora'];
export const ELEMENT_NAMES: Record<string, string> = { fire: 'Fogo', ice: 'Gelo', thunder: 'Trovão', poison: 'Veneno' };
export const PROGRESSION = progressionJson as unknown as {
  levelCap: number;
  xpToNext: number[];
  freePointsPerLevel: number;
  freePointsHigh?: { fromLevel: number; points: number };
  attrResetCost: number;
};
/** Texto dos pontos livres por nível (ex.: "3 pontos livres por nível (4 do nível 21 em diante)"). */
export function freePointsText(): string {
  const h = PROGRESSION.freePointsHigh,
    base = `${PROGRESSION.freePointsPerLevel} pontos livres por nível`;
  return h ? `${base} (${h.points} do nível ${h.fromLevel} em diante)` : base;
}

export interface SkillDef {
  id: string;
  name: string;
  type: 'active' | 'passive';
  unlock: number;
  description: string;
  mana?: number;
  cooldown?: number;
  target?: string;
  range?: number | 'melee';
  area?: 'self' | 'target';
  radius?: number;
  dash?: boolean;
  hits?: number[];
  debuff?: { kind: string; value: number; duration: number };
  poison?: { percent: number; duration: number };
  shield?: { percent: number; duration: number };
  heal?: { percent: number; duration: number };
  stun?: number;
  passive?: Record<string, number>;
}
export const SKILLS = skillsJson as unknown as Record<string, SkillDef[]>;
export const skillSect = (id: string) => SECT_ORDER.find((s) => SKILLS[s]?.some((k) => k.id === id));
export const skillById = (id: string) =>
  Object.values(SKILLS)
    .flat()
    .find((k) => k.id === id);

// Cópias das regras de src/core/skills.ts (lá o módulo depende do idioma do jogo); tools/wiki-check.ts confere que batem.
export const SKILL_MAX_LEVEL = 15;
export const LEVEL_BONUS = 0.08;
export const skillScale = (level: number) => 1 + LEVEL_BONUS * bal('skills.bonus_por_nivel') * (Math.max(1, level) - 1);
export const skillXpToNext = (level: number) =>
  Math.max(
    1,
    Math.round(
      (level < 10 ? 20 * Math.pow(1.5, level - 1) : 20 * Math.pow(1.5, 8) * Math.pow(1.4, level - 9)) /
        bal('xp.skills'),
    ),
  );
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
