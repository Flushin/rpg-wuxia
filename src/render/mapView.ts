import Phaser from 'phaser';
import { tn } from '../core/i18n';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';

// Marco 6: piso, árvores, cidade, ruínas, água e portais renderizados (public/sprites).
// Folha 'pisos' (128x64, mostrada em 0,5): 0-2 grama, 3 caminho, 4-5 lajotas da praça, 6-8 lajotas das ruínas,
// 9-11 água (3 quadros em ciclo).
// Casas ('house') só bloqueiam: o desenho vem dos objetos "building" do mapa (atlas props-cidade).
const GROUND: Record<string, number[]> = { grass: [0, 0, 0, 1, 2], path: [3], plaza: [4, 5], house: [0, 0, 0, 1, 2], ruin: [6, 6, 7, 8] };
const WATER_FRAMES = [9, 10, 11];
const WATER_MS = 420; // tempo de cada quadro da água
// ruínas (atlas props-ruinas): o que aparece em cada tile 'pillar' (bloqueado) e enfeites soltos no chão
// sem estátuas de argila: ficariam iguais aos guerreiros de terracota (o cenário fica em pedra fria)
const PILLARS = ['coluna_a', 'coluna_b', 'coluna_c', 'coluna_c', 'entulho', 'entulho', 'coluna_b', 'coluna_d', 'entulho'];
const RUIN_DECOR = ['cacos', 'pedras', 'mato_seco', 'pedras', 'mato_seco'];
const RUIN_DECOR_CHANCE = 0.07;
const ARENA = { x: 24.5, y: 16.5, r: 6.2 }; // pilares em volta do General viram braseiros
const TREES = ['tree_oak', 'tree_default', 'tree_fat', 'tree_oak', 'tree_default', 'tree_pineRoundA'];
// cidade: mais cerejeiras (atlas props-cidade) que árvores comuns
const CITY_TREES: [string, string][] = [['props-cidade', 'cerejeira'], ['props-cidade', 'cerejeira2'], ['props-cidade', 'cerejeira'],
  ['props-floresta', 'tree_oak'], ['props-floresta', 'tree_default']];
const STRIP = 32; // largura (px do jogo) das fatias das casas
// enfeites só visuais (não bloqueiam) em alguns tiles de grama da floresta
const DECOR = ['grass', 'grass_large', 'grass', 'flower_redA', 'flower_yellowA', 'mushroom_red', 'rock_smallA', 'plant_bush', 'stump_round'];
const DECOR_MAPS: Record<string, number> = { floresta: 0.09, cidade: 0.035 }; // chance por tile de grama
const SPRITE_SCALE = 0.5; // folhas geradas em 2x

/** Número pseudoaleatório fixo por tile (o mapa fica sempre igual). */
function hash(i: number, j: number, salt: number): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = <T,>(list: T[], r: number): T => list[Math.floor(r * list.length) % list.length];

