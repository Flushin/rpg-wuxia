// Verificação headless do conteúdo do nível 30 (etapa 4): Bosque de Bambu Sombrio e Pico da Névoa, portais com nível
// mínimo, monstros novos nas faixas certas, Senhor da Névoa (invocação, fúria, drops), Auto escolhendo os mapas pelo
// nível, ganho offline a 5/6 nos mapas novos e missões 21–30.
// Uso: npm run check:m10
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS } from '../src/core/data';
import { BASES, makeEquipment } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { MAPS_CONFIG, portalMinLevel } from '../src/core/mapsConfig';
import { computeOffline } from '../src/core/offline';
import { QUESTS } from '../src/core/quests';
import { Rng } from '../src/core/rng';
import { TRIAL_BOSSES } from '../src/core/trial';
import { World } from '../src/core/world';
import type { AutoBucket, Entity, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta', 'ruinas', 'montanha', 'bambu', 'pico'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const NOW = 1_800_000_000_000;
const priv = (w: World) => w as unknown as { killMonster: (m: Entity) => void; rng: Rng };
const mk = (level: number, mapId = 'cidade', classId = 'lamina', extra: Partial<SaveData> = {}): World => {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  attrs.stamina += 300;
  const s: SaveData = {
    version: 2,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId,
    lastSeen: NOW,
    gold: 100_000,
    ...extra,
  };
  const w = World.fromSave(maps, s, NOW, false);
  priv(w).rng = new Rng(42);
  w.clock = () => NOW;
  return w;
};
const portal = (from: string, to: string) =>
  maps[from].objects.find((o) => o.type === 'portal' && String(o.props.target) === to);
const reach = (m: GameMap, sx: number, sy: number) => {
  const seen = new Set([sy * m.width + sx]),
    q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = (y + dy) * m.width + x + dx;
      if (!seen.has(k) && m.walkable[k]) (seen.add(k), q.push([x + dx, y + dy]));
    }
  }
  return seen;
};

console.log('== mapas e portais ==');
{
  const toB = portal('montanha', 'bambu'),
    toP = portal('bambu', 'pico');
  ok(!!toB && portalMinLevel(toB) === 20, 'montanha → Bosque de Bambu Sombrio, liberado no nível 20');
  ok(!!toP && portalMinLevel(toP) === 25, 'Bosque → Pico da Névoa, liberado no nível 25');
  ok(!!portal('bambu', 'montanha') && !!portal('pico', 'bambu'), 'caminho de volta (bosque → montanha, pico → bosque)');
  ok(maps.bambu.tiles.includes('bamboo') && MAPS_CONFIG.bambu.trees === 'bamboo', 'bosque com moitas de bambu');
  const sb = reach(maps.bambu, 3, 16);
  ok(sb.has(2 * 32 + 16), 'bosque: saída norte alcançável da entrada');
  const sp = reach(maps.pico, 16, 27);
  ok(sp.has(6 * 32 + 16), 'pico: santuário (arena) alcançável');
  ok(
    MAPS_CONFIG.bambu.autoExitVia === 'montanha' && MAPS_CONFIG.pico.autoExitVia === 'bambu',
    'Auto sabe voltar à vila',
  );
}

console.log('== monstros ==');
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
  band('bambu', ['assassino_sombras', 'serpente_jade'], 20, 25);
  band('pico', ['grou_espiritual', 'guardiao_jade'], 25, 30);
  const w = mk(22, 'bambu');
  const mobs = w.monsters.filter((m) => !MONSTERS[m.monsterId].boss);
  ok(
    mobs.every((m) => m.levels && m.level >= m.levels[0] && m.level <= m.levels[1]),
    'cada monstro nasce na faixa do seu ponto',
  );
  ok(MONSTERS.serpente_jade.projectile === 'poison' && MONSTERS.grou_espiritual.projectile === 'qi', 'projéteis novos');
  for (const id of ['assassino_sombras', 'serpente_jade', 'grou_espiritual', 'guardiao_jade'])
    ok(
      (MONSTERS[id].loot?.materials ?? []).some((m) => m.id === 'jade_nevoa'),
      `${MONSTERS[id].name} solta Jade da Névoa`,
    );
  const eq = (id: string) => [MONSTERS[id].loot?.equipment ?? []].flat().map((e) => e.minReqLevel ?? 0);
  ok(eq('assassino_sombras').includes(20) && eq('guardiao_jade').includes(25), 'bosque solta nv 20; pico solta nv 25');
}

