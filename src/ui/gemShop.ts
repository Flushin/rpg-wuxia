// Janelas do Joalheiro (comprar e fundir gemas) e do Ferreiro-mestre (abrir encaixes, colocar e retirar gemas).
// Porto Noturno, etapa 2; regras em docs/decisoes/gemas.md. Desenhadas dentro da janela do NPC (npcWindow.ts).
import { L } from '../core/i18n';
import {
  BASES,
  GEMS,
  GEM_CFG,
  GEM_MAX_LEVEL,
  MATERIALS,
  SLOTS,
  fmtStat,
  gemId,
  itemColor,
  itemName,
  maxSockets,
} from '../core/items';
import type { ActionError, ItemInstance } from '../core/types';
import type { World } from '../core/world';
import { matCount } from '../core/world/forge';
import { fuseCost, jewelerGoods, removeCost, socketCost } from '../core/world/gems';
import { escapeHtml } from './dom';
import { cellHtml, cellStyle, gemIconHtml, itemTipHtml } from './itemTip';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const goldTxt = (w: World, n: number) =>
  `<span style="color:${w.gold >= n ? 'inherit' : '#ff8a80'}">${fmt(n)} ${L('ouro', 'gold')}</span>`;
const gemStatsTxt = (id: string) =>
  Object.entries(GEMS[id].stats)
    .map(([k, v]) => fmtStat(k, v))
    .join(', ');

/** Joalheiro: gemas de nível I e Pó de Estrela à venda; abaixo, as gemas da mochila que dá para fundir. */
export function jewelerHtml(w: World): string {
  const buy = jewelerGoods()
    .map(({ id, price }) => {
      const g = GEMS[id],
        m = MATERIALS[id];
      const name = g ? g.name : (m?.name ?? id),
        info = g ? gemStatsTxt(id) : (m?.desc ?? '');
      return `<div class="srow"><div class="si">${g ? gemIconHtml(id) : ''}<b style="color:${(g ?? m)?.color}">${escapeHtml(name)}</b>
        <small>${escapeHtml(info)}</small><small>${goldTxt(w, price)} · ${L('na mochila', 'in bag')}: ${matCount(w, id)}</small></div>
        <button data-a="gembuy" data-v="${id}" ${w.gold >= price ? '' : 'disabled'}>${L('Comprar', 'Buy')}</button></div>`;
    })
    .join('');
  const fuse = Object.keys(GEMS)
    .filter((id) => matCount(w, id) > 0)
    .map((id) => {
      const g = GEMS[id],
        n = matCount(w, id);
      if (g.level >= GEM_MAX_LEVEL)
        return `<div class="srow"><div class="si">${gemIconHtml(id)}<b style="color:${g.color}">${escapeHtml(g.name)}</b> ×${n}<small class="muted">${L('Nível máximo', 'Max level')}</small></div></div>`;
      const out = GEMS[gemId(g.type, g.level + 1)],
        cost = fuseCost(id),
        can = n >= GEM_CFG.fuse && w.gold >= cost;
      return `<div class="srow"><div class="si">${gemIconHtml(id)}<b style="color:${g.color}">${escapeHtml(g.name)}</b> ×${n}
        <small>${GEM_CFG.fuse} → 1 ${escapeHtml(out.name)} (${gemStatsTxt(out ? gemId(g.type, g.level + 1) : id)}) · ${goldTxt(w, cost)}</small></div>
        <button data-a="gemfuse" data-v="${id}" ${can ? '' : 'disabled'}>${L('Fundir', 'Fuse')}</button></div>`;
    })
    .join('');
  return `<h4>${L('Gemas à venda', 'Gems for sale')}</h4>${buy}
    <h4>${L('Fundir gemas', 'Fuse gems')}</h4>
    <small class="muted">${L(`${GEM_CFG.fuse} gemas iguais viram 1 do nível seguinte (até ${GEM_CFG.levelNames[GEM_MAX_LEVEL - 1]}).`, `${GEM_CFG.fuse} identical gems become 1 of the next level (up to ${GEM_CFG.levelNames[GEM_MAX_LEVEL - 1]}).`)}</small>
    ${fuse || `<p class="muted">${L('Você não tem gemas.', 'You have no gems.')}</p>`}`;
}

/** Item escolhido no Ferreiro-mestre pelo uid (equipado ou na mochila). */
export function findGear(w: World, uid: string): ItemInstance | null {
  const all = [...SLOTS.map((s) => w.equipment[s]), ...w.bag];
  return all.find((it) => it && it.uid === uid && BASES[it.baseId]) ?? null;
}

