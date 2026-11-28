// Gera as camadas da asa dos títulos exclusivos (escolhida: nº 6 "Brilho suave" de previews/asas-titulo.html),
// nas cores usadas (TitleWing em src/core/arena.ts), em public/sprites/fx/:
//   title-wing-<cor>.svg (asa), title-wing-<cor>-halo.svg (brilho atrás), title-wing-<cor>-stars.svg (estrelinhas).
// Asa ESQUERDA; viewBox -16 -8 54 62; ombro (ponto de giro) em (34,30). Rodar: node tools/title-wing-svg.mjs
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
// cor da asa -> nome da cor na prévia (COLORS)
const WINGS = { branca: 'Branca e ouro (atual)', celeste: 'Celeste', noite: 'Noite (escura)' };
mkdirSync('public/sprites/fx', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/previews/asas-titulo.html');
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -8 54 62" width="216" height="248">${body}</svg>\n`;
const clean = (v) => v.replace(/ style="animation-delay:[^"]*"/g, '').replaceAll(' class="shine"', '');
for (const [wing, name] of Object.entries(WINGS)) {
  /* global COLORS, F, F2, S, STAR, fofa, halo, stars, NARROW, ST_N */
  const parts = await p.evaluate((name) => {
    const c = COLORS.find((x) => x.n === name);
    [F, F2, S, STAR] = [c.F, c.F2, c.S, c.ST];
    return { '': fofa(NARROW), '-halo': halo('h', c.H), '-stars': stars(ST_N) };
  }, name);
  for (const [k, v] of Object.entries(parts))
    writeFileSync(`public/sprites/fx/title-wing-${wing}${k}.svg`, svg(clean(v)));
}
await b.close();
console.log('ok');
