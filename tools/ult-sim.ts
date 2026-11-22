// Simulação da ultimate: caça real (core + auto) em cada faixa de nível, solta a ultimate sempre que a barra enche
// e mede o tempo para encher, os monstros no raio, o dano da ultimate (em segundos de caça normal) e as mortes.
// Uso: npm run sim:ult [-- --sect=pavilhao --seeds=3 --min=20]
// Seita sem ultimate em ultimates.json (ou para testar números): --radius= --duration= --strikes= --strikeMult= --finalMult=
import { readFileSync } from 'node:fs';
import { CLASSES, totalFreePoints } from '../src/core/data';
import { BASES, SLOTS, equipmentBaseIds, makeEquipment, makePotion } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { QUESTS } from '../src/core/quests';
import { Rng } from '../src/core/rng';
import { ULTIMATES, type UltimateDef } from '../src/core/ultimate';
import { World } from '../src/core/world';
import type { SaveData } from '../src/core/types';

const maps: Record<string, GameMap> = {};
for (const id of [
  'cidade',
  'floresta',
  'ruinas',
  'montanha',
  'gruta',
  'mosteiro',
  'covil',
  'trial',
  'bambu',
  'pico',
  'cidadela',
  'vale',
  'palacio',
])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const arg = (k: string, d: number) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const SECT = (process.argv.find((x) => x.startsWith('--sect=')) ?? '--sect=lamina').split('=')[1];
const base: UltimateDef = ULTIMATES[SECT] ?? { ...ULTIMATES.lamina, id: `${SECT}_sim`, name: SECT };
const U: UltimateDef = (ULTIMATES[SECT] = {
  ...base,
  charge: arg('charge', base.charge),
  radius: arg('radius', base.radius),
  duration: arg('duration', base.duration),
  strikes: arg('strikes', base.strikes),
  strikeMult: arg('strikeMult', base.strikeMult),
  finalMult: arg('finalMult', base.finalMult),
});
const SEEDS = arg('seeds', 3),
  MIN = arg('min', 20),
  DT = 1 / 30,
  EPOCH = Date.UTC(2026, 0, 1);
const priv = (w: World) => w as unknown as { rng: Rng; recalc: (e: unknown, k: boolean) => void };

function world(level: number, seed: number, gear: number, hunt: string): World {
  const classId = SECT,
    c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s: SaveData = {
    version: 1,
    name: 'Sim',
    classId,
    level,
    xp: 0,
    freePoints: totalFreePoints(level),
    attributes: attrs,
    mapId: 'cidade',
    lastSeen: 0,
    gold: 500,
    quest: {
      stage: level >= 30 ? QUESTS.findIndex((q) => q.minLevel > 30) : level >= 20 ? 14 : 8,
      status: 'pending',
      progress: 0,
    },
  };
  const w = World.fromSave(maps, s, EPOCH, false);
  priv(w).rng = new Rng(seed * 7919 + 101);
  w.clock = () => EPOCH + w.time * 1000;
  w.distributeRecommended();
  for (const st of Object.values(w.skills)) st.level = Math.max(st.level, level >= 30 ? 13 : level >= 20 ? 10 : 5);
  for (const sl of SLOTS) {
    const id = equipmentBaseIds(sl).find(
      (b) => BASES[b].reqLevel === gear && (!BASES[b].sect || BASES[b].sect === classId),
    );
    if (id) w.equipment[sl] = makeEquipment(id, 'incomum', c.element, priv(w).rng, gear);
  }
  priv(w).recalc(w.player, false);
  w.player.hp = w.player.derived.maxHp;
  w.player.mana = w.player.derived.maxMana;
  w.addItem(makePotion('pocao_hp_g', 30));
  w.addItem(makePotion('pocao_mp_g', 30));
  w.changeMap(hunt);
  w.auto.huntMap = hunt;
  return w;
}

