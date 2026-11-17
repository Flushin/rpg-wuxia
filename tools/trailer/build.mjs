// Monta o trailer a partir das tomadas gravadas por record.mjs: cortes, textos, transições,
// música (faixa CC0 do próprio jogo) e efeitos sonoros nos quadros em que aconteceram.
// Uso: node tools/trailer/build.mjs [--out trailer-out]   →   trailer-out/wanderers-trailer.mp4
// Precisa de ffmpeg e do Playwright (para desenhar os textos em HTML).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};
const OUT = path.resolve(arg('--out', 'trailer-out'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FPS = 60,
  W = 1920,
  H = 1080,
  XF = 0.5; // duração das transições (s)
const TMP = path.join(OUT, 'build');
fs.mkdirSync(TMP, { recursive: true });

// ---------- montagem: ordem, cortes (em quadros) e textos ----------
// text: [arquivo do texto, início (s), fim (s)] — tempos dentro da tomada já cortada
const EDIT = [
  { shot: 'vila', from: 0, to: 330, texts: [['titulo', 0.4, 3.6]] },
  { shot: 'mestres', from: 0, to: 270, texts: [['seitas', 0.5, 4.0]] },
  { shot: 'portao', from: 20, to: 300, texts: [['explore', 0.5, 3.6]] },
  { shot: 'floresta', from: 0, to: 270 },
  { shot: 'combate_tormenta', from: 0, to: 480, texts: [['tormenta', 0.3, 3.0]] },
  { shot: 'combate_geada', from: 0, to: 450, texts: [['geada', 0.3, 3.0]] },
  { shot: 'ruinas', from: 0, to: 270, texts: [['ruinas', 0.5, 4.0]] },
  { shot: 'general_revela', from: 0, to: 240, texts: [['general', 1.2, 3.9]] },
  { shot: 'general_luta', from: 0, to: 420 },
  { shot: 'general_final', from: 40, to: 300 },
  { card: 'fim', seconds: 5 },
];

// ---------- textos (HTML → PNG transparente) ----------
const FONT = `'Inter Display', 'Inter', system-ui, sans-serif`;
const caption = (kicker, title, sub = '') => `
  <div style="position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(transparent,rgba(8,10,16,.72))"></div>
  <div style="position:absolute;left:110px;bottom:110px;color:#fff;font-family:${FONT}">
    <div style="display:flex;align-items:center;gap:18px;font-size:26px;font-weight:600;letter-spacing:.32em;color:#e9b48a">
      <span style="width:56px;height:3px;background:#c0623a;display:inline-block"></span>${kicker}</div>
    <div style="font-size:92px;font-weight:800;letter-spacing:.02em;line-height:1.05;margin-top:14px;text-shadow:0 4px 24px rgba(0,0,0,.6)">${title}</div>
    ${sub ? `<div style="font-size:34px;font-weight:500;color:#e8e3da;margin-top:12px;text-shadow:0 2px 12px rgba(0,0,0,.7)">${sub}</div>` : ''}
  </div>`;
const TEXTS = {
  titulo: `
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(8,10,16,.55),rgba(8,10,16,.2) 60%,transparent)"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:${FONT}">
      <div style="font-size:30px;font-weight:600;letter-spacing:.5em;color:#e9b48a;margin-left:.5em">RPG DE AÇÃO WUXIA</div>
      <div style="font-size:190px;font-weight:900;letter-spacing:.08em;margin-left:.08em;line-height:1.1;text-shadow:0 8px 40px rgba(0,0,0,.7)">WANDERERS</div>
      <div style="width:140px;height:4px;background:#c0623a;margin-top:18px"></div>
    </div>`,
  seitas: caption('ESCOLHA SUA SEITA', 'Mestres e caminhos', 'Cada seita luta de um jeito'),
  explore: caption('EXPLORE', 'Da vila à floresta', 'Mapas conectados por portais'),
  tormenta: caption('SEITA TORMENTA', 'A fúria do trovão', 'Espadas de perto · cada golpe cura'),
  geada: caption('SEITA GEADA', 'O gelo das montanhas', 'Magia à distância · escudos de névoa'),
  ruinas: caption('RUÍNAS DE TERRACOTA', 'Guerreiros que não dormem'),
  general: caption('CHEFE', 'O General de Terracota'),
};

async function renderTexts() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    pw = createRequire('/opt/node22/lib/node_modules/x')('playwright');
  }
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [name, html] of Object.entries(TEXTS)) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await page.screenshot({ path: path.join(TMP, `t_${name}.png`), omitBackground: true });
  }
  // cartela final: fundo = um quadro da vila, desfocado e escurecido
  const bgFile = path.join(OUT, 'frames', 'vila', '00329.jpg');
  const bg = fs.existsSync(bgFile) ? `data:image/jpeg;base64,${fs.readFileSync(bgFile).toString('base64')}` : '';
  const icon = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'public/icons/icon-512.png')).toString('base64')}`;
  await page.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#10141c;font-family:${FONT}">
    <div style="position:absolute;inset:-40px;background:url(${bg}) center/cover;filter:blur(14px) brightness(.38) saturate(1.1)"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">
      <img src="${icon}" style="width:170px;height:170px;border-radius:36px;box-shadow:0 10px 40px rgba(0,0,0,.5)">
      <div style="font-size:150px;font-weight:900;letter-spacing:.08em;margin:26px 0 0 .08em;line-height:1">WANDERERS</div>
      <div style="width:140px;height:4px;background:#c0623a;margin:30px 0 34px"></div>
      <div style="font-size:46px;font-weight:600">Jogue grátis no navegador</div>
      <div style="font-size:30px;font-weight:500;color:#d9d2c6;margin-top:14px;letter-spacing:.06em">PC E CELULAR · SEM INSTALAR</div>
      <div style="font-size:30px;font-weight:600;color:#e9b48a;margin-top:44px;letter-spacing:.02em">flushin.github.io/rpg-wuxia</div>
    </div></body></html>`);
  await page.screenshot({ path: path.join(TMP, 'card_fim.png') });
  await browser.close();
}

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg falhou: ' + args.join(' '));
}

