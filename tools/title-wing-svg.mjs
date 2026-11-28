// Gera as 3 camadas da asa do título exclusivo (escolhida: nº 6 "Brilho suave" de previews/asas-titulo.html)
// em public/sprites/fx/: title-wing.svg (asa), title-wing-halo.svg (brilho atrás), title-wing-stars.svg (estrelinhas).
// Asa ESQUERDA; viewBox -16 -8 54 62; ombro (ponto de giro) em (34,30). Rodar: node tools/title-wing-svg.mjs
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/previews/asas-titulo.html');
const parts = await p.evaluate(() => ({
  // eslint-disable-next-line no-undef
  wing: fofa(NARROW),
  halo: halo('h'),
  stars: stars(ST_N).replaceAll(' class="shine"', ''),
}));
await b.close();
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -8 54 62" width="216" height="248">${body}</svg>\n`;
for (const [k, v] of Object.entries(parts))
  writeFileSync(
    `public/sprites/fx/title-wing${k === 'wing' ? '' : '-' + k}.svg`,
    svg(v.replace(/ style="animation-delay:[^"]*"/g, '').replace(' class="shine"', '')),
  );
console.log('ok');