export function buildMapView(scene: Phaser.Scene, map: GameMap): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const water: Phaser.GameObjects.Image[] = [];
  const ground = (name: string, i: number, j: number, x: number, y: number) => {
    const frames = GROUND[name];
    if (frames) return scene.add.image(x, y, 'pisos', pick(frames, hash(i, j, 1))).setScale(SPRITE_SCALE).setDepth(-100000);
    return scene.add.image(x, y, 'tile-' + name).setDepth(-100000);
  };
  for (let j = 0; j < map.height; j++) for (let i = 0; i < map.width; i++) {
    const name = map.tiles[j * map.width + i], pos = tileToScreen(i + 0.5, j + 0.5);
    if (name === 'water') {
      const w = scene.add.image(pos.x, pos.y, 'pisos', WATER_FRAMES[0]).setScale(SPRITE_SCALE).setDepth(-100000);
      w.setData('phase', Math.floor(hash(i, j, 11) * WATER_FRAMES.length));
      water.push(w); out.push(w);
      const edge = shore(scene, map, i, j);
      if (edge) out.push(edge);
      continue;
    }
    if (name === 'pillar') {
      out.push(ground('ruin', i, j, pos.x, pos.y));
      const inArena = Math.hypot(i + 0.5 - ARENA.x, j + 0.5 - ARENA.y) < ARENA.r && map.id === 'ruinas';
      const frame = inArena ? 'braseiro' : pick(PILLARS, hash(i, j, 12));
      const p = scene.add.image(pos.x, pos.y, 'props-ruinas', frame).setScale(SPRITE_SCALE).setFlipX(hash(i, j, 13) < 0.5).setDepth(i + j + 1);
      p.setName('tree');
      out.push(p);
      continue;
    }
    if (name === 'tree') {
      out.push(ground('grass', i, j, pos.x, pos.y));
      const r = hash(i, j, 2);
      const [atlas, frame] = map.id === 'cidade' ? pick(CITY_TREES, r) : ['props-floresta', pick(TREES, r)];
      const tree = scene.add.image(pos.x, pos.y, atlas, frame)
        .setScale(SPRITE_SCALE * (0.9 + 0.2 * hash(i, j, 3))).setFlipX(hash(i, j, 4) < 0.5).setDepth(i + j + 1);
      tree.setName('tree');
      out.push(tree);
    } else {
      out.push(ground(name, i, j, pos.x, pos.y));
      if (name === 'ruin' && hash(i, j, 15) < RUIN_DECOR_CHANCE) {
        const d = scene.add.image(pos.x + (hash(i, j, 16) - 0.5) * 16, pos.y + (hash(i, j, 17) - 0.5) * 6, 'props-ruinas', pick(RUIN_DECOR, hash(i, j, 18)))
          .setScale(SPRITE_SCALE).setFlipX(hash(i, j, 19) < 0.5).setDepth(i + j + 1);
        out.push(d);
      }
      if (name === 'grass' && hash(i, j, 5) < (DECOR_MAPS[map.id] ?? 0)) {
        const d = scene.add.image(pos.x + (hash(i, j, 6) - 0.5) * 20, pos.y + (hash(i, j, 7) - 0.5) * 8, 'props-floresta', pick(DECOR, hash(i, j, 8)))
          .setScale(SPRITE_SCALE).setFlipX(hash(i, j, 9) < 0.5).setDepth(i + j + 1);
        out.push(d);
      }
    }
  }
  for (const o of map.objects) {
    if (o.type === 'building') out.push(...building(scene, String(o.props.sprite), o.x, o.y, o.w, o.h));
    else if (o.type === 'decor') {
      const p = tileToScreen(o.x, o.y);
      const img = scene.add.image(p.x, p.y, 'props-cidade', String(o.props.sprite)).setScale(SPRITE_SCALE)
        // parte de cima do portão: sempre por cima de quem passa embaixo
        .setDepth(o.props.top ? 99990 : Math.floor(o.x) + Math.floor(o.y) + 1);
      img.setName('tree'); // fica transparente se cobrir o jogador
      out.push(img);
    }
  }
  for (const o of map.objects) if (o.type === 'portal') out.push(...portal(scene, o.x, o.y, o.w, o.h, tn(o.name)));
  if (water.length) {
    // água: cada tile troca de quadro com sua própria fase (sem todos piscarem juntos)
    let k = 0;
    const timer = scene.time.addEvent({ delay: WATER_MS, loop: true, callback: () => {
      k++;
      for (const w of water) if (w.active) w.setFrame(WATER_FRAMES[(k + (w.getData('phase') as number)) % WATER_FRAMES.length]);
    } });
    water[0].once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  }
  return out;
}

