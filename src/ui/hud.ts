import { actionErrorText } from './actionError';
import { L } from '../core/i18n';
import { PROGRESSION } from '../core/data';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { Hotbar } from './hotbar';
import { SkillsPanel } from './skillsPanel';
import { InventoryPanel } from './inventory';
import { NpcWindow } from './npcWindow';
import { DungeonWindow } from './dungeonWindow';
import { TrialWindow } from './trialWindow';
import { AutoPanel, showOfflineReport } from './autoPanel';
import { Minimap } from './minimap';
import { isTouch } from '../platform/input';
import { BuffRow } from './buffRow';
import type { OfflineReport } from '../core/world';
import { PotionBar } from './potions';
import { Rewards } from './rewards';
import { QuestTracker } from './questTracker';
import { CharacterPanel } from './characterPanel';
import { byId, setStyle, setText } from './dom';
import { applyHudLayout, updateHudMenu } from './hudLayout';

const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export class Hud {
  private toastTimer = 0;
  private toastLines: { msg: string; color?: string }[] = [];
  private attrs: CharacterPanel;
  private hotbar: Hotbar;
  private skills: SkillsPanel;
  private inv: InventoryPanel;
  private npc: NpcWindow;
  private dungeon: DungeonWindow;
  private trial: TrialWindow;
  private potions: PotionBar;
  private goldSig = -1;
  private autoPanel: AutoPanel;
  private autoSig = '';
  private mountSig = '';
  private tBuffs?: BuffRow;
  private minimap: Minimap;
  readonly rewards = new Rewards();
  private questTracker = new QuestTracker();
  constructor(private world: World) {
    applyHudLayout(); // antes da Hotbar: o arco das skills depende do layout (novo/clássico)
    this.minimap = new Minimap(world);
    this.attrs = new CharacterPanel(
      world,
      (m, c) => this.toast(m, c),
      () => this.togglePanel(false),
    );
    this.hotbar = new Hotbar(world);
    this.skills = new SkillsPanel(world, () => this.toggleSkills(false));
    this.inv = new InventoryPanel(
      world,
      (m, c) => this.toast(m, c),
      () => this.toggleInventory(false),
    );
    this.npc = new NpcWindow(world, (m, c) => this.toast(m, c));
    this.dungeon = new DungeonWindow(world, (m, c) => this.toast(m, c));
    this.trial = new TrialWindow(world, (m, c) => this.toast(m, c));
    this.potions = new PotionBar(world);
    this.autoPanel = new AutoPanel(world);
    for (const id of ['btn-mount', 'btn-auto', 'btn-auto-cfg'])
      byId(id).addEventListener('focus', (e) => (e.target as HTMLElement).blur());
    byId('btn-auto').addEventListener('click', () => {
      audio.ui('ui_click');
      world.auto.toggle();
    });
    byId('btn-auto-cfg').addEventListener('click', () => this.autoPanel.set(!this.autoPanel.open));
    byId('btn-mount').addEventListener('click', () => this.toggleMount());
    byId('dur-warn').addEventListener('click', () => this.togglePanel(true));
    byId('hud').classList.remove('hidden');
  }

  /** Montar/desmontar (botão 🐎 ao lado do Auto, tecla H). */
  toggleMount() {
    audio.ui('ui_click');
    const err = this.world.toggleMount();
    if (err) this.toast(actionErrorText(err), '#ff8a80');
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

  /** Fecha as janelas do HUD. Devolve true se havia alguma aberta. */
  closeAll(): boolean {
    const wasOpen =
      this.minimap.open ||
      this.attrs.open ||
      this.skills.open ||
      this.inv.open ||
      this.autoPanel.open ||
      !!this.world.openNpc ||
      this.world.dungeonMenu ||
      this.world.trialMenu;
    this.toggleMap(false);
    this.togglePanel(false);
    this.toggleSkills(false);
    this.toggleInventory(false);
    this.autoPanel.set(false);
    this.world.closeNpc();
    this.world.dungeonMenu = false;
    this.world.trialMenu = false;
    return wasOpen;
  }

  showOffline(rep: OfflineReport, onClose: () => void) {
    showOfflineReport(rep, onClose);
  }
  get offlineOpen() {
    return !byId('offline-panel').classList.contains('hidden');
  }

  /** Aviso no centro; 'epic' = maior, com borda roxa (drop de Épico). */
  toast(msg: string, color?: string, kind?: 'epic') {
    const t = byId('toast');
    t.classList.toggle('epic', kind === 'epic');
    const line = { msg, color };
    const shown = t.classList.contains('show');
    // mesma mensagem já na tela (ex.: vários drops com a aba cheia): não repete a linha, só renova o tempo
    if (shown && this.toastLines.some((l) => l.msg === msg))
      this.toastLines = this.toastLines.filter((l) => l.msg !== msg);
    this.toastLines = shown ? [...this.toastLines.slice(-1), line] : [line];
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
    setText(byId('p-name'), p.name);
    setText(byId('p-level'), L(`Nv ${p.level}`, `Lv ${p.level}`));
    setStyle(byId('p-hp'), 'width', pct(p.hp, d.maxHp));
    setText(byId('p-hp-t'), `${Math.ceil(p.hp)} / ${d.maxHp}`);
    setStyle(byId('p-mp'), 'width', pct(p.mana, d.maxMana));
    setText(byId('p-mp-t'), `${Math.floor(p.mana)} / ${d.maxMana}`);
    // XP guardada: com nível pronto o quadro do jogador vira botão (subir de nível quando quiser)
    const need = w.xpToNext(),
      ready = w.levelsReady(),
      full = ready > 0 && w.xp >= w.xpBankCap();
    setStyle(byId('p-xp'), 'width', need === null ? '100%' : pct(w.xp, need));
    setText(
      byId('p-xp-t'),
      need === null
        ? L(`Nível máximo (${PROGRESSION.levelCap})`, `Max level (${PROGRESSION.levelCap})`)
        : full
          ? L(`XP cheia! ▲ Subir (${ready})`, `XP full! ▲ Level up (${ready})`)
          : ready
            ? L(`▲ Subir de nível (${ready})`, `▲ Level up (${ready})`)
            : `XP ${Math.floor(w.xp)} / ${need}`,
    );
    const pf = byId('player-frame');
    pf.classList.toggle('lv-ready', ready > 0);
    pf.classList.toggle('xp-full', full);
    setText(byId('map-name'), w.map.name);
    if (w.gold !== this.goldSig) {
      this.goldSig = w.gold;
      byId('p-gold').textContent = String(w.gold);
    }
    this.rewards.update();
    this.questTracker.update(this.world);
    const badge = byId('pts-badge');
    setText(badge, w.freePoints > 0 ? String(w.freePoints) : '');
    badge.classList.toggle('hidden', w.freePoints <= 0);
    updateHudMenu(w.freePoints > 0);

    const boss = w.engagedBoss(),
      bb = byId('boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      setText(byId('boss-name'), L(`Nv ${boss.level} ${boss.name}`, `Lv ${boss.level} ${boss.name}`));
      setStyle(byId('boss-hp'), 'width', pct(boss.hp, boss.derived.maxHp));
      setText(byId('boss-hp-t'), `${Math.max(0, Math.ceil(boss.hp))} / ${boss.derived.maxHp}`);
    }
    const t = w.getTarget(),
      tf = byId('target-frame');
    tf.classList.toggle('hidden', !t || t === boss);
    if (t) {
      setText(byId('t-name'), t.name);
      setText(byId('t-level'), L(`Nv ${t.level}`, `Lv ${t.level}`));
      setStyle(byId('t-hp'), 'width', pct(t.hp, t.derived.maxHp));
      setText(byId('t-hp-t'), `${Math.max(0, Math.ceil(t.hp))} / ${t.derived.maxHp}`);
      (this.tBuffs ??= new BuffRow(byId('t-buffs'))).update(t.buffs, 'debuff');
    }
    this.attrs.update();
    this.hotbar.update();
    this.skills.update();
    this.inv.update();
    this.npc.update();
    this.dungeon.update();
    this.trial.update();
    this.potions.update();
    byId('dur-warn').classList.toggle('hidden', !w.lowDurability());
    const ms = `${w.mountsOwned.length > 0}|${w.riding}`;
    if (ms !== this.mountSig) {
      this.mountSig = ms;
      const b = byId('btn-mount');
      b.classList.toggle('hidden', !w.mountsOwned.length);
      b.classList.toggle('on', w.riding);
      const t = w.riding ? L('Desmontar', 'Dismount') : L('Montar', 'Mount');
      b.setAttribute('aria-label', t);
      b.title = isTouch ? t : `${t} (H)`;
    }
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
