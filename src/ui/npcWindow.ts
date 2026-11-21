import { actionErrorText } from './actionError';
import type { ActionError } from '../core/types';
import { L, tn } from '../core/i18n';
import { CLASSES, NPC_TEXT, PROGRESSION, SKINS } from '../core/data';
import { ATTR_KEYS } from '../core/types';
import { ATTR_LABELS } from './labels';
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
import type { ItemOwner } from '../core/items';
import type { ItemInstance } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { MASTER_PORTRAITS, PORTRAITS } from '../render/sprites';
import { npcName, rewardText } from './questTracker';
import { renderPanel, resetScroll } from './panelRender';
import { spinHtml } from './spinView';
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
import { teleportBlock, teleportCost, teleportDestsFrom } from '../core/teleport';
import { mapLevels } from '../core/worldRoutes';

/** Partes de uma janela de NPC: `top` fica fixo (abas, quantidade, filtros), `list` e `side` rolam cada um por si
 *  (lado a lado em tela larga, um embaixo do outro em tela estreita) e `foot` fica fixo embaixo. */
type View = { top?: string; list: string; side?: string; foot?: string; wide?: boolean };
type SellFilter = 'all' | 'equip' | 'pot' | 'mat';
const sellCat = (it: ItemInstance): Exclude<SellFilter, 'all'> =>
  POTIONS[it.baseId] || CONSUMABLES[it.baseId] ? 'pot' : MATERIALS[it.baseId] ? 'mat' : 'equip';
/** ícone do item no mesmo estilo da mochila */
const icon = (it: ItemInstance, owner?: ItemOwner) =>
  `<span class="cell mini" style="${cellStyle(it)}">${cellHtml(it, owner)}</span>`;

