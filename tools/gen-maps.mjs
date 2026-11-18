// Gera mapas isométricos compatíveis com Tiled em public/maps/
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

const W = 32,
  H = 32,
  TW = 64,
  TH = 32;
const TILES = [
  { name: 'grass', walkable: true, color: [86, 140, 72] },
  { name: 'path', walkable: true, color: [170, 150, 110] },
  { name: 'water', walkable: false, color: [60, 110, 170] },
  { name: 'tree', walkable: false, color: [40, 95, 50] },
  { name: 'house', walkable: false, color: [150, 90, 70] },
  { name: 'plaza', walkable: true, color: [190, 185, 170] },
  { name: 'ruin', walkable: true, color: [140, 143, 143] },
  { name: 'pillar', walkable: false, color: [85, 89, 94] },
  // marco 9 (montanha): sempre no fim da lista, para não mudar os gids dos mapas antigos
  { name: 'snow', walkable: true, color: [222, 230, 238] },
  { name: 'pine', walkable: false, color: [52, 84, 70] },
];
const [G, P, WA, T, HS, PL, RU, PI, SN, PN] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const walkable = (id) => TILES[id - 1].walkable;

function rngFn(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(fill = G, border = T) {
  const g = new Array(W * H).fill(fill);
  const set = (x, y, id) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = id;
  };
  const get = (x, y) => g[y * W + x];
  const rect = (x, y, w, h, id) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, id);
  };
  const disc = (cx, cy, r, id) => {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (Math.hypot(i - cx, j - cy) <= r) set(i, j, id);
  };
  for (let i = 0; i < W; i++) {
    set(i, 0, border);
    set(i, H - 1, border);
    set(0, i, border);
    set(W - 1, i, border);
  }
  return { g, set, get, rect, disc };
}

function sealUnreachable(grid, sx, sy, wall = T) {
  const seen = new Set([sy * W + sx]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(ny * W + nx)) continue;
      if (!walkable(grid.get(nx, ny))) continue;
      seen.add(ny * W + nx);
      q.push([nx, ny]);
    }
  }
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) if (walkable(grid.get(i, j)) && !seen.has(j * W + i)) grid.set(i, j, wall);
  return seen;
}

let nextId = 1;
const prop = (o) =>
  Object.entries(o).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : 'string', value }));
const point = (name, type, tx, ty, props = {}) => ({
  id: nextId++,
  name,
  type,
  x: tx * TH,
  y: ty * TH,
  width: 0,
  height: 0,
  point: true,
  rotation: 0,
  visible: true,
  properties: prop(props),
});
const area = (name, type, tx, ty, tw, th, props = {}) => ({
  id: nextId++,
  name,
  type,
  x: tx * TH,
  y: ty * TH,
  width: tw * TH,
  height: th * TH,
  rotation: 0,
  visible: true,
  properties: prop(props),
});

function tiled(displayName, grid, objects) {
  return {
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'isometric',
    renderorder: 'right-down',
    infinite: false,
    width: W,
    height: H,
    tilewidth: TW,
    tileheight: TH,
    nextlayerid: 3,
    nextobjectid: nextId,
    properties: [{ name: 'displayName', type: 'string', value: displayName }],
    tilesets: [
      {
        firstgid: 1,
        name: 'tiles',
        tilewidth: TW,
        tileheight: TH,
        tilecount: TILES.length,
        columns: TILES.length,
        image: 'tiles.png',
        imagewidth: TW * TILES.length,
        imageheight: TH,
        margin: 0,
        spacing: 0,
        tiles: TILES.map((t, id) => ({
          id,
          properties: [
            { name: 'name', type: 'string', value: t.name },
            { name: 'walkable', type: 'bool', value: t.walkable },
          ],
        })),
      },
    ],
    layers: [
      {
        id: 1,
        name: 'ground',
        type: 'tilelayer',
        width: W,
        height: H,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        data: grid.g,
      },
      {
        id: 2,
        name: 'objects',
        type: 'objectgroup',
        draworder: 'topdown',
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        objects,
      },
    ],
  };
}

