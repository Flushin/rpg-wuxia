// Verificação headless do marco 5: monstros novos, chefe, vários personagens (não vai para o build do jogo).
// Uso: npm run check:m5
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS, PROGRESSION } from '../src/core/data';
import { rollAttack } from '../src/core/combat';
import { BASES } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { findPath } from '../src/core/pathfinding';
import { Rng } from '../src/core/rng';
import { SLOT_COUNT, deleteSlot, emptySaveFile, migrateSaves, relativeTime, setSlot } from '../src/core/saves';
import { CHARACTER_MIGRATIONS, CHARACTER_SAVE_VERSION, migrateCharacter } from '../src/core/saveFormat';
import { computeDerived } from '../src/core/stats';
import { World } from '../src/core/world';
import type { AutoBucket, Entity, GameEvent, SaveData } from '../src/core/types';
import { fixedClock } from '../src/core/clock';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta', 'ruinas'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const priv = (w: World) =>
  w as unknown as {
    rng: Rng;
    killMonster: (m: Entity) => void;
    recalc: (e: Entity, k: boolean) => void;
    aggro: (m: Entity) => void;
  };
const HOUR = 3.6e6,
  NOW = 1_800_000_000_000;

function mk(
  classId = 'lamina',
  level = 10,
  mapId = 'floresta',
  extra: Partial<SaveData> = {},
  now = NOW,
  offline = false,
): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  attrs.stamina += 400; // sobrevive aos testes
  const s: SaveData = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId,
    lastSeen: now - 6 * HOUR,
    ...extra,
  };
  const w = World.fromSave(maps, s, now, offline);
  priv(w).rng = new Rng(7);
  w.events.length = 0;
  return w;
}
const run = (w: World, s: number, until?: () => boolean) => {
  for (let i = 0; i < s * 60; i++) {
    w.tick(1 / 60);
    if (until && until()) return true;
  }
  return until ? until() : false;
};
const drain = (w: World) => w.events.splice(0);
const boss = (w: World) => w.monsters.find((m) => !!MONSTERS[m.monsterId].boss)!;
const frozen = (w: World) => {
  for (const m of w.monsters)
    if (!MONSTERS[m.monsterId].boss) {
      m.moveSpeed = 0;
      m.attackCd = 1e9;
    }
};

