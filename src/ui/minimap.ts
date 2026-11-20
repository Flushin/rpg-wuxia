import { MONSTERS, NPC_TEXT } from '../core/data';
import { L, tn } from '../core/i18n';
import type { GameMap } from '../core/map';
import type { World } from '../core/world';
import { closeX } from './labels';
import { uiScale } from './uiScale';
import { byId } from './dom';
import { renderPanel } from './panelRender';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { teleportById } from '../core/teleport';
import { mapLevels, portalSide, worldLinks, worldRoute, type WorldLink } from '../core/worldRoutes';

// Minimapa (melhoria aprovada em 15/11/2026): canto superior direito, mapa isométrico em losango.
// Monstros = pontinhos minúsculos; chefe destacado; NPCs, portais e o personagem.
// Mapa grande: tecla M ou toque/clique no minimapa. Aba Mundo (mapa-múndi): todos os mapas ligados pelos portais;
// tocar num mapa traça a rota (src/core/worldRoutes.ts), lista os portais na ordem e destaca o próximo no minimapa.

const TILE_COLOR: Record<string, string> = {
  grass: '#4b7f3b',
  path: '#a8875a',
  water: '#35679e',
  tree: '#24502a',
  house: '#94473a',
  plaza: '#b3ad9d',
  ruin: '#8c8f8f',
  pillar: '#55595e',
  snow: '#dfe6ee',
  pine: '#2e5446',
};
const COLOR = {
  player: '#ffffff',
  monster: '#ff5a4a',
  boss: '#ff9a1f',
  npc: '#ffd23f',
  portal: '#c08cff',
  route: '#ffe066',
};
const REDRAW_MS = 150;

/** Desenha o mapa (fundo, guardado) e os pontos num canvas, em projeção isométrica. */
class MapPainter {
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  // tamanho na tela guardado (ResizeObserver): ler clientWidth a cada redesenho força o navegador a refazer o layout
  private size: { w: number; h: number } | null = null;
  constructor(private canvas: HTMLCanvasElement) {
    if (typeof ResizeObserver !== 'undefined')
      new ResizeObserver(() => {
        this.size = null;
      }).observe(canvas);
  }

