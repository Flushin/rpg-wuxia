// O que o botão/gesto de voltar faz dentro do jogo (ligado em gameScene com platform/backButton).
// 1) Fecha a janela de cima, da mais alta para a mais baixa: Sair do jogo? → créditos → report de bug →
//    ⚙ → resumo offline → dica → janelas do HUD (mapa, atributos, skills, mochila, auto, NPC).
// 2) Sem janela aberta: no app, pergunta "Sair do jogo?"; na web, só avisa (ver platform/backButton).
import { L } from '../core/i18n';
import type { Hud } from './hud';

// Janelas fora do HUD e como fechar cada uma: clique no fundo (como o jogador faz) ou no botão que a fecha.
const OVERLAYS: { id: string; close: string | null }[] = [
  { id: 'exit-panel', close: null },
  { id: 'credits-panel', close: null },
  { id: 'bug-panel', close: null },
  { id: 'settings-panel', close: null },
  { id: 'offline-panel', close: '.primary' },
  { id: 'tip-card', close: '#tip-ok' },
];

/** Fecha a janela de cima. true = fechou algo. */
export function closeTopWindow(hud: Hud): boolean {
  for (const o of OVERLAYS) {
    const el = document.getElementById(o.id);
    if (!el || el.classList.contains('hidden')) continue;
    const target = o.close ? el.querySelector<HTMLElement>(o.close) : el;
    target?.click();
    return true;
  }
  return hud.closeAll();
}

/** Janela "Sair do jogo?" (só no app). `onExit` salva e fecha o app. */
export function askExit(onExit: () => void) {
  let el = document.getElementById('exit-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'exit-panel';
    document.body.appendChild(el);
  }
  const panel = el;
  panel.innerHTML = `<div class="card"><h2>${L('Sair do jogo?', 'Exit the game?')}</h2>
    <p class="muted">${L('Seu progresso fica salvo.', 'Your progress is saved.')}</p>
    <div class="exit-btns"><button data-act="stay">${L('Continuar jogando', 'Keep playing')}</button>
    <button class="primary" data-act="exit">${L('Sair', 'Exit')}</button></div></div>`;
  panel.classList.remove('hidden');
  panel.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'exit') onExit();
    if (act || e.target === panel) panel.classList.add('hidden');
  };
}
