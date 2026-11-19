// Menu do portal do Trial (saída sul da vila): abre ao pisar no portal (World.trialMenu) e fecha ao se afastar.
// Lista os chefes do jogo (src/core/trial.ts) com o ponto fraco, as mecânicas e o progresso; o jogador escolhe o
// nível (só até o seguinte ao maior vencido daquele chefe) e entra pagando a entrada.
import { L } from '../core/i18n';
import { MONSTERS, type MonsterDef } from '../core/data';
import {
  TRIAL_BOSSES,
  TRIAL_MIN_LEVEL,
  TRIAL_TIERS,
  trialBossLevel,
  trialCost,
  trialDropPct,
  trialUnlocked,
  trialWeakness,
} from '../core/trial';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { actionErrorText } from './actionError';
import { renderPanel } from './panelRender';
import { byId, escapeHtml } from './dom';

const pct = (n: number) => n.toFixed(2).replace('.', L(',', '.'));

/** Mecânicas do chefe em poucas palavras (as mesmas do mundo/masmorra). */
export function trialMechanics(def: MonsterDef): string {
  const b = def.boss!,
    out = [L('golpes em círculo', 'circle strikes')];
  if (b.line) out.push(L('golpe em linha (leque ferido)', 'line strike (fan when wounded)'));
  if (b.summon) out.push(L(`invoca ${b.summon.count} ajudantes`, `summons ${b.summon.count} adds`));
  if (b.enrage) out.push(L('fúria ferido', 'enrages when wounded'));
  return out.join(' · ');
}

export class TrialWindow {
  private sig = '';
  /** nível escolhido em cada chefe (começa no maior liberado) */
  private pick: Record<string, number> = {};
  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
  ) {
    byId('trial-panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-a]') as HTMLButtonElement | null;
      if (!t || t.disabled) return;
      const id = t.dataset.v ?? '';
      if (t.dataset.a === 'close') {
        audio.ui('ui_close');
        this.world.trialMenu = false;
      } else if (t.dataset.a === 'tier') {
        audio.ui('ui_click');
        this.pick[id] = this.tierOf(id) + Number(t.dataset.d);
        this.sig = '';
      } else if (t.dataset.a === 'enter') {
        const err = this.world.enterTrial(id, this.tierOf(id));
        if (err) this.toast(actionErrorText(err), '#ff8a80');
        else audio.ui('ui_click');
      }
    });
  }

  private tierOf(bossId: string): number {
    const max = trialUnlocked(this.world.trialProgress, bossId);
    return Math.max(1, Math.min(max, this.pick[bossId] ?? max));
  }

  update() {
    const w = this.world,
      el = byId('trial-panel');
    if (!w.trialMenu) {
      if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        this.sig = '';
      }
      return;
    }
    const sig = `${w.gold}|${w.player.level}|${JSON.stringify(w.trialProgress)}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    if (el.classList.contains('hidden')) audio.ui('ui_open');
    this.sig = sig;
    el.classList.remove('hidden');
    const lowLevel = w.player.level < TRIAL_MIN_LEVEL;
    const rows = TRIAL_BOSSES.map((id) => {
      const def = MONSTERS[id],
        tier = this.tierOf(id),
        max = trialUnlocked(w.trialProgress, id),
        done = w.trialProgress[id] ?? 0,
        cost = trialCost(tier),
        weak = trialWeakness(def) === 'physical' ? L('físico', 'physical') : L('espiritual', 'spiritual');
      const why = lowLevel
        ? L(`Só a partir do nível ${TRIAL_MIN_LEVEL}`, `Requires level ${TRIAL_MIN_LEVEL}`)
        : w.gold < cost
          ? L('Ouro insuficiente', 'Not enough gold')
          : '';
      return `<div class="dg-row${lowLevel ? ' locked' : ''}">
        <div class="dg-name"><b>${escapeHtml(def.name)}</b> <small class="tag">${L(`Vencido: ${done}/${TRIAL_TIERS}`, `Cleared: ${done}/${TRIAL_TIERS}`)}</small></div>
        <div class="dg-info">${L(`Ponto fraco: dano ${weak}`, `Weak point: ${weak} damage`)} · ${escapeHtml(trialMechanics(def))}</div>
        <div class="tr-tier">
          <button data-a="tier" data-v="${id}" data-d="-1" ${tier <= 1 ? 'disabled' : ''} aria-label="${L('Nível anterior', 'Previous level')}">−</button>
          <span><b>${L(`Nível ${tier}`, `Level ${tier}`)}</b> · ${L(`chefe nv ${trialBossLevel(tier)}`, `boss lv ${trialBossLevel(tier)}`)} · ${L(`drop +${pct(trialDropPct(tier))}%`, `drop +${pct(trialDropPct(tier))}%`)}</span>
          <button data-a="tier" data-v="${id}" data-d="1" ${tier >= max ? 'disabled' : ''} aria-label="${L('Próximo nível', 'Next level')}">+</button>
        </div>
        <button class="primary" data-a="enter" data-v="${id}" ${why ? 'disabled' : ''}>${L(`Enfrentar (${cost} ouro)`, `Fight (${cost} gold)`)}</button>
        ${why ? `<small class="muted">${why}</small>` : ''}
      </div>`;
    }).join('');
    renderPanel(
      el,
      `<div class="card npc-card"><div class="npc-top"><div class="npc-head"><h2>Trial</h2><span class="gold">${w.gold} ${L('ouro', 'gold')}</span><button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div></div>
      <div class="npc-cols"><div class="npc-list">${rows}</div></div>
      <div class="npc-foot"><small class="muted">${L(
        `Escolha o chefe pelo ponto fraco da sua seita. Vencer um nível libera o seguinte daquele chefe. Cada nível: chefe +1 nível e +5% de chance de drop de equipamento e material. O Auto não funciona; morrer ou sair encerra a luta.`,
        `Pick the boss by your sect's weak point. Beating a level unlocks the next one for that boss. Each level: boss +1 level and +5% equipment and material drop chance. Auto doesn't work; dying or leaving ends the fight.`,
      )}</small></div></div>`,
    );
  }
}
