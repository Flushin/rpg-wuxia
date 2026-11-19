// Verificação headless do Trial: portal e menu na saída sul da vila, entrada (nível 20, ouro, nível liberado),
// chefe escolhido no nível 21–30 com os números de src/core/trial.ts, bônus de drop, progresso salvo e saída.
// Uso: npm run check:trial
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/core/data';
import { MAPS_CONFIG, MAP_IDS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
import {
  TRIAL_BOSSES,
  TRIAL_MAP,
  TRIAL_TIERS,
  trialBossLevel,
  trialCost,
  trialDropPct,
  trialStats,
  trialUnlocked,
  trialEquipReqLevel,
} from '../src/core/trial';
import { BASES } from '../src/core/items';
import { World } from '../src/core/world';
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
const kill = (w: World, m: Entity) => (w as unknown as { killMonster: (m: Entity) => void }).killMonster(m);
const NOW = 1_800_000_000_000;
const save = (level: number, gold: number): SaveData => ({
  version: 1,
  name: 'T',
  classId: 'lamina',
  level,
  xp: 0,
  freePoints: 0,
  attributes: { strength: 30, intelligence: 5, stamina: 500, agility: 20, willpower: 5 },
  mapId: 'cidade',
  gold,
  lastSeen: NOW,
});
const fresh = (level = 20, gold = 5000) => World.fromSave(maps, save(level, gold), NOW, false);
const drain = (w: World): GameEvent[] => w.events.splice(0);
const boss = (w: World) => w.monsters.find((m) => !!MONSTERS[m.monsterId].boss);

console.log('\n== dados ==');
ok(
  !!maps[TRIAL_MAP] && !!MAPS_CONFIG[TRIAL_MAP]?.trial && !!MAPS_CONFIG[TRIAL_MAP]?.dungeon,
  'mapa do Trial (instância)',
);
ok(!maps[TRIAL_MAP].objects.some((o) => o.type === 'monsterSpawn'), 'mapa do Trial sem monstros fixos');
const portal = maps.cidade.objects.find((o) => o.type === 'portal' && o.props.menu === 'trial')!;
ok(!!portal && portal.y >= 28, 'portal do Trial na saída sul da vila');
ok(
  TRIAL_BOSSES.length === Object.values(MONSTERS).filter((m) => m.boss).length && TRIAL_BOSSES.length >= 5,
  `todos os chefes do jogo no Trial (${TRIAL_BOSSES.length})`,
);
ok(trialBossLevel(1) === 21 && trialBossLevel(TRIAL_TIERS) === 30 && TRIAL_TIERS === 10, 'chefe nível 21 a 30');
const table = [12, 12.6, 13.23, 13.89, 14.59, 15.32, 16.08, 16.89, 17.73, 18.62];
ok(
  table.every((v, i) => trialDropPct(i + 1) === v),
  `bônus de drop 12% +5% composto: ${table.map((_, i) => trialDropPct(i + 1)).join(' ')}`,
);
ok(trialCost(1) === 1000 && trialCost(10) === 2800, 'entrada 1000 a 2800 de ouro');
for (const id of TRIAL_BOSSES) {
  const a = trialStats(MONSTERS[id], 21),
    b = trialStats(MONSTERS[id], 30);
  ok(b.hp > a.hp && b.atk > a.atk && b.physDef > a.physDef, `${id}: mais forte no nível 30 que no 21`);
}

console.log('\n== menu ==');
{
  const w = fresh();
  for (let i = 0; i < 70; i++) w.tick(1 / 60);
  w.player.x = portal.x + 1;
  w.player.y = portal.y + 0.5;
  w.tick(1 / 60);
  ok(w.trialMenu && !w.dungeonMenu && drain(w).some((e) => e.type === 'trialMenu'), 'pisar no portal abre o menu');
  ok(w.mapId === 'cidade', 'não troca de mapa sozinho');
  w.player.y = portal.y - 4;
  w.tick(1 / 60);
  ok(!w.trialMenu, 'afastar-se fecha o menu');
}

console.log('\n== entrada ==');
{
  const id = 'rei_bandidos';
  ok(fresh(19).enterTrial(id, 1)?.code === 'needLevel', 'abaixo do nível 20: recusado');
  ok(fresh(20, 999).enterTrial(id, 1)?.code === 'noGold', 'sem ouro: recusado');
  const w = fresh(20, 5000);
  ok(w.enterTrial(id, 2)?.code === 'trialLocked' && w.gold === 5000, 'nível 2 trancado antes de vencer o 1');
  w.auto.toggle();
  ok(w.enterTrial(id, 1) === null && w.mapId === TRIAL_MAP, 'entra no nível 1');
  ok(w.gold === 4000 && w.auto.state === 'off', 'cobra 1000 e desliga o Auto');
  const b = boss(w)!;
  const st = trialStats(MONSTERS[id], 21);
  ok(!!b && b.monsterId === id && b.level === 21, 'chefe escolhido no nível 21');
  ok(
    b.derived.maxHp === st.hp && b.derived.physAtk === st.atk && b.derived.spiritDef === st.spiritDef,
    'números do Trial',
  );
  ok(w.monsters.length === 1, 'só o chefe');
  drain(w);
  const bag0 = w.bag.filter((it) => it && it.ilvl === 21).length,
    gold0 = w.gold;
  kill(w, b);
  const evs = drain(w);
  ok(
    evs.some((e) => e.type === 'trialCleared' && e.tier === 1),
    'vitória avisada',
  );
  ok(w.trialProgress[id] === 1 && trialUnlocked(w.trialProgress, id) === 2, 'nível 2 liberado');
  ok(trialUnlocked(w.trialProgress, 'yeti_ancestral') === 1, 'só para este chefe');
  ok(b.respawnAt === Infinity && !w.bossRespawn[id], 'chefe não renasce');
  ok(w.gold > gold0, 'ouro da vitória');
  const items = [...w.bag, ...w.ground.map((g) => g.item)].filter((it) => it && it.ilvl === 21);
  ok(items.length - bag0 >= 2 && items.some((it) => it!.rarity === 'raro'), 'Raro garantido + equipamento, nível 21');
  ok(
    items.every((it) => BASES[it!.baseId]?.reqLevel === 20),
    'nível 1 do Trial: bases nv 20',
  );
  ok(
    trialEquipReqLevel(5) === 20 && trialEquipReqLevel(6) === 25 && trialEquipReqLevel(10) === 25,
    'níveis 6–10: bases nv 25',
  );

  console.log('\n== save e saída ==');
  const s = w.serialize();
  ok(s.trialProgress?.[id] === 1, 'progresso salvo');
  const back = World.fromSave(maps, { ...s, lastSeen: NOW }, NOW, false);
  ok(back.mapId === 'cidade' && back.trialRun === null, 'recarregar no Trial volta para a vila');
  ok(back.trialProgress[id] === 1, 'progresso recarregado');
  const bad = World.fromSave(maps, { ...s, trialProgress: { x: 3, rei_bandidos: 99 } }, NOW, false);
  ok(!('x' in bad.trialProgress) && bad.trialProgress.rei_bandidos === TRIAL_TIERS, 'save estranho corrigido');
  w.changeMap('cidade');
  ok(w.trialRun === null, 'sair encerra a corrida');
  ok(w.enterTrial(id, 2) === null && boss(w)!.level === 22, 'nível 2: chefe nível 22');
}

console.log('\n== mecânicas no Trial ==');
{
  const w = fresh();
  w.trialProgress.patriarca_profanado = 9;
  ok(w.enterTrial('patriarca_profanado', 10) === null, 'entra no nível 10');
  const b = boss(w)!,
    st = trialStats(MONSTERS.patriarca_profanado, 30);
  ok(b.level === 30 && b.derived.maxHp === st.hp, 'chefe nível 30');
  b.ai = 'chase';
  b.hp = b.derived.maxHp * 0.2;
  w.tick(1 / 60);
  ok(!!b.enraged && b.derived.physAtk > st.atk, 'fúria por cima do ataque do Trial');
  w.resetBoss(b);
  ok(b.derived.physAtk === st.atk && b.derived.maxHp === st.hp, 'reset volta aos números do Trial');
  const g = fresh();
  g.trialProgress.general_terracota = 4;
  g.enterTrial('general_terracota', 5);
  const gb = boss(g)!;
  gb.ai = 'chase';
  gb.hp = gb.derived.maxHp * 0.4;
  g.tick(1 / 60);
  const adds = g.monsters.filter((m) => m.summoned);
  ok(adds.length > 0 && adds.every((m) => m.level === trialBossLevel(5) - 3), 'invocados 3 níveis abaixo do chefe');
}

if (fails) {
  console.error(`\ntrial-check: ${fails} falha(s)`);
  process.exit(1);
}
console.log('\ntrial-check: tudo ok');
