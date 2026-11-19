// Verificação do roadmap M0 (fundação técnica): relógio injetável, uid de itens, idioma por parâmetro e registro
// econômico. Uso: npm run check:m0
import { readFileSync } from 'node:fs';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { Rng } from '../src/core/rng';
import { World } from '../src/core/world';
import { ManualClock, fixedClock } from '../src/core/clock';
import { createUidSource, newUid, setUidSource } from '../src/core/uid';
import { initLang, LANG } from '../src/core/i18n';
import { CLASSES } from '../src/core/data';
import { makeEquipment, makeStack, POTIONS } from '../src/core/items';
import { merchantPeriod } from '../src/core/world/merchant';
import { LEDGER_MAX, sumLedger } from '../src/core/world/ledger';
import type { ItemInstance, SaveData } from '../src/core/types';

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
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const priv = (w: World) => w as unknown as { rng: Rng };
const save = (extra: Partial<SaveData> = {}): SaveData => {
  const c = CLASSES.lamina,
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * 7;
  attrs.stamina += 300;
  return {
    version: 1,
    name: 'M0',
    classId: 'lamina',
    level: 8,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId: 'floresta',
    lastSeen: NOW,
    gold: 50_000,
    ...extra,
  };
};

console.log('\n== relógio injetável (E1a) ==');
{
  const clock = new ManualClock(NOW);
  const w = World.fromSave(maps, save(), undefined, false, clock);
  ok(w.clock === clock, 'fromSave usa o relógio injetado');
  ok(w.serialize().lastSeen === NOW, 'lastSeen do save vem do relógio injetado');
  const p0 = w.merchantStock().period;
  ok(p0 === merchantPeriod(NOW), 'estoque do mercador usa o relógio injetado');
  clock.advance(24 * HOUR);
  ok(w.merchantStock().period !== p0, 'avançar o relógio renova o estoque do mercador');
  ok(w.serialize().lastSeen === NOW + 24 * HOUR, 'lastSeen acompanha o relógio');
  const a = World.fromSave(maps, save(), NOW, false, fixedClock(NOW));
  const b = World.fromSave(maps, save(), NOW, false, fixedClock(NOW));
  ok(a.rng.next() === b.rng.next(), 'mesmo instante de carga = mesmo sorteio (o servidor reproduz)');
}

console.log('\n== uid de itens ==');
{
  const clock = new ManualClock(NOW);
  setUidSource(createUidSource({ clock, prefix: 'abc12345', seed: 1 }));
  const u1 = newUid(),
    u2 = newUid();
  ok(/^abc12345-[0-9a-z]+-0-[0-9a-z]+$/.test(u1), `formato prefixo-ms-contador-aleatório (${u1})`);
  ok(u1 !== u2, 'dois uids seguidos são diferentes');
  ok(u1.split('-')[1] === NOW.toString(36), 'a parte de tempo vem do Clock');
  setUidSource(createUidSource({ clock, prefix: 'abc12345', seed: 1 }));
  ok(newUid() === u1, 'mesmo relógio, prefixo e semente = mesmo uid (servidor determinístico)');
  setUidSource(createUidSource({ clock, prefix: 'outroaparelho', seed: 1 }));
  ok(newUid() !== u1, 'outro aparelho no mesmo instante = outro uid');
  const seen = new Set<string>();
  setUidSource(createUidSource({ clock, prefix: 'x', seed: 9 }));
  for (let i = 0; i < 20_000; i++) seen.add(newUid());
  ok(seen.size === 20_000, '20 mil uids no mesmo milissegundo, sem repetição');
  // gerar uid não mexe no sorteio do jogo
  const r1 = new Rng(5),
    r2 = new Rng(5);
  const e1 = makeEquipment('colar_jade', 'raro', null, r1, 5);
  setUidSource(createUidSource({ clock, prefix: 'y', seed: 77 }));
  const e2 = makeEquipment('colar_jade', 'raro', null, r2, 5);
  ok(JSON.stringify(e1.bonuses) === JSON.stringify(e2.bonuses), 'trocar o gerador de uid não muda os bônus sorteados');
  setUidSource(createUidSource({ prefix: 'test' }));
}

console.log('\n== idioma por parâmetro (E1b) ==');
{
  ok(LANG === 'pt', 'sem initLang, o core fica em português (servidor e testes)');
  initLang('pt');
  ok(true, 'initLang com o mesmo idioma depois dos dados carregados é aceito');
  let threw = false;
  try {
    initLang('en');
  } catch {
    threw = true;
  }
  ok(threw && LANG === 'pt', 'initLang para outro idioma depois de traduzir os dados dá erro (não mistura idiomas)');
}

