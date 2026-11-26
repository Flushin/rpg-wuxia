// Wiki do Mistpeak (página wiki/index.html, publicada em <site>/wiki/). Navegação por hash: #/itens, #/item/<id>, #/npc/<id>...
import { skinIndexPage } from './skins';
import './wiki.css';
import { BASES, CONSUMABLES, MATERIALS, POTIONS, allItemIds, esc, iconHtml, itemName } from './data';
import { itemIndexPage, itemPage } from './items';
import { NPCS, fillSprites, npcIndexPage, npcPage, spriteHtml } from './npcs';
import { CLASSES, EPIC_ITEMS, MONSTERS, QUESTS, SECT_ORDER, SKILLS, SKINS } from './data';
import { TOPICS, mechanicsPage, topicBody } from './mechanics';
import { novidadesPage } from './novidades';
import { dungeonIndexPage, fillMinimaps, mapIndexPage, mapPage, questIndexPage } from './world';
import { sectIndexPage, sectPage, skillIndexPage, skillPage } from './sects';
import { DUNGEONS } from '../core/dungeons';
import { loadMaps, type WikiMap } from './maps';
import { isSpoiler, monsterIndexPage, monsterPage, monsterSprite } from './monsters';

interface Cat {
  id: string;
  label: string;
  icon: string;
  ready: boolean;
}
// Ícones: emojis por enquanto nas categorias sem item que as represente.
const CATS: Cat[] = [
  { id: 'novidades', label: 'Novidades', icon: '✨', ready: true },
  { id: 'mecanicas', label: 'Mecânicas', icon: '📜', ready: true },
  { id: 'seitas', label: 'Seitas', icon: '☯', ready: true },
  { id: 'skills', label: 'Skills', icon: 'skill_corte_duplo', ready: true },
  { id: 'itens', label: 'Itens', icon: 'espadas_ferro', ready: true },
  { id: 'monstros', label: 'Monstros', icon: '🐺', ready: true },
  { id: 'npcs', label: 'NPCs', icon: '🧙', ready: true },
  { id: 'trajes', label: 'Trajes', icon: '👘', ready: true },
  { id: 'missoes', label: 'Missões', icon: '❗', ready: true },
  { id: 'mapas', label: 'Mapas', icon: '🗺', ready: true },
  { id: 'masmorras', label: 'Masmorras', icon: '🏯', ready: true },
];
const catIcon = (c: Cat) => (/^[a-z_]+$/.test(c.icon) ? iconHtml(c.icon, 'sm') : `<span class="emo">${c.icon}</span>`);

const $ = (s: string) => document.querySelector(s) as HTMLElement;

function nav(active: string) {
  $('#nav').innerHTML =
    `<a class="${active === '' ? 'on' : ''}" href="#/"><span class="emo">⌂</span>Início</a>` +
    CATS.map(
      (c) =>
        `<a class="${active === c.id ? 'on' : ''} ${c.ready ? '' : 'soon'}" href="#/${c.id}">${catIcon(c)}${c.label}${c.ready ? '' : '<small>em breve</small>'}</a>`,
    ).join('');
}

function home(): string {
  return `<h1>Wiki do Mistpeak</h1>
    <p class="intro">Tudo sobre o jogo: novidades, mecânicas, seitas, itens, monstros, NPCs, missões, mapas e masmorras. Os números aqui saem direto dos dados do jogo,
    então estão sempre atualizados. Conteúdo sobre chefes fica escondido atrás de um aviso de <b>spoiler</b>.</p>
    <div class="grid cats">${CATS.map(
      (c) =>
        `<a class="card-link cat ${c.ready ? '' : 'soon'}" href="#/${c.id}">${catIcon(c)}<b>${c.label}</b><small>${c.ready ? '' : 'em breve'}</small></a>`,
    ).join('')}</div>`;
}

const soon = (c: Cat) => `<h1>${c.label}</h1><p class="intro">Esta seção ainda está sendo escrita. Volte em breve!</p>`;

