import { PROGRESSION } from '../core/data';
import { ATTR_KEYS, ELEMENTS, type AttrKey } from '../core/types';
import type { World } from '../core/world';
import { ATTR_HINTS, ATTR_LABELS, ELEMENT_LABELS } from './labels';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export class Hud {
  private panelSig = '';
  private toastTimer = 0;
  constructor(private world: World) {
    $('hud').classList.remove('hidden');
    $('attrs-panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-attr],[data-close]') as HTMLElement | null;
      if (!t) return;
      if (t.dataset.attr) { world.spendPoint(t.dataset.attr as AttrKey); this.panelSig = ''; }
      else this.togglePanel(false);
    });
  }

  togglePanel(open?: boolean) {
    const p = $('attrs-panel');
    const show = open ?? p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    this.panelSig = '';
  }

  toast(msg: string) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 2500);
  }

  update() {
    const w = this.world, p = w.player, d = p.derived;
    $('p-name').textContent = p.name;
    $('p-level').textContent = `Nv ${p.level}`;
    $('p-hp').style.width = pct(p.hp, d.maxHp);
    $('p-hp-t').textContent = `${Math.ceil(p.hp)} / ${d.maxHp}`;
    $('p-mp').style.width = pct(p.mana, d.maxMana);
    $('p-mp-t').textContent = `${Math.floor(p.mana)} / ${d.maxMana}`;
    const need = w.xpToNext();
    $('p-xp').style.width = need === null ? '100%' : pct(w.xp, need);
    $('p-xp-t').textContent = need === null ? `Nível máximo (${PROGRESSION.levelCap})` : `XP ${Math.floor(w.xp)} / ${need}`;
    $('map-name').textContent = w.map.name;
    const badge = $('pts-badge');
    badge.textContent = w.freePoints > 0 ? String(w.freePoints) : '';
    badge.classList.toggle('hidden', w.freePoints <= 0);

    const t = w.getTarget(), tf = $('target-frame');
    tf.classList.toggle('hidden', !t);
    if (t) {
      $('t-name').textContent = t.name;
      $('t-level').textContent = `Nv ${t.level}`;
      $('t-hp').style.width = pct(t.hp, t.derived.maxHp);
      $('t-hp-t').textContent = `${Math.max(0, Math.ceil(t.hp))} / ${t.derived.maxHp}`;
    }
    if (!$('attrs-panel').classList.contains('hidden')) this.renderPanel();
  }

  private renderPanel() {
    const w = this.world, p = w.player, d = p.derived;
    const sig = JSON.stringify([p.attrs, w.freePoints, p.elemAtk, p.elemRes, p.level]);
    if (sig === this.panelSig) return;
    this.panelSig = sig;
    const rows = ATTR_KEYS.map((k) => `<tr><td>${ATTR_LABELS[k]}<small>${ATTR_HINTS[k]}</small></td><td class="num">${p.attrs[k]}</td>
      <td>${w.freePoints > 0 ? `<button data-attr="${k}">+</button>` : ''}</td></tr>`).join('');
    const der: [string, string][] = [
      ['Vida máxima', String(d.maxHp)], ['Mana máxima', String(d.maxMana)],
      ['Ataque físico', String(d.physAtk)], ['Ataque espiritual', String(d.spiritAtk)],
      ['Defesa física', String(d.physDef)], ['Defesa espiritual', String(d.spiritDef)],
      ['Precisão', String(d.hit)], ['Esquiva', String(d.evasion)],
      ['Chance de crítico', `${(d.critChance * 100).toFixed(1)}%`], ['Dano crítico', `${Math.round(d.critDamage * 100)}%`],
    ];
    const els = ELEMENTS.map((e) => `<tr><td>${ELEMENT_LABELS[e]}</td><td class="num">${p.elemAtk[e]}</td><td class="num">${p.elemRes[e]}</td></tr>`).join('');
    $('attrs-panel').innerHTML = `<div class="card"><h2>${p.name} - Nível ${p.level}</h2>
      <div class="pts">Pontos livres: <b>${w.freePoints}</b></div>
      <table>${rows}</table>
      <h3>Derivados</h3><table class="two">${der.map(([a, b]) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`).join('')}</table>
      <h3>Elementos</h3><table><tr><th></th><th>Ataque</th><th>Resist.</th></tr>${els}</table>
      <button class="primary" data-close="1">Fechar</button></div>`;
  }
}
