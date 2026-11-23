import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { DEPTH } from './depth';

// Noite do Porto Noturno (MapConfig.night): véu azul-escuro sobre a área visível, com furos de luz e um halo quente
// (gradiente em ADD) em cada lanterna do mapa (enfeite com a propriedade light). Os halos são imagens: o cullMap
// esconde os que estão longe da câmera. Barcos (enfeite com boat) balançam devagar, cada um no seu ritmo.

const VEIL = 0x0b1633;
const VEIL_ALPHA = 0.55;
const HALO = 'fx-halo';
const HOLE = 'fx-light-hole';

// Pincel do recorte de luz: o véu é apagado (ERASE) com esse gradiente em volta das lanternas e do herói,
// então a área iluminada mostra as cores reais (não um filtro escuro por cima de tudo).
function holeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(HOLE)) return;
  const size = 256,
    tex = scene.textures.createCanvas(HOLE, size, size);
  if (!tex) return;
  const ctx = tex.getContext(),
    g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

function haloTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(HALO)) return;
  const size = 128,
    tex = scene.textures.createCanvas(HALO, size, size);
  if (!tex) return;
  const ctx = tex.getContext(),
    g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,200,120,0.85)');
  g.addColorStop(0.35, 'rgba(255,150,70,0.35)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

export function buildNight(scene: Phaser.Scene, map: GameMap): Phaser.GameObjects.GameObject[] {
  if (!MAPS_CONFIG[map.id]?.night) return [];
  haloTexture(scene);
  const out: Phaser.GameObjects.GameObject[] = [];
  const cam = scene.cameras.main;
  holeTexture(scene);
  // véu: textura do tamanho da área visível, presa ao mundo e redesenhada a cada quadro com furos de luz
  const veil = scene.add.renderTexture(0, 0, 8, 8).setOrigin(0, 0).setDepth(DEPTH.NIGHT_VEIL);
  out.push(veil);
  const brush = scene.make.image({ key: HOLE, add: false });
  const lights: { x: number; y: number; r: number }[] = [];
  let k = 0;
  for (const o of map.objects) {
    if (o.type !== 'decor') continue;
    if (o.props.light) {
      const p = tileToScreen(o.x, o.y),
        tall = o.props.sprite === 'lanterna_poste';
      const hx = p.x + (tall ? 10 : 6),
        hy = p.y - (tall ? 46 : 14);
      // poste ilumina o chão em volta (furo centrado no pé); lanterna baixa, um círculo menor
      lights.push({ x: hx, y: tall ? p.y : hy, r: tall ? 1.6 : 0.9 });
      const h = scene.add
        .image(hx, hy, HALO)
        .setScale(tall ? 1.5 : 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.NIGHT_LIGHT)
        .setAlpha(0.8);
      // tremor leve da chama, defasado por lanterna
      scene.tweens.add({ targets: h, alpha: 0.6, yoyo: true, repeat: -1, duration: 900 + (k++ % 5) * 170 });
      out.push(h);
    }
  }
  const draw = () => {
    const v = cam.worldView,
      w = Math.ceil(v.width) + 4,
      hgt = Math.ceil(v.height) + 4;
    if (veil.width !== w || veil.height !== hgt) veil.resize(w, hgt);
    veil.setPosition(v.x - 2, v.y - 2);
    veil.clear().fill(VEIL, VEIL_ALPHA);
    const pad = 256;
    for (const l of lights) {
      if (l.x < v.x - pad || l.x > v.right + pad || l.y < v.y - pad || l.y > v.bottom + pad) continue;
      brush.setScale(l.r);
      veil.erase(brush, l.x - veil.x, l.y - veil.y);
    }
    // luz própria do herói (a câmera o segue): personagem nunca some no escuro
    brush.setScale(0.8);
    veil.erase(brush, v.centerX - veil.x, v.centerY - 20 - veil.y);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
  veil.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw);
    brush.destroy();
  });
  draw();
  return out;
}

/** Barcos do mar: sobem e descem e inclinam um pouco, cada um com fase e duração próprias. */
export function bobBoats(scene: Phaser.Scene, imgs: Phaser.GameObjects.Image[]) {
  imgs.forEach((b, i) => {
    scene.tweens.add({
      targets: b,
      y: b.y - 3,
      angle: i % 2 ? 1.2 : -1.2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      duration: 2200 + i * 330,
      delay: i * 400,
    });
  });
}
