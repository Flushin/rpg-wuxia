// Verificação headless da masmorra em equipe (bots aliados no World): entrada no modo equipe, grupo de 3 bots
// (classes, nível), vida extra dos monstros só no modo equipe, bots lutando de verdade (golpes, skills, monstros
// atacando bots), morte e reviver (segurar ~3 s, 50% da vida, 1 vez por bot por luta) e fim da corrida.
// Uso: npm run check:party
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/core/data';
import { dungeonById } from '../src/core/dungeons';
import { MAP_IDS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import { bal } from '../src/core/balance';
import { botLevelFor } from '../src/core/bots';
import { REVIVE_HP, REVIVE_SECONDS, killBot, revivable } from '../src/core/world/party';
import type { Entity, GameEvent, SaveData } from '../src/core/types';

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
const save = (level: number): SaveData =>
  ({
    version: 1,
    name: 'T',
    classId: 'lamina',
    level,
    xp: 0,
    freePoints: 0,
    attributes: { strength: 40, intelligence: 5, stamina: 60, agility: 20, willpower: 10 },
    mapId: 'cidade',
    gold: 99999,
    lastSeen: NOW,
  }) as SaveData;
const fresh = (level = 14) => World.fromSave(maps, save(level), NOW, false);
const run = (w: World, s: number) => {
  for (let i = 0; i < s * 60; i++) w.tick(1 / 60);
};
const D = dungeonById('gruta')!;

console.log('\n== entrada ==');
{
  const w = fresh();
  ok(w.enterDungeon('gruta', true) === null && w.mapId === 'gruta', 'entra no modo equipe');
  ok(w.teamRun && w.party.length === 3, '3 bots no grupo');
  ok(
    w.party.every((b) => b.classId !== 'lamina') && new Set(w.party.map((b) => b.classId)).size === 3,
    `classes diferentes da do jogador: ${w.party.map((b) => b.classId)}`,
  );
  const lv = botLevelFor(D.levels, 14);
  ok(
    w.party.every((b) => b.e.level === lv && b.team === 'ally'),
    `bots no nível ${lv} (meio da faixa ${D.levels[0]}–${D.levels[1]}, até o do jogador)`,
  );
  ok(
    w.party.every((b) => Math.hypot(b.e.x - w.player.x, b.e.y - w.player.y) < 2),
    'bots começam ao lado do jogador',
  );
  const low = fresh(12);
  low.enterDungeon('gruta', true);
  ok(
    low.party.every((b) => b.e.level <= 12),
    'jogador abaixo do meio da faixa: bots não passam do nível dele',
  );
  const solo = fresh();
  solo.enterDungeon('gruta');
  ok(!solo.teamRun && solo.party.length === 0, 'Sozinho: sem bots');
}

console.log('\n== vida dos monstros ==');
{
  const solo = fresh(),
    team = fresh();
  solo.enterDungeon('gruta');
  team.enterDungeon('gruta', true);
  const pick = (w: World, boss: boolean) =>
    w.monsters.filter((m) => !!MONSTERS[m.monsterId]?.boss === boss).sort((a, b) => a.id - b.id);
  const ratio = (boss: boolean) => {
    const a = pick(solo, boss),
      b = pick(team, boss);
    // mesma posição/tipo, níveis sorteados diferem: compara por vida por nível
    const per = (ms: Entity[]) => ms.reduce((s, m) => s + m.derived.maxHp, 0) / ms.reduce((s, m) => s + 1, 0);
    return per(b) / per(a);
  };
  const rc = ratio(false),
    rb = ratio(true);
  ok(
    Math.abs(rc - bal('equipe.vida_comuns')) < 0.5,
    `comuns: ×${rc.toFixed(2)} (balance.json ${bal('equipe.vida_comuns')})`,
  );
  ok(
    Math.abs(rb - bal('equipe.vida_chefe')) < 0.5,
    `chefe: ×${rb.toFixed(2)} (balance.json ${bal('equipe.vida_chefe')})`,
  );
  const atk = (w: World) => pick(w, true)[0].derived.physAtk;
  ok(atk(solo) === atk(team), 'ataque do chefe igual ao do modo solo');
  ok(
    team.monsters.every((m) => m.hp === m.derived.maxHp),
    'monstros começam com a vida cheia (já com o extra)',
  );
}

console.log('\n== luta ==');
{
  const w = fresh();
  w.enterDungeon('gruta', true);
  const evs: GameEvent[] = [];
  const m = w.monsters
    .filter((x) => !MONSTERS[x.monsterId]?.boss)
    .sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y))[0];
  w.player.derived.maxHp = w.player.hp = 99999; // o teste é dos bots: o jogador não morre
  w.player.x = m.x - 1.2;
  w.player.y = m.y;
  for (const b of w.party) {
    b.e.x = m.x - 2;
    b.e.y = m.y + 0.5;
  }
  w.setTarget(m.id);
  w.attackNearest();
  const ids = new Set(w.party.map((b) => b.e.id));
  for (let i = 0; i < 40 * 60; i++) {
    w.tick(1 / 60);
    evs.push(...w.events.splice(0));
  }
  ok(
    evs.some((e) => e.type === 'attack' && ids.has(e.fromId)),
    'bots dão golpes normais',
  );
  ok(
    evs.some((e) => e.type === 'skillCast' && ids.has(e.casterId)),
    'bots usam skills',
  );
  ok(
    evs.some((e) => e.type === 'hit' && e.targetKind === 'bot'),
    'monstros atacam os bots também',
  );
  ok(
    evs.some((e) => e.type === 'kill'),
    'grupo mata monstros (XP e loot para o jogador)',
  );
  ok(
    w.party.every((b) => Number.isFinite(b.e.hp) && Number.isFinite(b.e.x)),
    'números válidos',
  );
}

