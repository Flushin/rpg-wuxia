// Altura real da tela. No iPhone com o jogo instalado na tela inicial (barra de status transparente),
// o iOS informa a janela com a altura da barra de status a menos: tudo que usa 100% / inset: 0 / innerHeight
// terminava antes do fim da tela e sobrava uma faixa preta embaixo. Aqui a altura certa vai para --app-h,
// e --fix-b (usado no bottom das telas fixas) estica cada uma até o fim real da tela.
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches;

// iOS 26.1+: o app instalado nem desenha a faixa abaixo de innerHeight (fica preta, bug do WebKit).
// Esticar até a tela inteira só escondia o rodapé do HUD (Atacar cortado) lá dentro; então fica na
// altura informada e sem a margem do home (que já está dentro da faixa preta). Medido no iPhone 16, 26.1.
// O Safari 26 congela o "OS 18_6" no UA; a versão real vem em "Version/26.x" (quando há). Usa a maior.
const versao = (re: RegExp) => {
  const m = re.exec(navigator.userAgent);
  return m ? +m[1] * 100 + +m[2] : 0;
};
const iosCortaRodape = isIPhone && Math.max(versao(/OS (\d+)_(\d+)/), versao(/Version\/(\d+)\.(\d+)/)) >= 2601;

export function appHeight(): number {
  const h = window.innerHeight;
  if (!isIPhone || !standalone() || iosCortaRodape) return h;
  // no iPhone o app instalado sempre ocupa a tela inteira; screen.* vem sempre "em pé"
  const a = screen.width,
    b = screen.height,
    full = innerWidth > h ? Math.min(a, b) : Math.max(a, b);
  return Math.max(h, full);
}

function apply() {
  document.documentElement.classList.toggle('ios-corta-rodape', iosCortaRodape && standalone());
  document.documentElement.style.setProperty('--app-h', `${appHeight()}px`);
}

export function initViewport() {
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
    'padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);box-sizing:content-box';
  document.body.append(box, probe);
  const show = () => {
    const cs = getComputedStyle(probe);
    const vv = window.visualViewport;
    box.textContent = [
      navigator.userAgent.replace(/^.*?\(/, '('),
      `UA iPhone: ${isIPhone}  standalone: ${standalone()}  corta: ${iosCortaRodape}`,
      `innerW x innerH: ${innerWidth} x ${innerHeight}`,
      `screen: ${screen.width} x ${screen.height}`,
      `visualViewport: ${vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} off ${Math.round(vv.offsetTop)}` : '-'}`,
      `html clientH: ${document.documentElement.clientHeight}`,
      `100lvh: ${probe.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)}`,
      `safe top/bottom: ${cs.paddingTop} / ${cs.paddingBottom}`,
      `--app-h: ${document.documentElement.style.getPropertyValue('--app-h')}`,
      `#game h: ${document.getElementById('game')?.getBoundingClientRect().height ?? '-'}`,
      `dpr: ${devicePixelRatio}`,
    ].join('\n');
  };
  show();
  window.addEventListener('resize', () => setTimeout(show, 200));
  setTimeout(show, 1000);
}
