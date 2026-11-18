// Camada de plataforma: tudo o que muda entre o jogo no navegador (web/PWA) e o app das lojas (Capacitor).
// O resto do código usa só estas funções. Cada arquivo tem a implementação web e a do app, escolhida por `isNative`.
// Este arquivo não importa plugins do Capacitor: ele é usado também pelos scripts de teste (Node), via core/i18n.
//
// Mapa:
//   index.ts      isNative, restartApp, registerServiceWorker
//   native.ts     ajustes feitos uma vez ao abrir o app (barra de status)
//   storage.ts    onde fica o save dos personagens (IndexedDB na web)
//   prefs.ts      preferências pequenas do aparelho (localStorage na web)
//   lifecycle.ts  app foi para o segundo plano / voltou
//   backButton.ts botão ou gesto de voltar (usa backGuard.ts na web)
//   input.ts      isTouch
//   haptics.ts    vibração leve (nada na web)
//   purchases.ts  compras dentro do app (interface vazia; não há compras)

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

/** true dentro do app das lojas (Capacitor); false no navegador e nos scripts de teste (Node). */
export const isNative: boolean = (() => {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
})();

/** Recomeça o jogo do zero (volta à tela inicial com HUD, áudio e timers limpos). */
export function restartApp() {
  window.location.reload();
}

/**
 * PWA: registra o service worker (só web e só em produção; caminho relativo por causa do subpath do GitHub Pages).
 * No app nativo os arquivos já estão no pacote e o WebView do iOS não roda service worker sem configuração especial.
 */
export function registerServiceWorker() {
  if (isNative || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