console.log('\n== reviver ==');
{
  const w = fresh();
  w.enterDungeon('gruta', true);
  const b = w.party[0],
    m = w.monsters.find((x) => !MONSTERS[x.monsterId]?.boss)!;
  w.player.derived.maxHp = w.player.hp = 99999;
  m.ai = 'chase'; // luta em andamento (monstro ao lado do jogador, sem dano: não larga a luta)
  m.foeId = w.player.id;
  m.home = { x: w.player.x, y: w.player.y + 1 };
  m.x = w.player.x;
  m.y = w.player.y + 1;
  m.derived.physAtk = m.derived.spiritAtk = 0;
  m.derived.maxHp = m.hp = 1e9; // os outros bots batem nele: não pode morrer no meio do teste
  killBot(w, b.e);
  ok(b.e.dead, 'bot cai');
  b.e.x = w.player.x + 1;
  b.e.y = w.player.y;
  ok(revivable(w) === b, 'perto do bot caído: dá para reviver');
  w.reviving = true;
  run(w, REVIVE_SECONDS - 0.5);
  ok(b.e.dead, 'antes de ~3 s ainda caído');
  w.moveInput = { x: 1, y: 0 };
  w.tick(1 / 60);
  w.moveInput = { x: 0, y: 0 };
  ok(w.reviveT === 0, 'andar cancela o reviver');
  b.e.x = w.player.x + 1;
  b.e.y = w.player.y;
  w.reviving = true;
  m.ai = 'chase';
  run(w, REVIVE_SECONDS + 0.1);
  ok(
    !b.e.dead && Math.abs(b.e.hp - b.e.derived.maxHp * REVIVE_HP) < b.e.derived.maxHp * 0.1,
    'revive com ~50% da vida',
  );
  m.ai = 'chase';
  killBot(w, b.e);
  b.e.x = w.player.x + 1;
  b.e.y = w.player.y;
  ok(revivable(w) === null, 'mesma luta: não revive de novo');
  m.ai = 'idle';
  m.dead = true;
  for (const x of w.monsters) x.ai = 'idle';
  w.tick(1 / 60);
  b.e.x = w.player.x + 1;
  b.e.y = w.player.y;
  ok(revivable(w) === b, 'luta acabou: pode reviver de novo');
}

console.log('\n== fim da corrida ==');
{
  const w = fresh();
  w.enterDungeon('gruta', true);
  killBot(w, w.party[0].e);
  killBot(w, w.party[1].e);
  killBot(w, w.party[2].e);
  run(w, 1);
  ok(w.mapId === 'gruta' && !w.player.dead, 'todos os bots caídos: a corrida continua');
  w.killPlayer();
  run(w, 4);
  ok(w.mapId !== 'gruta' && w.party.length === 0 && !w.teamRun, 'jogador morre: a corrida acaba e os bots somem');
}

if (fails) {
  console.error(`\nparty-check: ${fails} falha(s)`);
  process.exit(1);
}
console.log('\nparty-check: tudo ok');
