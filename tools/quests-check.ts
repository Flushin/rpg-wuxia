// Verificação headless das missões (marco 7). Uso: npm run check:quests
import { readFileSync } from 'node:fs';
import { CLASSES, MONSTERS, PROGRESSION } from '../src/core/data';
import { BASES, BAG_SIZE, makePotion } from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { QUESTS, sanitizeQuest } from '../src/core/quests';
import { World } from '../src/core/world';
import type { Entity, GameEvent } from '../src/core/types';

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
type Priv = { killMonster: (m: Entity) => void; questTalk: (id: string) => void; openNpcWindow: (n: Entity) => void };
const priv = (w: World) => w as unknown as Priv;
const drain = (w: World): GameEvent[] => w.events.splice(0);
const setLevel = (w: World, lvl: number) => {
  w.player.level = lvl;
};
/** Mata (de mentira) um monstro do tipo pedido, criando-o se o mapa não tiver. */
function kill(w: World, monsterId: string) {
  const m = {
    ...w.monsters[0],
    monsterId,
    dead: false,
    hp: 1,
    summoned: true,
    spawnKey: undefined,
  } as unknown as Entity;
  w.monsters.push(m);
  priv(w).killMonster(m);
}
const talkTo = (w: World, role: string) => {
  const n = w.npcs.find((x) => x.npcId === role);
  if (!n) throw new Error('npc ' + role);
  w.closeNpc();
  priv(w).openNpcWindow(n);
};

console.log('== dados ==');
ok(QUESTS.length === 14, '14 etapas na cadeia (8 até o nível 10 + 6 do marco 9)');
ok(
  QUESTS.slice(8).every((q) => q.minLevel >= 10) && QUESTS[QUESTS.length - 1].objective.type === 'kill',
  'etapas do marco 9 a partir do nível 10, terminando num abate (o Abade)',
);
ok(
  QUESTS.every((q, i) => i === 0 || q.minLevel >= QUESTS[i - 1].minLevel),
  'níveis mínimos em ordem',
);
ok(
  QUESTS.every((q) => q.objective.type !== 'kill' || MONSTERS[q.objective.monster]),
  'todos os monstros das missões existem',
);
ok(
  QUESTS.filter((q) => q.reward.item)
    .map((q) => q.id)
    .join() === 'acampamentos,barro_bronze,fera_branca,guardioes_templo',
  'itens nas etapas 4, 7, 11 e 13',
);

