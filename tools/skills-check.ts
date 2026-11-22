// Verificação headless das skills (não vai para o build do jogo).
// Uso: npm run check:skills
import { existsSync, readFileSync } from 'node:fs';
import { CLASSES } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { SKILLS, skillScale, skillXpToNext } from '../src/core/skills';
import { isWalkable } from '../src/core/pathfinding';
import { World } from '../src/core/world';
import { ULTIMATES } from '../src/core/ultimate';
import type { Entity, GameEvent, SaveData } from '../src/core/types';

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

// acha um ponto da floresta com ~12 tiles livres em volta e longe de portais
function openSpot(w: World): [number, number] {
  const m = w.map,
    portals = m.objects.filter((o) => o.type === 'portal');
  for (let y = 2; y < m.height - 2; y++)
    for (let x = 2; x < m.width - 14; x++) {
      if (portals.some((o) => Math.hypot(o.x - x, o.y - y) < 6)) continue;
      let good = true;
      for (let i = 0; i <= 11; i += 0.25)
        if (!isWalkable(m, x + i, y)) {
          good = false;
          break;
        }
      if (good) return [x + 0.5, y + 0.5];
    }
  throw new Error('sem área aberta');
}
function mk(classId: string, level = 9): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s: SaveData = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId: 'floresta',
    lastSeen: 0,
  };
  const w = World.fromSave(maps, s);
  const spot = openSpot(w);
  w.player.x = spot[0];
  w.player.y = spot[1];
  // rng determinístico: sempre acerta, nunca crita
  (w as any).rng = { next: () => 0.5, range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a }; // eslint-disable-line
  return w;
}
// direção (cos,sin) com chão livre por d+3 tiles a partir do jogador
const freeDir = (w: World, d: number): [number, number] => {
  const p = w.player;
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as [number, number][]) {
    let good = true;
    for (let k = 0; k <= d + 0.5; k += 0.25)
      if (!isWalkable(w.map, p.x + dx * k, p.y + dy * k)) {
        good = false;
        break;
      }
    if (good) return [dx, dy];
  }
  throw new Error('sem direção livre');
};
const wolfNear = (w: World, d: number, n = 1): Entity[] => {
  const out: Entity[] = [];
  const p = w.player;
  // posição livre perto do jogador
  for (let i = 0; i < n; i++) {
    const m = w.monsters[i];
    const [dx, dy] = freeDir(w, d);
    m.x = p.x + dx * (d + i * 0.8);
    m.y = p.y + dy * (d + i * 0.8);
    m.dead = false;
    m.hp = m.derived.maxHp = 100000;
    m.ai = 'idle';
    m.aiTimer = 999;
    m.buffs = [];
    m.attrs.agility = 0;
    m.derived.evasion = 0; // acerta sempre (hit 80+ => 95% max, repete se errar)
    out.push(m);
  }
  return out;
};
const run = (w: World, s: number) => {
  for (let i = 0; i < s * 60; i++) w.tick(1 / 60);
};
const drain = (w: World) => w.events.splice(0);
const dmgOf = (evs: GameEvent[], id: number) =>
  evs.filter((e) => e.type === 'hit' && e.targetId === id).reduce((a, e) => a + (e as { amount: number }).amount, 0);
const home = new WeakMap<World, [number, number]>();
const refill = (w: World) => {
  const h = home.get(w) ?? (home.set(w, [w.player.x, w.player.y]), home.get(w)!);
  w.player.x = h[0];
  w.player.y = h[1];
  w.player.path = [];
  w.player.mana = w.player.derived.maxMana;
  w.player.hp = w.player.derived.maxHp;
  for (const s of Object.values(w.skills)) s.cd = 0;
  w.gcd = 0;
};
// passos de teste rodam com monstros parados para isolar o dano
const freezeMonsters = (w: World) => {
  for (const m of w.monsters) {
    m.attackCd = 999;
    m.moveSpeed = 0;
  }
};

