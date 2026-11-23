// Verificação headless de itens, inventário, loot, poções, NPCs e save (não vai para o build do jogo).
// Uso: npm run check:items
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS, RELIC_DROP, RELICS } from '../src/core/data';
import {
  BASES,
  POTIONS,
  STACK_MAX,
  itemStats,
  makeEquipment,
  makePotion,
  repairCost,
  sellValue,
  GEMS,
  GEM_CFG,
  gemId,
  makeStack,
} from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { Rng } from '../src/core/rng';
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
for (const id of ['cidade', 'floresta', 'ruinas', 'cidadela', 'porto'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const run = (w: World, s: number) => {
  for (let i = 0; i < s * 60; i++) w.tick(1 / 60);
};
const drain = (w: World) => w.events.splice(0);
type Priv = { rng: Rng; killMonster: (m: Entity) => void; killPlayer: () => void };
const priv = (w: World) => w as unknown as Priv;

function mk(classId = 'lamina', level = 5, mapId = 'floresta', seed = 1): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s: SaveData = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId,
    lastSeen: 0,
  };
  const w = World.fromSave(maps, s);
  priv(w).rng = new Rng(seed);
  return w;
}
const equipOf = (w: World, id: string, rarity: 'comum' | 'incomum' | 'raro' = 'comum') =>
  makeEquipment(id, rarity, CLASSES[w.classId].element, priv(w).rng);
const near = (w: World, role: string) => {
  const n = w.npcs.find((e) => w.npcRole(e) === role)!;
  w.player.x = n.spot ? n.spot.x : n.x + 1;
  w.player.y = n.spot ? n.spot.y : n.y;
  w.player.path = [];
  w.interactNpc(n.id);
  run(w, 0.1);
  return n;
};

console.log('\n== criação ==');
{
  const w = World.create(maps, 'T', 'pavilhao');
  ok(w.potionCount('pocao_hp_p') === 3, '3 poções de vida pequenas iniciais');
  ok(
    w.equipment.arma?.baseId === 'leque_bambu' && w.equipment.arma.rarity === 'comum',
    'arma inicial da seita (comum)',
  );
  const base = World.create(maps, 'T', 'lamina');
  base.equipment.arma = null;
  (base as unknown as { recalc: (e: Entity, k: boolean) => void }).recalc(base.player, false);
  ok(base.player.derived.physAtk === 2 + CLASSES.lamina.baseAttributes.strength * 2, 'sem arma: ataque base');
  ok(
    World.create(maps, 'T', 'lamina').player.derived.physAtk === 2 + CLASSES.lamina.baseAttributes.strength * 2 + 5,
    'arma inicial soma +5 de ataque físico',
  );
  ok(w.gold === 0 && w.bag.length === 90, 'ouro 0, mochila de 3 abas × 30');
}

console.log('\n== dados ==');
{
  const slots = ['colar', 'tronco', 'arma', 'cabeca', 'calca', 'bota'];
  ok(
    slots.every(
      (s) =>
        Object.values(BASES).filter((b) => b.slot === s && b.reqLevel === 1).length >= 1 &&
        Object.values(BASES).filter((b) => b.slot === s && b.reqLevel === 5).length >= 1,
    ),
    'cada slot tem base nv 1 e nv 5',
  );
  ok(
    Object.keys(CLASSES).every((c) =>
      [1, 5].every((lv) => Object.values(BASES).some((b) => b.slot === 'arma' && b.sect === c && b.reqLevel === lv)),
    ),
    'cada seita tem arma nv 1 e nv 5',
  );
  const rng = new Rng(7);
  let good = true;
  for (const r of ['comum', 'incomum', 'raro'] as const)
    for (let i = 0; i < 300; i++) {
      const it = makeEquipment('colar_jade', r, 'thunder', rng);
      if (
        it.bonuses.length !== { comum: 0, incomum: 1, raro: 2 }[r] ||
        new Set(it.bonuses.map((b) => b.stat)).size !== it.bonuses.length
      )
        good = false;
    }
  ok(good, 'comum 0 / incomum 1 / raro 2 bônus, sem repetir');
  const hi = makeEquipment('colar_jade', 'raro', 'thunder', new Rng(1), 9),
    lo = makeEquipment('colar_jade', 'raro', 'thunder', new Rng(1), 1);
  ok(
    hi.ilvl === 9 && hi.bonuses.reduce((a, b) => a + b.value, 0) > lo.bonuses.reduce((a, b) => a + b.value, 0),
    'bônus escalam com o nível do item',
  );
}