console.log('\n== monstros novos ==');
{
  for (const id of ['bandido_espadachim', 'bandido_arqueiro', 'guerreiro_terracota', 'general_terracota']) {
    const d = MONSTERS[id];
    ok(
      !!d && d.minLevel <= d.maxLevel && d.xpBase > 0 && d.baseAttributes.stamina > 0 && !!d.sprite,
      `${id} existe com stats (nv ${d?.minLevel}-${d?.maxLevel})`,
    );
  }
  ok(
    MONSTERS.bandido_espadachim.minLevel === 4 &&
      MONSTERS.bandido_espadachim.maxLevel === 6 &&
      MONSTERS.bandido_arqueiro.minLevel === 4,
    'bandidos nv 4-6',
  );
  ok(MONSTERS.guerreiro_terracota.minLevel === 7 && MONSTERS.guerreiro_terracota.maxLevel === 9, 'terracota nv 7-9');
  ok(
    MONSTERS.general_terracota.minLevel === 10 &&
      MONSTERS.general_terracota.respawnSeconds === 600 &&
      (MONSTERS.general_terracota.scale ?? 1) > 1.4,
    'general nv 10, respawn 600 s, sprite grande',
  );
  const fl = maps.floresta,
    ru = maps.ruinas;
  const names = (m: GameMap) => m.objects.filter((o) => o.type === 'monsterSpawn').map((o) => String(o.props.monster));
  ok(
    names(fl).includes('lobo') && names(fl).includes('bandido_espadachim') && names(fl).includes('bandido_arqueiro'),
    'floresta tem lobos e bandidos',
  );
  const wolfD = Math.max(
    ...fl.objects.filter((o) => o.props.monster === 'lobo').map((o) => Math.hypot(o.x - 4, o.y - 16)),
  );
  const banD = Math.min(
    ...fl.objects
      .filter((o) => String(o.props.monster).startsWith('bandido'))
      .map((o) => Math.hypot(o.x - 4, o.y - 16)),
  );
  ok(
    banD > 14 && wolfD < banD + 4,
    `lobos perto da entrada (até ${wolfD.toFixed(0)}), bandidos mais fundo (a partir de ${banD.toFixed(0)})`,
  );
  ok(
    names(ru).includes('guerreiro_terracota') && names(ru).includes('general_terracota'),
    'ruínas têm guerreiros e o general',
  );
  const toRuinas = fl.objects.find((o) => o.type === 'portal' && o.props.target === 'ruinas'),
    back = ru.objects.find((o) => o.type === 'portal' && o.props.target === 'floresta');
  ok(!!toRuinas && !!back, 'portal floresta → ruínas e de volta');
  const reach = (m: GameMap, from: { x: number; y: number }, o: { x: number; y: number; w: number; h: number }) =>
    findPath(m, from, { x: o.x + o.w / 2, y: o.y + o.h / 2 }).length > 0;
  ok(reach(fl, { x: 5.5, y: 16.5 }, toRuinas!) && reach(ru, { x: 4.5, y: 16.5 }, back!), 'portais alcançáveis a pé');
  const bs = ru.objects.find((o) => o.props.monster === 'general_terracota')!;
  ok(findPath(ru, { x: 4.5, y: 16.5 }, { x: bs.x, y: bs.y }).length > 0, 'arena do general alcançável');
  const groups = new Map<number, number>();
  for (const o of fl.objects)
    if (String(o.props.monster).startsWith('bandido'))
      groups.set(Number(o.props.group), (groups.get(Number(o.props.group)) ?? 0) + 1);
  ok(
    [...groups.values()].every((n) => n >= 2 && n <= 4),
    `bandidos em grupos de 2-4 (${[...groups.values()].join(',')}); espadachins 2-3 por grupo`,
  );
  const w = mk('lamina', 5, 'floresta');
  const sw = w.monsters.find((m) => m.monsterId === 'bandido_espadachim')!;
  ok(sw.group > 0 && sw.level >= 4 && sw.level <= 6 && sw.derived.maxHp > 0, 'espadachim nasce em grupo com nível 4-6');
}

console.log('\n== arqueiro mantém distância ==');
{
  const w = mk('lamina', 10, 'floresta');
  const a = w.monsters.find((m) => m.monsterId === 'bandido_arqueiro')!;
  for (const m of w.monsters)
    if (m !== a && m.group === a.group) {
      m.dead = true;
      m.respawnAt = 1e9;
    }
  const p = w.player;
  p.x = a.x + 1.2;
  p.y = a.y;
  p.path = [];
  p.derived.maxHp = 1e6;
  p.hp = 1e6; // não morre durante o teste
  priv(w).aggro(a);
  const evs: GameEvent[] = [];
  let minD = 99,
    maxD = 0;
  for (let i = 0; i < 60 * 8; i++) {
    w.tick(1 / 60);
    p.hp = 1e6;
    evs.push(...drain(w));
    if (i > 60 * 3) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      minD = Math.min(minD, d);
      maxD = Math.max(maxD, d);
    }
  }
  ok(
    minD >= MONSTERS.bandido_arqueiro.keepDistance! - 0.8,
    `recua e mantém distância (mín ${minD.toFixed(1)} ≥ ~${MONSTERS.bandido_arqueiro.keepDistance})`,
  );
  ok(
    maxD <= MONSTERS.bandido_arqueiro.attackRange + 0.5,
    `fica no alcance de tiro (máx ${maxD.toFixed(1)} ≤ ${MONSTERS.bandido_arqueiro.attackRange})`,
  );
  ok(MONSTERS.bandido_arqueiro.attackRange >= 5.5 && MONSTERS.bandido_arqueiro.attackRange <= 7, 'alcance ~6 tiles');
  ok(
    evs.some((e) => e.type === 'projectile' && e.kind === 'arrow'),
    'dispara flecha (evento projectile)',
  );
  ok(
    evs.some((e) => e.type === 'hit' && e.targetKind === 'player'),
    'flecha causa dano',
  );
}