for (const classId of Object.keys(CLASSES)) {
  console.log(`\n== ${classId} (nv 9) ==`);
  const w = mk(classId);
  const p = w.player,
    act = w.activeSkills();
  ok(act.length === 4 && w.classSkills().length === 5, '4 ativas + 1 passiva');
  ok(act.every((s) => w.isUnlocked(s)) && w.classSkills().every((s) => w.isUnlocked(s)), 'tudo desbloqueado no nv 9');
  const passive = w.classSkills().find((s) => s.type === 'passive')!;
  ok(w.skillLevel(passive) === 1, 'passiva nv 1 no nv 9');
  const base =
    classId === 'lamina' ? { crit: 0.05 + p.attrs.agility * 0.005, interval: CLASSES.lamina.attackInterval } : null;
  if (base) {
    ok(
      Math.abs(p.derived.critChance - (base.crit + 0.05)) < 1e-9,
      `passiva: crítico +5% (${p.derived.critChance.toFixed(3)})`,
    );
    ok(Math.abs(p.attackInterval - base.interval / 1.1) < 1e-9, 'passiva: +10% vel. ataque');
  }
  const [wolf] = wolfNear(w, 1.2);
  freezeMonsters(w);
  w.setTarget(wolf.id);
  p.attackCd = 99;
  const physical = p.damageType === 'physical';
  const atk = physical ? p.derived.physAtk : p.derived.spiritAtk;

  for (let slot = 0; slot < 4; slot++) {
    const def = act[slot];
    console.log(` - ${def.name}`);
    refill(w);
    wolfNear(w, def.range === 8 ? 4 : 1.2, 3);
    freezeMonsters(w);
    const target = w.monsters[0];
    const others = w.monsters.slice(1);
    // afasta os outros para fora do raio, exceto nas skills de área
    if (def.area) {
      others[0].x = target.x + 1;
      others[1].x = target.x + 2.0;
      others[1].y = target.y + 0.5;
    } else {
      others.forEach((o, i) => {
        o.x = p.x + 12 + i;
        o.y = p.y + 2;
      });
    }
    // Tempestade centrada no jogador: coloca vizinhos no raio e um fora
    if (def.area === 'self') {
      target.x = p.x + 1;
      target.y = p.y;
      others[0].y = p.y;
      others[1].y = p.y;
      others[0].x = p.x - 1.5;
      others[1].x = p.x + 4;
    }
    w.setTarget(target.id);
    p.attackCd = 99;
    const hp0 = target.hp,
      mana0 = p.mana;
    drain(w);
    const x0 = p.x;
    w.useSkill(slot);
    if (def.target === 'target' && !def.dash) {
      /* já em alcance */
    }
    run(w, 0.05);
    const evs = drain(w);
    ok(
      evs.some((e) => e.type === 'skillCast' && e.skillId === def.id),
      'evento skillCast',
    );
    ok(Math.abs(mana0 - p.mana - (def.mana ?? 0)) < 0.5, `gasta ${def.mana} de mana`);
    ok(w.skills[def.id].xp === 1, '+1 xp de skill');
    ok(w.skills[def.id].cd > 0, 'entra em recarga');
    const dealt = hp0 - target.hp;
    if (def.hits) {
      const expectedMin = atk * 0.9 * def.hits.reduce((a, b) => a + b, 0) * 0.5; // piso folgado (defesa/crit variam)
      const expectedMax = (atk * 1.1 + 4) * def.hits.reduce((a, b) => a + b, 0) * 2.2;
      ok(
        dealt > expectedMin * 0.4 && dealt <= expectedMax,
        `dano ${dealt} dentro da faixa (${Math.round(expectedMin * 0.4)}..${Math.round(expectedMax)})`,
      );
      ok(evs.filter((e) => e.type === 'hit' && e.targetId === target.id).length >= 1, 'evento hit');
    }
    if (def.dash)
      ok(
        Math.hypot(p.x - target.x, p.y - target.y) <= 1.05 && p.x > x0,
        `dash até o alvo (dist ${Math.hypot(p.x - target.x, p.y - target.y).toFixed(2)})`,
      );
    if (def.area === 'self') {
      const hitIds = new Set(evs.filter((e) => e.type === 'hit').map((e) => (e as { targetId: number }).targetId));
      ok(
        hitIds.has(others[0].id) && hitIds.has(target.id) && !hitIds.has(others[1].id),
        'Tempestade: acerta dentro do raio, ignora fora',
      );
    }
    if (def.area === 'target') {
      // skill sem golpe (Névoa Tóxica) não gera 'hit' na hora: conta quem ganhou o efeito
      const hitIds = new Set(
        def.hits?.length
          ? evs.filter((e) => e.type === 'hit').map((e) => (e as { targetId: number }).targetId)
          : evs.filter((e) => e.type === 'buffApplied').map((e) => (e as { targetId: number }).targetId),
      );
      ok(
        hitIds.has(others[0].id) && hitIds.has(others[1].id) && hitIds.has(target.id) && !hitIds.has(w.monsters[3].id),
        'área no alvo: acerta vizinhos do alvo',
      );
    }
    if (def.debuff) {
      const b = target.buffs.find((x) => x.kind === def.debuff!.kind);
      ok(!!b && evs.some((e) => e.type === 'buffApplied'), `debuff ${def.debuff.kind} aplicado`);
      if (b && b.kind === 'slow') {
        target.moveSpeed = 4;
        const sp = (w as unknown as { speedMul: (e: Entity) => number }).speedMul(target);
        ok(Math.abs(sp - (1 - def.debuff.value)) < 1e-9, `lentidão reduz velocidade em ${def.debuff.value * 100}%`);
      }
      run(w, def.debuff.duration + 0.2);
      ok(!target.buffs.length && drain(w).some((e) => e.type === 'buffExpired'), 'debuff expira');
      if (b && b.kind === 'defReduction') {
        // defesa reduzida: dano médio maior que sem debuff
        const sample = (withDebuff: boolean) => {
          let tot = 0;
          const m = w.monsters[0];
          m.buffs = [];
          m.derived.physDef = 200;
          m.derived.spiritDef = 200;
          if (withDebuff) w.addBuff(m, 'x', 'defReduction', 0.3, 6);
          for (let i = 0; i < 400; i++) {
            const r = (
              w as unknown as { attack: (a: Entity, t: Entity, m: number, s: boolean) => { amount: number } }
            ).attack(p, m, 1, true);
            tot += r.amount;
          }
          return tot;
        };
        ok(sample(true) > sample(false) * 1.15, 'defesa -30% aumenta o dano recebido');
        target.derived.physDef = 0;
      }
    }
    if (def.shield) {
      const b = p.buffs.find((x) => x.kind === 'shield');
      const expect = p.derived.maxHp * def.shield.percent;
      ok(
        !!b && Math.abs(b.value - expect) < 1,
        `escudo = ${def.shield.percent * 100}% do HP máx (${b?.value.toFixed(1)} / ${expect})`,
      );
      const hp = p.hp;
      (w as unknown as { attack: (a: Entity, t: Entity) => unknown }).attack(target, p);
      const abs = drain(w).some((e) => e.type === 'shieldAbsorb');
      ok(abs && p.hp === hp, 'escudo absorve dano antes do HP');
      run(w, 8.2);
      ok(
        !p.buffs.length && drain(w).some((e) => e.type === 'buffExpired' && !e.broken),
        'escudo expira em 8s (sem quebrar)',
      );
      w.addBuff(p, def.id, 'shield', 5, 8);
      w.absorb(p, 50);
      run(w, 0.1);
      ok(
        !p.buffs.length && drain(w).some((e) => e.type === 'buffExpired' && e.broken),
        'escudo esgotado pelo dano avisa que quebrou (som shield_break)',
      );
    }
    // recarga / mana / sem alvo
    drain(w);
    w.useSkill(slot);
    ok(
      drain(w).some((e) => e.type === 'skillFail' && e.reason === 'cooldown'),
      'feedback recarregando',
    );
  }

  console.log(' - regras gerais');
  refill(w);
  p.mana = 0;
  drain(w);
  w.useSkill(0);
  ok(
    drain(w).some((e) => e.type === 'skillFail' && e.reason === 'mana'),
    'feedback sem mana',
  );
  refill(w);
  w.setTarget(null);
  drain(w);
  w.useSkill(0);
  ok(
    drain(w).some((e) => e.type === 'skillFail' && e.reason === 'notarget'),
    'feedback sem alvo',
  );

  // fora de alcance: melee anda e lança; ranged lança direto a 6 tiles
  refill(w);
  const [far] = wolfNear(w, classId === 'lamina' ? 5 : 9);
  freezeMonsters(w);
  w.setTarget(far.id);
  p.attackCd = 99;
  drain(w);
  w.useSkill(0);
  const immediate = drain(w).some((e) => e.type === 'skillCast');
  run(w, 5);
  const cast = drain(w).some((e) => e.type === 'skillCast') || w.skills[act[0].id].xp > 1;
  ok(!immediate && cast, 'fora de alcance: anda até o alvo e lança depois (fila)');

  // nível de skill por uso
  const st = w.skills[act[0].id];
  st.level = 1;
  st.xp = 19;
  refill(w);
  wolfNear(w, 1.2);
  freezeMonsters(w);
  w.setTarget(w.monsters[0].id);
  drain(w);
  w.useSkill(0);
  ok(
    st.level === 2 && st.xp === 0 && drain(w).some((e) => e.type === 'skillLevelUp'),
    'skill sobe de nível com 20 usos (xp 20)',
  );
  ok(skillXpToNext(2) === 30 && skillXpToNext(9) === Math.round(20 * 1.5 ** 8), 'curva de xp');
  ok(
    skillXpToNext(10) === Math.round(20 * 1.5 ** 8 * 1.4) && skillXpToNext(14) === Math.round(20 * 1.5 ** 8 * 1.4 ** 5),
    'curva de xp 10–15 (×1,4 por nível)',
  );
  ok(Math.abs(skillScale(10) - 1.72) < 1e-9, 'nv 10 = +72% de efeito');
  // persistência
  const save = w.serialize();
  const w2 = World.fromSave(maps, JSON.parse(JSON.stringify(save)));
  ok(w2.skills[act[0].id].level === 2, 'nível/xp persistem no save');
  const old = { ...save } as Partial<SaveData>;
  delete old.skills;
  const w3 = World.fromSave(maps, old as SaveData);
  ok(w3.skills[act[0].id].level === 1 && w3.skills[act[0].id].xp === 0, 'save antigo: nv 1 xp 0');
}

