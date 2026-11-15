import tipsJson from '../data/tips.json';
import type { GameEvent } from '../core/types';
import type { World } from '../core/world';
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
      if (t.dataset.act === 'close') this.togglePanel(false);
      else if (t.dataset.act === 'reset') { this.world.seenTips = []; this.onChange(); this.renderPanel(); }
    };
    panel.onchange = (e) => {
      const el = e.target as HTMLInputElement;
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
    p.classList.toggle('hidden', !show);
    if (show) this.renderPanel();
  }

  private renderPanel() {
    $('settings-panel').innerHTML = `<div class="card"><h2>Configurações</h2>
      <label class="opt"><input type="checkbox" id="opt-tips" ${this.world.tipsEnabled ? 'checked' : ''}/> Mostrar dicas</label>
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
    else if (ev.type === 'playerDeath') this.diedPending = true;
    else if (ev.type === 'mapChange' && this.diedPending) { this.diedPending = false; this.trigger('primeira_morte'); }
  }

  update() {
    const w = this.world;
    if (w.player.dead || w.mapId !== 'cidade' || w.seenTips.includes('portal')) return;
    for (const o of w.map.objects) {
      if (o.type !== 'portal') continue;
      if (Math.hypot(w.player.x - (o.x + o.w / 2), w.player.y - (o.y + o.h / 2)) < 6) { this.trigger('portal'); return; }
    }
  }
}
