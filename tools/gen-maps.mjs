// Gera mapas isométricos compatíveis com Tiled em public/maps/
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

// W e H mudam só durante a geração de um mapa maior (Porto Noturno, 96×96); os outros mapas são 32×32
let W = 32,
  H = 32;
const TW = 64,
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
  // nível 30 (Bosque de Bambu Sombrio): também no fim da lista
  { name: 'bamboo', walkable: false, color: [44, 92, 56] },
  // nível 40 (Vale das Cinzas Rubras e Ruínas do Palácio Celeste): também no fim da lista
  { name: 'ash', walkable: true, color: [74, 64, 62] },
  { name: 'basalt', walkable: false, color: [44, 40, 40] },
  { name: 'lava', walkable: false, color: [200, 70, 30] },
  { name: 'marble', walkable: true, color: [220, 216, 206] },
  { name: 'cloud', walkable: false, color: [236, 240, 248] },
  // nível 50 (Porto Noturno): tábuas do cais e das pontes, também no fim
  { name: 'deck', walkable: true, color: [128, 92, 62] },
];
const [G, P, WA, T, HS, PL, RU, PI, SN, PN, BB, AS, BS, LV, MB, CL, DK] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
];
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
  // Mestre dos Caminhos (teleporte, src/core/teleport.ts) e o círculo dourado no chão, sob ele, ao lado da lanterna de pedra da praça (desenhado em
  // src/render/mapView.ts; não bloqueia a passagem)
  npc('Mestre dos Caminhos', 'caminhos', 14.5, 9.5);
  objs.push(area('Círculo de Teleporte', 'teleCircle', 13.75, 8.75, 1.5, 1.5));
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
    // saída oeste: portal das masmorras (abre o menu de escolha; src/core/dungeons.ts)
    area('Portal das Masmorras', 'portal', 1, 14, 2, 4, { menu: 'masmorras' }),
    // saída sul: portal do Trial (menu de chefe e nível; src/core/trial.ts)
    area('Trial', 'portal', 15, 29, 2, 2, { menu: 'trial', scale: 1.1 }),
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
  gr.disc(4, 13.5, 2.4, SN); // encosta alta: cantos noroeste e nordeste (monstros nv 15–18)
  gr.disc(27, 13.5, 2.4, SN);
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
  // monstros (fase 3): encosta baixa nv 11–14 (sul), encosta alta nv 15–18 (norte) (faixa por ponto: minLevel/maxLevel)
  const used = [];
  const free = (cx, cy, r) => {
    const out = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++)
        if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r && seen.has(j * W + i) && walkable(gr.get(i, j)) && j < 27)
          out.push([i, j]);
    return out;
  };
  const place = (name, monster, cx, cy, r, minLevel, maxLevel) => {
    const c = free(cx, cy, r);
    for (let tries = 0; tries < 200 && c.length; tries++) {
      const [i, j] = c.splice(Math.floor(rnd() * c.length), 1)[0];
      if (used.some(([a, b]) => Math.hypot(a - i, b - j) < 2.3)) continue;
      used.push([i, j]);
      objs.push(point(name, 'monsterSpawn', i + 0.5, j + 0.5, { monster, minLevel, maxLevel }));
      return;
    }
    throw new Error(`montanha: sem lugar para ${monster} em ${cx},${cy}`);
  };
  const spectre = (cx, cy, r, a, b) => place('Espectro de Gelo', 'espectro_gelo', cx, cy, r, a, b);
  const yeti = (cx, cy, r, a, b) => place('Yeti', 'yeti', cx, cy, r, a, b);
  // encosta baixa (y 20–26): clareira leste, margem do lago (oeste) e o meio, abaixo da trilha
  for (let n = 0; n < 2; n++) spectre(22.5, 23, 3, 11, 13);
  yeti(22.5, 23, 3, 12, 14);
  for (let n = 0; n < 2; n++) spectre(6, 22, 3.4, 11, 13);
  yeti(6, 22, 3.4, 12, 14);
  for (let n = 0; n < 2; n++) spectre(16, 21.5, 2.4, 12, 14);
  // encosta alta (y 12–15): cantos noroeste e nordeste, longe da trilha (que passa no y 16–17)
  for (let n = 0; n < 2; n++) spectre(4, 13.5, 2.8, 15, 17);
  yeti(4, 13.5, 2.8, 16, 18);
  for (let n = 0; n < 2; n++) spectre(27, 13.5, 2.8, 15, 17);
  yeti(27, 13.5, 2.8, 16, 18);
  objs.push(point('Abade Caído', 'monsterSpawn', MONTANHA_ARENA.x, MONTANHA_ARENA.y, { monster: 'abade_caido' }));
  // nível 30: passo leste, ao pé da montanha (sudeste, junto da entrada), até o Bosque de Bambu Sombrio, liberado no
  // nível 20. Longe das clareiras: quem só atravessa a montanha não é puxado para lutas no caminho. Aberto depois dos
  // monstros, para não mudar o sorteio do mapa.
  gr.rect(17, 29, 14, 2, SN);
  objs.push(
    area('Bosque de Bambu Sombrio', 'portal', 30, 29, 1, 2, { target: 'bambu', targetX: 3, targetY: 16, minLevel: 20 }),
  );
  console.log(`montanha: ${seen.size} tiles andáveis, templo alcançável, ${used.length} monstros + Abade`);
  return tiled('Montanha Nevada', gr, objs);
}