console.log('\n== equipar / durabilidade ==');
{
  const w = mk('lamina', 5);
  const p = w.player;
  const d0 = { ...p.derived };
  const sword = equipOf(w, 'espadas_vento', 'raro');
  w.addItem(sword);
  const st = itemStats(sword);
  ok(w.equip(0) === null && w.equipment.arma === sword, 'equipa arma nv 5 com nível 5');
  ok(
    p.derived.physAtk === d0.physAtk + (st.physAtk ?? 0) + (st.strength ?? 0) * 2 && st.physAtk === 14,
    `ataque físico soma stats (+${p.derived.physAtk - d0.physAtk})`,
  );
  ok(p.derived.hit >= d0.hit + 5, 'precisão soma');
  ok(
    drain(w).some((e) => e.type === 'equipChange'),
    'evento equipChange',
  );
  sword.durability = 0;
  (w as unknown as { recalc: (e: Entity, k: boolean) => void }).recalc(p, false);
  ok(p.derived.physAtk === d0.physAtk, 'durabilidade 0: stats removidos');
  ok(w.unequip('arma') === null && w.equipment.arma === null && w.bag[0] === sword, 'desequipa para a mochila');
  // requisitos
  const w2 = mk('lamina', 1);
  w2.addItem(equipOf(w2, 'espadas_vento'));
  w2.addItem(equipOf(w2, 'leque_bambu'));
  ok(w2.equip(0)?.code === 'needLevel' && w2.equipment.arma === null, 'nível insuficiente bloqueia');
  ok(w2.equip(1) !== null && w2.equip(1)?.code === 'sectOnly', 'arma de outra seita bloqueada');
  // atributos de equipamento afetam derivados
  const w3 = mk('lamina', 5);
  const hp0 = w3.player.derived.maxHp;
  w3.addItem(equipOf(w3, 'manto_seda'));
  w3.equip(0);
  ok(w3.player.derived.maxHp === hp0 + 30 && w3.player.derived.physDef >= 8, 'tronco soma vida e defesa');
  w3.addItem(equipOf(w3, 'botas_andarilho'));
  const ag = w3.player.attrs.agility;
  w3.equip(0);
  ok(
    w3.player.attrs.agility === ag && w3.player.derived.evasion === ag + 2 * 1 + 4,
    'bônus de atributo vai só aos derivados (attrs base intactos)',
  );
  // swap
  const a = equipOf(w3, 'manto_seda'),
    b = equipOf(w3, 'tunica_algodao');
  w3.equipment.tronco = a;
  w3.addItem(b);
  const idx = w3.bag.indexOf(b);
  w3.equip(idx);
  ok(w3.equipment.tronco === b && w3.bag[idx] === a, 'troca equipado por item da mochila');
}

console.log('\n== morte ==');
{
  const w = mk('lamina', 5);
  const p = w.player;
  const it = equipOf(w, 'espadas_vento');
  w.equipment.arma = it;
  const it2 = equipOf(w, 'manto_seda');
  w.equipment.tronco = it2;
  it2.durability = 5;
  const bagItem = equipOf(w, 'colar_jade');
  w.addItem(bagItem);
  priv(w).killPlayer();
  ok(
    it.durability === 90 && it2.durability === 0,
    `morte: -10% da durabilidade máxima (${it.durability}, ${it2.durability})`,
  );
  ok(bagItem.durability === 100, 'itens na mochila não perdem durabilidade');
  ok(
    drain(w).some((e) => e.type === 'durabilityLost'),
    'evento durabilityLost',
  );
  void p;
  // 10 mortes quebram tudo
  for (let i = 0; i < 10; i++) priv(w).killPlayer();
  ok(it.durability === 0, 'após 10 mortes chega a 0 (sem negativo)');
}

