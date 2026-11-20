import { actionErrorText } from './actionError';
import type { ActionError } from '../core/types';
import { CLASSES } from '../core/data';
import { PORTRAIT_ANIMS, PORTRAITS } from '../render/sprites';
import { L } from '../core/i18n';
import { BAG_TAB_SIZE, BASES, type BagTab, CONSUMABLES, MATERIALS, POTIONS, SLOT_NAMES, bagTabOf } from '../core/items';
import type { ItemInstance, Slot } from '../core/types';
import type { World } from '../core/world';
import { closeX } from './labels';
import { cellHtml, cellStyle, itemTipHtml } from './itemTip';
import { slotIconHtml } from './icons';
import { uiH, uiRect, uiW } from './uiScale';
import { renderPanel } from './panelRender';
import { byId } from './dom';
import { isTouch } from '../platform/input';

type Sel = { kind: 'bag'; i: number } | { kind: 'eq'; slot: Slot };
const selKey = (s: Sel | null) => (s ? (s.kind === 'bag' ? `b${s.i}` : `e${s.slot}`) : '');
type Tab = BagTab;
const tabOf = (it: ItemInstance): Tab => bagTabOf(it.baseId);
const usable = (it: ItemInstance) => !!POTIONS[it.baseId] || !!CONSUMABLES[it.baseId];
// slots em volta do corpo: esquerda de cima para baixo (cabeça, colar, tronco), direita (arma, calça, bota)
const BODY_LEFT: Slot[] = ['cabeca', 'colar', 'tronco'],
  BODY_RIGHT: Slot[] = ['arma', 'calca', 'bota'];

// retrato do personagem (sprite do marco 6); seitas ainda sem arte usam a silhueta na cor da seita
function bodyFigure(classId: string, color: string): string {
  const a = PORTRAIT_ANIMS[classId];
  if (a) {
    // respiração igual à dos NPCs: troca de quadros em CSS. O atraso negativo segue o relógio, então redesenhar a
    // mochila não faz a animação voltar ao começo.
    const dur = a.frames / a.fps,
      delay = -((performance.now() / 1000) % dur);
    return `<div class="body-fig body-anim" style="aspect-ratio:${a.w}/${a.h}" aria-hidden="true"><img src="${a.src}" alt="" style="--n:${a.frames};animation-duration:${dur.toFixed(3)}s;animation-delay:${delay.toFixed(3)}s;animation-timing-function:steps(${a.frames})"></div>`;
  }
  const src = PORTRAITS[classId];
  return src ? `<img class="body-fig body-img" src="${src}" alt="" aria-hidden="true">` : silhouette(color);
}

function silhouette(color: string): string {
  return `<svg class="body-fig" viewBox="0 0 100 200" aria-hidden="true"><defs><linearGradient id="bodyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".85"/><stop offset="1" stop-color="${color}" stop-opacity=".35"/></linearGradient></defs>
    <g fill="url(#bodyg)" stroke="${color}" stroke-width="1.5">
      <circle cx="50" cy="24" r="15"/>
      <path d="M44 38h12v8H44z"/>
      <path d="M28 48q22-8 44 0l6 56H22z"/>
      <path d="M28 50l-12 50 8 2 12-44zM72 50l12 50-8 2-12-44z"/>
      <path d="M24 104h52l-4 10H28z"/>
      <path d="M30 114h18l-2 66H32zM52 114h18l-2 66H54z"/>
      <path d="M28 180h20v10H24zM52 180h20l4 10H52z"/>
    </g></svg>`;
}