// ---------- cada tomada vira um clipe (com os textos por cima) ----------
function buildClip(e, i) {
  const out = path.join(TMP, `clip_${String(i).padStart(2, '0')}.mp4`);
  const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
  if (e.card) {
    const d = e.seconds;
    // leve aproximação na cartela final
    ff([
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-t',
      String(d),
      '-i',
      path.join(TMP, `card_${e.card}.png`),
      '-vf',
      `scale=${W * 2}:${H * 2},zoompan=z='1+0.03*on/${d * FPS}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`,
      ...enc,
      out,
    ]);
    return { out, dur: d };
  }
  const n = e.to - e.from,
    dur = n / FPS;
  const inputs = [
    '-framerate',
    String(FPS),
    '-start_number',
    String(e.from),
    '-i',
    path.join(OUT, 'frames', e.shot, '%05d.jpg'),
  ];
  let filter = '[0:v]null[v0]';
  (e.texts ?? []).forEach(([name, a, b], k) => {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', path.join(TMP, `t_${name}.png`));
    filter += `;[${k + 1}:v]format=rgba,fade=in:st=${a}:d=0.45:alpha=1,fade=out:st=${b - 0.45}:d=0.45:alpha=1[t${k}]`;
    filter += `;[v${k}][t${k}]overlay=0:0:shortest=1[v${k + 1}]`;
  });
  const last = `[v${(e.texts ?? []).length}]`;
  ff([...inputs, '-filter_complex', filter, '-map', last, '-frames:v', String(n), ...enc, out]);
  return { out, dur };
}