console.log('\n== aggro em grupo ==');
{
  const w = mk('lamina', 10, 'floresta');
  const ref = w.monsters.find((m) => m.monsterId === 'bandido_espadachim')!;
  const mates = w.monsters.filter((m) => m.group === ref.group && m !== ref && !m.dead);
  const others = w.monsters.filter((m) => m.group !== ref.group && MONSTERS[m.monsterId].groupAggro);
  ok(mates.length >= 1, `grupo tem ${mates.length + 1} integrantes`);
  w.player.x = ref.x + 3;
  w.player.y = ref.y;
  w.player.path = [];
  w.player.derived.maxHp = 1e6;
  w.player.hp = 1e6;
  run(w, 0.2);
  ok(ref.ai === 'chase', 'quem viu o jogador entra em combate');
  ok(
    mates.every((m) => m.ai === 'chase'),
    'o resto do grupo entra junto',
  );
  ok(
    others.every((m) => m.ai !== 'chase'),
    'outros grupos não são afetados',
  );
}

console.log('\n== guerreiro de terracota: defesa ==');
{
  const w = mk('lamina', 10, 'ruinas');
  const t = w.monsters.find((m) => m.monsterId === 'guerreiro_terracota')!;
  const base = computeDerived(t.attrs),
    def = MONSTERS.guerreiro_terracota;
  ok(
    Math.abs(t.derived.physDef - base.physDef * def.defMul!.phys) < 1e-6 &&
      Math.abs(t.derived.spiritDef - base.spiritDef * def.defMul!.spirit) < 1e-6,
    `defesa física ×${def.defMul!.phys} e espiritual ×${def.defMul!.spirit} sobre o derivado normal`,
  );
  ok(t.derived.physDef > 40 && t.derived.spiritDef < t.derived.physDef / 3, 'muita defesa física, pouca espiritual');
  const rng = new Rng(5),
    avg = (dt: 'physical' | 'spiritual') => {
      const att = {
        derived: {
          ...computeDerived({ strength: 30, intelligence: 30, stamina: 1, agility: 20, willpower: 1 }),
          hit: 1000,
          critChance: 0,
        },
        damageType: dt,
        element: null,
        elemAtk: { fire: 0, ice: 0, thunder: 0, poison: 0 },
        elemRes: { fire: 0, ice: 0, thunder: 0, poison: 0 },
      };
      let s = 0;
      for (let i = 0; i < 400; i++) s += rollAttack(att, t, rng).amount;
      return s / 400;
    };
  const ph = avg('physical'),
    sp = avg('spiritual');
  ok(sp > ph * 1.3, `mesmo ataque: espiritual (${sp.toFixed(1)}) causa bem mais dano que físico (${ph.toFixed(1)})`);
  ok(t.moveSpeed < MONSTERS.lobo.moveSpeed && t.moveSpeed < 3, `lento (${t.moveSpeed})`);
}

// chefe isolado: sem melee, só o golpe em área
function bossSetup(classId = 'lamina') {
  const w = mk(classId, 10, 'ruinas');
  const b = boss(w);
  frozen(w);
  b.attackInterval = 1e9;
  b.attackCd = 1e9;
  w.player.x = b.x - 3;
  w.player.y = b.y;
  w.player.path = [];
  w.player.derived.maxHp = 5000;
  w.player.hp = 5000;
  return { w, b };
}

console.log('\n== chefe: golpe em área telegrafado ==');
{
  const { w, b } = bossSetup();
  const p = w.player,
    ar = MONSTERS.general_terracota.boss!.aoe;
  ok(
    w.arenas.length === 1 && w.arenas[0].r === MONSTERS.general_terracota.boss!.arenaRadius,
    'arena registrada no mapa',
  );
  let ev: Extract<GameEvent, { type: 'telegraph' }> | undefined;
  run(w, 8, () => {
    ev = drain(w).find((e) => e.type === 'telegraph') as typeof ev;
    return !!ev;
  });
  ok(
    !!ev && ev.radius === 2.5 && ev.delay === 1.5,
    `círculo de raio ${ev?.radius} aparece com ${ev?.delay} s de aviso`,
  );
  ok(!!ev && Math.hypot(ev.x - p.x, ev.y - p.y) < 0.01, 'o círculo nasce na posição do jogador');
  ok(w.telegraphs.length === 1 && w.telegraphs[0].remaining > 1.4, 'telegrafo ativo (a UI preenche o círculo)');
  run(w, 1.0);
  ok(p.hp === 5000 && w.telegraphs.length === 1, 'antes do impacto não há dano');
  const hpBefore = p.hp;
  run(w, 0.6);
  const evs = drain(w);
  ok(
    evs.some((e) => e.type === 'telegraphResolved' && e.hit) && p.hp < hpBefore,
    `ficou dentro: levou ${Math.round(hpBefore - p.hp)} de dano no impacto`,
  );
  // sair do círculo
  const w2 = bossSetup();
  let ev2: Extract<GameEvent, { type: 'telegraph' }> | undefined;
  run(w2.w, 8, () => {
    ev2 = drain(w2.w).find((e) => e.type === 'telegraph') as typeof ev2;
    return !!ev2;
  });
  run(w2.w, 0.5);
  w2.w.player.x = ev2!.x - ar.radius - 1.2; // saiu do círculo antes do impacto
  const hp2 = w2.w.player.hp;
  run(w2.w, 1.2);
  const evs2 = drain(w2.w);
  ok(
    evs2.some((e) => e.type === 'telegraphResolved' && !e.hit) && w2.w.player.hp === hp2,
    'fora do círculo no impacto: nenhum dano',
  );
  ok(w2.w.telegraphs.length === 0, 'telegrafo some após o impacto');
}

