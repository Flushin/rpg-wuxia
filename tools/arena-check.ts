// Verificação headless da arena do Porto Noturno (docs/decisoes/arena.md): regras (poder 80–130%, ELO, moeda),
// entrada pelo Mestre da Arena, luta real no World contra o bot, derrota sem morte, volta ao Porto, títulos, save e
// a simulação de vitórias (o ponto de 50% fica dentro da faixa de poder: o ELO leva cada jogador até ele).
// Uso: npm run check:arena  (--sim mostra a tabela completa)
import { readFileSync } from 'node:fs';
import { CLASSES, SECT_ORDER } from '../src/core/data';
import { MAP_IDS } from '../src/core/mapsConfig';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import { Rng } from '../src/core/rng';
import { BASES, SLOTS, equipmentBaseIds, makeEquipment, makePotion } from '../src/core/items';
import {
  ARENA_POWER_MAX,
  ARENA_POWER_MIN,
  ARENA_START,
  ARENA_TITLES,
  arenaDelta,
  arenaPower,
  ARENA_COUNTDOWN,
  basicDps,
} from '../src/core/arena';
import { ARENA_RETURN, enterArena } from '../src/core/world/arena';
import { TRIAL_MAP } from '../src/core/trial';
import { bal } from '../src/core/balance';
import type { SaveData } from '../src/core/types';

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

/** Jogador no Porto: atributos pelo recomendado, skills no nível, equipamento incomum do nível (como os bots). */
function player(classId: string, level: number, seed: number): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId: 'porto',
    gold: 0,
    lastSeen: NOW,
  } as SaveData;
  const w = World.fromSave(maps, s, NOW, false);
  const priv = w as unknown as { rng: Rng; recalc: (e: unknown, k: boolean) => void };
  priv.rng = new Rng(seed * 7919 + 13);
  w.freePoints = 0;
  w.distributeRecommended();
  for (const st of Object.values(w.skills)) st.level = Math.max(st.level, Math.min(15, Math.floor(level / 4)));
  for (const sl of SLOTS) {
    const ids = equipmentBaseIds(sl).filter(
      (b) => BASES[b].reqLevel <= level && (!BASES[b].sect || BASES[b].sect === classId),
    );
    const top = Math.max(...ids.map((b) => BASES[b].reqLevel));
    const id = ids.find((b) => BASES[b].reqLevel === top)!;
    w.equipment[sl] = makeEquipment(id, 'incomum', c.element, priv.rng, top);
  }
  priv.recalc(w.player, false);
  w.player.hp = w.player.derived.maxHp;
  w.player.mana = w.player.derived.maxMana;
  w.addItem(makePotion('pocao_hp_p', 6));
  w.addItem(makePotion('pocao_mp_p', 6));
  return w;
}
const mestre = (w: World) => w.npcs.find((n) => n.npcId === 'mestre_arena')!;

/** Luta com uma política simples de jogador (alvo, skills, poções), como a simulação dos chefes. */
const fightTimes: number[] = [];
function fight(w: World): boolean | null {
  const DT = 1 / 30;
  for (let i = 0; i < 200 / DT; i++) {
    w.tick(DT);
    const evs = w.events.splice(0);
    const r = evs.find((e) => e.type === 'arenaResult');
    if (r && r.type === 'arenaResult') {
      fightTimes.push(i * DT - ARENA_COUNTDOWN);
      return r.win;
    }
    const f = w.arenaFight;
    if (!f || f.over) continue;
    const p = w.player,
      b = f.bot.e;
    if (w.targetId !== b.id) {
      w.setTarget(b.id);
      w.attackNearest();
    }
    for (let slot = w.activeSkills().length - 1; slot >= 0; slot--) {
      const d = w.activeSkills()[slot];
      if (!w.isUnlocked(d) || w.skills[d.id].cd > 0 || w.gcd > 0 || p.mana < (d.mana ?? 0)) continue;
      w.useSkill(slot);
      break;
    }
  }
  return null;
}

