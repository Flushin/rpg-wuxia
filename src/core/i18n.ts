// Idioma do jogo (PT/EN). Decidido uma vez ao carregar a página; trocar salva a escolha e recarrega.
import en from '../data/en.json';
import { PREF, getPref, setPref } from '../platform/prefs';
import { restartApp } from '../platform';

export type Lang = 'pt' | 'en';

function detect(): Lang {
  if (typeof window === 'undefined') return 'pt'; // scripts de teste (Node) rodam em PT
  if (/\/wiki(\/|$)/.test(location.pathname)) return 'pt'; // a wiki é só em português
  const s = getPref(PREF.LANG);
  if (s === 'pt' || s === 'en') return s;
  return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export const LANG: Lang = detect();

/** Texto fixo da interface: L('Jogar', 'Play'). */
export const L = (pt: string, en: string) => (LANG === 'en' ? en : pt);

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

type Overlay = { [k: string]: unknown };
function merge(target: Overlay, over: Overlay) {
  for (const [k, v] of Object.entries(over)) {
    const cur = target[k];
    if (v && typeof v === 'object' && cur && typeof cur === 'object') merge(cur as Overlay, v as Overlay);
    else if (k in target || !Array.isArray(target)) target[k] = v;
  }
}

/**
 * Aplica as traduções de en.json[section] sobre os dados carregados (só no inglês).
 * Os JSON de dados continuam em português; en.json espelha a mesma estrutura só com os textos.
 */
export function localize<T>(section: keyof typeof en, data: T): T {
  if (LANG === 'en') merge(data as Overlay, (en as Record<string, Overlay>)[section]);
  return data;
}

/** Nomes vindos dos mapas do Tiled (mapa, portais, NPCs): en.json "names" usa o texto em PT como chave. */
export const tn = (pt: string) => (LANG === 'en' ? ((en.names as Record<string, string>)[pt] ?? pt) : pt);
