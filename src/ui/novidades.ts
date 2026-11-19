// Janela de novidades ("Édito da Seita"). Abre sozinha uma vez, na tela inicial, quando o jogo foi atualizado para
// uma versão com novidades e o aparelho já tem personagem; quem ainda não tem personagem só vê o ponto aceso no
// botão "Novidades" (tela inicial e ⚙). Os textos vêm de src/core/novidades.ts (traduzidos por en.json "novidades").
import { L, LANG, localize } from '../core/i18n';
import { NOVIDADES, dataNovidade, novidadesDa, type NovidadesData, type VersaoNovidades } from '../core/novidades';
import { PREF, getPref, setPref } from '../platform/prefs';
import { audio } from '../render/audio';
import { closeX } from './labels';
import { escapeHtml } from './dom';
import { openWiki } from './privacy';

const DATA: NovidadesData = localize('novidades', structuredClone(NOVIDADES));
const ATUAL = novidadesDa(__APP_VERSION__, DATA);

/** true = esta versão tem novidades que o jogador ainda não abriu. */
export const novidadesPendentes = () => !!ATUAL && getPref(PREF.NEWS_SEEN) !== __APP_VERSION__;

/** Acende/apaga o ponto dos botões de Novidades que estiverem na tela. */
export function atualizarPontoNovidades() {
  const on = novidadesPendentes();
  document.querySelectorAll('[data-news-dot]').forEach((el) => el.classList.toggle('hidden', !on));
}

const titulo = (v: VersaoNovidades) => L(`Édito da Seita · v${v.versao}`, `Sect Edict · v${v.versao}`);

function lista(v: VersaoNovidades) {
  return `<ul class="news-list">${v.itens
    .map(
      (n) =>
        `<li>${escapeHtml(n.texto)}${n.wiki !== undefined ? ` <button class="link" data-wiki="${escapeHtml(n.wiki)}">${L('ver na wiki', 'see wiki')} ›</button>` : ''}</li>`,
    )
    .join('')}</ul>`;
}

export class NewsPanel {
  private el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'news-panel';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.onclick = (e) => {
      const t = e.target as HTMLElement;
      const w = t.closest<HTMLElement>('[data-wiki]');
      if (w) openWiki(w.dataset.wiki ?? '');
      else if (t.closest('[data-act="close"]') || t === this.el) this.close();
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    audio.ui('ui_open');
    const [nova, ...antigas] = DATA.versoes;
    const lang = LANG === 'en' ? 'en' : 'pt';
    const data = (v: VersaoNovidades) => `<small class="muted">${dataNovidade(v.data, lang)}</small>`;
    this.el.innerHTML = `<div class="card">${closeX('data-act="close"')}${
      nova
        ? `<h2>${titulo(nova)}</h2>${data(nova)}
      <p>${L('Novidades desta versão do Mistpeak:', 'New in this version of Mistpeak:')}</p>${lista(nova)}`
        : `<h2>${L('Novidades', "What's new")}</h2>`
    }
      ${antigas
        .map((v) => `<details class="news-old"><summary>${titulo(v)} ${data(v)}</summary>${lista(v)}</details>`)
        .join('')}
      <button data-wiki="novidades">📖 ${L('Todas as novidades na wiki', 'All news on the wiki')}${LANG === 'en' ? ' <small class="muted">(in Portuguese)</small>' : ''}</button>
      <button class="primary" data-act="close">${L('Fechar', 'Close')}</button></div>`;
    this.el.classList.remove('hidden');
    this.el.scrollTop = 0;
    if (ATUAL) setPref(PREF.NEWS_SEEN, __APP_VERSION__);
    atualizarPontoNovidades();
  }

  close() {
    if (!this.isOpen) return;
    this.el.classList.add('hidden');
    audio.ui('ui_close');
  }
}

/** Uma janela só para o jogo todo (tela inicial e ⚙ usam a mesma). */
let instance: NewsPanel | null = null;
export const novidades = () => (instance ??= new NewsPanel());

/** Botão com o ponto de "não lido" (usado na tela inicial e em ⚙). */
export const pontoNovidades = () => `<span class="news-dot hidden" data-news-dot></span>`;