console.log('\n== loot ==');
{
  const w = mk('pavilhao', 1, 'floresta', 5);
  const p = w.player;
  for (const m of w.monsters) {
    m.dead = true;
    m.respawnAt = 1e9;
  }
  const wolf = w.monsters[0];
  let goldOk = true,
    gotGold = 0,
    gotPotion = false,
    gotEquip: ReturnType<typeof makeEquipment> | null = null,
    kills = 0;
  const counts = { comum: 0, incomum: 0, raro: 0 };
  for (; kills < 3000 && !(gotPotion && gotEquip); kills++) {
    wolf.dead = false;
    wolf.level = 1;
    wolf.x = p.x;
    wolf.y = p.y;
    priv(w).killMonster(wolf);
    for (const e of drain(w)) {
      if (e.type === 'goldPickup') {
        gotGold += e.amount;
        if (e.amount < MONSTERS.lobo.loot!.gold!.min || e.amount > MONSTERS.lobo.loot!.gold!.max) goldOk = false;
      }
      if (e.type === 'itemPickup' && e.potion) gotPotion = true;
    }
    // o Épico (sorteio com semente do relógio, epicRng) tem nível próprio: fora desta conferência
    for (const b of w.bag) if (b && BASES[b.baseId] && b.rarity !== 'epico' && !gotEquip) gotEquip = b;
    if (w.freeSlots() < 5) {
      for (let i = 0; i < w.bag.length; i++)
        if (w.bag[i] && BASES[w.bag[i]!.baseId]) {
          counts[w.bag[i]!.rarity]++;
          w.bag[i] = null;
        }
    }
  }
  ok(goldOk && gotGold > 0 && w.gold === gotGold, `lobo dropa ouro (${gotGold})`);
  ok(gotPotion && w.kindCount('hp') + w.kindCount('mp') > 0, 'lobo dropa poção pequena, auto-coletada');
  ok(!!gotEquip, `lobo dropa equipamento nv 1 (após ${kills} abates)`);
  ok(
    !!gotEquip &&
      BASES[gotEquip.baseId].reqLevel === 1 &&
      (!BASES[gotEquip.baseId].sect || BASES[gotEquip.baseId].sect === 'pavilhao'),
    'drop é nv 1 e utilizável pela seita',
  );
  ok(w.potionCount('pocao_hp_g') === 0 && w.potionCount('pocao_mp_g') === 0, 'poção grande não cai de monstro nv < 5');
  // poção grande cai de nv >= 5
  const w5 = mk('lamina', 5, 'floresta', 9);
  const m5 = w5.monsters[0];
  let big = false;
  for (let i = 0; i < 400 && !big; i++) {
    m5.dead = false;
    m5.level = 5;
    m5.x = w5.player.x;
    m5.y = w5.player.y;
    priv(w5).killMonster(m5);
    if (w5.potionCount('pocao_hp_g') + w5.potionCount('pocao_mp_g') > 0) big = true;
    if (w5.freeSlots() < 3) w5.bag.fill(null);
  }
  ok(big, 'poção grande cai de monstro nv 5+');
  // taxa de raridade
  let n = 0;
  const r = new Rng(3);
  const c2 = { comum: 0, incomum: 0, raro: 0 };
  const w6 = mk('lamina', 1, 'floresta', 11);
  const m6 = w6.monsters[0];
  priv(w6).rng = r;
  for (let i = 0; i < 6000; i++) {
    m6.dead = false;
    m6.level = 1;
    priv(w6).killMonster(m6);
    for (const b of w6.bag)
      if (b && BASES[b.baseId]) {
        c2[b.rarity]++;
        n++;
      }
    w6.bag.fill(null);
  }
  const tot = c2.comum + c2.incomum + c2.raro;
  ok(
    tot > 200 && Math.abs(c2.comum / tot - 0.75) < 0.08 && Math.abs(c2.incomum / tot - 0.2) < 0.07 && c2.raro > 0,
    `raridades ~75/20/5 (${c2.comum}/${c2.incomum}/${c2.raro})`,
  );
  void n;
}

console.log('\n== mochila cheia / chão ==');
{
  const w = mk('lamina', 1, 'floresta', 2);
  const p = w.player;
  for (let i = 0; i < 30; i++) w.addItem(equipOf(w, 'colar_jade'));
  ok(w.freeSlots() === 0 && !w.addItem(equipOf(w, 'colar_jade')), 'aba de equipamentos (30) enche e recusa');
  ok(
    w.canFit('pocao_hp_p', 99) && w.canFit('minerio_ferro', 99) && w.freeSlots('pot') > 0 && w.freeSlots('mat') === 30,
    'abas de consumíveis e materiais têm espaço próprio',
  );
  (w as unknown as { collect: (i: unknown, x: number, y: number) => void }).collect(
    equipOf(w, 'faixa_linho'),
    p.x + 3,
    p.y,
  );
  ok(drain(w).some((e) => e.type === 'bagFull') && w.ground.length === 1, 'bagFull e item fica no chão');
  w.bag[0] = null;
  run(w, 1);
  ok(w.ground.length === 1, 'longe do item não coleta');
  p.x = w.ground[0].x;
  p.y = w.ground[0].y;
  run(w, 0.1);
  ok(
    w.ground.length === 0 && w.bag[0]?.baseId === 'faixa_linho' && drain(w).some((e) => e.type === 'itemPickup'),
    'coleta ao andar por cima quando há espaço',
  );
  w.bag[0] = null;
  w.bag[1] = equipOf(w, 'colar_jade');
  w.bag[0] = equipOf(w, 'colar_jade');
  (w as unknown as { collect: (i: unknown, x: number, y: number) => void }).collect(
    equipOf(w, 'faixa_linho'),
    p.x + 5,
    p.y,
  );
  w.bag[2] = w.bag[2];
  run(w, 59);
  ok(w.ground.length === 1, 'continua no chão aos 59s');
  run(w, 2);
  ok(w.ground.length === 0 && drain(w).some((e) => e.type === 'groundGone'), 'some após 60s');
}

