import Phaser from 'phaser';
import { tn } from '../core/i18n';
import { TILE_H, TILE_W, tileToScreen } from '../core/iso';
import type { GameMap, MapObject } from '../core/map';
import { ironGate } from './ironGate';
import { DEPTH } from './depth';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { bobBoats, buildNight } from './nightView';
import { animKey, sheetFor, sheetTexture } from './sprites';

// Marco 6: piso, árvores, cidade, ruínas, água e portais renderizados (public/sprites).
// Folha 'pisos' (128x64, mostrada em 0,5): 0-2 grama, 3 caminho, 4-5 lajotas da praça, 6-8 lajotas das ruínas,
// 9-11 água (3 quadros em ciclo), 12-14 neve e 15 lago congelado (marco 9).
// Casas ('house') só bloqueiam: o desenho vem dos objetos "building" do mapa (atlas props-cidade, ou o da prop atlas).
const GROUND: Record<string, number[]> = {
  grass: [0, 0, 0, 1, 2],
  path: [3],
  plaza: [4, 5],
  house: [0, 0, 0, 1, 2],
  ruin: [6, 6, 7, 8],
  snow: [12, 12, 13, 14],
  // nível 40: cinza vulcânica e lava (Vale das Cinzas Rubras), mármore e mar de nuvens (Palácio Celeste)
  ash: [16, 16, 17, 18],
  basalt: [16, 17],
  lava: [19],
  marble: [20, 21],
  cloud: [22],
  // nível 50 (Porto Noturno): tábuas do cais e das pontes
  deck: [23, 24],
};
const ICE_FRAME = 15; // água na montanha: lago congelado (parado)
// Montanha Nevada (atlas props-montanha): pinheiros (mais escuros, com geada e com neve) e pedras nevadas
const PINES = ['pinheiro', 'pinheiro', 'pinheiro_gelo', 'pinheiro_neve', 'pinheiro', 'pinheiro_gelo'];
const SNOW_DECOR = ['pedra_neve', 'pedra_neve', 'rocha_neve'];
const SNOW_DECOR_CHANCE = 0.035;
// Bosque de Bambu Sombrio (atlas props-bambu, nível 30): moitas no tile 'bamboo'; brotos e folhas soltos na grama
const BAMBOO = ['bambu_a', 'bambu_b', 'bambu_c', 'bambu_a', 'bambu_b'];
const BAMBOO_DECOR = ['brotos', 'folhas', 'folhas'];
// Vale das Cinzas Rubras (atlas props-vale, nível 40): o tile 'basalt' vira rocha ou árvore queimada; brasas na cinza
const VALE_OBST = ['rocha_basalto', 'arvore_cinza', 'rocha_basalto', 'arvore_brasa', 'arvore_cinza', 'rocha_basalto'];
const VALE_DECOR = ['pedra_brasa', 'tronco_queimado', 'pedra_brasa'];
const VALE_DECOR_CHANCE = 0.04;
const WATER_FRAMES = [9, 10, 11];
const WATER_MS = 420; // tempo de cada quadro da água
// ruínas (atlas props-ruinas): o que aparece em cada tile 'pillar' (bloqueado) e enfeites soltos no chão
// sem estátuas de argila: ficariam iguais aos guerreiros de terracota (o cenário fica em pedra fria)
const PILLARS = [
  'coluna_a',
  'coluna_b',
  'coluna_c',
  'coluna_c',
  'entulho',
  'entulho',
  'coluna_b',
  'coluna_d',
  'entulho',
];
const RUIN_DECOR = ['cacos', 'pedras', 'mato_seco', 'pedras', 'mato_seco'];
const RUIN_DECOR_CHANCE = 0.07;
const TREES = ['tree_oak', 'tree_default', 'tree_fat', 'tree_oak', 'tree_default', 'tree_pineRoundA'];
// cidade: mais cerejeiras (atlas props-cidade) que árvores comuns
const CITY_TREES: [string, string][] = [
  ['props-cidade', 'cerejeira'],
  ['props-cidade', 'cerejeira2'],
  ['props-cidade', 'cerejeira'],
  ['props-floresta', 'tree_oak'],
  ['props-floresta', 'tree_default'],
];
const STRIP = 32; // largura (px do jogo) das fatias das casas
// enfeites só visuais (não bloqueiam) em alguns tiles de grama da floresta
const DECOR = [
  'grass',
  'grass_large',
  'grass',
  'flower_redA',
  'flower_yellowA',
  'mushroom_red',
  'rock_smallA',
  'plant_bush',
  'stump_round',
];
const SPRITE_SCALE = 0.5; // folhas geradas em 2x

