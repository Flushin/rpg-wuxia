// Girar o personagem 360° (janela Personagem e loja de trajes do Governador Bai) e vê-lo em tela cheia.
// Usa a tira de 8 direções em alta resolução (PORTRAIT_DIRS, tools/sprites portrait_dirs). Arrastar gira; os
// botões giram de 45° em 45°; ⛶ abre a tela cheia. A direção de cada retrato fica guardada aqui, então redesenhar a
// janela (renderPanel) não volta o personagem para a frente.
import { L } from '../core/i18n';
import { PORTRAIT_DIRS } from '../render/sprites';

const dirOf = new Map<string, number>();
const STEP_PX = 28; // arrastar esta distância gira uma direção

/** Quadro parado de uma direção (fundo CSS na tira de 8 direções). */
function frame(key: string, d: number, cls: string): string {
  const p = PORTRAIT_DIRS[key];
  return `<div class="${cls}" style="aspect-ratio:${p.w}/${p.h};background-image:url(${p.src});background-size:${p.dirs * 100}% 100%;background-position:${((d / (p.dirs - 1)) * 100).toFixed(3)}% 0"></div>`;
}

/**
 * Retrato que gira. `front` é o desenho mostrado de frente (ex.: o retrato animado da mochila); nas outras direções
 * aparece o quadro parado. Sem tira de direções para a chave, devolve só `front`.
 */
export function spinHtml(key: string, front: string, cls = ''): string {
  if (!PORTRAIT_DIRS[key]) return front;
  install();
  const d = dirOf.get(key) ?? 0;
  return `<div class="spin ${cls}" data-spin="${key}" data-d="${d}">
    <div class="spin-front">${front}</div>${frame(key, d, 'spin-dir')}
    <div class="spin-btns">
      <button type="button" data-spin-rot="-1" aria-label="${L('Girar para a esquerda', 'Rotate left')}">⟲</button>
      <button type="button" data-spin-full aria-label="${L('Tela cheia', 'Full screen')}">⛶</button>
      <button type="button" data-spin-rot="1" aria-label="${L('Girar para a direita', 'Rotate right')}">⟳</button>
    </div></div>`;
}

function setDir(el: HTMLElement, d: number) {
  const key = el.dataset.spin!,
    p = PORTRAIT_DIRS[key];
  d = ((d % p.dirs) + p.dirs) % p.dirs;
  dirOf.set(key, d);
  el.dataset.d = String(d);
  const img = el.querySelector<HTMLElement>(':scope > .spin-dir');
  if (img) img.style.backgroundPosition = `${((d / (p.dirs - 1)) * 100).toFixed(3)}% 0`;
}

function openFull(key: string) {
  closeFull();
  const p = PORTRAIT_DIRS[key];
  const d = dirOf.get(key) ?? 0;
  const box = document.createElement('div');
  box.id = 'spin-full';
  box.innerHTML = `<div class="spin spin-big" data-spin="${key}" data-d="${d}" style="--ar:${p.w}/${p.h}">${frame(key, d, 'spin-dir')}
    <div class="spin-btns">
      <button type="button" data-spin-rot="-1" aria-label="${L('Girar para a esquerda', 'Rotate left')}">⟲</button>
      <button type="button" data-spin-rot="1" aria-label="${L('Girar para a direita', 'Rotate right')}">⟳</button>
    </div></div>
    <small class="spin-hint">${L('Arraste para girar', 'Drag to rotate')}</small>
    <button type="button" class="x spin-close" data-spin-close aria-label="${L('Fechar', 'Close')}">✕</button>`;
  document.body.appendChild(box);
}

function closeFull() {
  const box = document.getElementById('spin-full');
  if (!box) return false;
  const big = box.querySelector<HTMLElement>('.spin');
  box.remove();
  // a janela de origem acompanha a direção escolhida em tela cheia
  if (big)
    document
      .querySelectorAll<HTMLElement>(`.spin[data-spin="${big.dataset.spin}"]`)
      .forEach((el) => setDir(el, dirOf.get(big.dataset.spin!) ?? 0));
  return true;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  let drag: { el: HTMLElement; x: number; d: number; moved: boolean } | null = null;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-spin-close]') || t.id === 'spin-full') {
        closeFull();
        e.stopPropagation();
        return;
      }
      const spin = t.closest<HTMLElement>('.spin');
      if (!spin) return;
      const rot = t.closest<HTMLElement>('[data-spin-rot]');
      if (rot) setDir(spin, Number(spin.dataset.d) + Number(rot.dataset.spinRot));
      else if (t.closest('[data-spin-full]')) openFull(spin.dataset.spin!);
      else return;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.spin');
    if (!el || (e.target as HTMLElement).closest('button')) return;
    drag = { el, x: e.clientX, d: Number(el.dataset.d), moved: false };
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const steps = Math.round((drag.x - e.clientX) / STEP_PX);
    if (steps) drag.moved = true;
    setDir(drag.el, drag.d + steps);
  });
  const end = () => (drag = null);
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // Esc fecha a tela cheia antes de qualquer outro atalho do jogo
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && closeFull()) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}
