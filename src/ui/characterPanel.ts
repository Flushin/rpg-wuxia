// Janela Personagem (tecla C): equipados em volta do retrato (no meio) + atributos com origem (base, níveis,
// equipamento), gastar pontos livres, "Distribuir recomendado", derivados e elementos. A mochila (I) é só a bolsa.
// Não toca som de abrir/fechar nem decide quando abre: isso fica no Hud (togglePanel).
import { L } from '../core/i18n';
import { CLASSES, RELIC_RARITIES, RELIC_SLOT_NAME, RELICS } from '../core/data';
import { relicEffectText, relicPickHtml } from './relicShop';
import { ATTR_KEYS, ELEMENTS, type AttrKey } from '../core/types';
import type { World } from '../core/world';
import { ARENA_TITLES } from '../core/arena';
import { attrBreakdown } from '../core/stats';
import { audio } from '../render/audio';
import { ATTR_HINTS, ATTR_LABELS, ELEMENT_LABELS, closeX } from './labels';
import { renderPanel } from './panelRender';
import { byId, escapeHtml } from './dom';
import { PORTRAIT_ANIMS, PORTRAITS } from '../render/sprites';
import { spinHtml } from './spinView';
import { SLOT_NAMES } from '../core/items';
import type { Slot } from '../core/types';
import { slotIconHtml } from './icons';
import { cellHtml, cellStyle, itemTipHtml } from './itemTip';
import { bindItemTip } from './inventory';
import { actionErrorText } from './actionError';
import { isTouch } from '../platform/input';

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