// ---------- Busca ----------
// Acha categorias, mecânicas (cada seção e o texto delas), seitas, skills, itens, NPCs, missões, trajes, mapas
// e monstros. Cada palavra digitada precisa casar com o nome, com as palavras-chave (tipo, seita, quem dá...)
// ou, com peso menor, com o texto da página. Tolera plural/singular, acento e um erro de digitação.
interface Hit {
  name: string;
  href: string;
  icon: string;
  kind: string;
  /** palavras extras (tipo, seita, NPC...) */
  keys?: string;
  /** texto corrido da página (só para casar, peso baixo) */
  text?: string;
  /** desempate: categorias e tópicos primeiro */
  boost?: number;
}
interface Entry extends Hit {
  nName: string[];
  nKeys: string[];
  nText: string;
}
let index: Entry[] | null = null;
let maps: WikiMap[] | null = null;
void loadMaps().then((m) => {
  maps = m;
  index = null; // refaz o índice com os monstros
});
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s: string) =>
  norm(s)
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
const emo = (e: string) => `<span class="emo">${e}</span>`;

function buildIndex(): Hit[] {
  const sectName = (id?: string) => (id && CLASSES[id]?.name) || '';
  const hits: Hit[] = [
    { name: 'Início', href: '#/', icon: emo('⌂'), kind: 'Página', keys: 'home inicio', boost: 3 },
    ...CATS.map((c) => ({
      name: c.label,
      href: `#/${c.id}`,
      icon: catIcon(c),
      kind: 'Categoria',
      keys: c.id,
      boost: 4,
    })),
  ];
  for (const t of TOPICS) {
    const body = topicBody(t.id);
    hits.push({
      name: t.label,
      href: `#/mecanicas/${t.id}`,
      icon: iconHtml(t.icon, 'sm'),
      kind: 'Mecânica',
      keys: 'mecanica',
      text: plain(body),
      boost: 3,
    });
    // cada seção (<h2>) do tópico vira um resultado que rola até ela
    for (const m of body.matchAll(/<h2>(.*?)<\/h2>([\s\S]*?)(?=<h2>|$)/g)) {
      const h = plain(m[1]).trim();
      if (!h) continue;
      hits.push({
        name: `${h}`,
        href: `#/mecanicas/${t.id}?s=${encodeURIComponent(h)}`,
        icon: iconHtml(t.icon, 'sm'),
        kind: t.label,
        text: plain(m[2]),
        boost: 1,
      });
    }
  }
  hits.push(
    ...allItemIds().map((id) => ({
      name: itemName(id),
      href: `#/item/${id}`,
      icon: iconHtml(id, 'sm'),
      kind:
        id in BASES
          ? 'Equipamento'
          : id in POTIONS
            ? 'Poção'
            : id in MATERIALS
              ? 'Material'
              : id in CONSUMABLES
                ? 'Consumível'
                : 'Item',
    })),
    ...EPIC_ITEMS.map((e) => ({
      name: e.name,
      href: `#/item/${e.id}`,
      icon: iconHtml(e.id, 'sm'),
      kind: 'Equipamento Épico',
      keys: `epico ${sectName(e.sect)}`,
    })),
    ...NPCS().map((n) => ({ name: n.name, href: `#/npc/${n.id}`, icon: spriteHtml(n.sheet, 'mini'), kind: 'NPC' })),
    ...SECT_ORDER.filter((id) => CLASSES[id]).map((id) => ({
      name: CLASSES[id].name,
      href: `#/seita/${id}`,
      icon: emo('☯'),
      kind: 'Seita',
      keys: 'classe',
      boost: 2,
    })),
    ...SECT_ORDER.flatMap((sect) =>
      (SKILLS[sect] ?? []).map((k) => ({
        name: k.name,
        href: `#/skill/${k.id}`,
        icon: iconHtml('skill_' + k.id, 'sm'),
        kind: `Skill · ${sectName(sect)}`,
        keys: `skill habilidade ${sectName(sect)}`,
      })),
    ),
    ...QUESTS.map((q) => ({
      name: q.name,
      href: `#/missoes?a=q-${q.id}`,
      icon: emo('❗'),
      kind: 'Missão',
      keys: `missao quest ${NPCS().find((n) => n.id === q.giver)?.name ?? ''}`,
      text: `${q.goal} ${q.offer}`,
    })),
    ...Object.values(SKINS).map((k) => ({
      name: k.name,
      href: '#/trajes',
      icon: emo('👘'),
      kind: `Traje · ${sectName(k.sect)}`,
      keys: `traje skin roupa ${sectName(k.sect)}`,
      text: k.desc,
    })),
    ...(maps ?? []).map((m) => ({
      name: m.name,
      href: `#/mapa/${m.id}`,
      icon: emo('🗺'),
      kind: DUNGEONS.some((d) => d.map === m.id) ? 'Masmorra' : 'Mapa',
      keys: 'mapa',
    })),
    // chefes ficam fora da busca (spoiler)
    ...Object.values(MONSTERS)
      .filter((m) => maps && !isSpoiler(m, maps))
      .map((m) => ({
        name: m.name,
        href: `#/monstro/${m.id}`,
        icon: monsterSprite(m, 'mini'),
        kind: 'Monstro',
        keys: 'monstro',
      })),
  );
  return hits;
}
function searchIndex(): Entry[] {
  return (index ??= buildIndex().map((h) => ({
    ...h,
    nName: words(h.name),
    nKeys: words(`${h.kind} ${h.keys ?? ''}`),
    nText: ` ${words(h.text ?? '').join(' ')} `,
  })));
}

