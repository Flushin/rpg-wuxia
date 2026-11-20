// Confere o equipamento Épico (raridade epico): chances de drop (0,5% / 1%, 0% no auto, invocados, monstro fraco e
// offline), outras raridades intactas, +30% sobre o Raro da faixa, acompanha o nível, bônus por classe, forja até +10
// (ouro ×2), sem venda nem desmonte, equipar sem trava de nível e saves antigos intactos.
// Uso: npm run check:epic
import { readFileSync, readdirSync } from 'node:fs';
import { CLASSES, MONSTERS } from '../src/core/data';
import {
  BASES,
  EPIC_MUL,
  MAX_PLUS,
  RARITIES,
  epicBonuses,
  epicTierBase,
  itemStats,
  makeEpic,
  makePotion,
  rollRarity,
  sanitizeItem,
} from '../src/core/items';
import * as F from '../src/core/world/forge';
import { offlineDropAllowed } from '../src/core/offline';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { Rng } from '../src/core/rng';
import { World } from '../src/core/world';
import type { Entity, ItemInstance, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const maps: Record<string, GameMap> = {};
for (const f of readdirSync('public/maps').filter((f) => f.endsWith('.json'))) {
  const id = f.replace(/\.json$/, '');
  try {
    maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${f}`, 'utf8')));
  } catch {
    /* arquivo que não é mapa */
  }
}
const CLASS_IDS = Object.keys(CLASSES);
const ELEM: Record<string, string> = Object.fromEntries(CLASS_IDS.map((c) => [c, `elem_${CLASSES[c].element}`]));
const MAIN: Record<string, string> = {
  lamina: 'strength',
  pavilhao: 'intelligence',
  tita: 'strength',
  vibora: 'strength',
};

function world(classId: string, level: number, seed = 123): World {
  const w = World.create(maps, 'T', classId);
  w.player.level = level;
  w.rng = new Rng(seed);
  w.epicRng = new Rng(999);
  return w;
}
const mon = (monsterId: string, level: number, extra: Partial<Entity> = {}) =>
  ({ x: 5, y: 5, level, summoned: false, monsterId, ...extra }) as unknown as Entity;

/** Mata `n` vezes e conta os drops por raridade (pilhas à parte); a mochila e o chão são esvaziados a cada morte. */
function farm(w: World, m: Entity, n: number) {
  const got: Record<string, number> = {};
  w.auto.recordDrop = (it: ItemInstance) => {
    const k = it.qty ? `pilha:${it.baseId}` : it.rarity;
    got[k] = (got[k] ?? 0) + (it.qty ?? 1);
  };
  for (let i = 0; i < n; i++) {
    w.bag = w.bag.map(() => null);
    w.ground = [];
    w.dropLoot(m, MONSTERS[m.monsterId]);
  }
  return { got, gold: w.gold };
}
const pct = (a: number, n: number) => `${((a / n) * 100).toFixed(3)}%`;

console.log('\n== chances de drop ==');
{
  const N = 200_000;
  const cases: [string, World, Entity, number, number][] = [
    ['lobo (mob comum)', world('pavilhao', 5), mon('lobo', 4), 0.0045, 0.0055],
    ['yeti (mob comum)', world('lamina', 12), mon('yeti', 12), 0.0045, 0.0055],
    ['General Terracota (chefe)', world('tita', 10), mon('general_terracota', 10), 0.009, 0.011],
    [
      'Senhor da Névoa no Trial (chefe)',
      world('vibora', 25),
      mon('senhor_nevoa', 23, { trial: { tier: 3, xp: 0 } }),
      0.009,
      0.011,
    ],
  ];
  for (const [name, w, m, lo, hi] of cases) {
    const n = m.trial ? N / 4 : N,
      e = farm(w, m, n).got.epico ?? 0;
    ok(e / n >= lo && e / n <= hi, `${name}: ${pct(e, n)} de Épico`);
  }
  const auto = world('pavilhao', 12);
  (auto.auto as unknown as { state: string }).state = 'on';
  ok(!farm(auto, mon('yeti', 12), N).got.epico, 'auto-combate ligado: 0 Épico');
  ok(!farm(world('pavilhao', 12), mon('yeti', 12, { summoned: true }), N).got.epico, 'monstro invocado: 0 Épico');
  ok(!farm(world('pavilhao', 12), mon('lobo', 1), N).got.epico, 'monstro 11 níveis abaixo: 0 Épico');
  ok(farm(world('pavilhao', 11), mon('lobo', 1), N).got.epico! > 0, 'monstro 10 níveis abaixo: ainda dropa');
  ok(!Object.keys(BASES).some((id) => offlineDropAllowed(id, 'epico')), 'offline nunca dá Épico');
  // peças: todas as que o personagem usa (armas só da própria seita)
  const w = world('vibora', 15),
    slots: Record<string, number> = {},
    sects = new Set<string>();
  w.auto.recordDrop = (it: ItemInstance) => {
    if (it.rarity !== 'epico') return;
    slots[BASES[it.baseId].slot] = (slots[BASES[it.baseId].slot] ?? 0) + 1;
    if (BASES[it.baseId].sect) sects.add(BASES[it.baseId].sect!);
  };
  for (let i = 0; i < N; i++) {
    w.bag = w.bag.map(() => null);
    w.dropLoot(mon('yeti', 15), MONSTERS.yeti);
  }
  ok(
    Object.keys(slots).length === 6 && [...sects].join() === 'vibora',
    `peças dos 6 slots, arma só da seita (${JSON.stringify(slots)})`,
  );
}

console.log('\n== outras raridades intactas ==');
{
  // mesmo w.rng com e sem o sorteio do Épico: comum/incomum/raro, poções, materiais e ouro idênticos
  for (const [mid, lv] of [
    ['lobo', 4],
    ['yeti', 12],
    ['general_terracota', 10],
  ] as const) {
    const a = farm(world('pavilhao', lv, 7), mon(mid, lv), 50_000);
    const off = world('pavilhao', lv, 7);
    (off.auto as unknown as { state: string }).state = 'on'; // auto ligado: sem sorteio de Épico
    const b = farm(off, mon(mid, lv), 50_000);
    delete a.got.epico;
    ok(JSON.stringify(a) === JSON.stringify(b), `${mid}: drops e ouro iguais com e sem o Épico`);
  }
  const rng = new Rng(5),
    c: Record<string, number> = {};
  for (let i = 0; i < 100_000; i++) {
    const r = rollRarity(rng);
    c[r] = (c[r] ?? 0) + 1;
  }
  ok(!c.epico && RARITIES.epico.weight === 0, 'sorteio de raridade nunca dá Épico (peso 0)');
  ok(
    RARITIES.comum.weight === 75 && RARITIES.incomum.weight === 20 && RARITIES.raro.weight === 5,
    'pesos 75/20/5 mantidos',
  );
}

console.log('\n== +30% sobre o Raro da faixa e acompanha o nível ==');
{
  const bad: string[] = [];
  const pieces = CLASS_IDS.flatMap((cls) =>
    Object.keys(BASES)
      .filter((id) => BASES[id].reqLevel === 1 && (!BASES[id].sect || BASES[id].sect === cls))
      .map((id) => [cls, id] as const),
  );
  for (const [cls, id] of pieces)
    for (const plus of [0, 5, MAX_PLUS])
      for (let lv = 1; lv <= 30; lv++) {
        const ep = { ...makeEpic(id, lv), plus },
          tb = epicTierBase(ep, lv),
          e = itemStats(ep, { level: lv, classId: cls });
        // Raro da mesma peça da faixa, mesmo +N, com os 2 bônus da classe no máximo do sorteio (sem arredondar)
        const r = itemStats({ ...ep, baseId: tb, rarity: 'raro', bonuses: [] });
        const scale = 1 + 0.2 * (lv - 1);
        r[MAIN[cls]] = (r[MAIN[cls]] ?? 0) + 2 * scale;
        r[ELEM[cls]] = (r[ELEM[cls]] ?? 0) + 4 * scale;
        for (const k of new Set([...Object.keys(e), ...Object.keys(r)])) {
          const want = (r[k] ?? 0) * EPIC_MUL,
            tol = Math.abs(BASES[tb].stats[k] ?? 2) < 1 ? 0.0006 : 0.5001;
          if (Math.abs((e[k] ?? 0) - want) > tol) bad.push(`${cls} ${id} nv${lv} +${plus} ${k}: ${e[k]} vs ${want}`);
        }
        if (BASES[tb].reqLevel > lv || BASES[tb].slot !== BASES[id].slot) bad.push(`${id} nv${lv}: faixa ${tb}`);
      }
  ok(
    !bad.length,
    `épico = 1,3 × Raro da faixa (arredondado), 4 classes × slots × nv 1–30 × +0/+5/+10 ${bad.slice(0, 5).join('; ')}`,
  );
  const tiers = [1, 5, 10, 15, 20, 25].map((lv) => epicTierBase(makeEpic('colar_jade', 1), lv));
  ok(new Set(tiers).size === 6, `peça muda nos níveis 5, 10, 15, 20 e 25 (${tiers.join(', ')})`);
  // stat que a peça nova tem nunca cai; stat que a base nova troca por outro (dados das bases, igual no Raro) só avisa
  const down: string[] = [],
    swapped = new Set<string>();
  for (const [cls, id] of pieces)
    for (let lv = 1; lv < 30; lv++) {
      const a = itemStats(makeEpic(id, 1), { level: lv, classId: cls }),
        b = itemStats(makeEpic(id, 1), { level: lv + 1, classId: cls });
      for (const k of Object.keys(a))
        if (!(k in b)) swapped.add(`${epicTierBase(makeEpic(id, 1), lv)} ${k} nv${lv}→${lv + 1}`);
        else if (b[k] < a[k]) down.push(`${id} ${k} nv${lv}→${lv + 1}`);
    }
  ok(!down.length, `nenhum stat da peça cai ao subir de nível ${down.slice(0, 5).join('; ')}`);
  if (swapped.size) console.log('  aviso: stats trocados pela base da faixa seguinte:', [...swapped].join('; '));
  // no jogo: subir de nível recalcula o personagem
  const w = world('pavilhao', 9);
  w.equipment.colar = makeEpic('colar_jade', 9);
  const recalc = () => (w as unknown as { recalc: (e: Entity, k: boolean) => void }).recalc(w.player, false);
  recalc();
  const before = w.player.derived.maxMana;
  w.player.level = 10;
  recalc();
  ok(w.player.derived.maxMana > before, `personagem nv 9→10: mana máxima ${before}→${w.player.derived.maxMana}`);
}

console.log('\n== bônus por classe ==');
{
  for (const cls of CLASS_IDS) {
    const b = epicBonuses({ level: 22, classId: cls }).map((x) => x.stat);
    ok(b.join() === `${MAIN[cls]},${ELEM[cls]}`, `${CLASSES[cls].name}: ${b.join(' + ')}`);
  }
  const it = makeEpic('colar_jade', 20),
    g = itemStats(it, { level: 20, classId: 'pavilhao' }),
    t = itemStats(it, { level: 20, classId: 'lamina' });
  ok(
    !!g.intelligence && !!g.elem_ice && !!t.strength && !!t.elem_thunder && !t.elem_ice,
    'bônus seguem a classe de quem usa',
  );
}

console.log('\n== forja, venda e desmonte ==');
{
  const w = world('tita', 22),
    e = makeEpic('bastao_ferro', 22);
  w.bag[0] = e;
  w.gold = 1e9;
  for (let i = 0; i < 25; i++) w.addItem(makePotion('minerio_ferro', 99));
  w.addItem(makePotion('jade_nevoa', 99));
  w.addItem(makePotion('essencia_qi', 99));
  for (let p = 0; p < MAX_PLUS; p++) {
    const ec = F.upgradeCost({ ...e, plus: p }, w.owner())!,
      rc = F.upgradeCost({ ...e, plus: p, baseId: epicTierBase(e, 22), rarity: 'raro' })!;
    if (ec.gold !== 2 * rc.gold || JSON.stringify(ec.mats) !== JSON.stringify(rc.mats) || ec.chance !== rc.chance)
      ok(false, `custo +${p}: ${JSON.stringify(ec)} vs Raro ${JSON.stringify(rc)}`);
  }
  ok(true, 'melhorar: ouro 2× o do Raro da faixa, mesmos materiais e chance (+0 a +9)');
  for (let i = 0; i < 1000 && (e.plus ?? 0) < MAX_PLUS; i++) F.upgrade(w, e, true);
  ok(
    e.plus === MAX_PLUS && F.upgradeCost(e, w.owner()) === null && F.upgrade(w, e, true)?.code === 'cannotForge',
    'para em +10',
  );
  ok(
    F.raiseRarity(w, e, true)?.code === 'cannotForge' && F.reroll(w, e, true)?.code === 'cannotForge',
    'sem subir raridade nem trocar bônus',
  );
  ok(F.salvage(w, 0, true)?.code === 'epicLocked' && w.bag[0] === e, 'não desmonta');
  (w as unknown as { npcRole: () => string }).npcRole = () => 'vendedor';
  const gold = w.gold;
  ok(
    w.sell(0)?.code === 'epicLocked' && w.sellRaw(0) === 0 && w.gold === gold && w.bag[0] === e,
    'não vende (nem pelo auto)',
  );
}

console.log('\n== equipar ==');
{
  const w = world('pavilhao', 3);
  ok(w.canEquip(makeEpic('colar_nevoa', 3)) === null, 'sem trava de nível');
  ok(w.canEquip(makeEpic('espadas_ferro', 3))?.code === 'sectOnly', 'arma de outra seita recusada');
  ok(
    w.canEquip({ ...makeEpic('colar_nevoa', 3), rarity: 'raro' })?.code === 'needLevel',
    'Raro continua com trava de nível',
  );
}

console.log('\n== save ==');
{
  // save antigo (sem Épico): carregar e salvar não muda nada
  const old: SaveData = {
    version: 1,
    name: 'Antigo',
    classId: 'lamina',
    level: 12,
    xp: 100,
    freePoints: 2,
    attributes: { strength: 20, intelligence: 3, stamina: 19, agility: 5, willpower: 3 },
    mapId: 'cidade',
    lastSeen: 0,
    gold: 777,
    bag: [
      {
        uid: 'a',
        baseId: 'manto_yeti',
        rarity: 'raro',
        bonuses: [
          { stat: 'strength', value: 5 },
          { stat: 'maxHp', value: 40 },
        ],
        ilvl: 12,
        durability: 80,
        plus: 4,
      },
      {
        uid: 'b',
        baseId: 'colar_jade',
        rarity: 'incomum',
        bonuses: [{ stat: 'hit', value: 9 }],
        ilvl: 3,
        durability: 100,
      },
      { uid: 'c', baseId: 'pocao_hp_p', rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty: 12 },
      { uid: 'd', baseId: 'minerio_ferro', rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty: 30 },
    ],
    equipment: {
      arma: { uid: 'e', baseId: 'espadas_trovao_nevado', rarity: 'comum', bonuses: [], ilvl: 10, durability: 55 },
    },
  } as unknown as SaveData;
  const pick = (s: SaveData) =>
    JSON.stringify({ b: s.bag, e: s.equipment, g: s.gold, l: s.level, a: s.attributes, x: s.xp });
  const s1 = World.fromSave(maps, old, 0, false).serialize();
  ok(
    pick(World.fromSave(maps, s1, 0, false).serialize()) === pick(s1),
    'save antigo: carregar e salvar de novo é estável',
  );
  ok(
    (old.bag as ItemInstance[]).every((it) => JSON.stringify(sanitizeItem(it)) === JSON.stringify(it)),
    'itens antigos saneados sem mudança',
  );
  const w = world('pavilhao', 15);
  w.bag[0] = { ...makeEpic('botas_pico', 15), plus: 7, durability: 63 };
  const w2 = World.fromSave(maps, JSON.parse(JSON.stringify(w.serialize())), 0, false);
  const b = w2.bag.find((x) => x?.rarity === 'epico');
  ok(!!b && b.baseId === 'botas_pico' && b.plus === 7 && b.durability === 63, 'Épico +7 sobrevive a salvar e carregar');
  ok(sanitizeItem({ ...b, rarity: 'xx' })?.rarity === 'comum', 'raridade desconhecida continua virando Comum');
  console.log('  save antigo serializado:', pick(s1).length, 'caracteres');
  if (process.argv.includes('--dump')) console.log(pick(s1));
}

console.log(fails ? `\n${fails} problema(s)` : '\nepic-check: tudo ok');
process.exit(fails ? 1 : 0);
