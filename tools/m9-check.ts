// Verificação headless do marco 9 (pós-nível-10): monstros da montanha, Abade Caído, equipamentos nv 10/15,
// forja do ferreiro, Mercador Ambulante e save. Uso: npm run check:m9
import { readFileSync } from 'node:fs';
import { MONSTERS } from '../src/core/data';
import {
  BASES,
  MATERIALS,
  MAX_PLUS,
  itemName,
  itemStats,
  makeEquipment,
  makeStack,
  sanitizeItem,
  sortedBag,
} from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { Rng } from '../src/core/rng';
import { World } from '../src/core/world';
import { upgradeCost, rarityCost, rerollCost, salvageYield, FORGE } from '../src/core/world/forge';
import { merchantPeriod, stockLevel } from '../src/core/world/merchant';
import type { Entity, GameEvent, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta', 'ruinas', 'montanha'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
type Priv = { killMonster: (m: Entity) => void; rng: Rng };
const priv = (w: World) => w as unknown as Priv;
const NOW = 1_800_000_000_000;
const mk = (level: number, mapId = 'cidade', classId = 'lamina'): World => {
  const s: SaveData = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: { strength: 30, intelligence: 5, stamina: 60, agility: 10, willpower: 10 },
    mapId,
    lastSeen: NOW,
    gold: 100_000,
  };
  const w = World.fromSave(maps, s, NOW, false);
  priv(w).rng = new Rng(42);
  w.clock = () => NOW;
  return w;
};
const openNpc = (w: World, role: string) => {
  const n = w.npcs.find((x) => x.npcId === role)!;
  w.openNpc = n;
};

console.log('== monstros da montanha ==');
{
  const sp = maps.montanha.objects.filter((o) => o.type === 'monsterSpawn');
  const ids = new Set(sp.map((o) => String(o.props.monster)));
  ok(ids.has('espectro_gelo') && ids.has('yeti') && ids.has('abade_caido'), 'montanha tem espectros, yetis e o Abade');
  const lv = sp.filter((o) => o.props.minLevel).map((o) => [Number(o.props.minLevel), Number(o.props.maxLevel)]);
  ok(
    lv.every(([a, b]) => a >= 11 && b <= 18 && a <= b),
    'faixas de nível dos pontos entre 11 e 18',
  );
  const w = mk(12, 'montanha');
  const mobs = w.monsters.filter((m) => !MONSTERS[m.monsterId].boss);
  ok(
    mobs.every((m) => m.levels && m.level >= m.levels[0] && m.level <= m.levels[1]),
    'cada monstro nasce na faixa do seu ponto',
  );
  ok(
    MONSTERS.espectro_gelo.damageType === 'spiritual' && MONSTERS.espectro_gelo.attackRange > 3,
    'espectro: à distância, espiritual',
  );
  // espectro deixa lento ao acertar
  const s = w.monsters.find((m) => m.monsterId === 'espectro_gelo')!;
  w.player.x = s.x + 2;
  w.player.y = s.y;
  w.player.derived.evasion = -9999;
  s.ai = 'chase';
  s.attackCd = 0;
  for (let i = 0; i < 30 && !w.hasBuff(w.player, 'slow'); i++) w.tick(1 / 60);
  ok(w.hasBuff(w.player, 'slow'), 'golpe do espectro deixa o personagem lento');
  // yeti: golpe em área marcado em volta de si
  const w2 = mk(14, 'montanha');
  const y = w2.monsters.find((m) => m.monsterId === 'yeti')!;
  for (const m of w2.monsters) if (m !== y) m.dead = true;
  w2.player.x = y.x + 1;
  w2.player.y = y.y;
  w2.player.hp = w2.player.derived.maxHp = 99999;
  const evs: GameEvent[] = [];
  for (let i = 0; i < 60 * 4; i++) {
    w2.tick(1 / 60);
    evs.push(...w2.events.splice(0));
    w2.player.x = y.x + 1;
    w2.player.y = y.y;
  }
  const t = evs.find((e) => e.type === 'telegraph');
  ok(!!t && t.type === 'telegraph' && Math.hypot(t.x - y.x, t.y - y.y) < 1.5, 'yeti marca um círculo em volta de si');
  ok(
    evs.some((e) => e.type === 'telegraphResolved' && e.hit),
    'quem fica dentro do círculo leva o golpe',
  );
  // o Auto sai do círculo
  const w3 = mk(14, 'montanha');
  const y3 = w3.monsters.find((m) => m.monsterId === 'yeti')!;
  for (const m of w3.monsters) if (m !== y3) m.dead = true;
  w3.auto.toggle();
  w3.player.x = y3.x + 0.8;
  w3.player.y = y3.y;
  w3.telegraphs.push({ id: 999, x: y3.x, y: y3.y, radius: 2.3, delay: 1.3, remaining: 1.3, ownerId: y3.id, mult: 1 });
  for (let i = 0; i < 70; i++) w3.tick(1 / 60);
  ok(Math.hypot(w3.player.x - y3.x, w3.player.y - y3.y) > 2.3, 'Auto desvia: sai do círculo antes do golpe');
}