console.log('\n== chefe: invoca guerreiros aos 50% (uma vez) ==');
{
  const { w, b } = bossSetup();
  run(w, 0.5);
  ok(w.monsters.filter((m) => m.summoned).length === 0, 'sem invocação com a vida cheia');
  b.hp = b.derived.maxHp * 0.5 - 1;
  const evs: GameEvent[] = [];
  run(w, 0.3);
  evs.push(...drain(w));
  const adds = w.monsters.filter((m) => m.summoned && !m.dead);
  ok(adds.length === 2 && adds.every((m) => m.monsterId === 'guerreiro_terracota'), 'invoca 2 guerreiros de terracota');
  ok(
    adds.every((m) => Math.hypot(m.x - b.x, m.y - b.y) < 4),
    'perto do chefe',
  );
  ok(
    evs.some((e) => e.type === 'bossSummon'),
    'evento bossSummon',
  );
  b.hp = b.derived.maxHp * 0.3;
  run(w, 1);
  b.hp = b.derived.maxHp * 0.2;
  run(w, 1);
  ok(w.monsters.filter((m) => m.summoned).length === 2, 'só invoca uma vez');
  priv(w).killMonster(b);
  ok(w.monsters.filter((m) => m.summoned && !m.dead).length === 0, 'ao morrer o chefe, os invocados somem');
}

console.log('\n== chefe: leash na arena ==');
{
  const { w, b } = bossSetup();
  run(w, 1);
  ok(b.ai === 'chase', 'jogador na arena: chefe entra em combate');
  b.hp = b.derived.maxHp * 0.7;
  w.player.x = b.home.x - 12;
  w.player.y = b.home.y; // fora da arena
  w.player.path = [];
  run(w, 1);
  ok(b.ai === 'chase', 'saiu da arena há 1 s: chefe ainda não desiste');
  run(w, 3);
  ok(b.ai !== 'chase', 'jogador ficou fora da arena: chefe desiste do combate');
  run(w, 40);
  ok(
    b.hp === b.derived.maxHp && b.ai === 'idle' && Math.hypot(b.x - b.home.x, b.y - b.home.y) < 0.5,
    'chefe volta ao ponto de origem e cura tudo',
  );
  // desviar de golpe marcado perto dos braseiros (um pouco além do raio da arena) não reseta a luta
  {
    const { w, b } = bossSetup();
    run(w, 1);
    b.hp = b.derived.maxHp * 0.6;
    w.player.x = b.home.x + 8.5;
    w.player.y = b.home.y;
    w.player.path = [];
    run(w, 5);
    ok(b.ai === 'chase' && b.hp < b.derived.maxHp, 'jogador na borda da arena (8,5 tiles): luta continua');
    // saiu de vez e voltou enquanto o chefe recuava: retoma a luta sem curar tudo
    w.player.x = b.home.x - 14;
    run(w, 3.1);
    ok(b.ai === 'return', 'longe por 3 s: chefe recua');
    w.player.x = b.home.x - 4;
    w.player.path = [];
    run(w, 0.2);
    ok(b.ai === 'chase' && b.hp < b.derived.maxHp, 'voltou à arena: chefe retoma a luta sem curar tudo');
  }
  const w2 = mk('lamina', 10, 'ruinas'),
    b2 = boss(w2);
  w2.player.x = b2.home.x - 10;
  w2.player.y = b2.home.y;
  w2.player.path = [];
  run(w2, 2);
  ok(b2.ai === 'idle', 'jogador fora da arena não acorda o chefe');
  const ev: GameEvent[] = [];
  const w3 = mk('lamina', 10, 'ruinas');
  w3.player.x = boss(w3).home.x - 6;
  w3.player.y = boss(w3).home.y;
  run(w3, 0.2);
  ev.push(...drain(w3));
  ok(
    ev.some((e) => e.type === 'bossArena'),
    'entrar na arena dispara bossArena (dica "chefe")',
  );
}

