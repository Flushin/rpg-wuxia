import { LANG } from '../core/i18n';
import { isNative } from '../platform';

// Endereço publicado (GitHub Pages). É o mesmo informado às lojas (docs/lojas.md).
const SITE = 'https://flushin.github.io/rpg-wuxia/';
const PUBLISHED_URL = SITE + 'privacidade.html';

/** Abre a política de privacidade (página estática em public/) no idioma atual. */
export function openPrivacyPolicy() {
  const hash = LANG === 'en' ? '#en' : '#pt';
  // No app, a página local abriria dentro do WebView no lugar do jogo; o endereço de fora o Capacitor
  // entrega ao navegador do celular, e o jogo continua aberto atrás.
  if (isNative) window.location.href = PUBLISHED_URL + hash;
  else window.open('./privacidade.html' + hash, '_blank');
}

/**
 * Abre a wiki (wiki/index.html, publicada junto com o jogo). Mesma regra do app: no Android vai para o navegador.
 * `page` = página sem o "#/" (ex.: "mecanicas/forja"); vazio = início.
 */
export function openWiki(page = '') {
  const path = 'wiki/' + (page ? '#/' + page : '');
  if (isNative) window.location.href = SITE + path;
  else window.open('./' + path, '_blank');
}
