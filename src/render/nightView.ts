import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { DEPTH } from './depth';

// Noite do Porto Noturno (MapConfig.night): véu azul-escuro preso à câmera por cima do mundo e um halo quente
// (gradiente em ADD) em cada lanterna do mapa (enfeite com a propriedade light). Os halos são imagens: o cullMap
// esconde os que estão longe da câmera. Barcos (enfeite com boat) balançam devagar, cada um no seu ritmo.

const VEIL = 0x0b1633;
const VEIL_ALPHA = 0.6;
const HALO = 'fx-halo';

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
  // véu: bem maior que a tela (zoom da câmera e telas largas não deixam borda clara)
  const veil = scene.add
    .rectangle(cam.width / 2, cam.height / 2, cam.width * 4, cam.height * 4, VEIL, VEIL_ALPHA)
    .setScrollFactor(0)
    .setDepth(DEPTH.NIGHT_VEIL);
  out.push(veil);
  let k = 0;
  for (const o of map.objects) {
    if (o.type !== 'decor') continue;
    if (o.props.light) {
      const p = tileToScreen(o.x, o.y),
        tall = o.props.sprite === 'lanterna_poste';
      const h = scene.add
        .image(p.x + (tall ? 10 : 6), p.y - (tall ? 46 : 14), HALO)
        .setScale(tall ? 1.5 : 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.NIGHT_LIGHT)
        .setAlpha(0.8);
      // tremor leve da chama, defasado por lanterna
      scene.tweens.add({ targets: h, alpha: 0.6, yoyo: true, repeat: -1, duration: 900 + (k++ % 5) * 170 });
      out.push(h);
    }
  }
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
