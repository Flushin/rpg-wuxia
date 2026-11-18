import { L } from '../core/i18n';
import { NPC_TEXT } from '../core/data';
import type { World } from '../core/world';
import { uiRect, uiScale, uiW } from './uiScale';
import { byId, escapeHtml } from './dom';

/** Nome de exibição de um NPC pelo id ('anciao', 'mestre_lamina'...). */
export function npcName(id: string): string {
  if (id.startsWith('mestre_')) return NPC_TEXT.masters[id.slice(7)]?.name ?? id;
  return NPC_TEXT.npcs[id]?.name ?? id;
}

/** Texto das recompensas de uma missão. */
export function rewardText(r: { xp: number; gold: number; item?: 'arma' | 'tronco' }): string {
  const parts = [`${r.xp} XP`, `${r.gold} ${L('ouro', 'gold')}`];
  if (r.item === 'arma') parts.push(L('Arma Incomum nv 5 da sua seita', 'Uncommon Lv 5 weapon of your sect'));
  if (r.item === 'tronco') parts.push(L('Manto Incomum nv 5', 'Uncommon Lv 5 robe'));
  return parts.join(' · ');
}

// Rastreador da missão (marco 7): linha pequena no canto direito, logo abaixo dos botões do topo.
export class QuestTracker {
  private sig = '';
  update(w: World) {
    const el = byId('quest-tracker'),
      v = w.questView();
    const sig = `${w.quest.stage}|${w.quest.status}|${w.quest.progress}|${v.phase}|${innerWidth}x${innerHeight}|${uiScale()}`;
    if (sig !== this.sig) {
      this.sig = sig;
      if (!v.def) {
        el.classList.add('hidden');
        return;
      }
      let line = '';
      if (v.phase === 'locked')
        line = `<span class="muted">${L(`Próxima missão no nível ${v.def.minLevel}`, `Next quest at level ${v.def.minLevel}`)}</span>`;
      else if (v.phase === 'available')
        line = L(
          `Fale com <b>${escapeHtml(npcName(v.giver))}</b> <i class="qm">!</i>`,
          `Talk to <b>${escapeHtml(npcName(v.giver))}</b> <i class="qm">!</i>`,
        );
      else if (v.phase === 'ready')
        line = `✓ ${L(`Volte a <b>${escapeHtml(npcName(v.turnIn))}</b>`, `Return to <b>${escapeHtml(npcName(v.turnIn))}</b>`)} <i class="qm">?</i>`;
      else if (v.def.objective.type === 'talk') {
        const who = npcName(w.questTalkTarget());
        line = L(
          `Fale com <b>${escapeHtml(who)}</b> <i class="qm">?</i>`,
          `Talk to <b>${escapeHtml(who)}</b> <i class="qm">?</i>`,
        );
      } else line = v.count > 1 ? `${escapeHtml(v.def.goal)} <b>${v.progress}/${v.count}</b>` : escapeHtml(v.def.goal);
      el.innerHTML = `<div class="qt-name">${escapeHtml(v.def.name)}</div><div class="qt-line">${line}</div>`;
      el.classList.remove('hidden');
    }
    // logo abaixo do bloco do topo direito (que muda de altura conforme a tela)
    const r = uiRect(byId('top-right'));
    el.style.top = `${Math.round(r.bottom + 6)}px`;
    // celular deitado baixo (Fold fechado): se encostar num botão de skill do arco, desvia para a esquerda dele
    if (el.classList.contains('hidden')) return;
    el.style.right = '';
    const t = uiRect(el);
    let right = 0;
    for (const b of document.querySelectorAll('#hotbar .slot')) {
      const s = uiRect(b);
      if (s.left < t.right && s.right > t.left && s.top < t.bottom && s.bottom > t.top)
        right = Math.max(right, uiW() - s.left + 6);
    }
    if (right) el.style.right = `${Math.round(right)}px`;
  }
}
