import { actionErrorText } from './actionError';
import type { ActionError } from '../core/types';
import { L } from '../core/i18n';
import { BAG_TAB_SIZE, BASES, type BagTab, CONSUMABLES, MATERIALS, POTIONS, bagTabOf } from '../core/items';
import type { ItemInstance, Slot } from '../core/types';
import type { World } from '../core/world';
import { closeX } from './labels';
import { cellHtml, cellStyle, isUpgrade, itemTipHtml } from './itemTip';
import { uiH, uiRect, uiW } from './uiScale';
import { renderPanel } from './panelRender';
import { byId } from './dom';
import { isTouch } from '../platform/input';

type Sel = { kind: 'bag'; i: number };
const selKey = (s: Sel | null) => (s ? `b${s.i}` : '');
type Tab = BagTab;
/** filtro da aba Equipamento: tudo, só os melhores que o equipado (▲) ou Incomum para cima */
type Filter = 'all' | 'up' | 'rare';
const tabOf = (it: ItemInstance): Tab => bagTabOf(it.baseId);
const usable = (it: ItemInstance) => !!POTIONS[it.baseId] || !!CONSUMABLES[it.baseId];
/** Dica do item ao passar o mouse sobre células [data-bag]/[data-eq] (mochila e Personagem). */
export function bindItemTip(world: World, el: HTMLElement, itemOf: (c: HTMLElement) => ItemInstance | null) {
  const tip = byId('item-tip');
  el.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = (e.target as HTMLElement).closest('[data-bag],[data-eq]') as HTMLElement | null;
    const it = c ? itemOf(c) : null;
    if (!c || !it) {
      tip.classList.add('hidden');
      return;
    }
    if (c.dataset.bag !== undefined && world.newItems.delete(it.uid)) c.querySelector('.new-dot')?.remove();
    tip.innerHTML = itemTipHtml(world, it);
    tip.classList.remove('hidden');
    const r = uiRect(c),
      w = 230;
    tip.style.left = `${Math.max(6, Math.min(uiW() - w - 6, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = '0px';
    const h = tip.offsetHeight;
    tip.style.top = `${r.top - h - 8 >= 6 ? r.top - h - 8 : Math.min(uiH() - h - 6, r.bottom + 8)}px`;
  });
  el.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse') tip.classList.add('hidden');
  });
}

// Painel de mochila (tecla I): 30 espaços por aba, ouro, detalhes e ações. Os equipados ficam no Personagem (C).
export class InventoryPanel {
  private sig = '';
  private busyUntil = 0; // jogador rolando/tocando a mochila
  private sel: Sel | null = null;
  private last = { key: '', t: 0 };
  private tab: Tab = 'equip';
  private filter: Filter = 'all';
  private confirmDel = ''; // item marcado para destruir (pede segundo toque)
  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
    private onClose: () => void,
  ) {
    const el = byId('inv-panel');
    el.addEventListener('click', (e) => this.click(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    const busy = (ms: number) => () => {
      this.busyUntil = Math.max(this.busyUntil, performance.now() + ms);
    };
    el.addEventListener('touchstart', busy(10000), { passive: true }); // dedo na tela: até soltar
    el.addEventListener('touchmove', busy(10000), { passive: true });
    el.addEventListener(
      'touchend',
      () => {
        this.busyUntil = performance.now() + 700;
      },
      { passive: true },
    ); // rolagem com embalo
    el.addEventListener(
      'touchcancel',
      () => {
        this.busyUntil = performance.now() + 700;
      },
      { passive: true },
    );
    el.addEventListener('scroll', busy(400), { capture: true, passive: true });
    bindItemTip(world, el, (c) => this.itemOf(c));
  }

  get open() {
    return !byId('inv-panel').classList.contains('hidden');
  }
  set(open: boolean) {
    byId('inv-panel').classList.toggle('hidden', !open);
    byId('item-tip').classList.add('hidden');
    this.sig = '';
    if (!open) this.sel = null;
  }

  private itemOf(c: HTMLElement): ItemInstance | null {
    if (c.dataset.bag !== undefined) return this.world.bag[+c.dataset.bag];
    return this.world.equipment[c.dataset.eq as Slot];
  }
  private selItem(): ItemInstance | null {
    const s = this.sel;
    return s ? this.world.bag[s.i] : null;
  }

  private click(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const act = t.closest('[data-act]') as HTMLElement | null;
    if (act) {
      this.act(act.dataset.act!);
      return;
    }
    if (t === byId('inv-panel')) {
      this.onClose();
      return;
    }
    const c = t.closest('[data-bag]') as HTMLElement | null;
    if (!c) return;
    const sel: Sel = { kind: 'bag', i: +c.dataset.bag! };
    const key = selKey(sel),
      now = performance.now();
    const dbl = key === this.last.key && now - this.last.t < 400;
    this.last = { key, t: now };
    if (key !== this.confirmDel) this.confirmDel = '';
    this.sel = sel;
    const picked = this.world.bag[sel.i];
    if (picked) this.world.newItems.delete(picked.uid);
    this.sig = '';
    byId('item-tip').classList.add('hidden');
    if (dbl && this.selItem()) this.act(usable(this.selItem()!) ? 'use' : 'equip');
  }

  private act(a: string) {
    const w = this.world,
      s = this.sel;
    this.sig = '';
    if (a === 'close') {
      this.onClose();
      return;
    }
    if (a === 'sort') {
      w.sortBag();
      this.sel = null;
      return;
    }
    if (a === 'f-all' || a === 'f-up' || a === 'f-rare') {
      this.filter = a.slice(2) as Filter;
      this.sel = null;
      return;
    }
    if (a === 'tab-equip' || a === 'tab-pot' || a === 'tab-mat') {
      this.tab = a.slice(4) as Tab;
      this.sel = null;
      return;
    }
    if (a !== 'destroy' && a !== 'destroy-ok') this.confirmDel = '';
    if (!s) return;
    if (a === 'lock') {
      w.toggleLock(s.i);
      return;
    }
    if (a === 'destroy') {
      this.confirmDel = selKey(s);
      return;
    }
    if (a === 'destroy-ok') {
      if (this.confirmDel === selKey(s) && w.destroyItem(s.i)) this.sel = null;
      this.confirmDel = '';
      return;
    }
    let err: ActionError | null = null;
    if (a === 'equip') {
      const it = w.bag[s.i];
      if (!it) return;
      const slot = BASES[it.baseId]?.slot;
      err = w.equip(s.i);
      if (!err && slot) this.sel = null;
    } else if (a === 'use') {
      const it = w.bag[s.i],
        d = it && POTIONS[it.baseId];
      if (it && d) w.usePotion(d.kind, it.baseId);
      else if (it?.baseId === 'pergaminho_retorno') {
        if (w.useReturnScroll(s.i)) this.onClose();
        else this.toast(L('Você já está na vila', 'You are already in the village'), '#ff8a80');
      }
    }
    if (err) this.toast(actionErrorText(err), '#ff8a80');
  }

  update() {
    if (!this.open) return;
    const w = this.world;
    const sig = `${w.invVersion}|${selKey(this.sel)}|${w.player.level}|${this.tab}|${this.filter}|${this.confirmDel}`;
    if (sig === this.sig) return;
    // mudança vinda do jogo (auto pegando item, poção gasta…) enquanto o jogador rola a mochila: espera ele parar,
    // senão a lista é refeita no meio da rolagem. Ações do próprio jogador (sig vazio) redesenham na hora.
    if (this.sig !== '' && performance.now() < this.busyUntil) return;
    this.sig = sig;
    if (this.sel && !this.selItem()) this.sel = null;
    const ups = new Set(w.bag.filter((x): x is ItemInstance => !!x && isUpgrade(w, x)).map((x) => x.uid));
    const marks = (x: ItemInstance | null) =>
      !x
        ? ''
        : `${x.locked ? '<i class="lock-mark">🔒</i>' : ''}${ups.has(x.uid) ? '<i class="up-mark">▲</i>' : ''}${w.newItems.has(x.uid) ? '<i class="new-dot"></i>' : ''}`;
    const bagCell = (i: number) =>
      `<button class="cell ${this.sel && selKey(this.sel) === `b${i}` ? 'sel' : ''}" data-bag="${i}" style="${cellStyle(w.bag[i])}">${cellHtml(w.bag[i], w.owner())}${marks(w.bag[i])}</button>`;
    const idx = w.bag.map((_, i) => i);
    const equipTab = this.tab === 'equip';
    const pass = (x: ItemInstance) =>
      !equipTab ||
      this.filter === 'all' ||
      (this.filter === 'up' ? ups.has(x.uid) : x.rarity === 'incomum' || x.rarity === 'raro' || x.rarity === 'epico');
    const inTab = idx.filter((i) => w.bag[i] && tabOf(w.bag[i]!) === this.tab && pass(w.bag[i]!)),
      free = equipTab && this.filter !== 'all' ? [] : idx.filter((i) => !w.bag[i]).slice(0, w.freeSlots(this.tab));
    const bag = [...inTab, ...free].map(bagCell).join('');
    const fBtn = (f: Filter, label: string) =>
      `<button class="${this.filter === f ? 'on' : ''}" data-act="f-${f}">${label}</button>`;
    const filters = equipTab
      ? `<div class="inv-filters">${fBtn('all', L('Tudo', 'All'))}${fBtn('up', L(`▲ Melhores (${ups.size})`, `▲ Upgrades (${ups.size})`))}${fBtn('rare', L('Incomum+', 'Uncommon+'))}</div>`
      : '';
    const count = (t: Tab) => w.bag.filter((x) => x && tabOf(x) === t).length;
    const tabBtn = (t: Tab, label: string) =>
      `<button class="inv-tab ${this.tab === t ? 'on' : ''}" data-act="tab-${t}" role="tab" aria-selected="${this.tab === t}">${label} <small>${count(t)}</small></button>`;
    const tabs = `<div class="inv-tabs" role="tablist">${tabBtn('equip', L('Equipamento', 'Equipment'))}${tabBtn('pot', L('Consumíveis', 'Consumables'))}${tabBtn('mat', L('Materiais', 'Materials'))}</div>`;
    const it = this.selItem(),
      s = this.sel;
    let detail = `<div class="muted">${isTouch ? L('Toque em um item para ver os detalhes. Duplo toque equipa ou usa.', 'Tap an item to see details. Double tap equips or uses.') : L('Clique em um item para ver os detalhes. Duplo clique equipa ou usa.', 'Click an item to see details. Double-click equips or uses.')}</div>`;
    if (it && s) {
      let btn = '';
      if (usable(it)) btn = `<button class="primary" data-act="use">${L('Usar', 'Use')}</button>`;
      else if (MATERIALS[it.baseId]) btn = '';
      else {
        const err = w.canEquip(it);
        btn = `<button class="primary" data-act="equip" ${err ? 'disabled' : ''}>${L('Equipar', 'Equip')}</button>${err ? `<small class="muted">${actionErrorText(err)}</small>` : ''}`;
      }
      const del =
        this.confirmDel === selKey(s)
          ? `<button class="danger" data-act="destroy-ok">${L('Confirmar: destruir', 'Confirm: destroy')}</button><button data-act="cancel">${L('Cancelar', 'Cancel')}</button>`
          : `<button class="danger" data-act="destroy">${L('Destruir', 'Destroy')}</button>`;
      const stack = !BASES[it.baseId];
      const lock = stack
        ? ''
        : `<button data-act="lock" aria-pressed="${!!it.locked}">${it.locked ? L('🔓 Destrancar', '🔓 Unlock') : L('🔒 Trancar', '🔒 Lock')}</button>`;
      // trancado: sem Destruir (nem venda/desmonte no vendedor e ferreiro, nem venda do Auto)
      detail = `<div class="tipbody">${itemTipHtml(w, it, true)}</div>${btn}${lock}${it.locked ? `<small class="muted">${L('Trancado: não pode ser vendido, destruído nem desmontado.', 'Locked: cannot be sold, destroyed or salvaged.')}</small>` : del}`;
    }
    // renderPanel mantém a moldura (.inv-card, que é quem rola; em telas largas rolam .inv-main e .inv-detail) e só troca
    // o que mudou, então a rolagem nunca é perdida (nem cortada no meio, no iPhone).
    renderPanel(
      byId('inv-panel'),
      `<div class="card inv-card"><div class="inv-main">${closeX('data-act="close"')}
      <h2>${L('Mochila', 'Bag')} <span class="gold">${w.gold} ${L('ouro', 'gold')}</span></h2>
      <h3>${L('Bolsa', 'Inventory')} (${count(this.tab)}/${BAG_TAB_SIZE}) <button class="sort-btn" data-act="sort">${L('Organizar', 'Sort')}</button></h3>${tabs}${filters}<div class="bag-grid">${bag}</div>
      <button class="close-btn" data-act="close">${L('Fechar', 'Close')}</button></div><div class="inv-detail">${detail}</div></div>`,
    );
  }
}
