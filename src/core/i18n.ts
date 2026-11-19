// Idioma do jogo (PT/EN). O core não lê o navegador: o idioma entra por initLang (roadmap M0, E1b), para o core rodar
// em Node (servidor e testes). No jogo, src/boot.ts detecta o idioma (preferência salva ou idioma do aparelho) e chama
// initLang antes de qualquer dado ser carregado. Sem initLang, vale o português (servidor e scripts de teste).
// Trocar de idioma no jogo (salvar a escolha e recarregar) fica em src/ui/lang.ts.
import en from '../data/en.json';

export type Lang = 'pt' | 'en';

export let LANG: Lang = 'pt';
let dataLocalized = false;

/** Define o idioma. Tem de vir antes de carregar os dados traduzidos (CLASSES, ITEMS...), que são traduzidos uma vez só. */
export function initLang(lang: Lang) {
  if (dataLocalized && lang !== LANG) throw new Error('initLang chamado depois de os dados já estarem traduzidos');
  LANG = lang;
}

/** Texto fixo da interface: L('Jogar', 'Play'). */
export const L = (pt: string, en: string) => (LANG === 'en' ? en : pt);

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
  dataLocalized = true;
  if (LANG === 'en') merge(data as Overlay, (en as Record<string, Overlay>)[section]);
  return data;
}

/** Nomes vindos dos mapas do Tiled (mapa, portais, NPCs): en.json "names" usa o texto em PT como chave. */
export const tn = (pt: string) => (LANG === 'en' ? ((en.names as Record<string, string>)[pt] ?? pt) : pt);
