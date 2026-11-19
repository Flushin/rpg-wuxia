import { L } from '../core/i18n';
import { initials, skillScale, SKILL_MAX_LEVEL } from '../core/skills';
import { skillIconHtml } from './icons';
import type { World } from '../core/world';
import { closeX } from './labels';
import { renderPanel } from './panelRender';
import { byId } from './dom';
import { isTouch } from '../platform/input';

// Painel de skills (tecla K): ensina o que cada skill faz e como ela evolui.
export class SkillsPanel {
  private sig = '';
  constructor(
    private world: World,
    private onClose: () => void,
  ) {
    const el = byId('skills-panel');
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el || t.closest('[data-close]')) this.onClose();
    });
  }

  get open() {
    return !byId('skills-panel').classList.contains('hidden');
  }
  set(open: boolean) {
    byId('skills-panel').classList.toggle('hidden', !open);
    this.sig = '';
  }

  update() {
    if (!this.open) return;
    const w = this.world;
    const sig = JSON.stringify([w.player.level, w.classSkills().map((d) => [w.skillLevel(d), w.skills[d.id]?.xp])]);
    if (sig === this.sig) return;
    this.sig = sig;
    const rows = w
      .classSkills()
      .map((d, i) => {
        const unlocked = w.isUnlocked(d),
          lvl = w.skillLevel(d),
          need = w.skillXpNeed(d),
          st = w.skills[d.id];
        const key =
          d.type === 'active'
            ? isTouch
              ? ''
              : ` <small>· ${L('tecla', 'key')} ${i + 1}</small>`
            : ` <span class="badge passive">${L('Passiva', 'Passive')}</span>`;
        const stats =
          d.type === 'active' ? `<small>Mana ${d.mana} · ${L('Recarga', 'Cooldown')} ${d.cooldown}s</small>` : '';
        let prog: string;
        if (!unlocked)
          prog = `<small>${L(`Desbloqueia no nível ${d.unlock} do personagem`, `Unlocks at character level ${d.unlock}`)}</small>`;
        else if (d.type === 'passive')
          prog = `<small>${L(`Nível ${lvl}/${SKILL_MAX_LEVEL} (sobe com o seu nível) · efeito +${Math.round((skillScale(lvl) - 1) * 100)}%`, `Level ${lvl}/${SKILL_MAX_LEVEL} (grows with your level) · effect +${Math.round((skillScale(lvl) - 1) * 100)}%`)}</small>`;
        else
          prog =
            `<small>${L('Nível', 'Level')} ${lvl}/${SKILL_MAX_LEVEL} · ${L('efeito', 'effect')} +${Math.round((skillScale(lvl) - 1) * 100)}% · ${need === null ? L('nível máximo', 'max level') : `XP ${st.xp} / ${need} ${L('(sobe com o uso)', '(grows with use)')}`}</small>` +
            (need === null ? '' : `<div class="sk-bar"><i style="width:${(st.xp / need) * 100}%"></i></div>`);
        return `<div class="sk-row ${unlocked ? '' : 'locked'}" style="--c:${d.color}"><div class="ic">${skillIconHtml(d.id, initials(d.name))}</div>
        <div><b>${d.name}</b>${key}<div class="d">${d.description}</div>${stats}${prog}</div></div>`;
      })
      .join('');
    renderPanel(
      byId('skills-panel'),
      `<div class="card">${closeX('data-close="1"')}<h2>Skills</h2>
      <small class="muted">${L('Skills ativas sobem de nível quando usadas. Passivas sobem com o nível do personagem. Cada nível dá +8% de efeito.', 'Active skills level up when used. Passives grow with your character level. Each level gives +8% effect.')}</small>${rows}
      <button class="primary" data-close="1">${L('Fechar', 'Close')}</button></div>`,
    );
  }
}
