// Resolução real da tela: o canvas é desenhado em (tamanho CSS × DPR) e mostrado no tamanho CSS.
// Sem isso o celular (devicePixelRatio 2–3) amplia o canvas e o jogo fica embaçado. Limitado a 2× por desempenho.
export const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

export function cssSize(): { w: number; h: number } {
  const el = document.getElementById('game');
  return {
    w: Math.max(1, el?.clientWidth || window.innerWidth),
    h: Math.max(1, el?.clientHeight || window.innerHeight),
  };
}
