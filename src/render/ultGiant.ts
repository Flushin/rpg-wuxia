// Gigante de brasa da ultimate do Titã (prévia aprovada: previews/ultimate-tita.html, opção B "Punhos do Gigante").
// Usa degradês do canvas 2D, que o Graphics do Phaser não tem: cada pose é desenhada uma vez numa textura
// (punhos erguidos, braço esquerdo ou direito socando) e o punho que cai é outra textura.
import type Phaser from 'phaser';

type Ctx = CanvasRenderingContext2D;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function flame(ctx: Ctx, x: number, y: number, h: number, w: number, a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const hh = h * (1 - k * 0.25),
      ww = w * (1 - k * 0.3);
    const g = ctx.createLinearGradient(x, y, x, y - hh);
    g.addColorStop(0, ['rgba(255,70,20,.75)', 'rgba(255,150,40,.85)', 'rgba(255,240,170,.95)'][k]);
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - ww, y);
    ctx.quadraticCurveTo(x - ww * 0.8 + rnd(-3, 3), y - hh * 0.5, x + rnd(-4, 4), y - hh);
    ctx.quadraticCurveTo(x + ww * 0.8 + rnd(-3, 3), y - hh * 0.5, x + ww, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function fist(ctx: Ctx, x: number, y: number, s: number, a = 1, trail = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a;
  // rastro de fogo acima do punho que cai
  if (trail > 0) {
    const tg = ctx.createLinearGradient(0, -40, 0, -40 - 120 * trail);
    tg.addColorStop(0, 'rgba(255,170,60,.85)');
    tg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-26, -40);
    ctx.quadraticCurveTo(0, -40 - 140 * trail, 26, -40);
    ctx.fill();
  }
  ctx.shadowColor = '#ff6a1a';
  ctx.shadowBlur = 26;
  const g = ctx.createLinearGradient(0, -60, 0, 14);
  g.addColorStop(0, 'rgba(255,90,20,.9)');
  g.addColorStop(0.55, 'rgba(255,150,50,.95)');
  g.addColorStop(1, 'rgba(255,235,160,1)');
  ctx.fillStyle = g;
  // antebraço
  ctx.beginPath();
  ctx.moveTo(-16, -64);
  ctx.lineTo(16, -64);
  ctx.lineTo(20, -26);
  ctx.lineTo(-20, -26);
  ctx.closePath();
  ctx.fill();
  // mão fechada: bloco + 4 nós dos dedos embaixo + polegar
  ctx.beginPath();
  ctx.roundRect(-26, -30, 52, 30, 10);
  ctx.fill();
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(-19.5 + k * 13, 2, 7.5, 0, 7);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-24, -14, 8, 12, -0.4, 0, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(110,25,5,.75)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(-26 + k * 13, -6);
    ctx.lineTo(-26 + k * 13, 6);
    ctx.stroke();
  }
  // veias de brasa
  ctx.strokeStyle = 'rgba(255,245,200,.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, -60);
  ctx.lineTo(-2, -42);
  ctx.lineTo(-8, -30);
  ctx.moveTo(8, -58);
  ctx.lineTo(4, -38);
  ctx.stroke();
  ctx.restore();
}
function giant(ctx: Ctx, x: number, y: number, a: number, t: number, armDown: number[]) {
  ctx.save();
  ctx.translate(x, y);
  const br = 0.72 * (1 + Math.sin(t / 260) * 0.02);
  ctx.scale(br, br);
  ctx.globalAlpha = a;
  ctx.shadowColor = '#ff4a10';
  ctx.shadowBlur = 30;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // braços: ombro → cotovelo → punho erguido (some quando aquele punho está socando)
  for (const s of [-1, 1]) {
    const down = armDown[s < 0 ? 0 : 1] > 0;
    const el: [number, number] = down ? [s * 140, -6] : [s * 150, -30],
      fi: [number, number] = down ? [s * 120, 40] : [s * 138, -112];
    for (const [w, c] of <[number, string][]>[
      [32, 'rgba(230,70,20,.9)'],
      [18, 'rgba(255,150,50,.9)'],
      [6, 'rgba(255,230,150,.9)'],
    ]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(s * 88, -52);
      ctx.lineTo(...el);
      ctx.lineTo(...fi);
      ctx.stroke();
    }
    // deltoide, bíceps e antebraço saltados
    const mid = (p: number[], q: number[], f: number): [number, number] => [
      p[0] + (q[0] - p[0]) * f,
      p[1] + (q[1] - p[1]) * f,
    ];
    const ua = Math.atan2(el[1] + 52, el[0] - s * 88),
      fa = Math.atan2(fi[1] - el[1], fi[0] - el[0]);
    const muscle = (x: number, y: number, rx: number, ry: number, rot: number) => {
      const mg = ctx.createRadialGradient(x - 4, y - 6, 2, x, y, Math.max(rx, ry));
      mg.addColorStop(0, 'rgba(255,215,130,.95)');
      mg.addColorStop(0.6, 'rgba(250,110,35,.95)');
      mg.addColorStop(1, 'rgba(170,35,10,.9)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, 7);
      ctx.fill();
    };
    muscle(s * 92, -56, 30, 24, 0);
    const bi = mid([s * 88, -52], el, 0.55);
    muscle(bi[0] - 4 * s, bi[1] - 8, 26, 19, ua);
    const fo = mid(el, fi, 0.35);
    muscle(fo[0], fo[1], 20, 15, fa);
    if (!down) {
      ctx.save();
      ctx.translate(fi[0], fi[1] - 6);
      ctx.rotate(Math.PI);
      fist(ctx, 0, 0, 0.55, 1);
      ctx.restore();
      flame(ctx, fi[0], fi[1] - 26, 34 + Math.random() * 10, 12, 0.9);
    }
  }
  // tronco: pescoço, trapézio, ombros, cintura (some embaixo, atrás do personagem)
  const body = new Path2D();
  body.moveTo(-26, -84);
  body.lineTo(26, -84);
  body.quadraticCurveTo(52, -82, 104, -62);
  body.quadraticCurveTo(122, -40, 84, -6);
  body.quadraticCurveTo(64, 30, 52, 70);
  body.lineTo(-52, 70);
  body.quadraticCurveTo(-64, 30, -84, -6);
  body.quadraticCurveTo(-122, -40, -104, -62);
  body.quadraticCurveTo(-52, -82, -26, -84);
  const bg = ctx.createLinearGradient(0, -80, 0, 70);
  bg.addColorStop(0, 'rgba(255,120,40,.95)');
  bg.addColorStop(0.5, 'rgba(220,60,15,.6)');
  bg.addColorStop(1, 'rgba(160,30,10,0)');
  ctx.fillStyle = bg;
  ctx.fill(body);
  ctx.shadowBlur = 0;
  // peitoral e abdômen: volumes claros com sombra escura entre eles
  const vol = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    const vg = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
    vg.addColorStop(0, 'rgba(255,225,150,.9)');
    vg.addColorStop(0.7, 'rgba(245,105,35,.85)');
    vg.addColorStop(1, 'rgba(150,30,8,.0)');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, 7);
    ctx.fill();
  };
  vol(-30, -46, 34, 22, 0.15);
  vol(30, -46, 34, 22, -0.15);
  for (const yy of [-12, 8, 26]) {
    vol(-13, yy, 12, 9);
    vol(13, yy, 12, 9);
  }
  ctx.strokeStyle = 'rgba(90,15,5,.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-62, -36);
  ctx.quadraticCurveTo(-30, -18, -2, -30);
  ctx.moveTo(62, -36);
  ctx.quadraticCurveTo(30, -18, 2, -30);
  ctx.moveTo(0, -60);
  ctx.lineTo(0, 40);
  ctx.stroke();
  // rachaduras de brasa
  ctx.strokeStyle = 'rgba(255,240,170,.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-44, -54);
  ctx.lineTo(-30, -44);
  ctx.lineTo(-36, -34);
  ctx.moveTo(40, -58);
  ctx.lineTo(28, -46);
  ctx.moveTo(-14, 0);
  ctx.lineTo(-10, 14);
  ctx.stroke();
  // cabeça careca
  ctx.shadowColor = '#ff4a10';
  ctx.shadowBlur = 24;
  const hg = ctx.createRadialGradient(-8, -120, 4, 0, -104, 34);
  hg.addColorStop(0, 'rgba(255,220,140,1)');
  hg.addColorStop(1, 'rgba(240,90,25,.95)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, -106, 27, 31, 0, 0, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  // sobrancelhas em V (bravo), olhos em brasa e boca aberta rugindo
  ctx.fillStyle = 'rgba(90,15,5,.95)';
  ctx.beginPath();
  ctx.moveTo(-25, -120);
  ctx.lineTo(-2, -106);
  ctx.lineTo(-3, -101);
  ctx.lineTo(-25, -113);
  ctx.moveTo(25, -120);
  ctx.lineTo(2, -106);
  ctx.lineTo(3, -101);
  ctx.lineTo(25, -113);
  ctx.fill();
  ctx.shadowColor = '#ffec80';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath();
  ctx.moveTo(-20, -104);
  ctx.lineTo(-5, -100);
  ctx.lineTo(-18, -97);
  ctx.moveTo(20, -104);
  ctx.lineTo(5, -100);
  ctx.lineTo(18, -97);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(60,8,2,.95)';
  ctx.beginPath();
  ctx.ellipse(0, -86, 10, 6 + Math.sin(t / 120) * 1.5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,80,.9)';
  ctx.beginPath();
  ctx.ellipse(0, -85, 5, 3, 0, 0, 7);
  ctx.fill();
  // barba de fogo descendo pelo peito
  const bd = new Path2D();
  bd.moveTo(-24, -92);
  for (let q = 0; q <= 8; q++) {
    const xx = -24 + q * 6,
      yy = -60 + (q % 2 ? -10 : 8) + Math.sin(t / 90 + q) * 3 - Math.abs(q - 4) * 4;
    bd.lineTo(xx, yy);
  }
  bd.lineTo(24, -92);
  bd.quadraticCurveTo(14, -78, 0, -80);
  bd.quadraticCurveTo(-14, -78, -24, -92);
  const dg = ctx.createLinearGradient(0, -96, 0, -50);
  dg.addColorStop(0, 'rgba(255,240,190,.95)');
  dg.addColorStop(1, 'rgba(255,140,40,.6)');
  ctx.fillStyle = dg;
  ctx.fill(bd);
  // chamas na borda dos ombros e na cabeça
  for (const [fx, fy, h] of <[number, number, number][]>[
    [-104, -66, 30],
    [-70, -76, 24],
    [70, -76, 24],
    [104, -66, 30],
    [-14, -134, 22],
    [0, -138, 30],
    [14, -134, 22],
  ])
    flame(ctx, fx + Math.sin(t / 70 + fx) * 2, fy + 6, h + Math.random() * 8, 9, 0.8);
  ctx.restore();
}
/** escala em que as texturas são desenhadas (nitidez) */
const RES = 2;
/** caixa do gigante (px da prévia × 0,72) e onde fica o peito dentro dela */
const GW = 300,
  GH = 230,
  GX = 150,
  GY = 165;

/** Chaves das texturas: ult-giant-up/l/r (âncora no peito: origem GX/GW, GY/GH) e ult-fist (âncora nos nós dos dedos). */
export const GIANT_ORIGIN = { x: GX / GW, y: GY / GH };
export const FIST_ORIGIN = { x: 0.5, y: 190 / 200 };
export const GIANT_RES = RES;

export function ensureGiantTextures(scene: Phaser.Scene) {
  const tx = scene.textures;
  const make = (key: string, w: number, h: number, draw: (ctx: Ctx) => void) => {
    if (tx.exists(key)) return;
    const c = tx.createCanvas(key, w * RES, h * RES);
    if (!c) return;
    const ctx = c.getContext();
    ctx.scale(RES, RES);
    draw(ctx);
    c.refresh();
  };
  for (const [key, arms] of <[string, number[]][]>[
    ['ult-giant-up', [0, 0]],
    ['ult-giant-l', [1, 0]],
    ['ult-giant-r', [0, 1]],
  ])
    make(key, GW, GH, (ctx) => giant(ctx, GX, GY, 1, 0, arms));
  make('ult-fist', 80, 200, (ctx) => fist(ctx, 40, 190, 1, 1, 1));
}