export class CharacterPanel {
  /** Assinatura do que foi desenhado; vazio força redesenhar no próximo update. */
  private sig = '';
  /** Slot equipado selecionado (detalhe + Desequipar). */
  private sel: Slot | 'reliquia' | null = null;
  private last = { slot: '', t: 0 };
  /** aba aberta: personagem (equipamento/atributos) ou títulos */
  private tab: 'main' | 'titles' = 'main';

  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
    private onClose: () => void,
  ) {
    const el = byId('attrs-panel');
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    bindItemTip(world, el, (c) => (c.dataset.eq === 'reliquia' ? null : world.equipment[c.dataset.eq as Slot]));
    el.addEventListener('click', (e) => {
      if (e.target === el) return this.onClose();
      const t = (e.target as HTMLElement).closest(
        '[data-attr],[data-close],[data-dist],[data-eq],[data-unequip],[data-relic-eq],[data-tab],[data-title]',
      ) as HTMLElement | null;
      if (!t) {
        // toque fora de um equipado (e fora do detalhe): desfaz a seleção e o detalhe some
        if (this.sel && !(e.target as HTMLElement).closest('.ch-detail')) {
          this.sel = null;
          this.sig = '';
        }
        return;
      }
      if (t.dataset.tab) {
        audio.ui('ui_click');
        this.tab = t.dataset.tab === 'titles' ? 'titles' : 'main';
        this.sel = null;
        this.sig = '';
      } else if (t.dataset.title !== undefined) {
        // título: usar um dos que tem ('' = ficar sem título)
        audio.ui('ui_click');
        world.wearArenaTitle(t.dataset.title || null);
        this.sig = '';
      } else if (t.dataset.relicEq !== undefined) {
        // relíquia: equipar uma da coleção ou tirar a atual ('' = tirar)
        audio.ui('ui_click');
        const err = world.equipRelic(t.dataset.relicEq || null);
        if (err) this.toast(actionErrorText(err), '#ff8a80');
        this.sig = '';
      } else if (t.dataset.eq === 'reliquia') {
        this.sel = 'reliquia';
        this.sig = '';
        byId('item-tip').classList.add('hidden');
      } else if (t.dataset.eq) {
        const slot = t.dataset.eq as Slot,
          now = performance.now();
        const dbl = slot === this.last.slot && now - this.last.t < 400;
        this.last = { slot, t: now };
        this.sel = slot;
        this.sig = '';
        byId('item-tip').classList.add('hidden');
        if (dbl) this.unequip();
      } else if (t.dataset.unequip) this.unequip();
      else if (t.dataset.dist) {
        audio.ui('point_spent');
        world.distributeRecommended();
        this.sig = '';
      } else if (t.dataset.attr) {
        audio.ui('point_spent');
        world.spendPoint(t.dataset.attr as AttrKey);
        this.sig = '';
      } else this.onClose();
    });
  }

  get open() {
    return !byId('attrs-panel').classList.contains('hidden');
  }

  set(open: boolean) {
    byId('attrs-panel').classList.toggle('hidden', !open);
    byId('item-tip').classList.add('hidden');
    this.sig = '';
    if (!open) this.sel = null;
  }

  private unequip() {
    if (!this.sel || this.sel === 'reliquia' || !this.world.equipment[this.sel]) return;
    const err = this.world.unequip(this.sel);
    this.sig = '';
    if (err) this.toast(actionErrorText(err), '#ff8a80');
    else this.sel = null;
  }

  /** Chamado a cada quadro; só redesenha se o painel está aberto e algo mudou. */
  update() {
    if (!this.open) return;
    const w = this.world,
      p = w.player;
    const sig = JSON.stringify([
      p.attrs,
      w.gearStats(),
      w.freePoints,
      p.elemAtk,
      p.elemRes,
      p.level,
      w.invVersion,
      this.sel,
      this.tab,
      w.arena.title,
      w.relic,
      Math.floor(w.playTime.auto / 60),
      Math.floor(w.playTime.manual / 60),
    ]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.render();
  }

  private render() {
    const w = this.world,
      p = w.player,
      d = p.derived;
    const cls = CLASSES[w.classId];
    const parts = attrBreakdown(p.attrs, cls.baseAttributes, w.gearStats());
    const free = w.freePoints;
    const rows = ATTR_KEYS.map((k) => {
      const rec = cls.recommended?.find((r) => r.attr === k),
        opt = cls.optional?.find((r) => r.attr === k);
      const kind = rec ? 'rec' : opt ? 'opt' : '';
      const tag = rec
        ? `<span class="at-tag rec">★ ${L('Recomendado', 'Recommended')}</span>`
        : opt
          ? `<span class="at-tag opt">${L('Opcional', 'Optional')}</span>`
          : '';
      const why = rec ?? opt;
      const pt = parts[k];
      // origem do valor: só mostra o que soma (níveis/equipamento zerados somem)
      const src = [`${pt.base} ${L('base', 'base')}`];
      if (pt.levels) src.push(`+${pt.levels} ${L('nív.', 'lvl')}`);
      if (pt.equip) src.push(`${pt.equip > 0 ? '+' : ''}${pt.equip} ${L('equip.', 'gear')}`);
      return `<div class="at-row ${kind}">
        <div class="at-info"><div class="at-name">${ATTR_LABELS[k]}${tag}</div>
          <div class="at-hint">${ATTR_HINTS[k]}${why ? ` <span class="at-why">· ${escapeHtml(why.reason)}</span>` : ''}</div></div>
        <div class="at-val"><b>${pt.total}</b>${src.length > 1 ? `<span>${src.join(' ')}</span>` : ''}</div>
        ${free > 0 ? `<button class="at-plus" data-attr="${k}" aria-label="+1 ${ATTR_LABELS[k]}">+</button>` : ''}
      </div>`;
    }).join('');
    const der: [string, string][] = [
      [L('Vida máxima', 'Max health'), String(d.maxHp)],
      [L('Mana máxima', 'Max mana'), String(d.maxMana)],
      [L('Ataque físico', 'Physical attack'), String(d.physAtk)],
      [L('Ataque espiritual', 'Spiritual attack'), String(d.spiritAtk)],
      [L('Defesa física', 'Physical defense'), String(d.physDef)],
      [L('Defesa espiritual', 'Spiritual defense'), String(d.spiritDef)],
      [L('Precisão', 'Accuracy'), String(d.hit)],
      [L('Esquiva', 'Evasion'), String(d.evasion)],
      [L('Chance de crítico', 'Crit chance'), `${(d.critChance * 100).toFixed(1)}%`],
      [L('Dano crítico', 'Crit damage'), `${Math.round(d.critDamage * 100)}%`],
    ];
    // roubo de vida da seita (Tormenta): só aparece para quem tem
    const ls = (cls.lifeSteal ?? 0) + w.relicEffect('lifeSteal');
    if (ls) der.push([L('Roubo de vida', 'Life steal'), `${+(ls * 100).toFixed(1)}%`]);
    const relicDef = w.relic ? RELICS[w.relic] : undefined;
    if (relicDef && relicDef.effect.kind !== 'lifeSteal') der.push([L('Relíquia', 'Relic'), relicEffectText(relicDef)]);
    const fmtPlay = (s: number) => {
      const m = Math.floor(s / 60);
      return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
    };
    const pt = w.playTime;
    const playRows = [
      [L('Jogando (auto desligado)', 'Playing (auto off)'), fmtPlay(pt.manual)],
      [L('Com o auto ligado', 'With auto on'), fmtPlay(pt.auto)],
      [L('Total', 'Total'), fmtPlay(pt.manual + pt.auto)],
    ];
    const els = ELEMENTS.map(
      (e) =>
        `<div class="at-el el-${e}"><span>${ELEMENT_LABELS[e]}</span><b class="${p.elemAtk[e] ? '' : 'zero'}">${p.elemAtk[e]}</b><b class="${p.elemRes[e] ? '' : 'zero'}">${p.elemRes[e]}</b></div>`,
    ).join('');
    if (this.sel && this.sel !== 'reliquia' && !w.equipment[this.sel]) this.sel = null;
    const eqCell = (sl: Slot) => {
      const it = w.equipment[sl];
      return `<div class="eqs eqs-${sl}"><small>${SLOT_NAMES[sl]}</small><button class="cell ${this.sel === sl ? 'sel' : ''}" data-eq="${sl}" style="${cellStyle(it)}" aria-label="${SLOT_NAMES[sl]}" title="${SLOT_NAMES[sl]}">${it ? cellHtml(it, w.owner()) : `<span class="ic empty img">${slotIconHtml(sl, w.classId)}</span>`}</button></div>`;
    };
    const eq = `<div class="eq-col">${BODY_LEFT.map(eqCell).join('')}</div>${spinHtml(w.skin ?? w.classId, bodyFigure(w.skin ?? w.classId, cls.color ?? '#889'), 'body-spin')}<div class="eq-col">${BODY_RIGHT.map(eqCell).join('')}</div>`;
    // relíquia (Porto Noturno, etapa 4): espaço próprio abaixo do corpo; o detalhe mostra a coleção para trocar
    const rl = w.relic ? RELICS[w.relic] : undefined;
    const relicCell = `<div class="eqs eqs-reliquia"><small>${RELIC_SLOT_NAME}</small><button class="cell ${this.sel === 'reliquia' ? 'sel' : ''}" data-eq="reliquia" style="${rl ? `border-color:${RELIC_RARITIES[rl.rarity].color}` : ''}" aria-label="${RELIC_SLOT_NAME}" title="${RELIC_SLOT_NAME}"><span class="ic ${rl ? '' : 'empty'} rl-cell">${rl ? rl.icon : '🏮'}</span></button></div>`;
    const selIt = this.sel && this.sel !== 'reliquia' ? w.equipment[this.sel] : null;
    const detail =
      this.sel === 'reliquia'
        ? relicPickHtml(w)
        : selIt
          ? `<div class="tipbody">${itemTipHtml(w, selIt, false)}</div><button class="primary" data-unequip="1">${L('Desequipar', 'Unequip')}</button>`
          : `<div class="muted">${isTouch ? L('Toque em um equipado para ver os detalhes. Duplo toque desequipa.', 'Tap an equipped item to see details. Double tap unequips.') : L('Clique em um equipado para ver os detalhes. Duplo clique desequipa.', 'Click an equipped item to see details. Double-click unequips.')}</div>`;
    const tabs = `<div class="tabs ch-tabs"><button class="${this.tab === 'main' ? 'on' : ''}" data-tab="main">${L('Personagem', 'Character')}</button><button class="${this.tab === 'titles' ? 'on' : ''}" data-tab="titles">${L('Títulos', 'Titles')} <small>${w.arena.titles.length}</small></button></div>`;
    const head = `<div class="card at-card ch-card" style="--c:${cls.color}">${closeX('data-close="1"')}
      <h2>${L('Personagem', 'Character')}</h2>
      <div class="at-sub">${escapeHtml(p.name)} · ${escapeHtml(cls.name)} · ${L(`Nível ${p.level}`, `Level ${p.level}`)}</div>${tabs}`;
    if (this.tab === 'titles') return renderPanel(byId('attrs-panel'), `${head}${titlesHtml(w)}</div>`);
    renderPanel(
      byId('attrs-panel'),
      `${head}
      <div class="ch-top"><div class="ch-left"><div class="ch-gear"><div class="eq-body">${eq}</div><div class="eq-relic">${relicCell}</div><div class="inv-detail ch-detail">${detail}</div></div>
      <div class="ch-der"><h3 class="at-h">${L('Derivados', 'Derived stats')}</h3>
      <div class="at-der">${der.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <h3 class="at-h">${L('Tempo de jogo', 'Play time')}</h3>
      <div class="at-der">${playRows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></div></div>
      <div class="ch-right"><div class="ch-attrs"><div class="at-pts ${free > 0 ? 'has' : ''}"><span>${L('Pontos livres', 'Free points')}</span><b>${free}</b>
        ${free > 0 ? `<button class="at-dist" data-dist="1">${L('Distribuir recomendado', 'Distribute recommended')}</button>` : ''}</div>
      <div class="at-list">${rows}</div></div>
      <div class="ch-els"><h3 class="at-h">${L('Elementos', 'Elements')}</h3>
      <div class="at-els"><div class="at-el head"><span></span><i>${L('Ataque', 'Attack')}</i><i>${L('Resist.', 'Resist.')}</i></div>${els}</div></div></div></div></div>`,
    );
  }
}

