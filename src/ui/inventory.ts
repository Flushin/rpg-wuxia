import { L } from '../core/i18n';
import { BASES, POTIONS, SLOTS, SLOT_NAMES } from '../core/items';
import type { ItemInstance, Slot } from '../core/types';
import type { World } from '../core/world';
import { cellHtml, cellStyle, itemTipHtml } from './itemTip';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
type Sel = { kind: 'bag'; i: number } | { kind: 'eq'; slot: Slot };
const selKey = (s: Sel | null) => (s ? (s.kind === 'bag' ? `b${s.i}` : `e${s.slot}`) : '');

// Painel de mochila (tecla I): 6 slots de equipamento, 30 espaços, ouro, detalhes e ações.
export class InventoryPanel {
  private sig = '';
  private sel: Sel | null = null;
  private last = { key: '', t: 0 };
  constructor(private world: World, private toast: (m: string, c?: string) => void, private onClose: () => void) {
    const el = $('inv-panel'), tip = $('item-tip');
    el.addEventListener('click', (e) => this.click(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const c = (e.target as HTMLElement).closest('[data-bag],[data-eq]') as HTMLElement | null;
      const it = c ? this.itemOf(c) : null;
      if (!c || !it) { tip.classList.add('hidden'); return; }
      tip.innerHTML = itemTipHtml(this.world, it); tip.classList.remove('hidden');
      const r = c.getBoundingClientRect(), w = 230;
      tip.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = '0px';
      const h = tip.offsetHeight;
      tip.style.top = `${r.top - h - 8 >= 6 ? r.top - h - 8 : Math.min(window.innerHeight - h - 6, r.bottom + 8)}px`;
    });
    el.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse') tip.classList.add('hidden'); });
  }

  get open() { return !$('inv-panel').classList.contains('hidden'); }
  set(open: boolean) {
    $('inv-panel').classList.toggle('hidden', !open); $('item-tip').classList.add('hidden');
    this.sig = ''; if (!open) this.sel = null;
  }

  private itemOf(c: HTMLElement): ItemInstance | null {
    return c.dataset.bag !== undefined ? this.world.bag[+c.dataset.bag] : this.world.equipment[c.dataset.eq as Slot];
  }
  private selItem(): ItemInstance | null {
    const s = this.sel;
    return !s ? null : s.kind === 'bag' ? this.world.bag[s.i] : this.world.equipment[s.slot];
  }

  private click(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const act = t.closest('[data-act]') as HTMLElement | null;
    if (act) { this.act(act.dataset.act!); return; }
    if (t === $('inv-panel')) { this.onClose(); return; }
    const c = t.closest('[data-bag],[data-eq]') as HTMLElement | null;
    if (!c) return;
    const sel: Sel = c.dataset.bag !== undefined ? { kind: 'bag', i: +c.dataset.bag } : { kind: 'eq', slot: c.dataset.eq as Slot };
    const key = selKey(sel), now = performance.now();
    const dbl = key === this.last.key && now - this.last.t < 400;
    this.last = { key, t: now };
    this.sel = sel; this.sig = '';
    $('item-tip').classList.add('hidden');
    if (dbl && this.selItem()) this.act(sel.kind === 'eq' ? 'unequip' : POTIONS[this.selItem()!.baseId] ? 'use' : 'equip');
  }

  private act(a: string) {
    const w = this.world, s = this.sel;
    this.sig = '';
    if (a === 'close') { this.onClose(); return; }
    if (!s) return;
    let err: string | null = null;
    if (a === 'equip' && s.kind === 'bag') {
      const it = w.bag[s.i];
      if (!it) return;
      const slot = BASES[it.baseId]?.slot;
      err = w.equip(s.i);
      if (!err && slot) this.sel = { kind: 'eq', slot };
    } else if (a === 'unequip' && s.kind === 'eq') {
      err = w.unequip(s.slot);
      if (!err) this.sel = null;
    } else if (a === 'use' && s.kind === 'bag') {
      const it = w.bag[s.i], d = it && POTIONS[it.baseId];
      if (it && d) w.usePotion(d.kind, it.baseId);
    }
    if (err) this.toast(err, '#ff8a80');
  }

  update() {
    if (!this.open) return;
    const w = this.world;
    const sig = `${w.invVersion}|${selKey(this.sel)}|${w.player.level}`;
    if (sig === this.sig) return;
    this.sig = sig;
    if (this.sel && !this.selItem()) this.sel = null;
    const eq = SLOTS.map((sl) => {
      const it = w.equipment[sl];
      return `<div class="eqs"><small>${SLOT_NAMES[sl]}</small><button class="cell ${this.sel && selKey(this.sel) === `e${sl}` ? 'sel' : ''}" data-eq="${sl}" style="${cellStyle(it)}" aria-label="${SLOT_NAMES[sl]}">${cellHtml(it)}</button></div>`;
    }).join('');
    const bag = w.bag.map((it, i) => `<button class="cell ${this.sel && selKey(this.sel) === `b${i}` ? 'sel' : ''}" data-bag="${i}" style="${cellStyle(it)}">${cellHtml(it)}</button>`).join('');
    const it = this.selItem(), s = this.sel;
    let detail = `<div class="muted">${L('Toque em um item para ver os detalhes. Duplo toque equipa ou usa.', 'Tap an item to see details. Double tap equips or uses.')}</div>`;
    if (it && s) {
      const pot = POTIONS[it.baseId];
      let btn = '';
      if (s.kind === 'eq') btn = `<button class="primary" data-act="unequip">${L('Desequipar', 'Unequip')}</button>`;
      else if (pot) btn = `<button class="primary" data-act="use">${L('Usar', 'Use')}</button>`;
      else {
        const err = w.canEquip(it);
        btn = `<button class="primary" data-act="equip" ${err ? 'disabled' : ''}>${L('Equipar', 'Equip')}</button>${err ? `<small class="muted">${err}</small>` : ''}`;
      }
      detail = `<div class="tipbody">${itemTipHtml(w, it, s.kind === 'bag')}</div>${btn}`;
    }
    $('inv-panel').innerHTML = `<div class="card inv-card"><div class="inv-main">
      <h2>${L('Mochila', 'Bag')} <span class="gold">${w.gold} ${L('ouro', 'gold')}</span></h2>
      <h3>${L('Equipamento', 'Equipment')}</h3><div class="eq-grid">${eq}</div>
      <h3>${L('Bolsa', 'Inventory')} (${w.bag.filter(Boolean).length}/${w.bag.length})</h3><div class="bag-grid">${bag}</div>
      <button class="close-btn" data-act="close">${L('Fechar', 'Close')}</button></div>
      <div class="inv-detail">${detail}</div></div>`;
  }
}
