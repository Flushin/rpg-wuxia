// Impede o zoom do navegador (pinça e toque duplo), principalmente no Safari do iPhone, que ignora
// user-scalable=no. O zoom do jogo (pinça no mapa) continua: ele lê os dedos direto no canvas.
// Se a página já estiver ampliada (algo escapou), libera o gesto e mostra um aviso para afastar os dedos.
import { L } from '../core/i18n';

const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;

export function initNoBrowserZoom() {
  const block = (e: Event) => { if (!zoomed()) e.preventDefault(); };
  // Safari: eventos próprios do gesto de pinça
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, block, { passive: false });
  // qualquer navegador: dois ou mais dedos movendo = pinça
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) block(e); }, { passive: false });
  // toque duplo: touch-action: manipulation nos botões (CSS) + dblclick cancelado
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // aviso quando a página ficou ampliada
  const vv = window.visualViewport;
  if (!vv) return;
  const note = document.createElement('div');
  note.id = 'zoom-note';
  note.className = 'hidden';
  note.textContent = L('Página ampliada — afaste dois dedos para voltar ao normal', 'Page zoomed in — pinch out to go back to normal');
  document.body.appendChild(note);
  const check = () => {
    const z = zoomed();
    note.classList.toggle('hidden', !z);
    if (z) {
      // acompanha a área visível para o aviso continuar na tela
      note.style.transform = `translate(${vv.offsetLeft}px,${vv.offsetTop}px) scale(${1 / vv.scale})`;
      note.style.width = `${vv.width * vv.scale}px`;
    }
  };
  vv.addEventListener('resize', check);
  vv.addEventListener('scroll', check);
}
