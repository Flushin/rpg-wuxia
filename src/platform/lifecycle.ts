// App foi para o segundo plano / voltou. Web: visibilitychange + pagehide.
// Nativo (D2): App.pause/resume do Capacitor (mais confiável que pagehide no iOS).

/** Chama `fn` quando o jogo sai da tela (troca de app, tela apagada, aba fechada). Devolve a função que desliga. */
export function onPause(fn: () => void): () => void {
  const vis = () => {
    if (document.visibilityState === 'hidden') fn();
  };
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('pagehide', fn);
  return () => {
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('pagehide', fn);
  };
}

/** Chama `fn` quando o jogo volta à tela. Devolve a função que desliga. */
export function onResume(fn: () => void): () => void {
  const vis = () => {
    if (document.visibilityState === 'visible') fn();
  };
  document.addEventListener('visibilitychange', vis);
  return () => document.removeEventListener('visibilitychange', vis);
}
