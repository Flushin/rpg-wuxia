// Proteção contra o gesto/botão de voltar fechar o jogo sem querer (PWA em tela cheia no Android).
//
// Como funciona: o jogo põe uma entrada extra no histórico do navegador. O primeiro "voltar" só tira essa
// entrada (o app continua aberto) e o jogo mostra um aviso. Se o jogador voltar de novo dentro de EXIT_WINDOW_MS,
// já não há entrada extra e o Android fecha o app normalmente. Passado esse tempo, a entrada é recolocada.
//
// O Chrome pula entradas de histórico criadas sem interação do usuário (proteção contra sites que prendem o
// botão de voltar). Como o jogador toca na tela o tempo todo (joystick), a entrada vale assim que ele tocar.

const EXIT_WINDOW_MS = 2500;
const GUARD_STATE = { mistpeakBackGuard: true };

const hasGuard = () => !!(history.state as Record<string, unknown> | null)?.mistpeakBackGuard;

/**
 * Liga a proteção. A cada "voltar", `closeSomething` tenta fechar uma janela do jogo: se fechou, a entrada extra
 * volta na hora (o próximo "voltar" é tratado do mesmo jeito). Se não havia janela, `onBack` é chamado (mostrar o
 * aviso, salvar o jogo) e começa a janela de saída.
 * Devolve a função que desliga (a entrada extra fica no histórico; ao religar ela é reaproveitada).
 */
export function armBackGuard(closeSomething: () => boolean, onBack: () => void): () => void {
  let timer = 0;
  const push = () => {
    if (!hasGuard()) history.pushState(GUARD_STATE, '');
  };
  const onPop = () => {
    // saiu da entrada extra: avisa e dá a janela para o jogador sair de verdade
    if (hasGuard()) return;
    if (closeSomething()) {
      push();
      return;
    }
    onBack();
    clearTimeout(timer);
    timer = window.setTimeout(push, EXIT_WINDOW_MS);
  };
  push();
  window.addEventListener('popstate', onPop);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('popstate', onPop);
  };
}