// Janela dos NPCs (abre sozinha quando o personagem chega). Não bloqueia o jogo ao redor.
export class NpcWindow {
  private sig = '';
  private tab: 'buy' | 'sell' = 'buy';
  private smithTab: 'repair' | 'forge' | 'salvage' = 'repair';
  private forgeSel = ''; // item escolhido na forja: "eq:<slot>" ou "bag:<índice>"
  private salvageAsk = false; // desmontar aguardando confirmação
  private resetAsk = false; // realinhar meridianos aguardando confirmação
  private skinAsk = ''; // traje aguardando confirmação da compra
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
    if (a === 'travel') {
      const err = w.travelTo(v);
      if (err) this.toast(actionErrorText(err), '#ff8a80');
      else audio.ui('ui_click');
      return;
    }
    if (a === 'mreset') {
      if (!this.resetAsk) {
        audio.ui('ui_click');
        this.resetAsk = true;
        return;
      }
      this.resetAsk = false;
      const err = w.resetAttributes();
      if (err) this.toast(actionErrorText(err), '#ff8a80');
      else
        this.toast(
          L(
            `Meridianos realinhados: ${w.freePoints} pontos livres (Atributos, tecla C)`,
            `Meridians realigned: ${w.freePoints} free points (Attributes, C key)`,
          ),
          '#9be7c4',
        );
      return;
    }
    if (a === 'skinbuy') {
      if (this.skinAsk !== v) {
        audio.ui('ui_click');
        this.skinAsk = v;
        return;
      }
      this.skinAsk = '';
      const err = w.buySkin(v);
      if (err) this.toast(actionErrorText(err), '#ff8a80');
      else this.toast(L(`Traje vestido: ${SKINS[v].name}`, `Outfit equipped: ${SKINS[v].name}`), '#ffd23f');
      return;
    }
    if (a === 'skinwear') {
      audio.ui('ui_click');
      this.skinAsk = '';
      w.wearSkin(v || null);
      return;
    }
    if (a === 'mcancel') {
      audio.ui('ui_click');
      this.resetAsk = false;
      return;
    }
    if (a === 'qaccept') {
      audio.ui('quest_accept');
      w.questAccept();
      return;
    }
    if (a === 'qturn') {
      audio.ui('quest_turnin');
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
      this.smithTab = v as 'repair' | 'forge' | 'salvage';
      this.forgeSel = '';
      this.salvageAsk = false;
      this.showSide = false;
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
          audio.ui('salvage');
          this.toast(L('Item desmontado: materiais na mochila', 'Item salvaged: materials in your bag'), '#c9b8a0');
          this.forgeSel = '';
        }
      } else {
        err = v === 'upgrade' ? w.forgeUpgrade(it) : v === 'rarity' ? w.forgeRarity(it) : w.forgeReroll(it);
        if (!err && v === 'upgrade') {
          const ok = (it.plus ?? 0) > before;
          audio.ui(ok ? 'forge_ok' : 'forge_fail');
          this.toast(
            ok
              ? L(`Sucesso! ${itemName(it)}`, `Success! ${itemName(it)}`)
              : L('A forja falhou: os materiais se perderam', 'The forging failed: the materials were lost'),
            ok ? '#6fdc6f' : '#ff8a80',
          );
        } else if (!err) {
          audio.ui('forge_ok');
          this.toast(L(`Pronto: ${itemName(it)}`, `Done: ${itemName(it)}`), RARITIES[it.rarity].color);
        }
      }
    } else if (a === 'moffer') {
      err = w.merchantBuy(+v);
      if (!err) audio.ui('coin');
    } else if (a === 'mgoods') {
      err = w.merchantBuyGoods(v, this.qty);
      if (!err) audio.ui('coin');
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
      this.resetAsk = false;
      this.skinAsk = '';
      this.pending = -1;
      this.sig = '';
      this.line = 0;
      this.sellFilter = 'all';
      this.sellJunkAsk = false;
    }
    const refreshMin = Math.ceil(merchantRefreshIn(w.clock()) / 60_000);
    const sig = `${n.id}|${this.tab}|${this.qty}|${this.pending}|${this.line}|${w.invVersion}|${w.quest.stage}|${w.quest.status}|${w.quest.progress}|${w.player.level}|${this.smithTab}|${this.forgeSel}|${this.salvageAsk}|${refreshMin}|${this.sellFilter}|${this.sellJunkAsk}|${w.gold}|${this.resetAsk}|${w.freePoints}|${this.skinAsk}|${w.skin}|${w.skinsOwned.length}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    this.sig = sig;
    el.classList.remove('hidden');
    // role = função (loja, viagem, mestre); who = o personagem (falas e missões). Na vila são iguais; na Cidadela,
    // a Mestra Ferreira Lin tem o papel 'ferreiro' (prop role no mapa).
    const role = w.npcRole(n),
      who = n.npcId;
    const shop =
      role === 'ferreiro' ||
      role === 'vendedor' ||
      role === 'mercador' ||
      role === 'caminhos' ||
      role === 'meridianos' ||
      role === 'governador';
    let view: View,
      sub = '';
    if (role === 'ferreiro') {
      const v =
        this.smithTab === 'forge' ? this.forge() : this.smithTab === 'salvage' ? this.salvageView() : this.smith();
      view = { ...v, top: this.smithTabs() + (v.top ?? '') };
    } else if (role === 'vendedor') view = this.shop();
    else if (role === 'mercador') view = this.merchant(who);
    else if (role === 'caminhos') view = this.travel(who);
    else if (role === 'meridianos') view = { list: this.talk(who) + this.meridians() };
    else if (role === 'governador') view = { list: this.talk(who) + this.skinShop() };
    else if (role.startsWith('mestre_')) {
      const m = this.master(role.slice(7));
      view = { list: m.body };
      sub = m.sub;
    } else view = { list: this.talk(who) };
    // ferreiro e vendedor com falas próprias (Cidadela): a primeira fala no alto da lista
    const intro = (role === 'ferreiro' || role === 'vendedor') && who !== role ? NPC_TEXT.npcs[who]?.lines[0] : '';
    if (intro) view = { ...view, list: `<p class="lore">“${escapeHtml(intro)}”</p>${view.list}` };
    const quest = this.questBox(who);
    const gold = shop ? `<span class="gold">${w.gold} ${L('ouro', 'gold')}</span>` : '';
    // renderPanel mantém os elementos (e a rolagem de cada coluna) entre atualizações; trocar de NPC, aba ou filtro
    // volta ao topo.
    const key = `${n.id}|${role}|${this.tab}|${this.smithTab}|${this.sellFilter}`;
    const same = key === this.viewKey;
    this.viewKey = key;
    renderPanel(
      el,
      `<div class="card npc-card${view.wide ? ' npc-wide' : ''}${view.side ? ' npc-split' : ''}"><div class="npc-top"><div class="npc-head"><h2>${escapeHtml(tn(n.name))}${sub}</h2>${gold}<button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div>${view.top ?? ''}</div>
      <div class="npc-cols"><div class="npc-list">${quest}${view.list}</div>${view.side ? `<div class="npc-side">${view.side}</div>` : ''}</div>
      ${view.foot ? `<div class="npc-foot">${view.foot}</div>` : ''}</div>`,
    );
    const card = el.querySelector('.npc-card') as HTMLElement;
    if (!same) resetScroll(el);
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

  /** Monge do Pagode: pontos distribuídos em cada atributo e o botão de devolvê-los (com confirmação). */
  private meridians(): string {
    const w = this.world,
      spent = w.spentPoints(),
      cost = PROGRESSION.attrResetCost;
    const total = ATTR_KEYS.reduce((n, k) => n + spent[k], 0);
    const rows = ATTR_KEYS.filter((k) => spent[k] > 0)
      .map((k) => `<div><span>${ATTR_LABELS[k]}</span><b>${spent[k]} ${L('pts', 'pts')}</b></div>`)
      .join('');
    const costTxt = cost.toLocaleString('pt-BR');
    const why = !total
      ? L('Você ainda não distribuiu nenhum ponto.', 'You have not distributed any points yet.')
      : w.gold < cost
        ? L(
            `Faltam ${(cost - w.gold).toLocaleString('pt-BR')} de ouro.`,
            `You need ${(cost - w.gold).toLocaleString('pt-BR')} more gold.`,
          )
        : '';
    const btn = this.resetAsk
      ? `<div class="mr-ask"><button class="danger" data-a="mreset">${L(`Confirmar (${costTxt} ouro)`, `Confirm (${costTxt} gold)`)}</button><button data-a="mcancel">${L('Cancelar', 'Cancel')}</button></div>`
      : `<button class="primary" data-a="mreset" ${why ? 'disabled' : ''}>${L(`Realinhar (${costTxt} ouro)`, `Realign (${costTxt} gold)`)}</button>`;
    return `<h4>${L('Realinhar meridianos', 'Realign meridians')}</h4>
      <div class="dg-row mr-box">
        <div class="dg-info">${L(
          'Devolve todos os pontos que você distribuiu. Os atributos da seita e os ganhos de nível ficam. Depois, redistribua no painel de Atributos (tecla C).',
          'Returns every point you distributed. Sect attributes and level gains stay. Then redistribute them in the Attributes panel (C key).',
        )}</div>
        ${rows ? `<div class="mr-list">${rows}</div>` : ''}
        <div class="mr-list mr-total"><div><span>${L('Pontos devolvidos', 'Points returned')}</span><b>${total}</b></div>
          <div><span>${L('Pontos livres depois', 'Free points after')}</span><b>${w.freePoints + total}</b></div>
          <div><span>${L('Custo', 'Cost')}</span><b class="gold">${costTxt} ${L('ouro', 'gold')}</b></div></div>
        ${btn}
        ${why ? `<small class="muted">${why}</small>` : ''}
      </div>`;
  }

  /** Governador Bai: trajes (skins) da seita do jogador; compra com confirmação, vestir e voltar ao traje da seita. */
  private skinShop(): string {
    const w = this.world,
      sect = CLASSES[w.classId]?.name ?? w.classId;
    const row = (id: string | null) => {
      const s = id ? SKINS[id] : null,
        owned = !id || w.skinsOwned.includes(id),
        worn = (id ?? null) === w.skin,
        pic = PORTRAITS[id ?? w.classId],
        price = s ? s.price.toLocaleString('pt-BR') : '';
      let btn: string;
      if (worn) btn = `<button disabled>${L('Vestindo', 'Wearing')}</button>`;
      else if (owned)
        btn = `<button class="primary" data-a="skinwear" data-v="${id ?? ''}">${L('Vestir', 'Wear')}</button>`;
      else if (this.skinAsk === id)
        btn = `<div class="mr-ask"><button class="danger" data-a="skinbuy" data-v="${id}">${L(`Confirmar (${price} ouro)`, `Confirm (${price} gold)`)}</button><button data-a="skinwear" data-v="${w.skin ?? ''}">${L('Cancelar', 'Cancel')}</button></div>`;
      else
        btn = `<button class="primary" data-a="skinbuy" data-v="${id}" ${w.gold < s!.price ? 'disabled' : ''}>${L(`Comprar (${price} ouro)`, `Buy (${price} gold)`)}</button>`;
      const why =
        s && !owned && w.gold < s.price
          ? `<small class="muted">${L(`Faltam ${(s.price - w.gold).toLocaleString('pt-BR')} de ouro.`, `You need ${(s.price - w.gold).toLocaleString('pt-BR')} more gold.`)}</small>`
          : '';
      const key = id ?? w.classId;
      return `<div class="dg-row sk-row">${pic ? spinHtml(key, `<img class="sk-pic" src="${pic}" alt="">`, 'sk-spin') : ''}<div class="sk-body">
        <b>${escapeHtml(s ? s.name : L(`Traje da ${sect}`, `${sect} outfit`))}</b>
        <div class="dg-info">${escapeHtml(s ? s.desc : L('O traje com que você entrou na seita.', 'The outfit you joined the sect with.'))}</div>
        ${btn}${why}</div></div>`;
    };
    const mine = Object.keys(SKINS).filter((id) => SKINS[id].sect === w.classId);
    return `<h4>${L('Trajes da seita', 'Sect outfits')}</h4>
      <small class="muted">${L(`Só mudam a aparência. Cada traje é de uma seita: aqui, apenas os da ${sect}.`, `Appearance only. Each outfit belongs to one sect: here, only ${sect} ones.`)}</small>
      ${row(null)}${mine.map(row).join('')}
      ${mine.length ? '' : `<p class="muted">${L('Ainda não há trajes para a sua seita.', 'No outfits for your sect yet.')}</p>`}`;
  }

  /** Mestre dos Caminhos: destinos do teleporte (src/core/teleport.ts) agrupados por região, com o motivo do bloqueio. */
  private travel(role: string): View {
    const w = this.world;
    const line = NPC_TEXT.npcs[role]?.lines[0];
    const groups = new Map<string, string>();
    for (const d of teleportDestsFrom(w.mapId)) {
      const m = w.maps[d.map];
      if (!m) continue;
      const block = teleportBlock(d, w.player.level, w.gold),
        cost = teleportCost(d),
        lv = mapLevels(m),
        why =
          block?.code === 'needLevel'
            ? L(`Só a partir do nível ${block.level}`, `Requires level ${block.level}`)
            : block
              ? L('Ouro insuficiente', 'Not enough gold')
              : '';
      const row = `<div class="dg-row${block?.code === 'needLevel' ? ' locked' : ''}">
        <div class="dg-name"><b>${escapeHtml(m.name)}</b>${lv ? ` <small class="tag">${L(`Nv ${lv[0]}–${lv[1]}`, `Lv ${lv[0]}–${lv[1]}`)}</small>` : ''}</div>
        <button class="primary" data-a="travel" data-v="${d.map}" ${why ? 'disabled' : ''}>${cost ? L(`Viajar (${cost} ouro)`, `Travel (${cost} gold)`) : L('Viajar (grátis)', 'Travel (free)')}</button>
        ${why ? `<small class="muted">${why}</small>` : ''}
      </div>`;
      const region = L(d.region.pt, d.region.en);
      groups.set(region, (groups.get(region) ?? '') + row);
    }
    const list = [...groups].map(([region, rows]) => `<h4>${escapeHtml(region)}</h4>${rows}`).join('');
    return {
      list: `${line ? `<p class="lore">“${escapeHtml(line)}”</p>` : ''}<h3>${L('Viagem', 'Travel')}</h3>${list}`,
      foot: `<small class="muted">${L(
        'Só leva de uma cidade para fora. Para voltar de um mapa de caça, vá a pé ou use um Pergaminho de Retorno.',
        'Only takes you out of a town. To come back from a hunting map, walk or use a Return Scroll.',
      )}</small>`,
    };
  }

  private smithTabs(): string {
    const b = (t: string, label: string) =>
      `<button class="${this.smithTab === t ? 'on' : ''}" data-a="stab" data-v="${t}">${label}</button>`;
    return `<div class="tabs">${b('repair', L('Consertar', 'Repair'))}${b('forge', L('Forjar', 'Forge'))}${b('salvage', L('Desmontar', 'Salvage'))}</div>`;
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
        `<button class="fchip ${this.forgeSel === ref ? 'on' : ''}" data-a="fsel" data-v="${ref}" style="border-color:${itemColor(it)}">${icon(it, w.owner())}<span><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b>${ref.startsWith('eq:') ? `<small>${L('equipado', 'equipped')}</small>` : ''}</span></button>`,
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
      const up = upgradeCost(it, w.owner()),
        ra = rarityCost(it),
        re = rerollCost(it),
        plus = it.plus ?? 0;
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
          it.rarity === 'epico'
            ? L('Épico já é a maior raridade.', 'Epic is already the highest rarity.')
            : L('Já é Raro.', 'Already Rare.'),
        )}
        ${this.costRow(
          L('Trocar bônus', 'Reroll bonuses'),
          'reroll',
          re,
          L('Sorteia de novo todos os bônus.', 'Rerolls all bonuses.'),
          it.rarity === 'epico'
            ? L('Épico: bônus fixos da sua classe.', 'Epic: fixed bonuses for your class.')
            : L('Só itens Incomuns ou Raros têm bônus.', 'Only Uncommon or Rare items have bonuses.'),
        )}
<div class="tipbody ftip">${itemTipHtml(w, it, false)}</div>`;
    }
    return { top, list: `<div class="fpick">${pick.join('')}</div>`, side: detail, wide: true };
  }

  /** Aba Desmontar: só itens da mochila; escolhe um, vê os materiais que recebe e confirma. */
  private salvageView(): View {
    const w = this.world;
    const pick: string[] = [];
    w.bag.forEach((it, i) => {
      if (!it || !BASES[it.baseId] || it.rarity === 'epico') return; // Épico não se desmonta
      const ref = `bag:${i}`;
      pick.push(
        `<button class="fchip ${this.forgeSel === ref ? 'on' : ''}" data-a="fsel" data-v="${ref}" style="border-color:${itemColor(it)}">${icon(it)}<span><b style="color:${itemColor(it)}">${escapeHtml(itemName(it))}</b></span></button>`,
      );
    });
    const top = `<div class="npc-mats"><small class="muted">${L(
      'Transforma equipamentos da mochila em materiais de forja. Itens equipados não aparecem aqui.',
      'Turns equipment in your bag into forging materials. Equipped items are not listed here.',
    )}</small></div>`;
    if (!pick.length)
      return {
        top,
        list: `<p class="muted">${L('Nenhum equipamento na mochila para desmontar.', 'No equipment in your bag to salvage.')}</p>`,
      };
    const it = this.forgeItem();
    let detail = `<p class="muted">${L('Escolha um item para desmontar.', 'Choose an item to salvage.')}</p>`;
    if (it && this.forgeSel.startsWith('bag:')) {
      detail = `<div class="srow"><div class="si"><b>${L('Você recebe', 'You get')}</b><small>${this.matsHtml(salvageYield(it)).replace(/ <i>\([^)]*\)<\/i>/g, '')}</small>
          <small class="muted">${L('O item é destruído.', 'The item is destroyed.')}</small></div>
          <button class="${this.salvageAsk ? 'danger' : ''}" data-a="forge" data-v="salvage">${this.salvageAsk ? L('Confirmar?', 'Confirm?') : L('Desmontar', 'Salvage')}</button></div>
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
        cost = repairCost(it, w.owner()),
        f = Math.max(0, it.durability / max);
      rows.push(`<div class="srow">${icon(it, w.owner())}<div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b> <small>${where}</small>
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
      if (it.rarity === 'epico') {
        // Épico não se vende: aparece na lista, sem preço nem botão
        rows.push(`<div class="srow">${icon(it, w.owner())}<div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>
        <small>${info}<span class="muted">${L('Não pode ser vendido', 'Cannot be sold')}</span></small></div></div>`);
        return;
      }
      rows.push(`<div class="srow">${icon(it, w.owner())}<div class="si"><b style="color:${itemColor(it)}">${itemName(it)}</b>
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