function tilesetPng() {
  const w = TW * TILES.length,
    h = TH,
    px = Buffer.alloc(w * h * 4);
  TILES.forEach((t, k) => {
    for (let y = 0; y < TH; y++)
      for (let x = 0; x < TW; x++) {
        if (Math.abs(x + 0.5 - 32) / 32 + Math.abs(y + 0.5 - 16) / 16 > 1) continue;
        const o = (y * w + k * TW + x) * 4;
        px[o] = t.color[0];
        px[o + 1] = t.color[1];
        px[o + 2] = t.color[2];
        px[o + 3] = 255;
      }
  });
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- cidade ----
// Vila das Nuvens (marco 6): praça de pedra no centro com o incensário e os 4 mestres (um em cada canto,
// ao lado do estandarte da seita); casas wuxia em volta; ferraria e loja de poções na beira da praça;
// estrada de pedra até o portão leste (floresta). Casas = objetos "building" (tiles 'house' bloqueiam);
// enfeites = objetos "decor" (block = 1 bloqueia o tile). Moradores andam (wander = raio em tiles).
function cidade() {
  const rnd = rngFn(11);
  const gr = makeGrid();
  gr.rect(1, 15, 30, 2, P);
  gr.rect(15, 1, 2, 30, P);
  gr.rect(11, 11, 10, 10, PL);
  gr.rect(21, 15, 9, 2, PL); // praça + estrada de pedra até o portão
  const objs = [];
  const used = new Set(); // tiles reservados (casas, enfeites, NPCs e vizinhos) — sem árvores aleatórias
  const reserve = (i, j, pad = 0) => {
    for (let y = j - pad; y <= j + pad; y++) for (let x = i - pad; x <= i + pad; x++) used.add(y * W + x);
  };
  const building = (sprite, i, j, w, h, extra = []) => {
    gr.rect(i, j, w, h, HS);
    for (const [x, y] of extra) gr.set(x, y, HS); // partes que saem da pegada (bigorna, forja, bancada)
    for (let y = j - 1; y <= j + h + 1; y++) for (let x = i - 1; x <= i + w + 1; x++) reserve(x, y);
    objs.push(area(sprite, 'building', i, j, w, h, { sprite }));
  };
  const decor = (sprite, i, j, block = 1, extra = {}) => {
    if (block) gr.set(i, j, gr.get(i, j) === PL ? PL : G);
    reserve(i, j, 1);
    objs.push(point(sprite, 'decor', i + 0.5, j + 0.5, { sprite, block, ...extra }));
  };
  const npc = (name, id, x, y, extra = {}) => {
    reserve(Math.floor(x), Math.floor(y), 1);
    objs.push(point(name, 'npc', x, y, { npc: id, ...extra }));
  };

  building('ferraria', 6, 11, 4, 3, [
    [7, 14],
    [8, 14],
    [10, 12],
  ]);
  building('loja_pocoes', 21, 11, 4, 3, [
    [22, 14],
    [23, 14],
  ]);
  building('casa_3x3', 3, 5, 3, 3);
  building('casa_4x3', 8, 5, 4, 3);
  building('casa_3x4', 19, 3, 3, 4);
  building('casa_3x3', 24, 5, 3, 3);
  building('casa_3x3b', 4, 20, 3, 3);
  building('casa_4x3', 8, 24, 4, 3);
  building('casa_3x4', 20, 21, 3, 4);
  building('casa_3x3', 24, 22, 3, 3);
  building('incensario', 15, 15, 2, 2);

  // mestres das seitas nos cantos da praça, ao lado do estandarte
  const masters = [
    ['lamina', 'tormenta', 11, 11, 12.5, 12.4],
    ['pavilhao', 'geada', 20, 11, 19.6, 12.5],
    ['tita', 'tita', 11, 20, 12.4, 19.6],
    ['vibora', 'vibora', 20, 20, 19.5, 19.5],
  ];
  for (const [sect, banner, bi, bj, mx, my] of masters) {
    decor('estandarte_' + banner, bi, bj);
    npc('Mestre', 'mestre_' + sect, mx, my);
  }

  // portão leste (pailou) sobre a estrada de pedra
  decor('portao_coluna', 27, 14);
  decor('portao_coluna', 27, 17);
  objs.push(point('portao_topo', 'decor', 27.5, 16, { sprite: 'portao_topo', block: 0, top: 1 }));
  for (const [i, j] of [
    [25, 14],
    [25, 17],
    [6, 17],
    [13, 8],
    [18, 8],
    [13, 23],
    [18, 23],
  ])
    decor('lanterna', i, j);
  for (const [i, j] of [
    [14, 10],
    [17, 10],
    [14, 21],
    [17, 21],
    [10, 14],
    [10, 17],
    [21, 17],
  ])
    decor('lanterna_pedra', i, j);
  decor('poco', 6, 18);
  decor('carroca', 3, 13);
  for (const [s2, i, j] of [
    ['barril', 12, 9],
    ['caixotes', 7, 9],
    ['barril', 23, 9],
    ['caixotes', 27, 9],
    ['vaso', 18, 25],
    ['vaso', 7, 23],
    ['caixotes', 13, 26],
    ['barril', 26, 20],
    ['vaso', 3, 9],
  ])
    decor(s2, i, j);

  // NPCs
  npc('Ferreiro', 'ferreiro', 9.7, 14.4);
  npc('Vendedor de Poções', 'vendedor', 21.5, 14.4);
  npc('Ancião', 'anciao', 14.2, 17.6);
  npc('Guarda do Portão', 'guarda', 26.3, 13.5);
  npc('Mercador Ambulante', 'mercador', 4.6, 13.5);
  const walkers = [
    ['morador1', 13.5, 14.2],
    ['morador2', 8.5, 17.5],
    ['morador3', 18.4, 17.8],
    ['morador4', 17.6, 13.4],
  ];
  for (const [id, x, y] of walkers) objs.push(point('Morador', 'npc', x, y, { npc: id, wander: 4 }));

  // árvores (cerejeiras e carvalhos) só na grama livre, longe das casas, estradas e da praça
  reserve(16, 17, 1);
  let n = 0;
  for (let tries = 0; tries < 2000 && n < 30; tries++) {
    const x = 1 + Math.floor(rnd() * 30),
      y = 1 + Math.floor(rnd() * 30);
    if (gr.get(x, y) !== G || used.has(y * W + x)) continue;
    let nearRoad = false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (gr.get(x + dx, y + dy) === P || gr.get(x + dx, y + dy) === PL) nearRoad = true;
    if (nearRoad) continue;
    gr.set(x, y, T);
    n++;
  }
  sealUnreachable(gr, 16, 17);
  objs.unshift(
    point('player', 'spawn', 16.5, 17.5),
    area('Floresta', 'portal', 29, 14, 2, 4, { target: 'floresta', targetX: 5.5, targetY: 16.5 }),
    // saída norte (marco 9): só abre no nível 10 (minLevel)
    area('Montanha Nevada', 'portal', 15, 1, 2, 2, { target: 'montanha', targetX: 16, targetY: 27.5, minLevel: 10 }),
  );
  return tiled('Vila das Nuvens', gr, objs);
}

// ---- floresta ----
// lobos perto da entrada (nv 1-3); acampamentos de bandidos mais fundo (nv 4-6); portal das Ruínas no extremo leste
function floresta() {
  const rnd = rngFn(77);
  const gr = makeGrid();
  for (let n = 0; n < 14; n++) gr.disc(2 + rnd() * 28, 2 + rnd() * 28, 1 + rnd() * 2.2, T);
  for (let n = 0; n < 90; n++) gr.set(1 + Math.floor(rnd() * 30), 1 + Math.floor(rnd() * 30), T);
  gr.disc(21, 9, 3, WA);
  gr.disc(10, 23, 2.5, WA);
  gr.disc(4, 16, 4, G);
  gr.rect(1, 15, 8, 2, P);
  // estrada até o portal das Ruínas (a leste)
  gr.rect(8, 15, 8, 2, P);
  gr.rect(14, 9, 2, 8, P);
  gr.rect(14, 9, 14, 2, P);
  gr.rect(26, 9, 2, 9, P);
  gr.rect(26, 15, 5, 3, P);
  sealUnreachable(gr, 4, 16);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const reach = () => {
    const seen = sealUnreachable(gr, 4, 16),
      out = [];
    for (let j = 2; j < H - 2; j++)
      for (let i = 2; i < W - 2; i++) if (seen.has(j * W + i) && walkable(gr.get(i, j))) out.push([i, j]);
    return out;
  };
  // distância de caminhada (BFS) a partir da entrada
  const walkDist = (() => {
    const d = new Map([[16 * W + 4, 0]]),
      q = [[4, 16]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || d.has(k) || !walkable(gr.get(nx, ny))) continue;
        d.set(k, d.get(y * W + x) + 1);
        q.push([nx, ny]);
      }
    }
    return (i, j) => d.get(j * W + i) ?? Infinity;
  })();
  const reach0 = reach();
  const wolves = [];
  const wc = reach0.filter(([i, j]) => {
    const d = walkDist(i, j);
    return d >= 9 && d <= 17 && dist(i, j, 4, 16) >= 7;
  });
  while (wolves.length < 8 && wc.length) {
    const [i, j] = wc.splice(Math.floor(rnd() * wc.length), 1)[0];
    if (wolves.some(([a, b]) => dist(a, b, i, j) < 3.5)) continue;
    wolves.push([i, j]);
  }
  // acampamentos: escolhe centros e abre uma clareira em volta (longe dos lobos)
  const camps = [];
  let c0 = reach().filter(
    ([i, j]) => walkDist(i, j) >= 26 && dist(i, j, 30, 16.5) >= 8 && wolves.every(([a, b]) => dist(a, b, i, j) >= 9),
  );
  while (camps.length < 3 && c0.length) {
    const [i, j] = c0.splice(Math.floor(rnd() * c0.length), 1)[0];
    if (camps.some(([a, b]) => dist(a, b, i, j) < 9)) continue;
    camps.push([i, j]);
  }
  for (const [i, j] of camps)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (dist(x, y, i, j) <= 2.6 && x > 0 && y > 0 && x < W - 1 && y < H - 1 && gr.get(x, y) !== WA) gr.set(x, y, G);
  const cands = reach();
  const objs = [
    point('player', 'spawn', 5.5, 16.5),
    area('Vila', 'portal', 1, 14, 2, 4, { target: 'cidade', targetX: 27.5, targetY: 16.5 }),
    area('Ruínas de Terracota', 'portal', 29, 15, 2, 3, { target: 'ruinas', targetX: 4.5, targetY: 16.5 }),
  ];
  for (const [i, j] of wolves) objs.push(point('Lobo', 'monsterSpawn', i + 0.5, j + 0.5, { monster: 'lobo' }));
  const kinds = [
    ['e', 'e', 'a'],
    ['e', 'e', 'e'],
    ['e', 'e', 'a'],
  ];
  camps.forEach(([ci, cj], n) => {
    const placed = [];
    const near = cands.filter(([i, j]) => dist(i, j, ci, cj) <= 2.4);
    for (const k of kinds[n % kinds.length]) {
      let tries = 0,
        pick = null;
      while (tries++ < 40 && near.length) {
        const c = near[Math.floor(rnd() * near.length)];
        if (placed.every(([a, b]) => dist(a, b, c[0], c[1]) >= 1.5)) {
          pick = c;
          break;
        }
      }
      if (!pick) continue;
      placed.push(pick);
      objs.push(
        point(k === 'e' ? 'Bandido Espadachim' : 'Bandido Arqueiro', 'monsterSpawn', pick[0] + 0.5, pick[1] + 0.5, {
          monster: k === 'e' ? 'bandido_espadachim' : 'bandido_arqueiro',
          group: n + 1,
        }),
      );
    }
  });
  console.log(
    `floresta: ${wolves.length} lobos, ${camps.length} acampamentos, ${objs.filter((o) => String(o.name).startsWith('Bandido')).length} bandidos`,
  );
  return tiled('Floresta Sombria', gr, objs);
}