console.log('\n== empilhar poções ==');
{
  const w = mk('lamina', 1);
  w.addItem(makePotion('pocao_hp_p', 90));
  w.addItem(makePotion('pocao_hp_p', 20));
  ok(
    w.potionCount('pocao_hp_p') === 110 && w.bag[0]!.qty === STACK_MAX && w.bag[1]!.qty === 11,
    'empilha até 99 e abre nova pilha',
  );
  w.addItem(makePotion('pocao_mp_p', 1));
  ok(w.bag[2]!.baseId === 'pocao_mp_p', 'tipos diferentes não misturam');
  const w2 = mk('lamina', 1);
  w2.bag.fill(null);
  for (let i = 0; i < 30; i++) w2.bag[i] = makePotion('pocao_hp_p', 99);
  ok(!w2.addItem(makePotion('pocao_hp_p', 1)), 'pilhas cheias + mochila cheia recusam');
  w2.bag[5]!.qty = 98;
  ok(w2.addItem(makePotion('pocao_hp_p', 1)) && w2.bag[5]!.qty === 99, 'completa pilha parcial');
}

console.log('\n== poções ao longo do tempo ==');
{
  const w = mk('lamina', 5, 'floresta');
  const p = w.player;
  for (const m of w.monsters) {
    m.dead = true;
    m.respawnAt = 1e9;
  }
  w.addItem(makePotion('pocao_hp_p', 6));
  w.addItem(makePotion('pocao_mp_p', 1));
  p.hp = 1;
  const max = p.derived.maxHp;
  ok(w.usePotion('hp') && w.potionCount('pocao_hp_p') === 5, 'usa poção de vida (consome 1)');
  run(w, 0.5);
  ok(p.hp > 1 && p.hp < 1 + max * 0.3, 'cura gradual, não instantânea');
  run(w, 4);
  const mid = p.hp;
  ok(Math.abs(mid - (1 + (max * 0.3 * 4.5) / 8)) < 1, `~metade aos 4,5s (${mid.toFixed(1)})`);
  run(w, 3.6);
  ok(Math.abs(p.hp - (1 + max * 0.3)) < 1 && !w.potionFx.hp, `total 30% em 8s e efeito termina (${p.hp.toFixed(1)})`);
  // reinício: usar de novo reinicia o efeito (não acumula)
  p.hp = 1;
  w.usePotion('hp');
  run(w, 4);
  const before = p.hp;
  w.usePotion('hp');
  ok(w.potionFx.hp!.remaining > 7.9, 'segunda poção reinicia o efeito (8s)');
  run(w, 8.1);
  ok(p.hp - before <= max * 0.3 + 1, 'não acumula curas simultâneas (taxa única)');
  // cooldown 1s
  p.hp = 1;
  w.usePotion('hp');
  drain(w);
  const ok2 = w.usePotion('hp');
  ok(!ok2 && drain(w).some((e) => e.type === 'potionFail' && e.reason === 'cooldown'), 'cooldown de 1s por tipo');
  // mana
  p.mana = 0;
  ok(w.usePotion('mp'), 'poção de mana');
  run(w, 8.1);
  ok(
    Math.abs(p.mana - p.derived.maxMana * 0.3) < 0.6 || p.mana >= p.derived.maxMana * 0.3 - 0.6,
    `mana +30% (${p.mana.toFixed(1)})`,
  );
  ok(!w.usePotion('mp') && drain(w).some((e) => e.type === 'potionFail' && e.reason === 'none'), 'sem poção: falha');
  p.hp = p.derived.maxHp;
  w.addItem(makePotion('pocao_hp_p'));
  run(w, 1.2);
  drain(w);
  ok(
    !w.usePotion('hp') && drain(w).some((e) => e.type === 'potionFail' && e.reason === 'full'),
    'vida cheia: não gasta',
  );
  // grande = 60%
  const w2 = mk('lamina', 5, 'floresta');
  for (const m of w2.monsters) {
    m.dead = true;
    m.respawnAt = 1e9;
  }
  w2.addItem(makePotion('pocao_hp_g'));
  w2.player.hp = 1;
  w2.usePotion('hp');
  run(w2, 8.2);
  ok(Math.abs(w2.player.hp - (1 + w2.player.derived.maxHp * 0.6)) < 1, 'poção grande cura 60%');
}