console.log('\n== chefe: respawn persiste no save ==');
{
  const { w, b } = bossSetup();
  w.clock = fixedClock(NOW);
  priv(w).killMonster(b);
  ok(b.dead && Math.abs(w.bossRespawnAtMs - (NOW + 600_000)) < 1, 'morte marca respawn em 10 min (relógio real)');
  const s = w.serialize();
  ok(
    typeof s.bossRespawnAt === 'number' && s.bossRespawnAt > Date.now() - 1,
    'serialize guarda o horário de renascimento',
  );
  const reload = (ms: number) =>
    World.fromSave(maps, { ...s, mapId: 'ruinas', bossRespawnAt: NOW + 600_000, lastSeen: NOW }, NOW + ms, false);
  ok(boss(reload(60_000)).dead, '1 min depois (recarregou): chefe continua morto');
  ok(!boss(reload(601_000)).dead, '10 min depois: chefe vivo');
  const w3 = reload(120_000);
  const left = boss(w3).respawnAt - w3.time;
  ok(left > 470 && left < 490, `tempo restante restaurado (~${left.toFixed(0)} s)`);
  ok(boss(w3).dead && w3.arenas.length === 1, 'chefe morto pela marca do save');
  // dentro do jogo: renasce quando o tempo passa
  const w4 = mk('lamina', 10, 'ruinas');
  const b4 = boss(w4);
  frozen(w4);
  w4.player.x = 3;
  w4.player.y = 16.5;
  w4.player.path = [];
  priv(w4).killMonster(b4);
  drain(w4);
  run(w4, 590);
  ok(b4.dead, 'aos 590 s ainda morto');
  run(w4, 15);
  ok(!b4.dead && b4.hp === b4.derived.maxHp && w4.bossRespawnAtMs === 0, 'renasce após 10 min com vida cheia');
}

console.log('\n== chefe: drop garantido ==');
{
  const slots = new Set<string>();
  let allRare = true,
    ilvl5 = true,
    sectOk = true,
    gold = true,
    weapons = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const cls = seed % 2 ? 'lamina' : 'pavilhao';
    const w = mk(cls, 10, 'ruinas');
    priv(w).rng = new Rng(seed * 31);
    const b = boss(w);
    w.gold = 0;
    w.bag.fill(null);
    priv(w).killMonster(b);
    const it = w.bag.find((x) => x && BASES[x.baseId]);
    if (!it) {
      allRare = false;
      continue;
    }
    slots.add(BASES[it.baseId].slot);
    if (it.rarity !== 'raro' || it.bonuses.length !== 2) allRare = false;
    if (it.ilvl !== 5 || BASES[it.baseId].reqLevel !== 5) ilvl5 = false;
    if (BASES[it.baseId].slot === 'arma') {
      weapons++;
      if (BASES[it.baseId].sect !== cls) sectOk = false;
    }
    if (w.gold < MONSTERS.general_terracota.loot!.gold!.min) gold = false;
  }
  ok(allRare, 'sempre 1 item Raro (2 bônus)');
  ok(ilvl5, 'item de nível 5');
  ok(slots.size >= 5, `slot aleatório (${[...slots].join(', ')})`);
  ok(weapons > 0 && sectOk, `arma sempre da seita do jogador (${weapons} armas)`);
  ok(gold, 'ouro garantido');
}

