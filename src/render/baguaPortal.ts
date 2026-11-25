import Phaser from 'phaser';
import { DEPTH } from './depth';

/**
 * Portal dos mapas de caça: disco de pedra no chão com o octógono Bagua girando e a runa 門 dourada
 * no centro; bolhas douradas sobem sempre. Com o jogador perto: gira mais rápido, sobe uma coluna
 * de luz cilíndrica com faixas de energia e anéis.
 */
const R = 60; // raio do disco em px de tela (largura); altura = R/2 (isométrico)
const NEAR = 120;
const GOLD = 0xffd47a;

function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('bagua-disc')) return;
  const S = 256,
    h = S / 2;
  // disco de pedra (visto de cima)
  const d = scene.textures.createCanvas('bagua-disc', S, S)!;
  let c = d.getContext();
  let gr = c.createRadialGradient(h, h, 20, h, h, h);
  gr.addColorStop(0, '#8a857a');
  gr.addColorStop(0.85, '#6f6a60');
  gr.addColorStop(1, '#545048');
  c.fillStyle = gr;
  c.beginPath();
  c.arc(h, h, h - 2, 0, 7);
  c.fill();
  c.strokeStyle = 'rgba(30,26,20,.6)';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(h, h, h - 10, 0, 7);
  c.stroke();
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '40,36,30' : '160,155,140'},.25)`;
    c.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }
  // runa 門 no centro
  c.fillStyle = 'rgba(60,40,10,.7)';
  c.beginPath();
  c.arc(h, h, 40, 0, 7);
  c.fill();
  c.fillStyle = '#ffd47a';
  c.font = 'bold 66px serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('門', h, h + 3);
  d.refresh();
  // anel com octógonos e trigramas (gira)
  const r = scene.textures.createCanvas('bagua-ring', S, S)!;
  c = r.getContext();
  c.translate(h, h);
  c.strokeStyle = '#ffd47a';
  c.fillStyle = '#ffd47a';
  c.lineWidth = 4;
  for (const rad of [112, 50]) {
    c.beginPath();
    for (let i = 0; i <= 8; i++) c.lineTo(Math.cos((i * Math.PI) / 4) * rad, Math.sin((i * Math.PI) / 4) * rad);
    c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    c.save();
    c.rotate((i * Math.PI) / 4 + Math.PI / 8);
    for (let l = 0; l < 3; l++) {
      const y = -98 + l * 11;
      if ((i >> l) & 1) c.fillRect(-18, y, 36, 6);
      else {
        c.fillRect(-18, y, 14, 6);
        c.fillRect(4, y, 14, 6);
      }
    }
    c.restore();
  }
  r.refresh();
  // coluna cilíndrica: bordas claras, meio translúcido, some em cima
  const W = 128,
    H = 256;
  const col = scene.textures.createCanvas('bagua-col', W, H)!;
  c = col.getContext();
  gr = c.createLinearGradient(0, 0, W, 0);
  for (const [p, a] of [
    [0, 0],
    [0.06, 0.6],
    [0.2, 0.28],
    [0.5, 0.12],
    [0.8, 0.28],
    [0.94, 0.6],
    [1, 0],
  ])
    gr.addColorStop(p, `rgba(255,215,130,${a})`);
  c.fillStyle = gr;
  // base arredondada: acompanha a frente do disco (meia elipse)
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
  v.addColorStop(0.7, 'rgba(0,0,0,.75)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  col.refresh();
  // brilho macio do chão
  const gl = scene.textures.createCanvas('bagua-glow', 128, 128)!;
  c = gl.getContext();
  gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,215,130,1)');
  gr.addColorStop(1, 'rgba(255,215,130,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 128, 128);
  gl.refresh();
}

export function baguaPortal(scene: Phaser.Scene, cx: number, cy: number, depth: number) {
  makeTextures(scene);
  const out: Phaser.GameObjects.GameObject[] = [];
  const S = (2 * R) / 256;
  // espessura do disco (borda lateral)
  const edge = scene.add.graphics().setDepth(DEPTH.PORTAL_FLOOR);
  edge.fillStyle(0x3d3a34, 1);
  edge.fillEllipse(cx, cy + 5, 2 * R, R + 2);
  out.push(edge);
  const glow = scene.add
    .image(cx, cy, 'bagua-glow')
    .setBlendMode('ADD')
    .setDepth(DEPTH.PORTAL_FLOOR + 3);
  const disc = scene.add.container(cx, cy).setDepth(DEPTH.PORTAL_FLOOR + 1);
  disc.setScale(1, 0.5);
  const base = scene.add.image(0, 0, 'bagua-disc').setScale(S);
  const ring = scene.add.image(0, 0, 'bagua-ring').setScale(S).setBlendMode('ADD');
  disc.add([base, ring]);
  out.push(disc, glow);
  const column = scene.add
    .image(cx, cy + R * 0.38, 'bagua-col')
    .setOrigin(0.5, 1)
    .setDisplaySize(R * 1.5, 210)
    .setBlendMode('ADD')
    .setAlpha(0)
    .setDepth(depth + 0.5);
  out.push(column);
  // anéis que sobem e faixas da coluna
  const rings = scene.add
    .graphics()
    .setDepth(depth + 0.6)
    .setBlendMode('ADD');
  out.push(rings);
  const bubbles = scene.add
    .particles(cx, cy, 'fx-dot', {
      x: { min: -R * 0.8, max: R * 0.8 },
      y: { min: -R * 0.3, max: R * 0.3 },
      lifespan: 2600,
      speedY: { min: -40, max: -18 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.55, end: 0.15 },
      alpha: { start: 0.75, end: 0 },
      tint: [0xfff0c0, GOLD, 0xffffff],
      frequency: 140,
      blendMode: 'ADD',
    })
    .setDepth(depth + 0.7);
  const streaks = scene.add
    .particles(cx, cy, 'fx-dot', {
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Ellipse(0, 0, R * 1.45, R * 0.72),
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 1300,
      speedY: { min: -170, max: -110 },
      scaleX: 0.25,
      scaleY: { start: 1.6, end: 0.4 },
      alpha: { start: 0.9, end: 0 },
      tint: [GOLD, 0xffffff],
      frequency: 45,
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(depth + 0.6);
  out.push(bubbles, streaks);
  const st = { k: 0, a: 0 };
  let t = 0;
  const tick = (_: number, dt: number) => {
    t += dt / 1000;
    const v = scene.cameras.main.worldView;
    const want = Phaser.Math.Distance.Between(v.centerX, v.centerY, cx, cy) < NEAR ? 1 : 0;
    st.k += (want - st.k) * Math.min(1, dt / 350);
    const k = st.k;
    st.a += (dt / 1000) * (0.35 + k * 1.4);
    ring.setRotation(st.a).setAlpha(0.55 + 0.25 * Math.sin(t * 2) * (1 - k) + 0.4 * k);
    glow.setScale((R / 40) * (1 + 0.4 * k), (R / 80) * (1 + 0.4 * k)).setAlpha(0.18 + 0.3 * k);
    column.setAlpha(k * (0.85 + 0.15 * Math.sin(t * 5)));
    bubbles.speedY = -18 - 40 * k;
    if (k > 0.4 && !streaks.emitting) streaks.start();
    else if (k <= 0.4 && streaks.emitting) streaks.stop();
    rings.clear();
    if (k > 0.03)
      for (let i = 0; i < 3; i++) {
        const f = (t * 0.45 + i / 3) % 1;
        rings.lineStyle(2, GOLD, (1 - f) * k);
        rings.strokeEllipse(cx, cy - f * 170, R * 1.5 * (1 - f * 0.25), R * 0.75 * (1 - f * 0.25));
      }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  disc.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
  return out;
}
