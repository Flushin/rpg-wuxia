import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { DEPTH } from './depth';

// Noite do Porto Noturno (MapConfig.night): véu azul-escuro sobre a área visível, com furos de luz e um halo quente
// (gradiente em ADD) em cada lanterna do mapa (enfeite com a propriedade light). Os halos são imagens: o cullMap
// esconde os que estão longe da câmera. Barcos (enfeite com boat) balançam devagar, cada um no seu ritmo.

const VEIL = 0x0b1633;
const VEIL_ALPHA = 0.62;
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
  // véu: canvas em 1/4 da resolução (gradientes suaves não perdem nada), ampliado sobre a área visível e
  // redesenhado a cada quadro com furos de luz (destination-out) nos postes e em volta do herói
  const VKEY = 'fx-night-veil',
    Q = 4;
  if (scene.textures.exists(VKEY)) scene.textures.remove(VKEY);
  const vt = scene.textures.createCanvas(VKEY, 8, 8)!;
  const veil = scene.add.image(0, 0, VKEY).setOrigin(0, 0).setDepth(DEPTH.NIGHT_VEIL).setScale(Q);
  out.push(veil);
  const veilCss = `rgba(11,22,51,${VEIL_ALPHA})`;
  const lights: { x: number; y: number; r: number }[] = [];
  let k = 0;
  for (const o of map.objects) {
    if (o.type !== 'decor') continue;
    if (o.props.light) {
      const p = tileToScreen(o.x, o.y),
        tall = o.props.sprite === 'lanterna_poste',
        soft = !!o.props.soft; // lanterninha junto de NPC: clareia ele sem o brilho forte do poste
      const hx = p.x + (tall ? 10 : soft ? 0 : 6),
        hy = p.y - (tall ? 46 : soft ? 10 : 14);
      // poste ilumina o chão em volta (furo centrado no pé); lanterna baixa, um círculo menor
      lights.push({ x: hx, y: tall ? p.y : soft ? p.y - 24 : hy, r: tall ? 1.25 : soft ? 0.95 : 0.7 });
      const a = soft ? 0.45 : 0.8;
      const h = scene.add
        .image(hx, hy, HALO)
        .setScale(tall ? 1.5 : soft ? 0.7 : 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.NIGHT_LIGHT)
        .setAlpha(a);
      // tremor leve da chama, defasado por lanterna
      scene.tweens.add({ targets: h, alpha: a * 0.75, yoyo: true, repeat: -1, duration: 900 + (k++ % 5) * 170 });
      out.push(h);
    }
  }
  // núcleo do vórtice do Trial (portal com noGate): luz vermelho-sangue grande, pulsando como um coração
  for (const o of map.objects)
    if (o.type === 'portal' && o.props.noGate) {
      const p = tileToScreen(o.x + o.w / 2, o.y + o.h / 2);
      lights.push({ x: p.x, y: p.y - 40, r: 2.2 });
      const h = scene.add
        .image(p.x, p.y - 66, HALO)
        .setScale(2.6)
        .setTint(0xff3018)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.NIGHT_LIGHT)
        .setAlpha(0.9);
      scene.tweens.add({
        targets: h,
        alpha: 0.55,
        scale: 2.2,
        yoyo: true,
        repeat: -1,
        duration: 1300,
        ease: 'Sine.InOut',
      });
      out.push(h);
    }
  // NPCs: clareira suave no corpo (com a lanterninha de chão ao lado), para não sumirem no escuro
  for (const o of map.objects)
    if (o.type === 'npc') {
      const p = tileToScreen(o.x, o.y);
      lights.push({ x: p.x, y: p.y - 26, r: 0.6 });
    }
  const draw = () => {
    const v = cam.worldView,
      w = Math.ceil(v.width / Q) + 2,
      hgt = Math.ceil(v.height / Q) + 2;
    if (vt.width !== w || vt.height !== hgt) {
      vt.setSize(w, hgt);
      veil.setSizeToFrame();
    }
    veil.setPosition(v.x - Q, v.y - Q).setVisible(true); // cullMap não pode esconder o véu
    const ctx = vt.getContext(),
      ox = veil.x,
      oy = veil.y;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, hgt);
    ctx.fillStyle = veilCss;
    ctx.fillRect(0, 0, w, hgt);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => {
      const cx = (x - ox) / Q,
        cy = (y - oy) / Q,
        rr = r / Q,
        g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    };
    const pad = 320;
    for (const l of lights) {
      if (l.x < v.x - pad || l.x > v.right + pad || l.y < v.y - pad || l.y > v.bottom + pad) continue;
      hole(l.x, l.y, 128 * l.r);
    }
    // luz própria do herói (a câmera o segue): personagem nunca some no escuro
    hole(v.centerX, v.centerY - 20, 80);
    vt.refresh();
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
  veil.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw));
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