console.log('\n== NPC: caminhar e abrir ==');
{
  const w = mk('lamina', 5, 'cidade');
  const p = w.player;
  const n = w.npcs.find((e) => w.npcRole(e) === 'ferreiro')!;
  p.x = 16.5;
  p.y = 17.5;
  w.interactNpc(n.id);
  run(w, 0.5);
  ok(!w.openNpc, 'ainda caminhando');
  run(w, 8);
  ok(
    w.openNpc === n && Math.hypot(p.x - n.x, p.y - n.y) <= 1.8 && Math.hypot(p.x - n.x, p.y - n.y) > 0.5,
    `chegou adjacente (${Math.hypot(p.x - n.x, p.y - n.y).toFixed(2)}) e abriu`,
  );
  ok(
    drain(w).some((e) => e.type === 'npcOpen' && e.npcId === 'ferreiro'),
    'evento npcOpen',
  );
  p.x = n.x + 2.5;
  p.y = n.y;
  run(w, 0.1);
  ok(!!w.openNpc, 'a 2,5 tiles continua aberto');
  p.x = n.x + 3.5;
  run(w, 0.1);
  ok(!w.openNpc && drain(w).some((e) => e.type === 'npcClose'), 'fecha ao afastar > 3 tiles');
  w.interactNpc(n.id);
  p.x = n.x + 1;
  p.y = n.y;
  run(w, 0.1);
  ok(!!w.openNpc, 'reabre');
  w.closeNpc();
  ok(!w.openNpc, 'closeNpc fecha');
  // clique no chão cancela o caminho até o NPC
  p.x = 16.5;
  p.y = 17.5;
  w.interactNpc(n.id);
  w.moveTo(16.5, 18.5);
  run(w, 8);
  ok(!w.openNpc, 'mover cancela a interação');
  const el = w.npcs.find((e) => w.npcRole(e) === 'anciao')!;
  p.x = el.x + 1;
  p.y = el.y;
  w.interactNpc(el.id);
  run(w, 0.1);
  ok(w.openNpc === el && w.npcRole() === 'anciao', 'ancião abre diálogo');
}

console.log('\n== ferreiro ==');
{
  const w = mk('lamina', 5, 'cidade');
  near(w, 'ferreiro');
  const it = equipOf(w, 'espadas_vento');
  it.durability = 60;
  w.equipment.arma = it;
  const bagIt = equipOf(w, 'manto_seda');
  bagIt.durability = 90;
  w.addItem(bagIt);
  ok(repairCost(it) === Math.ceil(40 * 5 * 0.5), `custo = faltante x nível x 0,5 (${repairCost(it)})`);
  ok(w.repair(it)?.code === 'noGold' && it.durability === 60, 'sem ouro: não conserta');
  w.gold = 100;
  const c1 = repairCost(it);
  ok(w.repair(it) === null && it.durability === 100 && w.gold === 100 - c1, `conserta e desconta (${c1})`);
  it.durability = 0;
  ok(w.repairAllCost() === repairCost(it) + repairCost(bagIt), 'consertar tudo soma equipado + mochila');
  w.gold = 5;
  ok(w.repairAll()?.code === 'noGold', 'consertar tudo sem ouro falha');
  w.gold = 1000;
  const tot = w.repairAllCost();
  ok(
    w.repairAll() === null && w.gold === 1000 - tot && it.durability === 100 && bagIt.durability === 100,
    'consertar tudo',
  );
  w.closeNpc();
  ok(w.repairAll()?.code === 'talkToBlacksmith', 'só conserta com o ferreiro aberto');
  // item quebrado volta a dar stats após conserto
  const w2 = mk('lamina', 5, 'cidade');
  const s = equipOf(w2, 'espadas_vento');
  w2.equipment.arma = s;
  s.durability = 0;
  (w2 as unknown as { recalc: (e: Entity, k: boolean) => void }).recalc(w2.player, false);
  const low = w2.player.derived.physAtk;
  near(w2, 'ferreiro');
  w2.gold = 500;
  w2.repair(s);
  ok(w2.player.derived.physAtk === low + 14, 'conserto restaura os stats');
}