/** plural/singular simples do português: "seitas" ~ "seita", "pocoes" ~ "pocao", "anéis" ~ "anel" */
function stem(w: string): string {
  if (w.length <= 3) return w;
  return w
    .replace(/(oes|aes)$/, 'ao')
    .replace(/eis$/, 'el')
    .replace(/(res|zes)$/, (m) => m[0])
    .replace(/s$/, '');
}
/** distância de edição ≤ 1 (um erro: troca, falta ou sobra uma letra) */
function near(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}
/** nota de uma palavra digitada contra as palavras de um campo (0 = não casa) */
function wordScore(q: string, list: string[]): number {
  const qs = stem(q);
  let best = 0;
  for (const w of list) {
    const ws = stem(w);
    if (w === q || ws === qs) return 10;
    if (w.startsWith(q) || ws.startsWith(qs)) best = Math.max(best, 7);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 4);
    else if (q.length >= 4 && (near(qs, ws) || near(q, w.slice(0, q.length)))) best = Math.max(best, 3);
  }
  return best;
}
function score(e: Entry, qw: string[], full: string): number {
  let total = 0;
  for (const q of qw) {
    const s = Math.max(wordScore(q, e.nName) * 3, wordScore(q, e.nKeys) * 1.5, e.nText.includes(' ' + stem(q)) ? 4 : 0);
    if (!s) return 0; // toda palavra precisa casar em algum lugar
    total += s;
  }
  const n = e.nName.join(' ');
  if (n === full) total += 40;
  else if (n.startsWith(full)) total += 15;
  return total + (e.boost ?? 0) * 2;
}

