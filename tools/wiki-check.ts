// Confere a wiki (src/wiki/) contra o jogo: tudo tem ícone/sprite, as fórmulas copiadas dão o mesmo resultado
// que as do jogo e todas as páginas renderizam sem "undefined". Uso: npm run check:wiki
import { existsSync, readFileSync } from 'node:fs';
import { setBalance } from '../src/core/balance';
import { CLASSES as C_CLASSES, MONSTERS as C_MONSTERS } from '../src/core/data';
import {
  BASES as C_BASES,
  CONSUMABLES as C_CONS,
  MATERIALS as C_MATS,
  POTIONS as C_POTIONS,
  RARITIES as C_RAR,
  makeEquipment,
  makeStack,
  sellValue,
} from '../src/core/items';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { MAP_IDS } from '../src/core/mapsConfig';
import { QUESTS as C_QUESTS } from '../src/core/quests';
import { Rng } from '../src/core/rng';
import {
  SKILLS as C_SKILLS,
  SKILL_MAX_LEVEL as C_MAX,
  skillScale as cScale,
  skillXpToNext as cXp,
} from '../src/core/skills';
import { World } from '../src/core/world';
import { offerPrice } from '../src/core/world/merchant';
import atlas from '../src/data/sprites/icones.json';
import * as W from '../src/wiki/data';
import { itemIndexPage, itemPage } from '../src/wiki/items';
import { SHEETS, monsterIndexPage, monsterPage, statsAt } from '../src/wiki/monsters';
import { NPCS, npcIndexPage, npcPage } from '../src/wiki/npcs';
import { sectIndexPage, sectPage, skillIndexPage, skillPage } from '../src/wiki/sects';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// a wiki lê os mapas com fetch('../maps/<id>.json'); aqui vem do disco
globalThis.fetch = (async (url: string) => {
  const f = 'public/maps/' + String(url).split('/').pop();
  return { ok: existsSync(f), json: async () => JSON.parse(readFileSync(f, 'utf8')) };
}) as unknown as typeof fetch;

console.log('== ícones e sprites ==');
{
  const idx = (atlas as { index: Record<string, number> }).index;
  const noIcon = W.allItemIds().filter((id) => idx[id] === undefined);
  ok(!noIcon.length, `todo item tem ícone ${noIcon.join(', ')}`);
  const skills = Object.values(W.SKILLS).flat();
  const noSkillIcon = skills.filter((s) => idx['skill_' + s.id] === undefined).map((s) => s.id);
  ok(!noSkillIcon.length, `toda skill tem ícone ${noSkillIcon.join(', ')}`);
  const noSheet = Object.values(W.MONSTERS).filter(
    (m) => !existsSync(`public/sprites/${SHEETS[m.sprite] ?? m.id}.json`),
  );
  ok(
    !noSheet.length,
    `todo monstro tem sprite (SHEETS em src/wiki/monsters.ts) ${noSheet.map((m) => m.id).join(', ')}`,
  );
  const sheetsMissing = NPCS().filter(
    (n) => !existsSync(`public/sprites/${n.sheet}.json`) || (n.portrait && !existsSync(`public/sprites/${n.portrait}`)),
  );
  ok(!sheetsMissing.length, `todo NPC da wiki tem sprite/retrato ${sheetsMissing.map((n) => n.id).join(', ')}`);
  const onMaps = new Set<string>();
  for (const id of MAP_IDS) {
    const j = JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8'));
    for (const l of j.layers)
      for (const o of l.objects ?? [])
        if (o.type === 'npc') onMaps.add(o.properties.find((p: { name: string }) => p.name === 'npc').value);
  }
  const missing = [...onMaps].filter((id) => !NPCS().some((n) => n.id === id));
  ok(!missing.length, `todo NPC dos mapas tem página na wiki ${missing.join(', ')}`);
  const sects = W.SECT_ORDER.filter(
    (s) =>
      !existsSync(
        `public/sprites/${({ lamina: 'tormenta', pavilhao: 'geada', tita: 'tita', vibora: 'vibora' } as Record<string, string>)[s]}_retrato.png`,
      ),
  );
  ok(
    !sects.length && same(Object.keys(C_CLASSES).sort(), [...W.SECT_ORDER].sort()),
    'as seitas da wiki são as do jogo e têm retrato',
  );
}