for (const classId of ['lamina', 'pavilhao']) {
  console.log(`== cadeia completa (${CLASSES[classId].name}) ==`);
  const w = World.create(maps, 'Teste', classId);
  drain(w);
  const mestre = 'mestre_' + classId;
  ok(w.questMark('anciao') === '!', 'ancião mostra "!" no começo');
  ok(!w.questAccept(), 'não aceita sem falar com o ancião');
  talkTo(w, 'anciao');
  ok(w.questAccept(), 'aceita falando com o ancião');
  ok(w.questMark(mestre) === '?', 'mestre da seita mostra "?" (falar com ele cumpre)');
  ok(
    w.questMark('mestre_' + (classId === 'lamina' ? 'pavilhao' : 'lamina')) === null,
    'mestre de outra seita não tem marca',
  );
  talkTo(w, mestre);
  ok(w.questView().phase === 'ready', 'falar com o mestre deixa a missão pronta');
  const xp0 = w.xp,
    gold0 = w.gold;
  ok(w.questTurnIn(), 'entrega para o mestre');
  ok(w.gold === gold0 + QUESTS[0].reward.gold && (w.xp > xp0 || w.player.level > 1), 'recebe ouro e XP');
  ok(w.questView().phase === 'available' && w.questMark(mestre) === '!', 'etapa 2 já disponível no mestre (nível 1)');
  w.questAccept();
  // 'kill' só conta o monstro certo
  w.changeMap('floresta', 5.5, 16.5);
  kill(w, 'bandido_espadachim');
  ok(w.quest.progress === 0, 'abater outro monstro não conta');
  for (let i = 0; i < 5; i++) kill(w, 'lobo');
  ok(w.questView().phase === 'ready', '5 lobos: pronta para entregar');
  kill(w, 'lobo');
  ok(w.quest.progress === 5, 'progresso não passa do total');
  ok(!w.questTurnIn(), 'não entrega longe do mestre');
  w.changeMap('cidade');
  talkTo(w, mestre);
  ok(w.questTurnIn(), 'entrega a etapa 2');
  // trava de nível
  setLevel(w, 1);
  ok(w.questView().phase === 'locked' && w.questMark('guarda') === null, 'etapa 3 travada no nível 1 (sem "!")');
  setLevel(w, 2);
  ok(w.questMark('guarda') === '!', 'nível 2: guarda mostra "!"');
  // percorre o resto com force e confere os itens
  const bagEquip = () => w.bag.filter((it) => it && BASES[it.baseId]).map((it) => it!);
  for (let s = 2; s < QUESTS.length; s++) {
    const q = QUESTS[s];
    setLevel(w, Math.max(w.player.level, q.minLevel));
    ok(w.questAccept(true), `aceita "${q.name}"`);
    const o = q.objective;
    if (o.type === 'kill') for (let i = 0; i < o.count; i++) kill(w, o.monster);
    else if (o.type === 'reach') w.changeMap(o.map);
    ok(w.questView().phase === 'ready', `"${q.name}" cumprida`);
    // Os abates acima soltam itens por sorteio (às vezes uma arma Incomum nv 1): olhar só o que a entrega acrescentou.
    const before = new Set(bagEquip().map((x) => x.uid));
    ok(w.questTurnIn(true), `entrega "${q.name}"`);
    const gained = bagEquip().filter((x) => !before.has(x.uid));
    if (q.reward.item === 'arma') {
      const it = gained[0];
      ok(
        gained.length === 1 &&
          BASES[it.baseId].slot === 'arma' &&
          it.rarity === 'incomum' &&
          BASES[it.baseId].sect === classId &&
          BASES[it.baseId].reqLevel === (q.reward.itemLevel ?? 5),
        `arma Incomum nv ${q.reward.itemLevel ?? 5} da própria seita`,
      );
    }
    if (q.reward.item === 'tronco')
      ok(
        gained.length === 1 &&
          BASES[gained[0].baseId].slot === 'tronco' &&
          gained[0].rarity === 'incomum' &&
          BASES[gained[0].baseId].reqLevel === (q.reward.itemLevel ?? 5),
        `tronco Incomum nv ${q.reward.itemLevel ?? 5}`,
      );
    w.changeMap('cidade');
  }
  ok(
    w.questView().phase === 'complete' &&
      ['anciao', 'guarda', 'mercador', mestre].every((n) => w.questMark(n) === null),
    'cadeia completa: sem marcas',
  );
  const evs = drain(w).filter((e) => e.type === 'quest');
  ok(
    evs.filter((e) => e.type === 'quest' && e.kind === 'completed').length === QUESTS.length,
    `${QUESTS.length} avisos de missão concluída`,
  );
}

console.log('== save ==');
{
  const w = World.create(maps, 'Teste', 'lamina');
  w.questAccept(true);
  w.quest = { stage: 2, status: 'active', progress: 3 };
  const w2 = World.fromSave(maps, w.serialize(), Date.now(), false);
  ok(w2.quest.stage === 2 && w2.quest.status === 'active' && w2.quest.progress === 3, 'missão volta igual do save');
  const old = w.serialize();
  delete old.quest;
  ok(World.fromSave(maps, old, Date.now(), false).quest.stage === 0, 'save antigo começa a cadeia do zero');
  const bad = sanitizeQuest({ stage: 99, status: 'xx', progress: -4 });
  ok(bad.stage === QUESTS.length && bad.status === 'pending' && bad.progress === 0, 'save corrompido é saneado');
  ok(sanitizeQuest({ stage: 1, status: 'active', progress: 500 }).progress === 5, 'progresso limitado ao total');
}

console.log('== mochila cheia ==');
{
  const w = World.create(maps, 'Teste', 'lamina');
  for (let i = 0; i < BAG_SIZE; i++) w.bag[i] = makePotion(i % 2 ? 'pocao_hp_p' : 'pocao_mp_p', 99);
  w.quest = { stage: 3, status: 'ready', progress: 6 };
  ok(
    w.questTurnIn(true) && w.ground.some((g) => g.item && BASES[g.item.baseId]?.slot === 'arma'),
    'mochila cheia: a arma cai no chão (não se perde)',
  );
}

console.log('== nível máximo ==');
{
  const cap = PROGRESSION.levelCap;
  const w = World.create(maps, 'Teste', 'lamina');
  setLevel(w, cap);
  w.xp = 0;
  w.quest = { stage: 7, status: 'ready', progress: 1 };
  const g0 = w.gold;
  ok(
    w.questTurnIn(true) && w.player.level === cap && w.xp === 0 && w.gold === g0 + QUESTS[7].reward.gold,
    'no nível máximo: só o ouro (sem XP extra)',
  );
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
