import { L } from '../core/i18n';
import { initials, skillScale, SKILL_MAX_LEVEL, type SkillDef } from '../core/skills';
import type { World } from '../core/world';
import { isTouch } from '../platform/input';
import { skillIconHtml } from './icons';
import { uiRect, uiW } from './uiScale';
import { byId } from './dom';
import { onPress } from './press';
import { hudV2 } from './hudLayout';
import { THUMB_COMPACT, THUMB_NORMAL, thumbLayout } from './thumbLayout';
import { UltButton, ultTipHtml } from './ultButton';

const SIZE = 56,
  R = 118,
  // distância mínima (px do HUD) entre a skill e a borda direita da tela: encostado na borda, o toque cai na faixa
  // do gesto de voltar do Android / Painel Edge da Samsung e, com outro dedo no joystick, o sistema fica com ele
  // (no Fold fechado deitado o 4º botão ficava a 1 px da borda e o escudo não saía andando)
  EDGE_GAP = 24;

// Barra de skills: PC (embaixo, centro, teclas 1-4) e celular (arco em volta do botão Atacar).
export class Hotbar {
  private el = byId('hotbar');
  private tip = byId('skill-tip');
  private slots: { btn: HTMLButtonElement; sweep: HTMLElement; cdt: HTMLElement; lock: HTMLElement; sig: string }[] =
    [];
  private shown = -1;
  private pressTimer = 0;
  private longPressed = false;
  private ult: UltButton;
  /** dica aberta da ultimate (em vez de uma skill) */
  private ultTip: Element | null = null;

