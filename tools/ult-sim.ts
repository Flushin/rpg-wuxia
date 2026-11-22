// Simulação da ultimate da Tormenta: caça real (core + auto) em cada faixa de nível e mede quanto tempo
// 25 skills que acertam levam, quantos monstros estão num raio de 7 tiles quando a barra enche e o dano normal.
// Uso: npm run sim:ult [-- --seeds=3 --min=20]
import { readFileSync } from 'node:fs';
import { CLASSES, totalFreePoints } from '../src/core/data';
import { BASES, SLOTS, equipmentBaseIds, makeEquipment, makePotion } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { QUESTS } from '../src/core/quests';
import { Rng } from '../src/core/rng';
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
const SEEDS = arg('seeds', 3),
  MIN = arg('min', 20),
  CHARGE = arg('charge', 25),
  RADIUS = arg('radius', 7),
  DT = 1 / 30,
  EPOCH = Date.UTC(2026, 0, 1);
const priv = (w: World) => w as unknown as { rng: Rng; recalc: (e: unknown, k: boolean) => void };

function world(level: number, seed: number, gear: number, hunt: string): World {
  const classId = 'lamina',
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
  secs: number;
  atk: number;
}
function run(level: number, seed: number, gear: number, hunt: string): Out {
  const w = world(level, seed, gear, hunt);
  w.auto.toggle();
  const o: Out = { fills: [], near: [], nearHp: [], dmg: 0, secs: 0, atk: w.player.derived.physAtk };
  let charge = 0,
    lastFill = 0;
  for (let i = 0; i < (MIN * 60) / DT; i++) {
    w.tick(DT);
    let cast = false,
      hit = false;
    for (const ev of w.events.splice(0)) {
      if (ev.type === 'skillCast' && ev.casterId === w.player.id) cast = true;
      else if (ev.type === 'hit' && ev.targetKind === 'monster') {
        hit = true;
        o.dmg += ev.amount;
      }
    }
    if (cast && hit && ++charge >= CHARGE) {
      charge = 0;
      o.fills.push(w.time - lastFill);
      lastFill = w.time;
      const p = w.player,
        near = w.monsters.filter((m) => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= RADIUS);
      o.near.push(near.length);
      for (const m of near) o.nearHp.push(m.derived.maxHp);
    }
  }
  o.secs = w.time;
  return o;
}

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;
const TIERS: [number, number, string][] = [
  [8, 5, 'ruinas'],
  [15, 15, 'montanha'],
  [22, 20, 'bambu'],
  [30, 25, 'pico'],
  [38, 35, 'palacio'],
];
console.log(`ultimate: carga ${CHARGE} skills que acertam, raio ${RADIUS} tiles, ${SEEDS} seeds × ${MIN} min`);
console.log('nv  mapa      encher(s)  monstros no raio (méd/mediana/máx)  vida média  dano/s normal  ataque');
for (const [lv, gear, map] of TIERS) {
  const rs = Array.from({ length: SEEDS }, (_, s) => run(lv, s + 1, gear, map));
  const fills = rs.flatMap((r) => r.fills.slice(1)),
    near = rs.flatMap((r) => r.near),
    hp = rs.flatMap((r) => r.nearHp);
  const dps = avg(rs.map((r) => r.dmg / r.secs));
  console.log(
    `${String(lv).padEnd(3)} ${map.padEnd(9)} ${avg(fills).toFixed(0).padStart(6)}     ${avg(near).toFixed(1)} / ${med(near)} / ${Math.max(...near)}`.padEnd(
      68,
    ) +
      `${avg(hp).toFixed(0).padStart(7)}  ${dps.toFixed(0).padStart(8)}  ${avg(rs.map((r) => r.atk))
        .toFixed(0)
        .padStart(8)}`,
  );
}
