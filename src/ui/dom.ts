// Helpers de DOM usados por todas as janelas da interface.

/** Elemento pelo id. O HTML é fixo (index.html), então o id sempre existe. */
export const byId = (id: string) => document.getElementById(id) as HTMLElement;

/** Escapa texto para colocar dentro de innerHTML (inclusive em atributos entre aspas). */
export const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Escritas no HUD a cada quadro: só mexem no DOM quando o valor muda. Trocar o textContent (mesmo pelo mesmo
// texto) recria o nó de texto e obriga o navegador a refazer estilo e layout da interface — no iPhone isso pesa.
const lastStyle = new WeakMap<HTMLElement, Record<string, string>>();

/** textContent só quando mudou. */
export function setText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

/** Propriedade de estilo (style.<prop>) só quando mudou. */
export function setStyle(
  el: HTMLElement,
  prop: 'width' | 'height' | 'top' | 'right' | 'left' | 'background',
  value: string,
) {
  let s = lastStyle.get(el);
  if (!s) lastStyle.set(el, (s = {}));
  if (s[prop] === value) return;
  s[prop] = value;
  el.style[prop] = value;
}

// Tamanho da janela guardado: ler innerWidth/innerHeight a cada quadro pode forçar o navegador a refazer o layout.
let viewport = `${innerWidth}x${innerHeight}`;
const onViewport = () => {
  viewport = `${innerWidth}x${innerHeight}`;
};
addEventListener('resize', onViewport);
addEventListener('orientationchange', onViewport);
/** "LxA" da janela (atualizado no resize), para assinaturas de "precisa reposicionar?". */
export const viewportKey = () => viewport;
