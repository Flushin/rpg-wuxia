import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';

/**
 * Padrão "portão de ferro" para portais em portões de muralha (Porto Noturno; reaproveitável na Cidadela e em
 * outras cidades). O portal no mapa leva as propriedades:
 *   gate: 'ferro', gateX/gateY: centro (em tiles) da pegada do portão da muralha, gateAtlas: atlas dos sprites
 *   (padrão 'porto'), glow: cor da névoa.
 * Desenha a grade levadiça fechada (sprite 'grade_ferro_i') no vão do arco; quando o herói (centro da câmera)
 * chega perto, a grade sobe para dentro da parede e a névoa do teleporte ('nevoa_ferro_i'), as faíscas e o brilho
 * do chão aparecem; ao se afastar, tudo volta. Os dois sprites têm a mesma pegada e centro do portão
 * (tools/sprites/render_porto.py), então ficam alinhados sem ajuste.
 *
 * Variante `gate: 'porta'` (Cidadela de Jade): o portão continua o mesmo (building portao_muralha_i/j); ao chegar
 * perto, as duas folhas de laca abrem para fora (quadros 'portao_muralha_<eixo>_1..4' sobre o building) e só então
 * aparece a névoa branca/azul-gelo ('nevoa_gelo_<eixo>', já recortada pelas portas). Prop `gateAxis`: 'i' (muralha
 * norte/sul, vão na face -y) ou 'j' (leste/oeste, vão na face +x); atlas padrão 'cidadela'.
 */

// vão do arco na face da frente do portão, em unidades do Blender (x ao longo da muralha, y = -face, z altura)
const OPEN = { x0: -0.72, x1: 0.72, y: -0.98, z0: 0.3, z1: 1.62 };
const ZPX = (64 / Math.SQRT2) * Math.cos(Math.atan(0.5)); // px de tela por unidade de altura (render_town.ZPX)
const RISE = 1.2; // quanto a grade sobe (unidades) ao abrir
const NEAR = 170; // px: distância do herói ao portão para abrir

/** Ponto do Blender (relativo ao centro da pegada) em px de tela relativos ao centro. */
const proj = (x: number, y: number, z: number) => ({ x: (x + y) * 32, y: (x - y) * 16 - z * ZPX });

export interface IronGate {
  objects: Phaser.GameObjects.GameObject[];
  /** centro do vão em px de mundo (faíscas do portal). */
  mouth: { x: number; y: number };
  /** 0 (fechado) a 1 (aberto); lido pelo brilho do chão, faíscas e luz noturna. */
  open: () => number;
}

const gates = new WeakMap<object, IronGate>();
/** Portão de ferro criado para este objeto de mapa (para a luz noturna acompanhar a abertura). */
export const ironGateOf = (o: object) => gates.get(o);

export function ironGate(
  scene: Phaser.Scene,
  o: { props: Record<string, unknown> },
  depth: number,
  onOpen: (k: number) => void,
): IronGate {
  const door = o.props.gate === 'porta',
    ax = o.props.gateAxis === 'j' ? 'j' : 'i';
  const gx = Number(o.props.gateX),
    gy = Number(o.props.gateY),
    atlas = `props-${o.props.gateAtlas ? String(o.props.gateAtlas) : door ? 'cidadela' : 'porto'}`;
  const c = tileToScreen(gx, gy);
  const st = { k: 0 };
  const zm = (OPEN.z0 + OPEN.z1) / 2,
    m = ax === 'i' ? proj(0, OPEN.y, zm) : proj(-OPEN.y, 0, zm);
  const mouth = { x: c.x + m.x, y: c.y + m.y };
  if (door) return doorGate(scene, o, depth, onOpen, atlas, ax, c, mouth);
  // máscara no formato do vão: a grade e a névoa só aparecem dentro do arco (a grade some na parede ao subir)
  const pts = [
    proj(OPEN.x0, OPEN.y, OPEN.z0),
    proj(OPEN.x1, OPEN.y, OPEN.z0),
    proj(OPEN.x1, OPEN.y, OPEN.z1),
    proj(OPEN.x0, OPEN.y, OPEN.z1),
  ].map((p) => ({ x: c.x + p.x, y: c.y + p.y + 8 }));
  const shape = scene.make.graphics({}, false);
  shape.fillStyle(0xffffff);
  shape.fillPoints(pts, true);
  const mask = shape.createGeometryMask();
  const mist = scene.add.image(c.x, c.y, atlas, 'nevoa_ferro_i').setScale(0.5).setDepth(depth).setAlpha(0);
  const grate = scene.add
    .image(c.x, c.y, atlas, 'grade_ferro_i')
    .setScale(0.5)
    .setDepth(depth + 0.1);
  mist.setMask(mask);
  grate.setMask(mask);
  const apply = () => {
    grate.y = c.y - st.k * RISE * ZPX;
    mist.setAlpha(st.k);
    onOpen(st.k);
  };
  // ao fechar a grade cai e quica
  watchNear(scene, grate, c, st, apply, 900, 700, 'Cubic.Out', 'Bounce.Out', () => shape.destroy());
  apply();
  const g: IronGate = { objects: [mist, grate], open: () => st.k, mouth };
  gates.set(o, g);
  return g;
}

