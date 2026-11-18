// Tipo de entrada do aparelho. Tablets com teclado contam como toque (maxTouchPoints > 0).
export const isTouch: boolean =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
