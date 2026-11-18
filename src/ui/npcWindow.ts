import { actionErrorText } from './actionError';
import type { ActionError } from '../core/types';
import { L, tn } from '../core/i18n';
import { NPC_TEXT } from '../core/data';
import {
  BASES,
  CONSUMABLES,
  MATERIALS,
  POTIONS,
  RARITIES,
  SLOTS,
  SLOT_NAMES,
  baseOf,
  buyPrice,
  isStackId,
  itemColor,
  itemName,
  maxDurability,
  repairCost,
  sellValue,
} from '../core/items';
import type { ItemInstance } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { MASTER_PORTRAITS } from '../render/sprites';
import { npcName, rewardText } from './questTracker';
import { byId, escapeHtml } from './dom';
import { itemTipHtml } from './itemTip';
import {
  matCount,
  rarityCost,
  rerollCost,
  salvageYield,
  upgradeCost,
  type ForgeCost,
  type Mats,
} from '../core/world/forge';
import { merchantGoods, merchantRefreshIn } from '../core/world/merchant';

// Janela dos NPCs (abre sozinha quando o personagem chega). Não bloqueia o jogo ao redor.
export class NpcWindow {
  private sig = '';
  private tab: 'buy' | 'sell' = 'buy';
  private smithTab: 'repair' | 'forge' = 'repair';
  private forgeSel = ''; // item escolhido na forja: "eq:<slot>" ou "bag:<índice>"
  private salvageAsk = false; // desmontar aguardando confirmação
  private qty = 1;
  private pending = -1; // venda aguardando confirmação (incomum/raro)
  private npcId = -1;
  private line = 0; // fala atual (NPCs de conversa)
  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
  ) {
    byId('npc-panel').addEventListener('click', (e) => this.click(e));
  }

  private click(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    const w = this.world,
      a = t.dataset.a!,
      v = t.dataset.v ?? '';
    this.sig = '';
    let err: ActionError | null = null;
    if (a === 'close') {
      w.closeNpc();
      return;
    }
    if (a === 'next') {
      audio.ui('ui_click');
      this.line++;
      return;
    }
    if (a === 'qaccept') {
      audio.ui('ui_open');
      w.questAccept();
      return;
    }
    if (a === 'qturn') {
      audio.ui('level_up');
      w.questTurnIn();
      return;
    }
    if (a === 'tab') {
      audio.ui('ui_click');
      this.tab = v as 'buy' | 'sell';
      this.pending = -1;
      return;
    }
    if (a === 'qty') {
      audio.ui('ui_click');
      this.qty = +v;
      return;
    }
    if (a === 'stab') {
      audio.ui('ui_click');
      this.smithTab = v as 'repair' | 'forge';
      return;
    }
    if (a === 'fsel') {
      audio.ui('ui_click');
      this.forgeSel = v;
      this.salvageAsk = false;
      return;
    }
    if (a === 'forge') {
      const it = this.forgeItem();
      if (!it) return;
      const before = it.plus ?? 0;
      if (v === 'salvage') {
        if (!this.salvageAsk) {
          this.salvageAsk = true;
          return;
        }
        this.salvageAsk = false;
        err = w.forgeSalvage(+this.forgeSel.split(':')[1]);
        if (!err) {
          audio.ui('ui_click');
          this.toast(L('Item desmontado: materiais na mochila', 'Item salvaged: materials in your bag'), '#c9b8a0');
          this.forgeSel = '';
        }
      } else {
        err = v === 'upgrade' ? w.forgeUpgrade(it) : v === 'rarity' ? w.forgeRarity(it) : w.forgeReroll(it);
        if (!err && v === 'upgrade') {
          const ok = (it.plus ?? 0) > before;
          audio.ui(ok ? 'level_up' : 'ui_click');
          this.toast(
            ok
              ? L(`Sucesso! ${itemName(it)}`, `Success! ${itemName(it)}`)
              : L('A forja falhou: os materiais se perderam', 'The forging failed: the materials were lost'),
            ok ? '#6fdc6f' : '#ff8a80',
          );
        } else if (!err) {
          audio.ui('level_up');
          this.toast(L(`Pronto: ${itemName(it)}`, `Done: ${itemName(it)}`), RARITIES[it.rarity].color);
        }
      }
    } else if (a === 'moffer') {
      err = w.merchantBuy(+v);
      if (!err) audio.ui('ui_click');
    } else if (a === 'mgoods') {
      err = w.merchantBuyGoods(v, this.qty);
      if (!err) audio.ui('ui_click');
    } else if (a === 'buy') err = w.buy(v, this.qty);
    else if (a === 'sell' || a === 'sellall') {
      const i = +v,
        it = w.bag[i];
      if (!it) return;
      if (BASES[it.baseId] && it.rarity !== 'comum' && this.pending !== i) {
        this.pending = i;
        return;
      }
      this.pending = -1;
      err = w.sell(i, a === 'sellall' ? (it.qty ?? 1) : 1);
    } else if (a === 'rep') {
      const [kind, ref] = v.split(':');
      const it = kind === 'eq' ? w.equipment[ref as keyof typeof w.equipment] : w.bag[+ref];
      if (it) err = w.repair(it);
    } else if (a === 'repall') err = w.repairAll();
    if (err) this.toast(actionErrorText(err), '#ff8a80');
  }

  update() {
    const w = this.world,
      n = w.openNpc,
      el = byId('npc-panel');
    if (!n) {
      if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        this.sig = '';
        this.npcId = -1;
        this.pending = -1;
      }
      return;
    }
    if (this.npcId !== n.id) {
      this.npcId = n.id;
      this.tab = 'buy';
      this.smithTab = 'repair';
      this.forgeSel = '';
      this.salvageAsk = false;
      this.pending = -1;
      this.sig = '';
      this.line = 0;
    }
    const refreshMin = Math.ceil(merchantRefreshIn(w.clock()) / 60_000);
    const sig = `${n.id}|${this.tab}|${this.qty}|${this.pending}|${this.line}|${w.invVersion}|${w.quest.stage}|${w.quest.status}|${w.quest.progress}|${w.player.level}|${this.smithTab}|${this.forgeSel}|${this.salvageAsk}|${refreshMin}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    this.sig = sig;
    el.classList.remove('hidden');
    const role = w.npcRole(n);
    const shop = role === 'ferreiro' || role === 'vendedor' || role === 'mercador';
    let body = '',
      sub = '';
    if (role === 'ferreiro') body = this.smithTabs() + (this.smithTab === 'forge' ? this.forge() : this.smith());
    else if (role === 'vendedor') body = this.shop();
    else if (role === 'mercador') body = this.merchant(role);
    else if (role.startsWith('mestre_')) {
      const m = this.master(role.slice(7));
      body = m.body;
      sub = m.sub;
    } else body = this.talk(role);
    el.innerHTML = `<div class="card npc-card"><div class="npc-head"><h2>${escapeHtml(tn(n.name))}${sub}</h2><button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div>
      ${this.questBox(role)}${shop ? `<div class="gold">${w.gold} ${L('ouro', 'gold')}</div>` : ''}${body}</div>`;
  }

  /** Missão ligada a este NPC (marco 7): oferta com "Aceitar", entrega com "Entregar" ou o andamento. */
  private questBox(role: string): string {
    const w = this.world,
      v = w.questView(),
      q = v.def;
    if (!q) return '';
    const head = (tag: string) =>
      `<div class="q-head"><span class="q-tag">${tag}</span> <b>${escapeHtml(q.name)}</b></div>`;
    const rew = `<div class="q-rew">${L('Recompensa', 'Reward')}: ${rewardText(q.reward)}</div>`;
    if (v.phase === 'available' && v.giver === role) {
      return `<div class="quest-box">${head(L('Missão', 'Quest'))}<p class="lore">“${escapeHtml(q.offer)}”</p>
        <div class="q-goal">${L('Objetivo', 'Goal')}: ${escapeHtml(q.goal)}${v.count > 1 ? ` (${v.count})` : ''}</div>${rew}
        <button class="primary" data-a="qaccept">${L('Aceitar', 'Accept')}</button></div>`;
    }
    if (v.phase === 'ready' && v.turnIn === role) {
      return `<div class="quest-box ready">${head(L('Concluída', 'Complete'))}<p class="lore">“${escapeHtml(q.done)}”</p>${rew}
        <button class="primary" data-a="qturn">${L('Entregar', 'Turn in')}</button></div>`;
    }
    if (v.phase === 'active' && (v.giver === role || v.turnIn === role)) {
      return `<div class="quest-box">${head(L('Em andamento', 'In progress'))}<div class="q-goal">${escapeHtml(q.goal)}${v.count > 1 ? ` <b>${v.progress}/${v.count}</b>` : ''}</div></div>`;
    }
    if (v.phase === 'locked' && v.giver === role) {
      return `<div class="quest-box"><small class="muted">${L(`Volte quando estiver no nível ${q.minLevel}: tenho uma tarefa para você.`, `Come back at level ${q.minLevel}: I have a task for you.`)}</small></div>`;
    }
    return '';
  }

  /** Mestre da seita: apresenta a seita (o mesmo texto da criação) e dá dicas. */
  private master(sect: string): { sub: string; body: string } {
    const m = NPC_TEXT.masters[sect];
    if (!m) return { sub: '', body: '' };
    const mine = this.world.classId === sect;
    const pic = MASTER_PORTRAITS[sect] ? `<img class="npc-pic" src="${MASTER_PORTRAITS[sect]}" alt="">` : '';
    const tips = m.tips?.length
      ? `<ul class="npc-tips">${m.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
      : '';
    return {
      sub: `<small class="npc-title">${escapeHtml(m.title)}${mine ? ` · <b>${L('sua seita', 'your sect')}</b>` : ''}</small>`,
      body: `<div class="npc-talk">${pic}<p class="lore">“${escapeHtml(m.greeting)}”</p></div><p>${escapeHtml(m.intro)}</p>${tips}
        ${m.locked ? `<p class="muted">${escapeHtml(m.locked)}</p>` : ''}`,
    };
  }

  /** NPC de conversa: uma fala por vez; "Continuar" passa para a próxima (volta ao começo no fim). */
  private talk(role: string): string {
    const t = NPC_TEXT.npcs[role];
    if (!t?.lines.length) return '';
    const k = this.line % t.lines.length;
    return `<p class="lore">“${escapeHtml(t.lines[k])}”</p>
      ${t.lines.length > 1 ? `<div class="npc-next"><small class="muted">${k + 1}/${t.lines.length}</small><button data-a="next">${k + 1 < t.lines.length ? L('Continuar ›', 'Continue ›') : L('Do começo ↺', 'From the start ↺')}</button></div>` : ''}`;
  }

  private smithTabs(): string {
    const b = (t: string, label: string) =>
      `<button class="${this.smithTab === t ? 'on' : ''}" data-a="stab" data-v="${t}">${label}</button>`;
    return `<div class="tabs">${b('repair', L('Consertar', 'Repair'))}${b('forge', L('Forjar', 'Forge'))}</div>`;
  }

  private forgeItem(): ItemInstance | null {
    const [kind, ref] = this.forgeSel.split(':');
    const w = this.world;
    const it = kind === 'eq' ? w.equipment[ref as keyof typeof w.equipment] : kind === 'bag' ? w.bag[+ref] : null;
    return it && BASES[it.baseId] ? it : null;
  }

  private matsHtml(m: Mats): string {
    const w = this.world;
    return Object.entries(m)
      .map(([id, n]) => {
        const have = matCount(w, id),
          d = MATERIALS[id];
        return `<span style="color:${have >= n ? d.color : '#ff8a80'}">${n} ${escapeHtml(d.name)} <small>(${have})</small></span>`;
      })
      .join(' · ');
  }

  private costRow(label: string, action: string, cost: ForgeCost | null, note: string, why: string): string {
    const w = this.world;
    if (!cost)
      return `<div class="srow"><div class="si"><b>${label}</b><small class="muted">${why}</small></div></div>`;
    const okMats = Object.entries(cost.mats).every(([id, n]) => matCount(w, id) >= n);
    const can = okMats && w.gold >= cost.gold;
    return `<div class="srow"><div class="si"><b>${label}</b><small>${note}</small>
      <small>${this.matsHtml(cost.mats)}${cost.gold ? ` · <span style="color:${w.gold >= cost.gold ? 'inherit' : '#ff8a80'}">${cost.gold} ${L('ouro', 'gold')}</span>` : ''}</small></div>
      <button data-a="forge" data-v="${action}" ${can ? '' : 'disabled'}>${L('Forjar', 'Forge')}</button></div>`;
  }

  /** Aba Forjar (marco 9): escolhe um item e mostra melhorar, subir raridade, trocar bônus e desmontar. */
  private forge(): string {
    const w = this.world;
    const owned = Object.keys(MATERIALS)
      .map(
        (id) =>
          `<span style="color:${MATERIALS[id].color}">${escapeHtml(MATERIALS[id].name)}: <b>${matCount(w, id)}</b></span>`,
      )
      .join(' · ');
    const pick: string[] = [];
    const chip = (it: ItemInstance, ref: string) =>
      pick.push(
        `<button class="fchip ${this.forgeSel === ref ? 'on' : ''}" data-a="fsel" data-v="${ref}" style="border-color:${itemColor(it)}"><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b>${ref.startsWith('eq:') ? ` <small>(${L('equipado', 'equipped')})</small>` : ''}</button>`,
      );
    for (const sl of SLOTS) {
      const it = w.equipment[sl];
      if (it) chip(it, `eq:${sl}`);
    }
    w.bag.forEach((it, i) => {
      if (it && BASES[it.baseId]) chip(it, `bag:${i}`);
    });
    const head = `<p class="muted"><small>${owned}</small></p>`;
    if (!pick.length) return head + `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>`;
    const it = this.forgeItem();
    let detail = `<p class="muted">${L('Escolha um item para forjar.', 'Choose an item to forge.')}</p>`;
    if (it) {
      const up = upgradeCost(it),
        ra = rarityCost(it),
        re = rerollCost(it),
        plus = it.plus ?? 0;
      const inBag = this.forgeSel.startsWith('bag:');
      const salv = salvageYield(it);
      detail = `<div class="tipbody">${itemTipHtml(w, it, false)}</div>
        ${this.costRow(
          L(`Melhorar para +${plus + 1}`, `Upgrade to +${plus + 1}`),
          'upgrade',
          up,
          up
            ? L(
                `Chance ${Math.round(up.chance * 100)}%. Se falhar, perde só os materiais.`,
                `${Math.round(up.chance * 100)}% chance. On failure you lose only the materials.`,
              )
            : '',
          L('Já está no máximo (+10).', 'Already at the maximum (+10).'),
        )}
        ${this.costRow(
          ra
            ? L(
                `Subir para ${RARITIES[it.rarity === 'comum' ? 'incomum' : 'raro'].name}`,
                `Raise to ${RARITIES[it.rarity === 'comum' ? 'incomum' : 'raro'].name}`,
              )
            : L('Subir raridade', 'Raise rarity'),
          'rarity',
          ra,
          L('Ganha um bônus aleatório novo.', 'Gains a new random bonus.'),
          L('Já é Raro.', 'Already Rare.'),
        )}
        ${this.costRow(
          L('Trocar bônus', 'Reroll bonuses'),
          'reroll',
          re,
          L('Sorteia de novo todos os bônus.', 'Rerolls all bonuses.'),
          L('Só itens Incomuns ou Raros têm bônus.', 'Only Uncommon or Rare items have bonuses.'),
        )}
        <div class="srow"><div class="si"><b>${L('Desmontar', 'Salvage')}</b><small>${L('Recebe', 'Get')}: ${this.matsHtml(salv).replace(/<small>\([^)]*\)<\/small>/g, '')}</small>
          ${inBag ? '' : `<small class="muted">${L('Desequipe antes de desmontar.', 'Unequip it before salvaging.')}</small>`}</div>
          <button class="${this.salvageAsk ? 'danger' : ''}" data-a="forge" data-v="salvage" ${inBag ? '' : 'disabled'}>${this.salvageAsk ? L('Confirmar?', 'Confirm?') : L('Desmontar', 'Salvage')}</button></div>`;
    }
    return head + `<div class="fpick">${pick.join('')}</div>` + detail;
  }

  /** Mercador Ambulante (marco 9): estoque que renova a cada hora, materiais raros e pergaminho de retorno. */
  private merchant(role: string): string {
    const w = this.world,
      st = w.merchantStock();
    const line = NPC_TEXT.npcs[role]?.lines[0];
    const mins = Math.ceil(merchantRefreshIn(w.clock()) / 60_000);
    const offers = st.offers
      .map((o, i) => {
        const it = o.item;
        return `<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b>
          <small>${RARITIES[it.rarity].name} · ${SLOT_NAMES[BASES[it.baseId].slot]} · ${L('nível', 'level')} ${BASES[it.baseId].reqLevel} · ${o.price} ${L('ouro', 'gold')}</small>
          <details><summary><small>${L('Detalhes', 'Details')}</small></summary><div class="tipbody">${itemTipHtml(w, it)}</div></details></div>
          <button data-a="moffer" data-v="${i}" ${o.sold || w.gold < o.price ? 'disabled' : ''}>${o.sold ? L('Vendido', 'Sold') : L('Comprar', 'Buy')}</button></div>`;
      })
      .join('');
    const q = `<div class="qty">${L('Quantidade', 'Quantity')}: ${[1, 5, 10].map((n) => `<button class="${this.qty === n ? 'on' : ''}" data-a="qty" data-v="${n}">${n}</button>`).join('')}</div>`;
    const goods = Object.entries(merchantGoods())
      .map(([id, price]) => {
        const d = MATERIALS[id] ?? CONSUMABLES[id],
          cost = price * this.qty;
        return `<div class="srow"><div class="si"><b style="color:${d.color}">${escapeHtml(d.name)}</b><small>${escapeHtml(d.desc)} · ${cost} ${L('ouro', 'gold')}</small></div>
          <button data-a="mgoods" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>${L('Comprar', 'Buy')}</button></div>`;
      })
      .join('');
    return `${line ? `<p class="lore">“${escapeHtml(line)}”</p>` : ''}
      <h3>${L('Mercadorias raras', 'Rare wares')} <small class="muted">${L(`renova em ${mins} min`, `restocks in ${mins} min`)}</small></h3>
      ${offers || `<p class="muted">${L('Nada à venda agora.', 'Nothing for sale right now.')}</p>`}
      <h3>${L('Sempre à venda', 'Always in stock')}</h3>${q}${goods}`;
  }

  private smith(): string {
    const w = this.world;
    const rows: string[] = [];
    const row = (it: ItemInstance, ref: string, where: string) => {
      const max = maxDurability(it),
        cost = repairCost(it),
        f = Math.max(0, it.durability / max);
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b> <small>${where}</small>
        <div class="dbar ${f <= 0 ? 'zero' : f <= 0.2 ? 'low' : ''}"><u style="width:${f * 100}%"></u></div><small>${Math.round(it.durability)}/${max}${cost ? ` · ${cost} ${L('ouro', 'gold')}` : ` · ${L('perfeito', 'perfect')}`}</small></div>
        <button data-a="rep" data-v="${ref}" ${cost <= 0 || w.gold < cost ? 'disabled' : ''}>${L('Consertar', 'Repair')}</button></div>`);
    };
    for (const sl of SLOTS) {
      const it = w.equipment[sl];
      if (it) row(it, `eq:${sl}`, L(`(equipado · ${SLOT_NAMES[sl]})`, `(equipped · ${SLOT_NAMES[sl]})`));
    }
    w.bag.forEach((it, i) => {
      if (it && baseOf(it)) row(it, `bag:${i}`, L('(mochila)', '(bag)'));
    });
    const all = w.repairAllCost();
    return `${rows.join('') || `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>`}
      <button class="primary" data-a="repall" ${all <= 0 || w.gold < all ? 'disabled' : ''}>${L(`Consertar tudo (${all} ouro)`, `Repair all (${all} gold)`)}</button>`;
  }

  private shop(): string {
    const w = this.world;
    const tabs = `<div class="tabs"><button class="${this.tab === 'buy' ? 'on' : ''}" data-a="tab" data-v="buy">${L('Comprar', 'Buy')}</button><button class="${this.tab === 'sell' ? 'on' : ''}" data-a="tab" data-v="sell">${L('Vender', 'Sell')}</button></div>`;
    if (this.tab === 'buy') {
      const q = `<div class="qty">${L('Quantidade', 'Quantity')}: ${[1, 5, 10].map((n) => `<button class="${this.qty === n ? 'on' : ''}" data-a="qty" data-v="${n}">${n}</button>`).join('')}</div>`;
      const rows = Object.keys(POTIONS)
        .map((id) => {
          const d = POTIONS[id],
            cost = buyPrice(id) * this.qty;
          return `<div class="srow"><div class="si"><b style="color:${d.color}">${d.name}</b><small>${L(`${Math.round(d.percent * 100)}% de ${d.kind === 'hp' ? 'vida' : 'mana'} em ${d.duration} s · ${cost} ouro`, `${Math.round(d.percent * 100)}% ${d.kind === 'hp' ? 'health' : 'mana'} over ${d.duration} s · ${cost} gold`)}</small></div>
          <button data-a="buy" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>${L('Comprar', 'Buy')}</button></div>`;
        })
        .join('');
      return tabs + q + rows;
    }
    const rows: string[] = [];
    w.bag.forEach((it, i) => {
      if (!it) return;
      const stack = (it.qty ?? 1) > 1,
        conf = this.pending === i;
      rows.push(`<div class="srow"><div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>${isStackId(it.baseId) ? ` <small>x${it.qty ?? 1}</small>` : ''}
        <small>${sellValue(it)} ${L('ouro', 'gold')}${stack ? ` ${L('(cada)', '(each)')}` : ''}</small></div>
        <button class="${conf ? 'danger' : ''}" data-a="sell" data-v="${i}">${conf ? L('Confirmar?', 'Confirm?') : stack ? L('Vender 1', 'Sell 1') : L('Vender', 'Sell')}</button>
        ${stack ? `<button data-a="sellall" data-v="${i}">${L('Tudo', 'All')}</button>` : ''}</div>`);
    });
    return tabs + (rows.join('') || `<p class="muted">${L('A mochila está vazia.', 'The bag is empty.')}</p>`);
  }
}
