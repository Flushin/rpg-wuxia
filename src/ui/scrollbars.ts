// Mostra a barra de rolagem só enquanto a área rola; some ~0,8 s depois de parar (ver base.css).
const HIDE_MS = 800;
const timers = new WeakMap<Element, number>();

export function initScrollbars() {
  document.addEventListener(
    'scroll',
    (e) => {
      const el = e.target instanceof Element ? e.target : document.scrollingElement;
      if (!el) return;
      el.classList.add('is-scrolling');
      clearTimeout(timers.get(el));
      timers.set(
        el,
        window.setTimeout(() => el.classList.remove('is-scrolling'), HIDE_MS),
      );
    },
    { capture: true, passive: true },
  );
}