// passiva Meditação: regenera mana fora da cidade
{
  const w = mk('pavilhao');
  const p = w.player;
  for (const m of w.monsters) {
    m.dead = true;
    m.respawnAt = 1e9;
  }
  p.mana = 0;
  run(w, 10);
  const expected = p.derived.maxMana * 0.01 * 10;
  ok(Math.abs(p.mana - expected) < 1, `Meditação: ${p.mana.toFixed(1)} ≈ ${expected.toFixed(1)} em 10s`);
}
// desbloqueio por nível
{
  const w = World.create(maps, 'T', 'lamina');
  ok(
    w.events.some((e) => e.type === 'skillUnlocked'),
    'skill nv 1 anunciada na criação',
  );
  w.events.length = 0;
  w.useSkill(1);
  ok(
    w.events.some((e) => e.type === 'skillFail' && e.reason === 'locked'),
    'skill bloqueada não é usada',
  );
}
// ---------- mecânicas do Marco 8 (Titã e Víbora) ----------
console.log('\n== veneno (Víbora) ==');
{
  const w = mk('vibora');
  const p = w.player;
  const [m] = wolfNear(w, 3);
  freezeMonsters(w);
  m.hp = m.derived.maxHp = 100000;
  w.addBuff(m, 'teste', 'poison', 10, 6);
  drain(w);
  run(w, 3.05);
  const ticks = drain(w).filter((e) => e.type === 'hit' && e.targetId === m.id && (e as { poison?: boolean }).poison);
  ok(ticks.length === 3 && m.hp === 100000 - 30, `3 tiques de 10 em 3 s (${ticks.length}, hp ${m.hp})`);
  run(w, 3.2);
  ok(!w.hasBuff(m, 'poison') && m.hp === 100000 - 60, 'veneno acaba depois de 6 s (60 no total)');
  m.hp = 5;
  const xp0 = w.xp + p.level * 1e9;
  w.addBuff(m, 'teste', 'poison', 10, 6);
  run(w, 1.05);
  ok(m.dead && w.xp + p.level * 1e9 > xp0, 'veneno mata e dá experiência');
  // Sangue de Serpente: +15% em alvo envenenado
  const [t] = wolfNear(w, 3);
  freezeMonsters(w);
  t.derived.evasion = -1000;
  const atk = (w as unknown as { attack: (a: Entity, t: Entity, m: number, s: boolean) => { amount: number } }).attack;
  const sample = (poisoned: boolean) => {
    let tot = 0;
    t.buffs = [];
    if (poisoned) w.addBuff(t, 'x', 'poison', 0.0001, 999);
    for (let i = 0; i < 400; i++) {
      t.hp = t.derived.maxHp = 1e9;
      tot += atk.call(w, p, t, 1, true).amount;
    }
    return tot;
  };
  const r = sample(true) / sample(false);
  ok(r > 1.1 && r < 1.2, `Sangue de Serpente: ~+15% em envenenado (${r.toFixed(3)})`);
}