console.log('\n== loot nível 5+ ==');
{
  const w = mk('lamina', 10, 'floresta');
  priv(w).rng = new Rng(99);
  const stat = (id: string, lvl: number, n = 3000) => {
    const m = w.monsters.find((x) => x.monsterId === id)!;
    let big = 0,
      lvl5 = 0,
      gold = 0;
    for (let i = 0; i < n; i++) {
      m.dead = false;
      m.level = lvl;
      w.bag.fill(null);
      const g0 = w.gold;
      priv(w).killMonster(m);
      gold += w.gold - g0;
      for (const b of w.bag) {
        if (b?.baseId === 'pocao_hp_g' || b?.baseId === 'pocao_mp_g') big++;
        else if (b && BASES[b.baseId]?.reqLevel === 5) lvl5++;
      }
    }
    return { big, lvl5, gold: gold / n };
  };
  const b4 = stat('bandido_espadachim', 4),
    b6 = stat('bandido_espadachim', 6);
  ok(b4.big === 0 && b6.big > 100, `poção grande só em monstro nv 5+ (nv4: ${b4.big}, nv6: ${b6.big})`);
  ok(b4.lvl5 === 0 && b6.lvl5 > 50, `equipamento nível 5 só em monstro nv 5+ (nv4: ${b4.lvl5}, nv6: ${b6.lvl5})`);
  ok(b6.gold > b4.gold, `ouro escala com o nível (${b4.gold.toFixed(1)} → ${b6.gold.toFixed(1)})`);
}

console.log('\n== auto-combate ignora o chefe e a arena ==');
{
  const w = mk('lamina', 10, 'ruinas');
  const b = boss(w);
  w.addItem({ uid: 'x', baseId: 'pocao_hp_g', rarity: 'comum', bonuses: [], ilvl: 1, durability: 0, qty: 30 });
  w.player.x = 4.5;
  w.player.y = 16.5;
  w.player.path = [];
  // guerreiro invocado dentro da arena (perto do chefe) e jogador dentro da distância normal
  const summon = {
    ...b,
    id: 99999,
    monsterId: 'guerreiro_terracota',
    summoned: true,
    dead: false,
    level: 9,
    x: b.x - 4,
    y: b.y,
    home: { x: b.x - 4, y: b.y },
    ai: 'idle' as const,
    path: [],
    buffs: [],
    hp: 100,
    name: 'Guerreiro de Terracota',
  };
  summon.derived = { ...b.derived, maxHp: 100 };
  w.monsters.push(summon as Entity);
  w.auto.toggle();
  let enteredArena = false,
    targetedBoss = false,
    targetedSummon = false,
    kills = 0;
  for (let i = 0; i < 60 * 150; i++) {
    w.tick(1 / 60);
    for (const e of drain(w)) if (e.type === 'kill') kills++;
    const t = w.getTarget();
    if (t && MONSTERS[t.monsterId].boss) targetedBoss = true;
    if (t && t.id === 99999) targetedSummon = true;
    if (w.mapId === 'ruinas' && w.player.hp < 1e5 && w.inArena(w.player)) enteredArena = true;
    if (w.player.hp < w.player.derived.maxHp * 0.5) w.player.hp = w.player.derived.maxHp;
  }
  ok(kills >= 3, `auto caça terracotas fora da arena (${kills} abates)`);
  ok(!targetedBoss, 'nunca escolhe o chefe como alvo');
  ok(!targetedSummon, 'nunca escolhe monstro invocado dentro da arena');
  ok(!enteredArena, 'nunca entra na arena do chefe');
  ok(b.ai === 'idle' && b.hp === b.derived.maxHp, 'chefe segue intocado');
  // caminhos: com o auto ligado não cruzam a arena; manual cruza
  const w2 = mk('lamina', 10, 'ruinas');
  const pl = (
    w2 as unknown as {
      findPathFor: (a: { x: number; y: number }, b: { x: number; y: number }, v?: boolean) => unknown[];
    }
  ).findPathFor.bind(w2);
  const inside = { x: b.home.x, y: b.home.y };
  ok(findPath(w2.map, { x: 14, y: 16.5 }, inside).length > 0, 'manual: caminho até dentro da arena existe');
  w2.auto.toggle();
  ok(pl({ x: 14, y: 16.5 }, inside).length === 0, 'auto: não gera caminho para dentro da arena');
  ok(w2.pathLength(inside) === Infinity, 'auto: alvo na arena é inalcançável');
  // regra de nível continua: nível do jogador + 2
  // monstros passivos: se um guerreiro atacasse, o auto revidaria (regra "revidar primeiro") e o teste ficava instável
  // um guerreiro pode surgir perto do ponto de chegada e atacar: aí o auto revida (regra "revidar primeiro"), o que é
  // permitido. O que não pode é escolher sozinho um alvo novo acima do limite de nível.
  const w3 = mk('lamina', 1, 'ruinas');
  w3.auto.toggle();
  run(w3, 3);
  const t3 = w3.getTarget();
  ok(!t3 || t3.ai === 'chase', 'nv 1 não ataca terracota nv 7+ (regra nível ≤ jogador + 2; só revida quem o ataca)');
}