console.log('== Abade Caído ==');
{
  const w = mk(20, 'montanha');
  const b = w.monsters.find((m) => m.monsterId === 'abade_caido')!;
  ok(!!b && b.level === 20 && (MONSTERS.abade_caido.scale ?? 1) >= 1.5, 'Abade nível 20 e grande');
  ok(w.arenas.length === 1, 'arena do templo');
  ok(MONSTERS.abade_caido.boss!.summon.monsterId === 'discipulo_caido', 'invoca Discípulos Caídos');
  w.player.x = b.x + 1;
  w.player.y = b.y;
  w.player.hp = w.player.derived.maxHp = 1e6;
  b.hp = b.derived.maxHp * 0.49;
  b.ai = 'chase';
  for (let i = 0; i < 10; i++) w.tick(1 / 60);
  ok(
    w.monsters.filter((m) => m.summoned && m.monsterId === 'discipulo_caido').length === 2,
    'metade da vida: 2 discípulos',
  );
  priv(w).killMonster(b);
  ok(
    w.bossRespawn.abade_caido === NOW + MONSTERS.abade_caido.respawnSeconds * 1000,
    'renascimento do Abade (relógio real)',
  );
  ok(!w.bossRespawn.general_terracota, 'o General não é afetado (renascimento por chefe)');
  const s = w.serialize();
  ok(
    s.bossRespawns?.abade_caido === w.bossRespawn.abade_caido && s.bossRespawnAt === undefined,
    'save guarda por chefe',
  );
  const w2 = World.fromSave(maps, { ...s, mapId: 'montanha' }, NOW + 60_000, false); // muda de mapa com o relógio do save
  ok(w2.monsters.find((m) => m.monsterId === 'abade_caido')!.dead, 'reabrindo: Abade continua morto');
  const old = World.fromSave(
    maps,
    { ...s, bossRespawns: undefined, bossRespawnAt: NOW + 5000, mapId: 'ruinas' },
    NOW,
    false,
  );
  ok(
    old.monsters.find((m) => m.monsterId === 'general_terracota')!.dead,
    'save antigo (bossRespawnAt) vale para o General',
  );
}

console.log('== equipamentos nv 10 e 15 ==');
{
  const slots = ['colar', 'tronco', 'arma', 'cabeca', 'calca', 'bota'];
  for (const lv of [10, 15]) {
    const at = Object.values(BASES).filter((b) => b.reqLevel === lv);
    ok(
      slots.every((s) => at.some((b) => b.slot === s)) &&
        ['lamina', 'pavilhao', 'tita', 'vibora'].every((c) => at.some((b) => b.slot === 'arma' && b.sect === c)),
      `nível ${lv}: 6 slots e arma de cada seita`,
    );
  }
  ok(
    ['espectro_gelo', 'yeti'].every((id) => {
      const e = MONSTERS[id].loot!.equipment;
      return Array.isArray(e) && e.some((x) => x.minReqLevel === 10) && e.some((x) => x.minReqLevel === 15);
    }),
    'monstros da montanha soltam equipamento nv 10 e 15',
  );
  ok(MONSTERS.abade_caido.loot!.guaranteed!.reqLevel === 15, 'Abade garante um Raro nv 15');
}

