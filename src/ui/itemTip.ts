import { L } from '../core/i18n';
import { CLASSES } from '../core/data';
import {
  BASES,
  CONSUMABLES,
  MATERIALS,
  POTIONS,
  RARITIES,
  SLOT_NAMES,
  baseOf,
  fmtStat,
  fmtStatValue,
  isBroken,
  itemColor,
  itemName,
  itemStats,
  maxDurability,
  sellValue,
  STAT_LABELS,
} from '../core/items';
import type { ItemInstance, Slot } from '../core/types';
import type { World } from '../core/world';
import { hasIcon, iconHtml } from './icons';

const GREEN = '#6fdc6f',
  RED = '#ff6b6b';

const effStats = (w: World, it: ItemInstance | null) => (it && !isBroken(it) ? itemStats(it, w.owner()) : {});

export function compareHtml(w: World, it: ItemInstance): string {
  const b = baseOf(it);
  if (!b) return '';
  const cur = w.equipment[b.slot];
  if (cur === it) return '';
  const a = effStats(w, it),
    c = effStats(w, cur),
    keys = new Set([...Object.keys(a), ...Object.keys(c)]);
  const rows: string[] = [];
  for (const k of keys) {
    const d = (a[k] ?? 0) - (c[k] ?? 0);
    if (Math.abs(d) < 1e-9) continue;
    rows.push(
      `<div style="color:${d > 0 ? GREEN : RED}">${d > 0 ? '+' : '−'}${fmtStatValue(k, Math.abs(d))} ${STAT_LABELS[k] ?? k}</div>`,
    );
  }
  const head = cur
    ? L(`Em comparação ao equipado (${itemName(cur)}):`, `Compared to equipped (${itemName(cur)}):`)
    : L('Slot vazio, ao equipar:', 'Empty slot, if equipped:');
  return `<div class="tip-cmp"><small>${head}</small>${rows.join('') || `<div><small>${L('Sem diferença', 'No difference')}</small></div>`}</div>`;
}

export function itemTipHtml(w: World, it: ItemInstance, compare = true): string {
  const pot = POTIONS[it.baseId];
  if (pot) {
    return `<b style="color:${pot.color}">${pot.name}</b>
      <div>${L(`Recupera ${Math.round(pot.percent * 100)}% de ${pot.kind === 'hp' ? 'vida' : 'mana'} em ${pot.duration} s`, `Restores ${Math.round(pot.percent * 100)}% ${pot.kind === 'hp' ? 'health' : 'mana'} over ${pot.duration} s`)}</div>
      <small>${L('Usar outra do mesmo tipo reinicia o efeito.', 'Using another of the same type restarts the effect.')}</small>
      <div>${L('Quantidade', 'Quantity')}: ${it.qty ?? 1}</div><div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro (cada)`, `Sell: ${sellValue(it)} gold (each)`)}</div>`;
  }
  const st = MATERIALS[it.baseId] ?? CONSUMABLES[it.baseId];
  if (st) {
    return `<b style="color:${st.color}">${st.name}</b><div>${st.desc}</div>
      <div>${L('Quantidade', 'Quantity')}: ${it.qty ?? 1}</div><div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro (cada)`, `Sell: ${sellValue(it)} gold (each)`)}</div>`;
  }
  const b = BASES[it.baseId];
  if (!b) return `<b>${it.baseId}</b>`;
  const r = RARITIES[it.rarity],
    lvlBad = w.player.level < b.reqLevel,
    sectBad = !!b.sect && b.sect !== w.classId;
  // stats da base já com a melhoria (+N); os bônus aleatórios vêm à parte
  const base = itemStats(it, w.owner(), false);
  const lines = Object.entries(base)
    .map(
      ([k, v]) =>
        `<div>${fmtStat(k, v)}${it.plus && v !== b.stats[k] ? ` <small style="color:${GREEN}">(+${it.plus})</small>` : ''}</div>`,
    )
    .join('');
  const bonus = it.bonuses
    .map(
      (x) => `<div style="color:${r.color}">${fmtStat(x.stat, x.value)} <small>(${L('bônus', 'bonus')})</small></div>`,
    )
    .join('');
  const max = maxDurability(it),
    broken = isBroken(it);
  const dur = broken
    ? `<div style="color:${RED}">${L(`Durabilidade 0/${max}. Quebrado — sem efeito`, `Durability 0/${max}. Broken — no effect`)}</div>`
    : `<div>${L('Durabilidade', 'Durability')} ${Math.round(it.durability)}/${max}</div>`;
  return `<b style="color:${itemColor(it)}">${itemName(it)}</b>
    <div><small style="color:${r.color}">${r.name}</small> <small>· ${SLOT_NAMES[b.slot]}</small></div>
    <div style="color:${lvlBad ? RED : 'inherit'}">${L(`Requer nível ${b.reqLevel}`, `Requires level ${b.reqLevel}`)}</div>
    ${b.sect ? `<div style="color:${sectBad ? RED : 'inherit'}">${L('Seita', 'Sect')}: ${CLASSES[b.sect]?.name ?? b.sect}</div>` : ''}
    ${lines}${bonus}${dur}<div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro`, `Sell: ${sellValue(it)} gold`)}</div>${compare ? compareHtml(w, it) : ''}`;
}

// marco 6: ícone desenhado de cada item (tools/sprites/icons.py); emoji só se faltar o ícone
export const SLOT_ICON: Record<Slot, string> = {
  colar: '📿',
  tronco: '👘',
  arma: '⚔️',
  cabeca: '⛑️',
  calca: '👖',
  bota: '👢',
};
export function cellHtml(it: ItemInstance | null): string {
  if (!it) return '';
  const b = BASES[it.baseId],
    pot = POTIONS[it.baseId],
    stack = !b;
  const label = iconHtml(
    it.baseId,
    pot ? (pot.kind === 'hp' ? 'HP' : 'MP') : b ? SLOT_ICON[b.slot] : CONSUMABLES[it.baseId] ? '📜' : '💎',
  );
  const col = itemColor(it);
  let extra = it.plus ? `<i class="plus">+${it.plus}</i>` : '';
  if (stack) extra = `<i class="qty">${it.qty ?? 1}</i>`;
  else {
    const max = maxDurability(it),
      f = Math.max(0, Math.min(1, it.durability / max));
    extra += `<i class="dur ${f <= 0 ? 'zero' : f <= 0.2 ? 'low' : ''}"><u style="width:${f * 100}%"></u></i>`;
  }
  return `<span class="ic${hasIcon(it.baseId) ? ' img' : pot ? '' : ' sym'}" style="--rc:${col}">${label}</span>${extra}`;
}
export const cellStyle = (it: ItemInstance | null) => (it ? `border-color:${itemColor(it)}` : '');
