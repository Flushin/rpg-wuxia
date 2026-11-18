// Botão ou gesto de voltar.
// `closeSomething()` é chamado primeiro: se fechou uma janela, o voltar termina aí (o jogo continua).
// Se não havia nada aberto, `onExitAttempt()` é chamado:
// - Web/PWA: o jogo mostra um aviso; um segundo "voltar" logo em seguida fecha o app (backGuard.ts, pelo histórico).
// - App Android (Capacitor): o jogo pergunta "Sair do jogo?" e, se o jogador confirmar, chama exitApp().
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { armBackGuard } from './backGuard';
import { isNative } from './index';

export interface BackHandlers {
  /** Fecha a janela de cima, se houver. true = fechou algo. */
  closeSomething(): boolean;
  /** Não havia janela aberta: o jogador quer sair. */
  onExitAttempt(): void;
}

function nativeBackButton(h: BackHandlers): () => void {
  let handle: PluginListenerHandle | null = null;
  let off = false;
  void App.addListener('backButton', () => {
    if (!h.closeSomething()) h.onExitAttempt();
  }).then((x) => {
    if (off) void x.remove();
    else handle = x;
  });
  return () => {
    off = true;
    void handle?.remove();
  };
}

/** Liga o tratamento do voltar. Devolve a função que desliga. */
export function onBackButton(h: BackHandlers): () => void {
  return isNative ? nativeBackButton(h) : armBackGuard(() => h.closeSomething(), h.onExitAttempt);
}

/** Fecha o app (só no nativo; na web não há como, e não faz nada). */
export function exitApp() {
  if (isNative) void App.exitApp();
}
