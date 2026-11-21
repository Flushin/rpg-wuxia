// Verificação headless do conteúdo do nível 40 (faixa 30–40). Etapa 3: conjunto nv 35 (9 peças, arma por seita),
// forja com o dobro de Jade da Névoa nos itens nv 35+, Mercador e Épico usando o nv 35 a partir do nível 35.
// Etapa 4a: Vale das Cinzas Rubras e Ruínas do Palácio Celeste pelo portão leste da Cidadela, monstros nas faixas,
// morte e Pergaminho de Retorno levando à Cidadela, Auto pelo nível e offline a 5/6.
// Uso: npm run check:m11
import { readFileSync } from 'node:fs';
import { BASES, epicTierBase, makeEquipment, makeStack } from '../src/core/items';
import { CLASSES, MONSTERS } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { MAPS_CONFIG, homeTownOf, portalMinLevel } from '../src/core/mapsConfig';
import { teleportById } from '../src/core/teleport';
import { World } from '../src/core/world';
import type { SaveData } from '../src/core/types';
import { Rng } from '../src/core/rng';
import { stockLevel } from '../src/core/world/merchant';
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
ok(PROGRESSION.levelCap === 40 && PROGRESSION.xpToNext.length === 39, 'nível máximo 40, curva até o 40');

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
for (const id of ['cidade', 'cidadela', 'floresta', 'ruinas', 'montanha', 'bambu', 'pico', 'vale', 'palacio'])
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
    MONSTERS.guarda_celeste.defMul?.phys === 0.6 && !!MONSTERS.guarda_celeste.slam,
    'Guarda: golpe em área e defesa física ×0,6',
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

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
