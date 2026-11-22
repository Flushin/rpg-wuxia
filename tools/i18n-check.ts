// Confere src/data/en.json contra os dados em PT: sem chaves órfãs e com tradução para todo campo de texto.
import en from '../src/data/en.json';
import classes from '../src/data/classes.json';
import ultimates from '../src/data/ultimates.json';
import skills from '../src/data/skills.json';
import items from '../src/data/items.json';
import monsters from '../src/data/monsters.json';
import tips from '../src/data/tips.json';
import npcs from '../src/data/npcs.json';
import quests from '../src/data/quests.json';
import novidades from '../src/data/novidades.json';
import skins from '../src/data/skins.json';
import mounts from '../src/data/mounts.json';
import relics from '../src/data/relics.json';
import { readFileSync, readdirSync } from 'node:fs';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let fails = 0;
const bad = (m: string) => {
  fails++;
  console.log('FALHA:', m);
};

// campos de texto esperados por seção (caminho relativo ao dado em PT)
const isObj = (v: unknown): v is J => !!v && typeof v === 'object';

// 1) toda chave/índice do EN existe no PT (e tem o mesmo tipo)
function orphans(e: unknown, p: unknown, path: string) {
  if (typeof e === 'string') {
    if (typeof p !== 'string') bad(`${path}: EN é texto mas PT não`);
    return;
  }
  if (!isObj(e)) {
    bad(`${path}: valor inesperado`);
    return;
  }
  if (!isObj(p)) {
    bad(`${path}: chave órfã (não existe no PT)`);
    return;
  }
  for (const k of Object.keys(e)) {
    if (!(k in p)) bad(`${path}.${k}: chave órfã (não existe no PT)`);
    else orphans(e[k], p[k], `${path}.${k}`);
  }
}
// 2) todo texto obrigatório do PT tem entrada no EN
function need(p: unknown, e: unknown, path: string) {
  if (typeof p === 'string') {
    if (typeof e !== 'string' || !e.trim()) bad(`${path}: sem tradução EN`);
    return;
  }
  if (!isObj(p)) return;
  if (!isObj(e)) {
    bad(`${path}: sem tradução EN`);
    return;
  }
  for (const k of Object.keys(p)) need(p[k], e[k], `${path}.${k}`);
}

const E = en as J;
const sections: [string, unknown][] = [
  ['classes', classes],
  ['skills', skills],
  ['items', items],
  ['monsters', monsters],
  ['tips', tips],
  ['npcs', npcs],
  ['quests', quests],
  ['novidades', novidades],
  ['skins', skins],
  ['mounts', mounts],
  ['ultimates', ultimates],
];
for (const [name, data] of sections) orphans(E[name], data, name);

// ultimates: name, description
for (const [id, u] of Object.entries(ultimates as J))
  for (const f of ['name', 'description']) need(u[f], E.ultimates?.[id]?.[f], `ultimates.${id}.${f}`);

// classes: name, description, rangeLabel, reasons
for (const [id, c] of Object.entries(classes as J)) {
  for (const f of ['name', 'description', 'rangeLabel']) need(c[f], E.classes?.[id]?.[f], `classes.${id}.${f}`);
  for (const list of ['recommended', 'optional'])
    (c[list] ?? []).forEach((r: J, i: number) =>
      need(r.reason, E.classes?.[id]?.[list]?.[i]?.reason, `classes.${id}.${list}[${i}].reason`),
    );
}
// skills: name, description (por índice)
for (const [cls, list] of Object.entries(skills as J))
  (list as J[]).forEach((s, i) => {
    for (const f of ['name', 'description']) need(s[f], E.skills?.[cls]?.[i]?.[f], `skills.${cls}[${i}].${f}`);
  });
// items: slotNames, rarities, bases, potions (name)
need((items as J).slotNames, E.items?.slotNames, 'items.slotNames');
for (const grp of ['rarities', 'bases', 'potions'])
  for (const id of Object.keys((items as J)[grp]))
    need((items as J)[grp][id].name, E.items?.[grp]?.[id]?.name, `items.${grp}.${id}.name`);