console.log('\n== vendedor: comprar e vender ==');
{
  const w = mk('lamina', 5, 'cidade');
  near(w, 'vendedor');
  ok(w.buy('pocao_hp_p', 1)?.code === 'noGold', 'compra sem ouro falha');
  w.gold = 200;
  ok(
    w.buy('pocao_hp_p', 5) === null &&
      w.gold === 200 - 5 * POTIONS.pocao_hp_p.price &&
      w.potionCount('pocao_hp_p') === 5,
    'compra 5 poções',
  );
  ok(w.buy('pocao_mp_g', 10)?.code === 'noGold', 'compra 10 sem ouro suficiente falha');
  w.gold = 5000;
  w.buy('pocao_mp_g', 10);
  ok(w.potionCount('pocao_mp_g') === 10, 'compra 10 grandes');
  const g0 = w.gold,
    i = w.bag.findIndex((b) => b?.baseId === 'pocao_hp_p');
  ok(
    w.sell(i, 1) === null && w.gold === g0 + sellValue(makePotion('pocao_hp_p')) && w.potionCount('pocao_hp_p') === 4,
    'vende 1 poção (15%)',
  );
  w.sell(i, 99);
  ok(w.potionCount('pocao_hp_p') === 0 && w.bag[i] === null, 'vende a pilha toda');
  const raro = equipOf(w, 'espadas_vento', 'raro');
  w.addItem(raro);
  const j = w.bag.indexOf(raro),
    g1 = w.gold;
  const exp = Math.floor(200 * 2.6 * 0.15 + 1e-9);
  ok(
    sellValue(raro) === exp && w.sell(j) === null && w.gold === g1 + exp && w.bag[j] === null,
    `vende raro por ${exp}`,
  );
  // mochila cheia na compra
  const w2 = mk('lamina', 5, 'cidade');
  near(w2, 'vendedor');
  w2.gold = 999;
  for (let k = 0; k < 30; k++) w2.addItem(equipOf(w2, 'colar_jade'));
  ok(w2.buy('pocao_hp_p', 1) === null, 'aba de equipamentos cheia não impede comprar poção');
  w2.gold = 999;
  w2.bag = w2.bag.map((b) => (b && b.qty ? null : b)); // tira as poções do kit (a de vida empilharia)
  for (let k = 0; k < 30; k++) w2.addItem(makePotion('pocao_mp_p', 99));
  ok(
    w2.buy('pocao_hp_p', 1)?.code === 'bagFull' && w2.gold === 999,
    'compra com aba de consumíveis cheia falha sem cobrar',
  );
  w2.closeNpc();
  ok(w2.buy('pocao_hp_p', 1)?.code === 'talkToSeller', 'só compra com vendedor aberto');
  ok(
    drain(w).some((e) => e.type === 'trade'),
    'eventos de trade',
  );
}

console.log('\n== cadeado e recompra ==');
{
  const w = mk('pavilhao', 5, 'cidade');
  w.bag = w.bag.map(() => null);
  const it = equipOf(w, 'colar_jade', 'incomum');
  w.addItem(it);
  const i = w.bag.indexOf(it);
  ok(w.toggleLock(i) && it.locked === true, 'tranca equipamento');
  near(w, 'vendedor');
  ok(w.sell(i)?.code === 'itemLocked' && w.bag[i] === it, 'trancado não vende');
  ok(w.sellRaw(i) === 0 && w.bag[i] === it, 'trancado não vende pelo auto (sellRaw)');
  ok(!w.auto.sellable(it), 'regra do auto ignora trancado');
  ok(!w.destroyItem(i) && w.bag[i] === it, 'trancado não é destruído');
  ok(w.forgeSalvage(i, true)?.code === 'itemLocked', 'trancado não é desmontado');
  const back = World.fromSave(maps, JSON.parse(JSON.stringify(w.serialize())));
  ok(
    back.bag.some((b) => b?.uid === it.uid && b.locked),
    'cadeado vai para o save',
  );
  w.toggleLock(i);
  ok(!it.locked, 'destranca');
  const g0 = w.gold;
  ok(w.sell(i) === null && !w.bag[i] && w.gold > g0, 'destrancado vende');
  const price = w.gold - g0;
  ok(w.buyback.length === 1 && w.buyback[0].price === price, 'venda entra na recompra pelo mesmo preço');
  w.gold = price - 1;
  ok(w.buyBack(0)?.code === 'noGold' && w.buyback.length === 1, 'recompra sem ouro falha');
  w.gold = price;
  ok(
    w.buyBack(0) === null && w.gold === 0 && w.bag.some((b) => b?.uid === it.uid) && !w.buyback.length,
    'recompra devolve o item',
  );
  const ep = { ...equipOf(w, 'colar_jade', 'raro'), rarity: 'epico' as const };
  w.addItem(ep);
  ok(!w.destroyItem(w.bag.indexOf(ep)) && w.bag.includes(ep), 'Épico não é destruído');
  w.toggleLock(w.bag.indexOf(ep));
  near(w, 'ferreiro');
  ok(
    w.forgeSalvage(w.bag.indexOf(ep))?.code === 'itemLocked' && w.bag.includes(ep),
    'trancado não desmonta no ferreiro',
  );
  ok(w.toggleLock(w.bag.findIndex((b) => b && b.qty)) === false, 'pilha (poção) não tranca');
}