console.log('\n== regras ==');
ok(arenaPower(ARENA_START) === 1, 'poder 100% com 1000 pontos');
ok(arenaPower(0) === ARENA_POWER_MIN && arenaPower(5000) === ARENA_POWER_MAX, 'poder sempre entre 80% e 130%');
ok(arenaDelta(1000, 1000, true) === 20 && arenaDelta(1000, 1000, false) === -20, 'força igual: +20 / −20');
ok(arenaDelta(1000, 1150, true) > arenaDelta(1000, 850, true), 'vencer bot mais forte vale mais');
ok(
  [0, 500, 1000, 2000].every((p) =>
    [true, false].every((v) => {
      const d = Math.abs(arenaDelta(p, p + 400, v));
      return d >= 10 && d <= 30;
    }),
  ),
  'pontos por luta entre 10 e 30',
);

console.log('\n== luta ==');
{
  const w = player('lamina', 50, 1);
  ok(!!mestre(w), 'Mestre da Arena no Porto Noturno');
  ok(w.enterArena()?.code === 'talkToArena', 'só entra falando com o Mestre');
  w.openNpcWindow(mestre(w));
  const atk0 = w.player.derived.physAtk,
    hp0 = w.player.derived.maxHp;
  ok(w.enterArena() === null && w.mapId === TRIAL_MAP && !!w.arenaFight, 'entra na arena');
  const f = w.arenaFight!,
    b = f.bot.e;
  ok(f.bot.classId !== 'lamina' && w.monsters.includes(b), `bot de outra seita (${f.bot.classId}) no círculo`);
  ok(!w.usePotion('hp') && f.bot.potions.hp === 0 && f.bot.potions.mp === 0, 'ninguém usa poção na arena');
  ok(w.player.derived.physAtk === atk0 && w.player.derived.maxHp === hp0, 'o poder do jogador não muda');
  ok(
    Math.abs(b.derived.maxHp / w.player.derived.maxHp - Math.sqrt(f.power * bal('arena.poder_bot', 'lamina'))) < 0.02 &&
      Math.abs(b.derived.spiritAtk / w.player.derived.physAtk - Math.sqrt(f.power * bal('arena.poder_bot', 'lamina'))) <
        0.02 &&
      b.derived.critChance === w.player.derived.critChance,
    `bot com ${Math.round(f.power * 100)}% do poder (vida e ataque × raiz, mesmo crítico)`,
  );
  const evs: string[] = [];
  let win: boolean | null = null;
  for (let i = 0; i < 200 * 30 && win === null; i++) {
    w.tick(1 / 30);
    for (const e of w.events.splice(0)) {
      evs.push(e.type);
      if (e.type === 'arenaResult') win = e.win;
    }
    if (w.targetId !== b.id) {
      w.setTarget(b.id);
      w.attackNearest();
    }
  }
  ok(evs.includes('skillCast') && evs.includes('hit'), 'bot luta (golpes e skills)');
  ok(win !== null, `luta termina (${win ? 'vitória' : 'derrota'})`);
  ok(!w.player.dead && !evs.includes('playerDeath'), 'ninguém morre na arena');
  const a = w.arena;
  ok(a.wins + a.losses === 1 && a.points !== ARENA_START && a.coins > 0, `placar, pontos (${a.points}) e moedas`);
  for (let i = 0; i < 4 * 30; i++) w.tick(1 / 30);
  ok(
    w.mapId === ARENA_RETURN.map && !w.arenaFight && w.player.hp === w.player.derived.maxHp,
    'volta ao Porto com vida cheia',
  );
}
{
  const w = player('tita', 50, 2);
  w.openNpcWindow(mestre(w));
  enterArena(w, { power: 1.3 });
  w.player.hp = 1;
  w.killPlayer();
  ok(!w.player.dead && w.arena.losses === 1, 'cair na arena = derrota, sem morte nem penalidade');
  const w2 = player('tita', 50, 3);
  w2.openNpcWindow(mestre(w2));
  enterArena(w2);
  w2.changeMap('porto');
  w2.tick(1 / 30);
  ok(w2.arena.losses === 1 && !w2.arenaFight, 'sair no meio da luta conta como derrota');
}