console.log('\n== atordoar (Titã) ==');
{
  const w = mk('tita');
  const p = w.player;
  const [m] = wolfNear(w, 1.2);
  freezeMonsters(w); // só este lobo age
  m.attackCd = 0;
  m.moveSpeed = 3;
  m.derived.hit = 1e4;
  m.hp = m.derived.maxHp = 1e6;
  w.addBuff(m, 'teste', 'stun', 0, 1.5);
  const hp0 = p.hp,
    x0 = m.x;
  run(w, 1.4);
  ok(
    p.hp === hp0 && m.x === x0,
    `atordoado não anda nem ataca (hp ${hp0}→${p.hp}, x ${x0}→${m.x}, stun ${w.isStunned(m)})`,
  );
  run(w, 2);
  ok(!w.isStunned(m) && p.hp < hp0, 'depois de 1,5 s volta a atacar');
}

console.log('\n== Corpo de Bronze (Titã) ==');
{
  const t = mk('tita');
  const v = mk('vibora');
  const hpT = t.player.derived.maxHp;
  const c = CLASSES.tita;
  const base = 50 + (c.baseAttributes.stamina + c.levelUpAttributes.stamina * 8) * 10;
  ok(Math.abs(hpT - Math.round(base * 1.1)) <= 1, `+10% de HP máximo (${hpT} / ${Math.round(base * 1.1)})`);
  const [m] = wolfNear(t, 1.2);
  freezeMonsters(t);
  m.derived.hit = 1e4;
  const atk = (t as unknown as { attack: (a: Entity, t: Entity, m: number, s: boolean) => { amount: number } }).attack;
  let got = 0;
  for (let i = 0; i < 300; i++) {
    t.player.hp = 1e9;
    got += atk.call(t, m, t.player, 1, false).amount;
  }
  const [m2] = wolfNear(v, 1.2);
  freezeMonsters(v);
  m2.derived = { ...m.derived };
  m2.attrs = { ...m.attrs };
  v.player.derived = { ...v.player.derived, physDef: t.player.derived.physDef, evasion: t.player.derived.evasion };
  let got2 = 0;
  for (let i = 0; i < 300; i++) {
    v.player.hp = 1e9;
    got2 += atk.call(v, m2, v.player, 1, false).amount;
  }
  const r = got / got2;
  ok(r > 0.85 && r < 0.95, `recebe ~10% menos dano (${r.toFixed(3)})`);
}