// ---------- áudio: música + efeitos sonoros mixados em Float32 ----------
const SR = 48000;
function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], {
    maxBuffer: 1 << 30,
  });
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}
function mixAudio(clips, total) {
  const N = Math.ceil(total * SR) * 2,
    mix = new Float32Array(N);
  const music = decode(path.join(ROOT, 'public/audio/music/floresta.mp3'));
  const fadeIn = 1.0 * SR,
    fadeOut = 3.5 * SR,
    frames = N / 2;
  for (let s = 0; s < frames && s * 2 + 1 < music.length; s++) {
    const g = 0.55 * Math.min(1, s / fadeIn) * Math.min(1, (frames - s) / fadeOut);
    mix[s * 2] += music[s * 2] * g;
    mix[s * 2 + 1] += music[s * 2 + 1] * g;
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/audio.json'), 'utf8')).sfx;
  const cache = {};
  const sfx = (k) => {
    if (!(k in cache)) {
      const f = path.join(ROOT, 'public/audio/sfx', `${cfg[k]?.file ?? k}.mp3`);
      cache[k] = fs.existsSync(f) ? decode(f) : null;
    }
    return cache[k];
  };
  let count = 0;
  for (const c of clips) {
    if (!c.edit.shot) continue;
    const log = JSON.parse(fs.readFileSync(path.join(OUT, 'frames', c.edit.shot, 'sfx.json'), 'utf8')).sfx;
    const last = {};
    for (const { f, k } of log) {
      if (f < c.edit.from || f >= c.edit.to) continue;
      if (['ui_click', 'ui_open', 'ui_close', 'tip', 'level_up', 'point_spent'].includes(k)) continue;
      if (last[k] !== undefined && f - last[k] < 4) continue; // mesmo som em < 4 quadros: um só
      last[k] = f;
      const buf = sfx(k);
      if (!buf) continue;
      const vol = (cfg[k]?.volume ?? 0.8) * 0.75;
      const at = Math.round((c.start + (f - c.edit.from) / FPS) * SR) * 2;
      for (let j = 0; j < buf.length && at + j < N; j++) mix[at + j] += buf[j] * vol;
      count++;
    }
  }
  // limitador simples
  let peak = 0;
  for (let j = 0; j < N; j++) peak = Math.max(peak, Math.abs(mix[j]));
  const k = peak > 0.95 ? 0.95 / peak : 1;
  for (let j = 0; j < N; j++) mix[j] = Math.tanh(mix[j] * k * 1.1) / Math.tanh(1.1);
  const raw = path.join(TMP, 'mix.f32');
  fs.writeFileSync(raw, Buffer.from(mix.buffer));
  console.log(`áudio: ${count} efeitos sonoros, pico ${peak.toFixed(2)}`);
  return raw;
}

// ---------- montagem final ----------
await renderTexts();
const clips = [];
let t = 0;
EDIT.forEach((e, i) => {
  const c = buildClip(e, i);
  c.edit = e;
  c.start = i === 0 ? 0 : t - XF;
  t = c.start + c.dur;
  clips.push(c);
  console.log(`clipe ${i} ${e.shot ?? e.card}: ${c.dur.toFixed(2)} s (começa em ${c.start.toFixed(2)} s)`);
});
const total = t;
const raw = mixAudio(clips, total);

const inputs = clips.flatMap((c) => ['-i', c.out]);
let filter = '',
  prev = '[0:v]';
clips.slice(1).forEach((c, k) => {
  const i = k + 1;
  const trans = i === clips.length - 1 ? 'fadeblack' : 'fade';
  filter += `${prev}[${i}:v]xfade=transition=${trans}:duration=${XF}:offset=${c.start.toFixed(4)}[x${i}];`;
  prev = `[x${i}]`;
});
filter += `${prev}fade=in:st=0:d=0.8,fade=out:st=${(total - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
const final = path.join(OUT, 'wanderers-trailer.mp4');
ff([
  ...inputs,
  '-f',
  'f32le',
  '-ar',
  String(SR),
  '-ac',
  '2',
  '-i',
  raw,
  '-filter_complex',
  filter,
  '-map',
  '[v]',
  '-map',
  `${clips.length}:a`,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '18',
  '-profile:v',
  'high',
  '-r',
  String(FPS),
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-shortest',
  '-movflags',
  '+faststart',
  final,
]);
console.log(`pronto: ${final} (${total.toFixed(1)} s)`);
