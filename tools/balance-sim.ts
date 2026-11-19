// Simulação de balanceamento: cada seita caça sozinha (core + auto reais) do nível 1 ao 10 e depois enfrenta o General.
// Uso: npm run sim:balance [-- --seeds=3 --max=120]
import { isWalkable } from '../src/core/pathfinding';
import { readFileSync, writeFileSync } from 'node:fs';
import { CLASSES, MONSTERS } from '../src/core/data';
import { BASES, SLOTS, equipmentBaseIds, itemStats, makeEquipment, makePotion, isBroken } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { Rng } from '../src/core/rng';
import { TRIAL_BOSSES, TRIAL_MAP, trialBossLevel } from '../src/core/trial';
import { World } from '../src/core/world';
import { inTelegraph, safeSpot } from '../src/core/world/boss';
import type { GameEvent, ItemInstance, Rarity, SaveData } from '../src/core/types';

const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta', 'ruinas', 'montanha', 'gruta', 'mosteiro', 'covil', 'trial'])
  maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
const arg = (k: string, d: number) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const SEEDS = arg('seeds', 3),
  MAX_MIN = arg('max', 120),
  RUINS_LEVEL = arg('ruinas', 7);
const DT = 1 / 30;
const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const DEBUG_DEATHS = process.argv.includes('--deaths');
const QUESTS_ON = !process.argv.includes('--sem-missoes'); // marco 7: cadeia de missões (aceita/entrega na hora)
const priv = (w: World) => w as unknown as { rng: Rng; recalc: (e: unknown, k: boolean) => void };
// Relógio simulado: o World usa o relógio "real" (ms) para o renascimento de monstros fora do mapa e do chefe.
// No simulador o tempo de jogo corre muito mais rápido que o real, então o relógio acompanha w.time.
// Isso também deixa a simulação determinística (mesma semente = mesmo resultado, em qualquer computador).
const SIM_EPOCH_MS = Date.UTC(2026, 0, 1);
const useSimClock = (w: World) => {
  w.clock = () => SIM_EPOCH_MS + w.time * 1000;
};

// pontuação simples de equipamento para o "jogador médio" decidir o que vestir
function score(it: ItemInstance, classId: string): number {
  const phys = CLASSES[classId].damageType === 'physical';
  const wts: Record<string, number> = {
    strength: phys ? 3 : 0.3,
    intelligence: phys ? 0.3 : 3,
    stamina: 2,
    agility: 2,
    willpower: phys ? 1 : 2,
    physAtk: phys ? 1.5 : 0,
    spiritAtk: phys ? 0 : 1.5,
    maxHp: 0.1,
    maxMana: 0.1,
    physDef: 0.8,
    spiritDef: 0.6,
    hit: 0.3,
    evasion: 0.3,
    critChance: 100,
    critDamage: 20,
  };
  let v = 0;
  for (const [k, n] of Object.entries(itemStats(it))) v += (wts[k] ?? 0.5) * n;
  return v;
}

interface Run {
  classId: string;
  levelAt: number[];
  deaths: number;
  goldEarned: number;
  goldSpent: { potions: number; repair: number };
  kills: number;
  minutes: number;
  levelDeaths: number[];
  ruinsAt: number;
  levelKills: number[];
  levelXp: number[];
  levelGold: number[];
  quests: number;
}