// ---- ruínas de terracota ----
// guerreiros a oeste (nv 7-9); arena do General a leste, com portão aberto na parede de pilares
function ruinas() {
  const rnd = rngFn(321);
  const gr = makeGrid();
  gr.rect(1, 1, W - 2, H - 2, RU);
  for (let i = 0; i < W; i++) {
    gr.set(i, 0, PI);
    gr.set(i, H - 1, PI);
    gr.set(0, i, PI);
    gr.set(W - 1, i, PI);
  }
  for (let n = 0; n < 16; n++) gr.disc(6 + rnd() * 10, 3 + rnd() * 26, 0.6 + rnd() * 1.1, PI);
  gr.rect(15, 1, 2, 30, PI);
  gr.rect(15, 14, 2, 5, RU); // parede com portão
  gr.disc(24.5, 16.5, 7.5, RU);
  gr.disc(5, 16, 4, RU);
  gr.rect(1, 15, 12, 2, RU);
  for (let n = 0; n < 5; n++) {
    const a = (n / 5) * Math.PI * 2 + 0.3;
    gr.disc(24.5 + Math.cos(a) * 5.5, 16.5 + Math.sin(a) * 5.5, 0.5, PI);
  }
  gr.disc(24.5, 16.5, 3.2, RU);
  const seen = sealUnreachable(gr, 4, 16);
  const objs = [
    point('player', 'spawn', 4.5, 16.5),
    area('Floresta', 'portal', 1, 14, 2, 4, { target: 'floresta', targetX: 27.5, targetY: 16.5 }),
  ];
  const cands = [];
  for (let j = 2; j < H - 2; j++)
    for (let i = 7; i <= 13; i++) if (seen.has(j * W + i) && walkable(gr.get(i, j))) cands.push([i, j]);
  const chosen = [];
  while (chosen.length < 9 && cands.length) {
    const [i, j] = cands.splice(Math.floor(rnd() * cands.length), 1)[0];
    if (chosen.some(([a, b]) => Math.hypot(a - i, b - j) < 3.2)) continue;
    chosen.push([i, j]);
    objs.push(point('Guerreiro de Terracota', 'monsterSpawn', i + 0.5, j + 0.5, { monster: 'guerreiro_terracota' }));
  }
  objs.push(point('General de Terracota', 'monsterSpawn', 24.5, 16.5, { monster: 'general_terracota' }));
  console.log(`ruinas: ${chosen.length} guerreiros + General`);
  return tiled('Ruínas de Terracota', gr, objs);
}

