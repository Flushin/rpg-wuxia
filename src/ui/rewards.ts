// Recompensas fora do meio da tela: XP e ouro no próprio HUD, itens num feed curto à esquerda.
import type { Rarity } from '../core/types';
import { uiRect } from './uiScale';
import { byId, escapeHtml, viewportKey } from './dom';
import { PREF, getPref, setPref } from '../platform/prefs';

const LINE_MS = 3000;
const GOLD_MS = 2500;

export type LootFilter = 'rare' | 'all';
export const loadLootFilter = (): LootFilter => (getPref(PREF.LOOT_FEED) === 'all' ? 'all' : 'rare');
export const saveLootFilter = (v: LootFilter) => setPref(PREF.LOOT_FEED, v);

/** Celular deitado com pouca altura (ex.: Galaxy Z Fold fechado ~920×316): só 2 linhas. */
const compact = () => window.matchMedia('(orientation:landscape) and (max-height:450px)').matches;

interface Line {
  key: string;
  name: string;
  color: string;
  qty: number;
  el: HTMLElement;
  until: number;
}

export class Rewards {
  private lines: Line[] = [];
  private goldSum = 0;
  private goldUntil = 0;
  private xpTimer = 0;
  private placeSig = '';
  filter: LootFilter = loadLootFilter();

  /** mul > 1: ganho com bônus (core/buffs.ts), mostrado como "+N ×2" com brilho. */
  gold(amount: number, mul = 1) {
    const now = performance.now();
    this.goldSum = now < this.goldUntil ? this.goldSum + amount : amount; // abates seguidos somam no mesmo número
    this.goldUntil = now + GOLD_MS;
    const el = byId('p-gold-plus');
    el.textContent = mul > 1 ? `+${this.goldSum} ×${+mul.toFixed(2)}` : `+${this.goldSum}`;
    el.classList.toggle('buff', mul > 1);
    el.classList.remove('fade');
    el.classList.add('show');
  }

  xp() {
    const bar = byId('p-xp').parentElement as HTMLElement;
    bar.classList.add('glow');
    clearTimeout(this.xpTimer);
    this.xpTimer = window.setTimeout(() => bar.classList.remove('glow'), 700);
  }

  item(name: string, color: string, qty: number, rarity: Rarity | undefined, potion: boolean) {
    const notable = !potion && (rarity === 'incomum' || rarity === 'raro' || rarity === 'epico');
    if (!notable && this.filter !== 'all') return; // continua indo para a mochila normalmente
    const key = `${name}|${color}`,
      now = performance.now();
    let ln = this.lines.find((l) => l.key === key);
    if (ln) {
      ln.qty += qty;
      ln.until = now + LINE_MS;
      this.lines = [...this.lines.filter((l) => l !== ln), ln];
    } else {
      const el = document.createElement('div');
      ln = { key, name, color, qty, el, until: now + LINE_MS };
      this.lines.push(ln);
    }
    ln.el.style.color = color;
    ln.el.innerHTML = `+ ${escapeHtml(name)}${ln.qty > 1 ? ` <b>×${ln.qty}</b>` : ''}`;
    const max = compact() ? 2 : 4;
    while (this.lines.length > max) this.lines.shift()!.el.remove();
    const feed = byId('loot-feed');
    for (const l of this.lines) feed.appendChild(l.el); // ordem: mais novo embaixo
    this.place();
  }

  update() {
    const now = performance.now();
    if (this.goldUntil && now >= this.goldUntil) {
      this.goldUntil = 0;
      this.goldSum = 0;
      byId('p-gold-plus').classList.replace('show', 'fade');
    }
    if (!this.lines.length) return;
    const gone = this.lines.filter((l) => now >= l.until);
    if (gone.length) {
      for (const l of gone) l.el.remove();
      this.lines = this.lines.filter((l) => now < l.until);
    }
    // reposiciona só quando algo que muda o lugar do feed mudou (ler posições força o navegador a refazer o layout)
    if (this.lines.length && this.feedSig() !== this.placeSig) this.place();
  }

  private feedSig() {
    return `${this.lines.length}|${byId('target-frame').classList.contains('hidden')}|${viewportKey()}`;
  }

  private place() {
    this.placeSig = this.feedSig();
    placeFeed();
  }
}

/** Abaixo do quadro do personagem — ou do quadro do alvo, quando ele está empilhado à esquerda.
 *  Se não sobra espaço até o joystick (tela baixa com interface grande), vai para o lado do quadro do personagem. */
export function placeFeed() {
  const pf = uiRect(byId('player-frame')),
    tf = byId('target-frame'),
    feed = byId('loot-feed');
  let top = pf.bottom;
  if (!tf.classList.contains('hidden')) {
    const r = uiRect(tf);
    if (r.left < pf.right && r.top >= pf.bottom - 2) top = r.bottom;
  }
  feed.style.left = '';
  feed.style.maxHeight = '';
  feed.style.width = '';
  const y = Math.round(top + 6);
  feed.style.top = `${y}px`;
  const room = feedRoom(y);
  const side = Math.floor(uiRect(byId('top-right')).left - 8 - (pf.right + 8)); // espaço entre o quadro e os botões do topo
  if (room !== '' && parseInt(room) < 40 && side >= 120) {
    feed.style.left = `${Math.round(pf.right + 8)}px`;
    feed.style.top = `${Math.round(pf.top)}px`;
    if (side < feed.offsetWidth) feed.style.width = `${side}px`;
  } else feed.style.maxHeight = room;
}
(window as unknown as { __placeFeed: () => void }).__placeFeed = placeFeed; // usado por tools/layout-check.mjs

/** Espaço até o joystick/poções embaixo (interface grande em tela baixa): as linhas mais antigas ficam escondidas. */
export function feedRoom(top: number): string {
  let limit = Infinity;
  for (const id of ['joystick', 'potion-bar']) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('hidden') || !el.offsetWidth) continue;
    const r = uiRect(el),
      f = uiRect(byId('loot-feed'));
    if (r.left < f.left + f.width && f.left < r.right) limit = Math.min(limit, r.top - 6);
  }
  return limit === Infinity ? '' : `${Math.max(0, Math.floor(limit - top))}px`;
}