/** Algum vizinho (4 direções) do tile é do tipo `name`? (pilares do templo ficam em lajes, os da encosta na neve) */
function inside(map: GameMap, i: number, j: number, name: string): boolean {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => map.tiles[(j + dy) * map.width + i + dx] === name);
}

/** Número pseudoaleatório fixo por tile (o mapa fica sempre igual). */
function hash(i: number, j: number, salt: number): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = <T>(list: T[], r: number): T => list[Math.floor(r * list.length) % list.length];

export function buildMapView(scene: Phaser.Scene, map: GameMap): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const water: Phaser.GameObjects.Image[] = [];
  const ground = (name: string, i: number, j: number, x: number, y: number) => {
    const frames = GROUND[name] ?? GROUND.grass; // tipo de piso sem arte: grama (não deixa buraco no mapa)
    return scene.add
      .image(x, y, 'pisos', pick(frames, hash(i, j, 1)))
      .setScale(SPRITE_SCALE)
      .setDepth(DEPTH.GROUND);
  };
  const snowy = MAPS_CONFIG[map.id]?.trees === 'snow',
    bamboo = MAPS_CONFIG[map.id]?.trees === 'bamboo';
  for (let j = 0; j < map.height; j++)
    for (let i = 0; i < map.width; i++) {
      const name = map.tiles[j * map.width + i],
        pos = tileToScreen(i + 0.5, j + 0.5);
      if (name === 'water' && snowy) {
        out.push(scene.add.image(pos.x, pos.y, 'pisos', ICE_FRAME).setScale(SPRITE_SCALE).setDepth(DEPTH.GROUND));
        continue;
      }
      if (name === 'water') {
        const w = scene.add.image(pos.x, pos.y, 'pisos', WATER_FRAMES[0]).setScale(SPRITE_SCALE).setDepth(DEPTH.GROUND);
        w.setData('phase', Math.floor(hash(i, j, 11) * WATER_FRAMES.length));
        water.push(w);
        out.push(w);
        const edge = shore(scene, map, i, j);
        if (edge) out.push(edge);
        continue;
      }
      if (name === 'pillar') {
        // montanha: pedra solta na encosta vira rocha nevada; os pilares do templo (junto às lajes) continuam colunas
        const rock = snowy && !inside(map, i, j, 'ruin');
        out.push(ground(rock ? 'snow' : (MAPS_CONFIG[map.id]?.pillarGround ?? 'ruin'), i, j, pos.x, pos.y));
        const arena = MAPS_CONFIG[map.id]?.arena;
        const inArena = !!arena && Math.hypot(i + 0.5 - arena.x, j + 0.5 - arena.y) < arena.r;
        const frame = rock ? 'rocha_neve' : inArena ? 'braseiro' : pick(PILLARS, hash(i, j, 12));
        const p = scene.add
          .image(pos.x, pos.y, rock ? 'props-montanha' : 'props-ruinas', frame)
          .setScale(SPRITE_SCALE)
          .setFlipX(hash(i, j, 13) < 0.5)
          .setDepth(i + j + 1);
        p.setName('tree');
        out.push(p);
        continue;
      }
      if (name === 'tree' || name === 'pine' || name === 'bamboo' || name === 'basalt') {
        out.push(ground(name === 'pine' ? 'snow' : name === 'basalt' ? 'ash' : 'grass', i, j, pos.x, pos.y));
        const r = hash(i, j, 2);
        const [atlas, frame] =
          name === 'pine'
            ? ['props-montanha', pick(PINES, r)]
            : name === 'basalt'
              ? ['props-vale', pick(VALE_OBST, r)]
              : name === 'bamboo'
                ? ['props-bambu', pick(BAMBOO, r)]
                : MAPS_CONFIG[map.id]?.trees === 'city'
                  ? pick(CITY_TREES, r)
                  : ['props-floresta', pick(TREES, r)];
        const tree = scene.add
          .image(pos.x, pos.y, atlas, frame)
          .setScale(SPRITE_SCALE * (0.9 + 0.2 * hash(i, j, 3)))
          .setFlipX(hash(i, j, 4) < 0.5)
          .setDepth(i + j + 1);
        tree.setName('tree');
        out.push(tree);
      } else {
        out.push(ground(name, i, j, pos.x, pos.y));
        if (name === 'snow' && hash(i, j, 21) < SNOW_DECOR_CHANCE) {
          const d = scene.add
            .image(pos.x + (hash(i, j, 22) - 0.5) * 16, pos.y, 'props-montanha', pick(SNOW_DECOR, hash(i, j, 23)))
            .setScale(SPRITE_SCALE * 0.8)
            .setFlipX(hash(i, j, 24) < 0.5)
            .setDepth(i + j + 1);
          out.push(d);
        }
        if (name === 'ash' && hash(i, j, 25) < VALE_DECOR_CHANCE) {
          const d = scene.add
            .image(pos.x + (hash(i, j, 26) - 0.5) * 16, pos.y, 'props-vale', pick(VALE_DECOR, hash(i, j, 27)))
            .setScale(SPRITE_SCALE * 0.8)
            .setFlipX(hash(i, j, 28) < 0.5)
            .setDepth(i + j + 1);
          out.push(d);
        }
        if (name === 'ruin' && hash(i, j, 15) < RUIN_DECOR_CHANCE) {
          const d = scene.add
            .image(
              pos.x + (hash(i, j, 16) - 0.5) * 16,
              pos.y + (hash(i, j, 17) - 0.5) * 6,
              'props-ruinas',
              pick(RUIN_DECOR, hash(i, j, 18)),
            )
            .setScale(SPRITE_SCALE)
            .setFlipX(hash(i, j, 19) < 0.5)
            .setDepth(i + j + 1);
          out.push(d);
        }
        if (name === 'grass' && hash(i, j, 5) < (MAPS_CONFIG[map.id]?.grassDecor ?? 0)) {
          const d = scene.add
            .image(
              pos.x + (hash(i, j, 6) - 0.5) * 20,
              pos.y + (hash(i, j, 7) - 0.5) * 8,
              bamboo ? 'props-bambu' : 'props-floresta',
              pick(bamboo ? BAMBOO_DECOR : DECOR, hash(i, j, 8)),
            )
            .setScale(SPRITE_SCALE)
            .setFlipX(hash(i, j, 9) < 0.5)
            .setDepth(i + j + 1);
          out.push(d);
        }
      }
    }
  const boats: Phaser.GameObjects.Image[] = [];
  for (const o of map.objects) {
    if (o.type === 'building') out.push(...building(scene, propsAtlas(o), String(o.props.sprite), o.x, o.y, o.w, o.h));
    else if (o.type === 'decor') {
      const p = tileToScreen(o.x, o.y);
      // bicho parado animado no lugar (cavalos do estábulo): folha de personagem com a animação idle; sem a folha
      // carregada, cai no desenho fixo do atlas
      const sh = o.props.sheet ? sheetFor(String(o.props.sheet)) : null;
      if (sh && scene.textures.exists(sheetTexture(sh.key))) {
        const dir = Number(o.props.dir) || 0,
          key = animKey(sh.key, 'idle', dir);
        const sp = scene.add
          .sprite(p.x, p.y, sheetTexture(sh.key), `idle_${dir}_0`)
          .setOrigin(sh.meta.anchor[0], sh.meta.anchor[1])
          .setScale(sh.meta.scale * (Number(o.props.scale) || 1))
          .setDepth(Math.floor(o.x) + Math.floor(o.y) + 1);
        if (o.props.tint) sp.setTint(Number(o.props.tint));
        if (scene.anims.exists(key)) sp.play({ key, startFrame: Math.floor(o.x * 7 + o.y * 3) % 4 });
        sp.setName('tree');
        out.push(sp);
        continue;
      }
      const img = scene.add
        .image(p.x, p.y, propsAtlas(o), String(o.props.sprite))
        .setScale(SPRITE_SCALE)
        // parte de cima do portão: sempre por cima de quem passa embaixo; ponte (flat): rente ao chão, debaixo de todos
        .setDepth(
          o.props.top ? DEPTH.GATE_TOP : o.props.flat ? DEPTH.SHORE + 1 : Math.floor(o.x) + Math.floor(o.y) + 1,
        );
      if (!o.props.flat) img.setName('tree'); // fica transparente se cobrir o jogador
      if (o.props.boat) boats.push(img);
      out.push(img);
      // `fire`: chamas vivas saindo do topo (braseiros grandes da arena do Trial); o número é a altura em px
      if (o.props.fire)
        out.push(
          scene.add
            .particles(p.x, p.y - Number(o.props.fire), 'fx-dot', {
              x: { min: -12, max: 12 },
              lifespan: { min: 500, max: 900 },
              speedY: { min: -80, max: -40 },
              speedX: { min: -10, max: 10 },
              scale: { start: 1.4, end: 0.1 },
              alpha: { start: 1, end: 0 },
              tint: [0xffe080, 0xff9020, 0xff4010],
              frequency: 28,
              blendMode: 'ADD',
            })
            .setDepth(img.depth + 0.5),
        );
    } else if (o.type === 'teleCircle') out.push(...teleCircle(scene, o.x, o.y, o.w, o.h));
  }
  for (const o of map.objects) {
    if (o.type !== 'portal') continue;
    // portal na borda de cima/baixo fica de frente para o outro eixo: espelha o sprite
    const ns = Math.min(o.y, map.height - o.y - o.h) < Math.min(o.x, map.width - o.x - o.w);
    // `scale` no mapa força o tamanho do sprite (ex.: Trial, na borda de baixo, some se ficar pequeno)
    const sc = typeof o.props.scale === 'number' ? o.props.scale : Math.min(1, o.h / 3.2);
    out.push(...portal(scene, o, tn(o.name), ns, sc));
  }
  if (boats.length) bobBoats(scene, boats);
  out.push(...buildNight(scene, map));
  if (water.length) {
    // água: cada tile troca de quadro com sua própria fase (sem todos piscarem juntos)
    let k = 0;
    const timer = scene.time.addEvent({
      delay: WATER_MS,
      loop: true,
      callback: () => {
        k++;
        for (const w of water)
          if (w.active) w.setFrame(WATER_FRAMES[(k + (w.getData('phase') as number)) % WATER_FRAMES.length]);
      },
    });
    water[0].once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  }
  return out;
}