// ---- montanha nevada (marco 9) ----
// Entrada pelo sul (vinda da saída norte da vila); trilha sobe em zigue-zague entre pinheiros e pedras até o
// Templo Abandonado no topo (norte). Encosta baixa (y 19–27) e encosta alta (y 12–18) ficam livres para os
// monstros da fase 3 (Espectro de gelo e Yeti); o pátio do templo é a arena do Abade Caído (centro 16,6).
// Sem monsterSpawn por enquanto: os monstros entram na fase 3.
const MONTANHA_ARENA = { x: 16, y: 6, r: 5.5 };
function montanha() {
  const rnd = rngFn(2026);
  const gr = makeGrid(SN, PN);
  // encosta fechada: bosques de pinheiros e pedras (pilares); a trilha e as clareiras são abertas depois
  for (let j = 1; j < H - 1; j++)
    for (let i = 1; i < W - 1; i++) {
      const r = rnd();
      if (j < 12 || r < 0.38) gr.set(i, j, r < 0.06 ? PI : PN);
    }
  // trilha: entrada (16,28) -> curva oeste -> curva leste -> escadaria do templo
  gr.rect(15, 24, 2, 7, SN);
  gr.rect(9, 23, 8, 2, SN);
  gr.rect(9, 17, 2, 8, SN);
  gr.rect(9, 16, 14, 2, SN);
  gr.rect(21, 12, 2, 6, SN);
  gr.rect(15, 11, 8, 2, SN);
  // clareiras de caça (fase 3): encosta baixa a leste e a oeste, encosta alta no meio
  gr.disc(23, 23, 3.2, SN);
  gr.disc(5, 15, 2.6, SN);
  gr.disc(6, 21, 3.4, SN);
  gr.rect(5, 15, 5, 2, SN); // ligação da clareira oeste com a trilha
  gr.disc(16, 20.5, 2.6, SN);
  gr.disc(26, 15, 2.6, SN);
  gr.disc(6, 21, 2.2, WA); // lago (congelado na arte da fase 4), na beira da clareira oeste
  gr.disc(6, 21, 0.9, WA);
  // templo: muro de pilares do y 1 ao 11 com portão no sul; pátio de lajes (ruin) com 6 braseiros em volta
  gr.rect(8, 1, 16, 11, PI);
  gr.rect(9, 1, 14, 10, RU);
  gr.rect(15, 10, 2, 2, RU); // portão
  gr.disc(MONTANHA_ARENA.x, MONTANHA_ARENA.y, 4.6, RU);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(MONTANHA_ARENA.x + Math.cos(a) * 4), Math.floor(MONTANHA_ARENA.y + Math.sin(a) * 4), PI);
  }
  const seen = sealUnreachable(gr, 16, 27, PN);
  if (!seen.has(6 * W + 16)) throw new Error('montanha: templo inalcançável');
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vila', 'portal', 15, 29, 2, 2, { target: 'cidade', targetX: 16, targetY: 4.5 }),
  ];
  console.log(`montanha: ${seen.size} tiles andáveis, templo alcançável`);
  return tiled('Montanha Nevada', gr, objs);
}

mkdirSync('public/maps', { recursive: true });
writeFileSync('public/maps/cidade.json', JSON.stringify(cidade()));
writeFileSync('public/maps/floresta.json', JSON.stringify(floresta()));
writeFileSync('public/maps/ruinas.json', JSON.stringify(ruinas()));
writeFileSync('public/maps/montanha.json', JSON.stringify(montanha()));
writeFileSync('public/maps/tiles.png', tilesetPng());
console.log('Mapas gerados em public/maps/');