const LIMIT = 30;
function renderSearch(q: string) {
  const box = $('#results');
  const qw = words(q);
  if (!qw.length) {
    box.classList.add('hidden');
    return;
  }
  const seen = new Set<string>();
  const hits = searchIndex()
    .map((e) => ({ e, s: score(e, qw, qw.join(' ')) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .filter((x) => !seen.has(x.e.href + x.e.name) && !!seen.add(x.e.href + x.e.name))
    .slice(0, LIMIT);
  box.innerHTML = hits.length
    ? hits
        .map(({ e: h }) => `<a href="${h.href}">${h.icon}<span>${esc(h.name)}</span><small>${esc(h.kind)}</small></a>`)
        .join('')
    : `<div class="muted">Nada encontrado para “${esc(q.trim())}”. Tente outra palavra ou veja as <a href="#/">categorias</a>.</div>`;
  box.classList.remove('hidden');
  void fillSprites(box);
}

/** Depois de abrir a página: rola até a âncora pedida pela busca (?a=id ou ?s=título da seção). */
function scrollToTarget(main: HTMLElement, params: URLSearchParams): boolean {
  const id = params.get('a'),
    sec = params.get('s');
  let el: HTMLElement | null = null;
  if (id) el = document.getElementById(id);
  else if (sec) el = [...main.querySelectorAll('h2')].find((h) => h.textContent?.trim() === sec) ?? null;
  if (!el) return false;
  el.scrollIntoView({ block: 'start' });
  el.classList.add('flash');
  setTimeout(() => el?.classList.remove('flash'), 1600);
  return true;
}

// ---------- Rotas ----------
let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(qs);
  let html: string | null | Promise<string | null> = null,
    active = parts[0] ?? '';
  if (!parts.length) html = home();
  else if (parts[0] === 'itens') html = itemIndexPage(parts[1] ?? 'equip', params);
  else if (parts[0] === 'item') {
    html = itemPage(parts[1] ?? '');
    active = 'itens';
  } else if (parts[0] === 'npcs') html = npcIndexPage();
  else if (parts[0] === 'npc') {
    html = npcPage(parts[1] ?? '');
    active = 'npcs';
  } else if (parts[0] === 'seitas') html = sectIndexPage();
  else if (parts[0] === 'seita') {
    html = sectPage(parts[1] ?? '');
    active = 'seitas';
  } else if (parts[0] === 'skills') html = skillIndexPage();
  else if (parts[0] === 'skill') {
    html = skillPage(parts[1] ?? '');
    active = 'skills';
  } else if (parts[0] === 'novidades') html = novidadesPage();
  else if (parts[0] === 'trajes') html = skinIndexPage();
  else if (parts[0] === 'mecanicas') html = mechanicsPage(parts[1]);
  else if (parts[0] === 'missoes') html = questIndexPage();
  else if (parts[0] === 'mapas') html = mapIndexPage();
  else if (parts[0] === 'masmorras') html = dungeonIndexPage();
  else if (parts[0] === 'mapa') {
    html = mapPage(parts[1] ?? '');
    active = 'mapas';
  } else if (parts[0] === 'monstros') html = monsterIndexPage();
  else if (parts[0] === 'monstro') {
    html = monsterPage(parts[1] ?? '');
    active = 'monstros';
  } else {
    const c = CATS.find((x) => x.id === parts[0]);
    if (c) html = soon(c);
  }
  nav(active);
  const main = $('#main');
  if (html instanceof Promise) {
    main.innerHTML = '<p class="muted">Carregando…</p>';
    html = await html.catch(() => '<h1>Erro ao carregar</h1><p>Verifique a conexão e recarregue a página.</p>');
    if (seq !== routeSeq) return; // o jogador já foi para outra página
  }
  html ??= `<h1>Página não encontrada</h1><p><a href="#/">Voltar ao início</a></p>`;
  main.innerHTML = html;
  void fillSprites(main);
  void fillMinimaps(main);
  const title = main.querySelector('h1')?.textContent;
  document.title = title && parts.length ? `${title} · Wiki do Mistpeak` : 'Wiki do Mistpeak';
  $('#results').classList.add('hidden');
  ($('#q') as HTMLInputElement).value = '';
  document.body.classList.remove('menu-open');
  if (!scrollToTarget(main, params)) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void route());
const q = $('#q') as HTMLInputElement;
q.addEventListener('input', () => renderSearch(q.value));
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ($('#results a') as HTMLAnchorElement | null)?.click();
  if (e.key === 'Escape') renderSearch((q.value = ''));
});
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.search')) $('#results').classList.add('hidden');
});
$('#menu-btn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
void route();
