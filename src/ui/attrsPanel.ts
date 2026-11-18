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
    const rows = ATTR_KEYS.map((k) => {
      const rec = cls.recommended?.find((r) => r.attr === k),
        opt = cls.optional?.find((r) => r.attr === k);
      const badge = rec
        ? `<span class="badge rec">${L('Recomendado', 'Recommended')}</span>`
        : opt
          ? `<span class="badge opt">${L('Opcional', 'Optional')}</span>`
          : '';
      const why = rec ?? opt;
      return `<tr class="${rec ? 'rec' : opt ? 'opt' : ''}"><td><b>${ATTR_LABELS[k]}</b> ${badge}<small>${ATTR_HINTS[k]}</small>${why ? `<small class="why">${why.reason}</small>` : ''}</td><td class="num">${parts[k].total}<small class="parts">${parts[k].base} ${L('base', 'base')} + ${parts[k].levels} ${L('níveis', 'levels')} + ${parts[k].equip} ${L('equip.', 'equip.')}</small></td>
      <td class="plus">${w.freePoints > 0 ? `<button data-attr="${k}">+</button>` : ''}</td></tr>`;
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
        `<tr><td>${ELEMENT_LABELS[e]}</td><td class="num">${p.elemAtk[e]}</td><td class="num">${p.elemRes[e]}</td></tr>`,
    ).join('');
    byId('attrs-panel').innerHTML =
      `<div class="card">${closeX('data-close="1"')}<h2>${escapeHtml(p.name)} - ${L(`Nível ${p.level}`, `Level ${p.level}`)}</h2>
      <div class="pts">${L('Pontos livres', 'Free points')}: <b>${w.freePoints}</b></div>
      <table>${rows}</table>
      <button class="primary" data-dist="1" ${w.freePoints > 0 ? '' : 'disabled'}>${L('Distribuir recomendado', 'Distribute recommended')}</button>
      <h3>${L('Derivados', 'Derived stats')}</h3><table class="two">${der.map(([a, b]) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`).join('')}</table>
      <h3>${L('Elementos', 'Elements')}</h3><table><tr><th></th><th>${L('Ataque', 'Attack')}</th><th>${L('Resist.', 'Resist.')}</th></tr>${els}</table>
      <button class="primary" data-close="1">${L('Fechar', 'Close')}</button></div>`;
  }
}