// ---- masmorra: Desfiladeiro do Gelo Eterno (nível 10–15) ----
// Instância (src/core/dungeons.ts): monstros não renascem; entrada no sul, três salões e a arena do chefe no norte.
// Paredes de pinheiros e rochas nevadas; arena de lajes com braseiros, como a do templo da montanha.
const GRUTA_ARENA = { x: 16, y: 6, r: 5.5 };
function gruta() {
  const rnd = rngFn(1510);
  const gr = makeGrid(PN, PN);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) if (rnd() < 0.3) gr.set(i, j, PI);
  // entrada (sul) e primeiro salão
  gr.rect(15, 24, 2, 7, SN);
  gr.disc(16, 21, 3.6, SN);
  // passagens para os salões oeste e leste
  gr.rect(7, 21, 9, 2, SN);
  gr.rect(17, 21, 8, 2, SN);
  gr.disc(7, 16, 3.4, SN); // salão oeste
  gr.rect(6, 18, 2, 4, SN);
  gr.disc(25, 16, 3.4, SN); // salão leste
  gr.rect(24, 18, 2, 4, SN);
  // os dois salões sobem até a antecâmara, na frente da arena
  gr.rect(6, 11, 2, 3, SN);
  gr.rect(24, 11, 2, 3, SN);
  gr.rect(6, 11, 20, 2, SN);
  gr.disc(16, 13.5, 2, SN);
  // arena do chefe: lajes com 6 braseiros em volta. Sem portal perto: fugindo dos golpes o jogador saía sem querer;
  // a única saída é a da entrada (sul)
  gr.rect(9, 1, 14, 10, RU); // salão largo como o pátio do templo da montanha: espaço para desviar e recuar
  gr.disc(GRUTA_ARENA.x, GRUTA_ARENA.y, 4.6, RU);
  gr.rect(15, 10, 2, 2, RU);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(GRUTA_ARENA.x + Math.cos(a) * 4), Math.floor(GRUTA_ARENA.y + Math.sin(a) * 4), PI);
  }
  const seen = sealUnreachable(gr, 16, 27, PN);
  for (const [i, j, what] of [
    [16, 6, 'arena'],
    [7, 16, 'salão oeste'],
    [25, 16, 'salão leste'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`gruta: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vila', 'portal', 15, 29, 2, 2, { target: 'cidade', targetX: 3.5, targetY: 16 }),
  ];
  const used = [];
  const place = (monster, name, cx, cy, r, minLevel, maxLevel) => {
    const c = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++)
        if (
          Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r &&
          Math.hypot(i + 0.5 - 16, j + 0.5 - 27.5) >= 7 && // ninguém atira em quem acabou de chegar
          seen.has(j * W + i) &&
          walkable(gr.get(i, j))
        )
          c.push([i, j]);
    for (let tries = 0; tries < 200 && c.length; tries++) {
      const [i, j] = c.splice(Math.floor(rnd() * c.length), 1)[0];
      if (used.some(([a, b]) => Math.hypot(a - i, b - j) < 2)) continue;
      used.push([i, j]);
      objs.push(point(name, 'monsterSpawn', i + 0.5, j + 0.5, { monster, minLevel, maxLevel }));
      return;
    }
    throw new Error(`gruta: sem lugar para ${monster} em ${cx},${cy}`);
  };
  const spectre = (cx, cy, r, a, b) => place('espectro_gelo', 'Espectro de Gelo', cx, cy, r, a, b);
  const yeti = (cx, cy, r, a, b) => place('yeti', 'Yeti', cx, cy, r, a, b);
  for (let n = 0; n < 3; n++) spectre(16, 19.5, 3.4, 11, 12); // primeiro salão
  for (let n = 0; n < 2; n++) spectre(7, 16, 2.8, 12, 13); // salão oeste
  yeti(7, 16, 2.8, 12, 13);
  for (let n = 0; n < 2; n++) spectre(25, 16, 2.8, 13, 14); // salão leste
  yeti(25, 16, 2.8, 13, 14);
  yeti(16, 13.5, 1.6, 14, 14); // antecâmara
  spectre(10, 11.5, 1.2, 14, 14);
  spectre(22, 11.5, 1.2, 14, 14);
  objs.push(point('Yeti Ancestral', 'monsterSpawn', GRUTA_ARENA.x, GRUTA_ARENA.y, { monster: 'yeti_ancestral' }));
  console.log(`gruta: ${seen.size} tiles andáveis, ${used.length} monstros + Yeti Ancestral`);
  return tiled('Desfiladeiro do Gelo Eterno', gr, objs);
}

// ---- masmorra: Mosteiro Profanado (nível 16–20) ----
// Instância (src/core/dungeons.ts): monstros não renascem. Entrada no sul pelo pátio do portão; dali, ala oeste
// (salão de meditação, lajes e colunas) ou ala leste (jardim com lago); as duas sobem ao claustro, que leva à
// antecâmara e ao salão do Patriarca no norte. Paredes de pilares; sem portal perto da arena (como na gruta).
const MOSTEIRO_ARENA = { x: 16, y: 6, r: 5.5 };
function mosteiro() {
  const rnd = rngFn(1620);
  const gr = makeGrid(T, T);
  // bosque em volta; os prédios (salão do Patriarca, claustro, ala oeste, pátio) têm paredes de pilares
  gr.rect(8, 0, 16, 12, PI);
  gr.rect(2, 11, 28, 4, PI);
  gr.rect(2, 13, 9, 11, PI);
  gr.rect(10, 18, 12, 8, PI);
  // entrada (sul) e pátio do portão, com duas cerejeiras nos cantos de cima
  gr.rect(15, 25, 2, 6, P);
  gr.rect(11, 19, 10, 6, PL);
  gr.set(11, 19, T);
  gr.set(20, 19, T);
  // ala oeste: salão de meditação (lajes) com duas fileiras de colunas
  gr.rect(9, 21, 2, 2, PL);
  gr.rect(3, 14, 7, 9, RU);
  for (const j of [16, 19]) for (const i of [4, 8]) gr.set(i, j, PI);
  // ala leste: jardim com lago e árvores
  gr.rect(21, 21, 2, 2, PL);
  gr.rect(22, 14, 7, 9, G);
  gr.disc(25.5, 18, 1.5, WA);
  gr.set(28, 14, T);
  gr.set(22, 22, T);
  // claustro: corredor de cima ligando as duas alas, com a antecâmara no meio
  gr.rect(3, 12, 26, 2, P);
  gr.disc(16, 12.5, 2.2, PL);
  // salão do Patriarca: lajes com 6 braseiros em volta; a porta é o único acesso
  gr.rect(9, 1, 14, 10, RU);
  gr.disc(MOSTEIRO_ARENA.x, MOSTEIRO_ARENA.y, 4.6, RU);
  gr.rect(15, 10, 2, 2, RU);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(MOSTEIRO_ARENA.x + Math.cos(a) * 4), Math.floor(MOSTEIRO_ARENA.y + Math.sin(a) * 4), PI);
  }
  const seen = sealUnreachable(gr, 16, 27, T);
  for (const [i, j, what] of [
    [16, 6, 'arena'],
    [6, 18, 'ala oeste'],
    [24, 16, 'ala leste'],
    [16, 12, 'antecâmara'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`mosteiro: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vila', 'portal', 15, 29, 2, 2, { target: 'cidade', targetX: 3.5, targetY: 16 }),
  ];
  const used = [];
  const place = (monster, name, cx, cy, r, minLevel, maxLevel) => {
    const c = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++)
        if (
          Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r &&
          Math.hypot(i + 0.5 - 16, j + 0.5 - 27.5) >= 6 && // ninguém ataca quem acabou de chegar
          seen.has(j * W + i) &&
          walkable(gr.get(i, j))
        )
          c.push([i, j]);
    for (let tries = 0; tries < 200 && c.length; tries++) {
      const [i, j] = c.splice(Math.floor(rnd() * c.length), 1)[0];
      if (used.some(([a, b]) => Math.hypot(a - i, b - j) < 2)) continue;
      used.push([i, j]);
      objs.push(point(name, 'monsterSpawn', i + 0.5, j + 0.5, { monster, minLevel, maxLevel }));
      return;
    }
    throw new Error(`mosteiro: sem lugar para ${monster} em ${cx},${cy}`);
  };
  const monk = (cx, cy, r, a, b) => place('monge_profanado', 'Monge Profanado', cx, cy, r, a, b);
  const soul = (cx, cy, r, a, b) => place('alma_penada', 'Alma Penada', cx, cy, r, a, b);
  const guard = (cx, cy, r, a, b) => place('guardiao_pedra', 'Guardião de Pedra', cx, cy, r, a, b);
  for (let n = 0; n < 3; n++) monk(16, 20.5, 3.5, 16, 17); // pátio do portão
  for (let n = 0; n < 2; n++) monk(6, 18, 3.5, 17, 18); // ala oeste
  guard(6, 18, 3.5, 17, 18);
  soul(6, 18, 3.5, 17, 18);
  for (let n = 0; n < 2; n++) soul(25, 18, 3.6, 17, 18); // ala leste
  guard(25, 18, 3.6, 17, 18);
  monk(6, 12.5, 1.5, 18, 19); // claustro
  soul(26, 12.5, 1.5, 18, 19);
  guard(16, 12.5, 1.6, 19, 19); // antecâmara
  monk(13, 12.5, 1, 19, 19);
  objs.push(
    point('Patriarca Profanado', 'monsterSpawn', MOSTEIRO_ARENA.x, MOSTEIRO_ARENA.y, {
      monster: 'patriarca_profanado',
    }),
  );
  console.log(`mosteiro: ${seen.size} tiles andáveis, ${used.length} monstros + Patriarca`);
  return tiled('Mosteiro Profanado', gr, objs);
}