  /** Losango que cabe em w×h: tile (i,j) -> pixel. */
  private layout(map: GameMap) {
    const dpr = Math.min(3, Math.min(2, window.devicePixelRatio || 1) * uiScale());
    if (!this.size || typeof ResizeObserver === 'undefined')
      this.size = { w: this.canvas.clientWidth || 1, h: this.canvas.clientHeight || 1 };
    const { w, h } = this.size;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.bgKey = '';
    }
    const pad = 4 * dpr,
      W = this.canvas.width - pad * 2,
      H = this.canvas.height - pad * 2;
    const span = map.width + map.height;
    const s = Math.min(W / span, (H * 2) / span); // meia largura de um tile
    const ox = pad + (W - span * s) / 2 + map.height * s,
      oy = pad + (H - (span * s) / 2) / 2;
    return { dpr, s, at: (x: number, y: number) => ({ x: ox + (x - y) * s, y: oy + ((x + y) * s) / 2 }) };
  }

  /** `next` = portal da rota escolhida no mapa-múndi (anel dourado piscando). */
  draw(w: World, big: boolean, next?: WorldLink | null) {
    const map = w.map,
      lay = this.layout(map),
      ctx = this.canvas.getContext('2d')!;
    const key = `${map.id}|${this.canvas.width}x${this.canvas.height}`;
    if (key !== this.bgKey) {
      this.bg = this.paintBg(map, lay);
      this.bgKey = key;
    }
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    const d = lay.dpr * (big ? 1.6 : 1);
    const dot = (x: number, y: number, r: number, fill: string, stroke?: string) => {
      const p = lay.at(x, y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * d, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.lineWidth = Math.max(1, d * 0.8);
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    };
    // portais: losango roxo na área do portal
    for (const o of map.objects) {
      if (o.type !== 'portal') continue;
      const c = lay.at(o.x + o.w / 2, o.y + o.h / 2),
        r = 3.2 * d;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - r);
      ctx.lineTo(c.x + r, c.y);
      ctx.lineTo(c.x, c.y + r);
      ctx.lineTo(c.x - r, c.y);
      ctx.closePath();
      ctx.fillStyle = COLOR.portal;
      ctx.fill();
      ctx.lineWidth = Math.max(1, d * 0.6);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (big) this.label(ctx, c.x, c.y - r - 3 * d, tn(o.name), COLOR.portal, d);
    }
    if (next && next.from === map.id) {
      const o = next.portal,
        c = lay.at(o.x + o.w / 2, o.y + o.h / 2),
        pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.beginPath();
      ctx.arc(c.x, c.y, (6 + 3 * pulse) * d, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.5, d * 1.4);
      ctx.strokeStyle = COLOR.route;
      ctx.stroke();
    }
    for (const n of w.npcs) {
      dot(n.x, n.y, 2, COLOR.npc, '#000');
      if (big) {
        const p = lay.at(n.x, n.y);
        this.label(ctx, p.x, p.y - 4 * d, tn(n.name), COLOR.npc, d);
      }
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = (2.5 * d) / 1.6;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private paintBg(map: GameMap, lay: ReturnType<MapPainter['layout']>): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    for (let j = 0; j < map.height; j++)
      for (let i = 0; i < map.width; i++) {
        const a = lay.at(i, j),
          b = lay.at(i + 1, j),
          e = lay.at(i + 1, j + 1),
          f = lay.at(i, j + 1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(f.x, f.y);
        ctx.closePath();
        const col = TILE_COLOR[map.tiles[j * map.width + i]] ?? '#333';
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.6;
        ctx.fill();
        ctx.stroke(); // traço fecha as frestas
      }
    return c;
  }
}

const SIDE = (): string[] => [
  L('↑ no alto', '↑ top'),
  L('↗ no alto, à direita', '↗ top right'),
  L('→ à direita', '→ right'),
  L('↘ embaixo, à direita', '↘ bottom right'),
  L('↓ embaixo', '↓ bottom'),
  L('↙ embaixo, à esquerda', '↙ bottom left'),
  L('← à esquerda', '← left'),
  L('↖ no alto, à esquerda', '↖ top left'),
];
// grade do mapa-múndi (SVG): tamanho de cada célula e do cartão de cada mapa
const CELL_W = 200,
  CELL_H = 92,
  NODE_W = 176,
  NODE_H = 58;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Minimap {
  private small: MapPainter;
  private big: MapPainter;
  private last = 0;
  private tab: 'here' | 'world' = 'here';
  /** destino escolhido no mapa-múndi (some ao chegar) */
  private dest: string | null = null;
  private links: WorldLink[];
  private shownMap = '';

  constructor(private world: World) {
    this.links = worldLinks(world.maps);
    const box = byId('minimap');
    box.setAttribute('aria-label', L('Minimapa — toque para abrir o mapa (M)', 'Minimap — tap to open the map (M)'));
    box.title = L('Mapa (M)', 'Map (M)');
    this.small = new MapPainter(byId('minimap-canvas') as HTMLCanvasElement);
    const panel = byId('bigmap');
    panel.innerHTML = `<div class="card bigmap-card"><div class="bigmap-head"><h2 id="bigmap-title"></h2>
        <div class="tabs bigmap-tabs"><button data-tab="here">${L('Este mapa', 'This map')}</button><button data-tab="world">${L('Mundo', 'World')}</button></div>
        ${closeX('data-close')}</div>
      <canvas id="bigmap-canvas"></canvas>
      <div id="bigmap-world"></div>
      <div class="bigmap-legend" id="bigmap-legend">
        <span><i style="background:${COLOR.player}"></i>${L('Você', 'You')}</span>
        <span><i style="background:${COLOR.monster}"></i>${L('Monstros', 'Monsters')}</span>
        <span><i style="background:${COLOR.boss}"></i>${L('Chefe', 'Boss')}</span>
        <span><i style="background:${COLOR.npc}"></i>NPC</span>
        <span><i class="dia" style="background:${COLOR.portal}"></i>${L('Portal', 'Portal')}</span>
      </div>
      <div id="bigmap-route"></div></div>`;
    this.big = new MapPainter(byId('bigmap-canvas') as HTMLCanvasElement);
    box.addEventListener('focus', () => box.blur()); // senão Espaço "clicaria" no minimapa em vez de atacar
    box.addEventListener('click', () => this.toggle(true));
    panel.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === panel || t.closest('[data-close]')) return this.toggle(false); // fora do cartão ou no X
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tab === 'here' || tab === 'world') {
        this.tab = tab;
        return this.refresh();
      }
      if (t.closest('[data-clear]')) {
        this.dest = null;
        return this.refresh();
      }
      const to = t.closest<Element>('[data-map]')?.getAttribute('data-map');
      if (to) {
        this.dest = to === this.world.mapId || to === this.dest ? null : to;
        this.refresh();
      }
    });
  }

  get open() {
    return !byId('bigmap').classList.contains('hidden');
  }

  toggle(open?: boolean) {
    const show = open ?? !this.open;
    byId('bigmap').classList.toggle('hidden', !show);
    if (show) this.refresh();
  }

  /** Rota até o destino escolhido, a partir do mapa atual (null = sem destino ou sem caminho). */
  private route(): WorldLink[] | null {
    if (!this.dest) return null;
    return worldRoute(this.links, this.world.mapId, this.dest);
  }

  private refresh() {
    this.shownMap = this.world.mapId;
    const world = this.tab === 'world';
    byId('bigmap-title').textContent = world ? L('Mapa-múndi', 'World map') : this.world.map.name;
    byId('bigmap')
      .querySelectorAll<HTMLElement>('[data-tab]')
      .forEach((b) => {
        b.classList.toggle('on', b.dataset.tab === this.tab);
      });
    byId('bigmap-canvas').classList.toggle('hidden', world);
    byId('bigmap-legend').classList.toggle('hidden', world);
    byId('bigmap-world').classList.toggle('hidden', !world);
    const route = this.route();
    if (world) renderPanel(byId('bigmap-world'), this.worldSvg(route));
    else this.big.draw(this.world, true, route?.[0]);
    renderPanel(byId('bigmap-route'), this.routeHtml(route));
  }

  /** Mapa-múndi: um cartão por mapa (posição em MAPS_CONFIG.world) e as ligações entre eles. */
  private worldSvg(route: WorldLink[] | null): string {
    const maps = this.world.maps,
      lvl = this.world.player.level;
    const ids = Object.keys(maps).filter((id) => MAPS_CONFIG[id]?.world);
    const pos = (id: string) => {
      const g = MAPS_CONFIG[id].world!;
      return { x: g.col * CELL_W + CELL_W / 2, y: g.row * CELL_H + CELL_H / 2 };
    };
    const cols = Math.max(...ids.map((id) => MAPS_CONFIG[id].world!.col)) + 1,
      rows = Math.max(...ids.map((id) => MAPS_CONFIG[id].world!.row)) + 1;
    const onRoute = new Set((route ?? []).map((l) => `${l.from}>${l.to}`));
    // uma linha por par de mapas (ida e volta)
    const pairs = new Map<string, { a: string; b: string; menu?: string; hot: boolean }>();
    for (const l of this.links) {
      // teleporte: sem linha (com muitas regiões viraria uma teia); o cartão do destino ganha a marca ✦
      if (l.menu === 'caminhos' || !MAPS_CONFIG[l.from]?.world || !MAPS_CONFIG[l.to]?.world) continue;
      const k = [l.from, l.to].sort().join('|');
      const p = pairs.get(k) ?? { a: l.from, b: l.to, menu: l.menu, hot: false };
      p.menu = p.menu ?? l.menu;
      p.hot ||= onRoute.has(`${l.from}>${l.to}`);
      pairs.set(k, p);
    }
    let edges = '';
    for (const p of pairs.values()) {
      const a = pos(p.a),
        b = pos(p.b);
      edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="wm-edge${p.menu ? ' menu' : ''}${p.hot ? ' hot' : ''}"/>`;
    }
    let nodes = '';
    for (const id of ids) {
      const m = maps[id],
        c = pos(id),
        here = id === this.world.mapId,
        dest = id === this.dest;
      // nível para chegar: o maior minLevel do caminho a partir da vila
      const path = worldRoute(this.links, 'cidade', id) ?? [];
      const need = Math.max(0, ...path.map((l) => l.minLevel));
      const lv = mapLevels(m);
      const sub = [
        lv ? `${L('Nv', 'Lv')} ${lv[0]}–${lv[1]}` : MAPS_CONFIG[id].town ? L('cidade segura', 'safe town') : '',
        need > lvl ? `🔒 ${need}` : '',
        teleportById(id) ? '✦' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const name = m.name;
      // nomes longos em duas linhas
      let l1 = name,
        l2 = '';
      if (name.length > 20) {
        const mid = name.length / 2;
        let cut = -1;
        for (let i = 0; i < name.length; i++)
          if (name[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
        if (cut > 0) {
          l1 = name.slice(0, cut);
          l2 = name.slice(cut + 1);
        }
      }
      const cls = [
        'wm-node',
        here ? 'here' : '',
        dest ? 'dest' : '',
        need > lvl ? 'locked' : '',
        MAPS_CONFIG[id].dungeon ? 'inst' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const ty = l2 ? -14 : -6;
      nodes += `<g class="${cls}" data-map="${id}" transform="translate(${c.x},${c.y})" role="button">
        <rect x="${-NODE_W / 2}" y="${-NODE_H / 2}" width="${NODE_W}" height="${NODE_H}" rx="9"/>
        <text y="${ty}" class="wm-name">${esc(l1)}</text>${l2 ? `<text y="${ty + 14}" class="wm-name">${esc(l2)}</text>` : ''}
        <text y="${l2 ? 20 : 14}" class="wm-sub">${esc(sub)}</text>
        ${here ? `<text y="${-NODE_H / 2 - 5}" class="wm-here">● ${L('você está aqui', 'you are here')}</text>` : ''}
      </g>`;
    }
    return `<svg viewBox="0 -12 ${cols * CELL_W} ${rows * CELL_H + 12}" class="wm-svg">${edges}${nodes}</svg>`;
  }

  /** Lista de passos da rota (ou a instrução de tocar num mapa). */
  private routeHtml(route: WorldLink[] | null): string {
    if (!this.dest)
      return `<p class="wm-hint">${L(
        'Toque num mapa da aba Mundo para ver o caminho até ele. ✦ = o Mestre dos Caminhos, na praça da vila, leva até esse mapa.',
        'Tap a map on the World tab to see the way there. ✦ = the Wayfarer Master, in the village square, takes you to that map.',
      )}</p>`;
    const maps = this.world.maps,
      lvl = this.world.player.level,
      to = maps[this.dest]?.name ?? this.dest;
    const head = `<div class="wm-route-head"><b>${L('Rota até', 'Route to')} ${esc(to)}</b><button data-clear>${L('Limpar', 'Clear')}</button></div>`;
    if (!route) return `${head}<p class="wm-hint">${L('Não há caminho daqui.', 'No way from here.')}</p>`;
    const sides = SIDE();
    const steps = route
      .map((l, i) => {
        const m = maps[l.from],
          side = sides[portalSide(m, l.portal)],
          pn = esc(tn(l.portal.name)),
          dn = esc(maps[l.to].name);
        const how =
          l.menu === 'caminhos'
            ? L(
                `fale com o <b>${esc(NPC_TEXT.npcs.caminhos?.name ?? pn)}</b> na praça e escolha <b>${dn}</b>`,
                `talk to the <b>${esc(NPC_TEXT.npcs.caminhos?.name ?? pn)}</b> in the square and pick <b>${dn}</b>`,
              ) + ` · ${l.cost} ${L('ouro', 'gold')}`
            : l.menu === 'masmorras'
              ? L(
                  `entre no <b>${pn}</b> (${side}) e escolha <b>${dn}</b>`,
                  `enter the <b>${pn}</b> (${side}) and pick <b>${dn}</b>`,
                ) + (l.cost ? ` · ${l.cost} ${L('ouro', 'gold')}` : '')
              : l.menu === 'trial'
                ? L(
                    `entre no portal <b>${pn}</b> (${side}) e escolha o chefe`,
                    `enter the <b>${pn}</b> portal (${side}) and pick the boss`,
                  )
                : L(
                    `saia pelo portal <b>${pn}</b> (${side}) → ${dn}`,
                    `take the <b>${pn}</b> portal (${side}) → ${dn}`,
                  );
        const lock = l.minLevel > lvl ? ` <span class="wm-lock">🔒 ${L('nível', 'level')} ${l.minLevel}</span>` : '';
        return `<li class="${i === 0 ? 'now' : ''}"><span class="wm-from">${esc(m.name)}:</span> ${how}${lock}</li>`;
      })
      .join('');
    return `${head}<ol class="wm-steps">${steps}</ol>${
      route.length
        ? `<p class="wm-hint">${L('O próximo portal pisca em dourado no minimapa.', 'The next portal blinks gold on the minimap.')}</p>`
        : ''
    }`;
  }

  update() {
    if (this.dest === this.world.mapId) this.dest = null; // chegou
    if (this.open && this.shownMap !== this.world.mapId) this.refresh(); // atravessou um portal com o mapa aberto
    const now = performance.now();
    if (now - this.last < REDRAW_MS) return;
    this.last = now;
    const next = this.route()?.[0];
    this.small.draw(this.world, false, next);
    if (this.open) {
      if (this.tab === 'here') {
        byId('bigmap-title').textContent = this.world.map.name;
        this.big.draw(this.world, true, next);
      }
    }
  }
}