/** Abre (k → 1) quando o centro da câmera chega a NEAR px de `c`; fecha ao se afastar. */
function watchNear(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject,
  c: { x: number; y: number },
  st: { k: number },
  apply: () => void,
  tOpen: number,
  tClose: number,
  eOpen: string,
  eClose: string,
  cleanup?: () => void,
) {
  let target = 0,
    tween: Phaser.Tweens.Tween | null = null;
  const check = () => {
    const v = scene.cameras.main.worldView;
    const want = Phaser.Math.Distance.Between(v.centerX, v.centerY, c.x, c.y) < NEAR ? 1 : 0;
    if (want === target) return;
    target = want;
    tween?.stop();
    tween = scene.tweens.add({
      targets: st,
      k: want,
      duration: want ? tOpen : tClose,
      ease: want ? eOpen : eClose,
      onUpdate: apply,
    });
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, check);
  owner.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, check);
    tween?.stop();
    cleanup?.();
  });
}

const DOOR_FRAMES = 4; // portao_muralha_<eixo>_1..4 (tools/sprites/render_cidadela.py GATE_OPEN)

/** Variante 'porta': folhas abrindo para fora (quadros sobre o building) e névoa de gelo depois de abertas. */
function doorGate(
  scene: Phaser.Scene,
  o: { props: Record<string, unknown> },
  depth: number,
  onOpen: (k: number) => void,
  atlas: string,
  ax: string,
  c: { x: number; y: number },
  mouth: { x: number; y: number },
): IronGate {
  const st = { k: 0 };
  const leaves = scene.add
    .image(c.x, c.y, atlas, `portao_muralha_${ax}_1`)
    .setScale(0.5)
    .setDepth(depth)
    .setVisible(false);
  const mist = scene.add
    .image(c.x, c.y, atlas, `nevoa_gelo_${ax}`)
    .setScale(0.5)
    .setDepth(depth + 0.1)
    .setAlpha(0);
  // brilho pulsando de leve enquanto aberto
  const breathe = scene.tweens.add({ targets: mist, scale: 0.51, yoyo: true, repeat: -1, duration: 1400 });
  const apply = () => {
    // portas: primeiros 70% da abertura; névoa: o resto
    const n = Math.round(Math.min(1, st.k / 0.7) * DOOR_FRAMES);
    leaves.setVisible(n > 0);
    if (n > 0) leaves.setFrame(`portao_muralha_${ax}_${n}`);
    const f = Math.max(0, (st.k - 0.7) / 0.3);
    mist.setAlpha(f);
    onOpen(f);
  };
  watchNear(scene, leaves, c, st, apply, 1100, 800, 'Sine.Out', 'Quad.In', () => breathe.stop());
  apply();
  const g: IronGate = { objects: [leaves, mist], open: () => Math.max(0, (st.k - 0.7) / 0.3), mouth };
  gates.set(o, g);
  return g;
}