/** Espuma clara nas bordas da água que encostam em terra. */
function shore(scene: Phaser.Scene, map: GameMap, i: number, j: number): Phaser.GameObjects.Graphics | null {
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && map.tiles[y * map.width + x] !== 'water';
  // lados do losango: (i, j-1) = cima-direita, (i+1, j) = baixo-direita, (i, j+1) = baixo-esquerda, (i-1, j) = cima-esquerda
  const sides: [number, number, [number, number], [number, number]][] = [
    [i, j - 1, [i, j], [i + 1, j]], [i + 1, j, [i + 1, j], [i + 1, j + 1]],
    [i, j + 1, [i + 1, j + 1], [i, j + 1]], [i - 1, j, [i, j + 1], [i, j]],
  ];
  const land = sides.filter(([x, y]) => isLand(x, y));
  if (!land.length) return null;
  const g = scene.add.graphics().setDepth(-99999);
  for (const [, , ta, tb] of land) {
    const a = tileToScreen(ta[0], ta[1]), b = tileToScreen(tb[0], tb[1]);
    // espuma na margem + uma segunda faixa mais fraca um pouco para dentro da água
    g.lineStyle(3, 0xd8ecf6, 0.55); g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(2, 0x9cc8e4, 0.3); g.lineBetween(a.x, a.y + 2, b.x, b.y + 2);
  }
  return g;
}

/** Portal: porta-lua de pedra com véu de luz, chão brilhando e faíscas subindo. Nome sempre por cima. */
function portal(scene: Phaser.Scene, x: number, y: number, w: number, h: number, name: string): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics().setDepth(-90000);
  for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) {
    const pts = [tileToScreen(i, j), tileToScreen(i + 1, j), tileToScreen(i + 1, j + 1), tileToScreen(i, j + 1)];
    g.fillStyle(0xa060ff, 0.28); g.fillPoints(pts, true);
  }
  scene.tweens.add({ targets: g, alpha: 0.45, yoyo: true, repeat: -1, duration: 1100 });
  out.push(g);
  const c = tileToScreen(x + w / 2, y + h / 2);
  const gate = scene.add.image(c.x, c.y, 'props-ruinas', 'portal').setScale(SPRITE_SCALE * Math.min(1, h / 3.2))
    .setDepth(Math.floor(x + w / 2) + Math.floor(y + h / 2) + 1);
  gate.setName('tree');
  out.push(gate);
  const sparks = scene.add.particles(c.x, c.y - 10, 'fx-dot', {
    x: { min: -28, max: 28 }, y: { min: -6, max: 6 }, lifespan: 1400, speedY: { min: -38, max: -16 }, speedX: { min: -4, max: 4 },
    scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xd8b8ff, 0xa070ff, 0xffffff], frequency: 120, blendMode: 'ADD',
  }).setDepth(gate.depth + 0.5);
  out.push(sparks);
  const label = scene.add.text(c.x, c.y - 92 * Math.min(1, h / 3.2), name, { fontSize: '13px', color: '#e8d0ff', stroke: '#000', strokeThickness: 3 })
    .setOrigin(0.5).setDepth(99999);
  out.push(label);
  return out;
}

/**
 * Casa (pegada w x h tiles a partir do tile x, y) em fatias verticais de STRIP px: cada fatia tem a
 * profundidade do ponto mais à frente da pegada naquela coluna da tela. Assim o personagem fica na
 * frente da parede quando está na frente e atrás quando está atrás (uma imagem só erraria nos lados).
 */
