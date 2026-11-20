// Wiki do Mistpeak (página wiki/index.html, publicada em <site>/wiki/). Navegação por hash: #/itens, #/item/<id>, #/npc/<id>...
import './wiki.css';
import { BASES, CONSUMABLES, MATERIALS, POTIONS, allItemIds, esc, iconHtml, itemName } from './data';
import { itemIndexPage, itemPage } from './items';
import { NPCS, fillSprites, npcIndexPage, npcPage, spriteHtml } from './npcs';
import { CLASSES, EPIC_ITEMS, MONSTERS, SECT_ORDER, SKILLS } from './data';
import { mechanicsPage } from './mechanics';
import { novidadesPage } from './novidades';
import { fillMinimaps, mapIndexPage, mapPage, questIndexPage } from './world';
import { sectIndexPage, sectPage, skillIndexPage, skillPage } from './sects';
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
  { id: 'missoes', label: 'Missões', icon: '❗', ready: true },
  { id: 'mapas', label: 'Mapas', icon: '🗺', ready: true },
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
    <p class="intro">Tudo sobre o jogo: novidades, mecânicas, seitas, itens, monstros, NPCs e missões. Os números aqui saem direto dos dados do jogo,
    então estão sempre atualizados. Conteúdo sobre chefes fica escondido atrás de um aviso de <b>spoiler</b>.</p>
    <div class="grid cats">${CATS.map(
      (c) =>
        `<a class="card-link cat ${c.ready ? '' : 'soon'}" href="#/${c.id}">${catIcon(c)}<b>${c.label}</b><small>${c.ready ? '' : 'em breve'}</small></a>`,
    ).join('')}</div>`;
}

const soon = (c: Cat) => `<h1>${c.label}</h1><p class="intro">Esta seção ainda está sendo escrita. Volte em breve!</p>`;

// ---------- Busca ----------
interface Hit {
  name: string;
  href: string;
  icon: string;
  kind: string;
}
let index: Hit[] | null = null;
let maps: WikiMap[] | null = null;
void loadMaps().then((m) => {
  maps = m;
  index = null; // refaz o índice com os monstros
});
function searchIndex(): Hit[] {
  return (index ??= [
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
                : '',
    })),
    ...EPIC_ITEMS.map((e) => ({
      name: e.name,
      href: '#/mecanicas/epico',
      icon: iconHtml(e.id, 'sm'),
      kind: 'Equipamento Épico',
    })),
    ...NPCS().map((n) => ({ name: n.name, href: `#/npc/${n.id}`, icon: spriteHtml(n.sheet, 'mini'), kind: 'NPC' })),
    ...SECT_ORDER.filter((id) => CLASSES[id]).map((id) => ({
      name: CLASSES[id].name,
      href: `#/seita/${id}`,
      icon: '<span class="emo">☯</span>',
      kind: 'Seita',
    })),
    ...Object.values(SKILLS)
      .flat()
      .map((k) => ({ name: k.name, href: `#/skill/${k.id}`, icon: iconHtml('skill_' + k.id, 'sm'), kind: 'Skill' })),
    ...(maps ?? []).map((m) => ({
      name: m.name,
      href: `#/mapa/${m.id}`,
      icon: '<span class="emo">🗺</span>',
      kind: 'Mapa',
    })),
    // chefes ficam fora da busca (spoiler)
    ...Object.values(MONSTERS)
      .filter((m) => maps && !isSpoiler(m, maps))
      .map((m) => ({ name: m.name, href: `#/monstro/${m.id}`, icon: monsterSprite(m, 'mini'), kind: 'Monstro' })),
  ]);
}
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function renderSearch(q: string) {
  const box = $('#results');
  const n = norm(q.trim());
  if (!n) {
    box.classList.add('hidden');
    return;
  }
  const hits = searchIndex()
    .filter((h) => norm(h.name).includes(n))
    .slice(0, 12);
  box.innerHTML = hits.length
    ? hits.map((h) => `<a href="${h.href}">${h.icon}<span>${esc(h.name)}</span><small>${h.kind}</small></a>`).join('')
    : '<div class="muted">Nada encontrado.</div>';
  box.classList.remove('hidden');
  void fillSprites(box);
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
  else if (parts[0] === 'mecanicas') html = mechanicsPage(parts[1]);
  else if (parts[0] === 'missoes') html = questIndexPage();
  else if (parts[0] === 'mapas') html = mapIndexPage();
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
  window.scrollTo(0, 0);
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