console.log('\n== Seiva de Jade (Víbora) ==');
{
  const w = mk('vibora');
  const p = w.player;
  const sap = w.activeSkills().find((s) => s.heal)!;
  refill(w);
  wolfNear(w, 3);
  freezeMonsters(w);
  p.hp = 1;
  w.useSkill(w.activeSkills().indexOf(sap));
  run(w, 6.2);
  const expect = 1 + p.derived.maxHp * sap.heal!.percent;
  ok(Math.abs(p.hp - expect) < 2, `cura 20% do HP máx em 6 s (${p.hp.toFixed(1)} / ${expect.toFixed(1)})`);
}

console.log('\nSom das skills (audio.json "skillFx", N5)');
{
  const audio = JSON.parse(readFileSync('src/data/audio.json', 'utf8'));
  const semSom = new Set(['sap']); // Seiva de Jade: som ainda não escolhido
  for (const [cls, list] of Object.entries(SKILLS))
    for (const s of list.filter((x) => x.type === 'active' && x.fx && !semSom.has(x.fx))) {
      const key = audio.skillFx[s.fx!];
      const file = key && audio.sfx[key]?.file;
      ok(
        !!file && existsSync(`public/audio/sfx/${file}.ogg`) && existsSync(`public/audio/sfx/${file}.mp3`),
        `${cls}/${s.id} (${s.fx}) tem som próprio`,
      );
    }
}

