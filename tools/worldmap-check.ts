// Mapa-múndi (src/core/worldRoutes.ts): de qualquer mapa se chega a qualquer outro, e todo mapa tem lugar na grade.
import { readFileSync } from 'node:fs';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { MAP_IDS, MAPS_CONFIG } from '../src/core/mapsConfig';
import { portalSide, worldLinks, worldRoute } from '../src/core/worldRoutes';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.log('FALHA:', m);
  }
};
const maps: Record<string, GameMap> = {};
for (const id of MAP_IDS) maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const links = worldLinks(maps);

for (const a of MAP_IDS)
  for (const b of MAP_IDS) {
    const r = worldRoute(links, a, b);
    ok(!!r, `sem caminho de ${a} até ${b}`);
    if (r && r.length) ok(r[0].from === a && r[r.length - 1].to === b, `rota ${a}->${b} mal formada`);
  }
const cells = new Set<string>();
for (const id of MAP_IDS) {
  const g = MAPS_CONFIG[id].world;
  ok(!!g, `${id} sem posição no mapa-múndi (MAPS_CONFIG.world)`);
  if (g) {
    ok(!cells.has(`${g.col},${g.row}`), `${id} na mesma célula de outro mapa`);
    cells.add(`${g.col},${g.row}`);
  }
}
// rota esperada até o Pico da Névoa, e lados dos portais na tela
const pico = worldRoute(links, 'cidade', 'pico')!;
ok(pico.map((l) => l.to).join('>') === 'montanha>bambu>pico', `rota vila->pico: ${pico.map((l) => l.to)}`);
ok(Math.max(...pico.map((l) => l.minLevel)) === 25, 'pico exige nível 25 no caminho');
const side = (from: string, to: string) =>
  portalSide(maps[from], links.find((l) => l.from === from && l.to === to)!.portal);
ok(side('cidade', 'montanha') === 1, 'saída para a montanha: no alto à direita');
ok(side('cidade', 'floresta') === 3, 'saída para a floresta: embaixo à direita');
ok(side('montanha', 'bambu') === 4, 'saída para o bosque: embaixo');
ok(worldRoute(links, 'covil', 'pico')!.length === 4, 'da masmorra volta pela vila');

if (fails) {
  console.log(`${fails} falha(s)`);
  process.exit(1);
}
console.log(`OK mapa-múndi: ${MAP_IDS.length} mapas, ${links.length} ligações, rota entre todos os pares`);
