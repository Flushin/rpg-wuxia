// Botão ou gesto de voltar. Web/PWA: proteção pelo histórico (backGuard.ts): o primeiro "voltar" chama `fn`,
// o segundo (logo em seguida) fecha o app. Nativo (D2/D3): botão Voltar do Android pelo Capacitor.
import { armBackGuard } from './backGuard';

/** Liga o tratamento do voltar. Devolve a função que desliga. */
export function onBackButton(fn: () => void): () => void {
  return armBackGuard(fn);
}
