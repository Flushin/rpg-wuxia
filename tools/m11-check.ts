// Verificação headless do conteúdo do nível 40 (faixa 30–40). Etapa 3: conjunto nv 35 (9 peças, arma por seita),
// forja com o dobro de Jade da Névoa nos itens nv 35+, Mercador e Épico usando o nv 35 a partir do nível 35.
// Etapa 4a: Vale das Cinzas Rubras e Ruínas do Palácio Celeste pelo portão leste da Cidadela, monstros nas faixas,
// morte e Pergaminho de Retorno levando à Cidadela, Auto pelo nível e offline a 5/6. Etapa 4b: Imperador Carmesim,
// missões 31–40 com os NPCs da Cidadela e Trial 11–20.
// Uso: npm run check:m11
import { readFileSync } from 'node:fs';
import { BASES, epicTierBase, makeEquipment, makeStack } from '../src/core/items';
import { CLASSES, MONSTERS } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { MAPS_CONFIG, homeTownOf, portalMinLevel } from '../src/core/mapsConfig';
import { teleportById } from '../src/core/teleport';
import { QUESTS } from '../src/core/quests';
import { TRIAL_BOSSES, TRIAL_TIERS, trialBossLevel, trialEquipReqLevel } from '../src/core/trial';
import type { Entity } from '../src/core/types';
import { World } from '../src/core/world';
import { MOUNTS } from '../src/core/data';
import type { SaveData } from '../src/core/types';
import { Rng } from '../src/core/rng';
import { stockLevel } from '../src/core/world/merchant';
import { wearGear } from '../src/core/world/inventory';
import { rareQty, rarityCost, rerollCost, salvageYield, upgradeCost } from '../src/core/world/forge';
import { PROGRESSION } from '../src/core/data';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};

console.log('== nível máximo e curva ==');
ok(
  PROGRESSION.levelCap >= 40 && PROGRESSION.xpToNext.length === PROGRESSION.levelCap - 1,
  'nível máximo 40+, curva até o máximo',
);

console.log('\n== conjunto nv 35 ==');
const SET = [
  'colar_sol_carmesim',
  'tunica_palacio',
  'espadas_asa_fenix',
  'leque_aurora',
  'bastao_pilar_celeste',
  'agulhas_escarlates',
  'coroa_celeste',
  'calca_nuvens_rubras',
  'botas_degrau_imperial',
];
ok(
  SET.every((id) => BASES[id]?.reqLevel === 35),
  'nove peças nv 35',
);
const all35 = Object.keys(BASES).filter((id) => BASES[id].reqLevel === 35);
ok(
  all35.length === 9 && !Object.values(BASES).some((b) => b.reqLevel === 30),
  'só o conjunto nv 35 na faixa (sem nv 30)',
);
const weapons = SET.filter((id) => BASES[id].slot === 'arma');
ok(
  weapons
    .map((id) => BASES[id].sect)
    .sort()
    .join() === 'lamina,pavilhao,tita,vibora',
  'uma arma por seita',
);
ok(
  weapons.every((id) => (BASES[id].stats.physAtk ?? BASES[id].stats.spiritAtk) === 100),
  'armas nv 35 com ataque 100',
);
const slots25 = new Set(
  Object.values(BASES)
    .filter((b) => b.reqLevel === 25)
    .map((b) => b.slot),
);
ok(
  [...slots25].every((s) => SET.some((id) => BASES[id].slot === s)),
  'cobre os mesmos espaços do nv 25',
);
ok(
  BASES.tunica_palacio.stats.physDef! > BASES.manto_nevoa.stats.physDef! &&
    BASES.espadas_asa_fenix.value > BASES.espadas_rasga_nevoa.value,
  'mais forte e mais valioso que o nv 25',
);

console.log('\n== forja ==');
const rng = new Rng(7);
const it25 = makeEquipment('manto_nevoa', 'comum', null, rng, 25),
  it35 = makeEquipment('tunica_palacio', 'comum', null, rng, 35);