// ---- masmorra: Covil dos Bandidos (nível 20, fim de jogo) ----
// Instância (src/core/dungeons.ts): monstros não renascem. Entrada no sul por uma trilha na mata; acampamento da
// entrada, acampamento oeste (barracos) e acampamento leste (beira do riacho); os dois sobem à paliçada, que leva ao
// terreiro do Rei dos Bandidos no norte. Os bandidos de cada acampamento entram em combate juntos (group).
// Sem portal perto da arena (como na gruta).
const COVIL_ARENA = { x: 16, y: 6, r: 5.5 };
function covil() {
  const rnd = rngFn(2022);
  const gr = makeGrid(T, T);
  // trilha de entrada (sul) e acampamento da entrada, com dois barracos
  gr.rect(15, 25, 2, 6, P);
  gr.disc(16, 21, 3.7, G);
  gr.rect(13, 20, 6, 2, P);
  gr.set(12, 18, HS);
  gr.set(20, 18, HS);
  // trilhas para os acampamentos oeste e leste
  gr.rect(6, 21, 8, 2, P);
  gr.rect(19, 21, 8, 2, P);
  gr.disc(7, 16, 3.6, G); // acampamento oeste: barracos
  gr.rect(6, 18, 2, 4, P);
  gr.set(4, 14, HS);
  gr.set(9, 13, HS);
  gr.set(5, 18, HS);
  gr.disc(25, 16, 3.6, G); // acampamento leste: riacho
  gr.rect(24, 18, 2, 4, P);
  for (let j = 12; j <= 20; j++) gr.set(28, j, WA);
  gr.disc(27.5, 15, 1.1, WA);
  // paliçada: corredor de cima ligando os dois acampamentos, com o portão do terreiro no meio
  gr.rect(6, 12, 2, 4, P);
  gr.rect(24, 12, 2, 4, P);
  gr.rect(6, 12, 20, 2, P);
  gr.disc(16, 13, 2, PL);
  // terreiro do Rei: chão batido largo (espaço para desviar das linhas) cercado de barracos
  gr.rect(9, 1, 14, 10, P);
  gr.disc(COVIL_ARENA.x, COVIL_ARENA.y, 4.8, P);
  gr.rect(15, 10, 2, 3, P); // porteira: único acesso ao terreiro
  for (const [i, j] of [
    [9, 1],
    [22, 1],
    [9, 9],
    [22, 9],
  ])
    gr.set(i, j, HS);
  const seen = sealUnreachable(gr, 16, 27, T);
  for (const [i, j, what] of [
    [16, 6, 'arena'],
    [7, 16, 'acampamento oeste'],
    [25, 16, 'acampamento leste'],
    [16, 13, 'portão'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`covil: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vila', 'portal', 15, 29, 2, 2, { target: 'cidade', targetX: 3.5, targetY: 16 }),
  ];
  const used = [];
  const place = (monster, name, cx, cy, r, minLevel, maxLevel, group) => {
    const c = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++)
        if (
          Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r &&
          Math.hypot(i + 0.5 - 16, j + 0.5 - 27.5) >= 6.5 && // ninguém ataca quem acabou de chegar
          seen.has(j * W + i) &&
          walkable(gr.get(i, j))
        )
          c.push([i, j]);
    for (let tries = 0; tries < 200 && c.length; tries++) {
      const [i, j] = c.splice(Math.floor(rnd() * c.length), 1)[0];
      if (used.some(([a, b]) => Math.hypot(a - i, b - j) < 2)) continue;
      used.push([i, j]);
      objs.push(point(name, 'monsterSpawn', i + 0.5, j + 0.5, { monster, minLevel, maxLevel, group }));
      return;
    }
    throw new Error(`covil: sem lugar para ${monster} em ${cx},${cy}`);
  };
  const raider = (cx, cy, r, a, b, g) => place('salteador', 'Salteador', cx, cy, r, a, b, g);
  const xbow = (cx, cy, r, a, b, g) => place('besteiro', 'Besteiro', cx, cy, r, a, b, g);
  const brute = (cx, cy, r, a, b, g) => place('brutamontes', 'Brutamontes', cx, cy, r, a, b, g);
  for (let n = 0; n < 2; n++) raider(16, 20, 3.2, 20, 20, 1); // acampamento da entrada
  xbow(16, 20, 3.2, 20, 20, 1);
  for (let n = 0; n < 2; n++) raider(7, 16, 3, 20, 21, 2); // acampamento oeste
  xbow(7, 16, 3, 20, 21, 2);
  brute(7, 16, 3, 21, 21, 0);
  for (let n = 0; n < 2; n++) xbow(24.5, 16, 3, 20, 21, 3); // acampamento leste
  raider(24.5, 16, 3, 20, 21, 3);
  brute(24.5, 16, 3, 21, 21, 0);
  raider(11, 12.5, 1.5, 21, 22, 4); // paliçada
  xbow(21, 12.5, 1.5, 21, 22, 5);
  brute(16, 13, 1.6, 22, 22, 0); // portão do terreiro
  objs.push(
    point('Rei dos Bandidos', 'monsterSpawn', COVIL_ARENA.x, COVIL_ARENA.y, {
      monster: 'rei_bandidos',
    }),
  );
  console.log(`covil: ${seen.size} tiles andáveis, ${used.length} monstros + Rei dos Bandidos`);
  return tiled('Covil dos Bandidos', gr, objs);
}

// ---- nível 30: monstros espalhados por clareiras (faixa por ponto: minLevel/maxLevel) ----
function placer(name, gr, seen, rnd, objs, avoid) {
  const used = [];
  const place = (label, monster, cx, cy, r, minLevel, maxLevel) => {
    const c = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++)
        if (
          Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r &&
          [avoid].flat().every((a) => Math.hypot(i + 0.5 - a.x, j + 0.5 - a.y) >= 6) && // nem quem chega nem quem passa
          seen.has(j * W + i) &&
          walkable(gr.get(i, j))
        )
          c.push([i, j]);
    for (let tries = 0; tries < 200 && c.length; tries++) {
      const [i, j] = c.splice(Math.floor(rnd() * c.length), 1)[0];
      if (used.some(([a, b]) => Math.hypot(a - i, b - j) < 2.3)) continue;
      used.push([i, j]);
      objs.push(point(label, 'monsterSpawn', i + 0.5, j + 0.5, { monster, minLevel, maxLevel }));
      return;
    }
    throw new Error(`${name}: sem lugar para ${monster} em ${cx},${cy}`);
  };
  return { place, used };
}

// ---- Bosque de Bambu Sombrio (nível 30, nv 20–25) ----
// Entrada a oeste (vinda do passo leste da Montanha Nevada); trilha de terra serpenteia entre moitas fechadas de bambu
// (tile 'bamboo', bloqueia) e um riacho. Clareiras do oeste e do centro com monstros nv 20–22; clareiras do leste e do
// norte com nv 23–25. A trilha do Pico da Névoa (portal com minLevel 25) sai junto da entrada, pela beira oeste, longe
// das clareiras: quem só atravessa o bosque não fica preso lutando no caminho.
function bambu() {
  const rnd = rngFn(2030);
  const gr = makeGrid(G, BB);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) if (rnd() < 0.42) gr.set(i, j, BB);
  // trilha: entrada oeste (2,16) -> centro -> sobe para o norte (16,2)
  gr.rect(1, 15, 9, 2, P);
  gr.rect(1, 10, 2, 6, P); // trilha do Pico, pela beira oeste
  gr.rect(8, 11, 2, 6, P);
  gr.rect(8, 11, 9, 2, P);
  gr.rect(15, 2, 2, 11, P);
  // ramal para o leste
  gr.rect(16, 18, 10, 2, P);
  gr.rect(15, 12, 2, 8, P);
  // clareiras (grama)
  gr.disc(5, 22, 3.4, G); // sudoeste
  gr.rect(4, 16, 2, 5, P);
  gr.disc(12, 23, 3.0, G); // sul
  gr.rect(11, 17, 2, 5, P);
  gr.rect(9, 17, 4, 2, P);
  gr.disc(22, 24, 3.4, G); // sudeste
  gr.rect(21, 19, 2, 4, P);
  gr.disc(26, 12, 3.4, G); // leste
  gr.rect(24, 13, 2, 6, P);
  gr.disc(8, 6, 3.2, G); // noroeste
  gr.rect(9, 9, 2, 3, P);
  gr.disc(24, 5, 3.2, G); // nordeste
  gr.rect(17, 5, 5, 2, P);
  // riacho atravessando o sul, com uma ponte (trilha) no ramal
  for (let i = 13; i <= 19; i++) gr.set(i, 26, WA);
  gr.disc(17, 27, 1.2, WA);
  gr.disc(4, 9, 1.0, WA); // lago pequeno na clareira noroeste
  // pequeno altar (lajes) na clareira do centro
  gr.disc(16, 15, 1.6, PL);
  const seen = sealUnreachable(gr, 2, 16, BB);
  for (const [i, j, what] of [
    [1, 10, 'trilha do Pico'],
    [16, 2, 'clareira norte'],
    [26, 12, 'clareira leste'],
    [5, 22, 'clareira sudoeste'],
    [24, 5, 'clareira nordeste'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`bambu: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 3, 16),
    area('Montanha Nevada', 'portal', 1, 15, 1, 2, { target: 'montanha', targetX: 29, targetY: 29.5 }),
    area('Pico da Névoa', 'portal', 1, 10, 1, 2, { target: 'pico', targetX: 16, targetY: 27.5, minLevel: 25 }),
  ];
  const { place, used } = placer('bambu', gr, seen, rnd, objs, [
    { x: 3, y: 16 },
    { x: 1.5, y: 11 },
  ]);
  const ass = (cx, cy, r, a, b) => place('Assassino das Sombras', 'assassino_sombras', cx, cy, r, a, b);
  const ser = (cx, cy, r, a, b) => place('Serpente de Jade', 'serpente_jade', cx, cy, r, a, b);
  // oeste e centro (nv 20–22)
  ass(5, 22, 3.2, 20, 21);
  ser(5, 22, 3.2, 21, 21);
  ass(12, 23, 2.8, 20, 22);
  ser(12, 23, 2.8, 21, 22);
  ass(8, 6, 3.0, 21, 22);
  ser(8, 6, 3.0, 21, 22);
  ass(14, 16.5, 3, 21, 22);
  // leste e norte (nv 23–25)
  ass(22, 24, 3.2, 23, 24);
  ser(22, 24, 3.2, 23, 24);
  ass(22, 24, 3.2, 23, 24);
  ass(26, 12, 3.2, 23, 25);
  ser(26, 12, 3.2, 24, 25);
  ser(26, 12, 3.2, 23, 24);
  ass(24, 5, 3.0, 24, 25);
  ser(24, 5, 3.0, 24, 25);
  ass(24, 5, 3.0, 24, 25);
  console.log(`bambu: ${seen.size} tiles andáveis, ${used.length} monstros`);
  return tiled('Bosque de Bambu Sombrio', gr, objs);
}

// ---- Pico da Névoa (nível 30, nv 25–30) ----
// Acima das nuvens: entrada no sul (vinda do Bosque); terraços de pedra sobem em zigue-zague entre pinheiros e rochas
// nevadas até o Santuário de Jade no topo, arena do Senhor da Névoa (centro 16,6). Terraço baixo nv 25–27, terraço do
// meio nv 26–28, terraço alto nv 28–30.
const PICO_ARENA = { x: 16, y: 6, r: 5.5 };
function pico() {
  const rnd = rngFn(2031);
  const gr = makeGrid(SN, PN);
  for (let j = 1; j < H - 1; j++)
    for (let i = 1; i < W - 1; i++) {
      const r = rnd();
      if (j < 12 || r < 0.4) gr.set(i, j, r < 0.12 ? PI : PN);
    }
  // trilha de lajes: entrada (16,28) -> terraço baixo -> meio -> alto -> santuário
  gr.rect(15, 22, 2, 9, RU);
  gr.rect(6, 22, 20, 2, RU);
  gr.rect(6, 17, 2, 6, RU);
  gr.rect(24, 17, 2, 6, RU);
  gr.rect(6, 16, 20, 2, RU);
  gr.rect(15, 11, 2, 6, RU);
  // terraços (clareiras de neve)
  gr.disc(7, 26, 3.0, SN);
  gr.disc(25, 26, 3.0, SN);
  gr.disc(4, 19.5, 2.6, SN);
  gr.disc(28, 19.5, 2.6, SN);
  gr.disc(16, 19.5, 2.4, SN);
  gr.disc(5, 13, 2.6, SN);
  gr.disc(27, 13, 2.6, SN);
  gr.rect(5, 13, 2, 4, SN);
  gr.rect(26, 13, 2, 4, SN);
  // santuário: muro de pilares com portão no sul; pátio de lajes com 6 braseiros
  gr.rect(8, 1, 16, 11, PI);
  gr.rect(9, 1, 14, 10, RU);
  gr.rect(15, 10, 2, 2, RU);
  gr.disc(PICO_ARENA.x, PICO_ARENA.y, 4.6, RU);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(PICO_ARENA.x + Math.cos(a) * 4), Math.floor(PICO_ARENA.y + Math.sin(a) * 4), PI);
  }
  const seen = sealUnreachable(gr, 16, 27, PN);
  for (const [i, j, what] of [
    [16, 6, 'santuário'],
    [5, 13, 'terraço alto oeste'],
    [27, 13, 'terraço alto leste'],
    [7, 26, 'terraço baixo oeste'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`pico: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Bosque de Bambu Sombrio', 'portal', 15, 29, 2, 2, { target: 'bambu', targetX: 2.5, targetY: 11 }),
  ];
  const { place, used } = placer('pico', gr, seen, rnd, objs, { x: 16, y: 27.5 });
  const grou = (cx, cy, r, a, b) => place('Grou Espiritual', 'grou_espiritual', cx, cy, r, a, b);
  const guard = (cx, cy, r, a, b) => place('Guardião de Jade', 'guardiao_jade', cx, cy, r, a, b);
  // terraço baixo (nv 25–27)
  grou(7, 26, 2.8, 25, 26);
  grou(7, 26, 2.8, 25, 26);
  guard(25, 26, 2.8, 26, 27);
  grou(25, 26, 2.8, 25, 27);
  // terraço do meio (nv 26–28)
  grou(4, 19.5, 2.6, 26, 28);
  guard(4, 19.5, 2.6, 26, 28);
  grou(28, 19.5, 2.6, 26, 28);
  guard(28, 19.5, 2.6, 27, 28);
  guard(16, 19.5, 2.4, 26, 27);
  // terraço alto (nv 28–30)
  grou(5, 13, 2.8, 28, 30);
  guard(5, 13, 2.8, 28, 29);
  grou(5, 13, 2.8, 28, 29);
  grou(27, 13, 2.8, 28, 30);
  guard(27, 13, 2.8, 29, 30);
  guard(27, 13, 2.8, 28, 29);
  objs.push(point('Senhor da Névoa', 'monsterSpawn', PICO_ARENA.x, PICO_ARENA.y, { monster: 'senhor_nevoa' }));
  console.log(`pico: ${seen.size} tiles andáveis, santuário alcançável, ${used.length} monstros + Senhor da Névoa`);
  return tiled('Pico da Névoa', gr, objs);
}

// ---- Trial: arena dos chefes (chefe nível 21–30) ----
// Instância (src/core/trial.ts): só a arena, sem monstros comuns. O chefe escolhido no menu nasce no centro
// (World.enterTrial), não há monsterSpawn no mapa. Entrada no sul por um jardim; pátio de lajes com 6 braseiros,
// largo para desviar dos golpes; sem portal perto da arena (como nas masmorras).
const TRIAL_ARENA = { x: 16, y: 9, r: 5.5 };
function trial() {
  const gr = makeGrid(T, T);
  // muro de pilares em volta do pátio
  gr.rect(6, 1, 20, 18, PI);
  gr.rect(7, 2, 18, 16, RU);
  gr.disc(TRIAL_ARENA.x, TRIAL_ARENA.y, 6.5, RU);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(TRIAL_ARENA.x + Math.cos(a) * 5), Math.floor(TRIAL_ARENA.y + Math.sin(a) * 5), PI);
  }
  // portão do pátio e estrada de pedra até a entrada (sul), com um jardim na frente
  gr.rect(15, 18, 2, 13, P);
  gr.disc(16, 24, 3.5, G);
  gr.rect(15, 18, 2, 13, P);
  gr.rect(13, 22, 6, 4, PL);
  const seen = sealUnreachable(gr, 16, 27, T);
  if (!seen.has(TRIAL_ARENA.y * W + TRIAL_ARENA.x)) throw new Error('trial: arena inalcançável');
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vila', 'portal', 15, 29, 2, 2, { target: 'cidade', targetX: 16, targetY: 27.5 }),
  ];
  for (const [i, j] of [
    [13, 21],
    [18, 21],
  ])
    objs.push(point('lanterna_pedra', 'decor', i + 0.5, j + 0.5, { sprite: 'lanterna_pedra', block: 1 }));
  console.log(`trial: ${seen.size} tiles andáveis, arena em ${TRIAL_ARENA.x},${TRIAL_ARENA.y}`);
  return tiled('Trial', gr, objs);
}

// ---- Vale das Cinzas Rubras (nível 40, nv 30–35) ----
// Entrada a oeste (vinda do portão leste da Cidadela de Jade); trilha de terra entre rochas de basalto e árvores
// queimadas (tile 'basalt', bloqueia) sobre cinza vulcânica, cortada por um rio de lava. Clareiras do oeste e do
// centro com monstros nv 30–32; clareiras do leste e do norte com nv 33–35. A trilha das Ruínas do Palácio Celeste
// (portal com minLevel 35) sai junto da entrada, pela beira oeste, longe das clareiras (lição do nível 30).
function vale() {
  const rnd = rngFn(4030);
  const gr = makeGrid(AS, BS);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) if (rnd() < 0.4) gr.set(i, j, BS);
  gr.rect(1, 15, 9, 2, P);
  gr.rect(1, 10, 2, 6, P); // trilha do Palácio, pela beira oeste
  gr.rect(8, 11, 2, 6, P);
  gr.rect(8, 11, 9, 2, P);
  gr.rect(15, 2, 2, 11, P);
  gr.rect(16, 18, 10, 2, P);
  gr.rect(15, 12, 2, 8, P);
  // clareiras de cinza
  gr.disc(5, 22, 3.4, AS);
  gr.rect(4, 16, 2, 5, P);
  gr.disc(12, 23, 3.0, AS);
  gr.rect(11, 17, 2, 5, P);
  gr.rect(9, 17, 4, 2, P);
  gr.disc(22, 24, 3.4, AS);
  gr.rect(21, 19, 2, 4, P);
  gr.disc(26, 12, 3.4, AS);
  gr.rect(24, 13, 2, 6, P);
  gr.disc(8, 6, 3.2, AS);
  gr.rect(9, 9, 2, 3, P);
  gr.disc(24, 5, 3.2, AS);
  gr.rect(17, 5, 5, 2, P);
  // rio de lava atravessando o sul (a trilha do ramal passa por cima, numa ponte de pedra) e poças de lava
  for (let i = 13; i <= 19; i++) gr.set(i, 26, LV);
  gr.disc(17, 27, 1.2, LV);
  gr.disc(4, 9, 1.0, LV);
  gr.disc(28, 20, 1.0, LV);
  // altar de pedra (lajes) na clareira do centro
  gr.disc(16, 15, 1.6, RU);
  const seen = sealUnreachable(gr, 2, 16, BS);
  for (const [i, j, what] of [
    [1, 10, 'trilha do Palácio'],
    [16, 2, 'clareira norte'],
    [26, 12, 'clareira leste'],
    [5, 22, 'clareira sudoeste'],
    [24, 5, 'clareira nordeste'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`vale: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 3, 16),
    area('Cidadela de Jade', 'portal', 1, 15, 1, 2, { target: 'cidadela', targetX: 26, targetY: 16 }),
    area('Ruínas do Palácio Celeste', 'portal', 1, 10, 1, 2, {
      target: 'palacio',
      targetX: 16,
      targetY: 27.5,
      minLevel: 35,
    }),
  ];
  const { place, used } = placer('vale', gr, seen, rnd, objs, [
    { x: 3, y: 16 },
    { x: 1.5, y: 11 },
  ]);
  const and = (cx, cy, r, a, b) => place('Andarilho das Cinzas', 'andarilho_cinzas', cx, cy, r, a, b);
  const mon = (cx, cy, r, a, b) => place('Monge do Fogo Rubro', 'monge_fogo_rubro', cx, cy, r, a, b);
  // oeste e centro (nv 30–32)
  and(5, 22, 3.2, 30, 31);
  mon(5, 22, 3.2, 30, 31);
  and(12, 23, 2.8, 30, 32);
  mon(12, 23, 2.8, 31, 32);
  and(8, 6, 3.0, 31, 32);
  mon(8, 6, 3.0, 31, 32);
  and(14, 16.5, 3, 31, 32);
  // leste e norte (nv 33–35)
  and(22, 24, 3.2, 33, 34);
  mon(22, 24, 3.2, 33, 34);
  and(22, 24, 3.2, 33, 34);
  and(26, 12, 3.2, 33, 35);
  mon(26, 12, 3.2, 34, 35);
  mon(26, 12, 3.2, 33, 34);
  and(24, 5, 3.0, 34, 35);
  mon(24, 5, 3.0, 34, 35);
  and(24, 5, 3.0, 34, 35);
  console.log(`vale: ${seen.size} tiles andáveis, ${used.length} monstros`);
  return tiled('Vale das Cinzas Rubras', gr, objs);
}

