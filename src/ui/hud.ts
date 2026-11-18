import { L } from '../core/i18n';
import { PROGRESSION } from '../core/data';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { Hotbar } from './hotbar';
import { SkillsPanel } from './skillsPanel';
import { InventoryPanel } from './inventory';
import { NpcWindow } from './npcWindow';
import { AutoPanel, showOfflineReport } from './autoPanel';
import { Minimap } from './minimap';
import { isTouch } from '../platform/input';
import type { OfflineReport } from '../core/world';
import { PotionBar } from './potions';
import { Rewards } from './rewards';
import { QuestTracker } from './questTracker';
import { AttrsPanel } from './attrsPanel';
import { byId } from './dom';

const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export class Hud {
  private toastTimer = 0;
  private toastLines: { msg: string; color?: string }[] = [];
  private attrs: AttrsPanel;
  private hotbar: Hotbar;
  private skills: SkillsPanel;
  private inv: InventoryPanel;
  private npc: NpcWindow;
  private potions: PotionBar;
  private goldSig = -1;
  private autoPanel: AutoPanel;
  private autoSig = '';
  private minimap: Minimap;
  readonly rewards = new Rewards();
  private questTracker = new QuestTracker();
  constructor(private world: World) {
    this.minimap = new Minimap(world);
    this.attrs = new AttrsPanel(world, () => this.togglePanel(false));
    this.hotbar = new Hotbar(world);
    this.skills = new SkillsPanel(world, () => this.toggleSkills(false));
    this.inv = new InventoryPanel(
      world,
      (m, c) => this.toast(m, c),
      () => this.toggleInventory(false),
    );
    this.npc = new NpcWindow(world, (m, c) => this.toast(m, c));
    this.potions = new PotionBar(world);
    this.autoPanel = new AutoPanel(world);
    for (const id of ['btn-auto', 'btn-auto-cfg'])
      byId(id).addEventListener('focus', (e) => (e.target as HTMLElement).blur());
    byId('btn-auto').addEventListener('click', () => {
      audio.ui('ui_click');
      world.auto.toggle();
    });
    byId('btn-auto-cfg').addEventListener('click', () => this.autoPanel.set(!this.autoPanel.open));
    byId('dur-warn').addEventListener('click', () => this.toggleInventory(true));
    byId('hud').classList.remove('hidden');
  }

  togglePanel(open?: boolean) {
    const show = open ?? !this.attrs.open;
    if (show !== this.attrs.open) audio.ui(show ? 'ui_open' : 'ui_close');
    this.attrs.set(show);
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
    this.togglePanel(false);
    this.toggleSkills(false);
    this.toggleInventory(false);
    this.autoPanel.set(false);
    this.world.closeNpc();
  }

  showOffline(rep: OfflineReport, onClose: () => void) {
    showOfflineReport(rep, onClose);
  }
  get offlineOpen() {
    return !byId('offline-panel').classList.contains('hidden');
  }

  toast(msg: string, color?: string) {
    const t = byId('toast');
    const line = { msg, color };
    this.toastLines = t.classList.contains('show') ? [...this.toastLines.slice(-1), line] : [line];
    t.innerHTML = this.toastLines
      .map(
        (l) =>
          `<div${l.color ? ` style="color:${l.color}"` : ''}>${l.msg.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`,
      )
      .join('');
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      t.classList.remove('show');
      this.toastLines = [];
    }, 2800);
  }

  update() {
    this.minimap.update();
    const w = this.world,
      p = w.player,
      d = p.derived;
    byId('p-name').textContent = p.name;
    byId('p-level').textContent = L(`Nv ${p.level}`, `Lv ${p.level}`);
    byId('p-hp').style.width = pct(p.hp, d.maxHp);
    byId('p-hp-t').textContent = `${Math.ceil(p.hp)} / ${d.maxHp}`;
    byId('p-mp').style.width = pct(p.mana, d.maxMana);
    byId('p-mp-t').textContent = `${Math.floor(p.mana)} / ${d.maxMana}`;
    const need = w.xpToNext();
    byId('p-xp').style.width = need === null ? '100%' : pct(w.xp, need);
    byId('p-xp-t').textContent =
      need === null
        ? L(`Nível máximo (${PROGRESSION.levelCap})`, `Max level (${PROGRESSION.levelCap})`)
        : `XP ${Math.floor(w.xp)} / ${need}`;
    byId('map-name').textContent = w.map.name;
    if (w.gold !== this.goldSig) {
      this.goldSig = w.gold;
      byId('p-gold').textContent = String(w.gold);
    }
    this.rewards.update();
    this.questTracker.update(this.world);
    const badge = byId('pts-badge');
    badge.textContent = w.freePoints > 0 ? String(w.freePoints) : '';
    badge.classList.toggle('hidden', w.freePoints <= 0);

    const boss = w.engagedBoss(),
      bb = byId('boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      byId('boss-name').textContent = L(`Nv ${boss.level} ${boss.name}`, `Lv ${boss.level} ${boss.name}`);
      byId('boss-hp').style.width = pct(boss.hp, boss.derived.maxHp);
      byId('boss-hp-t').textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.derived.maxHp}`;
    }
    const t = w.getTarget(),
      tf = byId('target-frame');
    tf.classList.toggle('hidden', !t || t === boss);
    if (t) {
      byId('t-name').textContent = t.name;
      byId('t-level').textContent = L(`Nv ${t.level}`, `Lv ${t.level}`);
      byId('t-hp').style.width = pct(t.hp, t.derived.maxHp);
      byId('t-hp-t').textContent = `${Math.max(0, Math.ceil(t.hp))} / ${t.derived.maxHp}`;
    }
    this.attrs.update();
    this.hotbar.update();
    this.skills.update();
    this.inv.update();
    this.npc.update();
    this.potions.update();
    byId('dur-warn').classList.toggle('hidden', !w.lowDurability());
    const as = w.auto.state,
      sig = `${as}|${isTouch}`;
    if (sig !== this.autoSig) {
      this.autoSig = sig;
      const b = byId('btn-auto');
      b.classList.toggle('on', as === 'on');
      b.classList.toggle('paused', as === 'pausado');
      b.textContent =
        as === 'on'
          ? L('Auto ligado', 'Auto on')
          : as === 'pausado'
            ? L('Auto pausado', 'Auto paused')
            : isTouch
              ? 'Auto'
              : 'Auto (Z)';
    }
  }
}