// Painel de mochila (tecla I): 6 slots de equipamento, 30 espaços, ouro, detalhes e ações.
export class InventoryPanel {
  private sig = '';
  private busyUntil = 0; // jogador rolando/tocando a mochila
  private sel: Sel | null = null;
  private last = { key: '', t: 0 };
  private tab: Tab = 'equip';
  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
    private onClose: () => void,
  ) {
    const el = byId('inv-panel'),
      tip = byId('item-tip');
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
    el.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const c = (e.target as HTMLElement).closest('[data-bag],[data-eq]') as HTMLElement | null;
      const it = c ? this.itemOf(c) : null;
      if (!c || !it) {
        tip.classList.add('hidden');
        return;
      }
      tip.innerHTML = itemTipHtml(this.world, it);
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
    return c.dataset.bag !== undefined ? this.world.bag[+c.dataset.bag] : this.world.equipment[c.dataset.eq as Slot];
  }
  private selItem(): ItemInstance | null {
    const s = this.sel;
    return !s ? null : s.kind === 'bag' ? this.world.bag[s.i] : this.world.equipment[s.slot];
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
    const c = t.closest('[data-bag],[data-eq]') as HTMLElement | null;
    if (!c) return;
    const sel: Sel =
      c.dataset.bag !== undefined ? { kind: 'bag', i: +c.dataset.bag } : { kind: 'eq', slot: c.dataset.eq as Slot };
    const key = selKey(sel),
      now = performance.now();
    const dbl = key === this.last.key && now - this.last.t < 400;
    this.last = { key, t: now };
    this.sel = sel;
    this.sig = '';
    byId('item-tip').classList.add('hidden');
    if (dbl && this.selItem()) this.act(sel.kind === 'eq' ? 'unequip' : usable(this.selItem()!) ? 'use' : 'equip');
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
    if (a === 'tab-equip' || a === 'tab-pot' || a === 'tab-mat') {
      this.tab = a.slice(4) as Tab;
      if (this.sel?.kind === 'bag') this.sel = null;
      return;
    }
    if (!s) return;
    let err: ActionError | null = null;
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
    const sig = `${w.invVersion}|${selKey(this.sel)}|${w.player.level}|${this.tab}`;
    if (sig === this.sig) return;
    // mudança vinda do jogo (auto pegando item, poção gasta…) enquanto o jogador rola a mochila: espera ele parar,
    // senão a lista é refeita no meio da rolagem. Ações do próprio jogador (sig vazio) redesenham na hora.
    if (this.sig !== '' && performance.now() < this.busyUntil) return;
    this.sig = sig;
    if (this.sel && !this.selItem()) this.sel = null;
    const eqCell = (sl: Slot) => {
      const it = w.equipment[sl];
      return `<div class="eqs eqs-${sl}"><small>${SLOT_NAMES[sl]}</small><button class="cell ${this.sel && selKey(this.sel) === `e${sl}` ? 'sel' : ''}" data-eq="${sl}" style="${cellStyle(it)}" aria-label="${SLOT_NAMES[sl]}" title="${SLOT_NAMES[sl]}">${it ? cellHtml(it, w.owner()) : `<span class="ic empty img">${slotIconHtml(sl, w.classId)}</span>`}</button></div>`;
    };
    const eq = `<div class="eq-col">${BODY_LEFT.map(eqCell).join('')}</div>${bodyFigure(w.classId, CLASSES[w.classId]?.color ?? '#889')}<div class="eq-col">${BODY_RIGHT.map(eqCell).join('')}</div>`;
    const bagCell = (i: number) =>
      `<button class="cell ${this.sel && selKey(this.sel) === `b${i}` ? 'sel' : ''}" data-bag="${i}" style="${cellStyle(w.bag[i])}">${cellHtml(w.bag[i], w.owner())}</button>`;
    const idx = w.bag.map((_, i) => i);
    const inTab = idx.filter((i) => w.bag[i] && tabOf(w.bag[i]!) === this.tab),
      free = idx.filter((i) => !w.bag[i]).slice(0, w.freeSlots(this.tab));
    const bag = [...inTab, ...free].map(bagCell).join('');
    const count = (t: Tab) => w.bag.filter((x) => x && tabOf(x) === t).length;
    const tabBtn = (t: Tab, label: string) =>
      `<button class="inv-tab ${this.tab === t ? 'on' : ''}" data-act="tab-${t}" role="tab" aria-selected="${this.tab === t}">${label} <small>${count(t)}</small></button>`;
    const tabs = `<div class="inv-tabs" role="tablist">${tabBtn('equip', L('Equipamento', 'Equipment'))}${tabBtn('pot', L('Consumíveis', 'Consumables'))}${tabBtn('mat', L('Materiais', 'Materials'))}</div>`;
    const it = this.selItem(),
      s = this.sel;
    let detail = `<div class="muted">${isTouch ? L('Toque em um item para ver os detalhes. Duplo toque equipa ou usa.', 'Tap an item to see details. Double tap equips or uses.') : L('Clique em um item para ver os detalhes. Duplo clique equipa ou usa.', 'Click an item to see details. Double-click equips or uses.')}</div>`;
    if (it && s) {
      let btn = '';
      if (s.kind === 'eq') btn = `<button class="primary" data-act="unequip">${L('Desequipar', 'Unequip')}</button>`;
      else if (usable(it)) btn = `<button class="primary" data-act="use">${L('Usar', 'Use')}</button>`;
      else if (MATERIALS[it.baseId]) btn = '';
      else {
        const err = w.canEquip(it);
        btn = `<button class="primary" data-act="equip" ${err ? 'disabled' : ''}>${L('Equipar', 'Equip')}</button>${err ? `<small class="muted">${actionErrorText(err)}</small>` : ''}`;
      }
      detail = `<div class="tipbody">${itemTipHtml(w, it, s.kind === 'bag')}</div>${btn}`;
    }
    // renderPanel mantém a moldura (.inv-card, que é quem rola; em telas largas rolam .inv-main e .inv-detail) e só troca
    // o que mudou, então a rolagem nunca é perdida (nem cortada no meio, no iPhone).
    renderPanel(
      byId('inv-panel'),
      `<div class="card inv-card"><div class="inv-main">${closeX('data-act="close"')}
      <h2>${L('Mochila', 'Bag')} <span class="gold">${w.gold} ${L('ouro', 'gold')}</span></h2>
      <h3>${L('Equipamento', 'Equipment')}</h3><div class="eq-body">${eq}</div>
      <h3>${L('Bolsa', 'Inventory')} (${count(this.tab)}/${BAG_TAB_SIZE}) <button class="sort-btn" data-act="sort">${L('Organizar', 'Sort')}</button></h3>${tabs}<div class="bag-grid">${bag}</div>
      <button class="close-btn" data-act="close">${L('Fechar', 'Close')}</button></div><div class="inv-detail">${detail}</div></div>`,
    );
  }
}
