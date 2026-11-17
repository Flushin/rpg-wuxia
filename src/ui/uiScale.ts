// Tamanho da interface (⚙): Pequena / Normal / Grande / Automático, salvo no aparelho.
// O HUD inteiro (#hud) é desenhado numa "tela virtual" menor e ampliado com transform: scale(--ui),
// então tudo cresce na mesma proporção e as regras de layout continuam valendo.
// Coordenadas de getBoundingClientRect() são da tela real: use uiRect()/toUi() antes de gravar em style.
export type UiSize = 'auto' | 'p' | 'm' | 'g';
const KEY = 'rpg-ui-size';
const FIXED: Record<Exclude<UiSize, 'auto'>, number> = { p: 1, m: 1.15, g: 1.3 };

function load(): UiSize {
  try { const v = localStorage.getItem(KEY); if (v === 'auto' || v === 'p' || v === 'm' || v === 'g') return v; } catch { /* sem storage */ }
  return 'auto';
}

let mode: UiSize = load();
let scale = 1;

/** Automático: só no toque e com o aparelho deitado (em pé e no PC continua 100%). */
export function autoScale(): number {
  if (!matchMedia('(pointer:coarse)').matches) return 1;
  const w = innerWidth, h = innerHeight;
  if (w <= h) return 1;
  if (h < 360) return 1.15; // Galaxy Z Fold fechado deitado (~920×316): pouca altura, cresce menos
  if (h < 600) return 1.2;  // celulares grandes deitados (iPhone Pro Max ~932×430)
  return 1;                 // Fold aberto, tablets
}

/** Maior escala em que o HUD ainda cabe sem sobrepor (conferido com tools/layout-check.mjs):
 *  deitado, a tela virtual precisa de pelo menos MIN_H de altura; em pé, MIN_W de largura. */
const MIN_H = 270, MIN_W = 360;
export function maxScale(): number {
  const w = innerWidth, h = innerHeight;
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
  try { localStorage.setItem(KEY, m); } catch { /* sem storage */ }
  apply();
}
/** px da tela real → px do HUD */
export const toUi = (px: number) => px / scale;
/** retângulo de um elemento em px do HUD */
export function uiRect(el: Element) {
  const r = el.getBoundingClientRect(), s = scale;
  return { left: r.left / s, top: r.top / s, right: r.right / s, bottom: r.bottom / s, width: r.width / s, height: r.height / s };
}
/** largura/altura da tela em px do HUD */
export const uiW = () => innerWidth / scale;
export const uiH = () => innerHeight / scale;

export function initUiScale() {
  apply();
  const re = () => apply();
  window.addEventListener('resize', re);
  window.addEventListener('orientationchange', () => setTimeout(re, 200));
}
