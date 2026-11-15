import { initials, skillScale } from '../core/skills';
import type { World } from '../core/world';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// Painel de skills (tecla K): ensina o que cada skill faz e como ela evolui.
export class SkillsPanel {
  private sig = '';
  constructor(private world: World, private onClose: () => void) {
    const el = $('skills-panel');
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el || t.closest('[data-close]')) this.onClose();
    });
  }

  get open() { return !$('skills-panel').classList.contains('hidden'); }
  set(open: boolean) { $('skills-panel').classList.toggle('hidden', !open); this.sig = ''; }

  update() {
    if (!this.open) return;
    const w = this.world;
    const sig = JSON.stringify([w.player.level, w.classSkills().map((d) => [w.skillLevel(d), w.skills[d.id]?.xp])]);
    if (sig === this.sig) return;
    this.sig = sig;
    const rows = w.classSkills().map((d, i) => {
      const unlocked = w.isUnlocked(d), lvl = w.skillLevel(d), need = w.skillXpNeed(d), st = w.skills[d.id];
      const key = d.type === 'active' ? ` <small>· tecla ${i + 1}</small>` : ' <span class="badge passive">Passiva</span>';
      const stats = d.type === 'active' ? `<small>Mana ${d.mana} · Recarga ${d.cooldown}s</small>` : '';
      let prog: string;
      if (!unlocked) prog = `<small>Desbloqueia no nível ${d.unlock} do personagem</small>`;
      else if (d.type === 'passive') prog = `<small>Nível ${lvl}/10 (sobe com o seu nível) · efeito +${Math.round((skillScale(lvl) - 1) * 100)}%</small>`;
      else prog = `<small>Nível ${lvl}/10 · efeito +${Math.round((skillScale(lvl) - 1) * 100)}% · ${need === null ? 'nível máximo' : `XP ${st.xp} / ${need} (sobe com o uso)`}</small>`
        + (need === null ? '' : `<div class="sk-bar"><i style="width:${(st.xp / need) * 100}%"></i></div>`);
      return `<div class="sk-row ${unlocked ? '' : 'locked'}" style="--c:${d.color}"><div class="ic">${initials(d.name)}</div>
        <div><b>${d.name}</b>${key}<div class="d">${d.description}</div>${stats}${prog}</div></div>`;
    }).join('');
    $('skills-panel').innerHTML = `<div class="card"><h2>Skills</h2>
      <small class="muted">Skills ativas sobem de nível quando usadas. Passivas sobem com o nível do personagem. Cada nível dá +8% de efeito.</small>${rows}
      <button class="primary" data-close="1">Fechar</button></div>`;
  }
}