console.log('\n== vários personagens: save ==');
{
  const old: SaveData = {
    version: 1,
    name: 'Antigo',
    classId: 'pavilhao',
    level: 6,
    xp: 12,
    freePoints: 3,
    attributes: { ...CLASSES.pavilhao.baseAttributes },
    mapId: 'floresta',
    lastSeen: NOW,
    gold: 55,
  };
  const f = migrateSaves(undefined, old);
  ok(f.version === 2 && f.slots.length === SLOT_COUNT && SLOT_COUNT === 4, 'formato novo: version 2 com 4 espaços');
  ok(
    f.slots[0]?.name === 'Antigo' &&
      f.slots[0].gold === 55 &&
      f.slots[1] === null &&
      f.slots[2] === null &&
      f.slots[3] === null,
    'save antigo único vira o espaço 0, intacto',
  );
  ok(f.lastPlayedSlot === 0, 'último jogado = 0');
  const f2 = migrateSaves(old);
  ok(f2.slots[0]?.name === 'Antigo', 'aceita também o save antigo vindo como chave principal');
  const w = World.fromSave(maps, f.slots[0]!, NOW + 1000, false);
  ok(
    w.player.name === 'Antigo' && w.player.level === 6 && w.gold === 55 && w.bossRespawnAtMs === 0,
    'save antigo (sem campos novos) carrega normalmente',
  );
  ok(
    migrateSaves(null).slots.every((s) => s === null) &&
      migrateSaves('lixo').slots.length === 4 &&
      migrateSaves({ slots: 'x' }).slots.length === 4,
    'lixo vira 4 espaços vazios',
  );
  const n1 = migrateSaves(
    JSON.parse(JSON.stringify(setSlot(setSlot(emptySaveFile(), 2, { ...old, name: 'B' }), 3, { ...old, name: 'C' }))),
  );
  ok(
    n1.slots[2]?.name === 'B' && n1.slots[3]?.name === 'C' && n1.lastPlayedSlot === 3,
    'formato novo faz round-trip (JSON)',
  );
}

console.log('\n== versão do save e migrações (C8) ==');
{
  const base = { name: 'V', classId: 'pavilhao', level: 2 };
  ok(migrateCharacter({ ...base }).version === CHARACTER_SAVE_VERSION, 'sem versão: vira a versão atual');
  ok(
    migrateSaves({ slots: [{ ...base }] }).slots[0]?.version === CHARACTER_SAVE_VERSION,
    'migrateSaves passa cada espaço pela migração',
  );
  const future = { ...base, version: CHARACTER_SAVE_VERSION + 5, novo: 1 };
  ok(migrateCharacter(future) === future, 'save de versão mais nova não é mexido');
  // migrações de exemplo (as reais ficam em CHARACTER_MIGRATIONS): 1→2 renomeia, 2→3 dobra; aplicadas em ordem
  const steps = {
    1: (s: Record<string, unknown>) => ({ ...s, gold: s.ouro, ouro: undefined }),
    2: (s: Record<string, unknown>) => ({ ...s, gold: Number(s.gold) * 2 }),
  };
  const m = migrateCharacter({ ...base, ouro: 7 } as Record<string, unknown>, steps, 3);
  ok(m.gold === 14 && m.ouro === undefined && m.version === 3, 'migrações aplicadas em ordem até a versão pedida');
  const m2 = migrateCharacter({ ...base, version: 2, gold: 5 } as Record<string, unknown>, steps, 3);
  ok(m2.gold === 10, 'começa da versão do save (pula as anteriores)');
  ok(
    Object.keys(CHARACTER_MIGRATIONS).every((k) => Number(k) < CHARACTER_SAVE_VERSION),
    'toda migração leva a uma versão que existe',
  );
}

