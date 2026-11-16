import Phaser from 'phaser';
import { tn } from '../core/i18n';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';

const TALL: Record<string, { key: string; oy: number; base?: string }> = {
  tree: { key: 'tile-tree', oy: 48 / 64 },
  pillar: { key: 'tile-pillar', oy: 48 / 64, base: 'tile-ruin' },
};

// Marco 6: piso, árvores e a cidade renderizados (public/sprites). Água e ruínas seguem placeholder.
// Folha 'pisos' (128x64, mostrada em 0,5): 0-2 grama, 3 caminho, 4-5 lajotas da praça.
// Casas ('house') só bloqueiam: o desenho vem dos objetos "building" do mapa (atlas props-cidade).
const GROUND: Record<string, number[]> = { grass: [0, 0, 0, 1, 2], path: [3], plaza: [4, 5], house: [0, 0, 0, 1, 2] };
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
  const ground = (name: string, i: number, j: number, x: number, y: number) => {
    const frames = GROUND[name];
    if (frames) return scene.add.image(x, y, 'pisos', pick(frames, hash(i, j, 1))).setScale(SPRITE_SCALE).setDepth(-100000);
    return scene.add.image(x, y, 'tile-' + name).setDepth(-100000);
  };
  for (let j = 0; j < map.height; j++) for (let i = 0; i < map.width; i++) {
    const name = map.tiles[j * map.width + i], pos = tileToScreen(i + 0.5, j + 0.5), tall = TALL[name];
    if (name === 'tree') {
      out.push(ground('grass', i, j, pos.x, pos.y));
      const r = hash(i, j, 2);
      const [atlas, frame] = map.id === 'cidade' ? pick(CITY_TREES, r) : ['props-floresta', pick(TREES, r)];
      const tree = scene.add.image(pos.x, pos.y, atlas, frame)
        .setScale(SPRITE_SCALE * (0.9 + 0.2 * hash(i, j, 3))).setFlipX(hash(i, j, 4) < 0.5).setDepth(i + j + 1);
      tree.setName('tree');
      out.push(tree);
    } else if (tall) {
      out.push(scene.add.image(pos.x, pos.y, tall.base ?? 'tile-grass').setDepth(-100000));
      out.push(scene.add.image(pos.x, pos.y, tall.key).setOrigin(0.5, tall.oy).setDepth(i + j + 1));
    } else {
      out.push(ground(name, i, j, pos.x, pos.y));
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
  for (const o of map.objects) {
    if (o.type !== 'portal') continue;
    const g = scene.add.graphics().setDepth(-90000);
    g.fillStyle(0xa060ff, 0.45); g.lineStyle(1, 0xe0c0ff, 0.9);
    for (let j = Math.floor(o.y); j < o.y + o.h; j++) for (let i = Math.floor(o.x); i < o.x + o.w; i++) {
      const pts = [tileToScreen(i, j), tileToScreen(i + 1, j), tileToScreen(i + 1, j + 1), tileToScreen(i, j + 1)];
      g.fillPoints(pts, true); g.strokePoints(pts, true);
    }
    scene.tweens.add({ targets: g, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });
    const c = tileToScreen(o.x + o.w / 2, o.y + o.h / 2);
    const label = scene.add.text(c.x, c.y - 20, tn(o.name), { fontSize: '13px', color: '#e8d0ff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(99999);
    out.push(g, label);
  }
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

/** Árvores na frente do jogador (e do alvo) ficam transparentes para eles não sumirem atrás delas. */
export function fadeTreesNear(trees: Phaser.GameObjects.Image[], who: { x: number; y: number; depth: number }[]) {
  fadeBuildings(trees.filter((t) => t.name === 'building'), who);
  for (const t of trees) {
    if (t.name === 'building') continue; // casas: fadeBuildings (a casa inteira junto)
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
