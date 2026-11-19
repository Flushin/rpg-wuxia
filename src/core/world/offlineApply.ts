// Ganho offline: aplica no personagem o resultado calculado em core/offline.ts e monta o resumo.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { CLASSES } from '../data';
import { POTIONS, isStackId, itemColor, itemName, makeEquipment, makePotion } from '../items';
import { computeOffline, type OfflineResult } from '../offline';
import { type ItemInstance, type PotionKind, type SaveData } from '../types';
import type { OfflineReport, World } from '../world';
import { TOWN_MAPS } from '../mapsConfig';
import { isDungeonMap } from '../dungeons';

// ---------- ganho offline ----------
export function applyOffline(w: World, now: number, lastSeen: number, saved: SaveData['auto']): OfflineReport | null {
  if (!saved?.active || !saved.mapId || TOWN_MAPS.has(saved.mapId) || !w.maps[saved.mapId]) return null;
  if (isDungeonMap(saved.mapId)) return null; // masmorra não rende nada offline
  const rate = w.auto.rate();
  if (!rate) return null;
  const elapsedMs = Math.max(0, now - (Number(lastSeen) || now)); // relógio adulterado: negativo vira 0
  const res: OfflineResult = computeOffline({
    elapsedMs,
    rate,
    level: w.player.level,
    xp: w.xp,
    potions: { hp: w.kindCount('hp'), mp: w.kindCount('mp') },
    seed: (now ^ Math.floor(w.xp * 7919)) >>> 0,
  });
  if (res.kills < 1) return null;
  const lvl0 = w.player.level;
  w.gold += res.gold;
  w.gainXp(res.xp);
  const items: OfflineReport['items'] = [];
  let soldCount = 0,
    soldGold = 0;
  const sell = (it: ItemInstance) => {
    soldCount += it.qty ?? 1;
    soldGold += w.sellValueNow(it);
  };
  for (const d of res.drops) {
    const isPot = isStackId(d.baseId); // poção ou material: uma pilha só
    for (let i = 0; i < (isPot ? 1 : d.qty); i++) {
      const it = isPot
        ? makePotion(d.baseId, d.qty)
        : makeEquipment(d.baseId, d.rarity, CLASSES[w.classId].element, w.rng, rate.monLevel);
      let placed = w.addItem(it);
      if (!placed && isPot) continue; // aba de consumíveis/materiais cheia: o auto não olha, fica para trás
      if (!placed) {
        // aba de equipamentos cheia: vende de uma vez todo equipamento que o auto vende e segue caçando
        const g0 = w.gold;
        soldCount += w.auto.makeRoom();
        soldGold += w.gold - g0;
        placed = w.addItem(it);
      }
      if (!placed) {
        sell(it);
        continue;
      }
      const e = items.find((x) => x.name === itemName(it) && x.rarity === it.rarity);
      if (e) e.qty += it.qty ?? 1;
      else items.push({ name: itemName(it), color: itemColor(it), rarity: it.rarity, qty: it.qty ?? 1 });
    }
  }
  const used: Record<PotionKind, number> = { hp: 0, mp: 0 };
  for (const k of ['hp', 'mp'] as PotionKind[]) {
    for (let n = res.potionsUsed[k]; n > 0; n--) {
      const i = w.bag.findIndex((b) => b && POTIONS[b.baseId]?.kind === k);
      if (i < 0) break;
      w.removeFromBag(i);
      used[k]++;
    }
  }
  // teto de ouro vale para abates + vendas: o que passar do teto se perde
  let goldCapped = res.gold >= res.goldCap && res.goldCap > 0;
  const over = res.gold + soldGold - res.goldCap;
  if (over > 0) {
    const cut = Math.min(over, soldGold);
    w.gold -= cut;
    soldGold -= cut;
    goldCapped = true;
  }
  w.player.hp = w.player.derived.maxHp;
  w.player.mana = w.player.derived.maxMana;
  w.events.length = 0; // sem toasts de nível/skill atrás do resumo
  return {
    elapsedMs,
    effMin: res.effMin,
    efficiency: res.efficiency,
    kills: res.kills,
    xp: res.xp,
    levelsGained: w.player.level - lvl0,
    newLevel: w.player.level,
    gold: res.gold,
    items,
    potionsUsed: used,
    soldCount,
    soldGold,
    goldCap: res.goldCap,
    goldCapped,
  };
}