function huntRun(classId: string, seed: number): Run {
  const w = World.create(maps, 'Sim', classId);
  priv(w).rng = new Rng(seed * 7919 + 13);
  useSimClock(w);
  const run: Run = {
    classId,
    levelAt: [0],
    deaths: 0,
    goldEarned: 0,
    goldSpent: { potions: 0, repair: 0 },
    kills: 0,
    minutes: 0,
    levelDeaths: Array(11).fill(0),
    ruinsAt: 0,
    levelKills: Array(11).fill(0),
    levelXp: Array(11).fill(0),
    levelGold: Array(11).fill(0),
    quests: 0,
  };
  const onEv = (ev: GameEvent) => {
    if (ev.type === 'levelup') run.levelAt[ev.level - 1] = w.time / 60;
    else if (ev.type === 'playerDeath') {
      run.deaths++;
      run.levelDeaths[w.player.level]++;
      if (DEBUG_DEATHS)
        console.log(
          `morte ${classId} nv${w.player.level} t=${(w.time / 60).toFixed(1)}m ${w.mapId} [${w.auto.status}] pots=${w.kindCount('hp')} perto: ${w.monsters
            .filter((m) => !m.dead && Math.hypot(m.x - w.player.x, m.y - w.player.y) < 8)
            .map((m) => m.name.split(' ').pop() + m.level + m.ai[0])
            .join(',')}`,
        );
    } else if (ev.type === 'goldPickup') {
      run.goldEarned += ev.amount;
      run.levelGold[w.player.level] += ev.amount;
    } else if (ev.type === 'xp') run.levelXp[w.player.level] += ev.amount;
    else if (ev.type === 'trade') {
      if (ev.kind === 'buy') run.goldSpent.potions += ev.gold;
      else run.goldEarned += ev.gold;
    } else if (ev.type === 'repair') run.goldSpent.repair += ev.gold;
    else if (ev.type === 'kill') {
      run.kills++;
      run.levelKills[w.player.level]++;
    }
  };
  w.auto.toggle();
  let nextPolicy = 0;
  const steps = Math.floor((MAX_MIN * 60) / DT);
  for (let i = 0; i < steps; i++) {
    w.tick(DT);
    for (const ev of w.events.splice(0)) onEv(ev);
    if (w.time < nextPolicy) continue;
    nextPolicy = w.time + 1;
    policy(w, run);
    if (w.player.level >= 10 && w.time / 60 - (run.levelAt[9] ?? 0) > 5) break; // 5 min extras no nível 10 para medir ouro/h
  }
  run.minutes = w.time / 60;
  return run;
}

// o jogador médio: gasta pontos, veste upgrades, conserta e vende sobras na vila, vai às ruínas no nível certo
function policy(w: World, run: Run) {
  if (w.freePoints > 0) w.distributeRecommended();
  if (QUESTS_ON) {
    // a viagem até o NPC é ignorada (o jogador entrega quando passa pela cidade); conversa = cumprida na hora
    const v = w.questView();
    if (v.phase === 'available') w.questAccept(true);
    if (w.questView().phase === 'active' && w.questTalkTarget())
      (w as unknown as { questTalk: (id: string) => void }).questTalk(w.questTalkTarget());
    if (w.questView().phase === 'ready') {
      w.questTurnIn(true);
      run.quests++;
    }
  }
  for (let i = 0; i < w.bag.length; i++) {
    const it = w.bag[i];
    if (!it || !BASES[it.baseId] || w.canEquip(it) || isBroken(it)) continue;
  }
  for (let i = 0; i < w.bag.length; i++) {
    const it = w.bag[i];
    if (!it || !BASES[it.baseId] || w.canEquip(it) || isBroken(it)) continue;
    const cur = w.equipment[BASES[it.baseId].slot];
    if (!cur || isBroken(cur) || score(it, w.classId) > score(cur, w.classId) * 1.05) {
      w.equip(i);
    }
  }
  if (w.mapId === 'cidade') {
    const smith = w.npcs.find((n) => w.npcRole(n) === 'ferreiro'),
      shop = w.npcs.find((n) => w.npcRole(n) === 'vendedor');
    if (smith && w.repairAllCost() > 0 && w.gold >= w.repairAllCost()) {
      w.openNpc = smith;
      w.repairAll();
      w.openNpc = null;
    }
    if (shop && w.freeSlots() < 10) {
      w.openNpc = shop;
      for (let i = 0; i < w.bag.length; i++) {
        const it = w.bag[i];
        if (it && BASES[it.baseId]) w.sell(i, 1);
      }
      w.openNpc = null;
    }
    if (w.auto.state === 'off') w.auto.toggle(); // item quebrado parou o auto: já consertou, volta
  } else if (w.mapId === 'floresta' && w.player.level >= RUINS_LEVEL && !w.player.dead && w.auto.status === 'Caçando') {
    if (!run.ruinsAt) run.ruinsAt = w.time / 60;
    w.changeMap('ruinas', 4.5, 16.5); // atravessar a floresta leva ~20 s; ignorado
    w.auto.huntMap = 'ruinas'; // como o jogador que liga o Auto nas Ruínas (senão ele volta para a floresta)
  }
}

