import { initials, skillScale, type SkillDef } from '../core/skills';
import type { World } from '../core/world';
import { isTouch } from './controls';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const SIZE = 56, R = 118;

// Barra de skills: PC (embaixo, centro, teclas 1-4) e celular (arco em volta do botão Atacar).
export class Hotbar {
  private el = $('hotbar');
  private tip = $('skill-tip');
  private slots: { btn: HTMLButtonElement; sweep: HTMLElement; cdt: HTMLElement; lock: HTMLElement; sig: string }[] = [];
  private shown = -1;
  private pressTimer = 0;
  private longPressed = false;

  constructor(private world: World, private onUse?: () => void) {
    const defs = world.activeSkills();
    this.el.classList.toggle('touch', isTouch);
    this.el.innerHTML = '';
    defs.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = 'slot'; b.style.setProperty('--c', d.color);
      b.innerHTML = `<span class="ic">${initials(d.name)}</span><span class="key">${i + 1}</span><span class="sweep"></span><span class="cdt"></span><span class="lock"></span>`;
      this.el.appendChild(b);
      this.slots.push({ btn: b, sweep: b.querySelector('.sweep')!, cdt: b.querySelector('.cdt')!, lock: b.querySelector('.lock')!, sig: '' });
      this.bind(b, i);
    });
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  private bind(b: HTMLButtonElement, i: number) {
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.showTip(i); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hideTip(); });
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.longPressed = false;
      if (e.pointerType === 'mouse') return;
      clearTimeout(this.pressTimer);
      this.pressTimer = window.setTimeout(() => { this.longPressed = true; this.showTip(i); }, 450);
    });
    const end = () => { clearTimeout(this.pressTimer); };
    b.addEventListener('pointercancel', () => { end(); this.hideTip(); });
    b.addEventListener('pointerup', (e) => {
      end();
      if (e.pointerType === 'mouse') return;
      if (this.longPressed) { this.longPressed = false; this.hideTip(); return; }
      this.use(i);
    });
    b.addEventListener('click', (e) => { if ((e as PointerEvent).pointerType === 'mouse') this.use(i); });
    b.addEventListener('focus', () => b.blur());
  }

  use(i: number) { this.world.useSkill(i); this.onUse?.(); }

  private layout() {
    if (!isTouch) return;
    const narrow = window.innerWidth < 380;
    const step = narrow ? 28 : 30, start = narrow ? 152 : 165;
    this.slots.forEach((s, i) => {
      const a = ((start - i * step) * Math.PI) / 180;
      s.btn.style.right = `${72 - R * Math.cos(a) - SIZE / 2}px`;
      s.btn.style.bottom = `${78 + R * Math.sin(a) - SIZE / 2}px`;
    });
  }

  private showTip(i: number) { this.shown = i; this.tip.classList.remove('hidden'); this.renderTip(); }
  private hideTip() { this.shown = -1; this.tip.classList.add('hidden'); }

  private renderTip() {
    const d = this.world.activeSkills()[this.shown];
    if (!d) return this.hideTip();
    this.tip.innerHTML = skillTipHtml(this.world, d);
    const r = this.slots[this.shown].btn.getBoundingClientRect(), w = 240;
    const x = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2));
    this.tip.style.left = `${x}px`;
    this.tip.style.top = '0px';
    const h = this.tip.offsetHeight;
    this.tip.style.top = `${Math.max(6, r.top - h - 8)}px`;
  }

  update() {
    const w = this.world, p = w.player;
    w.activeSkills().forEach((d, i) => {
      const s = this.slots[i], st = w.skills[d.id];
      const locked = !w.isUnlocked(d), cd = Math.max(st.cd, 0), total = d.cooldown ?? 1;
      const nomana = !locked && p.mana < (d.mana ?? 0);
      const frac = locked ? 0 : Math.min(1, cd / total);
      const sig = `${locked}|${nomana}|${cd > 0 ? cd.toFixed(1) : 0}|${Math.round(frac * 100)}|${w.gcd > 0}`;
      if (sig === s.sig) return;
      s.sig = sig;
      s.btn.classList.toggle('locked', locked);
      s.btn.classList.toggle('nomana', nomana);
      s.btn.classList.toggle('ready', !locked && !nomana && cd <= 0);
      s.lock.textContent = locked ? `Nv ${d.unlock}` : '';
      s.cdt.textContent = !locked && cd > 0 ? (cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      s.sweep.style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,.65) ${frac * 360}deg, transparent 0)` : '';
    });
    if (this.shown >= 0) this.renderTip();
  }
}

export function skillTipHtml(w: World, d: SkillDef): string {
  const lvl = w.skillLevel(d), need = w.skillXpNeed(d), st = w.skills[d.id];
  const unlocked = w.isUnlocked(d);
  const stats = d.type === 'active' ? `<span class="st">Mana ${d.mana} · Recarga ${d.cooldown}s</span><br>` : '';
  const xp = d.type === 'passive' ? '' : need === null ? '<div>Nível máximo</div>' : `<div>XP ${st.xp} / ${need}</div><div class="sk-bar"><i style="width:${(st.xp / need) * 100}%"></i></div>`;
  return `<b>${d.name}</b>${d.type === 'passive' ? ' <small>(Passiva)</small>' : ''}<p>${d.description}</p>${stats}`
    + (unlocked ? `Nível ${lvl}/10 · efeito +${Math.round((skillScale(lvl) - 1) * 100)}%${xp}` : `<span class="st">Desbloqueia no nível ${d.unlock}</span>`);
}