console.log('\nSom do ataque de cada classe (audio.json "classAttack")');
{
  const audio = JSON.parse(readFileSync('src/data/audio.json', 'utf8'));
  const has = (key?: string) => !!key && !!audio.sfx[key] && existsSync(`public/audio/sfx/${audio.sfx[key].file}.ogg`);
  for (const c of Object.values(CLASSES)) {
    const a = audio.classAttack[c.id] ?? {};
    ok(has(a.hit) && has(a.crit), `${c.id}: acerto e crítico próprios`);
    if (c.attackRange > 3) ok(has(a.cast), `${c.id}: disparo próprio (ataca à distância)`);
  }
}

// ---------- ultimate (src/core/ultimate.ts): o mesmo bloco roda para cada seita ----------
function ultCheck(sect: string) {
  console.log(`ultimate (${CLASSES[sect].name})`);
  const u = ULTIMATES[sect],
    total = u.strikes * u.strikeMult + u.finalMult;
  ok(!!u.icon && !!u.fx && !!u.sounds?.strike && /^#[0-9a-f]{6}$/i.test(u.glow), 'ícone, efeito, cores e sons');
  const place = (w: World, n: number, r: number) => {
    freezeMonsters(w);
    for (const m of w.monsters.slice(n)) Object.assign(m, { dead: true, respawnAt: 1e9 });
    return w.monsters.slice(0, n).map((m, i) => {
      const a = (i / n) * Math.PI * 2;
      Object.assign(m, {
        x: w.player.x + Math.cos(a) * r,
        y: w.player.y + Math.sin(a) * r,
        dead: false,
        ai: 'idle',
        aiTimer: 999,
        buffs: [],
      });
      m.hp = m.derived.maxHp = 1e6;
      m.derived.evasion = 0;
      return m;
    });
  };
  const w9 = mk(sect, 9);
  for (let i = 0; i < 30; i++) (w9 as any).chargeUltimate(); // eslint-disable-line
  ok(w9.ultFill() === 0 && !w9.useUltimate(), 'antes do nível 10 a barra não enche');
  const w = mk(sect, 10);
  for (let i = 0; i < u.charge - 1; i++) (w as any).chargeUltimate(); // eslint-disable-line
  ok(!w.useUltimate(), `com ${u.charge - 1} cargas ainda não solta`);
  (w as any).chargeUltimate(); // eslint-disable-line
  ok(w.ultReady(), `${u.charge} skills que acertam enchem a barra`);
  const near = place(w, 3, 4),
    far = w.monsters[3];
  Object.assign(far, { x: w.player.x + u.radius + 1.5, y: w.player.y, dead: false, ai: 'idle', aiTimer: 999 });
  far.hp = far.derived.maxHp = 1e6;
  w.player.hp = 10;
  far.respawnAt = 0;
  far.attackCd = 999;
  drain(w);
  ok(w.useUltimate(), 'barra cheia: solta');
  w.useSkill(0);
  const evs: GameEvent[] = [];
  let strikeTicks = 0;
  for (let i = 0; i < (u.duration + 0.2) * 60; i++) {
    w.tick(1 / 60);
    const e = drain(w);
    if (e.some((x) => x.type === 'ultimate' && x.phase === 'strike')) strikeTicks++;
    evs.push(...e);
  }
  ok(!evs.some((e) => e.type === 'skillCast'), 'durante a ultimate não lança skill');
  ok(w.ultCast === null && w.ultCharge === 0, `termina em ${u.duration} s e esvazia a barra`);
  const strikes = evs.filter((e) => e.type === 'ultimate' && e.phase === 'strike').length;
  ok(
    strikes === u.strikes * near.length && evs.some((e) => e.type === 'ultimate' && e.phase === 'final'),
    `${u.strikes} golpes por monstro + estouro final`,
  );
  ok(strikeTicks === strikes, 'golpes intercalados: nunca dois no mesmo instante');
  const one = dmgOf(evs, near[0].id) / total;
  const hitsOf = (es: GameEvent[], id: number) =>
    es.filter((e) => e.type === 'hit' && e.targetId === id).map((e) => (e as { amount: number }).amount);
  ok(
    near.every((m) => {
      const h = hitsOf(evs, m.id);
      return h.length === u.strikes + 1 && Math.abs(h[h.length - 1] / h[0] - u.finalMult / u.strikeMult) < 0.05;
    }),
    `cada monstro no raio leva ${u.strikes} golpes + o estouro de ${u.finalMult}× (${total}× no total)`,
  );
  ok(dmgOf(evs, far.id) === 0, 'monstro fora do raio não leva dano');
  ok(w.player.hp === 10, 'não recupera vida');
  ok(w.ultCharge === 0, 'o dano da própria ultimate não carrega a barra');
  // muitos alvos: dano dividido
  const w2 = mk(sect, 10);
  const many = place(w2, 12, 3);
  w2.ultCharge = u.charge;
  drain(w2);
  w2.useUltimate();
  run(w2, u.duration + 0.2);
  const e2 = drain(w2);
  ok(
    Math.abs(dmgOf(e2, many[0].id) / one - total * (u.fullTargets / 12)) < 0.3,
    `12 monstros: cada um leva ${u.fullTargets}/12 do dano`,
  );
  // fora de combate esvazia
  const w3 = mk(sect, 10);
  place(w3, 0, 0);
  w3.ultCharge = u.charge;
  w3.lastCombat = w3.time;
  run(w3, u.idleDelay - 1);
  const before = w3.ultCharge;
  run(w3, 5);
  ok(before === u.charge && w3.ultCharge < u.charge, `esvazia só depois de ${u.idleDelay} s sem combate`);
  return { w, near, far, evs };
}
ultCheck('lamina');
{
  const { w, near, far, evs } = ultCheck('pavilhao');
  const u = ULTIMATES.pavilhao,
    id = 'ult_pavilhao';
  // lentidão em cada golpe que acerta; congelar (atordoar) no estouro
  ok(
    evs.some((e) => e.type === 'buffApplied' && e.kind === 'slow' && e.id === id) &&
      !evs.some((e) => e.type === 'buffApplied' && e.kind === 'slow' && e.targetId === far.id),
    `golpes deixam ${Math.round((u.strikeDebuff?.value ?? 0) * 100)}% mais lento (só no raio)`,
  );
  const stun = near.map((m) => m.buffs.find((b) => b.kind === 'stun' && b.id === id));
  ok(
    stun.every((b) => b && Math.abs(b.remaining - (u.finalDebuff?.duration ?? 0)) < 0.25),
    `estouro congela por ${u.finalDebuff?.duration} s`,
  );
  ok(near.every((m) => w.isStunned(m)) && !w.isStunned(far), 'monstro fora do raio não congela');
  ok(!ULTIMATES.lamina.strikeDebuff && !ULTIMATES.lamina.finalDebuff, 'Tormenta: só dano, sem efeito');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
