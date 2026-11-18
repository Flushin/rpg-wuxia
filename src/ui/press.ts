// Botões de ação do celular (skills, Atacar, poções): disparam ao encostar o dedo.
// Além do pointerdown do próprio botão, um touchstart global confere a posição de cada dedo novo:
// em alguns aparelhos reais (ex.: Galaxy Z Fold fechado), com o outro dedo preso no joystick, o segundo
// toque não chega como pointerdown no botão e a skill não saía andando. O que disparar primeiro vale;
// o outro é ignorado (mesmo botão em menos de PRESS_DEDUPE_MS).
const PRESS_DEDUPE_MS = 250;
const handlers = new Map<HTMLElement, () => void>();
const lastFire = new WeakMap<HTMLElement, number>();
let installed = false;

function fire(el: HTMLElement) {
  const now = performance.now();
  if (now - (lastFire.get(el) ?? -Infinity) < PRESS_DEDUPE_MS) return;
  lastFire.set(el, now);
  handlers.get(el)?.();
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'touchstart',
    (e) => {
      for (const t of Array.from(e.changedTouches)) {
        const hit = document.elementFromPoint(t.clientX, t.clientY);
        if (!hit) continue;
        for (const el of handlers.keys())
          if (el.contains(hit)) {
            fire(el);
            break;
          }
      }
    },
    { capture: true, passive: true },
  );
}

/** Liga a ação do botão ao toque (e ao mouse, se `mouse`; senão o mouse fica com o click do próprio botão). */
export function onPress(el: HTMLElement, fn: () => void, mouse = true) {
  handlers.set(el, fn);
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && !mouse) return;
    fire(el);
  });
  install();
}
