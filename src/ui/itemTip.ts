import { L } from '../core/i18n';
import { CLASSES } from '../core/data';
import { BASES, POTIONS, RARITIES, SLOT_NAMES, baseOf, fmtStat, fmtStatValue, isBroken, itemColor, itemName, itemStats, maxDurability, sellValue, STAT_LABELS } from '../core/items';
import type { ItemInstance, Slot } from '../core/types';
import type { World } from '../core/world';

const GREEN = '#6fdc6f', RED = '#ff6b6b';

const effStats = (it: ItemInstance | null) => (it && !isBroken(it) ? itemStats(it) : {});

export function compareHtml(w: World, it: ItemInstance): string {
  const b = baseOf(it);
  if (!b) return '';
  const cur = w.equipment[b.slot];
  if (cur === it) return '';
  const a = effStats(it), c = effStats(cur), keys = new Set([...Object.keys(a), ...Object.keys(c)]);
  const rows: string[] = [];
  for (const k of keys) {
    const d = (a[k] ?? 0) - (c[k] ?? 0);
    if (Math.abs(d) < 1e-9) continue;
    rows.push(`<div style="color:${d > 0 ? GREEN : RED}">${d > 0 ? '+' : '−'}${fmtStatValue(k, Math.abs(d))} ${STAT_LABELS[k] ?? k}</div>`);
  }
  const head = cur ? L(`Em comparação ao equipado (${itemName(cur)}):`, `Compared to equipped (${itemName(cur)}):`) : L('Slot vazio, ao equipar:', 'Empty slot, if equipped:');
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
  const b = BASES[it.baseId];
  if (!b) return `<b>${it.baseId}</b>`;
  const r = RARITIES[it.rarity], lvlBad = w.player.level < b.reqLevel, sectBad = !!b.sect && b.sect !== w.classId;
  const lines = Object.entries(b.stats).map(([k, v]) => `<div>${fmtStat(k, v)}</div>`).join('');
  const bonus = it.bonuses.map((x) => `<div style="color:${r.color}">${fmtStat(x.stat, x.value)} <small>(${L('bônus', 'bonus')})</small></div>`).join('');
  const max = maxDurability(it), broken = isBroken(it);
  const dur = broken ? `<div style="color:${RED}">${L(`Durabilidade 0/${max}. Quebrado — sem efeito`, `Durability 0/${max}. Broken — no effect`)}</div>` : `<div>${L('Durabilidade', 'Durability')} ${Math.round(it.durability)}/${max}</div>`;
  return `<b style="color:${itemColor(it)}">${b.name}</b>
    <div><small style="color:${r.color}">${r.name}</small> <small>· ${SLOT_NAMES[b.slot]}</small></div>
    <div style="color:${lvlBad ? RED : 'inherit'}">${L(`Requer nível ${b.reqLevel}`, `Requires level ${b.reqLevel}`)}</div>
    ${b.sect ? `<div style="color:${sectBad ? RED : 'inherit'}">${L('Seita', 'Sect')}: ${CLASSES[b.sect]?.name ?? b.sect}</div>` : ''}
    ${lines}${bonus}${dur}<div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro`, `Sell: ${sellValue(it)} gold`)}</div>${compare ? compareHtml(w, it) : ''}`;
}

export const SLOT_ABBR: Record<Slot, string> = { colar: L('Co', 'Ne'), tronco: L('Tr', 'Ch'), arma: L('Ar', 'We'), cabeca: L('Ca', 'He'), calca: L('Cl', 'Le'), bota: 'Bo' };
export function cellHtml(it: ItemInstance | null): string {
  if (!it) return '';
  const b = BASES[it.baseId], pot = POTIONS[it.baseId];
  const label = pot ? (pot.kind === 'hp' ? 'HP' : 'MP') : SLOT_ABBR[b.slot];
  const col = itemColor(it);
  let extra = '';
  if (pot) extra = `<i class="qty">${it.qty ?? 1}</i>`;
  else {
    const max = maxDurability(it), f = Math.max(0, Math.min(1, it.durability / max));
    extra = `<i class="dur ${f <= 0 ? 'zero' : f <= 0.2 ? 'low' : ''}"><u style="width:${f * 100}%"></u></i>`;
  }
  return `<span class="ic" style="--rc:${col}">${label}</span>${extra}`;
}
export const cellStyle = (it: ItemInstance | null) => (it ? `border-color:${itemColor(it)}` : '');