/** Aba Títulos: os títulos que o jogador tem (arena e Fundador); ele escolhe qual usar ou fica sem nenhum. */
function titlesHtml(w: World): string {
  const cur = w.arena.title;
  const row = (id: string | null) => {
    const t = id ? ARENA_TITLES[id] : null;
    const on = cur === id;
    const name = t
      ? `<b style="color:${t.color}">«${escapeHtml(t.name)}»</b>`
      : `<b>${L('Sem título', 'No title')}</b>`;
    const from = t
      ? `<small class="muted">${t.exclusive ? L('Exclusivo dos Fundadores', 'Founders exclusive') : L('Arena do Porto Noturno', 'Night Harbor Arena')}</small>`
      : `<small class="muted">${L('Nada aparece acima do seu nome', 'Nothing shown above your name')}</small>`;
    const btn = on
      ? `<button disabled>${L('Em uso', 'In use')}</button>`
      : `<button class="primary" data-title="${id ?? ''}">${L('Usar', 'Use')}</button>`;
    return `<div class="ti-row${on ? ' on' : ''}"><div class="ti-body">${name}<br>${from}</div>${btn}</div>`;
  };
  const list = w.arena.titles.filter((id) => ARENA_TITLES[id]);
  return `<div class="ch-titles"><small class="muted">${L('O título aparece acima do seu nome. Só visual: não dá poder.', 'The title is shown above your name. Cosmetic only: no power.')}</small>
    ${list.map(row).join('')}${row(null)}
    ${list.length ? '' : `<p class="muted">${L('Você ainda não tem títulos. Eles são comprados na Arena do Porto Noturno.', 'You have no titles yet. They are bought at the Night Harbor Arena.')}</p>`}</div>`;
}
