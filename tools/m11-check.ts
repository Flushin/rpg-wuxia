// Verificação headless do conteúdo do nível 40 (faixa 30–40). Etapa 3: conjunto nv 35 (9 peças, arma por seita),
// forja com o dobro de Jade da Névoa nos itens nv 35+, Mercador e Épico usando o nv 35 a partir do nível 35.
// Uso: npm run check:m11
import { BASES, epicTierBase, makeEquipment } from '../src/core/items';
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

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
