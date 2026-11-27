import { readFileSync } from 'node:fs';
// Teste de sobreposição do HUD em vários tamanhos de tela (inclui Galaxy Z Fold fechado e aberto).
// Uso: npm run build && npx vite preview --port 4173 &  →  node tools/layout-check.mjs [url]
// Precisa do Playwright (npx playwright install chromium) ou de um Chrome instalado.
import { semDicas } from './sem-dicas.mjs';
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
  // iPhone 17 Pro Max instalado na tela inicial: margens reais do iOS (ilha/cantos e barra do home)
  {
    name: 'iPhone 17 Pro Max instalado 956×440 (margens 62/62/20)',
    w: 956,
    h: 440,
    touch: true,
    feed: 2,
    iphone: true,
    insets: { top: 0, left: 62, right: 62, bottom: 20 },
    // o HUD pode entrar um pouco na margem lateral (base.css), mas não na ilha (~48px) nem na barra do home
    keep: { left: 48, right: 48, bottom: 20 },
  },
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

const ULT_DATA = JSON.parse(readFileSync(new globalThis.URL('../src/data/ultimates.json', import.meta.url), 'utf8'));
const EN = JSON.parse(readFileSync(new globalThis.URL('../src/data/en.json', import.meta.url), 'utf8'));
const ULT_NAMES = Object.values(ULT_DATA)
  .filter((u) => u && u.name)
  .flatMap((u) =>
    [u.name, EN.strings?.[u.name] ?? EN[u.name]].filter(Boolean).map((n) => `${u.icon ?? ''} ${n.toUpperCase()}`),
  )
  .concat(['🔒 NÍVEL 30', '🔒 LEVEL 30']);

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
      ...(sz.iphone && {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
      }),
    });
    const page = await ctx.newPage();
    if (sz.insets) {
      // margens do notch/home (env(safe-area-inset-*)), como no aparelho
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: sz.insets });
    }
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
      ({ ids, lines, ultNames, keep }) => {
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
        // arco da ultimate (HUD novo do celular): caixas ao longo da faixa
        const track = document.querySelector('.ult-arc:not(.hidden) .ua-track');
        if (track) {
          const L = track.getTotalLength(),
            m = track.getScreenCTM(),
            half = (parseFloat(track.getAttribute('stroke-width')) / 2 + 2) * m.a;
          for (let i = 0; i <= 16; i++) {
            const q = track.getPointAtLength((L * i) / 16),
              x = q.x * m.a + m.e,
              y = q.y * m.d + m.f;
            boxes.push([`ult-arc.${i}`, { left: x - half, right: x + half, top: y - half, bottom: y + half }]);
          }
        }
        const out = [],
          W = innerWidth,
          H = innerHeight;
        for (const [id, b] of boxes)
          if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) out.push(`${id} sai da tela`);
          else if (keep && (b.left < keep.left || b.right > W - keep.right || b.bottom > H - keep.bottom))
            out.push(`${id} entra na ilha/barra do home`);
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const [a, A] = boxes[i],
              [b, B] = boxes[j];
            if (a.startsWith('ult-arc') && (b.startsWith('ult-arc') || b.startsWith('hotbar') || b === 'btn-attack'))
              continue; // o arco abraça as skills com vão próprio (thumbLayout.ts)
            if (b.startsWith('ult-arc') && (a.startsWith('hotbar') || a === 'btn-attack')) continue;
            const round = (id) => id.startsWith('hotbar') || id === 'btn-attack';
            if (round(a) && round(b)) {
              // botões redondos (skills e Atacar): compara círculos, não caixas
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
        // texto do arco da ultimate: todos os nomes (PT/EN, normal e "pronto" em negrito) cabem na faixa
        if (document.querySelector('.ult-arc:not(.hidden)') && window.__ultFits)
          for (const t of ultNames)
            for (const r of [false, true])
              if (!window.__ultFits(t, r)) out.push(`ult-arc texto cortado: ${t}${r ? ' (pronto)' : ''}`);
        return { out, feedLines: n, compact, ui };
      },
      { ids: IDS, lines: sz.feed, ultNames: ULT_NAMES, keep: sz.keep },
    );
    const ok = !res.out.length;
    if (!ok) fails++;
    console.log(
      `${ok ? 'OK   ' : 'FALHA'} ${sz.name} (feed ${res.feedLines} linhas, escala ${res.ui})${ok ? '' : ': ' + res.out.join('; ')}`,
    );
    if (process.env.SHOTS) await semDicas(page);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${sz.w}x${sz.h}-${mode}.png` });
    await ctx.close();
  }
await browser.close();
console.log(fails ? `layout-check: ${fails} tamanho(s) com sobreposição` : 'layout-check: tudo ok');
process.exit(fails ? 1 : 0);