interface Out {
  fills: number[];
  near: number[];
  nearHp: number[];
  dmg: number;
  ultDmg: number[];
  kills: number[];
  secs: number;
  atk: number;
}
function run(level: number, seed: number, gear: number, hunt: string): Out {
  const w = world(level, seed, gear, hunt);
  w.auto.toggle();
  const d = w.player.derived,
    o: Out = {
      fills: [],
      near: [],
      nearHp: [],
      dmg: 0,
      ultDmg: [],
      kills: [],
      secs: 0,
      atk: Math.max(d.physAtk, d.spiritAtk),
    };
  let lastEnd = 0,
    readyAt = -1,
    huntSecs = 0,
    cur: { dmg: number; inside: Set<number> } | null = null;
  for (let i = 0; i < (MIN * 60) / DT; i++) {
    const wasCast = !!w.ultCast;
    w.tick(DT);
    if (!wasCast) huntSecs += DT;
    for (const ev of w.events.splice(0)) {
      if (ev.type === 'hit' && ev.targetKind === 'monster') {
        if (cur) cur.dmg += ev.amount;
        else o.dmg += ev.amount;
      }
    }
    if (cur && !w.ultCast) {
      o.ultDmg.push(cur.dmg);
      o.kills.push(
        [...cur.inside].filter((id) => w.monsters.find((m) => m.id === id)?.dead ?? true).length / cur.inside.size,
      );
      cur = null;
      lastEnd = w.time;
      readyAt = -1;
    }
    if (!w.ultCast && w.ultReady() && readyAt < 0) {
      readyAt = w.time;
      o.fills.push(w.time - lastEnd);
    }
    if (!w.ultCast && w.ultReady()) {
      // solta só com monstro no raio (o jogador espera juntar)
      const p = w.player,
        near = w.monsters.filter((m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= U.radius);
      if (near.length && w.useUltimate()) {
        o.near.push(near.length);
        for (const m of near) o.nearHp.push(m.derived.maxHp);
        cur = { dmg: 0, inside: new Set(near.map((m) => m.id)) };
      }
    }
  }
  o.secs = huntSecs;
  return o;
}

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;
const TIERS: [number, number, string][] = [
  [10, 5, 'ruinas'],
  [15, 15, 'montanha'],
  [22, 20, 'bambu'],
  [30, 25, 'pico'],
  [38, 35, 'palacio'],
];
const total = U.strikes * U.strikeMult + U.finalMult;
console.log(
  `ultimate ${SECT}: carga ${U.charge}, raio ${U.radius} tiles, ${U.duration} s, ${U.strikes}×${U.strikeMult} + ${U.finalMult} = ${total}× por monstro; ${SEEDS} seeds × ${MIN} min`,
);
console.log(
  'nv  mapa      encher(s)  monstros no raio (méd/med/máx)  vida média  dano/s  ataque  dano ult  = s de caça  mortes',
);
for (const [lv, gear, map] of TIERS) {
  const rs = Array.from({ length: SEEDS }, (_, s) => run(lv, s + 1, gear, map));
  const fills = rs.flatMap((r) => r.fills.slice(1)),
    near = rs.flatMap((r) => r.near),
    hp = rs.flatMap((r) => r.nearHp),
    ult = rs.flatMap((r) => r.ultDmg),
    kills = rs.flatMap((r) => r.kills);
  const dps = avg(rs.map((r) => r.dmg / r.secs));
  console.log(
    `${String(lv).padEnd(3)} ${map.padEnd(9)} ${avg(fills).toFixed(0).padStart(6)}     ${avg(near).toFixed(1)} / ${med(near)} / ${Math.max(...near)}`.padEnd(
      60,
    ) +
      `${avg(hp).toFixed(0).padStart(7)} ${dps.toFixed(0).padStart(7)} ${avg(rs.map((r) => r.atk))
        .toFixed(0)
        .padStart(
          7,
        )} ${avg(ult).toFixed(0).padStart(9)} ${(avg(ult) / dps).toFixed(1).padStart(8)} ${(avg(kills) * 100).toFixed(0).padStart(6)}%`,
  );
}
