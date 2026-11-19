// Verificação headless das masmorras: menu do portal, entrada paga, instância sem renascimento, Auto bloqueado,
// save fora da masmorra e +25% de chance de equipamento. Uso: npm run check:dungeon
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/core/data';
import { DUNGEONS, DUNGEON_EQUIP_DROP_MUL, dungeonById } from '../src/core/dungeons';
import { MAPS_CONFIG, MAP_IDS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
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
const fresh = (level = 12, gold = 1000) => World.fromSave(maps, save(level, gold), NOW, false);
const drain = (w: World): GameEvent[] => w.events.splice(0);
const D = dungeonById('gruta')!;

console.log('\n== dados ==');
ok(DUNGEONS.length >= 1 && DUNGEONS.every((d) => !!maps[d.map] && MAPS_CONFIG[d.map]?.dungeon), 'masmorras têm mapa');
ok(DUNGEON_EQUIP_DROP_MUL === 1.25, 'equipamento +25% na masmorra');
ok(
  maps.gruta.objects.some((o) => o.type === 'monsterSpawn' && MONSTERS[String(o.props.monster)]?.boss),
  'masmorra tem chefe',
);
ok(
  !Object.values(MAPS_CONFIG).some((c) => c.dungeon && (c.autoFromLevel || c.town)),
  'masmorra não é mapa de caça do Auto nem cidade',
);
const menuPortal = maps.cidade.objects.find((o) => o.type === 'portal' && o.props.menu)!;
ok(!!menuPortal, 'vila tem o Portal das Masmorras');

console.log('\n== menu do portal ==');
{
  const w = fresh();
  for (let i = 0; i < 70; i++) w.tick(1 / 60); // espera a trava de portal de quem acabou de chegar
  w.player.x = menuPortal.x + 0.5;
  w.player.y = menuPortal.y + 1.5;
  w.tick(1 / 60);
  w.tick(1 / 60);
  ok(w.dungeonMenu && drain(w).some((e) => e.type === 'dungeonMenu'), 'pisar no portal abre o menu');
  ok(w.mapId === 'cidade', 'portal de menu não troca de mapa sozinho');
  w.dungeonMenu = false;
  for (let i = 0; i < 30; i++) w.tick(1 / 60);
  ok(!w.dungeonMenu, 'fechado à mão: não reabre enquanto continua em cima');
  w.player.x = menuPortal.x + 6;
  w.tick(1 / 60);
  w.player.x = menuPortal.x + 0.5;
  w.tick(1 / 60);
  ok(w.dungeonMenu, 'sair e pisar de novo reabre');
  w.player.x = menuPortal.x + 6;
  w.tick(1 / 60);
  ok(!w.dungeonMenu, 'afastar-se fecha o menu');
}

console.log('\n== entrada ==');
{
  const low = fresh(D.minLevel - 1, 5000);
  ok(low.enterDungeon('gruta')?.code === 'needLevel' && low.mapId === 'cidade', 'abaixo do nível: recusado');
  const poor = fresh(12, D.cost - 1);
  ok(poor.enterDungeon('gruta')?.code === 'noGold' && poor.gold === D.cost - 1, 'sem ouro: recusado, nada cobrado');
  const w = fresh(12, 1000);
  w.auto.toggle();
  ok(w.auto.state === 'on', '(Auto ligado na vila)');
  ok(w.enterDungeon('gruta') === null && w.mapId === 'gruta', 'entra');
  ok(w.gold === 1000 - D.cost, `cobra ${D.cost} de ouro`);
  ok(w.auto.state === 'off', 'entrar desliga o Auto');
  drain(w);
  w.auto.toggle();
  ok(w.auto.state === 'off' && drain(w).some((e) => e.type === 'autoBlocked'), 'Auto não liga lá dentro');
  w.auto.state = 'on'; // à força: o tick desliga
  w.tick(1 / 60);
  ok(w.auto.state === 'off', 'tick desliga o Auto se algo o ligar');
  w.auto.state = 'pausado';
  w.tick(1 / 60);
  ok(w.auto.state === 'off', 'Auto pausado também é desligado');

  console.log('\n== instância ==');
  const mobs = w.monsters.filter((m) => !MONSTERS[m.monsterId].boss);
  kill(w, mobs[0]);
  ok(mobs[0].respawnAt === Infinity, 'monstro morto não renasce');
  ok(!Object.keys(w.respawnAtMs).some((k) => k.startsWith('gruta#')), 'nada vai para os relógios de renascimento');
  for (let i = 0; i < 60 * 40; i++) w.tick(1 / 60);
  ok(mobs[0].dead, '40 s depois continua morto');
  const boss = w.monsters.find((m) => MONSTERS[m.monsterId].boss)!;
  drain(w);
  kill(w, boss);
  const evs = drain(w);
  ok(
    evs.some((e) => e.type === 'dungeonCleared'),
    'chefe morto: masmorra concluída',
  );
  ok(
    evs.some((e) => e.type === 'bossDefeated' && e.name === boss.name),
    'aviso de chefe derrotado traz o nome do chefe',
  );
  ok(!w.bossRespawn.yeti_ancestral && boss.respawnAt === Infinity, 'chefe da masmorra não marca renascimento');
  ok(
    w.bag.some((it) => it?.rarity === 'raro') || w.ground.some((g) => g.item?.rarity === 'raro'),
    'item raro garantido',
  );

  console.log('\n== save ==');
  const s = w.serialize();
  const back = World.fromSave(maps, { ...s, lastSeen: NOW }, NOW, false);
  ok(back.mapId === 'cidade', 'recarregar dentro da masmorra volta para a vila');
  const off = World.fromSave(
    maps,
    { ...s, lastSeen: NOW - 3_600_000, auto: { ...(s.auto ?? {}), active: true, mapId: 'gruta' } as SaveData['auto'] },
    NOW,
    true,
  );
  ok(off.offlineReport === null, 'masmorra não rende ganho offline');

  console.log('\n== nova corrida ==');
  w.changeMap('cidade');
  ok(w.enterDungeon('gruta') === null, 'entra de novo');
  ok(
    w.monsters.every((m) => !m.dead),
    'todos os monstros vivos de novo',
  );
}

console.log('\n== chance de equipamento ==');
{
  // rng fixo um pouco acima da chance do Yeti (7%): só passa com o bônus de 25% (8,75%)
  const roll = (mapId: string) => {
    const w = fresh(12, 1000);
    w.changeMap(mapId);
    const y = w.monsters.find((m) => m.monsterId === 'yeti')!;
    w.applyMonsterLevel(y, MONSTERS.yeti, 12);
    w.rng.next = () => 0.08;
    const count = () =>
      w.bag.filter((it) => it && it.rarity && !it.qty).length + w.ground.filter((g) => g.item && !g.item.qty).length;
    const before = count();
    w.dropLoot(y, MONSTERS.yeti);
    return count() - before;
  };
  ok(roll('montanha') === 0, 'montanha: 8% não passa nos 7% do Yeti');
  ok(roll('gruta') === 1, 'masmorra: 8% passa nos 7% × 1,25');
}

if (fails) {
  console.error(`\ndungeon-check: ${fails} falha(s)`);
  process.exit(1);
}
console.log('\ndungeon-check: tudo ok');
