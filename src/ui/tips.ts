// Dicas de primeira vez: fila de cartões, gatilhos por evento/estado e quais o jogador já viu.
// O painel ⚙ (que liga/desliga e reinicia as dicas) fica em settingsPanel.ts.
import { localize } from '../core/i18n';
import tipsJson from '../data/tips.json';
import type { GameEvent } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { isTouch } from '../platform/input';
import { MONSTERS } from '../core/data';
import { TOWN_MAPS } from '../core/mapsConfig';
import { byId } from './dom';
import { hudV2 } from './hudLayout';

interface TipDef {
  title: string;
  text: string;
  /** celular com o HUD novo (padrão) */
  textTouch?: string;
  /** celular com o HUD Clássico (⚙ › Layout do HUD no celular); sem ele, vale o textTouch */
  textTouchClassic?: string;
  byClass?: Record<string, string>;
}
const TIPS = localize('tips', tipsJson) as Record<string, TipDef>;

export class TipManager {
  private queue: string[] = [];
  private current: string | null = null;
  private diedPending = false;
  private kills = 0;
  private levelUps = 0;

  constructor(
    private world: World,
    private onChange: () => void,
  ) {
    byId('tip-ok').onclick = () => this.dismiss();
    this.trigger('inicio');
  }

  /** Liga/desliga as dicas; ao desligar, descarta a fila e esconde o cartão aberto. */
  setEnabled(enabled: boolean) {
    this.world.tipsEnabled = enabled;
    if (!enabled) {
      this.queue = [];
      this.hideCard();
    }
    this.onChange();
  }

  /** "Rever dicas": esquece as já vistas para elas aparecerem de novo. */
  resetSeen() {
    this.world.seenTips = [];
    this.onChange();
  }

  trigger(id: string) {
    const w = this.world;
    if (!TIPS[id] || !w.tipsEnabled || w.seenTips.includes(id) || this.current === id || this.queue.includes(id))
      return;
    this.queue.push(id);
    this.next();
  }

  private next() {
    if (this.current || !this.queue.length) return;
    this.current = this.queue.shift()!;
    const t = TIPS[this.current];
    byId('tip-title').textContent = t.title;
    const touchText = hudV2() ? t.textTouch : (t.textTouchClassic ?? t.textTouch);
    byId('tip-text').textContent =
      (isTouch && touchText ? touchText : t.text) +
      (t.byClass?.[this.world.classId] ? ` ${t.byClass[this.world.classId]}` : '');
    byId('tip-card').classList.remove('hidden');
    audio.ui('tip');
  }

  private hideCard() {
    this.current = null;
    byId('tip-card').classList.add('hidden');
  }

  private dismiss() {
    if (this.current && !this.world.seenTips.includes(this.current)) this.world.seenTips.push(this.current);
    this.hideCard();
    this.onChange();
    this.next();
  }

  onEvent(ev: GameEvent) {
    if (ev.type === 'kill' && ++this.kills === 1) this.trigger('primeiro_abate');
    else if (ev.type === 'levelup' && ++this.levelUps === 1) this.trigger('primeiro_nivel');
    else if (ev.type === 'skillLevelUp') this.trigger('skill_nivel');
    else if (ev.type === 'itemPickup' && !ev.potion) this.trigger('primeiro_item');
    else if (ev.type === 'itemPickup' && ev.potion) this.trigger('primeira_pocao');
    else if (ev.type === 'goldPickup') this.trigger('primeiro_ouro');
    else if (ev.type === 'bagFull') this.trigger('mochila_cheia');
    else if (ev.type === 'autoState' && ev.state === 'on') {
      this.trigger('auto_combate');
      this.trigger('ganho_offline');
    } else if (ev.type === 'autoStopped') this.trigger('durabilidade_baixa');
    else if (ev.type === 'playerDeath') this.diedPending = true;
    else if (ev.type === 'bossArena') this.trigger('chefe');
    else if (ev.type === 'hit' && ev.targetKind === 'monster') {
      const m = this.world.monsters.find((e) => e.id === ev.targetId);
      if (m && MONSTERS[m.monsterId]?.defMul) this.trigger('terracota');
    } else if (ev.type === 'mapChange' && this.diedPending) {
      this.diedPending = false;
      this.trigger('primeira_morte');
    }
  }

  update() {
    const w = this.world;
    if (!w.seenTips.includes('primeira_skill') && w.activeSkills().some((d) => w.isUnlocked(d)))
      this.trigger('primeira_skill');
    if (w.player.level >= 2) this.trigger('auto_combate');
    if (!w.player.dead && w.lowDurability()) this.trigger('durabilidade_baixa');
    if (!TOWN_MAPS.has(w.mapId) && w.kindCount('hp') + w.kindCount('mp') > 0) this.trigger('primeira_pocao');
    if (
      !w.player.dead &&
      !w.seenTips.includes('bandidos') &&
      w.monsters.some(
        (m) => !m.dead && MONSTERS[m.monsterId]?.keepDistance && Math.hypot(w.player.x - m.x, w.player.y - m.y) < 10,
      )
    )
      this.trigger('bandidos');
    if (w.player.dead || !TOWN_MAPS.has(w.mapId)) return;
    if (
      !w.seenTips.includes('primeiro_npc') &&
      w.npcs.some((n) => Math.hypot(w.player.x - n.x, w.player.y - n.y) < 7)
    ) {
      this.trigger('primeiro_npc');
      return;
    }
    if (w.seenTips.includes('portal')) return;
    for (const o of w.map.objects) {
      if (o.type !== 'portal') continue;
      if (Math.hypot(w.player.x - (o.x + o.w / 2), w.player.y - (o.y + o.h / 2)) < 6) {
        this.trigger('portal');
        return;
      }
    }
  }
}
