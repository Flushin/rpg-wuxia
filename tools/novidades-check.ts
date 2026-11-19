// Confere src/data/novidades.json: a versão do package.json tem entrada, as versões estão em ordem e sem repetição,
// os links apontam para páginas que existem na wiki e o texto da Play Store cabe no limite (pt e en).
// (A tradução EN de cada item é conferida pelo check:i18n.) Uso: npm run check:novidades
import { readFileSync } from 'node:fs';
import en from '../src/data/en.json';
import { LOJA_LIMITE, NOVIDADES, novidadesDa, textoLoja } from '../src/core/novidades';
import { MAP_IDS } from '../src/core/mapsConfig';
import { CLASSES, MONSTERS, allItemIds, skillById } from '../src/wiki/data';
import { NPCS } from '../src/wiki/npcs';

let fails = 0;
const bad = (m: string) => {
  fails++;
  console.log('FALHA:', m);
};
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// páginas da wiki (as mesmas rotas de src/wiki/main.ts)
const LISTAS = ['', 'novidades', 'mecanicas', 'seitas', 'skills', 'itens', 'monstros', 'npcs', 'missoes', 'mapas'];
const MECANICAS = ['combate', 'morte', 'forja', 'auto', 'trial'];
function paginaExiste(p: string): boolean {
  const [a, b, ...resto] = p.split('/');
  if (resto.length) return false;
  if (b === undefined) return LISTAS.includes(a);
  if (a === 'mecanicas') return MECANICAS.includes(b);
  if (a === 'itens') return ['equip', 'potion', 'material', 'consumable'].includes(b); // abas de src/wiki/items.ts
  if (a === 'seita') return b in CLASSES;
  if (a === 'skill') return !!skillById(b);
  if (a === 'item') return allItemIds().includes(b);
  if (a === 'monstro') return b in MONSTERS;
  if (a === 'mapa') return MAP_IDS.includes(b);
  if (a === 'npc') return NPCS().some((n) => n.id === b);
  return false;
}

const semver = (v: string) => v.split('.').map(Number);
const maior = (x: string, y: string) => {
  const [a, b] = [semver(x), semver(y)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

if (!novidadesDa(pkg.version)) bad(`a versão ${pkg.version} do package.json não tem entrada em novidades.json`);
const vistas = new Set<string>();
NOVIDADES.versoes.forEach((v, i) => {
  if (!/^\d+\.\d+\.\d+$/.test(v.versao)) bad(`versão "${v.versao}" fora do formato 1.2.3`);
  if (vistas.has(v.versao)) bad(`versão ${v.versao} repetida`);
  vistas.add(v.versao);
  const prev = NOVIDADES.versoes[i - 1];
  if (prev && !maior(prev.versao, v.versao))
    bad(`versões fora de ordem: ${prev.versao} antes de ${v.versao} (mais nova primeiro)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data) || isNaN(Date.parse(v.data))) bad(`v${v.versao}: data "${v.data}" inválida`);
  if (!v.itens.length) bad(`v${v.versao}: sem itens`);
});
for (const [onde, itens] of [
  ['proxima', NOVIDADES.proxima],
  ...NOVIDADES.versoes.map((v) => [`v${v.versao}`, v.itens] as const),
] as const)
  itens.forEach((n, i) => {
    if (!n.texto?.trim()) bad(`${onde}[${i}]: texto vazio`);
    if (n.wiki !== undefined && !paginaExiste(n.wiki)) bad(`${onde}[${i}]: página da wiki "${n.wiki}" não existe`);
  });

// texto da Play Store da versão atual (pt e en) cabe no limite
const atual = NOVIDADES.versoes.findIndex((v) => v.versao === pkg.version);
if (atual >= 0) {
  const pt = textoLoja(NOVIDADES.versoes[atual].itens.map((n) => n.texto));
  const enItens = (en.novidades.versoes[atual]?.itens ?? []) as { texto: string }[];
  const ing = textoLoja(enItens.map((n) => n.texto));
  if (pt.length > LOJA_LIMITE) bad(`texto da loja (pt) com ${pt.length} caracteres; limite ${LOJA_LIMITE}`);
  if (ing.length > LOJA_LIMITE) bad(`texto da loja (en) com ${ing.length} caracteres; limite ${LOJA_LIMITE}`);
}

console.log(fails ? `${fails} problema(s)` : 'novidades-check: tudo ok');
process.exit(fails ? 1 : 0);