ok(rareQty(25, 3) === 3 && rareQty(35, 3) === 6, 'material raro em dobro a partir do nv 35');
ok(
  rarityCost(it25)!.mats.jade_nevoa === 1 && rarityCost(it35)!.mats.jade_nevoa === 2,
  'subir raridade: 1 jade no nv 25, 2 no nv 35',
);
it25.rarity = it35.rarity = 'raro';
ok(rerollCost(it35)!.mats.jade_nevoa === 4, 'trocar bônus (Raro) nv 35: 4 jades');
it25.plus = it35.plus = 5;
ok(
  upgradeCost(it25)!.mats.jade_nevoa === 2 && upgradeCost(it35)!.mats.jade_nevoa === 4,
  'melhorar +5→+6: 2 jades no nv 25, 4 no nv 35',
);
ok(
  Math.round((upgradeCost(it35)!.gold / upgradeCost(it25)!.gold) * 6) === 8,
  'ouro da forja ×8 no nv 35 (×6 no nv 25)',
);
ok(salvageYield(it35).jade_nevoa === 2 * salvageYield(it25).jade_nevoa!, 'desmontar nv 35 devolve o dobro de jade');
ok(
  !('cristal_gelo' in rarityCost(makeEquipment('coroa_celeste', 'comum', null, rng, 35))!.mats),
  'sem cristal no nv 35',
);

console.log('\n== Mercador e Épico ==');
ok(
  stockLevel(34) === 25 && stockLevel(35) === 35 && stockLevel(40) === 35,
  'Mercador: nv 25 até o 34, nv 35 a partir do 35',
);
const ep = makeEquipment('espadas_ferro', 'epico', null, rng, 1);
ok(
  epicTierBase(ep, 34) === 'espadas_rasga_nevoa' && epicTierBase(ep, 35) === 'espadas_asa_fenix',
  'Épico usa o nv 35 a partir do 35',
);

const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'cidadela', 'floresta', 'ruinas', 'montanha', 'bambu', 'pico', 'vale', 'palacio', 'porto'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const NOW = 1_800_000_000_000;
const mk = (level: number, mapId: string, classId = 'lamina'): World => {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  const s: SaveData = {
    version: 3,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId,
    lastSeen: NOW,
    gold: 100_000,
  };
  const w = World.fromSave(maps, s, NOW, false);
  w.rng = new Rng(42);
  w.clock = () => NOW;
  return w;
};
const portal = (from: string, to: string) =>
  maps[from].objects.find((o) => o.type === 'portal' && String(o.props.target) === to);

console.log('\n== mapas, portais e teleporte ==');
{
  const toV = portal('cidadela', 'vale'),
    toP = portal('vale', 'palacio');
  ok(!!toV && portalMinLevel(toV) === 30, 'portão leste da Cidadela → Vale das Cinzas Rubras, nível 30');
  ok(!!toP && portalMinLevel(toP) === 35, 'Vale → Ruínas do Palácio Celeste, nível 35');
  ok(!!portal('vale', 'cidadela') && !!portal('palacio', 'vale'), 'caminho de volta (vale → Cidadela, palácio → vale)');
  ok(
    teleportById('vale')?.minLevel === 30 && teleportById('palacio')?.minLevel === 35,
    'teleporte: vale 30, palácio 35',
  );
  ok(maps.vale.tiles.includes('basalt') && maps.vale.tiles.includes('ash'), 'vale com cinza e basalto');
  ok(maps.palacio.tiles.includes('marble') && maps.palacio.tiles.includes('cloud'), 'palácio com mármore e nuvens');
  ok(MAPS_CONFIG.vale.offlineMul === 5 / 6 && MAPS_CONFIG.palacio.offlineMul === 5 / 6, 'offline a 5/6 nos dois');
  ok(MAPS_CONFIG.palacio.autoExitVia === 'vale', 'Auto sai do Palácio pelo Vale');
}

