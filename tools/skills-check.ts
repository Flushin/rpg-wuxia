// Verificação headless das skills (não vai para o build do jogo).
// Uso: npm run check:skills
import { readFileSync } from 'node:fs';
import { CLASSES } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { SKILLS, skillScale, skillXpToNext } from '../src/core/skills';
import { isWalkable } from '../src/core/pathfinding';
import { World } from '../src/core/world';
import type { Entity, GameEvent, SaveData } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('  FALHOU:', m); } else console.log('  ok:', m); };
const maps: Record<string, GameMap> = {};
for (const id of ['cidade', 'floresta']) maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));

// acha um ponto da floresta com ~12 tiles livres em volta e longe de portais
function openSpot(w: World): [number, number] {
  const m = w.map, portals = m.objects.filter((o) => o.type === 'portal');
  for (let y = 2; y < m.height - 2; y++) for (let x = 2; x < m.width - 14; x++) {
    if (portals.some((o) => Math.hypot(o.x - x, o.y - y) < 6)) continue;
    let good = true;
    for (let i = 0; i <= 11; i += 0.25) if (!isWalkable(m, x + i, y)) { good = false; break; }
    if (good) return [x + 0.5, y + 0.5];
  }
  throw new Error('sem área aberta');
}
function mk(classId: string, level = 9): World {
  const c = CLASSES[classId], attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  const s: SaveData = { version: 1, name: 'T', classId, level, xp: 0, freePoints: 0, attributes: attrs, mapId: 'floresta', lastSeen: 0 };
  const w = World.fromSave(maps, s);
  const spot = openSpot(w); w.player.x = spot[0]; w.player.y = spot[1];
  // rng determinístico: sempre acerta, nunca crita
  (w as any).rng = { next: () => 0.5, range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a }; // eslint-disable-line
  return w;
}
// direção (cos,sin) com chão livre por d+3 tiles a partir do jogador
const freeDir = (w: World, d: number): [number, number] => {
  const p = w.player;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as [number, number][]) {
    let good = true;
    for (let k = 0; k <= d + 0.5; k += 0.25) if (!isWalkable(w.map, p.x + dx * k, p.y + dy * k)) { good = false; break; }
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
    m.x = p.x + dx * (d + i * 0.8); m.y = p.y + dy * (d + i * 0.8); m.dead = false; m.hp = m.derived.maxHp = 100000; m.ai = 'idle'; m.aiTimer = 999; m.buffs = [];
    m.attrs.agility = 0; m.derived.evasion = 0; // acerta sempre (hit 80+ => 95% max, repete se errar)
    out.push(m);
  }
  return out;
};
const run = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.tick(1 / 60); };
const drain = (w: World) => w.events.splice(0);
const dmgOf = (evs: GameEvent[], id: number) => evs.filter((e) => e.type === 'hit' && e.targetId === id).reduce((a, e) => a + (e as { amount: number }).amount, 0);
const home = new WeakMap<World, [number, number]>();
const refill = (w: World) => { const h = home.get(w) ?? (home.set(w, [w.player.x, w.player.y]), home.get(w)!); w.player.x = h[0]; w.player.y = h[1]; w.player.path = []; w.player.mana = w.player.derived.maxMana; w.player.hp = w.player.derived.maxHp; for (const s of Object.values(w.skills)) s.cd = 0; w.gcd = 0; };
// passos de teste rodam com monstros parados para isolar o dano
const freezeMonsters = (w: World) => { for (const m of w.monsters) { m.attackCd = 999; m.moveSpeed = 0; } };