for (const [me, foe, what] of [
  ['tita', 'pavilhao', 'bot de longe faz kite (recua e anda de lado)'],
  ['pavilhao', 'tita', 'bot de perto dá fugidas com as skills em recarga'],
]) {
  const w = player(me, 50, 9);
  w.openNpcWindow(mestre(w));
  enterArena(w, { classId: foe, power: 1 });
  const b = w.arenaFight!.bot.e;
  let away = 0;
  for (let i = 0; i < 30 * 30 && w.arenaFight && !w.arenaFight.over; i++) {
    const d0 = Math.hypot(b.x - w.player.x, b.y - w.player.y);
    w.tick(1 / 30);
    w.events.length = 0;
    if (w.arenaFight!.move.left > 0 && Math.hypot(b.x - w.player.x, b.y - w.player.y) >= d0 - 0.01) away++;
    if (w.targetId !== b.id) {
      w.setTarget(b.id);
      w.attackNearest();
    }
  }
  ok(away > 30, `${what} (${away} quadros)`);
}

console.log('\n== títulos e save ==');
{
  const w = player('vibora', 50, 4);
  w.openNpcWindow(mestre(w));
  const cheap = Object.keys(ARENA_TITLES).find((id) => ARENA_TITLES[id].minPoints === 0)!,
    ranked = Object.keys(ARENA_TITLES).find((id) => ARENA_TITLES[id].minPoints > ARENA_START)!;
  ok(w.buyArenaTitle(cheap)?.code === 'arenaCoins', 'sem moeda não compra');
  w.arena.coins = 99999;
  ok(w.buyArenaTitle(ranked)?.code === 'arenaPoints', 'título de ranking pede pontos');
  ok(
    w.buyArenaTitle(cheap) === null && w.player.title === ARENA_TITLES[cheap].name,
    'compra e usa o título (aparece no nome)',
  );
  w.wearArenaTitle(null);
  ok(!w.player.title, 'tira o título');
  w.wearArenaTitle(cheap);
  const s = JSON.parse(JSON.stringify(w.serialize())) as SaveData;
  const back = World.fromSave(maps, s, NOW, false);
  ok(
    back.arena.titles.includes(cheap) && back.arena.title === cheap && back.player.title === ARENA_TITLES[cheap].name,
    'título salvo',
  );
  delete (s as { arena?: unknown }).arena;
  const old = World.fromSave(maps, s, NOW, false);
  ok(old.arena.points === ARENA_START && old.arena.titles.length === 0, 'save antigo: começa com 1000 pontos');
}

console.log('\n== simulação (vitórias por poder do bot) ==');
{
  const SIM = process.argv.includes('--sim'),
    seeds = SIM ? 6 : 2,
    powers = [ARENA_POWER_MIN, 1, ARENA_POWER_MAX];
  const total: Record<number, [number, number]> = {};
  for (const cls of SECT_ORDER) {
    const row: string[] = [];
    for (const pw of powers) {
      let wins = 0,
        n = 0;
      for (const foe of SECT_ORDER.filter((c) => c !== cls))
        for (let s = 1; s <= seeds; s++) {
          const w = player(cls, 50, s * 31 + powers.indexOf(pw));
          w.openNpcWindow(mestre(w));
          enterArena(w, { classId: foe, power: pw });
          const r = fight(w);
          if (r) wins++;
          n++;
        }
      total[pw] = [(total[pw]?.[0] ?? 0) + wins, (total[pw]?.[1] ?? 0) + n];
      row.push(`${Math.round(pw * 100)}%: ${wins}/${n}`);
    }
    const avg = fightTimes.splice(0).reduce((a, b) => a + b, 0) / (powers.length * (SECT_ORDER.length - 1) * seeds);
    console.log(`  ${CLASSES[cls].name}: ${row.join('  ')}  (luta média ${Math.round(avg)} s)`);
  }
  const rate = (pw: number) => total[pw][0] / total[pw][1];
  ok(
    rate(ARENA_POWER_MIN) > 0.5,
    `bot com 80%: jogador vence mais da metade (${Math.round(rate(ARENA_POWER_MIN) * 100)}%)`,
  );
  ok(
    rate(ARENA_POWER_MAX) < 0.5,
    `bot com 130%: jogador vence menos da metade (${Math.round(rate(ARENA_POWER_MAX) * 100)}%)`,
  );
}

if (fails) {
  console.error(`\narena-check: ${fails} falha(s)`);
  process.exit(1);
}
console.log('\narena-check: tudo ok');
