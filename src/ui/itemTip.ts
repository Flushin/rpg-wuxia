import { L } from '../core/i18n';
import { CLASSES } from '../core/data';
import {
  BASES,
  CONSUMABLES,
  GEMS,
  GEM_CFG,
  MATERIALS,
  POTIONS,
  RARITIES,
  SLOT_NAMES,
  baseOf,
  epicBonuses,
  epicIconId,
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
import type { ItemOwner } from '../core/items';
import type { World } from '../core/world';
import { hasIcon, iconHtml } from './icons';

/** Ícone da gema: losango na cor do tipo com o nível em romano; null = encaixe vazio (losango vazado). */
export function gemIconHtml(id: string | null): string {
  const g = id ? GEMS[id] : undefined;
  return g
    ? `<span class="gem" style="--gc:${g.color}"><b>${GEM_CFG.levelNames[g.level - 1]}</b></span>`
    : '<span class="gem gem-empty"></span>';
}
/** Linhas dos encaixes na janela do item (vazio ou a gema com seus stats). */
export function socketsTipHtml(it: ItemInstance): string {
  if (!it.gems?.length) return '';
  return it.gems
    .map((id) => {
      const g = id ? GEMS[id] : undefined;
      const st = g
        ? Object.entries(g.stats)
            .map(([k, v]) => fmtStat(k, v))
            .join(', ')
        : '';
      return `<div class="tip-gem">${gemIconHtml(id)} ${g ? `<span style="color:${g.color}">${g.name}</span> <small>${st}</small>` : `<small>${L('Encaixe vazio', 'Empty socket')}</small>`}</div>`;
    })
    .join('');
}

const GREEN = '#6fdc6f',
  RED = '#ff6b6b';

const effStats = (w: World, it: ItemInstance | null) => (it && !isBroken(it) ? itemStats(it, w.owner()) : {});

/** Melhor que o equipado no mesmo slot: pode equipar, nada piora e algo melhora (o ▲ e o filtro "Melhores" da mochila). */
export function isUpgrade(w: World, it: ItemInstance): boolean {
  const b = baseOf(it);
  if (!b || w.canEquip(it)) return false;
  const cur = w.equipment[b.slot];
  if (cur === it) return false;
  const a = effStats(w, it),
    c = effStats(w, cur);
  let up = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(c)])) {
    const d = (a[k] ?? 0) - (c[k] ?? 0);
    if (d < -1e-9) return false;
    if (d > 1e-9) up = true;
  }
  return up;
}

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
  const gem = GEMS[it.baseId];
  if (gem) {
    const st = Object.entries(gem.stats)
      .map(([k, v]) => `<div>${fmtStat(k, v)}</div>`)
      .join('');
    return `<b style="color:${gem.color}">${gemIconHtml(it.baseId)} ${gem.name}</b>${st}
      <small>${L('Gema: encaixe num equipamento com o Ferreiro-mestre. 3 iguais viram 1 do nível seguinte no Joalheiro.', 'Gem: set it into gear at the Master Smith. 3 alike become 1 of the next level at the Jeweler.')}</small>
      <div>${L('Quantidade', 'Quantity')}: ${it.qty ?? 1}</div><div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro (cada)`, `Sell: ${sellValue(it)} gold (each)`)}</div>`;
  }
  const st = MATERIALS[it.baseId] ?? CONSUMABLES[it.baseId];
  if (st) {
    return `<b style="color:${st.color}">${st.name}</b><div>${st.desc}</div>
      <div>${L('Quantidade', 'Quantity')}: ${it.qty ?? 1}</div><div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro (cada)`, `Sell: ${sellValue(it)} gold (each)`)}</div>`;
  }
  const b = BASES[it.baseId];
  if (!b) return `<b>${it.baseId}</b>`;
  if (it.rarity === 'epico') return epicTipHtml(w, it, compare);
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
    ${lines}${bonus}${socketsTipHtml(it)}${dur}<div class="tip-sell">${L(`Venda: ${sellValue(it)} ouro`, `Sell: ${sellValue(it)} gold`)}</div>${compare ? compareHtml(w, it) : ''}`;
}

/** Janela do Épico: sem nível próprio (stats da peça da faixa do personagem), bônus (da classe ou trocados), não vende. */
function epicTipHtml(w: World, it: ItemInstance, compare: boolean): string {
  const b = BASES[it.baseId],
    r = RARITIES.epico,
    o = w.owner(),
    sectBad = !!b.sect && b.sect !== w.classId;
  const lines = Object.entries(itemStats(it, o, false))
    .map(
      ([k, v]) => `<div>${fmtStat(k, v)}${it.plus ? ` <small style="color:${GREEN}">(+${it.plus})</small>` : ''}</div>`,
    )
    .join('');
  const custom = it.bonuses.length > 0;
  const bonus = epicBonuses(o, it)
    .map(
      (x) =>
        `<div style="color:${r.color}">${fmtStat(x.stat, x.value)} <small>(${custom ? L('bônus', 'bonus') : L('bônus da classe', 'class bonus')})</small></div>`,
    )
    .join('');
  const max = maxDurability(it),
    dur = isBroken(it)
      ? `<div style="color:${RED}">${L(`Durabilidade 0/${max}. Quebrado — sem efeito`, `Durability 0/${max}. Broken — no effect`)}</div>`
      : `<div>${L('Durabilidade', 'Durability')} ${Math.round(it.durability)}/${max}</div>`;
  return `<b style="color:${r.color}">${itemName(it)}</b>
    <div><small style="color:${r.color}">${r.name}</small> <small>· ${SLOT_NAMES[b.slot]}</small></div>
    <div>${L(`Acompanha seu nível (nv ${o.level})`, `Scales with your level (lv ${o.level})`)}</div>
    ${b.sect ? `<div style="color:${sectBad ? RED : 'inherit'}">${L('Seita', 'Sect')}: ${CLASSES[b.sect]?.name ?? b.sect}</div>` : ''}
    ${lines}${bonus}${socketsTipHtml(it)}${dur}<div class="tip-sell">${L('Não pode ser vendido', 'Cannot be sold')}</div>${compare ? compareHtml(w, it) : ''}`;
}
/** Ícone do item; o Épico tem o seu próprio, fixo (não segue a peça da faixa). */
const iconId = (it: ItemInstance) => (it.rarity === 'epico' ? epicIconId(it) : it.baseId);

// marco 6: ícone desenhado de cada item (tools/sprites/icons.py); emoji só se faltar o ícone
export const SLOT_ICON: Record<Slot, string> = {
  colar: '📿',
  tronco: '👘',
  arma: '⚔️',
  cabeca: '⛑️',
  calca: '👖',
  bota: '👢',
};
export function cellHtml(it: ItemInstance | null, owner?: ItemOwner): string {
  if (!it) return '';
  const b = BASES[it.baseId],
    pot = POTIONS[it.baseId],
    stack = !b,
    ico = iconId(it);
  const label = GEMS[it.baseId]
    ? gemIconHtml(it.baseId)
    : iconHtml(
        ico,
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
  return `<span class="ic${hasIcon(ico) ? ' img' : pot ? '' : ' sym'}" style="--rc:${col}">${label}</span>${extra}`;
}
/** Borda na cor da raridade; o Épico ganha um brilho roxo. */
export const cellStyle = (it: ItemInstance | null) =>
  it ? `border-color:${itemColor(it)}${it.rarity === 'epico' ? `;box-shadow:0 0 6px ${itemColor(it)}` : ''}` : '';