// ---- Ruínas do Palácio Celeste (nível 40, nv 35–40) ----
// Sobre o mar de nuvens (tile 'cloud', bloqueia): entrada no sul (vinda do Vale); terraços de mármore sobem entre
// colunas caídas (tile 'pillar') e jardins de cerejeiras até o Salão do Trono no topo, arena do Imperador Carmesim
// (centro 16,6). Terraço baixo nv 35–37, terraço do meio nv 36–38, terraço alto nv 38–40.
const PALACIO_ARENA = { x: 16, y: 6, r: 5.5 };
function palacio() {
  const rnd = rngFn(4031);
  const gr = makeGrid(MB, CL);
  for (let j = 1; j < H - 1; j++)
    for (let i = 1; i < W - 1; i++) {
      const r = rnd();
      if (j < 12 || r < 0.4) gr.set(i, j, r < 0.1 ? PI : r < 0.16 ? T : CL);
    }
  // escadarias de lajes: entrada (16,28) -> terraço baixo -> meio -> alto -> salão
  gr.rect(15, 22, 2, 9, RU);
  gr.rect(6, 22, 20, 2, RU);
  gr.rect(6, 17, 2, 6, RU);
  gr.rect(24, 17, 2, 6, RU);
  gr.rect(6, 16, 20, 2, RU);
  gr.rect(15, 11, 2, 6, RU);
  // terraços de mármore
  gr.disc(7, 26, 3.0, MB);
  gr.disc(25, 26, 3.0, MB);
  gr.disc(4, 19.5, 2.6, MB);
  gr.disc(28, 19.5, 2.6, MB);
  gr.disc(16, 19.5, 2.4, MB);
  gr.disc(5, 13, 2.6, MB);
  gr.disc(27, 13, 2.6, MB);
  gr.rect(5, 13, 2, 4, MB);
  gr.rect(26, 13, 2, 4, MB);
  // Salão do Trono: muro de colunas com portão no sul; pátio de mármore com 6 braseiros
  gr.rect(8, 1, 16, 11, PI);
  gr.rect(9, 1, 14, 10, MB);
  gr.rect(15, 10, 2, 2, RU);
  gr.disc(PALACIO_ARENA.x, PALACIO_ARENA.y, 4.6, MB);
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + Math.PI / 6;
    gr.set(Math.floor(PALACIO_ARENA.x + Math.cos(a) * 4), Math.floor(PALACIO_ARENA.y + Math.sin(a) * 4), PI);
  }
  const seen = sealUnreachable(gr, 16, 27, CL);
  for (const [i, j, what] of [
    [16, 6, 'salão'],
    [5, 13, 'terraço alto oeste'],
    [27, 13, 'terraço alto leste'],
    [7, 26, 'terraço baixo oeste'],
  ])
    if (!seen.has(j * W + i)) throw new Error(`palacio: ${what} inalcançável`);
  const objs = [
    point('player', 'spawn', 16, 27.5),
    area('Vale das Cinzas Rubras', 'portal', 15, 29, 2, 2, { target: 'vale', targetX: 2.5, targetY: 11 }),
  ];
  const { place, used } = placer('palacio', gr, seen, rnd, objs, { x: 16, y: 27.5 });
  const fei = (cx, cy, r, a, b) => place('Feiticeira da Lua Fria', 'feiticeira_lua_fria', cx, cy, r, a, b);
  const gua = (cx, cy, r, a, b) => place('Guarda Celeste', 'guarda_celeste', cx, cy, r, a, b);
  // terraço baixo (nv 35–37)
  fei(7, 26, 2.8, 35, 36);
  fei(7, 26, 2.8, 35, 36);
  gua(25, 26, 2.8, 36, 37);
  fei(25, 26, 2.8, 35, 37);
  // terraço do meio (nv 36–38)
  fei(4, 19.5, 2.6, 36, 38);
  gua(4, 19.5, 2.6, 36, 38);
  fei(28, 19.5, 2.6, 36, 38);
  gua(28, 19.5, 2.6, 37, 38);
  gua(16, 19.5, 2.4, 36, 37);
  // terraço alto (nv 38–40)
  fei(5, 13, 2.8, 38, 40);
  gua(5, 13, 2.8, 38, 39);
  fei(5, 13, 2.8, 38, 39);
  fei(27, 13, 2.8, 38, 40);
  gua(27, 13, 2.8, 39, 40);
  gua(27, 13, 2.8, 38, 39);
  objs.push(
    point('Imperador Carmesim', 'monsterSpawn', PALACIO_ARENA.x, PALACIO_ARENA.y, { monster: 'imperador_carmesim' }),
  );
  console.log(`palacio: ${seen.size} tiles andáveis, salão alcançável, ${used.length} monstros + Imperador Carmesim`);
  return tiled('Ruínas do Palácio Celeste', gr, objs);
}

