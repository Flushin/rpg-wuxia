// App foi para o segundo plano / voltou.
// - Web: visibilitychange + pagehide.
// - App (Capacitor): eventos pause/resume do App (mais confiáveis que pagehide no iOS).
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNative } from './index';

function nativeListener(event: 'pause' | 'resume', fn: () => void): () => void {
  let handle: PluginListenerHandle | null = null;
  let off = false;
  const listen = event === 'pause' ? App.addListener('pause', fn) : App.addListener('resume', fn);
  void listen.then((h) => {
    if (off) void h.remove();
    else handle = h;
  });
  return () => {
    off = true;
    void handle?.remove();
  };
}

/** Chama `fn` quando o jogo sai da tela (troca de app, tela apagada, aba fechada). Devolve a função que desliga. */
export function onPause(fn: () => void): () => void {
  if (isNative) return nativeListener('pause', fn);
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
  if (isNative) return nativeListener('resume', fn);
  const vis = () => {
    if (document.visibilityState === 'visible') fn();
  };
  document.addEventListener('visibilitychange', vis);
  return () => document.removeEventListener('visibilitychange', vis);
}
