// Recompensas fora do meio da tela: XP e ouro no próprio HUD, itens num feed curto à esquerda.
import type { Rarity } from '../core/types';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const FEED_KEY = 'rpg.lootFeed';
const LINE_MS = 3000;
const GOLD_MS = 2500;

export type LootFilter = 'rare' | 'all';
export const loadLootFilter = (): LootFilter => { try { return localStorage.getItem(FEED_KEY) === 'all' ? 'all' : 'rare'; } catch { return 'rare'; } };
export const saveLootFilter = (v: LootFilter) => { try { localStorage.setItem(FEED_KEY, v); } catch { /* sem armazenamento */ } };

/** Celular deitado com pouca altura (ex.: Galaxy Z Fold fechado ~920×316): só 2 linhas. */
const compact = () => window.matchMedia('(orientation:landscape) and (max-height:450px)').matches;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

interface Line { key: string; name: string; color: string; qty: number; el: HTMLElement; until: number }

export class Rewards {
  private lines: Line[] = [];
  private goldSum = 0;
  private goldUntil = 0;
  private xpTimer = 0;
  filter: LootFilter = loadLootFilter();

  gold(amount: number) {
    const now = performance.now();
    this.goldSum = now < this.goldUntil ? this.goldSum + amount : amount; // abates seguidos somam no mesmo número
    this.goldUntil = now + GOLD_MS;
    const el = $('p-gold-plus');
    el.textContent = `+${this.goldSum}`;
    el.classList.remove('fade'); el.classList.add('show');
  }

  xp() {
    const bar = $('p-xp').parentElement as HTMLElement;
    bar.classList.add('glow');
    clearTimeout(this.xpTimer);
    this.xpTimer = window.setTimeout(() => bar.classList.remove('glow'), 700);
  }

  item(name: string, color: string, qty: number, rarity: Rarity | undefined, potion: boolean) {
    const notable = !potion && (rarity === 'incomum' || rarity === 'raro');
    if (!notable && this.filter !== 'all') return; // continua indo para a mochila normalmente
    const key = `${name}|${color}`, now = performance.now();
    let ln = this.lines.find((l) => l.key === key);
    if (ln) { ln.qty += qty; ln.until = now + LINE_MS; this.lines = [...this.lines.filter((l) => l !== ln), ln]; }
    else {
      const el = document.createElement('div');
      ln = { key, name, color, qty, el, until: now + LINE_MS };
      this.lines.push(ln);
    }
    ln.el.style.color = color;
    ln.el.innerHTML = `+ ${esc(name)}${ln.qty > 1 ? ` <b>×${ln.qty}</b>` : ''}`;
    const max = compact() ? 2 : 4;
    while (this.lines.length > max) this.lines.shift()!.el.remove();
    const feed = $('loot-feed');
    for (const l of this.lines) feed.appendChild(l.el); // ordem: mais novo embaixo
    this.place();
  }

  update() {
    const now = performance.now();
    if (this.goldUntil && now >= this.goldUntil) { this.goldUntil = 0; this.goldSum = 0; $('p-gold-plus').classList.replace('show', 'fade'); }
    if (!this.lines.length) return;
    const gone = this.lines.filter((l) => now >= l.until);
    if (gone.length) { for (const l of gone) l.el.remove(); this.lines = this.lines.filter((l) => now < l.until); }
    if (this.lines.length) this.place();
  }

  /** Abaixo do quadro do personagem — ou do quadro do alvo, quando ele está empilhado à esquerda. */
  private place() {
    const pf = $('player-frame').getBoundingClientRect(), tf = $('target-frame');
    let top = pf.bottom;
    if (!tf.classList.contains('hidden')) {
      const r = tf.getBoundingClientRect();
      if (r.left < pf.right && r.top >= pf.bottom - 2) top = r.bottom;
    }
    $('loot-feed').style.top = `${Math.round(top + 6)}px`;
  }
}