console.log('\n== vários personagens: CRUD dos espaços ==');
{
  const mkSave = (name: string, classId = 'lamina'): SaveData => ({
    version: 1,
    name,
    classId,
    level: 3,
    xp: 0,
    freePoints: 0,
    attributes: { ...CLASSES[classId].baseAttributes },
    mapId: 'cidade',
    lastSeen: NOW,
  });
  let f = emptySaveFile();
  ok(f.slots.length === 4 && f.slots.every((s) => !s), 'começa vazio');
  f = setSlot(f, 1, mkSave('Ana'));
  f = setSlot(f, 3, mkSave('Bia', 'pavilhao'));
  ok(
    f.slots[1]?.name === 'Ana' && f.slots[3]?.name === 'Bia' && f.slots[0] === null && f.slots[2] === null,
    'criar em espaços diferentes',
  );
  ok(f.lastPlayedSlot === 3, 'último jogado acompanha quem foi gravado por último');
  f = setSlot(f, 1, { ...f.slots[1]!, level: 7 });
  ok(
    f.slots[1]?.level === 7 && f.slots[3]?.level === 3 && f.lastPlayedSlot === 1,
    'atualizar um não mexe nos outros (nada compartilhado)',
  );
  f = deleteSlot(f, 3);
  ok(
    f.slots[3] === null && f.slots[1]?.name === 'Ana' && f.lastPlayedSlot === 1,
    'apagar um espaço preserva os outros',
  );
  f = deleteSlot(f, 1);
  ok(f.slots.every((s) => !s) && f.lastPlayedSlot === 0, 'apagar todos volta ao vazio');
  const a = World.fromSave(maps, mkSave('Ana'), NOW, false),
    b = World.fromSave(maps, mkSave('Bia'), NOW, false);
  a.gold = 500;
  a.xp = 77;
  ok(b.gold === 0 && b.xp === 0 && a.bag !== b.bag, 'personagens não compartilham ouro/xp/mochila');
  ok(
    relativeTime(NOW - 2 * HOUR, NOW) === 'há 2 h' &&
      relativeTime(NOW - 5 * 60_000, NOW) === 'há 5 min' &&
      relativeTime(NOW - 3 * 86400_000, NOW) === 'há 3 d',
    'último acesso relativo ("há 2 h")',
  );
}

console.log('\n== ganho offline só no último personagem ==');
{
  const bucket = (): AutoBucket => ({
    sec: 600,
    kills: 30,
    xp: 300,
    gold: 120,
    potHp: 5,
    potMp: 2,
    levelSum: 60,
    drops: {},
  });
  const sv = (): SaveData => ({
    version: 1,
    name: 'T',
    classId: 'lamina',
    level: 3,
    xp: 0,
    freePoints: 0,
    attributes: { ...CLASSES.lamina.baseAttributes },
    mapId: 'floresta',
    lastSeen: NOW - 5 * HOUR,
    auto: { active: true, mapId: 'floresta', buckets: [bucket()] },
  });
  const last = World.fromSave(maps, sv(), NOW, true);
  ok(
    !!last.offlineReport && last.offlineReport.kills > 100 && last.gold > 0,
    `último jogado recebe ganhos (${last.offlineReport?.kills} abates, ${last.gold} ouro)`,
  );
  const other = World.fromSave(maps, sv(), NOW, false);
  ok(
    other.offlineReport === null && other.gold === 0 && other.player.level === 3 && other.xp === 0,
    'os outros não recebem nada',
  );
  ok(other.serialize().lastSeen >= Date.now() - 5000, 'ao jogar, o último acesso (lastSeen) é atualizado ao salvar');
}

console.log('\n== dicas e dados ==');
{
  const tips = JSON.parse(readFileSync('src/data/tips.json', 'utf8')) as Record<
    string,
    { title: string; text: string }
  >;
  ok(!!tips.bandidos && !!tips.terracota && !!tips.chefe, 'dicas bandidos, terracota e chefe existem');
  ok(/Quebra-Guarda/.test(JSON.stringify(tips.terracota)), 'dica da terracota recomenda o Quebra-Guarda (Tormenta)');
  ok(
    PROGRESSION.levelCap === 20 &&
      PROGRESSION.xpToNext.length === 19 &&
      PROGRESSION.xpToNext.every((v, i, a) => i === 0 || v > a[i - 1]),
    'curva de XP crescente até o nível 20',
  );
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
