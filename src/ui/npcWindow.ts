import { BASES, POTIONS, SLOTS, SLOT_NAMES, baseOf, buyPrice, isPotionId, itemColor, itemName, maxDurability, repairCost, sellValue } from '../core/items';
import type { ItemInstance } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const LORE = 'Jovem viajante, a Vila das Nuvens já abrigou grandes mestres das duas seitas. Hoje a floresta a leste está cheia de lobos famintos. Leve poções, cuide do seu equipamento e volte inteiro. Que os ventos guiem seus passos.';

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
    el.innerHTML = `<div class="card npc-card"><div class="npc-head"><h2>${n.name}</h2><button class="x" data-a="close" aria-label="Fechar">✕</button></div>
      ${role === 'anciao' ? '' : `<div class="gold">${w.gold} ouro</div>`}${body}</div>`;
  }

  private smith(): string {
    const w = this.world;
    const rows: string[] = [];
    const row = (it: ItemInstance, ref: string, where: string) => {
      const max = maxDurability(it), cost = repairCost(it), f = Math.max(0, it.durability / max);
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b> <small>${where}</small>
        <div class="dbar ${f <= 0 ? 'zero' : f <= 0.2 ? 'low' : ''}"><u style="width:${f * 100}%"></u></div><small>${Math.round(it.durability)}/${max}${cost ? ` · ${cost} ouro` : ' · perfeito'}</small></div>
        <button data-a="rep" data-v="${ref}" ${cost <= 0 || w.gold < cost ? 'disabled' : ''}>Consertar</button></div>`);
    };
    for (const sl of SLOTS) { const it = w.equipment[sl]; if (it) row(it, `eq:${sl}`, `(equipado · ${SLOT_NAMES[sl]})`); }
    w.bag.forEach((it, i) => { if (it && baseOf(it)) row(it, `bag:${i}`, '(mochila)'); });
    const all = w.repairAllCost();
    return `${rows.join('') || '<p class="muted">Você não tem equipamentos.</p>'}
      <button class="primary" data-a="repall" ${all <= 0 || w.gold < all ? 'disabled' : ''}>Consertar tudo (${all} ouro)</button>`;
  }

  private shop(): string {
    const w = this.world;
    const tabs = `<div class="tabs"><button class="${this.tab === 'buy' ? 'on' : ''}" data-a="tab" data-v="buy">Comprar</button><button class="${this.tab === 'sell' ? 'on' : ''}" data-a="tab" data-v="sell">Vender</button></div>`;
    if (this.tab === 'buy') {
      const q = `<div class="qty">Quantidade: ${[1, 5, 10].map((n) => `<button class="${this.qty === n ? 'on' : ''}" data-a="qty" data-v="${n}">${n}</button>`).join('')}</div>`;
      const rows = Object.keys(POTIONS).map((id) => {
        const d = POTIONS[id], cost = buyPrice(id) * this.qty;
        return `<div class="srow"><div class="si"><b style="color:${d.color}">${d.name}</b><small>${Math.round(d.percent * 100)}% de ${d.kind === 'hp' ? 'vida' : 'mana'} em ${d.duration} s · ${cost} ouro</small></div>
          <button data-a="buy" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>Comprar</button></div>`;
      }).join('');
      return tabs + q + rows;
    }
    const rows: string[] = [];
    w.bag.forEach((it, i) => {
      if (!it) return;
      const stack = (it.qty ?? 1) > 1, conf = this.pending === i;
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>${isPotionId(it.baseId) ? ` <small>x${it.qty ?? 1}</small>` : ''}
        <small>${sellValue(it)} ouro${stack ? ' (cada)' : ''}</small></div>
        <button class="${conf ? 'danger' : ''}" data-a="sell" data-v="${i}">${conf ? 'Confirmar?' : stack ? 'Vender 1' : 'Vender'}</button>
        ${stack ? `<button data-a="sellall" data-v="${i}">Tudo</button>` : ''}</div>`);
    });
    return tabs + (rows.join('') || '<p class="muted">A mochila está vazia.</p>');
  }
}
