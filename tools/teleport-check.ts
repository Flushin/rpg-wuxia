// Verificação headless do teleporte do Mestre dos Caminhos (src/core/teleport.ts): destinos válidos, nível mínimo
// nunca abaixo do caminho a pé, só da vila, trava de nível e de ouro, custo cobrado. Uso: npm run check:teleport
import { readFileSync } from 'node:fs';
import { MAPS_CONFIG, MAP_IDS, TOWN_MAPS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { TELEPORT_COST, TELEPORT_DESTS, teleportById } from '../src/core/teleport';
import { World } from '../src/core/world';
import { worldLinks, worldRoute } from '../src/core/worldRoutes';
import type { GameEvent, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const maps: Record<string, GameMap> = {};
for (const id of MAP_IDS) maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const NOW = 1_800_000_000_000;
const save = (level: number, gold: number, mapId = 'cidade'): SaveData => ({
  version: 1,
  name: 'T',
  classId: 'lamina',
  level,
  xp: 0,
  freePoints: 0,
  attributes: { strength: 30, intelligence: 5, stamina: 500, agility: 20, willpower: 5 },
  mapId,
  gold,
  lastSeen: NOW,
});
const fresh = (level: number, gold: number, mapId = 'cidade') =>
  World.fromSave(maps, save(level, gold, mapId), NOW, false);
const drain = (w: World): GameEvent[] => w.events.splice(0);

console.log('\n== dados ==');
ok(TELEPORT_COST === 200, 'viagem custa 200 de ouro');
ok(new Set(TELEPORT_DESTS.map((d) => d.map)).size === TELEPORT_DESTS.length, 'destinos sem repetição');
const links = worldLinks(maps);
for (const d of TELEPORT_DESTS) {
  const c = MAPS_CONFIG[d.map];
  ok(!!maps[d.map] && !!c && !c.town && !c.dungeon, `${d.map}: mapa existe e é mapa aberto (não cidade/instância)`);
  ok(!!d.region.pt && !!d.region.en, `${d.map}: região com texto PT e EN`);
  const path = worldRoute(links, 'cidade', d.map);
  const walk = Math.max(0, ...(path ?? []).map((l) => l.minLevel));
  ok(!!path && d.minLevel >= walk, `${d.map}: nível ${d.minLevel} não fica abaixo do caminho a pé (${walk})`);
  if (d.x === undefined)
    ok(
      maps[d.map].objects.some((o) => o.type === 'spawn'),
      `${d.map}: tem ponto de chegada`,
    );
}

console.log('\n== viagem ==');
{
  const w = fresh(30, 1000);
  drain(w);
  ok(w.travelTo('pico') === null && w.mapId === 'pico', 'viaja da vila para o Pico');
  ok(w.gold === 1000 - TELEPORT_COST, 'cobra o custo');
  ok(
    drain(w).some((e) => e.type === 'teleport' && e.map === 'pico' && e.cost === TELEPORT_COST),
    'emite o evento teleport',
  );
  const gold = w.gold;
  ok(w.travelTo('floresta') === null && w.mapId === 'pico' && w.gold === gold, 'fora da vila não viaja nem cobra');
}
{
  const w = fresh(24, 1000);
  const err = w.travelTo('pico');
  ok(err?.code === 'needLevel' && err.level === 25 && w.mapId === 'cidade' && w.gold === 1000, 'trava por nível');
}
{
  const w = fresh(30, TELEPORT_COST - 1);
  const err = w.travelTo('floresta');
  ok(err?.code === 'noGold' && w.mapId === 'cidade' && w.gold === TELEPORT_COST - 1, 'trava por ouro');
}
{
  const w = fresh(30, 1000);
  ok(w.travelTo('gruta') === null && w.mapId === 'cidade' && w.gold === 1000, 'masmorra não é destino');
  w.player.dead = true;
  ok(w.travelTo('floresta') === null && w.mapId === 'cidade' && w.gold === 1000, 'morto não viaja');
}
ok(!teleportById('cidade') && [...TOWN_MAPS].every((t) => !teleportById(t)), 'vila não é destino');

if (fails) {
  console.error(`\n${fails} falha(s)`);
  process.exit(1);
}
console.log('\nteleporte ok');
