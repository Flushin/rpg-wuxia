// Idioma no jogo: detectar ao abrir (preferência salva ou idioma do aparelho) e trocar pelos botões PT | EN.
// O core só recebe o idioma pronto (initLang em src/boot.ts); este arquivo é o lado do navegador.
import { LANG, type Lang } from '../core/i18n';
import { PREF, getPref, setPref } from '../platform/prefs';
import { restartApp } from '../platform';

/** Preferência salva; senão, o idioma do aparelho (português ou inglês). */
export function detectLang(): Lang {
  const s = getPref(PREF.LANG);
  if (s === 'pt' || s === 'en') return s;
  const nav = typeof navigator === 'undefined' ? '' : navigator.language || '';
  return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** Salva o idioma e recomeça o jogo (o jogo já salva ao sair da tela). */
export function setLang(lang: Lang) {
  if (lang === LANG) return;
  setPref(PREF.LANG, lang);
  restartApp();
}

/** Botões PT | EN para telas e painéis. Use com bindLangButtons. */
export const langButtons = () =>
  `<div class="lang-sw">${(['pt', 'en'] as Lang[]).map((l) => `<button data-lang="${l}" class="${l === LANG ? 'primary' : ''}">${l.toUpperCase()}</button>`).join('')}</div>`;
export function bindLangButtons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      setLang(b.dataset.lang as Lang);
    };
  });
}
