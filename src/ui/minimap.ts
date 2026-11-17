import { MONSTERS } from '../core/data';
import { L, tn } from '../core/i18n';
import type { GameMap } from '../core/map';
import type { World } from '../core/world';
import { closeX } from './labels';
import { uiScale } from './uiScale';

// Minimapa (melhoria aprovada em 15/11/2026): canto superior direito, mapa isométrico em losango.
// Monstros = pontinhos minúsculos; chefe destacado; NPCs, portais e o personagem.
// Mapa grande: tecla M ou toque/clique no minimapa.

const TILE_COLOR: Record<string, string> = {
  grass: '#4b7f3b', path: '#a8875a', water: '#35679e', tree: '#24502a',
  house: '#94473a', plaza: '#b3ad9d', ruin: '#8c8f8f', pillar: '#55595e',
};
const COLOR = { player: '#ffffff', monster: '#ff5a4a', boss: '#ff9a1f', npc: '#ffd23f', portal: '#c08cff' };
const REDRAW_MS = 150;

const $ = (id: string) => document.getElementById(id)!;

/** Desenha o mapa (fundo, guardado) e os pontos num canvas, em projeção isométrica. */
class MapPainter {
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  constructor(private canvas: HTMLCanvasElement) {}

  /** Losango que cabe em w×h: tile (i,j) -> pixel. */
  private layout(map: GameMap) {
    const dpr = Math.min(3, Math.min(2, window.devicePixelRatio || 1) * uiScale());
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.bgKey = '';
    }
    const pad = 4 * dpr, W = this.canvas.width - pad * 2, H = this.canvas.height - pad * 2;
    const span = map.width + map.height;
    const s = Math.min(W / span, (H * 2) / span); // meia largura de um tile
    const ox = pad + (W - span * s) / 2 + map.height * s, oy = pad + (H - span * s / 2) / 2;
    return { dpr, s, at: (x: number, y: number) => ({ x: ox + (x - y) * s, y: oy + (x + y) * s / 2 }) };
  }

  draw(w: World, big: boolean) {
    const map = w.map, lay = this.layout(map), ctx = this.canvas.getContext('2d')!;
    const key = `${map.id}|${this.canvas.width}x${this.canvas.height}`;
    if (key !== this.bgKey) { this.bg = this.paintBg(map, lay); this.bgKey = key; }
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    const d = lay.dpr * (big ? 1.6 : 1);
    const dot = (x: number, y: number, r: number, fill: string, stroke?: string) => {
      const p = lay.at(x, y);
      ctx.beginPath(); ctx.arc(p.x, p.y, r * d, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.lineWidth = Math.max(1, d * 0.8); ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    // portais: losango roxo na área do portal
    for (const o of map.objects) {
      if (o.type !== 'portal') continue;
      const c = lay.at(o.x + o.w / 2, o.y + o.h / 2), r = 3.2 * d;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - r); ctx.lineTo(c.x + r, c.y); ctx.lineTo(c.x, c.y + r); ctx.lineTo(c.x - r, c.y); ctx.closePath();
      ctx.fillStyle = COLOR.portal; ctx.fill(); ctx.lineWidth = Math.max(1, d * 0.6); ctx.strokeStyle = '#fff'; ctx.stroke();
      if (big) this.label(ctx, c.x, c.y - r - 3 * d, tn(o.name), COLOR.portal, d);
    }
    for (const n of w.npcs) {
      dot(n.x, n.y, 2, COLOR.npc, '#000');
      if (big) { const p = lay.at(n.x, n.y); this.label(ctx, p.x, p.y - 4 * d, tn(n.name), COLOR.npc, d); }
    }
    for (const m of w.monsters) {
      if (m.dead) continue;
      if (MONSTERS[m.monsterId]?.boss) dot(m.x, m.y, 3.6, COLOR.boss, '#000');
      else dot(m.x, m.y, 1.1, COLOR.monster);
    }
    dot(w.player.x, w.player.y, 2.8, COLOR.player, '#000');
  }

  private label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, d: number) {
    ctx.font = `600 ${Math.round(5.5 * d)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 2.5 * d / 1.6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  private paintBg(map: GameMap, lay: ReturnType<MapPainter['layout']>): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    for (let j = 0; j < map.height; j++) for (let i = 0; i < map.width; i++) {
      const a = lay.at(i, j), b = lay.at(i + 1, j), e = lay.at(i + 1, j + 1), f = lay.at(i, j + 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.closePath();
      const col = TILE_COLOR[map.tiles[j * map.width + i]] ?? '#333';
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.fill(); ctx.stroke(); // traço fecha as frestas
    }
    return c;
  }
}

export class Minimap {
  private small: MapPainter;
  private big: MapPainter;
  private last = 0;

  constructor(private world: World) {
    const box = $('minimap');
    box.setAttribute('aria-label', L('Minimapa — toque para abrir o mapa (M)', 'Minimap — tap to open the map (M)'));
    box.title = L('Mapa (M)', 'Map (M)');
    this.small = new MapPainter($('minimap-canvas') as HTMLCanvasElement);
    const panel = $('bigmap');
    panel.innerHTML = `<div class="card bigmap-card"><div class="bigmap-head"><h2 id="bigmap-title"></h2>${closeX('data-close')}</div>
      <canvas id="bigmap-canvas"></canvas>
      <div class="bigmap-legend">
        <span><i style="background:${COLOR.player}"></i>${L('Você', 'You')}</span>
        <span><i style="background:${COLOR.monster}"></i>${L('Monstros', 'Monsters')}</span>
        <span><i style="background:${COLOR.boss}"></i>${L('Chefe', 'Boss')}</span>
        <span><i style="background:${COLOR.npc}"></i>NPC</span>
        <span><i class="dia" style="background:${COLOR.portal}"></i>${L('Portal', 'Portal')}</span>
      </div></div>`;
    this.big = new MapPainter($('bigmap-canvas') as HTMLCanvasElement);
    box.addEventListener('focus', () => box.blur()); // senão Espaço "clicaria" no minimapa em vez de atacar
    box.addEventListener('click', () => this.toggle(true));
    panel.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === panel || t.closest('[data-close]')) this.toggle(false); // fora do cartão ou no X
    });
  }

  get open() { return !$('bigmap').classList.contains('hidden'); }

  toggle(open?: boolean) {
    const show = open ?? !this.open;
    $('bigmap').classList.toggle('hidden', !show);
    if (show) { $('bigmap-title').textContent = this.world.map.name; this.big.draw(this.world, true); }
  }

  update() {
    const now = performance.now();
    if (now - this.last < REDRAW_MS) return;
    this.last = now;
    this.small.draw(this.world, false);
    if (this.open) { $('bigmap-title').textContent = this.world.map.name; this.big.draw(this.world, true); }
  }
}