console.log('\n== registro econômico (E1d) ==');
// conta itens por baseId: mochila + equipamento + chão (as poções ficam de fora: beber não entra no registro)
const countItems = (w: World) => {
  const c: Record<string, number> = {};
  const add = (it: ItemInstance | null | undefined) => {
    if (!it || POTIONS[it.baseId]) return;
    c[it.baseId] = (c[it.baseId] ?? 0) + (it.qty ?? 1);
  };
  w.bag.forEach(add);
  Object.values(w.equipment).forEach(add);
  w.ground.forEach((g) => add(g.item));
  return c;
};
const sameItems = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !POTIONS[k]));
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0));
};
{
  const clock = new ManualClock(NOW);
  const w = World.fromSave(maps, save(), NOW, false, clock);
  priv(w).rng = new Rng(11);
  w.drainLedger();
  const gold0 = w.gold,
    items0 = countItems(w);
  w.auto.toggle();
  let xpGained = 0;
  const orig = w.gainXp.bind(w);
  w.gainXp = (n: number) => {
    xpGained += n;
    orig(n);
  };
  for (let i = 0; i < 60 * 60 * 8; i++) {
    w.tick(1 / 60);
    clock.advance(1000 / 60);
  }
  const { entries, dropped } = w.drainLedger();
  const sum = sumLedger(entries);
  const items1 = countItems(w);
  const delta: Record<string, number> = {};
  for (const k of new Set([...Object.keys(items0), ...Object.keys(items1)]))
    delta[k] = (items1[k] ?? 0) - (items0[k] ?? 0);
  const kills = entries.filter((e) => e.src === 'kill').length;
  ok(kills > 10, `8 min de auto-combate: ${kills} abates anotados`);
  ok(dropped === 0, 'nada descartado pelo limite');
  ok(sum.gold === w.gold - gold0, `ouro do registro = diferença do ouro (${sum.gold})`);
  ok(sum.xp === xpGained, `XP do registro = XP ganho (${sum.xp})`);
  ok(sameItems(sum.items, delta), 'itens do registro = diferença de itens (sem poções)');
  ok(
    entries.every((e) => e.t >= NOW && e.t <= clock.now()),
    'horário das entradas vem do relógio do World',
  );
}
{
  // forja, compra e venda
  const clock = new ManualClock(NOW);
  const w = World.fromSave(maps, save({ mapId: 'cidade' }), NOW, false, clock);
  priv(w).rng = new Rng(3);
  w.addItem(makeStack('minerio_ferro', 60));
  w.addItem(makeStack('cristal_gelo', 30));
  w.addItem(makeStack('essencia_qi', 30));
  const eq = makeEquipment('colar_jade', 'incomum', null, priv(w).rng, 5);
  w.addItem(eq);
  const junk = makeEquipment('tunica_algodao', 'incomum', null, priv(w).rng, 5);
  w.addItem(junk);
  w.drainLedger();
  const gold0 = w.gold,
    items0 = countItems(w);
  for (let i = 0; i < 4; i++) w.forgeUpgrade(eq, true);
  w.forgeRarity(eq, true);
  w.forgeReroll(eq, true);
  w.merchantBuy(0, true);
  w.merchantBuyGoods('pergaminho_retorno', 2, true);
  w.purchase('pocao_hp_p', 3);
  const idx = w.bag.findIndex((b) => b?.baseId === 'colar_jade');
  w.sellRaw(idx, 1);
  w.forgeSalvage(w.bag.indexOf(junk), true);
  const { entries } = w.drainLedger();
  const sum = sumLedger(entries);
  const items1 = countItems(w);
  const delta: Record<string, number> = {};
  for (const k of new Set([...Object.keys(items0), ...Object.keys(items1)]))
    delta[k] = (items1[k] ?? 0) - (items0[k] ?? 0);
  const srcs = new Set(entries.map((e) => e.src));
  ok(
    ['forge', 'merchant', 'shop', 'sell'].every((s) => srcs.has(s as never)),
    `fontes anotadas: ${[...srcs].join(', ')}`,
  );
  ok(sum.gold === w.gold - gold0, `ouro do registro = diferença do ouro (${sum.gold})`);
  ok(sameItems(sum.items, delta), 'itens do registro = diferença de itens (forja, mercador, venda)');
  ok(
    entries.filter((e) => e.src === 'forge' && e.ref?.startsWith('upgrade')).length === 4,
    'cada tentativa de melhoria é anotada (com o ouro cobrado mesmo na falha)',
  );
}
{
  const w = World.fromSave(maps, save(), NOW, false, fixedClock(NOW));
  for (let i = 0; i < LEDGER_MAX + 25; i++) w.econ({ src: 'loot', gold: 1 });
  const d = w.drainLedger();
  ok(
    d.entries.length === LEDGER_MAX && d.dropped === 25,
    'limite do registro: guarda as últimas e conta as descartadas',
  );
  ok(w.drainLedger().entries.length === 0, 'drainLedger limpa o registro');
  ok(!('ledger' in w.serialize()), 'o registro não vai no save');
}
{
  // ganho offline: uma entrada com tudo
  const s = save({
    lastSeen: NOW - 3 * HOUR,
    auto: {
      active: true,
      mapId: 'floresta',
      buckets: [
        {
          sec: 600,
          kills: 50,
          xp: 2000,
          gold: 500,
          potHp: 2,
          potMp: 0,
          levelSum: 400,
          drops: { 'colar_jade|incomum': 2, 'minerio_ferro|comum': 3 },
        },
      ],
    },
  });
  const w = World.fromSave(maps, s, NOW, true, fixedClock(NOW));
  const off = w.ledger.filter((e) => e.src === 'offline');
  ok(off.length === 1 && off[0].xp === w.offlineReport?.xp, 'ganho offline anotado numa entrada com o XP do resumo');
  ok(off[0]?.gold === w.offlineReport?.gold, 'ganho offline: ouro do resumo');
}

console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
