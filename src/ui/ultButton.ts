// Botão da ultimate (src/core/ultimate.ts): no HUD novo do celular é um arco tocável por fora das skills
// (thumbLayout.ts); no PC e no layout clássico, um botão redondo junto da barra de skills (tecla R).
import { L } from '../core/i18n';
import type { World } from '../core/world';
import { onPress } from './press';
import type { ThumbLayout } from './thumbLayout';
import { uiRect } from './uiScale';

let current: UltButton | null = null;
/** Caixas (px do HUD) ao longo da faixa do arco, para quem precisa desviar dele (rastreador da missão). */
export const ultArcRects = () => current?.rects() ?? [];

const NS = 'http://www.w3.org/2000/svg';

export class UltButton {
  readonly btn = document.createElement('button');
  private svg = document.createElementNS(NS, 'svg');
  private border = document.createElementNS(NS, 'path');
  private track = document.createElementNS(NS, 'path');
  private fill = document.createElementNS(NS, 'path');
  private label = document.createElementNS(NS, 'text');
  private labelPath = document.createElementNS(NS, 'textPath');
  private sig = '';
  /** pontos da faixa (coordenadas do SVG) e meia grossura */
  private pts: { x: number; y: number }[] = [];
  private half = 0;
  private size = 1;

  constructor(
    private world: World,
    parent: HTMLElement,
    private onUse?: () => void,
    showTip?: (on: boolean, anchor: Element) => void,
  ) {
    current = this;
    const u = world.ultimate();
    this.btn.className = 'ult-btn hidden';
    const icon = u?.icon ?? '';
    this.btn.innerHTML = `<span class="ic">${icon}</span><span class="key">R</span><i class="ult-fill"></i><span class="lock"></span>`;
    this.btn.setAttribute('aria-label', u?.name ?? 'Ultimate');
    parent.appendChild(this.btn);
    onPress(this.btn, () => this.use(), false);
    this.btn.addEventListener('click', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') this.use();
    });
    this.btn.addEventListener('contextmenu', (e) => e.preventDefault());
    this.btn.addEventListener('focus', () => this.btn.blur());

