// HUD do toque (18/11/2026; o layout "clássico" saiu em 26/11/2026): em aparelhos de toque liga a classe
// body.hud-v2; todo o CSS dele fica em src/styles/hud-mobile.css.
// ⚙/Skills/Atributos/Mochila saem do topo e vão para o menu ☰ (os mesmos botões, movidos no DOM,
// então continuam com os mesmos cliques). No PC ficam no topo.
import { L } from '../core/i18n';
import { isTouch } from '../platform/input';
import { audio } from '../render/audio';
import { byId } from './dom';

/** Botões que ficam no menu ☰ no layout novo, na ordem do menu. */
const MENU_IDS = ['btn-skills', 'btn-attrs', 'btn-bag', 'btn-settings'] as const;

let bound = false;

/** true quando o HUD do celular está valendo (só em aparelhos de toque). */
export const hudV2 = () => isTouch;

/** Liga o HUD do celular. Chame antes de criar a Hotbar (ela lê a classe para montar o arco). */
export function applyHudLayout() {
  const on = hudV2();
  document.body.classList.toggle('hud-v2', on);
  const menu = byId('hud-menu'),
    btn = byId('btn-menu');
  btn.classList.toggle('hidden', !on);
  if (on) for (const id of MENU_IDS) menu.appendChild(byId(id));
  labels();
  if (!bound) bind();
  // arco das skills, feed de itens e missão se reposicionam
  window.dispatchEvent(new Event('resize'));
}

/** Rótulos dos itens do menu (o texto do botão fica escondido; o CSS mostra ícone + data-label). */
function labels() {
  const t: Record<(typeof MENU_IDS)[number], string> = {
    'btn-skills': L('Skills', 'Skills'),
    'btn-attrs': L('Personagem', 'Character'),
    'btn-bag': L('Mochila', 'Bag'),
    'btn-settings': L('Configurações', 'Settings'),
  };
  for (const id of MENU_IDS) byId(id).dataset.label = t[id];
  byId('btn-menu').setAttribute('aria-label', L('Menu', 'Menu'));
}

export const menuOpen = () => !byId('hud-menu').classList.contains('hidden');

function setMenu(open: boolean) {
  const menu = byId('hud-menu');
  if (open === menuOpen()) return;
  menu.classList.toggle('hidden', !open);
  byId('btn-menu').setAttribute('aria-expanded', String(open));
  byId('btn-menu').classList.toggle('open', open);
}

function bind() {
  bound = true;
  const btn = byId('btn-menu'),
    menu = byId('hud-menu');
  btn.addEventListener('focus', () => btn.blur());
  btn.addEventListener('click', () => {
    audio.ui('ui_click');
    setMenu(!menuOpen());
  });
  // escolher um item fecha o menu (o clique do próprio botão roda antes, no alvo)
  menu.addEventListener('click', () => setMenu(false));
  // tocar fora fecha
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!menuOpen()) return;
      const t = e.target as Node;
      if (!menu.contains(t) && !btn.contains(t)) setMenu(false);
    },
    true,
  );
}

/** Bolinha no ☰ quando há algo para ver lá dentro (pontos de atributo livres). */
export function updateHudMenu(alert: boolean) {
  byId('btn-menu').classList.toggle('alert', alert);
}
