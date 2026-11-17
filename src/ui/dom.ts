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