// ---- cidadela ----
// Cidadela de Jade (21/11/2026): cidade do meio do jogo, só pelo teleporte (nível 30). Cercada por muralha (torres nos
// cantos, portões fechados ao sul, a oeste e a leste); avenidas de pedra; ao norte o salão principal e o pagode; praça
// 12×12 com o incensário; lagos nos jardins; casas de dois andares com telhado de jade. Lojas com personagens
// próprios: forja (oeste), botica (leste) e banca da mercadora (junto do pagode); governador, monge e guardas de
// conversa. Sem saída a pé: chega-se e sai-se pelo Mestre dos Caminhos (círculo dourado na praça). Casas, muralha e colunas no atlas 'cidadela' (tools/sprites/render_cidadela.py).
function cidadela() {
  const rnd = rngFn(23);
  const gr = makeGrid(G, G); // fora da muralha: grama (árvores na borda cobririam a muralha da frente)
  gr.rect(3, 15, 26, 2, PL);
  gr.rect(15, 7, 2, 22, PL);
  gr.rect(10, 10, 12, 12, PL);
  const objs = [];
  const used = new Set();
  const reserve = (i, j, pad = 0) => {
    for (let y = j - pad; y <= j + pad; y++) for (let x = i - pad; x <= i + pad; x++) used.add(y * W + x);
  };
  const building = (sprite, i, j, w, h, atlas = 'cidadela') => {
    gr.rect(i, j, w, h, HS);
    for (let y = j - 1; y <= j + h; y++) for (let x = i - 1; x <= i + w; x++) reserve(x, y);
    objs.push(area(sprite, 'building', i, j, w, h, atlas ? { sprite, atlas } : { sprite }));
  };
  const decor = (sprite, i, j, extra = {}) => {
    gr.set(i, j, gr.get(i, j) === PL ? PL : G);
    reserve(i, j, 1);
    objs.push(point(sprite, 'decor', i + 0.5, j + 0.5, { sprite, block: 1, ...extra }));
  };
  const jade = { atlas: 'cidadela' };
  const npc = (name, id, x, y, extra = {}) => {
    reserve(Math.floor(x), Math.floor(y), 1);
    objs.push(point(name, 'npc', x, y, { npc: id, ...extra }));
  };
  const pond = (i, j) => {
    gr.rect(i, j, 3, 3, WA);
    for (let y = j - 1; y <= j + 3; y++) for (let x = i - 1; x <= i + 3; x++) reserve(x, y);
  };

  // muralha: torres nos cantos, trechos de 11 tiles e portões (fechados) no meio do sul, do oeste e do leste
  for (const [i, j] of [
    [1, 1],
    [29, 1],
    [1, 29],
    [29, 29],
  ])
    building('muralha_torre', i, j, 2, 2);
  building('muralha_i11', 3, 1, 11, 1);
  building('muralha_i4', 14, 1, 4, 1);
  building('muralha_i11', 18, 1, 11, 1);
  building('muralha_i11', 3, 30, 11, 1);
  building('portao_muralha_i', 14, 29, 4, 2);
  building('muralha_i11', 18, 30, 11, 1);
  for (const x of [1, 30]) {
    building('muralha_j11', x, 3, 1, 11);
    building('muralha_j11', x, 18, 1, 11);
  }
  building('portao_muralha_j', 1, 14, 2, 4);
  building('portao_muralha_j', 29, 14, 2, 4);
  // nível 40: o portão leste leva ao Vale das Cinzas Rubras (portal junto do portão, na ponta da avenida)
  objs.push(
    area('Vale das Cinzas Rubras', 'portal', 27, 15, 1, 2, { target: 'vale', targetX: 2.5, targetY: 16, minLevel: 30 }),
  );
  // nível 50: o portão sul leva ao Porto Noturno (portal na ponta sul da avenida, diante do portão)
  objs.push(area('Porto Noturno', 'portal', 15, 28, 2, 1, { target: 'porto', targetX: 48, targetY: 6, minLevel: 50 }));

  // norte: salão principal no fim da avenida, pagode ao lado
  building('jade_salao', 13, 3, 6, 4);
  building('jade_pagode', 21, 4, 3, 3);
  // casas e lagos dos jardins
  building('jade_casa_4x3', 4, 4, 4, 3);
  building('jade_casa_3x4', 9, 4, 3, 4);
  building('jade_casa_4x3', 25, 4, 4, 3);
  // lojas: forja a oeste e botica a leste da praça, de frente para a avenida; banca da mercadora junto do pagode
  building('jade_ferraria', 4, 10, 4, 3);
  building('jade_botica', 24, 10, 4, 3);
  building('jade_banca', 25, 7, 2, 2);
  building('jade_casa_3x3', 4, 20, 3, 3);
  building('jade_casa_3x4', 8, 24, 3, 4);
  building('jade_casa_4x3', 3, 26, 4, 3);
  pond(12, 24);
  building('jade_casa_3x3b', 25, 20, 3, 3);
  building('jade_casa_3x4', 22, 24, 3, 4);
  building('jade_casa_4x3', 25, 26, 4, 3);
  pond(18, 24);
  building('incensario', 15, 15, 2, 2, null);

  // praça: estandartes das quatro seitas nos cantos e lanternas de pedra nas bordas
  for (const [banner, i, j] of [
    ['tormenta', 10, 10],
    ['geada', 21, 10],
    ['tita', 10, 21],
    ['vibora', 21, 21],
  ])
    decor('estandarte_' + banner, i, j);
  for (const [i, j] of [
    [13, 10],
    [18, 10],
    [13, 21],
    [18, 21],
    [10, 13],
    [21, 13],
    [10, 18],
    [21, 18],
  ])
    decor('lanterna_pedra', i, j);
  // colunas ornamentais diante do salão e do portão sul; lanternas duplas nas avenidas
  for (const [i, j] of [
    [13, 8],
    [18, 8],
    [13, 27],
    [18, 27],
  ])
    decor('huabiao', i, j, jade);
  for (const [i, j] of [
    [5, 14],
    [5, 17],
    [8, 14],
    [8, 17],
    [23, 14],
    [23, 17],
    [26, 14],
    [26, 17],
    [14, 23],
    [17, 23],
  ])
    decor('lanterna_dupla', i, j, jade);
  for (const [s2, i, j] of [
    ['barril', 9, 11],
    ['caixotes', 23, 11],
    ['vaso', 12, 7],
    ['vaso', 19, 7],
  ])
    decor(s2, i, j);

  // Mestre dos Caminhos sobre o círculo dourado, no lado oeste da praça; chega-se ao lado dele
  npc('Mestre dos Caminhos', 'caminhos', 12.5, 17.5);
  objs.push(area('Círculo de Teleporte', 'teleCircle', 11.75, 16.75, 1.5, 1.5));
  // lojas da Cidadela: personagens próprios com o papel (role) das lojas da vila
  npc('Mestre Ferreiro Lin', 'ferreira_lin', 6.5, 13.5, { role: 'ferreiro' });
  npc('Boticário Wen', 'boticario_wen', 25.5, 13.5, { role: 'vendedor' });
  npc('Mercadora Jin', 'mercadora_jin', 25.6, 9.5, { role: 'mercador' });
  npc('Governador Bai', 'governador', 16, 7.5);
  npc('Monge do Pagode', 'monge_pagode', 22.5, 7.5, { role: 'meridianos' });
  for (const [x, y] of [
    [13.5, 28.4],
    [18.5, 28.4],
    [3.5, 13.5],
    [28.5, 13.5],
  ])
    npc('Guarda de Jade', 'guarda_jade', x, y);
  for (const [id, x, y] of [
    ['morador1', 18.5, 12.5],
    ['morador2', 19.5, 19.5],
    ['morador3', 7.5, 15.5],
    ['morador4', 15.5, 8.5],
  ])
    objs.push(point('Morador', 'npc', x, y, { npc: id, wander: 4 }));

  // cerejeiras e carvalhos só na grama livre, longe das avenidas e da praça
  reserve(13, 18, 1);
  let n = 0;
  for (let tries = 0; tries < 2000 && n < 18; tries++) {
    const x = 3 + Math.floor(rnd() * 26),
      y = 3 + Math.floor(rnd() * 26);
    if (gr.get(x, y) !== G || used.has(y * W + x)) continue;
    let nearRoad = false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (gr.get(x + dx, y + dy) === PL) nearRoad = true;
    if (nearRoad) continue;
    gr.set(x, y, T);
    n++;
  }
  sealUnreachable(gr, 13, 18, G);
  objs.unshift(point('player', 'spawn', 13.5, 18.5));
  return tiled('Cidadela de Jade', gr, objs);
}