for (const classId of Object.keys(CLASSES)) {
  console.log(`\n== ${classId} (nv 9) ==`);
  const w = mk(classId);
  const p = w.player, act = w.activeSkills();
  ok(act.length === 4 && w.classSkills().length === 5, '4 ativas + 1 passiva');
  ok(act.every((s) => w.isUnlocked(s)) && w.classSkills().every((s) => w.isUnlocked(s)), 'tudo desbloqueado no nv 9');
  const passive = w.classSkills().find((s) => s.type === 'passive')!;
  ok(w.skillLevel(passive) === 1, 'passiva nv 1 no nv 9');
  const base = classId === 'lamina' ? { crit: 0.05 + p.attrs.agility * 0.005, interval: CLASSES.lamina.attackInterval } : null;
  if (base) {
    ok(Math.abs(p.derived.critChance - (base.crit + 0.05)) < 1e-9, `passiva: crítico +5% (${p.derived.critChance.toFixed(3)})`);
    ok(Math.abs(p.attackInterval - base.interval / 1.1) < 1e-9, 'passiva: +10% vel. ataque');
  }
  const [wolf] = wolfNear(w, 1.2); freezeMonsters(w);
  w.setTarget(wolf.id); p.attackCd = 99;
  const physical = p.damageType === 'physical';
  const atk = physical ? p.derived.physAtk : p.derived.spiritAtk;

  for (let slot = 0; slot < 4; slot++) {
    const def = act[slot];
    console.log(` - ${def.name}`);
    refill(w); wolfNear(w, def.range === 8 ? 4 : 1.2, 3); freezeMonsters(w);
    const target = w.monsters[0]; const others = w.monsters.slice(1);
    // afasta os outros para fora do raio, exceto nas skills de área
    if (def.area) { others[0].x = target.x + 1; others[1].x = target.x + 2.0; others[1].y = target.y + 0.5; }
    else { others.forEach((o, i) => { o.x = p.x + 12 + i; o.y = p.y + 2; }); }
    // Tempestade centrada no jogador: coloca vizinhos no raio e um fora
    if (def.area === 'self') { target.x = p.x + 1; target.y = p.y; others[0].y = p.y; others[1].y = p.y; others[0].x = p.x - 1.5; others[1].x = p.x + 4; }
    w.setTarget(target.id); p.attackCd = 99;
    const hp0 = target.hp, mana0 = p.mana; drain(w);
    const x0 = p.x;
    w.useSkill(slot);
    if (def.target === 'target' && !def.dash) { /* já em alcance */ }
    run(w, 0.05);
    const evs = drain(w);
    ok(evs.some((e) => e.type === 'skillCast' && e.skillId === def.id), 'evento skillCast');
    ok(Math.abs(mana0 - p.mana - (def.mana ?? 0)) < 0.5, `gasta ${def.mana} de mana`);
    ok(w.skills[def.id].xp === 1, '+1 xp de skill');
    ok(w.skills[def.id].cd > 0, 'entra em recarga');
    const dealt = hp0 - target.hp;
    if (def.hits) {
      const expectedMin = atk * 0.9 * def.hits.reduce((a, b) => a + b, 0) * 0.5; // piso folgado (defesa/crit variam)
      const expectedMax = (atk * 1.1 + 4) * def.hits.reduce((a, b) => a + b, 0) * 2.2;
      ok(dealt > expectedMin * 0.4 && dealt <= expectedMax, `dano ${dealt} dentro da faixa (${Math.round(expectedMin * 0.4)}..${Math.round(expectedMax)})`);
      ok(evs.filter((e) => e.type === 'hit' && e.targetId === target.id).length >= 1, 'evento hit');
    }
    if (def.dash) ok(Math.hypot(p.x - target.x, p.y - target.y) <= 1.05 && p.x > x0, `dash até o alvo (dist ${Math.hypot(p.x - target.x, p.y - target.y).toFixed(2)})`);
    if (def.area === 'self') {
      const hitIds = new Set(evs.filter((e) => e.type === 'hit').map((e) => (e as { targetId: number }).targetId));
      ok(hitIds.has(others[0].id) && hitIds.has(target.id) && !hitIds.has(others[1].id), 'Tempestade: acerta dentro do raio, ignora fora');
    }
    if (def.area === 'target') {
      const hitIds = new Set(evs.filter((e) => e.type === 'hit').map((e) => (e as { targetId: number }).targetId));
      ok(hitIds.has(others[0].id) && hitIds.has(others[1].id) && hitIds.has(target.id) && !hitIds.has(w.monsters[3].id), 'Chuva: acerta vizinhos do alvo');
    }
    if (def.debuff) {
      const b = target.buffs.find((x) => x.kind === def.debuff!.kind);
      ok(!!b && evs.some((e) => e.type === 'buffApplied'), `debuff ${def.debuff.kind} aplicado`);
      if (b && b.kind === 'slow') {
        target.moveSpeed = 4; const sp = (w as unknown as { speedMul: (e: Entity) => number }).speedMul(target);
        ok(Math.abs(sp - 0.6) < 1e-9, 'lentidão reduz velocidade em 40%');
      }
      run(w, def.debuff.duration + 0.2);
      ok(!target.buffs.length && drain(w).some((e) => e.type === 'buffExpired'), 'debuff expira');
      if (b && b.kind === 'defReduction') {
        // defesa reduzida: dano médio maior que sem debuff
        const sample = (withDebuff: boolean) => {
          let tot = 0; const m = w.monsters[0]; m.buffs = []; m.derived.physDef = 200; m.derived.spiritDef = 200;
          if (withDebuff) w.addBuff(m, 'x', 'defReduction', 0.3, 6);
          for (let i = 0; i < 400; i++) { const r = (w as unknown as { attack: (a: Entity, t: Entity, m: number, s: boolean) => { amount: number } }).attack(p, m, 1, true); tot += r.amount; }
          return tot;
        };
        ok(sample(true) > sample(false) * 1.15, 'defesa -30% aumenta o dano recebido');
        target.derived.physDef = 0;
      }
    }
    if (def.shield) {
      const b = p.buffs.find((x) => x.kind === 'shield');
      const expect = p.derived.maxHp * 0.25;
      ok(!!b && Math.abs(b.value - expect) < 1, `escudo = 25% do HP máx (${b?.value.toFixed(1)} / ${expect})`);
      const hp = p.hp; (w as unknown as { attack: (a: Entity, t: Entity) => unknown }).attack(target, p);
      const abs = drain(w).some((e) => e.type === 'shieldAbsorb');
      ok(abs && p.hp === hp, 'escudo absorve dano antes do HP');
      run(w, 8.2);
      ok(!p.buffs.length && drain(w).some((e) => e.type === 'buffExpired'), 'escudo expira em 8s');
    }
    // recarga / mana / sem alvo
    drain(w); w.useSkill(slot);
    ok(drain(w).some((e) => e.type === 'skillFail' && e.reason === 'cooldown'), 'feedback recarregando');
  }

  console.log(' - regras gerais');
  refill(w); p.mana = 0; drain(w); w.useSkill(0);
  ok(drain(w).some((e) => e.type === 'skillFail' && e.reason === 'mana'), 'feedback sem mana');
  refill(w); w.setTarget(null); drain(w); w.useSkill(0);
  ok(drain(w).some((e) => e.type === 'skillFail' && e.reason === 'notarget'), 'feedback sem alvo');

  // fora de alcance: melee anda e lança; ranged lança direto a 6 tiles
  refill(w); const [far] = wolfNear(w, classId === 'lamina' ? 5 : 9); freezeMonsters(w);
  w.setTarget(far.id); p.attackCd = 99; drain(w);
  w.useSkill(0);
  const immediate = drain(w).some((e) => e.type === 'skillCast');
  run(w, 5);
  const cast = drain(w).some((e) => e.type === 'skillCast') || w.skills[act[0].id].xp > 1;
  ok(!immediate && cast, 'fora de alcance: anda até o alvo e lança depois (fila)');

  // nível de skill por uso
  const st = w.skills[act[0].id]; st.level = 1; st.xp = 19; refill(w); wolfNear(w, 1.2); freezeMonsters(w); w.setTarget(w.monsters[0].id); drain(w);
  w.useSkill(0);
  ok(st.level === 2 && st.xp === 0 && drain(w).some((e) => e.type === 'skillLevelUp'), 'skill sobe de nível com 20 usos (xp 20)');
  ok(skillXpToNext(2) === 30 && skillXpToNext(9) === Math.round(20 * 1.5 ** 8), 'curva de xp');
  ok(Math.abs(skillScale(10) - 1.72) < 1e-9, 'nv 10 = +72% de efeito');
  // persistência
  const save = w.serialize();
  const w2 = World.fromSave(maps, JSON.parse(JSON.stringify(save)));
  ok(w2.skills[act[0].id].level === 2, 'nível/xp persistem no save');
  const old = { ...save } as Partial<SaveData>; delete old.skills;
  const w3 = World.fromSave(maps, old as SaveData);
  ok(w3.skills[act[0].id].level === 1 && w3.skills[act[0].id].xp === 0, 'save antigo: nv 1 xp 0');
}

// passiva Meditação: regenera mana fora da cidade
{
  const w = mk('pavilhao'); const p = w.player; for (const m of w.monsters) { m.dead = true; m.respawnAt = 1e9; }
  p.mana = 0; run(w, 10);
  const expected = p.derived.maxMana * 0.01 * 10;
  ok(Math.abs(p.mana - expected) < 1, `Meditação: ${p.mana.toFixed(1)} ≈ ${expected.toFixed(1)} em 10s`);
}
// desbloqueio por nível
{
  const w = World.create(maps, 'T', 'lamina');
  ok(w.events.some((e) => e.type === 'skillUnlocked'), 'skill nv 1 anunciada na criação');
  w.events.length = 0; w.useSkill(1);
  ok(w.events.some((e) => e.type === 'skillFail' && e.reason === 'locked'), 'skill bloqueada não é usada');
}
console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
