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
  const gx = Number(o.props.gateX),
    gy = Number(o.props.gateY),
    atlas = `props-${o.props.gateAtlas ? String(o.props.gateAtlas) : 'porto'}`;
  const c = tileToScreen(gx, gy);
  const st = { k: 0 };
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
  let target = 0;
  const apply = () => {
    grate.y = c.y - st.k * RISE * ZPX;
    mist.setAlpha(st.k);
    onOpen(st.k);
  };
  let tween: Phaser.Tweens.Tween | null = null;
  const check = () => {
    const v = scene.cameras.main.worldView;
    const d = Phaser.Math.Distance.Between(v.centerX, v.centerY, c.x, c.y);
    const want = d < NEAR ? 1 : 0;
    if (want === target) return;
    target = want;
    tween?.stop();
    tween = scene.tweens.add({
      targets: st,
      k: want,
      duration: want ? 900 : 700,
      ease: want ? 'Cubic.Out' : 'Bounce.Out', // ao fechar a grade cai e quica
      onUpdate: apply,
    });
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, check);
  grate.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, check);
    tween?.stop();
    shape.destroy();
  });
  apply();
  const g: IronGate = { objects: [mist, grate], open: () => st.k };
  gates.set(o, g);
  return g;
}
