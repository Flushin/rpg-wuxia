// Verificação headless do auto-combate e do ganho offline (não vai para o build do jogo).
// Uso: npm run check:auto
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS, PROGRESSION } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { effectiveMinutes, computeOffline } from '../src/core/offline';
import { BAG_SIZE, BAG_TAB_SIZE, makeEquipment, makePotion } from '../src/core/items';
import { World } from '../src/core/world';
import { Rng } from '../src/core/rng';
import type { AutoBucket, GameEvent, Point, Rarity, SaveData } from '../src/core/types';

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
const HOUR = 3.6e6;

function mk(classId = 'lamina', level = 5, mapId = 'floresta', extra: Partial<SaveData> = {}, now?: number): World {
  const c = CLASSES[classId],
    attrs = { ...c.baseAttributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) attrs[k] += c.levelUpAttributes[k] * (level - 1);
  attrs.stamina += 300; // sobrevive às caminhadas
  const s: SaveData = {
    version: 1,
    name: 'T',
    classId,
    level,
    xp: 0,
    freePoints: 0,
    attributes: attrs,
    mapId,
    lastSeen: 0,
    ...extra,
  };
  const w = World.fromSave(maps, s, now);
  // rng determinístico: acerta sempre, sem crítico, sem drops
  (w as any).rng = { next: () => 0.5, range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a }; // eslint-disable-line
  for (const m of w.monsters) {
    m.derived.evasion = 0;
  }
  w.equipment.arma = makeEquipment(classId === 'lamina' ? 'espadas_ferro' : 'leque_bambu', 'comum', null, new Rng(1));
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
const count = (evs: GameEvent[], t: string) => evs.filter((e) => e.type === t).length;
const addPotions = (w: World, hp: number, mp: number) => {
  if (hp) w.addItem(makePotion('pocao_hp_p', hp));
  if (mp) w.addItem(makePotion('pocao_mp_p', mp));
};
const insideRect = (p: Point, o: { x: number; y: number; w: number; h: number }) =>
  p.x >= o.x && p.x < o.x + o.w && p.y >= o.y && p.y < o.y + o.h;
const clearPotions = (w: World) => {
  w.bag = w.bag.map((b) => (b && b.baseId.startsWith('pocao') ? null : b));
};
const spawnAll = (w: World) => {
  for (const m of w.monsters) {
    m.attackCd = 999;
    m.moveSpeed = 0;
  }
};

// centro de uma clareira: todos os tiles num raio r andáveis
// clareira de raio r longe dos portais (monstro posto dentro do portal fica inalcançável: o auto não pisa nele)
// e o mais longe possível de onde nascem os monstros de `far` (senão eles atacam e o auto revida)
const openSpot = (w: World, r: number, far: { home: Point }[] = w.monsters): Point | null => {
  const M = w.map,
    walk = (i: number, j: number) => i >= 0 && j >= 0 && i < M.width && j < M.height && M.walkable[j * M.width + i];
  let best: Point | null = null,
    bd = -1;
  for (let j = 0; j < M.height; j++)
    for (let i = 0; i < M.width; i++) {
      let all = true;
      for (let y = -r; y <= r && all; y++)
        for (let x = -r; x <= r; x++)
          if (Math.hypot(x, y) <= r && (!walk(i + x, j + y) || w.nearPortal({ x: i + x + 0.5, y: j + y + 0.5 }))) {
            all = false;
            break;
          }
      if (!all) continue;
      const q = { x: i + 0.5, y: j + 0.5 };
      const d = Math.min(8, ...far.map((m) => Math.hypot(m.home.x - q.x, m.home.y - q.y)));
      if (d >= 8) return q;
      if (d > bd) {
        bd = d;
        best = q;
      }
    }
  return best;
};

console.log('\n== caça: mata lobos ==');
{
  const w = mk('lamina', 5);
  addPotions(w, 5, 5);
  w.auto.toggle();
  ok(w.auto.state === 'on', 'toggle liga');
  run(w, 90);
  const evs = drain(w);
  ok(count(evs, 'kill') >= 3, `matou lobos sozinho (${count(evs, 'kill')} abates em 90 s)`);
  ok(!w.player.dead, 'sobreviveu');
  w.auto.toggle();
  ok(w.auto.state === 'off', 'toggle desliga');
}

console.log('\n== escolha de alvo (15/11/2026) ==');
{
  // revida primeiro: monstro atacando vira o alvo, mesmo com outro alvo escolhido
  const w = mk('lamina', 2);
  spawnAll(w);
  const [a, b, ...rest] = w.monsters;
  rest.forEach((m) => {
    m.dead = true;
    m.respawnAt = 1e9;
  });
  const S = openSpot(w, 4)!;
  w.player.x = S.x;
  w.player.y = S.y;
  w.player.path = [];
  {
    const sm = (w as any).speedMul.bind(w);
    (w as any).speedMul = (e: unknown) => (e === w.player ? 0 : sm(e));
  } // parado: a fica fora da visão
  a.x = S.x;
  a.y = S.y + 3.8;
  a.home = { x: a.x, y: a.y };
  b.x = 30;
  b.y = 30;
  b.home = { x: b.x, y: b.y };
  w.auto.toggle();
  run(w, 0.1);
  ok(w.targetId === a.id, 'sem ninguém atacando, vai no monstro escolhido');
  b.x = S.x + 1;
  b.y = S.y;
  b.home = { x: b.x, y: b.y };
  b.ai = 'chase';
  run(w, 0.1);
  ok(w.targetId === b.id, 'monstro que ataca vira o alvo (revidar primeiro)');
}
{
  // alvo que não dá para alcançar (personagem não sai do lugar): larga em ~4 s e escolhe outro.
  // Antes o auto ficava parado com esse alvo até um monstro nascer perto.
  const w = mk('lamina', 2);
  spawnAll(w);
  const [a, b, ...rest] = w.monsters;
  rest.forEach((m) => {
    m.dead = true;
    m.respawnAt = 1e9;
  });
  const S = openSpot(w, 4)!;
  w.player.x = S.x;
  w.player.y = S.y;
  w.player.path = [];
  {
    const sm = (w as any).speedMul.bind(w);
    (w as any).speedMul = (e: unknown) => (e === w.player ? 0 : sm(e));
  }
  a.x = S.x + 3.6;
  a.y = S.y;
  b.x = S.x - 3.9;
  b.y = S.y;
  for (const m of [a, b]) {
    m.home = { x: m.x, y: m.y };
    m.level = 2;
  }
  w.auto.toggle();
  run(w, 0.1);
  const first = w.targetId;
  run(w, 5);
  ok(first === a.id && w.targetId === b.id, 'alvo que não fica mais perto é largado e troca por outro');
}
for (const crowd of ['low', 'off'] as const) {
  // evita caminho com monstros: dois alvos ~8 tiles; no caminho até o mais perto há 2 lobos
  const w = mk('lamina', 5);
  w.auto.cfg.crowdAvoid = crowd;
  spawnAll(w);
  const ms = w.monsters;
  ms.slice(4).forEach((m) => {
    m.dead = true;
    m.respawnAt = 1e9;
  });
  const [a, b, c, d] = ms;
  const P = openSpot(w, 3)!,
    M = w.map;
  w.player.x = P.x;
  w.player.y = P.y;
  w.player.path = [];
  const tiles: { x: number; y: number; path: { x: number; y: number }[]; len: number }[] = [];
  for (let j = 0; j < M.height; j++)
    for (let i = 0; i < M.width; i++) {
      const q = { x: i + 0.5, y: j + 0.5 },
        dd = Math.hypot(q.x - P.x, q.y - P.y);
      if (!M.walkable[j * M.width + i] || dd < 7 || dd > 10) continue;
      const path = w.pathFromPlayer(q);
      if (!path.length) continue;
      let len = 0,
        prev = P;
      for (const r of path) {
        len += Math.hypot(r.x - prev.x, r.y - prev.y);
        prev = r;
      }
      if (len < 11) tiles.push({ ...q, path, len });
    }
  let ok2 = false;
  outer: for (const A of tiles) {
    const mid = A.path.find((q) => Math.hypot(q.x - P.x, q.y - P.y) > 4.5 && Math.hypot(q.x - A.x, q.y - A.y) > 2);
    if (!mid) continue;
    for (const B of tiles) {
      if (B.len < A.len + 0.5 || B.len > A.len + 3) continue; // B um pouco mais longe
      if (
        Math.min(...B.path.map((q) => Math.hypot(q.x - mid.x, q.y - mid.y)), Math.hypot(B.x - mid.x, B.y - mid.y)) < 5
      )
        continue;
      a.x = A.x;
      a.y = A.y;
      b.x = B.x;
      b.y = B.y;
      c.x = mid.x;
      c.y = mid.y;
      d.x = mid.x;
      d.y = mid.y;
      ok2 = true;
      break outer;
    }
  }
  for (const m of [a, b, c, d]) {
    m.home = { x: m.x, y: m.y };
    m.level = 5;
  }
  w.auto.toggle();
  run(w, 0.1);
  if (crowd === 'low') ok(ok2 && w.targetId === b.id, 'prefere o alvo sem monstros no caminho (não atrai vários)');
  else
    ok(
      ok2 && w.targetId !== null && w.targetId !== b.id,
      "opção 'Evitar grupos: Não': vai no mais perto, mesmo no meio dos outros",
    );
}

console.log('\n== filtro nível +2 ==');
{
  const w = mk('lamina', 1);
  spawnAll(w);
  const [a, b, ...rest] = w.monsters;
  rest.forEach((m) => {
    m.level = 9;
    m.dead = true; // fora de cena: só a e b importam (vivos, atacariam e o auto revidaria)
    m.respawnAt = 1e9;
  });
  a.level = 3;
  b.level = 4; // b (alto demais) fica mais perto
  // b fora da visão (senão ele ataca e o auto revida, que é o certo); a mais longe
  const S = openSpot(w, 4)!;
  b.x = S.x - 3.6;
  b.y = S.y;
  b.home = { x: b.x, y: b.y };
  a.x = S.x + 3.9;
  a.y = S.y;
  a.home = { x: a.x, y: a.y };
  w.player.x = S.x;
  w.player.y = S.y;
  w.player.path = [];
  w.auto.toggle();
  run(w, 0.2);
  ok(w.targetId === a.id, 'escolhe o nível 3 (≤ 1+2) mesmo mais longe, ignora o nível 4 mais perto');
  a.dead = true;
  a.respawnAt = 1e9;
  w.targetId = null;
  w.autoAttack = false;
  run(w, 0.3);
  ok(w.targetId === null, 'sem alvo elegível não ataca ninguém');
}

console.log('\n== opções de alvo e revide (18/11/2026) ==');
// cenário: personagem parado numa clareira, só os monstros pedidos vivos, parados e sem atacar
const scene = (level: number, mons: { level: number; dx: number; dy: number; chase?: boolean }[], moving = false) => {
  const w = mk('lamina', level);
  spawnAll(w);
  const S = openSpot(w, 4)!;
  w.player.x = S.x;
  w.player.y = S.y;
  w.player.path = [];
  if (!moving) {
    const sm = (w as any).speedMul.bind(w); // eslint-disable-line
    (w as any).speedMul = (e: unknown) => (e === w.player ? 0 : sm(e)); // eslint-disable-line
  }
  const list = w.monsters.slice(0, mons.length);
  w.monsters.slice(mons.length).forEach((m) => {
    m.dead = true;
    m.respawnAt = 1e9;
  });
  mons.forEach((o, i) => {
    const m = list[i];
    m.level = o.level;
    m.x = S.x + o.dx;
    m.y = S.y + o.dy;
    m.home = { x: m.x, y: m.y };
    if (o.chase) m.ai = 'chase';
  });
  return { w, ms: list };
};
{
  const d = World.fromSave(maps, {
    version: 1,
    name: 'T',
    classId: 'lamina',
    level: 1,
    xp: 0,
    freePoints: 0,
    attributes: { ...CLASSES.lamina.baseAttributes },
    mapId: 'floresta',
    lastSeen: 0,
  }).auto.cfg;
  ok(
    d.maxLevelAbove === 2 &&
      d.grayMode === 'last' &&
      d.retaliate === 'always' &&
      d.onStrongAggro === 'keep' &&
      d.crowdAvoid === 'low',
    'padrões reproduzem o comportamento antigo (+2, cinzas por último, revida sempre, evita grupos pouco)',
  );
  const w = mk('lamina', 5, 'floresta', {
    auto: { active: false, mapId: 'floresta', config: { hpThreshold: 50 } as never },
  });
  ok(
    w.auto.cfg.maxLevelAbove === 2 && w.auto.cfg.retaliate === 'always' && w.auto.cfg.hpThreshold === 50,
    'save antigo sem as opções novas: padrões',
  );
  const bad = mk('lamina', 5, 'floresta', {
    auto: {
      active: false,
      mapId: 'floresta',
      config: { maxLevelAbove: 99, grayMode: 'x', retaliate: 7, onStrongAggro: null, crowdAvoid: 'high' } as never,
    },
  });
  const bc = bad.auto.cfg;
  ok(
    bc.maxLevelAbove === 5 &&
      bc.grayMode === 'last' &&
      bc.retaliate === 'always' &&
      bc.onStrongAggro === 'keep' &&
      bc.crowdAvoid === 'high',
    'valores inválidos no save: limitados ou padrão; válidos mantidos',
  );
  bad.auto.cfg.retaliate = 'never';
  bad.auto.cfg.onStrongAggro = 'flee';
  const re = World.fromSave(maps, JSON.parse(JSON.stringify(bad.serialize())));
  ok(re.auto.cfg.retaliate === 'never' && re.auto.cfg.onStrongAggro === 'flee', 'opções sobrevivem ao save/load');
}
{
  // nível máximo: +3 aceita o nível 4 mais perto; +0 recusa o nível 2
  const { w, ms } = scene(1, [
    { level: 4, dx: -3.6, dy: 0 },
    { level: 1, dx: 3.9, dy: 0 },
  ]);
  w.auto.cfg.maxLevelAbove = 3;
  w.auto.toggle();
  run(w, 0.2);
  ok(w.targetId === ms[0].id, 'nível máximo +3: ataca o nível 4 (personagem nível 1)');
  const z = scene(1, [
    { level: 2, dx: -3.6, dy: 0 },
    { level: 1, dx: 3.9, dy: 0 },
  ]);
  z.w.auto.cfg.maxLevelAbove = 0;
  z.w.auto.toggle();
  run(z.w, 0.2);
  ok(z.w.targetId === z.ms[1].id, 'nível máximo +0: ignora o nível 2, ataca o nível 1 mais longe');
}
for (const [mode, want, msg] of [
  ['last', 1, 'cinzas por último: prefere o nível 5 mais longe ao cinza mais perto'],
  ['normal', 0, 'cinzas normais: vai no cinza mais perto'],
  ['ignore', 1, 'ignorar cinzas: vai no nível 5'],
] as const) {
  const { w, ms } = scene(5, [
    { level: 3, dx: -3.6, dy: 0 },
    { level: 5, dx: 3.9, dy: 0 },
  ]);
  w.auto.cfg.grayMode = mode;
  w.auto.toggle();
  run(w, 0.2);
  ok(w.targetId === ms[want].id, msg);
}
{
  const { w } = scene(5, [{ level: 3, dx: -3.6, dy: 0 }]);
  w.auto.cfg.grayMode = 'ignore';
  w.auto.toggle();
  run(w, 0.3);
  ok(w.targetId === null, 'ignorar cinzas: só cinza no mapa, não ataca ninguém');
  w.auto.cfg.grayMode = 'last';
  run(w, 0.3);
  ok(w.targetId !== null, 'cinzas por último: só cinza no mapa, ataca o cinza');
}
{
  // revide: alvo escolhido a (fora da visão); b (nível 4, acima do limite +2) ou c (nível 1) ataca
  const setup = (ret: 'always' | 'inRange' | 'never', aggLevel: number) => {
    const { w, ms } = scene(1, [
      { level: 1, dx: 0, dy: 3.8 },
      { level: aggLevel, dx: 30, dy: 30 },
    ]);
    w.auto.cfg.retaliate = ret;
    w.auto.toggle();
    run(w, 0.1);
    const [a, b] = ms;
    b.x = w.player.x + 1;
    b.y = w.player.y;
    b.home = { x: b.x, y: b.y };
    b.ai = 'chase';
    run(w, 0.1);
    return { w, a, b };
  };
  let r = setup('always', 4);
  ok(r.w.targetId === r.b.id, 'revidar sempre: revida o nível 4 (acima do limite)');
  r = setup('inRange', 4);
  ok(r.w.targetId === r.a.id, 'revidar só até o nível máximo: não revida o nível 4, segue no alvo');
  r = setup('inRange', 1);
  ok(r.w.targetId === r.b.id, 'revidar só até o nível máximo: revida o nível 1');
  r = setup('never', 1);
  ok(r.w.targetId === r.a.id, 'nunca revidar: segue no alvo escolhido');
}
{
  // monstro forte atacando, opção "se afastar": larga o alvo e se afasta até ele desistir (leash)
  const { w, ms } = scene(
    1,
    [
      { level: 1, dx: 0, dy: 3.5 },
      { level: 6, dx: 1, dy: 0, chase: true },
    ],
    true,
  );
  const strong = ms[1];
  strong.attackCd = 0; // ataca (dano pequeno no nível 1 com stamina extra)
  strong.moveSpeed = 2;
  w.auto.cfg.retaliate = 'inRange';
  w.auto.cfg.onStrongAggro = 'flee';
  addPotions(w, 10, 0);
  w.auto.toggle();
  run(w, 0.5);
  ok(w.targetId === null && w.auto.status.includes('Fug'), `se afastar: sem alvo, fugindo (${w.auto.status})`);
  const gaveUp = run(w, 40, () => strong.ai !== 'chase');
  ok(gaveUp && !w.player.dead, 'monstro forte desiste (leash) e o personagem sobrevive');
  run(w, 2);
  ok(w.auto.status === 'Caçando' || w.auto.status === 'Hunting', `volta a caçar (${w.auto.status})`);

  // sem revidar sempre, evita alvo na visão de um monstro forte (parado, sem atacar)
  for (const ret of ['always', 'inRange'] as const) {
    const v = scene(1, [
      { level: 1, dx: -3.6, dy: 0 },
      { level: 1, dx: 3.9, dy: 0 },
      { level: 6, dx: -6, dy: 0 },
    ]);
    v.w.auto.cfg.retaliate = ret;
    v.w.auto.cfg.crowdAvoid = 'off'; // isola o efeito do monstro forte
    v.w.auto.toggle();
    run(v.w, 0.2);
    if (ret === 'always')
      ok(
        v.w.targetId === v.ms[0].id,
        'revidar sempre (sem evitar grupos): vai no alvo mais perto, mesmo perto do forte',
      );
    else ok(v.w.targetId === v.ms[1].id, 'sem revidar sempre: prefere o alvo longe do monstro forte');
  }

  // "continuar caçando": segue no alvo mesmo com o forte batendo
  const k = scene(1, [
    { level: 1, dx: 0, dy: 3.8 },
    { level: 6, dx: 1, dy: 0, chase: true },
  ]);
  k.w.auto.cfg.retaliate = 'never';
  k.w.auto.toggle();
  run(k.w, 0.2);
  ok(k.w.targetId === k.ms[0].id, 'continuar caçando: ignora o forte e ataca o alvo escolhido');

  // "voltar à vila": vai para a cidade e depois volta
  const t = scene(
    1,
    [
      { level: 1, dx: 0, dy: 3.8 },
      { level: 6, dx: 1, dy: 0, chase: true },
    ],
    true,
  );
  addPotions(t.w, 10, 10);
  t.w.auto.cfg.retaliate = 'inRange';
  t.w.auto.cfg.onStrongAggro = 'town';
  t.w.auto.toggle();
  ok(
    run(t.w, 90, () => t.w.mapId === 'cidade'),
    'voltar à vila: foi para a cidade',
  );
  ok(run(t.w, 120, () => t.w.mapId === 'floresta') && t.w.auto.state === 'on', 'voltar à vila: depois volta a caçar');
  // revidar sempre: a opção do monstro forte não vale (revida)
  const s2 = scene(1, [
    { level: 1, dx: 0, dy: 3.8 },
    { level: 6, dx: 1, dy: 0, chase: true },
  ]);
  s2.w.auto.cfg.onStrongAggro = 'town';
  s2.w.auto.toggle();
  run(s2.w, 0.2);
  ok(s2.w.targetId === s2.ms[1].id && s2.w.mapId === 'floresta', 'revidar sempre: ignora a opção e revida o forte');
}

console.log('\n== skills habilitadas ==');
{
  const w = mk('lamina', 9);
  addPotions(w, 5, 5);
  w.auto.cfg.skillsOff = ['corte_duplo'];
  w.player.derived.maxMana = 9999;
  w.player.mana = 9999;
  w.auto.toggle();
  run(w, 60);
  const casts = drain(w).filter((e) => e.type === 'skillCast') as Extract<GameEvent, { type: 'skillCast' }>[];
  const ids = new Set(casts.map((c) => c.skillId));
  ok(!ids.has('corte_duplo'), 'não usa skill desligada (Presas Gêmeas)');
  ok(ids.size >= 2, `usa as ligadas (${[...ids].join(', ')})`);
  const w2 = mk('lamina', 9);
  addPotions(w2, 5, 5);
  w2.player.derived.maxMana = 9999;
  w2.player.mana = 9999;
  w2.auto.toggle();
  run(w2, 60);
  ok(
    drain(w2).some((e) => e.type === 'skillCast' && e.skillId === 'corte_duplo'),
    'com tudo ligado usa Presas Gêmeas',
  );
  const w3 = mk('lamina', 9);
  w3.auto.cfg.skillsOff = w3.activeSkills().map((d) => d.id);
  addPotions(w3, 3, 3);
  w3.auto.toggle();
  run(w3, 40);
  ok(count(drain(w3), 'skillCast') === 0 && w3.skills['corte_duplo'].xp === 0, 'tudo desligado: só ataque básico');
}

console.log('\n== skills de área e escudo ==');
{
  const w = mk('lamina', 9);
  spawnAll(w);
  addPotions(w, 3, 3);
  w.player.derived.maxMana = 9999;
  w.player.mana = 9999;
  for (const m of w.monsters) {
    m.x = 30;
    m.y = 30;
  }
  w.auto.toggle();
  run(w, 3);
  ok(
    !drain(w).some((e) => e.type === 'skillCast' && e.skillId === 'tempestade_laminas'),
    'sem monstro no raio: Tempestade não sai',
  );
  const m = w.monsters[0];
  m.x = w.player.x + 1;
  m.y = w.player.y;
  m.hp = 99999;
  m.derived.maxHp = 99999;
  run(w, 3);
  ok(
    drain(w).some((e) => e.type === 'skillCast' && e.skillId === 'tempestade_laminas'),
    'com monstro no raio: Tempestade sai',
  );
  const p = mk('pavilhao', 9);
  addPotions(p, 3, 3);
  p.player.derived.maxMana = 9999;
  p.player.mana = 9999;
  const wolf = p.monsters[0];
  wolf.ai = 'chase';
  wolf.attackCd = 999;
  wolf.moveSpeed = 0;
  wolf.x = p.player.x + 4;
  wolf.y = p.player.y;
  wolf.hp = 99999;
  wolf.derived.maxHp = 99999;
  p.auto.toggle();
  run(p, 2);
  ok(!drain(p).some((e) => e.type === 'skillCast' && e.skillId === 'escudo_nuvem'), 'HP cheio: sem Véu de Névoa');
  p.player.hp = p.player.derived.maxHp * 0.85;
  run(p, 1);
  ok(
    drain(p).some((e) => e.type === 'skillCast' && e.skillId === 'escudo_nuvem'),
    'levou dano (HP < 90%) com monstro em combate: Véu de Névoa',
  );
  // 2+ monstros atacando: sai mesmo com a vida cheia
  const q = mk('pavilhao', 20);
  q.player.derived.maxMana = 9999;
  q.player.mana = 9999;
  for (const m of q.monsters.slice(0, 2)) {
    m.ai = 'chase';
    m.attackCd = 999;
    m.moveSpeed = 0;
    m.x = q.player.x + 4;
    m.y = q.player.y;
    m.hp = m.derived.maxHp = 99999;
  }
  q.auto.toggle();
  run(q, 1);
  ok(
    drain(q).some((e) => e.type === 'skillCast' && e.skillId === 'escudo_nuvem'),
    '2 monstros atacando, vida cheia: Véu de Névoa',
  );
}

console.log('\n== poções ==');
{
  const w = mk('lamina', 5);
  spawnAll(w);
  addPotions(w, 5, 5);
  for (const m of w.monsters) {
    m.x = 30;
    m.y = 30;
  }
  w.auto.toggle();
  w.player.hp = w.player.derived.maxHp * 0.5;
  w.player.mana = w.player.derived.maxMana * 0.5;
  run(w, 0.3);
  ok(count(drain(w), 'potionUsed') === 0, 'HP 50% / mana 50%: não bebe');
  w.player.hp = w.player.derived.maxHp * 0.3;
  run(w, 0.3);
  const e1 = drain(w).filter((e) => e.type === 'potionUsed') as Extract<GameEvent, { type: 'potionUsed' }>[];
  ok(e1.length === 1 && e1[0].kind === 'hp', 'HP 30% (<40): bebe poção de vida');
  w.player.mana = w.player.derived.maxMana * 0.2;
  run(w, 0.3);
  ok(
    drain(w).some((e) => e.type === 'potionUsed' && e.kind === 'mp'),
    'mana 20% (<30): bebe poção de mana',
  );
  w.auto.cfg.hpThreshold = 80;
  w.player.hp = w.player.derived.maxHp * 0.7;
  w.potionFx.hp = null;
  w.potionCd.hp = 0;
  run(w, 0.3);
  ok(
    drain(w).some((e) => e.type === 'potionUsed' && e.kind === 'hp'),
    'limite configurável (80%) respeitado',
  );
}

console.log('\n== sem poções: vai à vila, compra e volta ==');
for (const [cls, hp, mp] of [
  ['lamina', 10, 5],
  ['pavilhao', 10, 10],
] as const) {
  const w = mk(cls, 5);
  clearPotions(w);
  w.gold = 500;
  spawnAll(w);
  w.auto.toggle();
  const wentTown = run(w, 60, () => w.mapId === 'cidade');
  ok(wentTown, `${cls}: foi à cidade`);
  const back = run(w, 120, () => w.mapId === 'floresta');
  ok(back, `${cls}: voltou à floresta`);
  ok(
    w.kindCount('hp') === hp && w.kindCount('mp') === mp,
    `${cls}: comprou ${hp} vida / ${mp} mana (tem ${w.kindCount('hp')}/${w.kindCount('mp')})`,
  );
  ok(w.gold === 500 - hp * 12 - mp * 14, `${cls}: gastou ${hp * 12 + mp * 14} de ouro`);
  ok(w.auto.state === 'on', `${cls}: auto continua ligado`);
}
{
  const w = mk('lamina', 5);
  clearPotions(w);
  w.gold = 20;
  w.auto.cfg.buyMp = 0;
  spawnAll(w);
  w.auto.toggle();
  run(w, 40, () => w.mapId === 'cidade');
  const hpAfter = w.kindCount('hp');
  run(w, 100, () => w.mapId === 'floresta');
  ok(w.kindCount('hp') === 1 && hpAfter <= 1 && w.gold === 8, 'ouro curto: compra só o que paga (1 poção)');
  const z = mk('lamina', 5);
  clearPotions(z);
  z.gold = 0;
  z.auto.toggle();
  run(z, 60);
  ok(z.mapId === 'floresta' && z.auto.state === 'on', 'sem ouro: continua caçando sem poção');
  const t = mk('lamina', 5, 'cidade');
  t.auto.toggle();
  run(t, 60, () => t.mapId === 'floresta');
  ok(t.mapId === 'floresta', 'ligado na cidade: vai sozinho para o mapa de caça');
}
{
  // caçando nas ruínas (sem portal direto para a vila): vai pela floresta e volta para as ruínas, não para a floresta
  const w = mk('lamina', 8, 'ruinas');
  clearPotions(w);
  w.gold = 500;
  spawnAll(w);
  w.auto.toggle();
  const seen: string[] = [];
  const town = run(w, 120, () => {
    if (seen[seen.length - 1] !== w.mapId) seen.push(w.mapId);
    return w.mapId === 'cidade';
  });
  ok(town && seen.join('>') === 'ruinas>floresta>cidade', `ruínas: foi à vila pela floresta (${seen.join('>')})`);
  const back = run(w, 240, () => {
    if (seen[seen.length - 1] !== w.mapId) seen.push(w.mapId);
    return w.mapId === 'ruinas';
  });
  ok(back && w.kindCount('hp') > 0, `ruínas: comprou e voltou para as ruínas (${seen.join('>')})`);
  ok(w.auto.huntMap === 'ruinas', 'ruínas: mapa de caça continua as ruínas');
}

console.log('\n== monstro perto do portal ==');
{
  // arqueiro na frente do portal das ruínas (floresta): recua do corpo a corpo, mas não entra no portal; o auto o mata
  const w = mk('lamina', 8);
  spawnAll(w);
  const portal = w.map.objects.find((o) => o.type === 'portal' && o.props.target === 'ruinas')!;
  const m = w.makeMonster(MONSTERS.bandido_arqueiro, { x: portal.x - 2.5, y: portal.y + 1.5 });
  m.level = 6;
  w.monsters.forEach((o) => {
    o.dead = true;
    o.respawnAt = 1e9;
  });
  w.monsters.push(m);
  w.player.x = portal.x - 6.5;
  w.player.y = portal.y + 1.5;
  w.auto.toggle();
  let entered = false;
  const killed = run(w, 40, () => {
    if (!m.dead && insideRect(m, portal)) entered = true;
    return m.dead;
  });
  ok(!entered, 'arqueiro não recua para dentro do portal');
  ok(killed && w.mapId === 'floresta', 'auto mata o arqueiro na frente do portal sem atravessar');
  // monstro que já está no tile ao lado do portal: o auto chega nele (antes o círculo em volta do portal o escondia)
  const n = w.makeMonster(MONSTERS.lobo, { x: portal.x - 0.5, y: portal.y + 1.5 });
  n.level = 6;
  w.monsters.push(n);
  w.player.x = portal.x - 6.5;
  w.player.y = portal.y + 1.5;
  ok(run(w, 40, () => n.dead) && w.mapId === 'floresta', 'auto mata o monstro colado no portal sem atravessar');
}

console.log('\n== mochila cheia: volta à vila para vender ==');
{
  const fill = (w: World, r: Rarity) => {
    w.bag = Array(BAG_SIZE).fill(null);
    for (let i = 0; i < BAG_TAB_SIZE; i++) w.bag[i] = makeEquipment('espadas_ferro', r, null, new Rng(i), 1);
    addPotions(w, 99, 99); // não volta à vila por falta de poção
  };
  const drop = (w: World, r: Rarity) =>
    (w as any).collect(makeEquipment('colar_jade', r, null, new Rng(9), 1), w.player.x, w.player.y); // eslint-disable-line
  const trip = (r: Rarity, sellInc: boolean) => {
    const w = mk('lamina', 5);
    spawnAll(w);
    fill(w, r);
    w.auto.cfg.sellIncomum = sellInc;
    w.auto.toggle();
    const g0 = w.gold;
    drop(w, r);
    const ground = w.ground.length;
    const town = run(w, 60, () => w.mapId === 'cidade');
    const back = town && run(w, 120, () => w.mapId === 'floresta');
    return { w, g0, ground, town, back };
  };
  const a = trip('comum', false);
  ok(a.ground === 1, 'aba cheia: drop fica no chão (sem venda instantânea)');
  ok(a.town && a.back, 'Comuns: foi à vila e voltou a caçar');
  ok(a.w.freeSlots() === BAG_TAB_SIZE && a.w.gold > a.g0, `Comuns vendidos no vendedor (+${a.w.gold - a.g0} ouro)`);
  ok(a.w.auto.state === 'on', 'auto continua ligado');
  const b = trip('incomum', false);
  ok(!b.town && b.w.freeSlots() === 0, 'Incomuns com a opção desligada: não vai à vila, continua caçando');
  const c = trip('incomum', true);
  ok(c.town && c.back && c.w.freeSlots() === BAG_TAB_SIZE, 'com a opção ligada: vai à vila vender os Incomuns');
  const d = trip('raro', true);
  ok(!d.town && d.w.freeSlots() === 0 && d.w.auto.state === 'on', 'Raros nunca são vendidos: continua caçando');
  {
    // aba de consumíveis cheia: o auto não olha e não vende equipamento por causa dela
    const wp = mk('lamina', 5);
    for (let i = 0; i < BAG_TAB_SIZE; i++) wp.bag[i] = makePotion('pocao_mp_p', 99);
    for (let i = 0; i < 5; i++) wp.bag[BAG_TAB_SIZE + i] = makeEquipment('espadas_ferro', 'comum', null, new Rng(i), 1);
    wp.auto.toggle();
    const g1 = wp.gold;
    (wp as any).collect(makePotion('pocao_hp_p', 1), wp.player.x, wp.player.y); // eslint-disable-line
    ok(
      wp.gold === g1 && wp.bag.filter((b) => b?.baseId === 'espadas_ferro').length === 5 && wp.ground.length === 1,
      'aba de consumíveis cheia: poção fica no chão e nenhum equipamento é vendido',
    );
  }
}

console.log('\n== morte ==');
{
  const w = mk('lamina', 5);
  addPotions(w, 3, 3);
  spawnAll(w);
  w.auto.toggle();
  run(w, 1);
  (w as any).killPlayer(); // eslint-disable-line
  ok(
    run(w, 10, () => w.mapId === 'cidade'),
    'morreu e renasceu na cidade',
  );
  ok(
    run(w, 120, () => w.mapId === 'floresta'),
    'durabilidade ok: voltou para caçar',
  );
  ok(w.auto.state === 'on', 'auto continua ligado');
  const b = mk('lamina', 5);
  addPotions(b, 3, 3);
  spawnAll(b);
  b.equipment.arma!.durability = 1;
  b.auto.toggle();
  run(b, 1);
  (b as any).killPlayer(); // eslint-disable-line
  run(b, 30);
  const evs = drain(b);
  ok(b.auto.state === 'off' && b.mapId === 'cidade', 'item quebrado: auto para na cidade');
  ok(
    evs.some((e) => e.type === 'autoStopped'),
    'evento autoStopped (toast + dica)',
  );
}

console.log('\n== movimento manual pausa ==');
{
  const w = mk('lamina', 5);
  spawnAll(w);
  w.auto.toggle();
  w.setTarget(w.monsters[0].id);
  ok(w.auto.state === 'on', 'selecionar alvo não pausa');
  w.moveTo(w.player.x + 2, w.player.y);
  ok(w.auto.state === 'pausado', 'clicar para mover pausa');
  const t0 = w.time;
  run(w, 2);
  ok(!w.getTarget() || w.auto.state === 'pausado', 'pausado não age');
  w.auto.toggle();
  ok(w.auto.state === 'on', 'toggle retoma');
  w.setMoveInput(1, 0);
  ok(w.auto.state === 'pausado', 'joystick pausa');
  void t0;
  w.setMoveInput(0, 0);
  ok(w.auto.state === 'pausado', 'soltar o joystick não retoma');
}

console.log('\n== taxa (janela móvel) ==');
{
  const w = mk('lamina', 5);
  addPotions(w, 20, 20);
  w.auto.toggle();
  run(w, 90);
  ok(w.auto.rate() === null, 'menos de 2 min de dados: sem taxa');
  run(w, 400);
  const r = w.auto.rate();
  ok(
    !!r && r.killsPerMin > 0 && r.xpPerKill > 0 && r.goldPerKill > 0 && r.sampleMin >= 2,
    `taxa medida (${r?.killsPerMin.toFixed(2)} abates/min, ${r?.xpPerKill.toFixed(1)} xp/abate)`,
  );
  const s = w.serialize();
  ok(
    !!s.auto && s.auto.active && s.auto.mapId === 'floresta' && (s.auto.buckets?.length ?? 0) > 0,
    'save guarda auto ligado, mapa e dados do ritmo',
  );
  const w2 = World.fromSave(maps, JSON.parse(JSON.stringify(s)));
  ok(!!w2.auto.rate(), 'ritmo sobrevive ao save/load');
  const old = World.fromSave(maps, { ...JSON.parse(JSON.stringify(s)), auto: undefined });
  ok(
    old.auto.state === 'off' && old.auto.cfg.hpThreshold === 40 && !old.offlineReport,
    'save antigo sem campo auto: padrões',
  );
}

console.log('\n== offline: faixas de eficiência ==');
{
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  ok(near(effectiveMinutes(6 * HOUR), 6 * 0.6 * 60), '6 h → 3,6 h efetivas (216 min)');
  ok(near(effectiveMinutes(12 * HOUR), 7.2 * 60), '12 h → 7,2 h');
  ok(near(effectiveMinutes(15 * HOUR), (7.2 + 1.2) * 60), '15 h → 8,4 h');
  ok(near(effectiveMinutes(20 * HOUR), (7.2 + 2.4 + 0.4) * 60), '20 h → 10 h');
  ok(near(effectiveMinutes(30 * HOUR), (7.2 + 2.4 + 1.2) * 60), '30 h → 10,8 h (nada depois de 24 h)');
  ok(effectiveMinutes(-5 * HOUR) === 0 && effectiveMinutes(NaN) === 0, 'tempo negativo/inválido → 0');
  const rate = {
    killsPerMin: 2,
    xpPerKill: 100,
    goldPerKill: 4,
    potHpPerKill: 0.1,
    potMpPerKill: 0.05,
    monLevel: 2,
    sampleMin: 10,
    drops: [
      { baseId: 'espadas_ferro', rarity: 'comum' as Rarity, perKill: 0.1 },
      { baseId: 'pocao_hp_p', rarity: 'comum' as Rarity, perKill: 0.1 },
      { baseId: 'colar_jade', rarity: 'incomum' as Rarity, perKill: 0.1 },
      { baseId: 'espadas_ferro', rarity: 'raro' as Rarity, perKill: 0.1 },
      { baseId: 'minerio_ferro', rarity: 'comum' as Rarity, perKill: 0.5 },
      { baseId: 'pergaminho_retorno', rarity: 'comum' as Rarity, perKill: 0.1 },
    ],
  };
  const r6 = computeOffline({ elapsedMs: 6 * HOUR, rate, level: 1, xp: 0, potions: { hp: 0, mp: 3 }, seed: 1 });
  ok(r6.kills === 432, `6 h: ${r6.kills} abates (2/min × 216 min)`);
  // teto de ouro: 3 h no ritmo medido = 2/min × 60 × 4 ouro × 3 = 1440
  ok(r6.goldCap === 1440 && r6.gold === 1440, `6 h: ouro limitado ao teto (${r6.gold} de ${432 * 4})`);
  const r1 = computeOffline({ elapsedMs: 1 * HOUR, rate, level: 1, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 });
  ok(r1.gold === r1.kills * 4 && r1.gold < r1.goldCap, `1 h: abaixo do teto, ouro cheio (${r1.gold})`);
  ok(
    r6.drops.length === 2 &&
      r6.drops.some((d) => d.baseId === 'espadas_ferro' && d.rarity === 'comum') &&
      r6.drops.some((d) => d.baseId === 'pocao_hp_p'),
    `offline só dropa poção e equipamento Comum (${r6.drops.map((d) => `${d.baseId}|${d.rarity}`).join(', ')})`,
  );
  ok(
    r6.potionsUsed.mp === 3 && r6.potionsUsed.hp > 0,
    'poções gastas limitadas ao que existe (+ drops); ganhos continuam',
  );
  const r30 = computeOffline({ elapsedMs: 30 * HOUR, rate, level: 1, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 });
  ok(
    r30.kills ===
      computeOffline({ elapsedMs: 24 * HOUR, rate, level: 1, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 }).kills,
    '30 h rende o mesmo que 24 h',
  );
  const CAP = PROGRESSION.levelCap;
  const cap = computeOffline({
    elapsedMs: 20 * HOUR,
    rate,
    level: CAP - 1,
    xp: PROGRESSION.xpToNext[CAP - 2] - 100,
    potions: { hp: 0, mp: 0 },
    seed: 1,
  });
  ok(cap.newLevel === CAP && cap.newXp === 0 && cap.levelsGained === 1, `respeita o nível máximo (${CAP})`);
  const atCap = computeOffline({ elapsedMs: 5 * HOUR, rate, level: CAP, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 });
  ok(atCap.xp === 0 && atCap.newLevel === CAP, 'já no nível máximo: sem XP');
  ok(
    computeOffline({ elapsedMs: -HOUR, rate, level: 1, xp: 0, potions: { hp: 0, mp: 0 }, seed: 1 }).kills === 0,
    'relógio atrasado: 0 abates',
  );
}

console.log('\n== offline: aplicando no jogo ==');
{
  const NOW = 1_800_000_000_000;
  const bucket = (): AutoBucket => ({
    sec: 600,
    kills: 30,
    xp: 5000,
    gold: 120,
    potHp: 15,
    potMp: 6,
    levelSum: 60,
    drops: { 'espadas_ferro|comum': 3, 'colar_jade|incomum': 2, 'pocao_hp_p|comum': 4, 'minerio_ferro|comum': 5 },
  });
  const base = (over: Partial<SaveData> = {}): Partial<SaveData> => ({
    auto: { active: true, mapId: 'floresta', buckets: [bucket()] },
    lastSeen: NOW - 6 * HOUR,
    ...over,
  });
  // mochila cheia de Incomuns (o auto não vende): drops offline que não cabem são vendidos
  const fullBag = Array.from({ length: BAG_TAB_SIZE }, () =>
    makeEquipment('colar_jade', 'incomum', null, new Rng(1), 2),
  );
  const w = mk('lamina', 1, 'floresta', base({ bag: fullBag }), NOW);
  const rep = w.offlineReport;
  ok(!!rep, 'gera relatório');
  if (rep) {
    ok(rep.kills === Math.floor(3 * 216), `abates = taxa × minutos efetivos (${rep.kills})`);
    const gained = w.player.level - 1;
    ok(gained >= 5 && rep.levelsGained === gained, `XP sobe vários níveis (nv ${w.player.level})`);
    ok(w.freePoints === gained * PROGRESSION.freePointsPerLevel, `pontos livres acumulam (${w.freePoints})`);
    ok(
      w.player.attrs.strength ===
        CLASSES.lamina.baseAttributes.strength + CLASSES.lamina.levelUpAttributes.strength * gained,
      'pontos automáticos aplicados',
    );
    // ritmo do teste: 3 abates/min × 4 ouro → teto de 3 h = 2160 (abates + vendas)
    ok(
      rep.goldCap === 2160 && rep.goldCapped && rep.gold + rep.soldGold === 2160 && w.gold >= rep.gold,
      `teto de ouro: ${rep.gold} dos abates + ${rep.soldGold} de vendas = ${rep.goldCap}`,
    );
    {
      // mochila só com espaço livre: lota de espadas Comuns, vende todas e continua
      const ws = mk('lamina', 1, 'floresta', base(), NOW);
      const r = ws.offlineReport!;
      const swords = r.items.find((i) => i.rarity === 'comum' && i.qty > BAG_TAB_SIZE)?.qty ?? 0;
      ok(
        swords > BAG_TAB_SIZE && r.soldCount > 0 && r.gold + r.soldGold <= r.goldCap,
        `mochila lotou: vendeu ${r.soldCount} equipamentos e continuou (${swords} espadas no total; ouro dentro do teto)`,
      );
    }
    ok(
      rep.items.every((i) => i.rarity === 'comum') &&
        w.bag.every((b) => !b || (b.baseId !== 'minerio_ferro' && (b.rarity === 'comum' || b.baseId === 'colar_jade'))),
      'offline não traz material nem Incomum/Raro',
    );
    ok(
      rep.soldCount > 0 && w.freeSlots() === 0,
      `overflow vendido (${rep.soldCount} itens, +${rep.soldGold} ouro) e mochila no limite`,
    );
    ok(
      rep.potionsUsed.hp + rep.potionsUsed.mp >= 0 && w.kindCount('mp') === 0,
      'poções consumidas pelo ritmo (acabaram; ganhos continuaram)',
    );
    ok(
      Object.values(w.skills).every((s) => s.xp === 0 && s.level === 1),
      'skills não ganham XP offline',
    );
  }
  ok(w.auto.state === 'off' && w.auto.pendingResume, 'auto espera o resumo ser fechado');
  w.auto.resume();
  ok(w.auto.state === 'on', 'fechar o resumo retoma o auto');
  const neg = mk('lamina', 1, 'floresta', base({ lastSeen: NOW + 3 * HOUR }), NOW);
  ok(neg.offlineReport === null && neg.player.level === 1, 'relógio adulterado (lastSeen no futuro): sem ganhos');
  const off = mk(
    'lamina',
    1,
    'floresta',
    { auto: { active: false, mapId: 'floresta', buckets: [bucket()] }, lastSeen: NOW - HOUR },
    NOW,
  );
  ok(off.offlineReport === null, 'auto desligado ao sair: sem ganhos');
  const town = mk(
    'lamina',
    1,
    'cidade',
    { auto: { active: true, mapId: 'cidade', buckets: [bucket()] }, lastSeen: NOW - HOUR },
    NOW,
  );
  ok(town.offlineReport === null, 'saiu na cidade (mapa sem caça): sem ganhos');
  const none = mk(
    'lamina',
    1,
    'floresta',
    { auto: { active: true, mapId: 'floresta', buckets: [{ ...bucket(), sec: 60 }] }, lastSeen: NOW - HOUR },
    NOW,
  );
  ok(none.offlineReport === null, 'menos de 2 min de dados: sem ganhos');
  const b24 = mk('lamina', 1, 'floresta', base({ lastSeen: NOW - 40 * HOUR }), NOW);
  ok(b24.offlineReport?.kills === Math.floor(3 * 648), 'ausência de 40 h rende o teto de 24 h');

  // voltar do segundo plano (D5): mesmo cálculo, só a partir de 5 min fora
  const autoAt = { active: true, mapId: 'floresta', buckets: [bucket()] };
  const r4 = mk('lamina', 1, 'floresta', { lastSeen: NOW }, NOW);
  ok(r4.applyResumeOffline(NOW + 4 * 60_000, NOW, autoAt) === null, 'voltou após 4 min: sem ganhos');
  const r10 = mk('lamina', 1, 'floresta', base({ lastSeen: NOW }), NOW); // auto com histórico de caça
  r10.auto.resume(); // ligado, como no meio do jogo
  const rep10 = r10.applyResumeOffline(NOW + 10 * 60_000, NOW, autoAt);
  ok(
    !!rep10 && rep10.kills > 0 && r10.gold >= rep10.gold,
    `voltou após 10 min com auto: ganha (${rep10?.kills} abates)`,
  );
  ok(r10.auto.state === 'off' && r10.auto.pendingResume, 'auto espera o resumo ser fechado');
  r10.auto.resume();
  ok(r10.auto.state === 'on', 'fechar o resumo retoma o auto');
  const rOff = mk('lamina', 1, 'floresta', { lastSeen: NOW }, NOW);
  ok(
    rOff.applyResumeOffline(NOW + HOUR, NOW, { ...autoAt, active: false }) === null,
    'voltou após 1 h com auto desligado: sem ganhos',
  );
}

console.log('\n== montanha nevada (marco 9, fase 2) ==');
{
  const north = maps.cidade.objects.find((o) => o.type === 'portal' && o.props.target === 'montanha')!;
  ok(!!north && Number(north.props.minLevel) === 10, 'vila tem a saída norte para a montanha (nível 10)');
  const back = maps.montanha.objects.find((o) => o.type === 'portal' && o.props.target === 'cidade')!;
  ok(!!back, 'montanha tem o portal de volta para a vila');
  const stand = (w: World, o: typeof north) => {
    run(w, 1.1); // espera de 1 s do portal depois de trocar de mapa
    w.player.x = o.x + o.w / 2;
    w.player.y = o.y + o.h / 2;
    run(w, 0.1);
  };
  // nível 9: o portal não leva e avisa uma vez (não a cada quadro)
  const low = mk('lamina', 9, 'cidade');
  stand(low, north);
  run(low, 1);
  const evs = drain(low);
  ok(low.mapId === 'cidade' && count(evs, 'portalLocked') === 1, 'nível 9: portal norte trancado, um aviso');
  // nível 10: atravessa e chega na entrada da montanha (andável); o portal de volta leva à vila (andável)
  const hi = mk('lamina', 10, 'cidade');
  stand(hi, north);
  ok(hi.mapId === 'montanha', 'nível 10: entra na montanha');
  const tile = (w: World) => w.map.walkable[Math.floor(w.player.y) * w.map.width + Math.floor(w.player.x)];
  ok(tile(hi), 'chegada na montanha é andável');
  stand(hi, back);
  ok(hi.mapId === 'cidade' && tile(hi), 'portal de volta: vila, em tile andável');
  // templo: o pátio (arena) é alcançável a pé a partir da entrada
  const m = maps.montanha,
    seen = new Set([27 * m.width + 16]),
    q = [[16, 27]];
  while (q.length) {
    const [x, y] = q.pop()!;
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
  ok(seen.has(6 * m.width + 16), 'montanha: pátio do templo alcançável');
  // Auto ligado na vila: mapa sem monstros não conta; com eles (fase 3), nível 10 vai para a montanha
  const noMobs = { ...maps.montanha, objects: maps.montanha.objects.filter((o) => o.type !== 'monsterSpawn') };
  const saved = maps.montanha;
  maps.montanha = noMobs;
  const a10 = mk('lamina', 10, 'cidade');
  a10.auto.toggle();
  ok(a10.auto.huntMap === 'floresta', 'auto nível 10, montanha sem monstros: caça na floresta');
  maps.montanha = saved;
  const b10 = mk('lamina', 10, 'cidade');
  b10.auto.toggle();
  ok(b10.auto.huntMap === 'montanha', 'auto nível 10 com monstros na montanha: vai para a montanha');
  ok(
    run(b10, 90, () => b10.mapId === 'montanha'),
    'auto nível 10: chegou na montanha',
  );
  const b9 = mk('lamina', 9, 'cidade');
  b9.auto.toggle();
  ok(b9.auto.huntMap === 'floresta', 'auto nível 9: continua na floresta');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