  constructor(
    private world: World,
    private onUse?: () => void,
  ) {
    const defs = world.activeSkills();
    this.el.classList.toggle('touch', isTouch);
    this.el.innerHTML = '';
    defs.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = 'slot';
      b.style.setProperty('--c', d.color);
      b.innerHTML = `<span class="ic">${skillIconHtml(d.id, initials(d.name))}</span><span class="key">${i + 1}</span><span class="sweep"></span><span class="cdt"></span><span class="lock"></span>`;
      this.el.appendChild(b);
      this.slots.push({
        btn: b,
        sweep: b.querySelector('.sweep')!,
        cdt: b.querySelector('.cdt')!,
        lock: b.querySelector('.lock')!,
        sig: '',
      });
      this.bind(b, i);
    });
    this.ult = new UltButton(world, this.el, onUse, (on, el) => {
      this.ultTip = on ? el : null;
      if (on) {
        this.shown = -1;
        this.tip.classList.remove('hidden');
        this.renderTip();
      } else this.hideTip();
    });
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  private bind(b: HTMLButtonElement, i: number) {
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.showTip(i);
    });
    b.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.hideTip();
    });
    // toque: lança ao encostar o dedo, mesmo com o outro dedo no joystick (ver press.ts); mouse usa o click
    onPress(b, () => this.use(i), false);
    b.addEventListener('pointerdown', (e) => {
      this.longPressed = false;
      if (e.pointerType === 'mouse') return;
      clearTimeout(this.pressTimer);
      this.pressTimer = window.setTimeout(() => {
        this.longPressed = true;
        this.showTip(i); // segurar mostra a descrição
      }, 450);
    });
    const end = (e: PointerEvent) => {
      clearTimeout(this.pressTimer);
      if (e.pointerType === 'mouse' || !this.longPressed) return;
      this.longPressed = false;
      this.hideTip();
    };
    b.addEventListener('pointercancel', end);
    b.addEventListener('pointerup', end);
    b.addEventListener('click', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') this.use(i);
    });
    b.addEventListener('focus', () => b.blur());
  }

  use(i: number) {
    this.world.useSkill(i);
    this.onUse?.();
  }

  private layout() {
    if (!isTouch) return this.ult.layoutArc(null);
    if (hudV2()) return this.layoutV2();
    this.clearV2();
    // celular deitado com pouca altura (ex.: Fold fechado): arco baixo e compacto, para não subir até os botões do topo
    const short = window.innerWidth > window.innerHeight && window.innerHeight <= 450;
    const narrow = window.innerWidth < 380;
    const size = short ? 46 : SIZE,
      r = short ? 92 : R,
      cx = short ? 53 : 72,
      cy = short ? 51 : 78;
    // passo mínimo para os botões não encostarem: corda do arco ≥ tamanho + 6 px (antes, deitado, ficavam um em cima do outro)
    const minStep = (2 * Math.asin(Math.min(1, (size + 6) / (2 * r))) * 180) / Math.PI;
    const step = short ? Math.max(28, minStep) : narrow ? 28 : 30;
    // ângulo mínimo do último botão para ele ficar a EDGE_GAP da borda; se precisar, o arco todo gira para a esquerda
    const lastMin = (Math.acos(Math.max(-1, Math.min(1, (cx - size / 2 - EDGE_GAP) / r))) * 180) / Math.PI;
    const start = Math.max(short ? 178 : narrow ? 152 : 165, lastMin + (this.slots.length - 1) * step);
    this.slots.forEach((s, i) => {
      const a = ((start - i * step) * Math.PI) / 180;
      s.btn.style.right = `${cx - r * Math.cos(a) - size / 2}px`;
      s.btn.style.bottom = `${cy + r * Math.sin(a) - size / 2}px`;
    });
    // ultimate no layout clássico: botão redondo acima da última skill
    this.ult.layoutArc(null);
    this.ult.place(EDGE_GAP, cy + r + size, size);
  }

  /** HUD novo do celular (thumbLayout.ts): Atacar, as skills num anel em volta dele, poções e o arco da ultimate,
   *  todos com o mesmo vão. Deitado com pouca altura ou em pé estreito usa os tamanhos compactos; em pé as poções ficam em coluna. */
  private layoutV2() {
    const land = window.innerWidth > window.innerHeight,
      short = land && window.innerHeight <= 450,
      // em pé e estreito (até ~420 px do HUD): compactos, senão as poções encostam no joystick
      narrow = !land && uiW() < 420;
    const t = thumbLayout(short || narrow ? THUMB_COMPACT : THUMB_NORMAL, this.slots.length, !land);
    const k = t.k,
      px = (n: number) => `${n.toFixed(1)}px`;
    this.slots.forEach((s, i) => {
      const p = t.skills[i];
      Object.assign(s.btn.style, {
        width: px(k.sk),
        height: px(k.sk),
        right: px(p.x - k.sk / 2),
        bottom: px(p.y - k.sk / 2),
      });
    });
    Object.assign(byId('btn-attack').style, {
      width: px(k.atk),
      height: px(k.atk),
      right: px(t.cx - k.atk / 2),
      bottom: px(t.cy - k.atk / 2),
    });
    const bar = byId('potion-bar'),
      p0 = t.pots[0];
    Object.assign(bar.style, {
      left: 'auto',
      right: px(p0.x - k.pot / 2),
      bottom: px(p0.y - k.pot / 2),
      gap: px(k.gap),
      flexDirection: land ? 'row' : 'column-reverse',
    });
    for (const b of bar.querySelectorAll<HTMLElement>('.pot'))
      Object.assign(b.style, { width: px(k.pot), height: px(k.pot) });
    Object.assign(byId('btn-revive').style, {
      left: 'auto',
      transform: 'none',
      width: px(k.sk),
      height: px(k.sk),
      right: px(t.revive.x - k.sk / 2),
      bottom: px(t.revive.y - k.sk / 2),
    });
    this.ult.layoutArc(t);
  }

  /** Volta Atacar e poções para o CSS (layout clássico). */
  private clearV2() {
    const clear = (el: HTMLElement, keys: string[]) => keys.forEach((k) => el.style.removeProperty(k));
    clear(byId('btn-attack'), ['width', 'height', 'right', 'bottom']);
    clear(byId('btn-revive'), ['left', 'transform', 'width', 'height', 'right', 'bottom']);
    const bar = byId('potion-bar');
    clear(bar, ['left', 'right', 'bottom', 'gap', 'flex-direction']);
    for (const b of bar.querySelectorAll<HTMLElement>('.pot')) clear(b, ['width', 'height']);
    for (const s of this.slots) clear(s.btn, ['width', 'height']);
  }

  private showTip(i: number) {
    this.shown = i;
    this.ultTip = null;
    this.tip.classList.remove('hidden');
    this.renderTip();
  }
  private hideTip() {
    this.shown = -1;
    this.ultTip = null;
    this.tip.classList.add('hidden');
  }

  private renderTip() {
    const d = this.world.activeSkills()[this.shown];
    if (!d && !this.ultTip) return this.hideTip();
    this.tip.innerHTML = d ? skillTipHtml(this.world, d) : ultTipHtml(this.world);
    const r = uiRect(d ? this.slots[this.shown].btn : (this.ultTip as HTMLElement)),
      w = 240;
    const x = Math.max(6, Math.min(uiW() - w - 6, r.left + r.width / 2 - w / 2));
    this.tip.style.left = `${x}px`;
    this.tip.style.top = '0px';
    const h = this.tip.offsetHeight;
    this.tip.style.top = `${Math.max(6, r.top - h - 8)}px`;
  }

  update() {
    const w = this.world,
      p = w.player;
    w.activeSkills().forEach((d, i) => {
      const s = this.slots[i],
        st = w.skills[d.id];
      const locked = !w.isUnlocked(d),
        cd = Math.max(st.cd, 0),
        total = d.cooldown ?? 1;
      const nomana = !locked && p.mana < (d.mana ?? 0);
      const frac = locked ? 0 : Math.min(1, cd / total);
      const sig = `${locked}|${nomana}|${cd > 0 ? cd.toFixed(1) : 0}|${Math.round(frac * 100)}|${w.gcd > 0}`;
      if (sig === s.sig) return;
      s.sig = sig;
      s.btn.classList.toggle('locked', locked);
      s.btn.classList.toggle('nomana', nomana);
      s.btn.classList.toggle('cd', !locked && cd > 0); // só fica apagada em recarga
      s.btn.classList.toggle('ready', !locked && !nomana && cd <= 0);
      s.lock.textContent = locked ? L(`Nv ${d.unlock}`, `Lv ${d.unlock}`) : '';
      s.cdt.textContent = !locked && cd > 0 ? (cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      s.sweep.style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,.65) ${frac * 360}deg, transparent 0)` : '';
    });
    this.ult.update();
    if (this.shown >= 0 || this.ultTip) this.renderTip();
  }
}

export function skillTipHtml(w: World, d: SkillDef): string {
  const lvl = w.skillLevel(d),
    need = w.skillXpNeed(d),
    st = w.skills[d.id];
  const unlocked = w.isUnlocked(d);
  const stats =
    d.type === 'active'
      ? `<span class="st">Mana ${d.mana} · ${L('Recarga', 'Cooldown')} ${d.cooldown}s</span><br>`
      : '';
  const xp =
    d.type === 'passive'
      ? ''
      : need === null
        ? `<div>${L('Nível máximo', 'Max level')}</div>`
        : `<div>XP ${st.xp} / ${need}</div><div class="sk-bar"><i style="width:${(st.xp / need) * 100}%"></i></div>`;
  return (
    `<b>${d.name}</b>${d.type === 'passive' ? ` <small>(${L('Passiva', 'Passive')})</small>` : ''}<p>${d.description}</p>${stats}` +
    (unlocked
      ? `${L('Nível', 'Level')} ${lvl}/${SKILL_MAX_LEVEL} · ${L('efeito', 'effect')} +${Math.round((skillScale(lvl) - 1) * 100)}%${xp}`
      : `<span class="st">${L(`Desbloqueia no nível ${d.unlock}`, `Unlocks at level ${d.unlock}`)}</span>`)
  );
}
