// Selo da arena do chefe nas masmorras (pedido do Lucas em 27/11/2026): a passagem para a arena fica selada até
// todos os monstros comuns da masmorra morrerem. Selada, a passagem não é andável e o chefe não pode ser mirado
// nem ferido (o golpe automático não "pula" para o chefe com a câmara ainda cheia). O mapa marca a passagem com um
// objeto `gate` (tools/gen-maps.mjs); o desenho fica em src/render/dungeonSeal.ts.
import { MONSTERS } from '../data';
import type { Entity } from '../types';
import type { World } from '../world';

export interface Seal {
  /** tiles da passagem (índice j * largura + i) e o "andável" original de cada um */
  tiles: number[];
  orig: boolean[];
  /** área do objeto no mapa, em tiles (desenho) */
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
  /** monstros comuns ainda vivos */
  left: number;
}

const pristine = new WeakMap<object, boolean[]>();
const isBossDef = (m: Entity) => !!MONSTERS[m.monsterId]?.boss;
const commonsLeft = (w: World) => w.monsters.filter((m) => !m.dead && !m.summoned && !isBossDef(m)).length;

/** Monta o selo do mapa recém-carregado (só nas masmorras que têm o objeto `gate`). */
export function setupSeal(w: World) {
  w.seal = null;
  const o = w.dungeonId ? w.map.objects.find((q) => q.type === 'gate') : undefined;
  if (!o) return;
  const W = w.map.width,
    tiles: number[] = [];
  for (let j = Math.floor(o.y); j < Math.ceil(o.y + o.h); j++)
    for (let i = Math.floor(o.x); i < Math.ceil(o.x + o.w); i++) tiles.push(j * W + i);
  // o "andável" original vem do primeiro selo deste mapa: o mapa fica em cache e pode ter ficado selado por um
  // World descartado no meio da corrida (novo jogo, testes)
  let orig = pristine.get(w.map);
  if (!orig) pristine.set(w.map, (orig = tiles.map((t) => w.map.walkable[t])));
  const s: Seal = {
    tiles,
    orig,
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    open: false,
    left: 0,
  };
  w.seal = s;
  s.left = commonsLeft(w);
  if (s.left === 0) s.open = true;
  else for (const t of tiles) w.map.walkable[t] = false;
}

/** Devolve o mapa (guardado em cache entre corridas) ao normal ao sair. */
export function clearSeal(w: World) {
  const s = w.seal;
  if (s) s.tiles.forEach((t, k) => (w.map.walkable[t] = s.orig[k]));
  w.seal = null;
}

export function tickSeal(w: World) {
  const s = w.seal;
  if (!s || s.open) return;
  const n = commonsLeft(w);
  if (n !== s.left) {
    s.left = n;
    if (n > 0) w.emit({ type: 'sealProgress', left: n });
  }
  if (n > 0) return;
  s.open = true;
  s.tiles.forEach((t, k) => (w.map.walkable[t] = s.orig[k]));
  w.emit({ type: 'sealOpen' });
}

/** Chefe protegido pelo selo: não pode ser mirado nem ferido. */
export const sealedBoss = (w: World, m: Entity) => !!w.seal && !w.seal.open && m.kind === 'monster' && isBossDef(m);