console.log('== resistência a veneno ==');
{
  ok(
    ['assassino_sombras', 'serpente_jade', 'grou_espiritual', 'guardiao_jade'].every(
      (id) => (MONSTERS[id].poisonRes ?? 0) > 0 && (MONSTERS[id].poisonRes ?? 0) <= 0.9,
    ) && !MONSTERS.yeti.poisonRes,
    'monstros do nível 30 resistem a veneno (os antigos não)',
  );
  const w = mk(22, 'bambu', 'vibora');
  const s = w.monsters.find((m) => m.monsterId === 'serpente_jade')!;
  ok(s.elemRes.poison === Math.round(100 * MONSTERS.serpente_jade.poisonRes!), 'resistência elemental de veneno');
  const poisonOn = (target: Entity) => {
    target.buffs = [];
    const def = w.classSkills().find((k) => k.poison)!;
    (w as unknown as { applyOnHit: (d: unknown, v: Entity, sc: number) => void }).applyOnHit(def, target, 1);
    return target.buffs.find((b) => b.kind === 'poison')?.value ?? 0;
  };
  const withRes = poisonOn(s),
    keep = MONSTERS.serpente_jade.poisonRes;
  MONSTERS.serpente_jade.poisonRes = 0;
  const noRes = poisonOn(s);
  MONSTERS.serpente_jade.poisonRes = keep;
  ok(
    noRes > 0 && Math.abs(withRes / noRes - (1 - keep!)) < 0.01,
    `veneno das skills rende ${Math.round(keep! * 100)}% menos (${withRes.toFixed(1)} contra ${noRes.toFixed(1)} por s)`,
  );
}

console.log('== desgaste: escudo protege o equipamento ==');
{
  const w = mk(22, 'bambu', 'tita');
  w.equipment.tronco = makeEquipment('veste_bambu', 'comum', null, new Rng(1), 22);
  for (const sl of Object.keys(w.equipment)) if (sl !== 'tronco') delete (w.equipment as Record<string, unknown>)[sl];
  const m = w.monsters.find((x) => x.monsterId === 'assassino_sombras')!;
  (w as unknown as { rng: { next: () => number; range: (a: number, b: number) => number } }).rng = {
    next: () => 0.01,
    range: (a: number, b: number) => (a + b) / 2,
  } as never;
  const hit = () => (w as unknown as { attack: (a: Entity, t: Entity) => unknown }).attack(m, w.player);
  const d0 = w.equipment.tronco!.durability;
  w.addBuff(w.player, 'teste', 'shield', 1e6, 30);
  hit();
  ok(w.equipment.tronco!.durability === d0, 'golpe todo absorvido pelo escudo não gasta durabilidade');
  w.player.buffs = [];
  hit();
  ok(w.equipment.tronco!.durability < d0, 'golpe que passa do escudo gasta durabilidade');
}