// ---------- chefe ----------
interface BossRun {
  classId: string;
  tier: string;
  win: boolean;
  seconds: number;
  potions: number;
  deaths: number;
  hpLeftPct: number;
}
function bossFight(classId: string, seed: number, rarity: Rarity, trace = false): BossRun {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * 9;
  // carrega na cidade (sem monstros), fixa semente e relógio e só então entra nas Ruínas: os monstros nascem com a semente
  const s: SaveData = {
    version: 1,
    name: 'Sim',
    classId,
    level: 10,
    xp: 0,
    freePoints: 27,
    attributes: attrs,
    mapId: 'cidade',
    lastSeen: 0,
  };
  const w = World.fromSave(maps, s, SIM_EPOCH_MS, false);
  priv(w).rng = new Rng(seed * 104729 + 7);
  useSimClock(w);
  w.changeMap('ruinas');
  w.distributeRecommended();
  for (const sl of SLOTS) {
    const id = equipmentBaseIds(sl).find(
      (b) => BASES[b].reqLevel === 5 && (!BASES[b].sect || BASES[b].sect === classId),
    )!;
    w.equipment[sl] = makeEquipment(id, rarity, c.element, priv(w).rng, 5);
  }
  priv(w).recalc(w.player, false);
  w.player.hp = w.player.derived.maxHp;
  w.player.mana = w.player.derived.maxMana;
  return fightBoss(w, classId, rarity, trace);
}

