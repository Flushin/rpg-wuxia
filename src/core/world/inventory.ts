// Inventário: mochila, equipar, poções, itens no chão, coleta e desgaste.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { CLASSES, type MonsterDef } from '../data';
import { L } from '../i18n';
import {
  BASES,
  GROUND_SECONDS,
  POTIONS,
  SLOTS,
  STACK_MAX,
  baseOf,
  equipmentBaseIds,
  isBroken,
  isPotionId,
  isStackId,
  MATERIALS,
  itemColor,
  itemName,
  itemStats,
  makeEquipment,
  makePotion,
  maxDurability,
  rollRarity,
  sortedBag,
  WEAR_PER_HIT,
} from '../items';
import { type Entity, type ItemInstance, type PotionKind, type Rarity, type Slot } from '../types';
import type { ActionError } from '../types';
import type { World } from '../world';
import { dist } from './geometry';

export function wearGear(w: World) {
  if (WEAR_PER_HIT <= 0) return;
  const worn = SLOTS.map((sl) => w.equipment[sl]).filter((i): i is ItemInstance => !!i && i.durability > 0);
  if (!worn.length) return;
  const it = worn[Math.min(worn.length - 1, Math.floor(w.rng.next() * worn.length))];
  it.durability = Math.max(0, it.durability - WEAR_PER_HIT);
  if (it.durability <= 0) w.recalc(w.player, false);
  w.bumpInv();
}

