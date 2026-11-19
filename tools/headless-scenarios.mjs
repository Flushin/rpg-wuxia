// Cenários do check:headless (roadmap M0, E1c). Rodam iguais em dois lugares:
// - no Node, com o pacote headless (tools/headless-check.mjs, na CI);
// - no Chromium, com o mesmo core empacotado para o navegador (tools/headless-golden.mjs, gera o gabarito).
// Cada cenário carrega um save e aplica o ganho offline com o relógio "do servidor" injetado, e depois abre o
// estoque do mercador (que também depende do relógio). O resultado tem de ser idêntico nos dois lugares.
// `core` é o módulo src/core/headless.ts (já carregado).

export const T0 = 1_800_000_000_000; // 15/01/2027, longe de qualquer horário real
const HOUR = 3_600_000;

const attrs = (lv, base, per) => Object.fromEntries(Object.keys(base).map((k) => [k, base[k] + per[k] * (lv - 1)]));

function save({ name, classId, level, mapId, hours, bag, buckets, extra = {} }) {
  return {
    version: 1,
    name,
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs(
      level,
      { strength: 8, intelligence: 3, stamina: 8, agility: 5, willpower: 3 },
      { strength: 2, intelligence: 1, stamina: 2, agility: 1, willpower: 1 },
    ),
    mapId,
    lastSeen: T0 - hours * HOUR,
    gold: 500,
    bag,
    auto: { active: true, mapId, buckets },
    ...extra,
  };
}

const bucket = (sec, kills, xpPerKill, goldPerKill, levelAvg, drops) => ({
  sec,
  kills,
  xp: kills * xpPerKill,
  gold: kills * goldPerKill,
  potHp: Math.round(kills / 10),
  potMp: Math.round(kills / 25),
  levelSum: kills * levelAvg,
  drops,
});

export const SCENARIOS = [
  {
    id: 'floresta-3h',
    serverNow: T0,
    save: save({
      name: 'Ana',
      classId: 'lamina',
      level: 6,
      mapId: 'floresta',
      hours: 3,
      bag: [
        { uid: 'a1', baseId: 'pocao_hp_p', qty: 20 },
        { uid: 'a2', baseId: 'pocao_mp_p', qty: 10 },
      ],
      buckets: [
        bucket(600, 55, 42, 9, 6, { 'pocao_hp_p|comum': 3, 'colar_jade|incomum': 2, 'minerio_ferro|comum': 4 }),
        bucket(300, 30, 44, 10, 6, { 'tunica_algodao|comum': 1 }),
      ],
    }),
  },
  {
    id: 'ruinas-14h-mochila-cheia',
    serverNow: T0 + 7 * HOUR + 123,
    save: save({
      name: 'Bia',
      classId: 'pavilhao',
      level: 11,
      mapId: 'ruinas',
      hours: 14,
      bag: Array.from({ length: 30 }, (_, i) => ({ uid: `b${i}`, baseId: 'minerio_ferro', qty: 1 })),
      buckets: [
        bucket(1200, 80, 120, 25, 11, { 'colar_dragao|raro': 1, 'manto_seda|incomum': 3, 'essencia_qi|comum': 2 }),
      ],
    }),
  },
  {
    id: 'relogio-voltou',
    // relógio do servidor ANTES do lastSeen (aparelho adiantado): não pode dar ganho
    serverNow: T0 - 2 * HOUR,
    save: save({
      name: 'Caio',
      classId: 'tita',
      level: 4,
      mapId: 'floresta',
      hours: 1,
      bag: [{ uid: 'c1', baseId: 'pocao_hp_p', qty: 5 }],
      buckets: [bucket(400, 25, 30, 6, 4, { 'pocao_hp_p|comum': 1 })],
    }),
  },
];

/** Roda todos os cenários com o core dado e devolve um objeto só com dados (comparável por JSON). */
export function runScenarios(core) {
  const maps = core.loadBundledMaps();
  const out = {};
  for (const sc of SCENARIOS) {
    const r = core.applyOfflineOnServer(maps, JSON.parse(JSON.stringify(sc.save)), core.fixedClock(sc.serverNow));
    const merchant = r.world.merchantStock();
    out[sc.id] = JSON.parse(JSON.stringify({ offline: r.offline, save: r.save, merchant }));
  }
  return out;
}