function fightBoss(w: World, classId: string, rarity: Rarity, trace: boolean): BossRun {
  const c = CLASSES[classId];
  w.addItem(makePotion('pocao_hp_g', 8));
  w.addItem(makePotion('pocao_hp_p', 10));
  w.addItem(makePotion('pocao_mp_g', 4));
  w.addItem(makePotion('pocao_mp_p', 6));
  const boss = w.monsters.find((m) => !!MONSTERS[m.monsterId].boss)!;
  const hpMax = boss.derived.maxHp;
  w.player.x = boss.x - 6;
  w.player.y = boss.y;
  if (!isWalkable(w.map, w.player.x, w.player.y)) {
    // masmorra: arena fechada; entra pela porta sul
    w.player.x = boss.x + 0.5;
    w.player.y = boss.y + 6;
  }
  w.player.path = [];
  // poções contadas pelo uso (contar a mochila dava número negativo quando o jogador pegava poção caída)
  let potionsUsed = 0;
  let deaths = 0,
    react = 0.45,
    seenTele = new Map<number, number>();
  for (let i = 0; i < 600 / DT; i++) {
    w.tick(DT);
    for (const ev of w.events.splice(0)) {
      if (ev.type === 'playerDeath') deaths++;
      if (ev.type === 'potionUsed') potionsUsed++;
      if (trace && ev.type === 'hit' && ev.targetKind === 'player')
        console.log(`  ${w.time.toFixed(1)}s dano ${ev.amount}`);
      if (trace && ev.type === 'telegraphResolved')
        console.log(`  ${w.time.toFixed(1)}s telegrafo ${ev.hit ? 'ACERTOU' : 'errou'}`);
    }
    if (deaths) break;
    if (boss.dead) break;
    const p = w.player;
    if (trace && i % 30 === 0)
      console.log(
        `${w.time.toFixed(0)}s hp ${Math.round(p.hp)}/${p.derived.maxHp} mp ${Math.round(p.mana)} boss ${Math.round(boss.hp)} p=(${p.x.toFixed(1)},${p.y.toFixed(1)}) path=${p.path.length} b=(${boss.x.toFixed(1)},${boss.y.toFixed(1)}) d=${Math.hypot(boss.x - p.x, boss.y - p.y).toFixed(1)} tele=${w.telegraphs.length} adds=${w.monsters.filter((m) => m.summoned && !m.dead).length} pots=${w.kindCount('hp')}`,
      );
    // beber só se não há efeito em andamento (ou vida crítica): beber de novo reinicia o efeito
    if (p.hp < p.derived.maxHp * 0.55 && w.potionCd.hp <= 0 && (!w.potionFx.hp || p.hp < p.derived.maxHp * 0.2))
      w.usePotion('hp');
    if (p.mana < p.derived.maxMana * 0.25 && w.potionCd.mp <= 0 && !w.potionFx.mp) w.usePotion('mp');
    // esquiva: depois do tempo de reação, sai do círculo
    let dodging = false;
    for (const t of w.telegraphs) {
      const age = t.delay - t.remaining;
      if (age < react) {
        dodging = dodging || false;
        continue;
      }
      if (t.shape === 'line' && inTelegraph(t, p, 0.2)) {
        // linha: o lugar livre mais perto (para o lado)
        const q = safeSpot(w, p);
        if (q) w.moveTo(q.x, q.y);
        dodging = true;
        seenTele.set(t.id, 1);
      } else if (t.shape !== 'line' && Math.hypot(p.x - t.x, p.y - t.y) <= t.radius + 0.2) {
        const a = Math.atan2(p.y - t.y, p.x - t.x) || 0;
        w.moveTo(t.x + Math.cos(a) * (t.radius + 1.3), t.y + Math.sin(a) * (t.radius + 1.3));
        dodging = true;
        seenTele.set(t.id, 1);
      }
    }
    if (dodging) continue;
    // ranged: recua se algum monstro chegar perto (chefe e guerreiros invocados são lentos)
    if (c.attackWhileMoving) {
      const threat = w.monsters
        .filter((m) => !m.dead && m.ai === 'chase')
        .map((m) => ({ m, d: Math.hypot(m.x - p.x, m.y - p.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (threat && threat.d < 3.8) {
        // foge do monstro dando a volta na arena (sair dela faz o chefe desistir e curar): fuga + tangente + puxão ao centro perto da borda
        let ax = p.x - threat.m.x,
          ay = p.y - threat.m.y;
        const al = Math.hypot(ax, ay) || 1;
        ax /= al;
        ay /= al;
        const cx = boss.home.x - p.x,
          cy = boss.home.y - p.y,
          cl = Math.hypot(cx, cy) || 1,
          ux = cx / cl,
          uy = cy / cl;
        let tx = -uy,
          ty = ux;
        if (tx * ax + ty * ay < 0) {
          tx = -tx;
          ty = -ty;
        }
        const edge = Math.max(0, (cl - 3) / 2.5);
        let dx = ax * 0.7 + tx * 0.9 + ux * edge * 2.5,
          dy = ay * 0.7 + ty * 0.9 + uy * edge * 2.5;
        const dn = Math.hypot(dx, dy) || 1;
        w.moveTo(p.x + (dx / dn) * 3, p.y + (dy / dn) * 3);
        w.setTarget(boss.id);
        continue;
      }
    }
    if (w.getTarget()?.id !== boss.id) w.setTarget(boss.id);
    for (let slot = w.activeSkills().length - 1; slot >= 0; slot--) {
      const d = w.activeSkills()[slot];
      if (!w.isUnlocked(d) || w.skills[d.id].cd > 0 || w.gcd > 0 || p.mana < (d.mana ?? 0) || d.shield) continue;
      if (d.shield) continue;
      w.useSkill(slot);
      break;
    }
  }
  return {
    classId,
    tier: rarity,
    win: boss.dead,
    seconds: w.time,
    potions: potionsUsed,
    deaths,
    hpLeftPct: Math.round((100 * Math.max(0, boss.hp)) / hpMax),
  };
}

// ---------- marco 9: do nível 10 ao 20 na Montanha Nevada ----------
// Personagem pronto no nível 10 (pontos pelo recomendado, skills no nível 5, equipamento nv 5 Incomum, missões
// do marco 9 liberadas), Auto ligado na vila. O jogador médio do policy() veste o que cair, conserta e vende.
function highWorld(
  classId: string,
  level: number,
  seed: number,
  gearLevel: number,
  rarity: Rarity,
  ilvl = gearLevel,
): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s: SaveData = {
    version: 1,
    name: 'Sim',
    classId,
    level,
    xp: 0,
    freePoints: 3 * (level - 1),
    attributes: attrs,
    mapId: 'cidade',
    lastSeen: 0,
    gold: 500,
    quest: { stage: 8, status: 'pending', progress: 0 },
  };
  const w = World.fromSave(maps, s, SIM_EPOCH_MS, false);
  priv(w).rng = new Rng(seed * 7919 + 101);
  useSimClock(w);
  w.distributeRecommended();
  for (const st of Object.values(w.skills)) st.level = Math.max(st.level, level >= 20 ? 10 : 5);
  for (const sl of SLOTS) {
    const id = equipmentBaseIds(sl).find(
      (b) => BASES[b].reqLevel === gearLevel && (!BASES[b].sect || BASES[b].sect === classId),
    )!;
    w.equipment[sl] = makeEquipment(id, rarity, c.element, priv(w).rng, ilvl);
  }
  priv(w).recalc(w.player, false);
  w.player.hp = w.player.derived.maxHp;
  w.player.mana = w.player.derived.maxMana;
  w.addItem(makePotion('pocao_hp_g', 10));
  w.addItem(makePotion('pocao_mp_g', 6));
  return w;
}

function highRun(classId: string, seed: number): Run {
  const w = highWorld(classId, 10, seed, 5, 'incomum');
  const run: Run = {
    classId,
    levelAt: Array(20).fill(NaN),
    deaths: 0,
    goldEarned: 0,
    goldSpent: { potions: 0, repair: 0 },
    kills: 0,
    minutes: 0,
    levelDeaths: Array(21).fill(0),
    ruinsAt: 0,
    levelKills: Array(21).fill(0),
    levelXp: Array(21).fill(0),
    levelGold: Array(21).fill(0),
    quests: 0,
  };
  run.levelAt[9] = 0;
  w.auto.toggle();
  let nextPolicy = 0;
  for (let i = 0; i < (MAX_MIN * 60) / DT; i++) {
    w.tick(DT);
    for (const ev of w.events.splice(0)) {
      if (ev.type === 'levelup') run.levelAt[ev.level - 1] = w.time / 60;
      else if (ev.type === 'playerDeath') {
        run.deaths++;
        run.levelDeaths[w.player.level]++;
        if (DEBUG_DEATHS)
          console.log(
            `morte ${classId} nv${w.player.level} t=${(w.time / 60).toFixed(1)}m perto: ${w.monsters
              .filter((m) => !m.dead && Math.hypot(m.x - w.player.x, m.y - w.player.y) < 8)
              .map((m) => m.monsterId + m.level + m.ai[0])
              .join(',')}`,
          );
      } else if (ev.type === 'goldPickup') {
        run.goldEarned += ev.amount;
        run.levelGold[w.player.level] += ev.amount;
      } else if (ev.type === 'xp') run.levelXp[w.player.level] += ev.amount;
      else if (ev.type === 'trade') {
        if (ev.kind === 'buy') run.goldSpent.potions += ev.gold;
        else run.goldEarned += ev.gold;
      } else if (ev.type === 'repair') run.goldSpent.repair += ev.gold;
      else if (ev.type === 'kill') {
        run.kills++;
        run.levelKills[w.player.level]++;
      }
    }
    if (w.time < nextPolicy) continue;
    nextPolicy = w.time + 1;
    if (process.argv.includes('--status') && Math.round(w.time) % 30 === 0)
      console.log(
        `${classId} ${(w.time / 60).toFixed(1)}m nv${w.player.level} ${w.mapId} [${w.auto.status}] hp ${Math.round(w.player.hp)}/${w.player.derived.maxHp} pos ${w.player.x.toFixed(1)},${w.player.y.toFixed(1)} alvo ${w.getTarget()?.monsterId ?? '-'}${w.getTarget()?.level ?? ''} pots ${w.kindCount('hp')} ouro ${w.gold}`,
      );
    policy(w, run);
    if (w.player.level >= 20) break;
  }
  run.minutes = w.time / 60;
  return run;
}

function abbotFight(classId: string, seed: number, rarity: Rarity): BossRun {
  const w = highWorld(classId, 20, seed, 15, rarity);
  w.changeMap('montanha');
  return fightBoss(w, classId, rarity, false);
}

// ---------- masmorra: chefe da masmorra ----------
// --masmorra (Desfiladeiro, Yeti Ancestral): níveis 11/13/15 com equipamento nv 10.
// --masmorra=mosteiro (Patriarca Profanado): níveis 16/18/20 com equipamento nv 15.
// --masmorra=covil (Rei dos Bandidos): nível 20 com equipamento nv 15.
// Os monstros comuns da masmorra já foram derrotados.
const masmorraArg = process.argv.find((a) => a.startsWith('--masmorra'));
if (masmorraArg) {
  const dungeonMap = masmorraArg.split('=')[1] || 'gruta';
  const [levels, gearLevel] =
    dungeonMap === 'covil' ? [[20], 15] : dungeonMap === 'mosteiro' ? [[16, 18, 20], 15] : [[11, 13, 15], 10];
  console.log(`masmorra ${dungeonMap}: equipamento nv ${gearLevel}`);
  console.log('| Seita | Nível | Equipamento | Vitórias | Tempo médio (s) | Poções | Vida restante se perdeu |');
  console.log('|---|---|---|---|---|---|---|');
  for (const classId of Object.keys(CLASSES))
    for (const level of levels)
      for (const tier of ['incomum', 'raro'] as Rarity[]) {
        const bs = Array.from({ length: Math.max(5, SEEDS * 2) }, (_, i) => {
          const w = highWorld(classId, level, i + 1, gearLevel, tier);
          w.changeMap(dungeonMap);
          for (const m of w.monsters)
            if (!MONSTERS[m.monsterId].boss) {
              m.dead = true;
              m.respawnAt = Infinity;
            }
          return fightBoss(w, classId, tier, process.argv.includes('--trace-masmorra') && i === 0);
        });
        const wins = bs.filter((b) => b.win),
          lost = bs.filter((b) => !b.win);
        console.log(
          `| ${CLASSES[classId].name} | ${level} | ${tier} | ${wins.length}/${bs.length} | ${fmt(mean(wins.map((b) => b.seconds)), 0)} | ${fmt(mean(bs.map((b) => b.potions)))} | ${lost.length ? fmt(mean(lost.map((b) => b.hpLeftPct)), 0) + '%' : '-'} |`,
        );
      }
  process.exit(0);
}

// ---------- Trial: chefes nível 21–30 (src/core/trial.ts) ----------
// --trial: cada chefe nos níveis 1/4/7/10 do Trial, personagem nível 20. Equipamento "nv 15": incomum nv 15 (quem
// acabou de chegar); "Trial": raro nv 15 com o nível de item do chefe anterior (o que o Trial dá ao subir).
// --trial=<id do chefe> roda só esse chefe; --tiers=1,2,3 escolhe os níveis.
const trialArg = process.argv.find((a) => a.startsWith('--trial'));
if (trialArg) {
  const only = trialArg.split('=')[1],
    tiersArg = process.argv.find((a) => a.startsWith('--tiers='));
  const tiers = tiersArg ? tiersArg.split('=')[1].split(',').map(Number) : [1, 4, 7, 10];
  const N = Math.max(4, SEEDS);
  console.log('| Chefe | Seita | ' + tiers.map((t) => `Nv ${t} (nv15 inc / Trial)`).join(' | ') + ' |');
  console.log('|---|---|' + tiers.map(() => '---|').join(''));
  for (const bossId of TRIAL_BOSSES.filter((b) => !only || b === only))
    for (const classId of Object.keys(CLASSES)) {
      const cells = tiers.map((tier) => {
        const res = (['base', 'trial'] as const).map((gear) => {
          const bs = Array.from({ length: N }, (_, i) => {
            const w =
              gear === 'base'
                ? highWorld(classId, 20, i + 1, 15, 'incomum')
                : highWorld(classId, 20, i + 1, 15, 'raro', trialBossLevel(tier) - 1);
            w.trialRun = { bossId, tier };
            w.changeMap(TRIAL_MAP);
            return fightBoss(w, classId, gear === 'base' ? 'incomum' : 'raro', false);
          });
          const wins = bs.filter((b) => b.win);
          return `${wins.length}/${N} ${wins.length ? fmt(mean(wins.map((b) => b.seconds)), 0) + 's ' + fmt(mean(wins.map((b) => b.potions)), 0) + 'p' : ''}`;
        });
        return res.join(' · ');
      });
      console.log(`| ${MONSTERS[bossId].name} | ${CLASSES[classId].name} | ${cells.join(' | ')} |`);
    }
  process.exit(0);
}

if (process.argv.includes('--m9')) {
  const N = SEEDS;
  console.log(
    '| Seita | ' + [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].join(' | ') + ' | Mortes | Ouro ganho | Conserto |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const classId of Object.keys(CLASSES)) {
    const rs = Array.from({ length: N }, (_, i) => highRun(classId, i + 1));
    const lv = (n: number) => fmt(mean(rs.map((r) => r.levelAt[n - 1])));
    console.log(
      `| ${CLASSES[classId].name} | ${[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(lv).join(' | ')} | ${fmt(mean(rs.map((r) => r.deaths)))} | ${fmt(mean(rs.map((r) => r.goldEarned)), 0)} | ${fmt(mean(rs.map((r) => r.goldSpent.repair)), 0)} |`,
    );
    if (process.argv.includes('--detail'))
      for (let L = 10; L < 20; L++) {
        const k = mean(rs.map((r) => r.levelKills[L])),
          x = mean(rs.map((r) => r.levelXp[L]));
        console.log(
          `   nv ${L}: abates ${fmt(k, 0)}, XP/abate ${fmt(x / k, 0)}, mortes ${fmt(mean(rs.map((r) => r.levelDeaths[L])))}`,
        );
      }
  }
  console.log('\nTempo (min) a partir do nível 10 para chegar a cada nível; média de ' + N + ' execuções.');
  console.log('\n| Seita | Equipamento nv 15 | Vitórias | Tempo médio (s) | Poções | Vida restante se perdeu |');
  console.log('|---|---|---|---|---|---|');
  for (const classId of Object.keys(CLASSES))
    for (const tier of ['incomum', 'raro'] as Rarity[]) {
      const bs = Array.from({ length: Math.max(5, N * 2) }, (_, i) => abbotFight(classId, i + 1, tier));
      const wins = bs.filter((b) => b.win),
        lost = bs.filter((b) => !b.win);
      console.log(
        `| ${CLASSES[classId].name} | ${tier} | ${wins.length}/${bs.length} | ${fmt(mean(wins.map((b) => b.seconds)), 0)} | ${fmt(mean(bs.map((b) => b.potions)))} | ${lost.length ? fmt(mean(lost.map((b) => b.hpLeftPct)), 0) + '%' : '-'} |`,
      );
    }
  process.exit(0);
}

if (process.argv.includes('--trace')) {
  const c = process.argv.find((x) => x.startsWith('--class='))?.split('=')[1] ?? 'lamina';
  console.log(bossFight(c, 1, 'incomum', true));
  process.exit(0);
}
// ---------- relatório ----------
const lines: string[] = [];
const out = (s = '') => {
  lines.push(s);
  console.log(s);
};

out('| Seita | Nível 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Mortes | Ouro/h | Ouro/h (nv 7+) |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const hunts: Run[] = [];
for (const classId of Object.keys(CLASSES)) {
  const rs = Array.from({ length: SEEDS }, (_, i) => huntRun(classId, i + 1));
  hunts.push(...rs);
  const lv = (n: number) => fmt(mean(rs.map((r) => r.levelAt[n - 1] ?? NaN)));
  const gph = mean(rs.map((r) => (r.goldEarned / r.minutes) * 60));
  out(
    `| ${CLASSES[classId].name} | ${[2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv).join(' | ')} | ${fmt(mean(rs.map((r) => r.deaths)))} | ${fmt(gph, 0)} | ${fmt(
      mean(
        rs.map((r) => {
          const t0 = r.levelAt[6] ?? 0;
          return t0 ? (r.goldEarned / Math.max(1, r.minutes - t0)) * 60 : NaN;
        }),
      ),
      0,
    )} |`,
  );
}
out();
out(
  'Tempo (min) para chegar a cada nível, média de ' +
    SEEDS +
    ' execuções; mortes = média total até ~5 min após o nível 10.',
);
if (process.argv.includes('--detail')) {
  for (const classId of Object.keys(CLASSES)) {
    const rs = hunts.filter((r) => r.classId === classId);
    out();
    out(`Detalhe por nível - ${CLASSES[classId].name} (média)`);
    out('| Nível | Minutos | Abates | Abates/min | XP/abate | Ouro/abate | Mortes |');
    out('|---|---|---|---|---|---|---|');
    for (let L = 1; L <= 10; L++) {
      const mins = mean(rs.map((r) => (r.levelAt[L] ?? NaN) - (r.levelAt[L - 1] ?? 0)));
      const k = mean(rs.map((r) => r.levelKills[L])),
        x = mean(rs.map((r) => r.levelXp[L])),
        g = mean(rs.map((r) => r.levelGold[L]));
      out(
        `| ${L} | ${fmt(mins)} | ${fmt(k, 0)} | ${fmt(k / mins)} | ${fmt(x / k)} | ${fmt(g / k)} | ${fmt(mean(rs.map((r) => r.levelDeaths[L])))} |`,
      );
    }
  }
}
out();
out('| Seita | Gasto em poções | Gasto em conserto | Conserto / ouro ganho |');
out('|---|---|---|---|');
for (const classId of Object.keys(CLASSES)) {
  const rs = hunts.filter((r) => r.classId === classId);
  const earned = mean(rs.map((r) => r.goldEarned)),
    rep = mean(rs.map((r) => r.goldSpent.repair)),
    pot = mean(rs.map((r) => r.goldSpent.potions));
  out(`| ${CLASSES[classId].name} | ${fmt(pot, 0)} | ${fmt(rep, 0)} | ${fmt((100 * rep) / earned, 1)}% |`);
}
out();
out(
  '| Seita | Equipamento nv 5 | Vitórias | Tempo médio (s) | Poções usadas | Mortes | Vida restante do chefe se perdeu |',
);
out('|---|---|---|---|---|---|---|');
for (const classId of Object.keys(CLASSES))
  for (const tier of ['incomum', 'raro'] as Rarity[]) {
    const bs = Array.from({ length: Math.max(5, SEEDS * 2) }, (_, i) => bossFight(classId, i + 1, tier));
    const wins = bs.filter((b) => b.win);
    const lost = bs.filter((b) => !b.win);
    out(
      `| ${CLASSES[classId].name} | ${tier} | ${wins.length}/${bs.length} | ${fmt(mean(wins.map((b) => b.seconds)), 0)} | ${fmt(mean(bs.map((b) => b.potions)))} | ${fmt(mean(bs.map((b) => b.deaths)))} | ${lost.length ? fmt(mean(lost.map((b) => b.hpLeftPct)), 0) + '%' : '-'} |`,
    );
  }
const jsonArg = process.argv.find((x) => x.startsWith('--json='));
if (jsonArg) {
  const per = Array.from({ length: 9 }, (_, i) =>
    mean(hunts.map((r) => (r.levelAt[i + 1] ?? NaN) - (r.levelAt[i] ?? 0))),
  );
  writeFileSync(
    jsonArg.split('=')[1],
    JSON.stringify({
      perLevelMin: per,
      total: mean(hunts.map((r) => r.levelAt[9] ?? NaN)),
      deaths: mean(hunts.map((r) => r.deaths)),
    }),
  );
}
if (process.argv.includes('--md')) console.error('\n(tabelas acima em Markdown)');