console.log('== dados iguais aos do jogo (com balanceamento) ==');
{
  ok(
    same(Object.keys(W.BASES), Object.keys(C_BASES)) &&
      same(W.POTIONS, C_POTIONS) &&
      same(W.MATERIALS, C_MATS) &&
      same(W.CONSUMABLES, C_CONS),
    'itens',
  );
  ok(same(W.RARITIES, C_RAR), 'raridades');
  ok(
    Object.keys(C_MONSTERS).every(
      (id) =>
        same(W.MONSTERS[id]?.loot, C_MONSTERS[id].loot) &&
        W.MONSTERS[id].xpBase === C_MONSTERS[id].xpBase &&
        W.MONSTERS[id].respawnSeconds === C_MONSTERS[id].respawnSeconds,
    ),
    'monstros (drops, XP, renascimento)',
  );
  ok(
    same(
      W.QUESTS.map((q) => [q.id, q.reward]),
      C_QUESTS.map((q) => [q.id, q.reward]),
    ),
    'missões e recompensas',
  );
  const sk = (x: Record<string, { id: string; mana?: number; cooldown?: number; hits?: number[] }[]>) =>
    Object.values(x)
      .flat()
      .map((s) => [s.id, s.mana, s.cooldown, s.hits]);
  ok(same(sk(W.SKILLS), sk(C_SKILLS as never)), 'skills (mana, recarga, golpes)');
}

console.log('== fórmulas copiadas ==');
{
  const check = (label: string) => {
    ok(W.SKILL_MAX_LEVEL === C_MAX, `${label}: nível máximo de skill`);
    const lv = Array.from({ length: C_MAX }, (_, i) => i + 1);
    ok(
      lv.every((l) => W.skillScale(l) === cScale(l) && W.skillXpToNext(l) === cXp(l)),
      `${label}: efeito e usos por nível de skill`,
    );
    const maps: Record<string, GameMap> = {};
    for (const id of MAP_IDS) maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
    const w = World.create(maps, 'T', 'lamina');
    w.changeMap('floresta');
    const e = w.monsters[0];
    const bad: string[] = [];
    for (const m of Object.values(C_MONSTERS))
      for (const level of [m.minLevel, m.maxLevel, m.maxLevel + 3]) {
        w.applyMonsterLevel(e, m, level);
        const s = statsAt(W.MONSTERS[m.id], level).d;
        if (!same(s, e.derived)) bad.push(`${m.id}@${level}`);
      }
    ok(!bad.length, `${label}: atributos dos monstros por nível ${bad.join(', ')}`);
  };
  check('balanceamento atual');
  // regras aplicadas na hora do uso: mudar o multiplicador tem que mudar igual nos dois
  setBalance({ 'vida.monstros': 1.3, 'skills.bonus_por_nivel': 1.2, 'xp.skills': 1.1 });
  check('com multiplicadores de teste');
  setBalance({});

  const rng = new Rng(1);
  const bad: string[] = [];
  for (const id of Object.keys(C_BASES))
    for (const r of Object.keys(C_RAR)) {
      const it = makeEquipment(id, r as never, null, rng);
      if (W.sellPrice(W.BASES[id].value, W.RARITIES[r].valueMul) !== sellValue(it)) bad.push(`venda ${id} ${r}`);
      if (r !== 'comum' && W.merchantPrice(W.BASES[id].value, r) !== offerPrice(it)) bad.push(`mercador ${id} ${r}`);
    }
  for (const id of Object.keys(C_POTIONS))
    if (W.sellPrice(W.POTIONS[id].price) !== sellValue(makeStack(id))) bad.push('venda ' + id);
  for (const id of Object.keys(C_MATS))
    if (W.sellPrice(W.MATERIALS[id].value) !== sellValue(makeStack(id))) bad.push('venda ' + id);
  for (const id of Object.keys(C_CONS))
    if (W.sellPrice(W.CONSUMABLES[id].price) !== sellValue(makeStack(id))) bad.push('venda ' + id);
  ok(!bad.length, `preços de venda e do Mercador ${bad.join(', ')}`);
}

console.log('== páginas ==');
{
  const bad: string[] = [];
  const look = (name: string, html: string | null) => {
    if (!html) bad.push(name + ' (vazia)');
    else if (/undefined|NaN|\[object /.test(html)) bad.push(name);
  };
  for (const t of ['equip', 'potion', 'material', 'consumable'])
    look('itens/' + t, itemIndexPage(t, new URLSearchParams()));
  for (const s of W.SECT_ORDER) look('itens/seita=' + s, itemIndexPage('equip', new URLSearchParams('seita=' + s)));
  for (const id of W.allItemIds()) look('item/' + id, itemPage(id));
  look('npcs', npcIndexPage());
  for (const n of NPCS()) look('npc/' + n.id, npcPage(n.id));
  look('seitas', sectIndexPage());
  for (const s of W.SECT_ORDER) look('seita/' + s, sectPage(s));
  look('skills', skillIndexPage());
  for (const s of Object.values(W.SKILLS).flat()) look('skill/' + s.id, skillPage(s.id));
  look('monstros', await monsterIndexPage());
  for (const id of Object.keys(W.MONSTERS)) look('monstro/' + id, await monsterPage(id));
  ok(!bad.length, `todas as páginas renderizam sem "undefined"/"NaN" ${bad.join(', ')}`);
}

if (fails) {
  console.error(`\n${fails} verificação(ões) da wiki falharam.`);
  process.exit(1);
}
console.log('\nWiki ok.');
