// Menu do Portal das Masmorras (saída oeste da vila): abre ao pisar no portal (World.dungeonMenu) e fecha ao se
// afastar. Lista as masmorras (src/core/dungeons.ts) com nível, custo de entrada e o botão Entrar.
import { L, tn } from '../core/i18n';
import { DUNGEONS, DUNGEON_EQUIP_DROP_MUL } from '../core/dungeons';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { actionErrorText } from './actionError';
import { renderPanel } from './panelRender';
import { byId, escapeHtml } from './dom';

export class DungeonWindow {
  private sig = '';
  constructor(
    private world: World,
    private toast: (m: string, c?: string) => void,
  ) {
    byId('dungeon-panel').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-a]') as HTMLButtonElement | null;
      if (!t || t.disabled) return;
      if (t.dataset.a === 'close') {
        audio.ui('ui_close');
        this.world.dungeonMenu = false;
      } else if (t.dataset.a === 'enter') {
        const err = this.world.enterDungeon(t.dataset.v ?? '', t.dataset.team === '1');
        if (err) this.toast(actionErrorText(err), '#ff8a80');
        else audio.ui('ui_click');
      }
    });
  }

  update() {
    const w = this.world,
      el = byId('dungeon-panel');
    if (!w.dungeonMenu) {
      if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        this.sig = '';
      }
      return;
    }
    const sig = `${w.gold}|${w.player.level}`;
    if (sig === this.sig && !el.classList.contains('hidden')) return;
    if (el.classList.contains('hidden')) audio.ui('ui_open');
    this.sig = sig;
    el.classList.remove('hidden');
    const bonus = Math.round((DUNGEON_EQUIP_DROP_MUL - 1) * 100);
    const rows = DUNGEONS.map((d) => {
      const name = w.maps[d.map]?.name ?? tn(d.map),
        lowLevel = w.player.level < d.minLevel,
        noGold = w.gold < d.cost;
      const why = lowLevel
        ? L(`Só a partir do nível ${d.minLevel}`, `Requires level ${d.minLevel}`)
        : noGold
          ? L('Ouro insuficiente', 'Not enough gold')
          : '';
      return `<div class="dg-row${lowLevel ? ' locked' : ''}">
        <div class="dg-name"><b>${escapeHtml(name)}</b> <small class="tag">${L(`Nv ${d.levels[0]}–${d.levels[1]}`, `Lv ${d.levels[0]}–${d.levels[1]}`)}</small></div>
        <p class="lore">${escapeHtml(L(d.desc.pt, d.desc.en))}</p>
        <div class="dg-info">${L(`Entrada: nível ${d.minLevel}+ · ${d.cost} ouro`, `Entry: level ${d.minLevel}+ · ${d.cost} gold`)}</div>
        <div class="dg-modes">
          <button class="primary" data-a="enter" data-v="${d.id}" ${why ? 'disabled' : ''}>${L(`Sozinho (${d.cost} ouro)`, `Solo (${d.cost} gold)`)}</button>
          <button class="primary" data-a="enter" data-team="1" data-v="${d.id}" ${why ? 'disabled' : ''}>${L(`Equipe (bots) (${d.cost} ouro)`, `Team (bots) (${d.cost} gold)`)}</button>
        </div>
        ${why ? `<small class="muted">${why}</small>` : ''}
      </div>`;
    }).join('');
    renderPanel(
      el,
      `<div class="card npc-card"><div class="npc-top"><div class="npc-head"><h2>${escapeHtml(tn('Portal das Masmorras'))}</h2><span class="gold">${w.gold} ${L('ouro', 'gold')}</span><button class="x" data-a="close" aria-label="${L('Fechar', 'Close')}">✕</button></div></div>
      <div class="npc-cols"><div class="npc-list">${rows}</div></div>
      <div class="npc-foot"><small class="muted">${L(
        `Nas masmorras os monstros não renascem e têm +${bonus}% de chance de equipamento. O Auto não funciona lá dentro. Morrer ou sair encerra a corrida. Equipe: você entra com 3 bots de outras seitas; os monstros têm mais vida e a recompensa é a mesma.`,
        `In dungeons monsters don't respawn and have +${bonus}% equipment drop chance. Auto doesn't work inside. Dying or leaving ends the run. Team: you enter with 3 bots from other sects; monsters have more HP and the rewards are the same.`,
      )}</small></div></div>`,
    );
  }
}
