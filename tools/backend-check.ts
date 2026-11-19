// Protótipo do backend (roadmap M0): confere a lógica do servidor (backend/shared/saveSync.ts), igual para Supabase
// e Firebase. Não precisa de conta nem de internet. Uso: npm run check:backend
import { readFileSync } from 'node:fs';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import { ManualClock } from '../src/core/clock';
import { Rng } from '../src/core/rng';
import { CLASSES } from '../src/core/data';
import { QUESTS } from '../src/core/quests';
import type { SaveData } from '../src/core/types';
import { acceptUpload, openCharacter, totalXp, type StoredCharacter } from '../backend/shared/saveSync';

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
const NOW = 1_800_000_000_000,
  MIN = 60_000,
  HOUR = 60 * MIN;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function baseSave(): SaveData {
  const c = CLASSES.lamina,
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * 5;
  attrs.stamina += 200;
  return {
    version: 1,
    name: 'Nuvem',
    classId: 'lamina',
    level: 6,
    xp: 100,
    freePoints: 0,
    attributes: attrs,
    mapId: 'floresta',
    lastSeen: NOW,
    gold: 1000,
  };
}

const main = async () => {
  console.log('\n== primeiro envio ==');
  const r1 = await acceptUpload(null, 0, { ...baseSave(), lastSeen: 42 }, NOW);
  ok(r1.version === 1 && /^[0-9a-f]{64}$/.test(r1.checksum), 'versão 1 e checksum SHA-256');
  ok(r1.save.lastSeen === NOW && r1.serverSavedAt === NOW, 'lastSeen do aparelho ignorado: vale o relógio do servidor');
  ok(r1.flags.length === 0, 'save normal não é marcado');
  const again = await acceptUpload(null, 0, { ...baseSave(), lastSeen: 42 }, NOW);
  ok(again.checksum === r1.checksum, 'mesmo save = mesmo checksum');
  const junk = await acceptUpload(
    null,
    0,
    { ...baseSave(), gold: -50, level: 6, bag: [{ baseId: 'nao_existe' }] },
    NOW,
  );
  ok(junk.save.gold === 0 && !!junk.save.bag?.every((b) => b === null), 'save estranho é saneado pelo core');

  console.log('\n== jogo normal: 15 min de auto-combate ==');
  const clock = new ManualClock(NOW);
  const w = World.fromSave(maps, clone(r1.save), NOW, false, clock);
  (w as unknown as { rng: Rng }).rng = new Rng(4);
  w.auto.toggle();
  for (let i = 0; i < 15 * 60 * 60; i++) {
    w.tick(1 / 60);
    clock.advance(1000 / 60);
  }
  const played = w.serialize();
  const r2 = await acceptUpload(r1, 0, played, NOW + 15 * MIN);
  ok(
    totalXp(played.level, played.xp) > totalXp(r1.save.level, r1.save.xp),
    `ganhou XP jogando (nível ${r1.save.level} → ${played.level})`,
  );
  ok(r2.flags.length === 0, `jogo normal não é marcado${r2.flags.length ? ` (${r2.flags.join('; ')})` : ''}`);
  ok(r2.version === 2, 'versão sobe a cada envio');

  console.log('\n== trapaças (só marca, não bloqueia) ==');
  const rich = await acceptUpload(r2, 0, { ...clone(played), gold: played.gold! + 5_000_000 }, NOW + 16 * MIN);
  ok(
    rich.flags.some((f) => f.startsWith('ouro')),
    `ouro impossível é marcado (${rich.flags.join('; ')})`,
  );
  ok(rich.save.gold === played.gold! + 5_000_000, 'mesmo marcado, o envio é guardado (E4c começa só marcando)');
  const lvl = await acceptUpload(r2, 0, { ...clone(played), level: 19 }, NOW + 16 * MIN);
  ok(
    lvl.flags.some((f) => f.startsWith('XP')),
    `nível impossível é marcado (${lvl.flags.join('; ')})`,
  );
  const item = clone(played);
  item.bag = [
    { uid: 'x', baseId: 'colar_jade', rarity: 'raro', bonuses: [], ilvl: 60, durability: 50 },
    ...(item.bag ?? []).slice(1),
  ];
  const it = await acceptUpload(r2, 0, item, NOW + 16 * MIN);
  ok(
    it.flags.some((f) => f.startsWith('item')),
    `item de nível impossível é marcado (${it.flags.join('; ')})`,
  );
  const back = await acceptUpload(r2, 0, { ...clone(played), level: 2, xp: 0 }, NOW + 16 * MIN);
  ok(back.flags.includes('XP voltou para trás'), 'XP voltando para trás é marcado (save antigo de outro aparelho)');
  // missão entregue: a recompensa entra na folga
  const q0 = QUESTS[0];
  const withQuest = {
    ...clone(r1.save),
    gold: r1.save.gold! + q0.reward.gold,
    quest: { stage: 1, status: 'pending' as const, progress: 0 },
  };
  const rq = await acceptUpload(r1, 0, withQuest, NOW + 10_000);
  ok(rq.flags.length === 0, `ouro de missão entregue não é marcado (+${q0.reward.gold} em 10 s)`);

  console.log('\n== abrir o personagem: ganho offline com o relógio do servidor ==');
  const hunting: StoredCharacter = {
    ...r2,
    save: {
      ...r2.save,
      lastSeen: NOW - 1000 * HOUR, // aparelho mentindo: "estou fora há 1000 h"
      auto: {
        active: true,
        mapId: 'floresta',
        buckets: [{ sec: 600, kills: 50, xp: 2000, gold: 500, potHp: 2, potMp: 0, levelSum: 300, drops: {} }],
      },
    },
    serverSavedAt: NOW + 15 * MIN,
  };
  const o = await openCharacter(hunting, NOW + 15 * MIN + 2 * HOUR, true);
  ok(
    !!o.offline && Math.abs(o.offline.elapsedMs - 2 * HOUR) < 1000,
    'tempo offline = 2 h do servidor (não as 1000 h do aparelho)',
  );
  ok(
    o.row.version === hunting.version + 1 && o.row.serverSavedAt === NOW + 15 * MIN + 2 * HOUR,
    'abrir com ganho grava nova versão',
  );
  const o2 = await openCharacter(hunting, NOW + 15 * MIN + 2 * HOUR, true);
  ok(
    JSON.stringify(o.row.save) === JSON.stringify(o2.row.save),
    'abrir duas vezes no mesmo instante dá o mesmo resultado',
  );
  const notLast = await openCharacter(hunting, NOW + 15 * MIN + 2 * HOUR, false);
  ok(notLast.offline === null && notLast.row === hunting, 'só o último personagem jogado recebe ganho offline');

  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo.');
  process.exit(fails ? 1 : 0);
};
void main();