console.log('\n== gemas e encaixes ==');
{
  const w = mk('lamina', 50, 'porto');
  const rubi = gemId('rubi', 1);
  ok(
    Object.keys(GEMS).length === 55 &&
      GEMS[gemId('rubi', 5)].stats.physAtk === 56 &&
      GEMS[gemId('cornalina', 5)].stats.elem_fire === 40,
    '11 tipos × 5 níveis (4 elementais)',
  );
  ok(w.buyGem(rubi)?.code === 'talkToJeweler', 'comprar exige o Joalheiro');
  {
    // Joalheiro cercado de objetos: clicar de longe anda até o ponto alcançável e abre a janela
    const j = w.npcs.find((e) => w.npcRole(e) === 'joalheiro')!;
    w.player.x = 72.5;
    w.player.y = 32.5;
    w.player.path = [];
    w.interactNpc(j.id);
    run(w, 8);
    ok(w.openNpc === j, 'clicar de longe no Joalheiro cercado abre a janela');
  }
  w.gold = 10_000;
  ok(w.buyGem(rubi) === null && w.gold === 10_000 - GEM_CFG.price && w.potionCount(rubi) === 1, 'compra gema I');
  w.addItem(makeStack(rubi, 2));
  const g2 = gemId('rubi', 2);
  ok(w.fuseGem(rubi) === null && w.potionCount(rubi) === 0 && w.potionCount(g2) === 1, 'funde 3 → 1 do nível II');
  ok(w.fuseGem(g2)?.code === 'noMaterials', 'fundir exige 3 iguais');
  const sword = equipOf(w, 'espadas_vento', 'raro');
  w.addItem(sword);
  ok(w.openSocket(sword)?.code === 'talkToMasterSmith', 'encaixe exige o Ferreiro-mestre');
  near(w, 'ferreiro_mestre');
  w.gold = 100_000;
  ok(w.openSocket(sword) === null && w.gold === 98_000 && sword.gems?.length === 1, '1º encaixe: 2.000 ouro');
  ok(w.openSocket(sword) === null && sword.gems?.length === 2, '2º encaixe');
  ok(w.openSocket(sword)?.code === 'socketsMax', 'raro: máximo 2 encaixes');
  const atk0 = itemStats(sword).physAtk ?? 0;
  ok(w.insertGem(sword, g2) === null && sword.gems?.[0] === g2 && w.potionCount(g2) === 0, 'coloca gema');
  ok((itemStats(sword).physAtk ?? 0) === atk0 + 18, 'gema soma nos stats do item');
  ok(w.insertGem(sword, gemId('jade', 1))?.code === 'noMaterials', 'sem gema na mochila não coloca');
  ok(w.insertGem(sword, rubi)?.code === 'gemDuplicate', 'não repete o tipo de gema no mesmo item (outro nível)');
  near(w, 'vendedor');
  const idx = w.bag.indexOf(sword);
  ok(w.sell(idx)?.code === 'hasGems' && w.bag.includes(sword), 'item com gema não se vende');
  ok(!w.destroyItem(idx), 'item com gema não se destrói');
  near(w, 'ferreiro_mestre');
  const gold = w.gold;
  ok(
    w.removeGem(sword, 0) === null &&
      sword.gems?.[0] === null &&
      w.potionCount(g2) === 1 &&
      w.gold === gold - Math.round(GEMS[g2].value * 0.2),
    'retirar devolve a gema e custa 20% do valor',
  );
  w.insertGem(sword, g2, 1);
  const back = World.fromSave(maps, JSON.parse(JSON.stringify(w.serialize())));
  const sb = back.bag.find((b) => b?.uid === sword.uid);
  ok(JSON.stringify(sb?.gems) === JSON.stringify([null, g2]), 'encaixes persistem no save');
  const epic = { ...equipOf(w, 'colar_jade', 'raro'), rarity: 'epico' as const, gems: [rubi, 'xx', null, rubi, rubi] };
  const bad = World.fromSave(maps, { ...JSON.parse(JSON.stringify(w.serialize())), bag: [epic] });
  ok(
    JSON.stringify(bad.bag[0]?.gems) === JSON.stringify([rubi, null, null]),
    'save saneia: até 3 no épico, gema inválida vira vazio',
  );
  const old = World.fromSave(maps, {
    ...JSON.parse(JSON.stringify(w.serialize())),
    bag: [{ ...sword, gems: undefined }],
  });
  ok(old.bag[0] !== null && old.bag[0]?.gems === undefined, 'save antigo: item sem encaixes');
}

