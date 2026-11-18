// Botão ou gesto de voltar. O primeiro "voltar" chama `fn` (avisar, salvar); outro logo em seguida fecha o jogo.
// - Web/PWA: proteção pelo histórico do navegador (backGuard.ts).
// - App Android (Capacitor): evento backButton do App; o segundo toque dentro de EXIT_WINDOW_MS chama exitApp.
//   A D3 troca o primeiro toque por "fechar a janela aberta" e, no mapa, perguntar se quer sair.
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { armBackGuard } from './backGuard';
import { isNative } from './index';

const EXIT_WINDOW_MS = 2500;

function nativeBackButton(fn: () => void): () => void {
  let lastBack = 0;
  let handle: PluginListenerHandle | null = null;
  let off = false;
  void App.addListener('backButton', () => {
    const now = Date.now();
    if (now - lastBack < EXIT_WINDOW_MS) {
      void App.exitApp();
      return;
    }
    lastBack = now;
    fn();
  }).then((h) => {
    if (off) void h.remove();
    else handle = h;
  });
  return () => {
    off = true;
    void handle?.remove();
  };
}

/** Liga o tratamento do voltar. Devolve a função que desliga. */
export function onBackButton(fn: () => void): () => void {
  return isNative ? nativeBackButton(fn) : armBackGuard(fn);
}