// ---- porto ----
// Porto Noturno (23/11/2026, nível 50): cidade 96×96 do fim do jogo, sempre de noite (véu escuro e halos das
// lanternas, src/render/nightView.ts). Planta em docs/roadmap/cidade-porto-planta.svg (1 quadrado = 8×8 tiles):
// portão no norte (portal para a Cidadela de Jade), avenidas em cruz, praça central com o Mestre dos Caminhos;
// bairros: estábulo com cercado (noroeste), forja-mestre e joalheria (nordeste), casa de chá, jardim com lago,
// antiquário e banco/arena com o portal do Trial (sul); três canais com pontes de madeira; cais com o mercado noturno
// e quatro trapiches; mar ao sul com juncos (barcos) balançando. Casas e enfeites no atlas 'porto'
// (tools/sprites/render_porto.py); muralha e torres do atlas 'cidadela'.
const PORTO_W = 96;
function porto() {
  W = H = PORTO_W;
  const rnd = rngFn(50);
  const gr = makeGrid(G, G);
  const objs = [];
  const used = new Set();
  const reserve = (i, j, pad = 0) => {
    for (let y = j - pad; y <= j + pad; y++) for (let x = i - pad; x <= i + pad; x++) used.add(y * W + x);
  };
  const free = (i, j, w, h, pad = 1) => {
    for (let y = j - pad; y < j + h + pad; y++)
      for (let x = i - pad; x < i + w + pad; x++)
        if (x < 0 || y < 0 || x >= W || y >= H || gr.get(x, y) !== G || used.has(y * W + x)) return false;
    return true;
  };
  const building = (sprite, i, j, w, h, atlas = 'porto') => {
    gr.rect(i, j, w, h, HS);
    for (let y = j - 1; y <= j + h; y++) for (let x = i - 1; x <= i + w; x++) reserve(x, y);
    objs.push(area(sprite, 'building', i, j, w, h, { sprite, atlas }));
  };
  const decor = (sprite, x, y, extra = {}) => {
    reserve(Math.floor(x), Math.floor(y), 0);
    objs.push(point(sprite, 'decor', x, y, { sprite, atlas: 'porto', ...extra }));
  };
  const npc = (name, id, x, y, extra = {}) => {
    reserve(Math.floor(x), Math.floor(y), 1);
    objs.push(point(name, 'npc', x, y, { npc: id, ...extra }));
  };
  // trecho de muralha de n tiles: peças de 11, 4 e 1 (atlas cidadela e porto)
  const wallRun = (axis, a, b, fixed) => {
    let k = a;
    while (k <= b) {
      const n = b - k + 1;
      const len = n >= 11 ? 11 : n >= 4 ? 4 : 1;
      const [i, j, w, h] = axis === 'i' ? [k, fixed, len, 1] : [fixed, k, 1, len];
      building(`muralha_${axis}${len}`, i, j, w, h, len === 1 ? 'porto' : 'cidadela');
      k += len;
    }
  };

  // mar ao sul, cais de pedra e trapiches de tábuas
  gr.rect(0, 82, W, H - 82, WA);
  gr.rect(1, 74, W - 2, 8, PL);
  for (const x of [12, 30, 62, 80]) gr.rect(x, 82, 2, 5, DK);
  // avenidas em cruz e praça central
  gr.rect(45, 3, 6, 71, PL);
  gr.rect(2, 41, 92, 4, PL);
  gr.disc(47.5, 42.5, 8, PL);
  // vielas (terra batida)
  gr.rect(3, 19, 40, 2, P);
  gr.rect(22, 3, 2, 36, P);
  gr.rect(53, 20, 38, 2, P);
  gr.rect(72, 3, 2, 36, P);
  gr.rect(9, 47, 2, 26, P);
  gr.rect(62, 47, 2, 26, P);
  gr.rect(84, 47, 2, 13, P);
  // três canais até o mar, com pontes de tábuas (o tile 'deck' anda; o desenho da ponte fica por cima, achatado)
  gr.rect(20, 45, 3, 37, WA);
  gr.rect(73, 45, 2, 37, WA);
  gr.rect(92, 22, 2, 60, WA);
  const bridge = (x, y, w, h, sprite, cx, cy) => {
    gr.rect(x, y, w, h, DK);
    decor(sprite, cx, cy, { flat: 1 });
  };
  for (const y of [52, 63, 76]) bridge(20, y, 3, 2, 'ponte_i', 21.5, y + 1);
  for (const y of [52, 64, 76]) bridge(73, y, 2, 2, 'ponte_i', 74, y + 1);
  bridge(92, 41, 2, 4, 'ponte_i', 93, 42);
  bridge(92, 76, 2, 2, 'ponte_i', 93, 77);
  // jardim: lago com ponte comprida no meio
  for (let j = 54; j <= 66; j++)
    for (let i = 26; i <= 42; i++) if (((i - 34) / 7) ** 2 + ((j - 60) / 4.6) ** 2 <= 1) gr.set(i, j, WA);
  gr.rect(26, 59, 17, 2, DK);
  for (const x of [28.5, 31.5, 34.5, 37.5, 40.5]) decor('ponte_i', x, 60, { flat: 1 });

  // muralha: norte com o portão no meio, oeste e leste até o cais; torres nos cantos
  building('muralha_torre', 1, 1, 2, 2, 'cidadela');
  building('muralha_torre', 93, 1, 2, 2, 'cidadela');
  building('muralha_torre', 1, 72, 2, 2, 'cidadela');
  building('muralha_torre', 93, 72, 2, 2, 'cidadela');
  wallRun('i', 3, 45, 1);
  building('portao_muralha_i', 46, 1, 4, 2, 'cidadela');
  wallRun('i', 50, 92, 1);
  wallRun('j', 3, 71, 1);
  wallRun('j', 3, 21, 94);
  wallRun('j', 22, 71, 94);
  // portão: volta à Cidadela de Jade (portal livre; a ida, na Cidadela, pede nível 50)
  objs.push(area('Cidadela de Jade', 'portal', 46, 3, 4, 1, { target: 'cidadela', targetX: 16, targetY: 26.5 }));
  reserve(48, 4, 2);

  // bairros: casas da planta
  building('porto_estabulo', 25, 22, 6, 4);
  for (const [s2, i, j] of [
    ['cerca_i6', 25, 28],
    ['cerca_i6', 31, 28],
    ['cerca_i6', 25, 36],
    ['cerca_i6', 31, 36],
    ['cerca_j6', 24, 29],
    ['cerca_j6', 37, 29],
  ])
    building(s2, i, j, s2.endsWith('i6') ? 6 : 1, s2.endsWith('i6') ? 1 : 6);
  for (let y = 29; y <= 35; y++) for (let x = 25; x <= 36; x++) reserve(x, y);
  building('porto_forja', 75, 8, 5, 4);
  building('porto_joalheria', 75, 24, 4, 4);
  // frente da joalheria (porta em j 28): pátio de pedra até a viela, vitrine de joias com o Yu atrás,
  // geodo de ametista na porta e lanternas de pedra
  gr.rect(74, 28, 7, 3, PL);
  gr.rect(74, 24, 1, 4, PL);
  for (let y = 23; y <= 31; y++) for (let x = 73; x <= 81; x++) reserve(x, y);
  objs.push(area('vitrine_joias', 'building', 76, 29, 2, 1, { sprite: 'vitrine_joias', atlas: 'porto', block: 1 }));
  decor('expositor_gemas', 75.5, 28.5, { block: 1 });
  decor('expositor_gemas', 79.5, 28.5, { block: 1 });
  decor('lanterna_pedra', 74.5, 30.5, { atlas: 'cidade', block: 1, light: 1 });
  decor('lanterna_pedra', 80.5, 30.5, { atlas: 'cidade', block: 1, light: 1 });
  building('porto_casa_cha', 11, 56, 5, 4);
  building('porto_antiquario', 65, 55, 4, 4);
  // frente do antiquário (porta em j 59): leões de pedra na porta, banca de relíquias, jarros antigos e lanternas de pedra
  gr.rect(64, 59, 8, 4, PL);
  for (let y = 59; y <= 64; y++) for (let x = 63; x <= 72; x++) reserve(x, y);
  decor('leao_pedra', 65.5, 59.5, { block: 1 });
  decor('leao_pedra', 68.5, 59.5, { block: 1 });
  // banca sobre o piso de pedra: objeto 'building' com block (não vira tile de casa, que desenha grama)
  objs.push(area('banca_reliquias', 'building', 69, 60, 2, 1, { sprite: 'banca_reliquias', atlas: 'porto', block: 1 }));
  decor('jarros_antigos', 64.5, 60.5, { block: 1 });
  decor('lanterna_pedra', 64.5, 61.5, { atlas: 'cidade', block: 1, light: 1 });
  decor('lanterna_pedra', 71.5, 61.5, { atlas: 'cidade', block: 1, light: 1 });
  building('porto_banco', 78, 50, 5, 4);
  // arena do banco: pátio de lajes com o portal do Trial no meio
  gr.rect(77, 60, 14, 12, PL);
  for (let y = 59; y <= 72; y++) for (let x = 76; x <= 91; x++) reserve(x, y);
  objs.push(area('Trial', 'portal', 83, 65, 2, 2, { menu: 'trial', scale: 1.1 }));

  // praça: Mestre dos Caminhos no círculo dourado (oeste da praça)
  npc('Mestre dos Caminhos', 'caminhos', 44.5, 40.5);
  objs.push(area('Círculo de Teleporte', 'teleCircle', 43.75, 39.75, 1.5, 1.5));
  // NPCs movidos da Cidadela (etapas 2 a 4) e os novos do Porto
  npc('Cavalariço Ma', 'estabulo', 28, 27, { role: 'estabulo' });
  npc('Ferreiro-mestre Gang', 'ferreiro_mestre', 74, 13, { role: 'ferreiro_mestre' });
  npc('Joalheiro Yu', 'joalheiro', 77, 28.4, { role: 'joalheiro', face: 7 });
  npc('Antiquário Lao', 'antiquario', 67, 59.7, { role: 'antiquario', face: 7 });
  npc('Guarda do Portão', 'guarda_porto', 45.5, 5);
  npc('Guarda do Portão', 'guarda_porto', 50.5, 5);
  npc('Mestre do Cais', 'mestre_cais', 31, 80.5);
  npc('Vendedora Hua', 'vendedor_porto1', 27, 77, { role: 'vendedor' });
  npc('Vendedor Bo', 'vendedor_porto2', 37, 77, { role: 'vendedor' });
  npc('Vendedora Lan', 'vendedor_porto3', 57, 77, { role: 'vendedor' });

  // cais: barracas do mercado noturno, estacas nas pontas dos trapiches e postes de lanterna
  for (const [s2, i] of [
    ['barraca_vermelha', 26],
    ['barraca_ambar', 36],
    ['barraca_vermelha', 56],
    ['barraca_ambar', 66],
    ['barraca_vermelha', 14],
  ])
    building(s2, i, 74, 2, 2);
  for (const x of [12, 30, 62, 80]) decor('estacas_cais', x + 1, 86.5, { light: 1 });
  const post = (x, y) => decor('lanterna_poste', x + 0.5, y + 0.5, { block: 1, light: 1 });
  for (let x = 4; x < 92; x += 8) if (gr.get(x, 80) === PL) post(x, 80);
  for (let y = 7; y < 72; y += 8) {
    if (Math.abs(y - 42) < 9) continue;
    post(44, y);
    post(51, y);
  }
  for (let x = 6; x < 92; x += 10) {
    if (Math.abs(x - 47) < 9 || gr.get(x, 40) !== G) continue;
    post(x, 40);
    post(x, 45);
  }
  for (const [x, y] of [
    [76, 60],
    [90, 60],
    [76, 71],
    [90, 71],
    [39, 42],
    [56, 42],
    [47, 34],
    [47, 51],
  ])
    post(x, y);
  // vielas: postes ao longo de todas; alguns apagados (esqueceram de acender: sem halo, sem 'light')
  const unlit = (x, y) => decor('lanterna_poste', x + 0.5, y + 0.5, { block: 1 });
  for (const [x, y] of [
    [6, 18],
    [20, 18],
    [24, 6],
    [24, 13],
    [24, 20],
    [21, 27],
    [56, 19],
    [70, 19],
    [84, 19],
    [71, 6],
    [71, 13],
    [74, 13],
    [71, 27],
    [74, 34],
    [11, 64],
    [8, 71],
    [61, 57],
    [61, 64],
    [64, 71],
    [86, 50],
    [86, 57],
  ])
    post(x, y);
  for (const [x, y] of [
    [41, 18],
    [21, 20],
    [21, 34],
    [77, 22],
    [74, 6],
    [74, 20],
    [8, 57],
    [64, 50],
    [61, 71],
    [83, 57],
  ])
    unlit(x, y);
  // lanterninha de chão com luz suave junto de cada NPC (soft: halo fraco, clareia o NPC sem ofuscar)
  for (const [x, y, block] of [
    [45.4, 41.4, 1], // Mestre dos Caminhos
    [46.3, 5.8, 0], // guardas do portão (sem bloquear a passagem)
    [49.7, 5.8, 0],
    [31.9, 81.2, 1], // Mestre do Cais
    [27.9, 77.7, 1], // vendedores do cais
    [37.9, 77.7, 1],
    [57.9, 77.7, 1],
    [67.9, 60.5, 1], // Antiquário Lao
    [78.5, 28.5, 1], // Joalheiro Yu
  ])
    decor('lanterna_chao', x, y, { light: 1, soft: 1, ...(block ? { block: 1 } : {}) });
  // um poste aceso junto de cada NPC, para ele ser visto no escuro
  for (const [x, y] of [
    [45, 39],
    [27.5, 77.5],
    [37.5, 77.5],
    [57.5, 77.5],
    [44, 5],
    [51, 5],
    [31, 26],
  ])
    post(x, y);

  // mar: juncos (barcos) parados e balançando
  for (const [s2, x, y] of [
    ['junco_a', 8, 89],
    ['junco_b', 24, 91.5],
    ['junco_a', 45, 88],
    ['junco_b', 66, 92],
    ['junco_a', 85, 89.5],
    ['junco_b', 91, 93.5],
  ])
    objs.push(point(s2, 'decor', x, y, { sprite: s2, atlas: 'porto', boat: 1 }));

  // casas comuns enchendo os quarteirões (sem encostar em rua, praça nem nas casas da planta)
  const HOUSES = [
    ['porto_casa_4x3', 4, 3],
    ['porto_casa_3x4', 3, 4],
    ['porto_casa_3x3', 3, 3],
    ['porto_casa_5x4', 5, 4],
  ];
  let houses = 0;
  for (let j = 3; j < 73; j++)
    for (let i = 3; i < 92; i++) {
      if (rnd() > 0.5) continue;
      const [sp, w, h] = HOUSES[Math.floor(rnd() * HOUSES.length)];
      if (!free(i, j, w, h, 1)) continue;
      // jardim: só árvores
      if (i + w > 24 && i < 44 && j + h > 46 && j < 73) continue;
      building(sp, i, j, w, h);
      houses++;
    }
  // árvores (cerejeiras e carvalhos) nas sobras de grama longe das ruas
  let trees = 0;
  for (let j = 3; j < 73; j++)
    for (let i = 2; i < 93; i++) {
      if (gr.get(i, j) !== G || used.has(j * W + i) || rnd() > 0.22) continue;
      let nearRoad = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (gr.get(i + dx, j + dy) !== G) nearRoad = true;
      if (nearRoad) continue;
      gr.set(i, j, T);
      trees++;
    }
  const seen = sealUnreachable(gr, 48, 6, HS);
  for (const [x, y, what] of [
    [48, 42, 'praça'],
    [28, 27, 'estábulo'],
    [77, 13, 'forja'],
    [77, 29, 'joalheria'],
    [13, 61, 'casa de chá'],
    [67, 60, 'antiquário'],
    [83, 64, 'arena'],
    [31, 80, 'cais'],
    [31, 85, 'trapiche'],
  ])
    if (!seen.has(y * W + x)) throw new Error(`porto: ${what} inalcançável (${x},${y})`);
  objs.unshift(point('player', 'spawn', 48.5, 6.5));
  console.log(`porto: ${seen.size} tiles andáveis, ${houses} casas, ${trees} árvores, ${objs.length} objetos`);
  const map = tiled('Porto Noturno', gr, objs);
  W = H = 32;
  return map;
}

mkdirSync('public/maps', { recursive: true });
writeFileSync('public/maps/cidade.json', JSON.stringify(cidade()));
writeFileSync('public/maps/floresta.json', JSON.stringify(floresta()));
writeFileSync('public/maps/ruinas.json', JSON.stringify(ruinas()));
writeFileSync('public/maps/montanha.json', JSON.stringify(montanha()));
writeFileSync('public/maps/gruta.json', JSON.stringify(gruta()));
writeFileSync('public/maps/mosteiro.json', JSON.stringify(mosteiro()));
writeFileSync('public/maps/covil.json', JSON.stringify(covil()));
writeFileSync('public/maps/trial.json', JSON.stringify(trial()));
writeFileSync('public/maps/bambu.json', JSON.stringify(bambu()));
writeFileSync('public/maps/pico.json', JSON.stringify(pico()));
writeFileSync('public/maps/cidadela.json', JSON.stringify(cidadela()));
writeFileSync('public/maps/vale.json', JSON.stringify(vale()));
writeFileSync('public/maps/palacio.json', JSON.stringify(palacio()));
writeFileSync('public/maps/porto.json', JSON.stringify(porto()));
writeFileSync('public/maps/tiles.png', tilesetPng());
console.log('Mapas gerados em public/maps/');
