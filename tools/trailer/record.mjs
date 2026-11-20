// Grava as tomadas do trailer quadro a quadro, a partir do jogo rodando em `npm run dev`.
// Uso: npx vite --port 5173 &  →  node tools/trailer/record.mjs [--preview N] [--only a,b] [--out dir]
//
// O relógio do Phaser é controlado daqui: cada quadro avança exatamente 1/60 s (ou menos, na câmera
// lenta) e só então o canvas é fotografado. Por isso o vídeo sai a 60 fps lisos mesmo num navegador
// sem placa de vídeo. O HUD (HTML) não aparece: só o canvas do jogo é gravado.
// Saída: <out>/frames/<tomada>/00000.jpg … e <out>/frames/<tomada>/sfx.json (efeitos sonoros por quadro).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SHOTS } from './shots.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};
const URL = arg('--url', 'http://localhost:5173/');
const OUT = path.resolve(arg('--out', 'trailer-out'));
const PREVIEW = Number(arg('--preview', 0)); // >0: grava só 1 a cada N quadros, para conferir rápido
const ONLY = arg('--only', '')?.split(',').filter(Boolean);
const W = Number(arg('--width', 1920)),
  H = Number(arg('--height', 1080));

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const req = createRequire(path.join(process.env.NODE_PATH ?? '/opt/node22/lib/node_modules', 'x'));
    try {
      return req('playwright');
    } catch {
      return createRequire('/opt/node22/lib/node_modules/x')('playwright');
    }
  }
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();

// ---------- código que roda dentro da página: o "diretor" ----------
async function installDirector() {
  const g = window.game;
  const { tileToScreen } = await import('/src/core/iso.ts');
  const { World } = await import('/src/core/world.ts');
  const { audio } = await import('/src/render/audio.ts');
  const { MONSTERS } = await import('/src/core/data.ts');
  const D = (window.D = {
    g,
    fi: 0,
    speed: 1,
    sfx: [],
    cur: {},
    t: performance.now(),
    get s() {
      return window.__game.scene;
    },
    get w() {
      return window.__game.world;
    },
    get cam() {
      return D.s.cameras.main;
    },
    base: 1.6,
    ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    lerp: (a, b, t) => a + (b - a) * t,
    iso: tileToScreen,
    /** câmera no ponto do mapa (em tiles), zoom relativo à visão normal do jogo */
    look(tx, ty, z = 1, lift = 0) {
      const s = tileToScreen(tx, ty);
      D.cam.stopFollow();
      D.cam.setZoom(D.base * z);
      D.cam.centerOn(s.x, s.y - lift);
    },
    /** como look(), mas trava o centro para a vista nunca sair do mapa (32×32, borda de árvores/pilares) */
    lookSafe(tx, ty, z = 1, lift = 0) {
      const hw = 960 / (D.base * z),
        hh = 540 / (D.base * z);
      const e = (hw / 32 + hh / 16) / 2 + 0.3,
        up = lift / 32;
      const lo = 1 + e - up,
        hi = 31 - e + up;
      const c = (v) => (lo > hi ? 16 : Math.max(lo, Math.min(hi, v)));
      D.look(c(tx), c(ty), z, lift);
    },
    /** posição desenhada (suave) de uma entidade, em tiles */
    pos(e) {
      return { x: e.x, y: e.y };
    },
    mon(name, near) {
      const ms = D.w.monsters.filter((m) => !m.dead && (!name || m.monsterId === name));
      if (!near) return ms[0];
      ms.sort((a, b) => Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y));
      return ms[0];
    },
    skill(slot) {
      const w = D.w;
      const def = w.activeSkills()[slot];
      if (def) w.skills[def.id].cd = 0;
      w.gcd = 0;
      w.player.mana = w.player.derived.maxMana;
      w.useSkill(slot);
    },
    /** põe um monstro no mapa (vida × hpMul para a luta render na tela); chase = já vem atacando */
    spawn(id, x, y, hpMul = 1, chase = false) {
      const w = D.w;
      const m = w.makeMonster(MONSTERS[id], { x, y });
      m.derived.maxHp = Math.round(m.derived.maxHp * hpMul);
      m.hp = m.derived.maxHp;
      m.respawnAt = Infinity;
      w.monsters.push(m);
      if (chase) w.aggro(m);
      return m;
    },
    /** mais perto do personagem, vivo */
    nearest(maxD = 99) {
      const p = D.w.player;
      let best = null,
        bd = maxD;
      for (const m of D.w.monsters) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      return best;
    },
    /** mantém o personagem sempre com alvo */
    keepTarget() {
      const w = D.w;
      if (!w.targetId || !w.monsters.find((m) => m.id === w.targetId && !m.dead)) {
        const m = D.nearest();
        if (m) w.setTarget(m.id);
      }
    },
    strong() {
      const w = D.w;
      do w.gainXp(1e7);
      while (w.levelUpAll() > 0); // XP guardada: sobe tudo de uma vez
      w.distributeRecommended();
      w.player.hp = w.player.derived.maxHp;
      w.player.mana = w.player.derived.maxMana;
    },
    newWorld(classId) {
      const maps = g.registry.get('maps');
      const w = World.create(maps, 'Wanderer', classId);
      D.s.scene.restart({ world: w });
    },
    step() {
      const dt = (1000 / 60) * D.speed;
      D.t += dt;
      g.step(D.t, dt);
    },
    hook() {
      const s = D.s;
      if (s.__dirHooked) return;
      s.__dirHooked = true;
      s.events.on('postupdate', () => {
        const w = D.w;
        if (!w) return;
        if (D.god !== false) {
          w.player.hp = w.player.derived.maxHp;
          w.player.mana = Math.max(w.player.mana, w.player.derived.maxMana * 0.5);
        }
        w.auto.state = 'off';
        // nomes (pessoas, portais), "!" das missões e o aviso "Auto" poluem as tomadas: escondidos.
        // Ficam só os números de dano e os avisos de combate (camada FLOAT_TEXT = 100000).
        const hide = (o) => o.type === 'Text' && o.depth !== 100000 && o.setVisible(false);
        for (const o of s.children.list) {
          hide(o);
          if (o.list) for (const c of o.list) if (c.name === 'label') c.setVisible(false);
        }
        D.cur.cam?.(D, D.fi, D.cur.n);
      });
    },
  });
  // efeitos sonoros: anotados com o número do quadro (o áudio é montado depois, no ffmpeg)
  audio.sfx = (key) => D.sfx.push({ f: D.fi, k: key });
  audio.playMusicForMap = () => {};
  g.loop.sleep();
  D.hook();
  return true;
}

