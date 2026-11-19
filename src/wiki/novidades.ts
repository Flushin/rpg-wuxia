// Página "Novidades" da wiki: histórico completo de src/data/novidades.json (o mesmo da janela do jogo).
import { NOVIDADES, dataNovidade } from '../core/novidades';
import { esc } from './data';

export function novidadesPage(): string {
  const link = (w?: string) => (w === undefined ? '' : ` <a href="#/${esc(w)}">ver ›</a>`);
  return `<h1>Novidades</h1>
    <p class="intro">O que chegou de novo em cada versão do jogo. Correções de bugs e ajustes de mecânica não entram aqui.</p>
    ${NOVIDADES.versoes
      .map(
        (
          v,
        ) => `<section class="panel"><h2>Édito da Seita · v${esc(v.versao)} <small class="muted">${dataNovidade(v.data)}</small></h2>
      <ul>${v.itens.map((n) => `<li>${esc(n.texto)}${link(n.wiki)}</li>`).join('')}</ul></section>`,
      )
      .join('')}`;
}