    this.svg.setAttribute('class', 'ult-arc hidden');
    const pathId = 'ult-arc-path';
    this.border.setAttribute('class', 'ua-border');
    this.border.id = pathId;
    this.track.setAttribute('class', 'ua-track');
    this.fill.setAttribute('class', 'ua-fill');
    this.fill.setAttribute('pathLength', '100');
    this.label.setAttribute('class', 'ua-label');
    this.labelPath.setAttribute('href', `#${pathId}`);
    this.labelPath.setAttribute('startOffset', '50%');
    this.labelPath.setAttribute('text-anchor', 'middle');
    this.labelPath.textContent = u ? `${icon} ${u.name.toUpperCase()}` : '';
    this.label.appendChild(this.labelPath);
    this.svg.append(this.border, this.track, this.fill, this.label);
    parent.appendChild(this.svg);
    // cores da seita (ultimates.json) para o CSS do botão e do arco
    if (u)
      for (const el of [this.btn, this.svg])
        for (const [k, v] of [
          ['--ult', u.color],
          ['--ult-glow', u.glow],
          ['--ult-core', u.core],
          ['--ult-dark', u.dark],
          ['--ult-ink', u.ink],
        ])
          el.style.setProperty(k, v);
    // só a faixa do arco recebe o toque (o resto da caixa do SVG deixa passar para o jogo)
    onPress(this.track as unknown as HTMLElement, () => this.use(), false);
    if (showTip)
      for (const el of [this.btn, this.track]) {
        el.addEventListener('pointerenter', (e) => (e as PointerEvent).pointerType === 'mouse' && showTip(true, el));
        el.addEventListener('pointerleave', (e) => (e as PointerEvent).pointerType === 'mouse' && showTip(false, el));
      }
  }

  private use() {
    if (this.world.useUltimate()) this.onUse?.();
  }

  /** Arco do HUD novo (null = botão redondo do PC/layout clássico, posicionado pelo CSS ou por `place`). */
  layoutArc(t: ThumbLayout | null) {
    const has = !!this.world.ultimate();
    this.svg.classList.toggle('hidden', !t || !has);
    this.btn.classList.toggle('hidden', !!t || !has);
    if (!t) return;
    const { r, from, to } = t.ult,
      w = t.k.sk;
    // caixa do SVG presa no canto de baixo à direita (0×0 do #hotbar.touch); coordenadas: x da borda direita, y de baixo
    const S = Math.ceil(t.cx + r + w),
      P = (a: number) => {
        const q = (a * Math.PI) / 180;
        return `${(S - (t.cx - r * Math.cos(q))).toFixed(1)} ${(S - (t.cy + r * Math.sin(q))).toFixed(1)}`;
      };
    const d = `M${P(from)} A${r} ${r} 0 0 1 ${P(to)}`;
    this.size = S;
    this.half = w / 2;
    this.pts = [];
    for (let a = from; a >= to - 0.01; a -= Math.max(1, (from - to) / 24)) {
      const q = (a * Math.PI) / 180;
      this.pts.push({ x: S - (t.cx - r * Math.cos(q)), y: S - (t.cy + r * Math.sin(q)) });
    }
    this.svg.setAttribute('width', String(S));
    this.svg.setAttribute('height', String(S));
    this.svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
    this.svg.style.right = '0px';
    this.svg.style.bottom = '0px';
    for (const p of [this.border, this.track, this.fill]) p.setAttribute('d', d);
    this.border.setAttribute('stroke-width', String(w));
    this.track.setAttribute('stroke-width', String(w - 4));
    this.fill.setAttribute('stroke-width', String(w - 12));
    this.label.setAttribute('font-size', (w * 0.24).toFixed(1));
    this.label.setAttribute('dy', (w * 0.085).toFixed(1));
  }

  rects(): { left: number; right: number; top: number; bottom: number }[] {
    if (this.svg.classList.contains('hidden') || !this.pts.length) return [];
    const b = uiRect(this.svg),
      k = b.width / this.size;
    return this.pts.map((p) => ({
      left: b.left + (p.x - this.half) * k,
      right: b.left + (p.x + this.half) * k,
      top: b.top + (p.y - this.half) * k,
      bottom: b.top + (p.y + this.half) * k,
    }));
  }

  /** Botão redondo no layout clássico do celular: acima do arco de skills. */
  place(right: number, bottom: number, size: number) {
    Object.assign(this.btn.style, {
      position: 'absolute',
      right: `${right}px`,
      bottom: `${bottom}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
  }

  update() {
    const w = this.world,
      u = w.ultimate();
    if (!u) return;
    const unlocked = w.ultUnlocked(),
      f = w.ultFill(),
      ready = w.ultReady(),
      casting = !!w.ultCast;
    const sig = `${unlocked}|${Math.round(f * 100)}|${ready}|${casting}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.fill.setAttribute('stroke-dashoffset', String(100 - f * 100));
    this.fill.setAttribute('stroke-dasharray', '100 100');
    this.fill.style.opacity = f > 0.005 ? '1' : '0'; // traço vazio com ponta redonda deixaria um ponto
    this.svg.classList.toggle('ready', ready);
    this.svg.classList.toggle('locked', !unlocked);
    this.btn.classList.toggle('ready', ready);
    this.btn.classList.toggle('locked', !unlocked);
    this.btn.style.setProperty('--f', String(f));
    (this.btn.querySelector('.lock') as HTMLElement).textContent = unlocked
      ? ''
      : L(`Nv ${u.unlock}`, `Lv ${u.unlock}`);
    this.labelPath.textContent = unlocked
      ? `${u.icon} ${u.name.toUpperCase()}`
      : `🔒 ${L(`NÍVEL ${u.unlock}`, `LEVEL ${u.unlock}`)}`;
  }
}

export function ultTipHtml(w: World): string {
  const u = w.ultimate();
  if (!u) return '';
  const st = w.ultUnlocked()
    ? `${L('Carga', 'Charge')} ${Math.floor(w.ultCharge)}/${u.charge}`
    : L(`Desbloqueia no nível ${u.unlock}`, `Unlocks at level ${u.unlock}`);
  return `<b>${u.name}</b> <small>(Ultimate)</small><p>${u.description}</p><span class="st">${L(
    `Enche com ${u.charge} skills que acertam um monstro; esvazia fora de combate.`,
    `Fills with ${u.charge} skills that hit a monster; drains out of combat.`,
  )}</span><br>${st}`;
}