const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'pt-BR' });
page.on('pageerror', (e) => console.log('ERRO na página:', e.message));
await page.addInitScript(() => {
  try {
    localStorage.setItem('rpg-wuxia-lang', 'pt');
  } catch {}
});
await page.goto(URL);
await page.click('[data-act="new"]');
await page.click('.class-card[data-id="lamina"]');
await page.fill('#char-name', 'Wanderer');
await page.click('#btn-start');
await page.waitForFunction(() => window.__game && window.game);
await page.evaluate(installDirector);
await page.evaluate(() => {
  for (let i = 0; i < 30; i++) D.step();
  D.strong();
});

const total = { frames: 0, t0: Date.now() };
for (const shot of SHOTS) {
  if (ONLY?.length && !ONLY.includes(shot.name)) continue;
  const dir = path.join(OUT, 'frames', shot.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = shot.frames;
  await page.evaluate(
    async ({ setup, tick, cam, speed, n }) => {
      // métodos do roteiro chegam como "nome(D) {…}": vira "function nome(D) {…}"
      const f = (src) =>
        src ? (0, eval)('(' + (/^(async\s+)?(function|\()/.test(src) ? src : 'function ' + src) + ')') : null;
      D.cur = { n, tick: f(tick), cam: f(cam), speed: f(speed) };
      D.speed = 1;
      D.god = true;
      D.sfx = [];
      D.fi = -1;
      const st = f(setup);
      if (st) await st(D);
      D.hook();
      // aquece: o primeiro quadro de um mapa novo sobe texturas; não entra no vídeo
      for (let i = 0; i < 2; i++) {
        D.cur.cam?.(D, 0, n);
        D.speed = 0.0001;
        D.step();
      }
      D.sfx = [];
    },
    {
      setup: shot.setup?.toString(),
      tick: shot.tick?.toString(),
      cam: shot.cam?.toString(),
      speed: shot.speed?.toString(),
      n,
    },
  );
  const t0 = Date.now();
  let saved = 0;
  for (let i = 0; i < n; i++) {
    const want = !PREVIEW || i % PREVIEW === 0;
    const url = await page.evaluate(
      ({ i, want }) => {
        D.fi = i;
        D.speed = D.cur.speed ? D.cur.speed(i, D.cur.n) : 1;
        D.cur.tick?.(D, i, D.cur.n);
        D.step();
        return want ? D.g.canvas.toDataURL('image/jpeg', 0.95) : null;
      },
      { i, want },
    );
    if (url) {
      fs.writeFileSync(
        path.join(dir, `${String(PREVIEW ? saved : i).padStart(5, '0')}.jpg`),
        Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'),
      );
      saved++;
    }
  }
  const sfx = await page.evaluate(() => D.sfx);
  fs.writeFileSync(path.join(dir, 'sfx.json'), JSON.stringify({ frames: n, sfx }));
  total.frames += n;
  console.log(`${shot.name}: ${n} quadros (${saved} salvos) em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`total ${total.frames} quadros em ${((Date.now() - total.t0) / 1000).toFixed(0)} s`);
await browser.close();
