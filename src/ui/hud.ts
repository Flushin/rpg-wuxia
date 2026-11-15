import { L } from '../core/i18n';
import { PROGRESSION } from '../core/data';
import { ATTR_KEYS, ELEMENTS, type AttrKey } from '../core/types';
import type { World } from '../core/world';
import { CLASSES } from '../core/data';
import { attrBreakdown } from '../core/stats';
import { audio } from '../render/audio';
import { Hotbar } from './hotbar';
import { SkillsPanel } from './skillsPanel';
import { InventoryPanel } from './inventory';
import { NpcWindow } from './npcWindow';
import { AutoPanel, showOfflineReport } from './autoPanel';
import { Minimap } from './minimap';
import { isTouch } from './controls';
import type { OfflineReport } from '../core/world';
import { PotionBar } from './potions';
import { ATTR_HINTS, ATTR_LABELS, ELEMENT_LABELS, closeX } from './labels';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export class Hud {
  private panelSig = '';
  private toastTimer = 0;
  private toastLines: { msg: string; color?: string }[] = [];
  private hotbar: Hotbar;
  private skills: SkillsPanel;
  private inv: InventoryPanel;
  private npc: NpcWindow;
  private potions: PotionBar;
  private goldSig = -1;
  private autoPanel: AutoPanel;
  private autoSig = '';
  private minimap: Minimap;
  constructor(private world: World) {
    this.minimap = new Minimap(world);
    this.hotbar = new Hotbar(world);
    this.skills = new SkillsPanel(world, () => this.toggleSkills(false));
    this.inv = new InventoryPanel(world, (m, c) => this.toast(m, c), () => this.toggleInventory(false));
    this.npc = new NpcWindow(world, (m, c) => this.toast(m, c));
    this.potions = new PotionBar(world);
    this.autoPanel = new AutoPanel(world);
    for (const id of ['btn-auto', 'btn-auto-cfg']) $(id).addEventListener('focus', (e) => (e.target as HTMLElement).blur());
    $('btn-auto').addEventListener('click', () => { audio.ui('ui_click'); world.auto.toggle(); });
    $('btn-auto-cfg').addEventListener('click', () => this.autoPanel.set(!this.autoPanel.open));
    $('dur-warn').addEventListener('click', () => this.toggleInventory(true));
    $('hud').classList.remove('hidden');
    $('attrs-panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-attr],[data-close],[data-dist]') as HTMLElement | null;
      if (!t) return;
      if (t.dataset.dist) { audio.ui('point_spent'); world.distributeRecommended(); this.panelSig = ''; }
      else if (t.dataset.attr) { audio.ui('point_spent'); world.spendPoint(t.dataset.attr as AttrKey); this.panelSig = ''; }
      else this.togglePanel(false);
    });
  }

  togglePanel(open?: boolean) {
    const p = $('attrs-panel');
    const show = open ?? p.classList.contains('hidden');
    if (show !== !p.classList.contains('hidden')) audio.ui(show ? 'ui_open' : 'ui_close');
    p.classList.toggle('hidden', !show);
    this.panelSig = '';
  }

  toggleSkills(open?: boolean) {
    const show = open ?? !this.skills.open;
    if (show !== this.skills.open) audio.ui(show ? 'ui_open' : 'ui_close');
    this.skills.set(show);
  }

  toggleInventory(open?: boolean) {
    const show = open ?? !this.inv.open;
    if (show !== this.inv.open) audio.ui(show ? 'ui_open' : 'ui_close');
    this.inv.set(show);
  }

  toggleMap(open?: boolean) {
    const show = open ?? !this.minimap.open;
    if (show !== this.minimap.open) audio.ui(show ? 'ui_open' : 'ui_close');
    this.minimap.toggle(show);
  }

  closeAll() {
    this.toggleMap(false);
    this.togglePanel(false); this.toggleSkills(false); this.toggleInventory(false); this.autoPanel.set(false);
    this.world.closeNpc();
  }

  showOffline(rep: OfflineReport, onClose: () => void) { showOfflineReport(rep, onClose); }
  get offlineOpen() { return !$('offline-panel').classList.contains('hidden'); }

  toast(msg: string, color?: string) {
    const t = $('toast');
    const line = { msg, color };
    this.toastLines = t.classList.contains('show') ? [...this.toastLines.slice(-1), line] : [line];
    t.innerHTML = this.toastLines.map((l) => `<div${l.color ? ` style="color:${l.color}"` : ''}>${l.msg.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join(''); t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { t.classList.remove('show'); this.toastLines = []; }, 2800);
  }

  update() {
    this.minimap.update();
    const w = this.world, p = w.player, d = p.derived;
    $('p-name').textContent = p.name;
    $('p-level').textContent = L(`Nv ${p.level}`, `Lv ${p.level}`);
    $('p-hp').style.width = pct(p.hp, d.maxHp);
    $('p-hp-t').textContent = `${Math.ceil(p.hp)} / ${d.maxHp}`;
    $('p-mp').style.width = pct(p.mana, d.maxMana);
    $('p-mp-t').textContent = `${Math.floor(p.mana)} / ${d.maxMana}`;
    const need = w.xpToNext();
    $('p-xp').style.width = need === null ? '100%' : pct(w.xp, need);
    $('p-xp-t').textContent = need === null ? L(`Nível máximo (${PROGRESSION.levelCap})`, `Max level (${PROGRESSION.levelCap})`) : `XP ${Math.floor(w.xp)} / ${need}`;
    $('map-name').textContent = w.map.name;
    const badge = $('pts-badge');
    badge.textContent = w.freePoints > 0 ? String(w.freePoints) : '';
    badge.classList.toggle('hidden', w.freePoints <= 0);

    const boss = w.engagedBoss(), bb = $('boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      $('boss-name').textContent = L(`Nv ${boss.level} ${boss.name}`, `Lv ${boss.level} ${boss.name}`);
      $('boss-hp').style.width = pct(boss.hp, boss.derived.maxHp);
      $('boss-hp-t').textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.derived.maxHp}`;
    }
    const t = w.getTarget(), tf = $('target-frame');
    tf.classList.toggle('hidden', !t || t === boss);
    if (t) {
      $('t-name').textContent = t.name;
      $('t-level').textContent = L(`Nv ${t.level}`, `Lv ${t.level}`);
      $('t-hp').style.width = pct(t.hp, t.derived.maxHp);
      $('t-hp-t').textContent = `${Math.max(0, Math.ceil(t.hp))} / ${t.derived.maxHp}`;
    }
    if (!$('attrs-panel').classList.contains('hidden')) this.renderPanel();
    this.hotbar.update();
    this.skills.update();
    this.inv.update();
    this.npc.update();
    this.potions.update();
    $('dur-warn').classList.toggle('hidden', !w.lowDurability());
    const as = w.auto.state, sig = `${as}|${isTouch}`;
    if (sig !== this.autoSig) {
      this.autoSig = sig;
      const b = $('btn-auto');
      b.classList.toggle('on', as === 'on'); b.classList.toggle('paused', as === 'pausado');
      b.textContent = as === 'on' ? L('Auto ligado', 'Auto on') : as === 'pausado' ? L('Auto pausado', 'Auto paused') : isTouch ? 'Auto' : 'Auto (Z)';
    }
  }

  private renderPanel() {
    const w = this.world, p = w.player, d = p.derived;
    const sig = JSON.stringify([p.attrs, w.gearStats(), w.freePoints, p.elemAtk, p.elemRes, p.level]);
    if (sig === this.panelSig) return;
    this.panelSig = sig;
    const cls = CLASSES[w.classId];
    const parts = attrBreakdown(p.attrs, cls.baseAttributes, w.gearStats());
    const rows = ATTR_KEYS.map((k) => {
      const rec = cls.recommended?.find((r) => r.attr === k), opt = cls.optional?.find((r) => r.attr === k);
      const badge = rec ? `<span class="badge rec">${L('Recomendado', 'Recommended')}</span>` : opt ? `<span class="badge opt">${L('Opcional', 'Optional')}</span>` : '';
      const why = rec ?? opt;
      return `<tr class="${rec ? 'rec' : opt ? 'opt' : ''}"><td><b>${ATTR_LABELS[k]}</b> ${badge}<small>${ATTR_HINTS[k]}</small>${why ? `<small class="why">${why.reason}</small>` : ''}</td><td class="num">${parts[k].total}<small class="parts">${parts[k].base} ${L('base', 'base')} + ${parts[k].levels} ${L('níveis', 'levels')} + ${parts[k].equip} ${L('equip.', 'equip.')}</small></td>
      <td class="plus">${w.freePoints > 0 ? `<button data-attr="${k}">+</button>` : ''}</td></tr>`;
    }).join('');
    const der: [string, string][] = [
      [L('Vida máxima', 'Max health'), String(d.maxHp)], [L('Mana máxima', 'Max mana'), String(d.maxMana)],
      [L('Ataque físico', 'Physical attack'), String(d.physAtk)], [L('Ataque espiritual', 'Spiritual attack'), String(d.spiritAtk)],
      [L('Defesa física', 'Physical defense'), String(d.physDef)], [L('Defesa espiritual', 'Spiritual defense'), String(d.spiritDef)],
      [L('Precisão', 'Accuracy'), String(d.hit)], [L('Esquiva', 'Evasion'), String(d.evasion)],
      [L('Chance de crítico', 'Crit chance'), `${(d.critChance * 100).toFixed(1)}%`], [L('Dano crítico', 'Crit damage'), `${Math.round(d.critDamage * 100)}%`],
    ];
    const els = ELEMENTS.map((e) => `<tr><td>${ELEMENT_LABELS[e]}</td><td class="num">${p.elemAtk[e]}</td><td class="num">${p.elemRes[e]}</td></tr>`).join('');
    $('attrs-panel').innerHTML = `<div class="card">${closeX('data-close="1"')}<h2>${p.name} - ${L(`Nível ${p.level}`, `Level ${p.level}`)}</h2>
      <div class="pts">${L('Pontos livres', 'Free points')}: <b>${w.freePoints}</b></div>
      <table>${rows}</table>
      <button class="primary" data-dist="1" ${w.freePoints > 0 ? '' : 'disabled'}>${L('Distribuir recomendado', 'Distribute recommended')}</button>
      <h3>${L('Derivados', 'Derived stats')}</h3><table class="two">${der.map(([a, b]) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`).join('')}</table>
      <h3>${L('Elementos', 'Elements')}</h3><table><tr><th></th><th>${L('Ataque', 'Attack')}</th><th>${L('Resist.', 'Resist.')}</th></tr>${els}</table>
      <button class="primary" data-close="1">${L('Fechar', 'Close')}</button></div>`;
  }
}