/** Espuma clara nas bordas da água que encostam em terra. */
function shore(scene: Phaser.Scene, map: GameMap, i: number, j: number): Phaser.GameObjects.Graphics | null {
  const isLand = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && map.tiles[y * map.width + x] !== 'water';
  // lados do losango: (i, j-1) = cima-direita, (i+1, j) = baixo-direita, (i, j+1) = baixo-esquerda, (i-1, j) = cima-esquerda
  const sides: [number, number, [number, number], [number, number]][] = [
    [i, j - 1, [i, j], [i + 1, j]],
    [i + 1, j, [i + 1, j], [i + 1, j + 1]],
    [i, j + 1, [i + 1, j + 1], [i, j + 1]],
    [i - 1, j, [i, j + 1], [i, j]],
  ];
  const land = sides.filter(([x, y]) => isLand(x, y));
  if (!land.length) return null;
  const g = scene.add.graphics().setDepth(DEPTH.SHORE);
  for (const [, , ta, tb] of land) {
    const a = tileToScreen(ta[0], ta[1]),
      b = tileToScreen(tb[0], tb[1]);
    // espuma na margem + uma segunda faixa mais fraca um pouco para dentro da água
    g.lineStyle(3, 0xd8ecf6, 0.55);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(2, 0x9cc8e4, 0.3);
    g.lineBetween(a.x, a.y + 2, b.x, b.y + 2);
  }
  return g;
}

