import tipsJson from '../data/tips.json';
import type { GameEvent } from '../core/types';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { isTouch } from './controls';

interface TipDef { title: string; text: string; textTouch?: string }
const TIPS = tipsJson as Record<string, TipDef>;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class TipManager {
  private queue: string[] = [];
  private current: string | null = null;
  private diedPending = false;
  private kills = 0;
  private levelUps = 0;

  constructor(private world: World, private onChange: () => void) {
    $('tip-ok').onclick = () => this.dismiss();
    $('btn-settings').onclick = () => this.togglePanel();
    const panel = $('settings-panel');
    panel.onclick = (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!t) { if (e.target === panel) this.togglePanel(false); return; }
      audio.ui('ui_click');
      if (t.dataset.act === 'close') this.togglePanel(false);
      else if (t.dataset.act === 'reset') { this.world.seenTips = []; this.onChange(); this.renderPanel(); }
    };
    panel.oninput = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'opt-sfx' || el.id === 'opt-music') {
        audio.setSettings(el.id === 'opt-sfx' ? { sfx: +el.value } : { music: +el.value });
        const o = el.nextElementSibling as HTMLElement | null;
        if (o) o.textContent = el.value;
      }
    };
    panel.onchange = (e) => {
      const el = e.target as HTMLInputElement;
      if (el.id === 'opt-mute') { audio.setSettings({ muted: el.checked }); audio.ui('ui_click'); return; }
      if (el.id !== 'opt-tips') return;
      this.world.tipsEnabled = el.checked;
      if (!el.checked) { this.queue = []; this.hideCard(); }
      this.onChange();
    };
    this.trigger('inicio');
  }

  private togglePanel(open?: boolean) {
    const p = $('settings-panel');
    const show = open ?? p.classList.contains('hidden');
    if (show !== !p.classList.contains('hidden')) audio.ui(show ? 'ui_open' : 'ui_close');
    p.classList.toggle('hidden', !show);
    if (show) this.renderPanel();
  }

  private renderPanel() {
    $('settings-panel').innerHTML = `<div class="card"><h2>Configurações</h2>
      <label class="opt"><input type="checkbox" id="opt-tips" ${this.world.tipsEnabled ? 'checked' : ''}/> Mostrar dicas</label>
      <label class="opt"><input type="checkbox" id="opt-mute" ${audio.settings.muted ? 'checked' : ''}/> Mudo</label>
      <label class="sld">Efeitos<input type="range" id="opt-sfx" min="0" max="100" step="1" value="${audio.settings.sfx}"/><output>${audio.settings.sfx}</output></label>
      <label class="sld">Música<input type="range" id="opt-music" min="0" max="100" step="1" value="${audio.settings.music}"/><output>${audio.settings.music}</output></label>
      <button data-act="reset">Rever dicas</button>
      <small class="muted">${this.world.seenTips.length ? `${this.world.seenTips.length} dica(s) já vista(s)` : 'Nenhuma dica vista ainda'}</small>
      <button class="primary" data-act="close">Fechar</button></div>`;
  }

  trigger(id: string) {
    const w = this.world;
    if (!TIPS[id] || !w.tipsEnabled || w.seenTips.includes(id) || this.current === id || this.queue.includes(id)) return;
    this.queue.push(id);
    this.next();
  }

  private next() {
    if (this.current || !this.queue.length) return;
    this.current = this.queue.shift()!;
    const t = TIPS[this.current];
    $('tip-title').textContent = t.title;
    $('tip-text').textContent = isTouch && t.textTouch ? t.textTouch : t.text;
    $('tip-card').classList.remove('hidden');
    audio.ui('tip');
  }

  private hideCard() { this.current = null; $('tip-card').classList.add('hidden'); }

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
    else if (ev.type === 'playerDeath') this.diedPending = true;
    else if (ev.type === 'mapChange' && this.diedPending) { this.diedPending = false; this.trigger('primeira_morte'); }
  }

  update() {
    const w = this.world;
    if (!w.seenTips.includes('primeira_skill') && w.activeSkills().some((d) => w.isUnlocked(d))) this.trigger('primeira_skill');
    if (!w.player.dead && w.lowDurability()) this.trigger('durabilidade_baixa');
    if (w.mapId !== 'cidade' && w.kindCount('hp') + w.kindCount('mp') > 0) this.trigger('primeira_pocao');
    if (w.player.dead || w.mapId !== 'cidade') return;
    if (!w.seenTips.includes('primeiro_npc') && w.npcs.some((n) => Math.hypot(w.player.x - n.x, w.player.y - n.y) < 7)) { this.trigger('primeiro_npc'); return; }
    if (w.seenTips.includes('portal')) return;
    for (const o of w.map.objects) {
      if (o.type !== 'portal') continue;
      if (Math.hypot(w.player.x - (o.x + o.w / 2), w.player.y - (o.y + o.h / 2)) < 6) { this.trigger('portal'); return; }
    }
  }
}
