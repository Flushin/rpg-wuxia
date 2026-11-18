// Painel de Atributos (tecla C / botão do personagem): atributos com origem (base, níveis, equipamento),
// gastar pontos livres, "Distribuir recomendado", derivados e elementos.
// Não toca som de abrir/fechar nem decide quando abre: isso fica no Hud (togglePanel).
import { L } from '../core/i18n';
import { CLASSES } from '../core/data';
import { ATTR_KEYS, ELEMENTS, type AttrKey } from '../core/types';
import type { World } from '../core/world';
import { attrBreakdown } from '../core/stats';
import { audio } from '../render/audio';
import { ATTR_HINTS, ATTR_LABELS, ELEMENT_LABELS, closeX } from './labels';
import { byId, escapeHtml } from './dom';

export class AttrsPanel {
  /** Assinatura do que foi desenhado; vazio força redesenhar no próximo update. */
  private sig = '';

  constructor(
    private world: World,
    private onClose: () => void,
  ) {
    byId('attrs-panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-attr],[data-close],[data-dist]') as HTMLElement | null;
      if (!t) return;
      if (t.dataset.dist) {
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
    this.sig = '';
  }

  /** Chamado a cada quadro; só redesenha se o painel está aberto e algo mudou. */
  update() {
    if (!this.open) return;
    const w = this.world,
      p = w.player;
    const sig = JSON.stringify([p.attrs, w.gearStats(), w.freePoints, p.elemAtk, p.elemRes, p.level]);
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
    const els = ELEMENTS.map(
      (e) =>
        `<div class="at-el el-${e}"><span>${ELEMENT_LABELS[e]}</span><b class="${p.elemAtk[e] ? '' : 'zero'}">${p.elemAtk[e]}</b><b class="${p.elemRes[e] ? '' : 'zero'}">${p.elemRes[e]}</b></div>`,
    ).join('');
    byId('attrs-panel').innerHTML = `<div class="card at-card" style="--c:${cls.color}">${closeX('data-close="1"')}
      <h2>${escapeHtml(p.name)}</h2>
      <div class="at-sub">${escapeHtml(cls.name)} · ${L(`Nível ${p.level}`, `Level ${p.level}`)}</div>
      <div class="at-pts ${free > 0 ? 'has' : ''}"><span>${L('Pontos livres', 'Free points')}</span><b>${free}</b>
        ${free > 0 ? `<button class="at-dist" data-dist="1">${L('Distribuir recomendado', 'Distribute recommended')}</button>` : ''}</div>
      <div class="at-list">${rows}</div>
      <h3 class="at-h">${L('Derivados', 'Derived stats')}</h3>
      <div class="at-der">${der.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <h3 class="at-h">${L('Elementos', 'Elements')}</h3>
      <div class="at-els"><div class="at-el head"><span></span><i>${L('Ataque', 'Attack')}</i><i>${L('Resist.', 'Resist.')}</i></div>${els}</div></div>`;
  }
}