/** Portal: porta-lua de pedra com véu de luz, chão brilhando e faíscas subindo. Nome sempre por cima. */
/** Círculo de teleporte do Mestre dos Caminhos: anéis dourados no chão (pulsam) e faíscas subindo. Não bloqueia. */
function teleCircle(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.GameObject[] {
  const c = tileToScreen(x + w / 2, y + h / 2),
    rx = (w * TILE_W) / 2,
    ry = (h * TILE_H) / 2;
  const g = scene.add.graphics().setDepth(DEPTH.PORTAL_FLOOR);
  g.fillStyle(0xffc94a, 0.18);
  g.fillEllipse(c.x, c.y, rx * 1.7, ry * 1.7);
  g.lineStyle(3, 0xffd36a, 0.85);
  g.strokeEllipse(c.x, c.y, rx * 1.7, ry * 1.7);
  g.lineStyle(2, 0xfff0b0, 0.7);
  g.strokeEllipse(c.x, c.y, rx * 1.15, ry * 1.15);
  g.lineStyle(1.5, 0xffd36a, 0.6);
  g.strokeEllipse(c.x, c.y, rx * 0.55, ry * 0.55);
  scene.tweens.add({ targets: g, alpha: 0.55, yoyo: true, repeat: -1, duration: 1300 });
  const sparks = scene.add
    .particles(c.x, c.y, 'fx-dot', {
      x: { min: -rx * 0.75, max: rx * 0.75 },
      y: { min: -ry * 0.6, max: ry * 0.6 },
      lifespan: 1500,
      speedY: { min: -34, max: -14 },
      speedX: { min: -3, max: 3 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffe08a, 0xffc94a, 0xffffff],
      frequency: 140,
      blendMode: 'ADD',
    })
    .setDepth(Math.floor(x + w / 2) + Math.floor(y + h / 2) + 1);
  return [g, sparks];
}

function portal(
  scene: Phaser.Scene,
  o: MapObject,
  name: string,
  flip = false,
  scale = 1,
): Phaser.GameObjects.GameObject[] {
  const { x, y, w, h } = o;
  // `noGate`: o arco é desenhado à parte (objeto 'building' próprio: pórtico do Trial, portão de ferro do Porto);
  // `glow`: cor do brilho do chão e das faíscas; `labelY`: altura do nome em px (padrão 92, acima do arco)
  const noGate = !!o.props.noGate,
    glow = typeof o.props.glow === 'number' ? o.props.glow : 0xa060ff,
    labelY = typeof o.props.labelY === 'number' ? o.props.labelY : 92;
  const tintOf = (c: number, k: number) => {
    const ch = (sh: number) => Math.round(((c >> sh) & 255) + (255 - ((c >> sh) & 255)) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const out: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics().setDepth(DEPTH.PORTAL_FLOOR);
  for (let j = Math.floor(y); j < y + h; j++)
    for (let i = Math.floor(x); i < x + w; i++) {
      const pts = [tileToScreen(i, j), tileToScreen(i + 1, j), tileToScreen(i + 1, j + 1), tileToScreen(i, j + 1)];
      g.fillStyle(glow, 0.28);
      g.fillPoints(pts, true);
    }
  const pulse = scene.tweens.add({ targets: g, alpha: 0.45, yoyo: true, repeat: -1, duration: 1100 });
  out.push(g);
  const c = tileToScreen(x + w / 2, y + h / 2);
  // portão de ferro (gate: 'ferro'): o brilho e as faíscas só aparecem com a grade aberta (src/render/ironGate.ts)
  let onOpen: ((k: number) => void) | null = null;
  if (o.props.gate === 'ferro')
    out.push(...ironGate(scene, o, Number(o.props.gateX) + Number(o.props.gateY) + 1.8, (k) => onOpen?.(k)).objects);
  const depth = Math.floor(x + w / 2) + Math.floor(y + h / 2) + 1;
  if (!noGate) {
    const gate = scene.add
      .image(c.x, c.y, 'props-ruinas', 'portal')
      .setScale(SPRITE_SCALE * scale)
      .setFlipX(flip)
      .setDepth(depth);
    gate.setName('tree');
    out.push(gate);
  }
  const sparks = scene.add
    .particles(c.x, c.y - 10, 'fx-dot', {
      x: { min: -28, max: 28 },
      y: { min: -6, max: 6 },
      lifespan: 1400,
      speedY: { min: -38, max: -16 },
      speedX: { min: -4, max: 4 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [tintOf(glow, 0.55), glow, tintOf(glow, 0.85)],
      frequency: 120,
      blendMode: 'ADD',
    })
    .setDepth(depth + 0.5);
  out.push(sparks);
  if (o.props.gate === 'ferro') {
    pulse.pause();
    onOpen = (k) => {
      g.setAlpha(0.4 * k);
      if (k > 0.5 && !sparks.emitting) sparks.start();
      else if (k <= 0.5 && sparks.emitting) sparks.stop();
    };
    onOpen(0);
  }
  const label = scene.add
    .text(c.x, c.y - (noGate && !o.props.labelY ? 175 : labelY) * scale, name, {
      fontSize: '13px',
      color: '#e8d0ff',
      stroke: '#000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.DROP_FX);
  out.push(label);
  return out;
}

/** Atlas de casas e enfeites: o da vila, ou o indicado na propriedade `atlas` do objeto (Cidadela: 'cidadela'). */
const propsAtlas = (o: MapObject) => `props-${o.props.atlas ? String(o.props.atlas) : 'cidade'}`;

/**
 * Casa (pegada w x h tiles a partir do tile x, y) em fatias verticais de STRIP px: cada fatia tem a
 * profundidade do ponto mais à frente da pegada naquela coluna da tela. Assim o personagem fica na
 * frente da parede quando está na frente e atrás quando está atrás (uma imagem só erraria nos lados).
 */
function building(
  scene: Phaser.Scene,
  atlas: string,
  sprite: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Image[] {
  const tex = scene.textures.get(atlas);
  const fr = tex.get(sprite);
  if (!fr || fr.name !== sprite) return [];
  const c = tileToScreen(x + w / 2, y + h / 2);
  const piv = fr as unknown as { pivotX: number; pivotY: number };
  const px = (fr.customPivot ? piv.pivotX : 0.5) * fr.width,
    py = (fr.customPivot ? piv.pivotY : 0.5) * fr.height;
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
    const img = scene.add
      .image(c.x + (sx - px) * SPRITE_SCALE, c.y - py * SPRITE_SCALE, atlas, key)
      .setOrigin(0, 0)
      .setScale(SPRITE_SCALE)
      .setDepth(front - 0.3);
    img.setName('building');
    img.setData('bld', `${x},${y}`);
    out.push(img);
  }
  return out;
}

/** Casas: se alguma fatia cobre o corpo do jogador (pixel não transparente), a casa toda fica transparente. */
function fadeBuildings(strips: Phaser.GameObjects.Image[], who: { x: number; y: number; depth: number }[]) {
  const hit = new Set<string>();
  for (const t of strips) {
    if (!t.visible) continue; // fora da tela (cullMap): não cobre ninguém
    for (const p of who) {
      if (!(t.depth > p.depth)) continue;
      const b = t.getBounds(),
        py = p.y - 24;
      if (p.x <= b.left || p.x >= b.right || py <= b.top || py >= b.bottom) continue;
      const a = t.scene.textures.getPixelAlpha(
        Math.floor((p.x - b.left) / t.scaleX),
        Math.floor((py - b.top) / t.scaleY),
        t.texture.key,
        t.frame.name,
      );
      if (a && a > 0) {
        hit.add(t.getData('bld'));
        break;
      }
    }
  }
  for (const t of strips) {
    const target = hit.has(t.getData('bld')) ? 0.45 : 1;
    if (t.alpha !== target)
      t.setAlpha(t.alpha + Math.sign(target - t.alpha) * Math.min(0.1, Math.abs(target - t.alpha)));
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
  if (
    !force &&
    Math.abs(v.x - lastCull.x) < 24 &&
    Math.abs(v.y - lastCull.y) < 24 &&
    v.width === lastCull.w &&
    v.height === lastCull.h
  )
    return;
  lastCull = { x: v.x, y: v.y, w: v.width, h: v.height };
  const left = v.x - 160,
    right = v.right + 160,
    top = v.y - 80,
    bottom = v.bottom + 320;
  for (const o of objs) {
    if (!(o instanceof Phaser.GameObjects.Image)) continue; // gráficos, partículas e textos ficam sempre
    // fatias de casa têm origem no canto de cima (0,0): testa o retângulo inteiro, não só o pivô
    if (o.originY === 0) {
      const x0 = o.x - 32,
        y0 = o.y - 32;
      o.setVisible(
        x0 < v.right + 32 && x0 + o.displayWidth + 64 > v.x && y0 < v.bottom + 32 && y0 + o.displayHeight + 64 > v.y,
      );
    } else o.setVisible(o.x > left && o.x < right && o.y > top && o.y < bottom);
  }
}

/** Árvores na frente do jogador (e do alvo) ficam transparentes para eles não sumirem atrás delas. */
const buildingStrips = new WeakMap<Phaser.GameObjects.Image[], Phaser.GameObjects.Image[]>();
export function fadeTreesNear(trees: Phaser.GameObjects.Image[], who: { x: number; y: number; depth: number }[]) {
  let strips = buildingStrips.get(trees); // a lista é a mesma até trocar de mapa: filtra uma vez só
  if (!strips) buildingStrips.set(trees, (strips = trees.filter((t) => t.name === 'building')));
  fadeBuildings(strips, who);
  for (const t of trees) {
    if (t.name === 'building' || !t.visible) continue; // casas: fadeBuildings (a casa inteira junto)
    let covers = false;
    for (const p of who) {
      if (t.depth > p.depth && Math.abs(t.x - p.x) < 100 && t.y > p.y && t.y - 220 < p.y) {
        const b = t.getBounds();
        if (p.x > b.left - 8 && p.x < b.right + 8 && p.y - 24 > b.top && p.y - 24 < b.bottom) {
          covers = true;
          break;
        }
      }
    }
    const target = covers ? 0.4 : 1;
    if (t.alpha !== target)
      t.setAlpha(t.alpha + Math.sign(target - t.alpha) * Math.min(0.1, Math.abs(target - t.alpha)));
  }
}
