// Teste de sobreposição do HUD em vários tamanhos de tela (inclui Galaxy Z Fold fechado e aberto).
// Uso: npm run build && npx vite preview --port 4173 &  →  node tools/layout-check.mjs [url]
// Precisa do Playwright (npx playwright install chromium) ou de um Chrome instalado.
let pw;
try { pw = await import('playwright'); } catch { pw = await import('playwright-core'); }
const URL = process.argv[2] ?? 'http://localhost:4173/';

const SIZES = [
  { name: 'celular em pé 390×844', w: 390, h: 844, touch: true },
  { name: 'celular deitado 844×390', w: 844, h: 390, touch: true },
  { name: 'celular pequeno 360×740', w: 360, h: 740, touch: true },
  { name: 'Fold fechado deitado 920×316', w: 920, h: 316, touch: true, feed: 2 },
  { name: 'Fold aberto 884×1028', w: 884, h: 1028, touch: true, feed: 4 },
  { name: 'PC 1366×768', w: 1366, h: 768, touch: false, feed: 4 },
];
const IDS = ['player-frame', 'target-frame', 'loot-feed', 'top-right', 'quest-tracker', 'joystick', 'potion-bar', 'btn-attack', 'hotbar'];

const browser = await pw.chromium.launch({ executablePath: process.env.CHROME ?? undefined }).catch(() => pw.chromium.launch({ executablePath: '/usr/bin/google-chrome' }));
let fails = 0;
for (const sz of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, isMobile: sz.touch, hasTouch: sz.touch, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.click('[data-act="new"]');
  await page.fill('#char-name', 'Teste');
  await page.click('#btn-start');
  await page.waitForSelector('#hud:not(.hidden)');
  await page.waitForTimeout(800);
  const res = await page.evaluate(({ ids, lines }) => {
    const $ = (id) => document.getElementById(id);
    for (const id of ['tip-card']) $(id).classList.add('hidden');
    const tf = $('target-frame'); tf.classList.remove('hidden'); $('t-name').textContent = 'Guerreiro de Terracota'; $('t-level').textContent = 'Nv 9';
    const feed = $('loot-feed');
    const compact = matchMedia('(orientation:landscape) and (max-height:450px)').matches;
    const n = Math.min(lines ?? 4, compact ? 2 : 4);
    feed.innerHTML = Array.from({ length: n }, (_, i) => `<div style="color:#4aa3ff">+ Couraça de Couro Reforçado ${i} <b>×3</b></div>`).join('');
    // mesma regra de Rewards.place(): abaixo do quadro do personagem ou do alvo empilhado à esquerda
    const pf = $('player-frame').getBoundingClientRect(), r = tf.getBoundingClientRect();
    feed.style.top = `${Math.round((r.left < pf.right && r.top >= pf.bottom - 2 ? r.bottom : pf.bottom) + 6)}px`;
    const boxes = [];
    for (const id of ids) {
      const el = $(id);
      if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') continue;
      if (id === 'hotbar') { for (const s of el.querySelectorAll('.slot')) boxes.push([`hotbar.${[...el.children].indexOf(s)}`, s.getBoundingClientRect()]); continue; }
      const b = el.getBoundingClientRect(); if (b.width && b.height) boxes.push([id, b]);
    }
    const out = [], W = innerWidth, H = innerHeight;
    for (const [id, b] of boxes) if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) out.push(`${id} sai da tela`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [a, A] = boxes[i], [b, B] = boxes[j];
      if (a.startsWith('hotbar') && b.startsWith('hotbar')) continue;
      if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) out.push(`${a} × ${b}`);
    }
    return { out, feedLines: n, compact };
  }, { ids: IDS, lines: sz.feed });
  const ok = !res.out.length;
  if (!ok) fails++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${sz.name} (feed ${res.feedLines} linhas)${ok ? '' : ': ' + res.out.join('; ')}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${sz.w}x${sz.h}.png` });
  await ctx.close();
}
await browser.close();
console.log(fails ? `layout-check: ${fails} tamanho(s) com sobreposição` : 'layout-check: tudo ok');
process.exit(fails ? 1 : 0);