// monsters: name
for (const [id, m] of Object.entries(monsters as J)) need(m.name, E.monsters?.[id]?.name, `monsters.${id}.name`);
// tips: title, text, textTouch, textTouchClassic, byClass
for (const [id, t] of Object.entries(tips as J)) {
  for (const f of ['title', 'text', 'textTouch', 'textTouchClassic'])
    if (f in t) need(t[f], E.tips?.[id]?.[f], `tips.${id}.${f}`);
  if (t.byClass) need(t.byClass, E.tips?.[id]?.byClass, `tips.${id}.byClass`);
}
// skins (trajes): nome e descrição
for (const [id, k] of Object.entries(skins as J))
  for (const f of ['name', 'desc']) need(k[f], E.skins?.[id]?.[f], `skins.${id}.${f}`);
// montarias: nome e descrição
for (const [id, k] of Object.entries(mounts as J))
  for (const f of ['name', 'desc']) need(k[f], E.mounts?.[id]?.[f], `mounts.${id}.${f}`);
// relíquias: nome e descrição de cada uma, nomes das raridades e do espaço
for (const [id, k] of Object.entries((relics as J).list as J))
  for (const f of ['name', 'desc']) need(k[f], E.relics?.list?.[id]?.[f], `relics.list.${id}.${f}`);
for (const [id, k] of Object.entries((relics as J).rarities as J))
  need(k.name, E.relics?.rarities?.[id]?.name, `relics.rarities.${id}`);
need((relics as J).slotName, E.relics?.slotName, 'relics.slotName');
// npcs (falas dos NPCs e mestres): todo texto
need(npcs, E.npcs, 'npcs');
// missões (marco 7): nome, oferta, objetivo e fala de entrega de cada etapa
(quests as J).chain.forEach((q: J, i: number) => {
  for (const f of ['name', 'offer', 'goal', 'done']) need(q[f], E.quests?.chain?.[i]?.[f], `quests.chain[${i}].${f}`);
});
// novidades: todo texto de item (versões e "proxima")
(novidades.proxima as J[]).forEach((n, i) =>
  need(n.texto, E.novidades?.proxima?.[i]?.texto, `novidades.proxima[${i}].texto`),
);
novidades.versoes.forEach((v, i) =>
  v.itens.forEach((n, j) =>
    need(n.texto, E.novidades?.versoes?.[i]?.itens?.[j]?.texto, `novidades.versoes[${i}].itens[${j}].texto`),
  ),
);
// no mais, itens: o EN do item não pode conter o PT idêntico por engano? (só avisa nomes iguais ao PT em campos longos)

// names: todo displayName / portal / NPC / spawn dos mapas tem tradução, e nenhuma chave é órfã
const used = new Set<string>();
for (const f of readdirSync('public/maps').filter((x) => x.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(`public/maps/${f}`, 'utf8')) as J;
  for (const p of m.properties ?? []) if (p.name === 'displayName') used.add(String(p.value));
  for (const l of m.layers)
    if (l.type === 'objectgroup')
      for (const o of l.objects) {
        // NPCs com falas em npcs.json têm o nome traduzido lá
        const npcId = (o.properties ?? []).find((q: J) => q.name === 'npc')?.value;
        const inNpcs = npcId && ((npcs as J).npcs[npcId] || (npcs as J).masters[String(npcId).replace('mestre_', '')]);
        if (['portal', 'npc', 'monsterSpawn'].includes(o.type) && o.name && !inNpcs) used.add(o.name);
      }
}
for (const n of used) if (!E.names?.[n]) bad(`names: "${n}" (mapas) sem tradução EN`);
for (const k of Object.keys(E.names ?? {})) if (!used.has(k)) bad(`names: chave órfã "${k}" (não aparece nos mapas)`);
for (const k of Object.keys(E))
  if (
    ![
      'classes',
      'skills',
      'items',
      'monsters',
      'tips',
      'npcs',
      'quests',
      'novidades',
      'names',
      'skins',
      'mounts',
      'relics',
      'ultimates',
    ].includes(k)
  )
    bad(`seção desconhecida "${k}"`);

console.log(fails ? `${fails} problema(s)` : 'i18n-check: tudo ok');
process.exit(fails ? 1 : 0);
