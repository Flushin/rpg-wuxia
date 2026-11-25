import Phaser from 'phaser';
import { DEPTH } from './depth';

/**
 * Portais da Vila: lótus de jade em volta de um espelho d'água com o símbolo do destino.
 * Parado: pétalas fechadas, brilho fraco e pétalas de luz soltas. Com o jogador perto: as pétalas
 * abrem e sobe um jato de luz cilíndrico com pétalas voando. Cada destino tem cor e caractere.
 */
const R = 62; // raio da base em px de tela (largura); altura = R/2
const NEAR = 120;
const N = 10; // pétalas

export const LOTUS: Record<string, { color: number; glyph: string; jade: number }> = {
  floresta: { color: 0x78e68c, glyph: '林', jade: 0x468269 },
  montanha: { color: 0x96d7ff, glyph: '山', jade: 0x468269 },
  masmorras: { color: 0xbe82ff, glyph: '窟', jade: 0x5a466e },
  trial: { color: 0xff5f55, glyph: '試', jade: 0x5a466e },
};

const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const lit = (c: number, f: number) => {
  const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * f));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const shade = (c: number, f: number) => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

function makeTextures(scene: Phaser.Scene, key: string, color: number, glyph: string) {
  if (!scene.textures.exists('lotus-col')) {
    // coluna branca (tingida por portal): bordas claras, meio translúcido, some em cima
    const W = 128,
      H = 256;
    const col = scene.textures.createCanvas('lotus-col', W, H)!;
    const c = col.getContext();
    const gr = c.createLinearGradient(0, 0, W, 0);
    for (const [p, a] of [
      [0, 0],
      [0.07, 0.6],
      [0.25, 0.25],
      [0.5, 0.1],
      [0.75, 0.25],
      [0.93, 0.6],
      [1, 0],
    ])
      gr.addColorStop(p, `rgba(255,255,255,${a})`);
    c.fillStyle = gr;
    const e = W / 4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, H - e);
    c.ellipse(W / 2, H - e, W / 2, e, 0, 0, Math.PI);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.6, 'rgba(0,0,0,.8)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    col.refresh();
    const gl = scene.textures.createCanvas('lotus-glow', 128, 128)!;
    const g2 = gl.getContext();
    const rg = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = rg;
    g2.fillRect(0, 0, 128, 128);
    gl.refresh();
    // pétala solta (partícula)
    const pt = scene.textures.createCanvas('lotus-petal', 16, 8)!;
    const g3 = pt.getContext();
    g3.fillStyle = '#fff';
    g3.beginPath();
    g3.ellipse(8, 4, 7, 3, 0, 0, 7);
    g3.fill();
    pt.refresh();
  }
  // base de pedra + espelho d'água com o símbolo (visto de cima)
  const k = 'lotus-base-' + key;
  if (scene.textures.exists(k)) return k;
  const S = 256,
    h = S / 2;
  const t = scene.textures.createCanvas(k, S, S)!;
  const c = t.getContext();
  let gr = c.createRadialGradient(h, h, 30, h, h, h);
  gr.addColorStop(0, '#8a847a');
  gr.addColorStop(1, '#66615a');
  c.fillStyle = gr;
  c.beginPath();
  c.arc(h, h, h - 2, 0, 7);
  c.fill();
  c.strokeStyle = 'rgba(40,36,30,.5)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(h, h, h - 8, 0, 7);
  c.stroke();
  for (let i = 0; i < 60; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '40,36,30' : '170,165,150'},.22)`;
    c.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }
  gr = c.createRadialGradient(h, h, 4, h, h, 70);
  gr.addColorStop(0, css(lit(color, 0.55), 0.95));
  gr.addColorStop(1, css(shade(color, 0.55), 0.85));
  c.fillStyle = gr;
  c.beginPath();
  c.arc(h, h, 70, 0, 7);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)';
  c.lineWidth = 2;
  for (const r of [30, 50]) {
    c.beginPath();
    c.arc(h, h, r, 0, 7);
    c.stroke();
  }
  c.fillStyle = '#fff';
  c.font = 'bold 64px serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(glyph, h, h + 3);
  t.refresh();
  return k;
}

export function lotusPortal(scene: Phaser.Scene, cx: number, cy: number, depth: number, kind: string) {
  const L = LOTUS[kind] ?? LOTUS.floresta;
  const baseKey = makeTextures(scene, kind, L.color, L.glyph);
  const out: Phaser.GameObjects.GameObject[] = [];
  const edge = scene.add.graphics().setDepth(DEPTH.PORTAL_FLOOR);
  edge.fillStyle(0x4d4840, 1);
  edge.fillEllipse(cx, cy + 5, 2 * R, R + 2);
  out.push(edge);
  const base = scene.add
    .image(cx, cy, baseKey)
    .setScale((2 * R) / 256, R / 256)
    .setDepth(DEPTH.PORTAL_FLOOR + 1);
  const glow = scene.add
    .image(cx, cy, 'lotus-glow')
    .setTint(L.color)
    .setBlendMode('ADD')
    .setDepth(DEPTH.PORTAL_FLOOR + 3);
  out.push(base, glow);
  // pétalas de trás (atrás da coluna) e da frente
  const back = scene.add.graphics().setDepth(depth + 0.4);
  const column = scene.add
    .image(cx, cy + R * 0.3, 'lotus-col')
    .setOrigin(0.5, 1)
    .setDisplaySize(R * 1.0, 220)
    .setTint(lit(L.color, 0.4))
    .setBlendMode('ADD')
    .setAlpha(0)
    .setDepth(depth + 0.5);
  const front = scene.add.graphics().setDepth(depth + 0.6);
  out.push(back, column, front);
  const motes = scene.add
    .particles(cx, cy, 'lotus-petal', {
      x: { min: -R * 0.6, max: R * 0.6 },
      y: { min: -R * 0.25, max: R * 0.1 },
      lifespan: 2400,
      speedY: { min: -40, max: -18 },
      speedX: { min: -15, max: 15 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0.3 },
      alpha: { start: 0.85, end: 0 },
      tint: [lit(L.color, 0.3), lit(L.color, 0.6), 0xffffff],
      frequency: 300,
      blendMode: 'ADD',
    })
    .setDepth(depth + 0.7);
  out.push(motes);
  const petal = (g: Phaser.GameObjects.Graphics, a: number, open: number, k: number) => {
    const sy = Math.sin(a);
    const px = cx + Math.cos(a) * R * 0.7,
      py = cy + sy * R * 0.35;
    const hgt = 28 - open * 11,
      lean = open * 15;
    const ox = Math.cos(a) * lean,
      oy = sy * lean * 0.5;
    const col = sy >= 0 ? lit(L.jade, 0.15 * sy) : shade(L.jade, 1 + 0.25 * sy);
    const curve = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) =>
      new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(x0, y0),
        new Phaser.Math.Vector2(x1, y1),
        new Phaser.Math.Vector2(x2, y2),
      ).getPoints(6);
    const pts = [
      ...curve(px - 9, py, px - 9 + ox, py - hgt * 0.6 + oy, px + ox, py - hgt + oy),
      ...curve(px + ox, py - hgt + oy, px + 9 + ox, py - hgt * 0.6 + oy, px + 9, py),
    ];
    g.fillStyle(col, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1.2, lit(L.color, 0.5), 0.3 + 0.6 * k);
    g.strokePoints(pts, true);
  };
  const st = { k: 0, a: 0 };
  let t = 0;
  const tick = (_: number, dt: number) => {
    t += dt / 1000;
    const v = scene.cameras.main.worldView;
    const want = Phaser.Math.Distance.Between(v.centerX, v.centerY, cx, cy) < NEAR ? 1 : 0;
    st.k += (want - st.k) * Math.min(1, dt / 350);
    const k = st.k;
    st.a += (dt / 1000) * (0.12 + k * 0.3);
    glow
      .setScale((R / 50) * (1 + 0.3 * k), (R / 100) * (1 + 0.3 * k))
      .setAlpha(0.2 + 0.12 * Math.sin(t * 2) + 0.35 * k);
    column.setAlpha(k * (0.85 + 0.15 * Math.sin(t * 5)));
    motes.frequency = 300 - 230 * k;
    motes.speedY = -18 - 60 * k;
    back.clear();
    front.clear();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + st.a;
      petal(Math.sin(a) < 0 ? back : front, a, k, k);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  base.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
  return out;
}
