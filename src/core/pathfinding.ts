import type { GameMap } from './map';
import type { Point } from './types';

export const inBounds = (m: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height;
export const isWalkable = (m: GameMap, x: number, y: number) => {
  const i = Math.floor(x), j = Math.floor(y);
  return inBounds(m, i, j) && m.walkable[j * m.width + i];
};

export function nearestWalkable(m: GameMap, x: number, y: number): Point | null {
  for (let r = 0; r <= 10; r++) {
    let best: Point | null = null, bd = Infinity;
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
      if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== r || !isWalkable(m, i, j)) continue;
      const d = Math.hypot(i - x, j - y);
      if (d < bd) { bd = d; best = { x: i, y: j }; }
    }
    if (best) return best;
  }
  return null;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// A* em grade com 8 direções, sem cortar quinas. Retorna centros de tiles.
export function findPath(m: GameMap, from: Point, to: Point): Point[] {
  const W = m.width;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  let gx = Math.floor(to.x), gy = Math.floor(to.y);
  if (!isWalkable(m, gx, gy)) {
    const n = nearestWalkable(m, gx, gy);
    if (!n) return [];
    gx = n.x; gy = n.y;
  }
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];
  const N = W * m.height;
  const g = new Float64Array(N).fill(Infinity), f = new Float64Array(N), parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const h = (x: number, y: number) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  const start = sy * W + sx, goal = gy * W + gx;
  g[start] = 0; f[start] = h(sx, sy);
  const open = [start];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === goal) break;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isWalkable(m, nx, ny)) continue;
      if (dx && dy && (!isWalkable(m, cx + dx, cy) || !isWalkable(m, cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
      if (ng >= g[ni]) continue;
      if (g[ni] === Infinity) open.push(ni);
      g[ni] = ng; f[ni] = ng + h(nx, ny); parent[ni] = cur;
    }
  }
  if (parent[goal] === -1) return [];
  const out: Point[] = [];
  for (let c = goal; c !== start; c = parent[c]) out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
  return out.reverse();
}