console.log('== Senhor da Névoa ==');
{
  const def = MONSTERS.senhor_nevoa;
  ok(!!def.boss && def.minLevel === 30 && (def.scale ?? 1) >= 1.5, 'chefe nível 30 e grande');
  ok(def.boss?.summon?.monsterId === 'grou_espiritual' && !!def.boss?.enrage, 'chama grous e fica furioso');
  ok(TRIAL_BOSSES.includes('senhor_nevoa'), 'entra no Trial');
  const w = mk(30, 'pico');
  const b = w.monsters.find((m) => m.monsterId === 'senhor_nevoa');
  ok(!!b && b.level === 30, 'nasce no santuário, nível 30');
  if (b) {
    w.events.splice(0);
    priv(w).killMonster(b);
    const items = [...w.bag, ...w.ground.map((g) => g.item)].filter((it) => it && BASES[it.baseId]);
    ok(
      items.some((it) => BASES[it!.baseId].reqLevel === 25 && it!.rarity === 'raro'),
      'garante um Raro nv 25',
    );
    ok(w.potionCount('jade_nevoa') >= 4 && w.potionCount('essencia_qi') >= 3, 'solta jade e essência');
  }
}

console.log('== Auto pelo nível ==');
{
  for (const [lv, want] of [
    [19, 'montanha'],
    [20, 'bambu'],
    [24, 'bambu'],
    [25, 'pico'],
    [30, 'pico'],
  ] as const) {
    const w = mk(lv, 'cidade');
    w.auto.toggle();
    ok(w.auto.huntMap === want, `nível ${lv}: Auto vai para ${want} (${w.auto.huntMap})`);
  }
}

console.log('== offline a 5/6 nos mapas novos ==');
{
  const rate = { killsPerMin: 6, xpPerKill: 800, goldPerKill: 30, potHpPerKill: 0, potMpPerKill: 0, drops: [] };
  const base = computeOffline({ elapsedMs: 6 * 3.6e6, rate, level: 21, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 });
  const red = computeOffline({
    elapsedMs: 6 * 3.6e6,
    rate,
    level: 21,
    xp: 0,
    potions: { hp: 0, mp: 0 },
    seed: 1,
    effMul: MAPS_CONFIG.bambu.offlineMul,
  });
  ok(Math.abs(red.effMin / base.effMin - 5 / 6) < 1e-9, 'minutos efetivos = 5/6 da regra normal');
  ok(
    MAPS_CONFIG.pico.offlineMul === MAPS_CONFIG.bambu.offlineMul && !MAPS_CONFIG.montanha.offlineMul,
    'só nos mapas 20–30',
  );
  const bucket = (): AutoBucket => ({
    sec: 600,
    kills: 60,
    xp: 48000,
    gold: 1800,
    potHp: 0,
    potMp: 0,
    levelSum: 60 * 22,
    drops: {},
  });
  const off = (mapId: string) =>
    mk(21, mapId, 'lamina', {
      auto: { active: true, mapId, buckets: [bucket()] },
      lastSeen: NOW - 6 * 3.6e6,
    } as Partial<SaveData>);
  const fresh = (mapId: string) => {
    const s = off(mapId).serialize();
    return World.fromSave(maps, s, NOW, true);
  };
  const rb = fresh('bambu').offlineReport,
    rm = fresh('montanha').offlineReport;
  ok(
    !!rb && !!rm && Math.abs(rb.kills / rm.kills - 5 / 6) < 0.01,
    `relatório: bosque rende 5/6 da montanha (${rb?.kills}/${rm?.kills})`,
  );
}

console.log('== missões 21–30 ==');
{
  const ids = QUESTS.slice(14).map((q) => q.id);
  ok(ids.join() === 'passo_leste,sombras_bambu,veneno_jade,penas_grou,senhor_nevoa', 'cinco etapas novas, em ordem');
  ok(
    QUESTS.slice(14).every((q, i, a) => q.minLevel >= 20 && (i === 0 || q.minLevel >= a[i - 1].minLevel)),
    'níveis 20+ e crescentes',
  );
  const xp = QUESTS.slice(14).reduce((s, q) => s + q.reward.xp, 0);
  ok(xp >= 250_000 && xp <= 350_000, `XP das missões ~15% da faixa (${xp})`);
  const w = mk(20, 'cidade', 'lamina', { quest: { stage: 14, status: 'pending', progress: 0 } } as Partial<SaveData>);
  ok(w.questView().phase === 'available', 'quem terminou a cadeia antiga recebe a missão nova');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
