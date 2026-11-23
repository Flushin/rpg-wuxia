import type { GameMap } from './map';
import type { Point } from './types';

export const inBounds = (m: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height;
export const isWalkable = (m: GameMap, x: number, y: number) => {
  const i = Math.floor(x),
    j = Math.floor(y);
  return inBounds(m, i, j) && m.walkable[j * m.width + i];
};

export function nearestWalkable(m: GameMap, x: number, y: number): Point | null {
  for (let r = 0; r <= 10; r++) {
    let best: Point | null = null,
      bd = Infinity;
    for (let j = y - r; j <= y + r; j++)
      for (let i = x - r; i <= x + r; i++) {
        if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== r || !isWalkable(m, i, j)) continue;
        const d = Math.hypot(i - x, j - y);
        if (d < bd) {
          bd = d;
          best = { x: i, y: j };
        }
      }
    if (best) return best;
  }
  return null;
}

/** Tile andável alcançável a partir de `from` (busca em largura) mais perto de `to`, até `maxR` tiles de `to`.
 *  Usado para chegar a um NPC cercado de objetos: o tile andável "mais perto" pode ficar do outro lado de uma parede. */
export function reachableNear(m: GameMap, from: Point, to: Point, maxR = 4): Point | null {
  const W = m.width,
    sx = Math.floor(from.x),
    sy = Math.floor(from.y);
  if (!isWalkable(m, sx, sy)) return null;
  const seen = new Uint8Array(W * m.height),
    q = [sy * W + sx];
  seen[q[0]] = 1;
  let best: Point | null = null,
    bd = Infinity;
  for (let k = 0; k < q.length; k++) {
    const x = q[k] % W,
      y = (q[k] - x) / W,
      d = Math.hypot(x + 0.5 - to.x, y + 0.5 - to.y);
    if (d < bd && d <= maxR) {
      bd = d;
      best = { x: x + 0.5, y: y + 0.5 };
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if (!inBounds(m, nx, ny) || seen[ny * W + nx] || !isWalkable(m, nx, ny)) continue;
        if (dx && dy && (!isWalkable(m, x + dx, y) || !isWalkable(m, x, y + dy))) continue;
        seen[ny * W + nx] = 1;
        q.push(ny * W + nx);
      }
  }
  return best;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// A* em grade com 8 direções, sem cortar quinas. Retorna centros de tiles.
// Círculo (x, y = centro, raio r) ou, com w/h, retângulo (x, y = canto) aumentado de r em volta.
export interface Avoid {
  x: number;
  y: number;
  r: number;
  w?: number;
  h?: number;
}
export const insideAvoid = (a: Avoid, px: number, py: number) =>
  a.w !== undefined
    ? px >= a.x - a.r && px <= a.x + a.w + a.r && py >= a.y - a.r && py <= a.y + (a.h ?? 0) + a.r
    : Math.hypot(px - a.x, py - a.y) <= a.r;

// avoid: áreas proibidas (cada área que já contém o ponto de partida é ignorado, para dar para sair dele)
export function findPath(m: GameMap, from: Point, to: Point, avoid?: Avoid[]): Point[] {
  const W = m.width;
  if (avoid) avoid = avoid.filter((a) => !insideAvoid(a, from.x, from.y));
  const blocked = (x: number, y: number) => !!avoid && avoid.some((a) => insideAvoid(a, x + 0.5, y + 0.5));
  const sx = Math.floor(from.x),
    sy = Math.floor(from.y);
  let gx = Math.floor(to.x),
    gy = Math.floor(to.y);
  if (!isWalkable(m, gx, gy)) {
    const n = nearestWalkable(m, gx, gy);
    if (!n) return [];
    gx = n.x;
    gy = n.y;
  }
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];
  const N = W * m.height;
  const g = new Float64Array(N).fill(Infinity),
    f = new Float64Array(N),
    parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx),
      dy = Math.abs(y - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const start = sy * W + sx,
    goal = gy * W + gx;
  g[start] = 0;
  f[start] = h(sx, sy);
  const open = [start];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goal) break;
    closed[cur] = 1;
    const cx = cur % W,
      cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!isWalkable(m, nx, ny) || blocked(nx, ny)) continue;
      if (dx && dy && (!isWalkable(m, cx + dx, cy) || !isWalkable(m, cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
      if (ng >= g[ni]) continue;
      if (g[ni] === Infinity) open.push(ni);
      g[ni] = ng;
      f[ni] = ng + h(nx, ny);
      parent[ni] = cur;
    }
  }
  if (parent[goal] === -1) return [];
  const out: Point[] = [];
  for (let c = goal; c !== start; c = parent[c]) out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
  return out.reverse();
}
