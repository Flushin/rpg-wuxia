// Novidades do jogo (src/data/novidades.json): só conteúdo novo; correções e ajustes de mecânica não entram.
// Uma fonte para três lugares: a janela "Édito da Seita" no jogo (src/ui/novidades.ts), a página Novidades da
// wiki (src/wiki/novidades.ts) e o texto "O que há de novo" da Play Store (npm run novidades:loja).
// Fluxo: cada PR com conteúdo novo acrescenta um item em "proxima"; ao subir a version do package.json, os itens
// viram uma entrada nova no topo de "versoes" (com a data) e "proxima" volta a ficar vazia.
import data from '../data/novidades.json';

export interface Novidade {
  texto: string;
  /** página da wiki, sem o "#/" (ex.: "seitas", "mecanicas/forja"); "" = início da wiki */
  wiki?: string;
}
export interface VersaoNovidades {
  versao: string;
  /** AAAA-MM-DD */
  data: string;
  itens: Novidade[];
}
export interface NovidadesData {
  proxima: Novidade[];
  versoes: VersaoNovidades[];
}

/** Dados em português (a mais nova primeiro). */
export const NOVIDADES = data as NovidadesData;

export const novidadesDa = (versao: string, d: NovidadesData = NOVIDADES) => d.versoes.find((v) => v.versao === versao);

/** Limite do campo "O que há de novo" da Play Store, por idioma. */
export const LOJA_LIMITE = 500;

/** Texto da Play Store: um item por linha, com marcador. */
export const textoLoja = (itens: string[]) => itens.map((t) => `• ${t}`).join('\n');

/** "2026-11-19" → "19/11/2026" (pt) ou "Nov 19, 2026" (en). */
export function dataNovidade(iso: string, lang: 'pt' | 'en' = 'pt'): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (lang === 'pt') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  const mes = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${mes} ${d}, ${y}`;
}