console.log('\n== monstros ==');
{
  const band = (map: string, ids: string[], lo: number, hi: number) => {
    const sp = maps[map].objects.filter((o) => o.type === 'monsterSpawn' && !MONSTERS[String(o.props.monster)].boss);
    ok(
      sp.length >= 14 && sp.every((o) => ids.includes(String(o.props.monster))),
      `${map}: ${sp.length} pontos, só ${ids.join(' e ')}`,
    );
    ok(
      sp.every((o) => Number(o.props.minLevel) >= lo && Number(o.props.maxLevel) <= hi),
      `${map}: faixas entre ${lo} e ${hi}`,
    );
  };
  band('vale', ['andarilho_cinzas', 'monge_fogo_rubro'], 30, 35);
  band('palacio', ['guarda_celeste', 'feiticeira_lua_fria'], 35, 40);
  const ids = ['andarilho_cinzas', 'monge_fogo_rubro', 'guarda_celeste', 'feiticeira_lua_fria'];
  ok(
    ids.every((id) => !MONSTERS[id].keepDistance),
    'nenhum recua (keepDistance)',
  );
  ok(
    ids.every((id) => (MONSTERS[id].poisonRes ?? 0) > 0 && (MONSTERS[id].defMul?.spirit ?? 1) >= 2),
    'resistem a veneno; defesa espiritual alta',
  );
  ok(
    (MONSTERS.guarda_celeste.defMul?.phys ?? 1) <= 0.6 && !!MONSTERS.guarda_celeste.slam,
    'Guarda: golpe em área e defesa física baixa (Titã)',
  );
  ok(
    MONSTERS.monge_fogo_rubro.projectile === 'fire' && !!MONSTERS.feiticeira_lua_fria.onHit,
    'Monge (fogo) e Feiticeira (lentidão)',
  );
  ok(
    (MONSTERS.guarda_celeste.loot?.equipment ?? []).some((e) => e.minReqLevel === 35) &&
      !(MONSTERS.andarilho_cinzas.loot?.equipment ?? []).some((e) => e.maxReqLevel === 35),
    'nv 35 só cai no Palácio',
  );
}

console.log('\n== Cidadela como cidade de apoio ==');
{
  ok(
    homeTownOf('vale') === 'cidadela' && homeTownOf('palacio') === 'cidadela' && homeTownOf('pico') === 'cidade',
    'cidade de apoio por mapa',
  );
  const w = mk(36, 'palacio');
  w.addItem(makeStack('pergaminho_retorno', 1));
  const i = w.bag.findIndex((b) => b?.baseId === 'pergaminho_retorno');
  ok(w.useReturnScroll(i) && w.mapId === 'cidadela', 'Pergaminho no Palácio leva à Cidadela');
  const w2 = mk(36, 'pico');
  w2.addItem(makeStack('pergaminho_retorno', 1));
  ok(
    w2.useReturnScroll(w2.bag.findIndex((b) => b?.baseId === 'pergaminho_retorno')) && w2.mapId === 'cidade',
    'no Pico continua levando à vila',
  );
  const w3 = mk(32, 'vale') as unknown as World & { killPlayer: () => void; respawnTimer: number };
  w3.killPlayer();
  for (let k = 0; k < 400 && w3.player.dead; k++) w3.tick(0.1);
  ok(!w3.player.dead && w3.mapId === 'cidadela', 'morrer no Vale: renasce na Cidadela');
}

console.log('\n== Auto pelo nível ==');
for (const [lv, want] of [
  [30, 'vale'],
  [34, 'vale'],
  [35, 'palacio'],
  [40, 'palacio'],
] as const) {
  const w = mk(lv, 'cidade');
  w.auto.toggle();
  ok(w.auto.huntMap === want, `nível ${lv}: Auto vai para ${want} (${w.auto.huntMap})`);
}

console.log('\n== Imperador Carmesim ==');
{
  const def = MONSTERS.imperador_carmesim;
  ok(!!def.boss && def.minLevel === 40 && (def.scale ?? 1) >= 1.5, 'chefe nível 40 e grande');
  ok(
    def.boss?.summon?.monsterId === 'guarda_celeste' && !!def.boss?.enrage && !!def.boss?.line?.fanCount,
    'golpe em linha que vira leque, chama guardas e fica furioso',
  );
  ok(TRIAL_BOSSES.at(-1) === 'imperador_carmesim', 'entra no Trial (o mais forte)');
  const w = mk(40, 'palacio');
  const b = w.monsters.find((m) => m.monsterId === 'imperador_carmesim');
  ok(!!b && b.level === 40, 'nasce no Salão do Trono, nível 40');
  if (b) {
    w.events.splice(0);
    (w as unknown as { killMonster: (m: Entity) => void }).killMonster(b);
    const items = [...w.bag, ...w.ground.map((g) => g.item)].filter((it) => it && BASES[it.baseId]);
    ok(
      items.some((it) => BASES[it!.baseId].reqLevel === 35 && it!.rarity === 'raro'),
      'garante um Raro nv 35',
    );
    ok(w.potionCount('jade_nevoa') >= 8, 'solta jade (o dobro, para a forja nv 35)');
  }
}

