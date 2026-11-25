// Verificação headless dos bots de combate (base da masmorra em equipe e da arena): montagem (nível, equipamento
// incomum + até 1 raro, +0, sem gemas, poções pequenas), sorteio de classes, IA (segue o líder, usa skills e poções)
// e lutas simuladas que não travam. Uso: npm run check:bots
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS, SECT_ORDER } from '../src/core/data';
import { DUNGEONS } from '../src/core/dungeons';
import { MAP_IDS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import { Rng } from '../src/core/rng';
import {
  BOT_POTIONS,
  botActives,
  botLevelFor,
  botThink,
  makeBot,
  pickBotClasses,
  simulateFight,
  type SimUnit,
} from '../src/core/bots';
import { POTIONS } from '../src/core/items';
import type { Entity } from '../src/core/types';

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
const sane = (e: Entity) =>
  Object.values(e.derived).every((v) => Number.isFinite(v)) && Number.isFinite(e.hp) && Number.isFinite(e.mana);

console.log('\n== montagem ==');
{
  const rng = new Rng(7);
  for (const cls of SECT_ORDER)
    for (const lv of [5, 13, 18, 21]) {
      const b = makeBot(cls, lv, 'ally', rng);
      const items = Object.values(b.gear);
      ok(
        items.length === 6 &&
          items.every((it) => ['incomum', 'raro'].includes(it!.rarity) && !it!.plus && !it!.gems?.some(Boolean)) &&
          items.filter((it) => it!.rarity === 'raro').length <= 1,
        `${cls} nv ${lv}: 6 peças incomuns (até 1 rara), +0, sem gemas`,
      );
      ok(
        sane(b.e) && b.e.hp === b.e.derived.maxHp && b.e.level === lv && b.e.kind === 'bot',
        `${cls} nv ${lv}: números válidos`,
      );
    }
  ok(
    POTIONS[BOT_POTIONS.hp].kind === 'hp' && POTIONS[BOT_POTIONS.mp].kind === 'mp' && /_p$/.test(BOT_POTIONS.hp),
    'só poções pequenas',
  );
  const r = pickBotClasses('lamina', 3, rng);
  ok(r.length === 3 && !r.includes('lamina') && new Set(r).size === 3, `3 classes sorteadas sem a do jogador: ${r}`);
  ok(botLevelFor([11, 15], 30) === 13 && botLevelFor([16, 20], 16) === 16, 'nível: meio da faixa, até o do jogador');
}

console.log('\n== IA ==');
{
  const rng = new Rng(3);
  const b = makeBot('tita', 13, 'ally', rng, 1);
  const leader = makeBot('lamina', 13, 'ally', rng).e;
  leader.x = 10;
  b.e.x = 0;
  ok(
    botThink(b, { leader, leaderTargetId: null, enemies: [], allies: [leader] }).kind === 'move',
    'sem luta: segue o líder',
  );
  const m = makeBot('vibora', 13, 'enemy', rng).e;
  m.x = 11;
  const a = botThink(b, { leader, leaderTargetId: m.id, enemies: [m], allies: [leader] });
  ok(a.kind === 'move' || a.kind === 'skill', 'ajuda no alvo do líder');
  b.e.hp = b.e.derived.maxHp * 0.2;
  const p = botThink(b, { leader, leaderTargetId: m.id, enemies: [m], allies: [leader] });
  ok(p.kind === 'potion' && p.potion === 'hp', 'vida baixa: bebe poção de vida');
  b.potions.hp = 0;
  ok(
    botThink(b, { leader, leaderTargetId: m.id, enemies: [m], allies: [leader] }).kind !== 'potion',
    'sem estoque: não bebe',
  );
}

/** Monstros reais da masmorra (como o World os cria), longe do grupo. */
function dungeonMonsters(dId: string): Entity[] {
  const d = DUNGEONS.find((x) => x.id === dId)!;
  const w = World.fromSave(
    maps,
    {
      version: 1,
      name: 'T',
      classId: 'lamina',
      level: 30,
      xp: 0,
      freePoints: 0,
      attributes: { strength: 30, intelligence: 5, stamina: 50, agility: 20, willpower: 5 },
      mapId: 'cidade',
      gold: 99999,
      lastSeen: NOW,
    } as never,
    NOW,
    false,
  );
  w.enterDungeon(d.id);
  return w.monsters.filter((m) => !m.dead);
}
const fresh = (m: Entity, x: number): Entity => ({
  ...m,
  x,
  y: 0,
  hp: m.derived.maxHp,
  dead: false,
  buffs: [],
  attackCd: 0,
});

console.log('\n== lutas simuladas ==');
for (const d of DUNGEONS) {
  const mons = dungeonMonsters(d.id);
  const commons = mons.filter((m) => !MONSTERS[m.monsterId]?.boss);
  const boss = mons.find((m) => MONSTERS[m.monsterId]?.boss)!;
  const lv = botLevelFor(d.levels, 99);
  let wins = 0,
    stalls = 0,
    potions = 0;
  const used = new Set<string>();
  for (let seed = 1; seed <= 12; seed++) {
    const rng = new Rng(seed * 101);
    const team = [SECT_ORDER[seed % 4], ...pickBotClasses(SECT_ORDER[seed % 4], 3, rng)].map((c, i) =>
      makeBot(c, lv, 'ally', rng, i),
    );
    const units: SimUnit[] = team.map((b, i) => {
      b.e.x = -i * 0.5;
      return { e: b.e, bot: b, team: 'ally' };
    });
    for (let i = 0; i < 3; i++) units.push({ e: fresh(commons[(seed + i) % commons.length], 6 + i), team: 'enemy' });
    const st = simulateFight(units, rng, { leaderId: team[0].e.id });
    if (st.winner === 'ally') wins++;
    if (!st.winner) stalls++;
    potions += st.potions;
    for (const id of Object.keys(st.skillsUsed)) used.add(id);
    if (!units.every((u) => sane(u.e))) ok(false, `${d.id} seed ${seed}: número inválido`);
  }
  ok(stalls === 0, `${d.id} nv ${lv}: nenhuma luta travou (12 lutas, 4 bots x 3 monstros)`);
  ok(wins >= 9, `${d.id}: equipe de bots vence monstros comuns (${wins}/12)`);
  // cada classe sozinha contra o chefe (vida normal): luta longa, usa o kit inteiro e precisa de poção
  for (const c of SECT_ORDER) {
    const rng = new Rng(4);
    const b = makeBot(c, lv, 'ally', rng);
    const st = simulateFight(
      [
        { e: b.e, bot: b, team: 'ally' },
        { e: fresh(boss, 6), team: 'enemy' },
      ],
      rng,
      { maxSeconds: 600 },
    );
    if (!st.winner) stalls++;
    potions += st.potions;
    for (const id of Object.keys(st.skillsUsed)) used.add(id);
  }
  ok(stalls === 0, `${d.id}: cada classe sozinha contra o chefe termina a luta`);
  const all = SECT_ORDER.flatMap((c) => botActives(makeBot(c, lv, 'ally', new Rng(1))).map((s) => s.id));
  const missing = all.filter((s) => !used.has(s));
  ok(missing.length === 0, `${d.id}: bots usam as skills (faltam ${missing.length}: ${missing.join(', ') || '-'})`);
  ok(potions > 0, `${d.id}: bots bebem poção quando apanham (${potions})`);
}

console.log('\n== arena (bot x bot) ==');
{
  let stalls = 0,
    n = 0;
  for (const a of SECT_ORDER)
    for (const b of SECT_ORDER) {
      if (a === b) continue;
      const rng = new Rng(n + 5);
      const A = makeBot(a, 20, 'ally', rng),
        B = makeBot(b, 20, 'enemy', rng);
      B.e.x = 8;
      const st = simulateFight(
        [
          { e: A.e, bot: A, team: 'ally' },
          { e: B.e, bot: B, team: 'enemy' },
        ],
        rng,
      );
      n++;
      if (!st.winner) stalls++;
    }
  ok(stalls === 0, `${n} duelos entre classes terminam (sem empate eterno)`);
  ok(Object.keys(CLASSES).length >= 4, 'há classes para sortear');
}

if (fails) {
  console.error(`\nbots-check: ${fails} falha(s)`);
  process.exit(1);
}
console.log('\nbots-check: tudo ok');
