import atlas from '../data/sprites/icones.json';
import type { Slot } from '../core/types';

// Ícones de itens e skills (marco 6): atlas public/sprites/icones.png gerado por tools/sprites/icons.py.
const A = atlas as { size: number; cols: number; rows: number; index: Record<string, number> };

/** Estilo CSS (posição no atlas) do ícone; '' se não existir. */
export function iconStyle(name: string): string {
  const k = A.index[name];
  if (k === undefined) return '';
  const c = k % A.cols,
    r = Math.floor(k / A.cols);
  return `background-position:${(c / (A.cols - 1)) * 100}% ${(r / (A.rows - 1)) * 100}%;background-size:${A.cols * 100}% ${A.rows * 100}%`;
}
export const hasIcon = (name: string) => A.index[name] !== undefined;
/** <i class="ico"> com o ícone (fallback: texto). */
export const iconHtml = (name: string, fallback = '') =>
  hasIcon(name) ? `<i class="ico" style="${iconStyle(name)}"></i>` : fallback;
export const skillIconHtml = (id: string, fallback = '') => iconHtml('skill_' + id, fallback);

/** Slot vazio: ícone da peça mais simples daquele slot (arma conforme a seita). */
export function slotIconHtml(slot: Slot, sect?: string): string {
  const id: Record<Slot, string> = {
    colar: 'colar_jade',
    tronco: 'tunica_algodao',
    arma: sect === 'pavilhao' ? 'leque_bambu' : 'espadas_ferro',
    cabeca: 'faixa_linho',
    calca: 'calca_algodao',
    bota: 'sandalia_palha',
  };
  return iconHtml(id[slot]);
}

/** Preenche elementos estáticos com data-icon="nome". */
export function fillIcons(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.classList.add('ico');
    el.setAttribute('style', iconStyle(el.dataset.icon!));
  });
}
