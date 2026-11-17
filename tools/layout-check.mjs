// Teste de sobreposição do HUD em vários tamanhos de tela (inclui Galaxy Z Fold fechado e aberto).
// Uso: npm run build && npx vite preview --port 4173 &  →  node tools/layout-check.mjs [url]
// Precisa do Playwright (npx playwright install chromium) ou de um Chrome instalado.
let pw;
try {
  pw = await import('playwright');
} catch {
  pw = await import('playwright-core');
}
const URL = process.argv[2] ?? 'http://localhost:4173/';

const SIZES = [
  { name: 'celular em pé 390×844', w: 390, h: 844, touch: true },
  { name: 'celular deitado 844×390', w: 844, h: 390, touch: true },
  { name: 'celular pequeno 360×740', w: 360, h: 740, touch: true },
  { name: 'iPhone Pro Max deitado 932×430', w: 932, h: 430, touch: true, feed: 2 },
  { name: 'Fold fechado deitado 920×316', w: 920, h: 316, touch: true, feed: 2 },
  { name: 'Fold aberto 884×1028', w: 884, h: 1028, touch: true, feed: 4 },
  { name: 'PC 1366×768', w: 1366, h: 768, touch: false, feed: 4 },
];
const IDS = [
  'player-frame',
  'target-frame',
  'loot-feed',
  'top-right',
  'quest-tracker',
  'joystick',
  'potion-bar',
  'btn-attack',
  'hotbar',
];

const browser = await pw.chromium
  .launch({ executablePath: process.env.CHROME ?? undefined })
  .catch(() => pw.chromium.launch({ executablePath: '/usr/bin/google-chrome' }));
let fails = 0;
// cada tamanho é testado com o tamanho da interface Automático e Grande (⚙)
const MODES = (process.env.UI_MODES ?? 'auto,g').split(',');
for (const sz0 of SIZES)
  for (const mode of MODES) {
    const sz = { ...sz0, name: `${sz0.name} [interface ${mode}]` };
    const ctx = await browser.newContext({
      viewport: { width: sz.w, height: sz.h },
      isMobile: sz.touch,
      hasTouch: sz.touch,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.addInitScript((m) => {
      try {
        localStorage.setItem('rpg-ui-size', m);
      } catch {}
    }, mode);
    await page.goto(URL);
    await page.click('[data-act="new"]');
    await page.fill('#char-name', 'Teste');
    await page.click('#btn-start');
    await page.waitForSelector('#hud:not(.hidden)');
    await page.waitForTimeout(800);
    const res = await page.evaluate(
      ({ ids, lines }) => {
        const $ = (id) => document.getElementById(id);
        for (const id of ['tip-card']) $(id).classList.add('hidden');
        const tf = $('target-frame');
        tf.classList.remove('hidden');
        $('t-name').textContent = 'Guerreiro de Terracota';
        $('t-level').textContent = 'Nv 9';
        const feed = $('loot-feed');
        const compact = matchMedia('(orientation:landscape) and (max-height:450px)').matches;
        const n = Math.min(lines ?? 4, compact ? 2 : 4);
        feed.innerHTML = Array.from(
          { length: n },
          (_, i) => `<div style="color:#4aa3ff">+ Couraça de Couro Reforçado ${i} <b>×3</b></div>`,
        ).join('');
        // regra real do jogo (placeFeed em src/ui/rewards.ts): abaixo do quadro do personagem/alvo, ou ao lado se não couber
        window.__placeFeed();
        const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
        const boxes = [];
        for (const id of ids) {
          const el = $(id);
          if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') continue;
          if (id === 'hotbar') {
            for (const s of el.querySelectorAll('.slot'))
              boxes.push([`hotbar.${[...el.children].indexOf(s)}`, s.getBoundingClientRect()]);
            continue;
          }
          const b = el.getBoundingClientRect();
          if (b.width && b.height) boxes.push([id, b]);
        }
        const out = [],
          W = innerWidth,
          H = innerHeight;
        for (const [id, b] of boxes)
          if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) out.push(`${id} sai da tela`);
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const [a, A] = boxes[i],
              [b, B] = boxes[j];
            if (a.startsWith('hotbar') && b.startsWith('hotbar')) {
              // botões redondos: compara círculos, não caixas
              const d = Math.hypot(
                (A.left + A.right - B.left - B.right) / 2,
                (A.top + A.bottom - B.top - B.bottom) / 2,
              );
              if (d < (A.width + B.width) / 2 - 1) out.push(`${a} × ${b}`);
              continue;
            }
            if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1)
              out.push(`${a} × ${b}`);
          }
        return { out, feedLines: n, compact, ui };
      },
      { ids: IDS, lines: sz.feed },
    );
    const ok = !res.out.length;
    if (!ok) fails++;
    console.log(
      `${ok ? 'OK   ' : 'FALHA'} ${sz.name} (feed ${res.feedLines} linhas, escala ${res.ui})${ok ? '' : ': ' + res.out.join('; ')}`,
    );
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${sz.w}x${sz.h}-${mode}.png` });
    await ctx.close();
  }
await browser.close();
console.log(fails ? `layout-check: ${fails} tamanho(s) com sobreposição` : 'layout-check: tudo ok');
process.exit(fails ? 1 : 0);
