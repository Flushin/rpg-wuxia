// Web/PWA: avisa quando sai um deploy novo com o jogo aberto (o navegador não recarrega sozinho).
// Consulta version.json (gerado no build, ver vite.config.ts) ao voltar para a aba e a cada 5 min;
// se o build mudou, mostra um aviso com botão "Atualizar". No app (Capacitor) a atualização vem pela loja.
import { isNative } from '.';
import { L } from '../core/i18n';

const EVERY_MS = 5 * 60 * 1000;
let shown = false;

async function check() {
  if (shown || document.visibilityState !== 'visible') return;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (build && build !== __BUILD__) showBanner();
  } catch {
    // sem internet: tenta de novo depois
  }
}

function showBanner() {
  shown = true;
  const el = document.createElement('div');
  el.className = 'update-banner';
  el.innerHTML = `<span>${L('Nova versão disponível.', 'New version available.')}</span>
    <button class="primary" data-act="reload">${L('Atualizar', 'Update')}</button>
    <button data-act="close" aria-label="${L('Fechar', 'Close')}">✕</button>`;
  el.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset.act;
    // o jogo salva no pagehide (platform/lifecycle.ts), então recarregar não perde progresso
    if (act === 'reload') window.location.reload();
    else if (act === 'close') el.remove();
  });
  document.body.appendChild(el);
}

export function watchForUpdates() {
  if (isNative || !import.meta.env.PROD || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => void check());
  setInterval(() => void check(), EVERY_MS);
}
