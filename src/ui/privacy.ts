import { LANG } from '../core/i18n';

/** Abre a política de privacidade (página estática em public/) no idioma atual. */
export function openPrivacyPolicy() {
  window.open('./privacidade.html' + (LANG === 'en' ? '#en' : '#pt'), '_blank');
}
