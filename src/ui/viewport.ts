// Altura real da tela. No iPhone com o jogo instalado na tela inicial (barra de status transparente),
// o iOS informa a janela com a altura da barra de status a menos: tudo que usa 100% / inset: 0 / innerHeight
// terminava antes do fim da tela e sobrava uma faixa preta embaixo. Aqui a altura certa vai para --app-h,
// e --fix-b (usado no bottom das telas fixas) estica cada uma até o fim real da tela.
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches;

export function appHeight(): number {
  const h = window.innerHeight;
  if (!isIPhone || !standalone()) return h;
  // no iPhone o app instalado sempre ocupa a tela inteira; screen.* vem sempre "em pé"
  const a = screen.width,
    b = screen.height,
    full = innerWidth > h ? Math.min(a, b) : Math.max(a, b);
  return Math.max(h, full);
}

function apply() {
  document.documentElement.style.setProperty('--app-h', `${appHeight()}px`);
}

export function initViewport() {
  apply();
  // antes dos outros ouvintes de resize (main.ts chama isto primeiro), para o canvas e o HUD já lerem a altura nova
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 150));
}