// stats dos equipamentos (só itens com durabilidade > 0)
export function gearStats(w: World): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sl of SLOTS) {
    const it = w.equipment[sl];
    if (!it || isBroken(it)) continue;
    for (const [k, v] of Object.entries(itemStats(it))) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function sortBag(w: World) {
  w.bag = sortedBag(w.bag);
  w.bumpInv();
}

export function freeSlots(w: World): number {
  return w.bag.filter((b) => !b).length;
}

export function canFit(w: World, baseId: string, qty = 1): boolean {
  if (!isStackId(baseId)) return freeSlots(w) >= 1;
  let room = freeSlots(w) * STACK_MAX;
  for (const b of w.bag) if (b && b.baseId === baseId) room += STACK_MAX - (b.qty ?? 1);
  return room >= qty;
}

// adiciona na mochila (potions empilham até 99). Sem eventos.
export function addItem(w: World, item: ItemInstance): boolean {
  const qty = item.qty ?? 1;
  if (!canFit(w, item.baseId, qty)) return false;
  if (isStackId(item.baseId)) {
    let rem = qty;
    for (const b of w.bag) {
      if (rem <= 0) break;
      if (b && b.baseId === item.baseId && (b.qty ?? 1) < STACK_MAX) {
        const a = Math.min(rem, STACK_MAX - (b.qty ?? 1));
        b.qty = (b.qty ?? 1) + a;
        rem -= a;
      }
    }
    while (rem > 0) {
      const i = w.bag.findIndex((b) => !b),
        a = Math.min(rem, STACK_MAX);
      w.bag[i] = { ...item, uid: i === 0 && a === qty ? item.uid : makePotion(item.baseId).uid, qty: a };
      rem -= a;
    }
  } else w.bag[w.bag.findIndex((b) => !b)] = item;
  w.bumpInv();
  return true;
}

export function potionCount(w: World, baseId: string): number {
  return w.bag.reduce((a, b) => a + (b && b.baseId === baseId ? (b.qty ?? 1) : 0), 0);
}

export function kindCount(w: World, kind: PotionKind): number {
  return Object.keys(POTIONS)
    .filter((id) => POTIONS[id].kind === kind)
    .reduce((a, id) => a + potionCount(w, id), 0);
}

export function removeFromBag(w: World, i: number, qty = 1) {
  const b = w.bag[i];
  if (!b) return;
  if (b.qty && b.qty > qty) b.qty -= qty;
  else w.bag[i] = null;
  w.bumpInv();
}

export function collect(w: World, item: ItemInstance, x: number, y: number) {
  w.auto.recordDrop(item);
  let placed = addItem(w, item);
  if (!placed && w.auto.sellingActive) {
    // auto-combate: mochila cheia vende o que a regra permite
    w.auto.makeRoom();
    placed = addItem(w, item);
    if (!placed && w.auto.sellable(item)) {
      w.sellValueNow(item);
      return;
    }
  }
  if (placed) {
    w.emit({
      type: 'itemPickup',
      baseId: item.baseId,
      name: itemName(item),
      color: itemColor(item),
      qty: item.qty ?? 1,
      potion: isPotionId(item.baseId),
      rarity: pickupRarity(item),
    });
  } else {
    w.ground.push({ id: w.nextGround++, x, y, item, expires: w.time + GROUND_SECONDS });
    w.emit({ type: 'bagFull' });
  }
}

/** Raridade mostrada ao pegar: material raro/especial aparece no aviso de itens como os equipamentos raros. */
const pickupRarity = (it: ItemInstance): Rarity => {
  const m = MATERIALS[it.baseId];
  return m ? (m.tier === 'comum' ? 'comum' : 'raro') : it.rarity;
};

export function tickGround(w: World) {
  if (!w.ground.length) return;
  const p = w.player;
  for (const g of [...w.ground]) {
    if (w.time >= g.expires) {
      w.ground = w.ground.filter((x) => x !== g);
      w.emit({ type: 'groundGone', id: g.id });
      continue;
    }
    if (g.item && dist(g, p) < 0.9 && addItem(w, g.item)) {
      const it = g.item;
      w.ground = w.ground.filter((x) => x !== g);
      w.emit({ type: 'groundGone', id: g.id });
      w.emit({
        type: 'itemPickup',
        baseId: it.baseId,
        name: itemName(it),
        color: itemColor(it),
        qty: it.qty ?? 1,
        potion: isPotionId(it.baseId),
        rarity: pickupRarity(it),
      });
    }
  }
}

export function dropLoot(w: World, m: Entity, def: MonsterDef) {
  const L = def.loot;
  if (!L) return;
  const spot = () => ({ x: m.x + w.rng.range(-0.4, 0.4), y: m.y + w.rng.range(-0.4, 0.4) });
  if (L.gold) {
    const add = (L.gold.perLevel ?? 0) * (m.level - 1);
    const g = w.rng.int(Math.round(L.gold.min + add), Math.round(L.gold.max + add));
    if (g > 0) {
      w.gold += g;
      w.bumpInv();
      w.emit({ type: 'drop', x: m.x, y: m.y, color: '#ffd23f' });
      w.emit({ type: 'goldPickup', amount: g });
    }
  }
  for (const pd of L.potions ?? []) {
    if (pd.minMonsterLevel && m.level < pd.minMonsterLevel) continue;
    if (w.rng.next() >= pd.chance) continue;
    const s = spot();
    w.emit({ type: 'drop', x: s.x, y: s.y, color: POTIONS[pd.id]?.color ?? '#fff' });
    collect(w, makePotion(pd.id, 1), s.x, s.y);
  }
  for (const md of L.materials ?? []) {
    if (w.rng.next() >= md.chance) continue;
    const s = spot();
    w.emit({ type: 'drop', x: s.x, y: s.y, color: MATERIALS[md.id]?.color ?? '#fff' });
    collect(w, makePotion(md.id, w.rng.int(md.min ?? 1, md.max ?? md.min ?? 1)), s.x, s.y);
  }
  const sectOk = (id: string) => !BASES[id].sect || BASES[id].sect === w.classId;
  const give = (id: string, rarity: Rarity, ilvl = m.level) => {
    const it = makeEquipment(id, rarity, CLASSES[w.classId].element, w.rng, ilvl);
    const s = spot();
    w.emit({ type: 'drop', x: s.x, y: s.y, color: itemColor(it) });
    collect(w, it, s.x, s.y);
  };
  const eqs = L.equipment ? (Array.isArray(L.equipment) ? L.equipment : [L.equipment]) : [];
  for (const eq of eqs) {
    if (eq.minMonsterLevel && m.level < eq.minMonsterLevel) continue;
    if (w.rng.next() >= eq.chance) continue;
    const ids = equipmentBaseIds().filter(
      (id) => BASES[id].reqLevel <= eq.maxReqLevel && BASES[id].reqLevel >= (eq.minReqLevel ?? 0) && sectOk(id),
    );
    if (ids.length) give(ids[Math.min(ids.length - 1, Math.floor(w.rng.next() * ids.length))], rollRarity(w.rng));
  }
  if (L.guaranteed) {
    // 1 item garantido de slot aleatório (arma só da seita do jogador)
    const ids = equipmentBaseIds().filter((id) => BASES[id].reqLevel === L.guaranteed!.reqLevel && sectOk(id));
    if (ids.length)
      give(
        ids[Math.min(ids.length - 1, Math.floor(w.rng.next() * ids.length))],
        L.guaranteed.rarity,
        L.guaranteed.reqLevel,
      );
  }
}

// devolve o motivo (código) ou null se pode equipar
export function canEquip(w: World, it: ItemInstance): ActionError | null {
  const b = baseOf(it);
  if (!b) return { code: 'notEquippable' };
  if (w.player.level < b.reqLevel) return { code: 'needLevel', level: b.reqLevel };
  if (b.sect && b.sect !== w.classId) return { code: 'sectOnly', sect: b.sect };
  return null;
}

export function equip(w: World, bagIndex: number): ActionError | null {
  const it = w.bag[bagIndex];
  if (!it) return null;
  const err = canEquip(w, it);
  if (err) return err;
  const slot = BASES[it.baseId].slot;
  w.bag[bagIndex] = w.equipment[slot];
  w.equipment[slot] = it;
  afterEquip(w);
  return null;
}

export function unequip(w: World, slot: Slot): ActionError | null {
  const it = w.equipment[slot];
  if (!it) return null;
  const i = w.bag.findIndex((b) => !b);
  if (i < 0) return { code: 'bagFull' };
  w.bag[i] = it;
  w.equipment[slot] = null;
  afterEquip(w);
  return null;
}

export function afterEquip(w: World) {
  w.recalc(w.player, false);
  w.bumpInv();
  w.emit({ type: 'equipChange' });
}

// ---------- poções ----------
export function usePotion(w: World, kind: PotionKind, baseId?: string): boolean {
  const p = w.player;
  if (p.dead) return false;
  if (w.potionCd[kind] > 0) {
    w.emit({ type: 'potionFail', kind, reason: 'cooldown' });
    return false;
  }
  const ids = baseId ? [baseId] : Object.keys(POTIONS).filter((id) => POTIONS[id].kind === kind);
  const id = ids.find((x) => POTIONS[x]?.kind === kind && potionCount(w, x) > 0);
  if (!id) {
    w.emit({ type: 'potionFail', kind, reason: 'none' });
    return false;
  }
  const full = kind === 'hp' ? p.hp >= p.derived.maxHp - 0.01 : p.mana >= p.derived.maxMana - 0.01;
  if (full) {
    w.emit({ type: 'potionFail', kind, reason: 'full' });
    return false;
  }
  const d = POTIONS[id];
  removeFromBag(
    w,
    w.bag.findIndex((b) => b && b.baseId === id),
  );
  const max = kind === 'hp' ? p.derived.maxHp : p.derived.maxMana;
  w.potionFx[kind] = { id, remaining: d.duration, rate: (max * d.percent) / d.duration }; // reinicia o efeito
  w.potionCd[kind] = d.cooldown;
  w.emit({ type: 'potionUsed', id, kind });
  return true;
}

export function tickPotions(w: World, dt: number) {
  const p = w.player;
  for (const kind of ['hp', 'mp'] as PotionKind[]) {
    const fx = w.potionFx[kind];
    if (!fx) continue;
    const step = Math.min(dt, fx.remaining),
      amt = fx.rate * step;
    if (kind === 'hp') p.hp = Math.min(p.derived.maxHp, p.hp + amt);
    else p.mana = Math.min(p.derived.maxMana, p.mana + amt);
    fx.remaining -= dt;
    if (fx.remaining <= 0) w.potionFx[kind] = null;
  }
}

export function lowDurability(w: World): boolean {
  return SLOTS.some((s) => {
    const i = w.equipment[s];
    return !!i && i.durability <= maxDurability(i) * 0.2;
  });
}