console.log('== forja ==');
{
  const w = mk(15);
  const it = makeEquipment('espadas_trovao_nevado', 'comum', null, priv(w).rng, 10);
  w.equipment.arma = it;
  w.addItem(makeStack('minerio_ferro', 99));
  w.addItem(makeStack('minerio_ferro', 99));
  w.addItem(makeStack('cristal_gelo', 40));
  w.addItem(makeStack('essencia_qi', 10));
  ok(w.forgeUpgrade(it) !== null, 'forjar exige falar com o ferreiro');
  openNpc(w, 'ferreiro');
  const atk0 = itemStats(it).physAtk;
  const c0 = upgradeCost(it)!;
  ok(c0.chance === 1 && c0.mats.minerio_ferro === 2, '+0→+1: chance 100%, 2 minérios');
  const g0 = w.gold;
  ok(w.forgeUpgrade(it) === null && it.plus === 1, 'melhora para +1');
  ok(w.gold === g0 - c0.gold && itemStats(it).physAtk > atk0, 'cobra o ouro e o ataque sobe');
  ok(itemName(it).endsWith('+1'), 'nome mostra +1');
  // falha: perde os materiais e o ouro, item igual
  it.plus = 9;
  const c9 = upgradeCost(it)!;
  ok(Math.abs(c9.chance - FORGE.upgradeChance[9]) < 1e-9 && c9.mats.essencia_qi === 1, '+9→+10: 20% e pede essência');
  let failed = false,
    tries = 0;
  while (!failed && tries++ < 50) {
    it.plus = 9;
    const ore = w.potionCount('minerio_ferro'),
      gold = w.gold;
    if (ore < c9.mats.minerio_ferro) w.addItem(makeStack('minerio_ferro', 99));
    if (w.potionCount('cristal_gelo') < 10) w.addItem(makeStack('cristal_gelo', 20));
    if (w.potionCount('essencia_qi') < 2) w.addItem(makeStack('essencia_qi', 5));
    if (w.gold < c9.gold) w.gold += c9.gold * 5;
    const gold1 = w.gold;
    const ore1 = w.potionCount('minerio_ferro');
    w.forgeUpgrade(it);
    if (it.plus === 9) {
      failed = true;
      ok(w.potionCount('minerio_ferro') === ore1 - c9.mats.minerio_ferro, 'falhou: materiais gastos');
      ok(w.gold === gold1 - c9.gold && it.plus === 9 && w.equipment.arma === it, 'falhou: ouro cobrado, item igual (não quebra)');
      void ore;
      void gold;
    }
  }
  ok(failed, 'alguma tentativa a 20% falhou');
  it.plus = MAX_PLUS;
  ok(upgradeCost(it) === null && w.forgeUpgrade(it)?.code === 'cannotForge', '+10 é o máximo');
  // raridade
  const r = makeEquipment('manto_yeti', 'comum', null, priv(w).rng, 10);
  w.addItem(r);
  ok(
    rarityCost(r) !== null && w.forgeRarity(r) === null && r.rarity === 'incomum' && r.bonuses.length === 1,
    'Comum → Incomum com 1 bônus',
  );
  ok(w.forgeRarity(r) === null && r.rarity === 'raro' && r.bonuses.length === 2, 'Incomum → Raro com 2 bônus');
  ok(new Set(r.bonuses.map((b) => b.stat)).size === 2, 'bônus novo não repete o que já tinha');
  ok(rarityCost(r) === null, 'Raro não sobe mais');
  const before = JSON.stringify(r.bonuses);
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    ok(w.forgeReroll(r) === null, 'trocar bônus');
    changed = JSON.stringify(r.bonuses) !== before;
  }
  ok(changed && r.bonuses.length === 2, 'trocar bônus sorteia de novo (mesma quantidade)');
  ok(
    rerollCost(makeEquipment('manto_yeti', 'comum', null, priv(w).rng, 10)) === null,
    'Comum não tem bônus para trocar',
  );
  // sem material
  const w2 = mk(15);
  openNpc(w2, 'ferreiro');
  const it2 = makeEquipment('capuz_la', 'comum', null, priv(w2).rng, 10);
  w2.addItem(it2);
  ok(w2.forgeUpgrade(it2)?.code === 'noMaterials', 'sem materiais: avisa');
  // desmontar
  const i = w2.bag.indexOf(it2);
  const y = salvageYield(it2);
  ok((y.minerio_ferro ?? 0) >= 3 && (y.cristal_gelo ?? 0) === 1, 'desmontar nv 10 dá minério e 1 cristal');
  ok(w2.forgeSalvage(i) === null && !w2.bag.includes(it2), 'desmonta o item da mochila');
  ok(
    w2.potionCount('minerio_ferro') === y.minerio_ferro && w2.potionCount('cristal_gelo') === 1,
    'materiais na mochila',
  );
  ok(
    w2.forgeSalvage(w2.bag.findIndex((b) => b?.baseId === 'minerio_ferro'))?.code === 'cannotForge',
    'material não se desmonta',
  );
  // materiais empilham, vendem e voltam do save
  ok(
    sortedBag(w2.bag)
      .filter(Boolean)
      .every((b) => MATERIALS[b!.baseId]),
    'materiais organizados na mochila',
  );
  const back = World.fromSave(maps, { ...w.serialize(), lastSeen: NOW }, NOW, false);
  ok(
    back.equipment.arma?.plus === MAX_PLUS && back.potionCount('cristal_gelo') === w.potionCount('cristal_gelo'),
    'save guarda +N e materiais',
  );
  ok(
    sanitizeItem({ baseId: 'manto_yeti', plus: 99 })?.plus === MAX_PLUS &&
      !sanitizeItem({ baseId: 'manto_yeti', plus: -3 })?.plus,
    'save com +N estranho é saneado',
  );
}

