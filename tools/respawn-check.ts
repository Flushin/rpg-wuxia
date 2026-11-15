// Verificação headless do renascimento com tempo (monstros comuns continuam mortos fora do mapa).
// Uso: npm run check:respawn
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import type { Entity, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('  FALHOU:', m); } else console.log('  ok:', m); };
const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta', 'ruinas']) maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const kill = (w: World, m: Entity) => (w as unknown as { killMonster: (m: Entity) => void }).killMonster(m);
const NOW = 1_800_000_000_000;
let clock = NOW;
const save: SaveData = { version: 1, name: 'T', classId: 'lamina', level: 5, xp: 0, freePoints: 0, attributes: { strength: 9, intelligence: 5, stamina: 500, agility: 9, willpower: 5 }, mapId: 'floresta', lastSeen: NOW };
const w = World.fromSave(maps, save, NOW, false);
w.clock = () => clock;

console.log('\n== tempos ==');
ok(Object.values(MONSTERS).filter((d) => !d.boss).every((d) => d.respawnSeconds === 30), 'monstros comuns: 30 s');
ok(MONSTERS.general_terracota.respawnSeconds === 600, 'General: 10 min');

console.log('\n== trocar de mapa não reseta ==');
const victims = w.monsters.filter((m) => !MONSTERS[m.monsterId].boss).slice(0, 3);
const keys = victims.map((m) => m.spawnKey);
victims.forEach((m) => kill(w, m));
ok(keys.every((k) => k.startsWith('floresta#')), 'cada monstro tem o ponto de spawn');
clock += 10_000; w.changeMap('cidade');
clock += 5_000; w.changeMap('floresta');
const dead = () => w.monsters.filter((m) => keys.includes(m.spawnKey));
ok(dead().length === 3 && dead().every((m) => m.dead), 'voltou 15 s depois: os 3 continuam mortos');
ok(w.monsters.filter((m) => !keys.includes(m.spawnKey)).every((m) => !m.dead), 'os outros estão vivos');
const left = dead()[0].respawnAt - w.time;
ok(left > 14 && left < 16, `tempo restante ~15 s (${left.toFixed(1)})`);

console.log('\n== recarregar a página não reseta ==');
const s = w.serialize();
ok(Object.keys(s.respawns ?? {}).length === 3, 'save guarda os 3 tempos');
const r1 = World.fromSave(maps, { ...s, lastSeen: clock }, clock + 5_000, false);
ok(r1.monsters.filter((m) => keys.includes(m.spawnKey)).every((m) => m.dead), 'recarregou 5 s depois: continuam mortos');
const r2 = World.fromSave(maps, { ...s, lastSeen: clock }, clock + 20_000, false);
ok(r2.monsters.every((m) => !m.dead), 'recarregou 20 s depois (35 s no total): todos vivos');

console.log('\n== renasce no mapa quando o tempo acaba ==');
for (let i = 0; i < 16 * 60; i++) { clock += 1000 / 60; w.tick(1 / 60); }
ok(dead().every((m) => !m.dead), 'renasceram no tempo restante');
ok(Object.keys(w.respawnAtMs).length === 0, 'marcas apagadas ao renascer');

console.log('\n== save antigo ==');
const old = World.fromSave(maps, save, NOW, false);
ok(old.monsters.every((m) => !m.dead) && Object.keys(old.respawnAtMs).length === 0, 'sem o campo novo: tudo vivo');

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