console.log('\n== missões 31–40 ==');
{
  const qs = QUESTS.slice(19, 24); // depois vêm as 3 do Porto Noturno (nível 50)
  ok(
    qs.map((q) => q.id).join() === 'portao_leste,andarilhos_cinzas,fogo_rubro,lua_fria,imperador_carmesim',
    'cinco etapas novas, em ordem',
  );
  ok(qs.map((q) => q.minLevel).join() === '31,33,35,37,39', 'níveis 31, 33, 35, 37 e 39');
  ok(
    qs.every((q) => ['governador', 'monge_pagode', 'guarda_jade'].includes(q.giver)),
    'dadas pelos NPCs da Cidadela',
  );
  ok(
    qs.every((q) => maps.cidadela.objects.some((o) => o.type === 'npc' && o.props.npc === q.giver)),
    'NPCs estão na Cidadela',
  );
  const xp = qs.reduce((a, q) => a + q.reward.xp, 0),
    band = PROGRESSION.xpToNext.slice(30, 39).reduce((a, b) => a + b, 0);
  ok(Math.abs(xp / band - 0.14) < 0.02, `XP das missões ~14% da faixa (${Math.round((100 * xp) / band)}%)`);
  ok(
    qs.filter((q) => q.reward.item).every((q) => q.reward.itemLevel === 35),
    'recompensas de item são nv 35 (arma no 35, túnica no 39)',
  );
}

console.log('\n== desgaste ==');
{
  const w = mk(36, 'palacio');
  w.equipment.tronco = makeEquipment('tunica_palacio', 'comum', null, w.rng, 35);
  w.equipment.cabeca = makeEquipment('coroa_jade', 'comum', null, w.rng, 25);
  for (const sl of Object.keys(w.equipment)) if (sl !== 'tronco' && sl !== 'cabeca') delete w.equipment[sl as 'arma'];
  for (let i = 0; i < 400; i++) wearGear(w);
  const lost35 = 100 - w.equipment.tronco!.durability,
    lost25 = 100 - w.equipment.cabeca!.durability;
  ok(
    Math.abs(lost35 + lost25 - 400 * 0.3 * 0.75) < 400 * 0.3 * 0.2 && lost35 < lost25 * 0.7,
    `item nv 35 gasta metade (${lost35.toFixed(1)} contra ${lost25.toFixed(1)})`,
  );
}

console.log('\n== Trial 11–20 ==');
ok(TRIAL_TIERS === 20 && trialBossLevel(20) === 40, 'níveis 1–20, chefe até o nível 40');
ok(trialEquipReqLevel(14) === 25 && trialEquipReqLevel(15) === 35, 'nv 25 até o 14, nv 35 do 15 ao 20');

console.log('\n== montaria (estábulo do Porto Noturno) ==');
{
  const w = mk(50, 'porto') as World & { time: number; lastCombat: number };
  const st = w.npcs.find((n) => n.npcId === 'estabulo');
  ok(!!st && w.npcRole(st) === 'estabulo', 'Cavalariço Ma no mapa do Porto Noturno');
  ok(w.buyMount('cavalo')?.code === 'talkToStable', 'só compra falando com o estábulo');
  w.openNpc = st!;
  const g0 = w.gold;
  ok(w.buyMount('cavalo') === null && w.gold === g0 - MOUNTS.cavalo.price, 'compra o cavalo pelo preço');
  ok(w.buyMount('cavalo')?.code === 'mountOwned', 'não compra duas vezes');
  w.time = 100;
  w.lastCombat = 99;
  ok(w.mountNow() === null, 'em combate (há 1 s): a pé');
  w.lastCombat = 100 - MOUNTS.cavalo.mountDelay;
  ok(w.mountNow() === 'cavalo', 'fora de combate: montado');
  const w2 = World.fromSave(maps, { ...w.serialize(), lastSeen: NOW }, NOW, false);
  ok(w2.mountsOwned.join() === 'cavalo', 'a montaria fica no save');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