/** Ferreiro-mestre: lista de equipamentos à esquerda; à direita os encaixes do escolhido. */
export function masterSmithHtml(w: World, sel: string): { list: string; side: string } {
  const chips: string[] = [];
  const chip = (it: ItemInstance, eq: boolean) => {
    const n = maxSockets(it),
      sockets = (it.gems ?? []).map(gemIconHtml).join('');
    chips.push(
      `<button class="fchip ${sel === it.uid ? 'on' : ''}" data-a="gemsel" data-v="${it.uid}" style="border-color:${itemColor(it)}"><span class="cell mini" style="${cellStyle(it)}">${cellHtml(it, w.owner())}</span><span><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b><small>${eq ? L('equipado', 'equipped') + ' · ' : ''}${L(`encaixes ${it.gems?.length ?? 0}/${n}`, `sockets ${it.gems?.length ?? 0}/${n}`)}</small><span class="gem-row">${sockets}</span></span></button>`,
    );
  };
  for (const s of SLOTS) {
    const it = w.equipment[s];
    if (it) chip(it, true);
  }
  for (const it of w.bag) if (it && BASES[it.baseId]) chip(it, false);
  const list = chips.length
    ? chips.join('')
    : `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>`;
  const it = findGear(w, sel);
  if (!it) return { list, side: `<p class="muted">${L('Escolha um item.', 'Choose an item.')}</p>` };
  const max = maxSockets(it),
    gems = it.gems ?? [];
  const owned = Object.keys(GEMS).filter((id) => matCount(w, id) > 0);
  const rows = gems
    .map((id, i) => {
      if (id)
        return `<div class="srow"><div class="si">${gemIconHtml(id)}<b style="color:${GEMS[id].color}">${escapeHtml(GEMS[id].name)}</b><small>${gemStatsTxt(id)}</small>
          <small>${L('Retirar', 'Remove')}: ${goldTxt(w, removeCost(id))} (${L('a gema volta para a mochila', 'the gem returns to your bag')})</small></div>
          <button data-a="gemtake" data-v="${i}" ${w.gold >= removeCost(id) ? '' : 'disabled'}>${L('Retirar', 'Remove')}</button></div>`;
      const pick = owned.length
        ? owned
            .map(
              (g) =>
                `<button class="gem-pick" data-a="gemput" data-v="${g}|${i}" title="${escapeHtml(GEMS[g].name)}: ${gemStatsTxt(g)}">${gemIconHtml(g)}<small>×${matCount(w, g)}</small></button>`,
            )
            .join('')
        : `<small class="muted">${L('Sem gemas na mochila (compre no Joalheiro).', 'No gems in your bag (buy from the Jeweler).')}</small>`;
      return `<div class="srow gem-slot"><div class="si">${gemIconHtml(null)}<b>${L(`Encaixe ${i + 1} vazio`, `Empty socket ${i + 1}`)}</b><div class="gem-picks">${pick}</div></div></div>`;
    })
    .join('');
  const cost = socketCost(it);
  let open: string;
  if (!max) open = `<small class="muted">${L('Este item não aceita encaixes.', 'This item takes no sockets.')}</small>`;
  else if (!cost)
    open = `<small class="muted">${L(`Todos os ${max} encaixes da raridade abertos.`, `All ${max} sockets for this rarity open.`)}</small>`;
  else {
    const mats = Object.entries(cost.mats)
      .map(
        ([id, n]) =>
          `<span style="color:${matCount(w, id) >= n ? MATERIALS[id]?.color : '#ff8a80'}">${n}× ${escapeHtml(MATERIALS[id]?.name ?? id)} (${matCount(w, id)})</span>`,
      )
      .join(' · ');
    const can = w.gold >= cost.gold && Object.entries(cost.mats).every(([id, n]) => matCount(w, id) >= n);
    open = `<div class="srow"><div class="si"><b>${L(`Abrir encaixe ${gems.length + 1} de ${max}`, `Open socket ${gems.length + 1} of ${max}`)}</b>
      <small>${mats ? mats + ' · ' : ''}${goldTxt(w, cost.gold)}</small></div>
      <button data-a="gemopen" ${can ? '' : 'disabled'}>${L('Abrir', 'Open')}</button></div>`;
  }
  return {
    list,
    side: `${open}${rows}<div class="tipbody ftip">${itemTipHtml(w, it, false)}</div>`,
  };
}

/** Cliques das duas lojas; devolve o erro da ação (ou null). `sel` = uid do item escolhido no Ferreiro-mestre. */
export function gemClick(w: World, a: string, v: string, sel: string): ActionError | null {
  const it = findGear(w, sel);
  if (a === 'gembuy') return w.buyGem(v, 1);
  if (a === 'gemfuse') return w.fuseGem(v);
  if (!it) return null;
  if (a === 'gemopen') return w.openSocket(it);
  if (a === 'gemput') {
    const [id, slot] = v.split('|');
    return w.insertGem(it, id, +slot);
  }
  if (a === 'gemtake') return w.removeGem(it, +v);
  return null;
}