console.log('\n== save ==');
{
  const w = mk('pavilhao', 5, 'cidade');
  w.gold = 321;
  w.addItem(equipOf(w, 'coroa_monge', 'raro'));
  w.addItem(makePotion('pocao_mp_p', 7));
  w.equipment.arma = equipOf(w, 'leque_nuvens', 'incomum');
  w.equipment.arma.durability = 42;
  (w as unknown as { recalc: (e: Entity, k: boolean) => void }).recalc(w.player, false);
  const atk = w.player.derived.spiritAtk;
  const w2 = World.fromSave(maps, JSON.parse(JSON.stringify(w.serialize())));
  ok(
    w2.gold === 321 &&
      w2.bag[0]?.baseId === 'coroa_monge' &&
      w2.bag[0].bonuses.length === 2 &&
      w2.potionCount('pocao_mp_p') === 7,
    'ouro, mochila e bônus persistem',
  );
  ok(
    w2.equipment.arma?.durability === 42 && w2.equipment.arma.baseId === 'leque_nuvens',
    'equipamento e durabilidade persistem',
  );
  ok(w2.player.derived.spiritAtk === atk, 'stats equipados reaplicados ao carregar');
  const old = w.serialize() as Partial<SaveData>;
  delete old.gold;
  delete old.bag;
  delete old.equipment;
  const w3 = World.fromSave(maps, old as SaveData);
  ok(
    w3.gold === 0 && w3.bag.every((b) => b === null) && SLOTS_EMPTY(w3),
    'save antigo: 0 ouro, mochila vazia, sem equipamento',
  );
  const bad = {
    ...w.serialize(),
    bag: [{ baseId: 'inexistente' }, null, { baseId: 'colar_jade', rarity: 'xx', durability: 9999 }],
    equipment: { arma: { baseId: 'colar_jade' } },
  } as SaveData;
  const w4 = World.fromSave(maps, bad);
  ok(
    w4.bag[0] === null && w4.bag[2]?.durability === 100 && w4.bag[2].rarity === 'comum' && !w4.equipment.arma,
    'save corrompido é saneado',
  );
}
// ---------- relíquias (Porto Noturno, etapa 4) ----------
console.log('\n== relíquias ==');
{
  const w = mk('lamina', 50, 'porto');
  const lao = w.npcs.find((n) => n.npcId === 'antiquario');
  ok(!!lao && w.npcRole(lao) === 'antiquario', 'Antiquário Lao no Porto Noturno');
  w.gold = 1_000_000;
  ok(w.buyRelic('taca_sangue')?.code === 'talkToAntiquary', 'só compra falando com o antiquário');
  w.openNpc = lao!;
  ok(w.buyRelic('coracao_dragao')?.code === 'notEquippable', 'lendária não está à venda');
  const g0 = w.gold;
  ok(w.buyRelic('taca_sangue') === null && w.gold === g0 - RELICS.taca_sangue.price, 'compra pelo preço');
  ok(w.buyRelic('taca_sangue')?.code === 'relicOwned', 'não compra duas vezes');
  ok(w.equipRelic('selo_jade')?.code === 'relicNotOwned', 'não equipa a que não tem');
  const atk0 = w.player.derived.physAtk,
    hp0 = w.player.derived.maxHp;
  ok(w.equipRelic('taca_sangue') === null && w.relic === 'taca_sangue', 'equipa a relíquia');
  ok(w.player.derived.physAtk === atk0 + RELICS.taca_sangue.stats.physAtk, 'atributos somam no personagem');
  ok(w.player.derived.maxHp > hp0, 'vida máxima sobe');
  ok(w.relicEffect('lifeSteal') === RELICS.taca_sangue.effect.value, 'efeito único ativo');
  const back = World.fromSave(maps, JSON.parse(JSON.stringify(w.serialize())));
  ok(back.relic === 'taca_sangue' && back.relicsOwned.join() === 'taca_sangue', 'relíquia fica no save');
  ok(back.player.derived.physAtk === w.player.derived.physAtk, 'atributos recalculados ao carregar');
  const old = World.fromSave(maps, {
    ...JSON.parse(JSON.stringify(w.serialize())),
    relics: ['xx', 'taca_sangue'],
    relic: 'selo_jade',
  });
  ok(old.relicsOwned.join() === 'taca_sangue' && old.relic === null, 'save saneado (id inválido e não possuída)');
  ok(w.equipRelic(null) === null && w.player.derived.physAtk === atk0, 'desequipar volta ao normal');
  const low = mk('lamina', 30, 'porto');
  low.openNpc = low.npcs.find((n) => n.npcId === 'antiquario')!;
  low.gold = 1_000_000;
  ok(low.buyRelic('sino_bronze')?.code === 'needLevel', 'exige nível 50');
  // drop de lendária: chance por chefe com o jogador no nível 50
  const d = mk('lamina', 50, 'porto') as World & { rollRelicDrop: () => void; rng: { next: () => number } };
  d.rng = { next: () => 0 };
  d.rollRelicDrop();
  ok(d.relicsOwned.length === 1 && RELICS[d.relicsOwned[0]].rarity === 'lendaria', 'chefe pode dar lendária');
  d.rng = { next: () => RELIC_DROP.chance };
  d.rollRelicDrop();
  ok(d.relicsOwned.length === 1, 'sem sorte, nada cai');
}
function SLOTS_EMPTY(w: World) {
  return Object.values(w.equipment).every((e) => e === null);
}

void (null as unknown as GameEvent);
console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