function building(scene: Phaser.Scene, sprite: string, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image[] {
  const tex = scene.textures.get('props-cidade');
  const fr = tex.get(sprite);
  if (!fr || fr.name !== sprite) return [];
  const c = tileToScreen(x + w / 2, y + h / 2);
  const piv = (fr as unknown as { pivotX: number; pivotY: number });
  const px = (fr.customPivot ? piv.pivotX : 0.5) * fr.width, py = (fr.customPivot ? piv.pivotY : 0.5) * fr.height;
  const out: Phaser.GameObjects.Image[] = [];
  const stripTex = STRIP / SPRITE_SCALE; // largura da fatia em px da textura (2x)
  for (let sx = 0; sx < fr.width; sx += stripTex) {
    const sw = Math.min(stripTex, fr.width - sx);
    const key = `${sprite}#${sx}`;
    if (!tex.has(key)) tex.add(key, fr.sourceIndex, fr.cutX + sx, fr.cutY, sw, fr.height);
    // coluna da tela (em tiles: i - j) no meio da fatia
    const colX = c.x + (sx + sw / 2 - px) * SPRITE_SCALE;
    const cIJ = colX / 32;
    // ponto mais à frente da pegada com i - j = cIJ: maior i + j dentro do retângulo
    const front = Math.min(2 * (x + w) - cIJ, 2 * (y + h) + cIJ);
    const img = scene.add.image(c.x + (sx - px) * SPRITE_SCALE, c.y - py * SPRITE_SCALE, 'props-cidade', key)
      .setOrigin(0, 0).setScale(SPRITE_SCALE).setDepth(front - 0.3);
    img.setName('building'); img.setData('bld', `${x},${y}`);
    out.push(img);
  }
  return out;
}

/** Casas: se alguma fatia cobre o corpo do jogador (pixel não transparente), a casa toda fica transparente. */
function fadeBuildings(strips: Phaser.GameObjects.Image[], who: { x: number; y: number; depth: number }[]) {
  const hit = new Set<string>();
  for (const t of strips) {
    for (const p of who) {
      if (!(t.depth > p.depth)) continue;
      const b = t.getBounds(), py = p.y - 24;
      if (p.x <= b.left || p.x >= b.right || py <= b.top || py >= b.bottom) continue;
      const a = t.scene.textures.getPixelAlpha(Math.floor((p.x - b.left) / t.scaleX), Math.floor((py - b.top) / t.scaleY), t.texture.key, t.frame.name);
      if (a && a > 0) { hit.add(t.getData('bld')); break; }
    }
  }
  for (const t of strips) {
    const target = hit.has(t.getData('bld')) ? 0.45 : 1;
    if (t.alpha !== target) t.setAlpha(t.alpha + Math.sign(target - t.alpha) * Math.min(0.1, Math.abs(target - t.alpha)));
  }
}

/**
 * Desempenho (marco 6): esconde do desenho os objetos do mapa longe da câmera (piso, árvores, casas, enfeites).
 * O Phaser manda todo objeto visível para a placa de vídeo, mesmo fora da tela; o mapa tem ~1.300 objetos.
 * Só refaz quando a câmera anda mais de 24 px. Margens largas: objetos altos (árvores, portal) passam do pivô.
 */
let lastCull = { x: NaN, y: NaN, w: 0, h: 0 };
export function cullMap(objs: Phaser.GameObjects.GameObject[], cam: Phaser.Cameras.Scene2D.Camera, force = false) {
  const v = cam.worldView;
  if (!force && Math.abs(v.x - lastCull.x) < 24 && Math.abs(v.y - lastCull.y) < 24 && v.width === lastCull.w && v.height === lastCull.h) return;
  lastCull = { x: v.x, y: v.y, w: v.width, h: v.height };
  const left = v.x - 160, right = v.right + 160, top = v.y - 80, bottom = v.bottom + 320;
  for (const o of objs) {
    if (!(o instanceof Phaser.GameObjects.Image)) continue; // gráficos, partículas e textos ficam sempre
    o.setVisible(o.x > left && o.x < right && o.y > top && o.y < bottom);
  }
}

/** Árvores na frente do jogador (e do alvo) ficam transparentes para eles não sumirem atrás delas. */
export function fadeTreesNear(trees: Phaser.GameObjects.Image[], who: { x: number; y: number; depth: number }[]) {
  fadeBuildings(trees.filter((t) => t.name === 'building'), who);
  for (const t of trees) {
    if (t.name === 'building' || !t.visible) continue; // casas: fadeBuildings (a casa inteira junto)
    let covers = false;
    for (const p of who) {
      if (t.depth > p.depth && Math.abs(t.x - p.x) < 100 && t.y > p.y && t.y - 220 < p.y) {
        const b = t.getBounds();
        if (p.x > b.left - 8 && p.x < b.right + 8 && p.y - 24 > b.top && p.y - 24 < b.bottom) { covers = true; break; }
      }
    }
    const target = covers ? 0.4 : 1;
    if (t.alpha !== target) t.setAlpha(t.alpha + Math.sign(target - t.alpha) * Math.min(0.1, Math.abs(target - t.alpha)));
  }
}
