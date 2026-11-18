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
  makeStack,
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
import { cellHtml, cellStyle, itemTipHtml } from './itemTip';
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

/** Partes de uma janela de NPC: `top` fica fixo (abas, quantidade, filtros), `list` e `side` rolam cada um por si
 *  (lado a lado em tela larga, um embaixo do outro em tela estreita) e `foot` fica fixo embaixo. */
type View = { top?: string; list: string; side?: string; foot?: string; wide?: boolean };
type SellFilter = 'all' | 'equip' | 'pot' | 'mat';
const sellCat = (it: ItemInstance): Exclude<SellFilter, 'all'> =>
  POTIONS[it.baseId] || CONSUMABLES[it.baseId] ? 'pot' : MATERIALS[it.baseId] ? 'mat' : 'equip';
/** ícone do item no mesmo estilo da mochila */
const icon = (it: ItemInstance) => `<span class="cell mini" style="${cellStyle(it)}">${cellHtml(it)}</span>`;

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
  private sellFilter: SellFilter = 'all';
  private sellJunkAsk = false; // "vender comuns" aguardando confirmação
  private viewKey = ''; // muda de aba/NPC: a rolagem volta ao topo; senão é mantida entre redesenhos
  private showSide = false; // tela estreita: depois de escolher um item na forja, rola até o detalhe
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
      this.sellJunkAsk = false;
      return;
    }
    if (a === 'sfilter') {
      audio.ui('ui_click');
      this.sellFilter = v as SellFilter;
      this.pending = -1;
      this.sellJunkAsk = false;
      return;
    }
    if (a === 'selljunk') {
      if (!this.sellJunkAsk) {
        this.sellJunkAsk = true;
        return;
      }
      this.sellJunkAsk = false;
      let gold = 0,
        n = 0;
      for (const i of this.junk()) {
        const before = w.gold;
        err = w.sell(i, 1);
        if (err) break;
        gold += w.gold - before;
        n++;
      }
      if (n) {
        audio.ui('ui_click');
        this.toast(L(`${n} itens vendidos: +${gold} ouro`, `${n} items sold: +${gold} gold`), '#ffd23f');
      }
      if (err) this.toast(actionErrorText(err), '#ff8a80');
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
      this.showSide = true;
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
      this.sellJunkAsk = false;
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
      this.sellFilter = 'all';
      this.sellJunkAsk = false;
    }
    const refreshMin = Math.ceil(merchantRefreshIn(w.clock()) / 60_000);
    const sig = `${n.id}|${this.tab}|${this.qty}|${this.pending}|${this.line}|${w.invVersion}|${w.quest.stage}|${w.quest.status}|${w.quest.progress}|${w.player.level}|${this.smithTab}|${this.forgeSel}|${this.salvageAsk}|${refreshMin}|${this.sellFilter}|${this.sellJunkAsk}|${w.gold}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    this.sig = sig;
    el.classList.remove('hidden');
    const role = w.npcRole(n);
    const shop = role === 'ferreiro' || role === 'vendedor' || role === 'mercador';
    let view: View,
      sub = '';
    if (role === 'ferreiro') {
      const v = this.smithTab === 'forge' ? this.forge() : this.smith();
      view = { ...v, top: this.smithTabs() + (v.top ?? '') };
    } else if (role === 'vendedor') view = this.shop();
    else if (role === 'mercador') view = this.merchant(role);
    else if (role.startsWith('mestre_')) {
      const m = this.master(role.slice(7));
      view = { list: m.body };
      sub = m.sub;
    } else view = { list: this.talk(role) };
    const quest = this.questBox(role);
    const gold = shop ? `<span class="gold">${w.gold} ${L('ouro', 'gold')}</span>` : '';
    // A moldura (.npc-card) é a mesma enquanto a janela do mesmo NPC está aberta: só o conteúdo é trocado e a
    // rolagem de cada coluna é devolvida. Antes a janela inteira era refeita e voltava ao topo a cada venda.
    const key = `${n.id}|${role}|${this.tab}|${this.smithTab}|${this.sellFilter}`;
    let card = el.querySelector('.npc-card') as HTMLElement | null;
    const same = !!card && key === this.viewKey;
    const scrollers = ['.npc-cols', '.npc-list', '.npc-side'];
    const keep = same && card ? scrollers.map((q) => card!.querySelector(q)?.scrollTop ?? 0) : null;
    this.viewKey = key;
    if (!card) {
      el.innerHTML = '<div class="card npc-card"></div>';
      card = el.querySelector('.npc-card') as HTMLElement;
    }
    card.classList.toggle('npc-wide', !!view.wide);
    card.classList.toggle('npc-split', !!view.side);
    card.innerHTML = `<div class="npc-top"><div class="npc-head"><h2>${escapeHtml(tn(n.name))}${sub}</h2>${gold}<button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div>${view.top ?? ''}</div>
      <div class="npc-cols"><div class="npc-list">${quest}${view.list}</div>${view.side ? `<div class="npc-side">${view.side}</div>` : ''}</div>
      ${view.foot ? `<div class="npc-foot">${view.foot}</div>` : ''}`;
    if (keep)
      scrollers.forEach((q, i) => {
        const e = card!.querySelector(q);
        if (e) e.scrollTop = keep[i];
      });
    if (this.showSide) {
      this.showSide = false;
      const cols = card.querySelector('.npc-cols') as HTMLElement,
        side = card.querySelector('.npc-side') as HTMLElement | null;
      // tela estreita (uma coluna só): leva o detalhe do item escolhido para a vista
      if (side && getComputedStyle(cols).overflowY !== 'hidden') cols.scrollTop = side.offsetTop - cols.offsetTop;
    }
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
        return `<span class="mat" style="color:${have >= n ? d.color : '#ff8a80'}">${n} ${escapeHtml(d.name)} <i>(${have})</i></span>`;
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

  private qtyPick(): string {
    return `<div class="qty-pick">${L('Quantidade', 'Quantity')}: ${[1, 5, 10].map((n) => `<button class="${this.qty === n ? 'on' : ''}" data-a="qty" data-v="${n}">${n}</button>`).join('')}</div>`;
  }

  /** Aba Forjar (marco 9): à esquerda a lista de equipamentos, à direita o item escolhido e as ações da forja. */
  private forge(): View {
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
        `<button class="fchip ${this.forgeSel === ref ? 'on' : ''}" data-a="fsel" data-v="${ref}" style="border-color:${itemColor(it)}">${icon(it)}<span><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b>${ref.startsWith('eq:') ? `<small>${L('equipado', 'equipped')}</small>` : ''}</span></button>`,
      );
    for (const sl of SLOTS) {
      const it = w.equipment[sl];
      if (it) chip(it, `eq:${sl}`);
    }
    w.bag.forEach((it, i) => {
      if (it && BASES[it.baseId]) chip(it, `bag:${i}`);
    });
    const top = `<div class="npc-mats"><small>${owned}</small></div>`;
    if (!pick.length)
      return { top, list: `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>` };
    const it = this.forgeItem();
    let detail = `<p class="muted">${L('Escolha um item para forjar.', 'Choose an item to forge.')}</p>`;
    if (it) {
      const up = upgradeCost(it),
        ra = rarityCost(it),
        re = rerollCost(it),
        plus = it.plus ?? 0;
      const inBag = this.forgeSel.startsWith('bag:');
      const salv = salvageYield(it);
      // ações primeiro (é o que se usa várias vezes seguidas); a ficha completa do item vem logo abaixo
      detail = `${this.costRow(
        L(`Melhorar para +${plus + 1}`, `Upgrade to +${plus + 1}`),
        'upgrade',
        up,
        up
          ? L(
              `Chance ${Math.round(up.chance * 100)}%. Se falhar, perde os materiais e o ouro; o item não muda.`,
              `${Math.round(up.chance * 100)}% chance. On failure you lose the materials and gold; the item stays the same.`,
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
        <div class="srow"><div class="si"><b>${L('Desmontar', 'Salvage')}</b><small>${L('Recebe', 'Get')}: ${this.matsHtml(salv).replace(/ <i>\([^)]*\)<\/i>/g, '')}</small>
          ${inBag ? '' : `<small class="muted">${L('Desequipe antes de desmontar.', 'Unequip it before salvaging.')}</small>`}</div>
          <button class="${this.salvageAsk ? 'danger' : ''}" data-a="forge" data-v="salvage" ${inBag ? '' : 'disabled'}>${this.salvageAsk ? L('Confirmar?', 'Confirm?') : L('Desmontar', 'Salvage')}</button></div>
        <div class="tipbody ftip">${itemTipHtml(w, it, false)}</div>`;
    }
    return { top, list: `<div class="fpick">${pick.join('')}</div>`, side: detail, wide: true };
  }

  /** Mercador Ambulante (marco 9): estoque que renova a cada hora, materiais raros e pergaminho de retorno. */
  private merchant(role: string): View {
    const w = this.world,
      st = w.merchantStock();
    const line = NPC_TEXT.npcs[role]?.lines[0];
    const mins = Math.ceil(merchantRefreshIn(w.clock()) / 60_000);
    const offers = st.offers
      .map((o, i) => {
        const it = o.item;
        return `<div class="srow">${icon(it)}<div class="si"><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b>
          <small>${RARITIES[it.rarity].name} · ${SLOT_NAMES[BASES[it.baseId].slot]} · ${L('nível', 'level')} ${BASES[it.baseId].reqLevel} · ${o.price} ${L('ouro', 'gold')}</small>
          <details><summary><small>${L('Detalhes', 'Details')}</small></summary><div class="tipbody">${itemTipHtml(w, it)}</div></details></div>
          <button data-a="moffer" data-v="${i}" ${o.sold || w.gold < o.price ? 'disabled' : ''}>${o.sold ? L('Vendido', 'Sold') : L('Comprar', 'Buy')}</button></div>`;
      })
      .join('');
    const goods = Object.entries(merchantGoods())
      .map(([id, price]) => {
        const d = MATERIALS[id] ?? CONSUMABLES[id],
          cost = price * this.qty;
        return `<div class="srow">${icon(makeStack(id, this.qty))}<div class="si"><b style="color:${d.color}">${escapeHtml(d.name)}</b><small>${escapeHtml(d.desc)} · ${cost} ${L('ouro', 'gold')}</small></div>
          <button data-a="mgoods" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>${L('Comprar', 'Buy')}</button></div>`;
      })
      .join('');
    return {
      wide: true,
      list: `${line ? `<p class="lore">“${escapeHtml(line)}”</p>` : ''}
        <h3>${L('Mercadorias raras', 'Rare wares')} <small class="muted">${L(`renova em ${mins} min`, `restocks in ${mins} min`)}</small></h3>
        ${offers || `<p class="muted">${L('Nada à venda agora.', 'Nothing for sale right now.')}</p>`}`,
      side: `<h3>${L('Sempre à venda', 'Always in stock')}</h3>${this.qtyPick()}${goods}`,
    };
  }

  private smith(): View {
    const w = this.world;
    const rows: string[] = [];
    const row = (it: ItemInstance, ref: string, where: string) => {
      const max = maxDurability(it),
        cost = repairCost(it),
        f = Math.max(0, it.durability / max);
      rows.push(`<div class="srow">${icon(it)}<div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b> <small>${where}</small>
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
    return {
      wide: true,
      list: rows.length
        ? `<div class="srows">${rows.join('')}</div>`
        : `<p class="muted">${L('Você não tem equipamentos.', 'You have no equipment.')}</p>`,
      foot: `<button class="primary" data-a="repall" ${all <= 0 || w.gold < all ? 'disabled' : ''}>${L(`Consertar tudo (${all} ouro)`, `Repair all (${all} gold)`)}</button>`,
    };
  }

  /** Equipamentos comuns da mochila (o "lixo" que o botão Vender comuns leva de uma vez). */
  private junk(): number[] {
    const out: number[] = [];
    this.world.bag.forEach((it, i) => {
      if (it && BASES[it.baseId] && it.rarity === 'comum' && !it.plus) out.push(i);
    });
    return out;
  }

  private shop(): View {
    const w = this.world;
    const tabs = `<div class="tabs"><button class="${this.tab === 'buy' ? 'on' : ''}" data-a="tab" data-v="buy">${L('Comprar', 'Buy')}</button><button class="${this.tab === 'sell' ? 'on' : ''}" data-a="tab" data-v="sell">${L('Vender', 'Sell')}</button></div>`;
    if (this.tab === 'buy') {
      const rows = Object.keys(POTIONS)
        .map((id) => {
          const d = POTIONS[id],
            cost = buyPrice(id) * this.qty;
          return `<div class="srow">${icon(makeStack(id, this.qty))}<div class="si"><b style="color:${d.color}">${d.name}</b><small>${L(`${Math.round(d.percent * 100)}% de ${d.kind === 'hp' ? 'vida' : 'mana'} em ${d.duration} s · ${cost} ouro`, `${Math.round(d.percent * 100)}% ${d.kind === 'hp' ? 'health' : 'mana'} over ${d.duration} s · ${cost} gold`)}</small></div>
          <button data-a="buy" data-v="${id}" ${w.gold < cost ? 'disabled' : ''}>${L('Comprar', 'Buy')}</button></div>`;
        })
        .join('');
      return {
        wide: true,
        top: `<div class="npc-bar">${tabs}${this.qtyPick()}</div>`,
        list: `<div class="srows">${rows}</div>`,
      };
    }
    const count = { all: 0, equip: 0, pot: 0, mat: 0 };
    const rows: string[] = [];
    w.bag.forEach((it, i) => {
      if (!it) return;
      const cat = sellCat(it);
      count.all++;
      count[cat]++;
      if (this.sellFilter !== 'all' && this.sellFilter !== cat) return;
      const stack = (it.qty ?? 1) > 1,
        conf = this.pending === i,
        b = BASES[it.baseId];
      const info = b
        ? `${RARITIES[it.rarity].name} · ${SLOT_NAMES[b.slot]} · `
        : isStackId(it.baseId)
          ? `x${it.qty ?? 1} · `
          : '';
      rows.push(`<div class="srow">${icon(it)}<div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>
        <small>${info}<span class="tip-sell">${sellValue(it)} ${L('ouro', 'gold')}${stack ? ` ${L('(cada)', '(each)')}` : ''}</span></small></div>
        <div class="sbtns"><button class="${conf ? 'danger' : ''}" data-a="sell" data-v="${i}">${conf ? L('Confirmar?', 'Confirm?') : stack ? L('Vender 1', 'Sell 1') : L('Vender', 'Sell')}</button>
        ${stack ? `<button data-a="sellall" data-v="${i}">${L('Tudo', 'All')}</button>` : ''}</div></div>`);
    });
    const f = (k: SellFilter, label: string) =>
      `<button class="${this.sellFilter === k ? 'on' : ''}" data-a="sfilter" data-v="${k}">${label} <small>${count[k]}</small></button>`;
    const filters = `<div class="sfilters">${f('all', L('Tudo', 'All'))}${f('equip', L('Equip.', 'Gear'))}${f('pot', L('Consum.', 'Consum.'))}${f('mat', L('Materiais', 'Materials'))}</div>`;
    const junk = this.junk(),
      junkGold = junk.reduce((a, i) => a + sellValue(w.bag[i]!), 0);
    const foot =
      junk.length && (this.sellFilter === 'all' || this.sellFilter === 'equip')
        ? `<button class="${this.sellJunkAsk ? 'danger' : ''}" data-a="selljunk">${this.sellJunkAsk ? L(`Confirmar: vender ${junk.length} comuns?`, `Confirm: sell ${junk.length} common?`) : L(`Vender equipamentos comuns (${junk.length} · ${junkGold} ouro)`, `Sell common gear (${junk.length} · ${junkGold} gold)`)}</button>`
        : undefined;
    return {
      wide: true,
      top: `<div class="npc-bar">${tabs}${filters}</div>`,
      list: rows.length
        ? `<div class="srows">${rows.join('')}</div>`
        : `<p class="muted">${count.all ? L('Nada nesta categoria.', 'Nothing in this category.') : L('A mochila está vazia.', 'The bag is empty.')}</p>`,
      foot,
    };
  }
}