console.log('== drops de materiais ==');
{
  const w = mk(20, 'montanha');
  w.player.x = 16;
  w.player.y = 27;
  for (let k = 0; k < 120; k++) {
    const m = w.monsters.find((x) => !x.dead && x.monsterId === 'yeti');
    if (!m) break;
    m.x = w.player.x;
    m.y = w.player.y;
    priv(w).killMonster(m);
    m.dead = false;
  }
  ok(w.potionCount('minerio_ferro') > 0 && w.potionCount('cristal_gelo') > 0, 'yetis soltam minério e cristal');
  const g = mk(10, 'ruinas');
  const gen = g.monsters.find((m) => m.monsterId === 'general_terracota')!;
  priv(g).killMonster(gen);
  ok(g.potionCount('essencia_qi') >= 1, 'General solta essência de qi');
}

console.log('== Mercador Ambulante ==');
{
  const w = mk(12);
  ok(stockLevel(12) === 10 && stockLevel(9) === 5 && stockLevel(20) === 15, 'nível do estoque acompanha o personagem');
  const st = w.merchantStock();
  ok(st.offers.length >= 4 && st.offers.length <= 6, '4 a 6 itens');
  ok(
    st.offers.every((o) => BASES[o.item.baseId].reqLevel === 10 && o.item.rarity !== 'comum'),
    'itens do nível do personagem, Incomuns ou Raros',
  );
  ok(st.offers.filter((o) => o.item.rarity === 'raro').length >= st.offers.length / 2, 'quase todos Raros');
  ok(
    st.offers.every((o) => !BASES[o.item.baseId].sect || BASES[o.item.baseId].sect === 'lamina'),
    'arma só da própria seita',
  );
  ok(w.merchantBuy(0) !== null, 'comprar exige falar com o mercador');
  openNpc(w, 'mercador');
  const g0 = w.gold,
    o = st.offers[0];
  ok(w.merchantBuy(0) === null && o.sold && w.gold === g0 - o.price, 'compra e marca como vendido');
  ok(
    w.bag.some((b) => b?.baseId === o.item.baseId && b.rarity === o.item.rarity),
    'item na mochila',
  );
  ok(w.merchantBuy(0)?.code === 'soldOut', 'não vende o mesmo item duas vezes');
  ok(w.merchantStock() === st, 'na mesma hora o estoque não muda');
  const w2 = World.fromSave(maps, { ...w.serialize(), lastSeen: NOW }, NOW, false);
  w2.clock = () => NOW;
  ok(
    w2.merchantStock().offers[0].sold && w2.merchantStock().offers.length === st.offers.length,
    'save guarda o estoque',
  );
  w2.clock = () => NOW + 60 * 60_000;
  const st2 = w2.merchantStock();
  ok(st2.period === merchantPeriod(NOW) + 1 && !st2.offers.some((x) => x.sold), 'uma hora depois: estoque novo');
  ok(w.merchantBuyGoods('cristal_gelo', 2) === null && w.potionCount('cristal_gelo') === 2, 'vende cristais de gelo');
  ok(w.merchantBuyGoods('pergaminho_retorno', 1) === null, 'vende pergaminho de retorno');
  const i = w.bag.findIndex((b) => b?.baseId === 'pergaminho_retorno');
  ok(!w.useReturnScroll(i), 'pergaminho não funciona na vila');
  w.changeMap('montanha');
  ok(
    w.useReturnScroll(i) && w.mapId === 'cidade' && !w.bag.some((b) => b?.baseId === 'pergaminho_retorno'),
    'pergaminho leva à vila e é gasto',
  );
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
