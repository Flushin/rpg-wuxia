// Tamanho da interface (⚙): Pequena / Normal / Grande / Automático, salvo no aparelho.
// O HUD inteiro (#hud) é desenhado numa "tela virtual" menor e ampliado com transform: scale(--ui),
// então tudo cresce na mesma proporção e as regras de layout continuam valendo.
// Coordenadas de getBoundingClientRect() são da tela real: use uiRect()/toUi() antes de gravar em style.
import { PREF, getPref, setPref } from '../platform/prefs';
export type UiSize = 'auto' | 'p' | 'm' | 'g';
const FIXED: Record<Exclude<UiSize, 'auto'>, number> = { p: 1, m: 1.15, g: 1.3 };

function load(): UiSize {
  const v = getPref(PREF.UI_SIZE);
  if (v === 'auto' || v === 'p' || v === 'm' || v === 'g') return v;
  return 'auto';
}

let mode: UiSize = load();

/** Área onde o HUD fica (tela menos barra de status, notch e barra do home), em px da tela real. */
let probe: HTMLElement | null = null;
function safeArea() {
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'safe-probe';
    document.body.appendChild(probe);
  }
  const r = probe.getBoundingClientRect();
  return r.width && r.height
    ? { x: r.left, y: r.top, w: r.width, h: r.height }
    : { x: 0, y: 0, w: innerWidth, h: innerHeight };
}
let scale = 1;

/** Automático: só no toque e com o aparelho deitado (em pé e no PC continua 100%). */
export function autoScale(): number {
  if (!matchMedia('(pointer:coarse)').matches) return 1;
  const { w, h } = safeArea();
  if (w <= h) return 1;
  if (h < 360) return 1.15; // Galaxy Z Fold fechado deitado (~920×316): pouca altura, cresce menos
  if (h < 600) return 1.2; // celulares grandes deitados (iPhone Pro Max ~932×430)
  return 1; // Fold aberto, tablets
}

/** Maior escala em que o HUD ainda cabe sem sobrepor (conferido com tools/layout-check.mjs):
 *  deitado, a tela virtual precisa de pelo menos MIN_H de altura; em pé, MIN_W de largura. */
const MIN_H = 270,
  MIN_W = 360;
export function maxScale(): number {
  const { w, h } = safeArea();
  return Math.max(1, w > h ? h / MIN_H : w / MIN_W);
}

function apply() {
  const s = Math.round(Math.min(mode === 'auto' ? autoScale() : FIXED[mode], maxScale()) * 100) / 100;
  const changed = s !== scale;
  scale = s;
  document.documentElement.style.setProperty('--ui', String(s));
  if (changed) window.dispatchEvent(new Event('uiscale'));
}

export const uiSize = () => mode;
export const uiScale = () => scale;
export function setUiSize(m: UiSize) {
  mode = m;
  setPref(PREF.UI_SIZE, m);
  apply();
}
/** px da tela real → px do HUD */
export const toUi = (px: number) => px / scale;
/** retângulo de um elemento em px do HUD (a origem é o canto do #hud, já dentro da área segura) */
export function uiRect(el: Element) {
  const r = el.getBoundingClientRect(),
    a = safeArea(),
    s = scale;
  return {
    left: (r.left - a.x) / s,
    top: (r.top - a.y) / s,
    right: (r.right - a.x) / s,
    bottom: (r.bottom - a.y) / s,
    width: r.width / s,
    height: r.height / s,
  };
}
/** largura/altura da tela em px do HUD */
export const uiW = () => safeArea().w / scale;
export const uiH = () => safeArea().h / scale;

export function initUiScale() {
  apply();
  const re = () => apply();
  window.addEventListener('resize', re);
  window.addEventListener('orientationchange', () => setTimeout(re, 200));
}
