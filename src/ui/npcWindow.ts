import { L, tn } from '../core/i18n';
import { BASES, POTIONS, SLOTS, SLOT_NAMES, baseOf, buyPrice, isPotionId, itemColor, itemName, maxDurability, repairCost, sellValue } from '../core/items';
import type { ItemInstance } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const LORE = L('Jovem viajante, a Vila das Nuvens já abrigou grandes mestres das duas seitas. Hoje a floresta a leste está cheia de lobos famintos. Leve poções, cuide do seu equipamento e volte inteiro. Que os ventos guiem seus passos.',
  'Young traveler, Cloud Village once sheltered great masters of both sects. Today the forest to the east is full of hungry wolves. Bring potions, look after your gear and come back whole. May the winds guide your steps.');

// Janela dos NPCs (abre sozinha quando o personagem chega). Não bloqueia o jogo ao redor.
export class NpcWindow {
  private sig = '';
  private tab: 'buy' | 'sell' = 'buy';
  private qty = 1;
  private pending = -1; // venda aguardando confirmação (incomum/raro)
  private npcId = -1;
  constructor(private world: World, private toast: (m: string, c?: string) => void) {
    $('npc-panel').addEventListener('click', (e) => this.click(e));
  }

  private click(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    const w = this.world, a = t.dataset.a!, v = t.dataset.v ?? '';
    this.sig = '';
    let err: string | null = null;
    if (a === 'close') { w.closeNpc(); return; }
    if (a === 'tab') { audio.ui('ui_click'); this.tab = v as 'buy' | 'sell'; this.pending = -1; return; }
    if (a === 'qty') { audio.ui('ui_click'); this.qty = +v; return; }
    if (a === 'buy') err = w.buy(v, this.qty);
    else if (a === 'sell' || a === 'sellall') {
      const i = +v, it = w.bag[i];
      if (!it) return;
      if (BASES[it.baseId] && it.rarity !== 'comum' && this.pending !== i) { this.pending = i; return; }
      this.pending = -1;
      err = w.sell(i, a === 'sellall' ? (it.qty ?? 1) : 1);
    } else if (a === 'rep') {
      const [kind, ref] = v.split(':');
      const it = kind === 'eq' ? w.equipment[ref as keyof typeof w.equipment] : w.bag[+ref];
      if (it) err = w.repair(it);
    } else if (a === 'repall') err = w.repairAll();
    if (err) this.toast(err, '#ff8a80');
  }

  update() {
    const w = this.world, n = w.openNpc, el = $('npc-panel');
    if (!n) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); this.sig = ''; this.npcId = -1; this.pending = -1; } return; }
    if (this.npcId !== n.id) { this.npcId = n.id; this.tab = 'buy'; this.pending = -1; this.sig = ''; }
    const sig = `${n.id}|${this.tab}|${this.qty}|${this.pending}|${w.invVersion}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    this.sig = sig;
    el.classList.remove('hidden');
    const role = w.npcRole(n);
    let body = '';
    if (role === 'ferreiro') body = this.smith();
    else if (role === 'vendedor') body = this.shop();
    else body = `<p class="lore">“${LORE}”</p>`;
    el.innerHTML = `<div class="card npc-card"><div class="npc-head"><h2>${tn(n.name)}</h2><button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div>
      ${role === 'anciao' ? '' : `<div class="gold">${w.gold} ${L('ouro', 'gold')}</div>`}${body}</div>`;
  }

  private smith(): string {
    const w = this.world;
    const rows: string[] = [];
    const row = (it: ItemInstance, ref: string, where: string) => {
      const max = maxDurability(it), cost = repairCost(it), f = Math.max(0, it.durability / max);
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b> <small>${where}</small>
        <div class="dbar ${f <= 0 ? 'zero' : f <= 0.2 ? 'low' : ''}"><u style="width:${f * 100}%"></u></div><small>${Math.round(it.durability)}/${max}${cost ? ` · ${cost} ${L('ouro', 'gold')}` : ` · ${L('perfeito', 'perfect')}`}</small></div>
        <button data-a="rep" data-v="${ref}" ${cost <= 0 || w.gold < cost ? 'disabled' : ''}>${L('Consertar', 'Repair')}</button></div>`);
    };
    for (const sl of SLOTS) { const it = w.equipment[sl]; if (it) row(it, `eq:${sl}`, L(`(equipado · ${SLOT_NAMES[sl]})`, `(equipped · ${SLOT_NAMES[sl]})`)); }
    w.bag.forEach((it, i) => { if (it && baseOf(it)) row(it, `bag:${i}`, L('(mochila)', '(bag)')); });
    const all = w.repairAllCost();
    return `${rows.join('') || `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>`}
      <button class="primary" data-a="repall" ${all <= 0 || w.gold < all ? 'disabled' : ''}>${L(`Consertar tudo (${all} ouro)`, `Repair all (${all} gold)`)}</button>`;
  }

  private shop(): string {
    const w = this.world;
    const tabs = `<div class="tabs"><button class="${this.tab === 'buy' ? 'on' : ''}" data-a="tab" data-v="buy">${L('Comprar', 'Buy')}</button><button class="${this.tab === 'sell' ? 'on' : ''}" data-a="tab" data-v="sell">${L('Vender', 'Sell')}</button></div>`;
    if (this.tab === 'buy') {
      const q = `<div class="qty">${L('Quantidade', 'Quantity')}: ${[1, 5, 10].map((n) => `<button class="${this.qty === n ? 'on' : ''}" data-a="qty" data-v="${n}">${n}</button>`).join('')}</div>`;
      const rows = Object.keys(POTIONS).map((id) => {
        const d = POTIONS[id], cost = buyPrice(id) * this.qty;
        return `<div class="srow"><div class="si"><b style="color:${d.color}">${d.name}</b><small>${L(`${Math.round(d.percent * 100)}% de ${d.kind === 'hp' ? 'vida' : 'mana'} em ${d.duration} s · ${cost} ouro`, `${Math.round(d.percent * 100)}% ${d.kind === 'hp' ? 'health' : 'mana'} over ${d.duration} s · ${cost} gold`)}</small></div>
          <button data-a="buy" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>${L('Comprar', 'Buy')}</button></div>`;
      }).join('');
      return tabs + q + rows;
    }
    const rows: string[] = [];
    w.bag.forEach((it, i) => {
      if (!it) return;
      const stack = (it.qty ?? 1) > 1, conf = this.pending === i;
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>${isPotionId(it.baseId) ? ` <small>x${it.qty ?? 1}</small>` : ''}
        <small>${sellValue(it)} ${L('ouro', 'gold')}${stack ? ` ${L('(cada)', '(each)')}` : ''}</small></div>
        <button class="${conf ? 'danger' : ''}" data-a="sell" data-v="${i}">${conf ? L('Confirmar?', 'Confirm?') : stack ? L('Vender 1', 'Sell 1') : L('Vender', 'Sell')}</button>
        ${stack ? `<button data-a="sellall" data-v="${i}">${L('Tudo', 'All')}</button>` : ''}</div>`);
    });
    return tabs + (rows.join('') || `<p class="muted">${L('A mochila está vazia.', 'The bag is empty.')}</p>`);
  }
}
