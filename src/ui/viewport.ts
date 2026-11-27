// Altura da janela em --app-h (o canvas e o HUD leem daqui; --fix-b estica as telas fixas até ela).
// Antes o iPhone instalado usava a barra de status transparente e esticávamos até a tela inteira, mas
// no iOS 26.1 o app instalado não desenha nada abaixo de innerHeight (faixa preta + HUD cortado).
// Com a barra de status opaca (index.html, "black") a janela começa abaixo do relógio e vai até o fim.
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches;

export function appHeight(): number {
  return window.innerHeight;
}

function apply() {
  document.documentElement.style.setProperty('--app-h', `${appHeight()}px`);
}

export function initViewport() {
  // html.iphone: o HUD usa parte das margens laterais do iPhone deitado (base.css)
  document.documentElement.classList.toggle('iphone', isIPhone);
  apply();
  // antes dos outros ouvintes de resize (main.ts chama isto primeiro), para o canvas e o HUD já lerem a altura nova
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 150));
}

// Diagnóstico da faixa preta no iPhone: abra o jogo com ?debug no endereço (ex.: .../?debug).
// Mostra as medidas reais e 3 marcas no rodapé: vermelha (bottom: 0), verde (fim de --app-h) e azul (fim de 100lvh).
// A que aparecer encostada no fim real da tela indica qual medida o iOS respeita.
// No app instalado (sem barra de endereço): toque 5 vezes na versão (canto da tela inicial) para ligar/desligar.
const DEBUG_KEY = 'vpDebug';
export function initViewportDebug() {
  let toques = 0,
    t0 = 0;
  document.addEventListener('pointerup', (e) => {
    if (!(e.target as Element | null)?.closest?.('#ver-label')) return;
    const agora = Date.now();
    if (agora - t0 > 3000) toques = 0;
    t0 = agora;
    if (++toques < 5) return;
    try {
      if (localStorage.getItem(DEBUG_KEY)) localStorage.removeItem(DEBUG_KEY);
      else localStorage.setItem(DEBUG_KEY, '1');
    } catch {
      /* sem armazenamento: só ?debug */
    }
    location.reload();
  });
  let ligado = /[?&]debug\b/.test(location.search);
  try {
    ligado ||= !!localStorage.getItem(DEBUG_KEY);
  } catch {
    /* ignora */
  }
  if (!ligado) return;
  const mark = (css: string, cor: string) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:0;right:0;height:6px;z-index:99999;pointer-events:none;background:${cor};${css}`;
    document.body.appendChild(d);
  };
  mark('bottom:0', 'red');
  mark('top:calc(var(--app-h, 100%) - 6px);left:33%', 'lime');
  mark('top:calc(100lvh - 6px);left:66%', 'blue');
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:99999;pointer-events:none;' +
    'background:rgba(0,0,0,.85);color:#0f0;font:12px/1.4 monospace;padding:8px;white-space:pre-wrap;max-width:90vw;border-radius:6px';
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;top:0;height:100lvh;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:content-box';
  document.body.append(box, probe);
  const show = () => {
    const cs = getComputedStyle(probe);
    const vv = window.visualViewport;
    box.textContent = [
      navigator.userAgent.replace(/^.*?\(/, '('),
      `UA iPhone: ${isIPhone}  standalone: ${standalone()}`,
      `innerW x innerH: ${innerWidth} x ${innerHeight}`,
      `screen: ${screen.width} x ${screen.height}`,
      `visualViewport: ${vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} off ${Math.round(vv.offsetTop)}` : '-'}`,
      `html clientH: ${document.documentElement.clientHeight}`,
      `100lvh: ${probe.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)}`,
      `safe top/bottom: ${cs.paddingTop} / ${cs.paddingBottom}  left/right: ${cs.paddingLeft} / ${cs.paddingRight}`,
      `HUD: ${document.getElementById('safe-probe')?.getBoundingClientRect().width ?? '-'} px de largura · escala ${getComputedStyle(document.documentElement).getPropertyValue('--ui') || '-'}`,
      `--app-h: ${document.documentElement.style.getPropertyValue('--app-h')}`,
      `#game h: ${document.getElementById('game')?.getBoundingClientRect().height ?? '-'}`,
      `dpr: ${devicePixelRatio}`,
    ].join('\n');
  };
  show();
  window.addEventListener('resize', () => setTimeout(show, 200));
  setTimeout(show, 1000);
}
