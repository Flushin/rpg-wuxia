// Diagnóstico de toque (⚙ "Diagnóstico de toque"): mostra na tela, em tempo real, cada dedo que encosta/sai,
// em qual elemento o celular entregou o toque, em qual elemento ele caiu de verdade (pela posição) e o que a
// skill fez (lançou / falhou e por quê). Serve para investigar no aparelho real problemas que a emulação do
// navegador não reproduz (ex.: escudo que não sai andando na luta contra o chefe no Fold fechado).
import type { World } from '../core/world';
import { PREF, getPref, setPref } from '../platform/prefs';
import { skillById } from '../core/skills';

const MAX_LINES = 14;

function describe(el: Element | null): string {
  if (!el) return '∅';
  const slot = el.closest('#hotbar .slot');
  if (slot) return `skill${[...slot.parentElement!.children].indexOf(slot) + 1}`;
  const withId = el.closest('[id]');
  return withId ? `#${withId.id}` : el.tagName.toLowerCase();
}

class TouchDebug {
  enabled = getPref(PREF.TOUCH_DEBUG) === '1';
  private el: HTMLElement | null = null;
  private lines: string[] = [];
  private t0 = performance.now();
  private world: World | null = null;
  private wired = false;
  private wrapped = new WeakSet<World>();

  attach(world: World) {
    this.world = world;
    if (this.enabled) this.wire();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    setPref(PREF.TOUCH_DEBUG, on ? '1' : '0');
    if (on) this.wire();
    else {
      this.el?.remove();
      this.el = null;
      this.lines = [];
    }
  }

  private log(s: string) {
    if (!this.enabled) return;
    const t = ((performance.now() - this.t0) / 1000).toFixed(2);
    this.lines.push(`${t} ${s}`);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    if (!this.el) {
      this.el = document.createElement('pre');
      this.el.id = 'touch-debug';
      document.body.appendChild(this.el);
    }
    this.el.textContent = this.lines.join('\n');
  }

  private wire() {
    this.wrapWorld();
    if (this.wired) return;
    this.wired = true;
    const opt = { capture: true, passive: true };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel'] as const)
      window.addEventListener(
        type,
        (e) => {
          if (e.pointerType === 'mouse') return;
          const real = document.elementFromPoint(e.clientX, e.clientY);
          const tgt = describe(e.target as Element),
            pos = describe(real);
          this.log(`${type.slice(7)} p${e.pointerId} → ${tgt}${pos !== tgt ? ` (dedo em ${pos})` : ''}`);
        },
        opt,
      );
    for (const type of ['touchstart', 'touchend', 'touchcancel'] as const)
      window.addEventListener(
        type,
        (e) => {
          const pts = [...e.changedTouches].map((t) => describe(document.elementFromPoint(t.clientX, t.clientY)));
          this.log(`${type} dedos=${e.touches.length} [${pts.join(',')}]`);
        },
        opt,
      );
  }

  /** O que a skill fez: olha os eventos que useSkill gerou. */
  private wrapWorld() {
    const w = this.world;
    if (!w || this.wrapped.has(w)) return;
    this.wrapped.add(w);
    const orig = w.useSkill.bind(w);
    w.useSkill = (slot: number) => {
      const n = w.events.length;
      orig(slot);
      const r = w.events
        .slice(n)
        .map((ev) =>
          ev.type === 'skillCast'
            ? `lançou ${skillById(ev.skillId)?.name ?? ev.skillId}`
            : ev.type === 'skillFail'
              ? `falhou: ${ev.reason}`
              : '',
        )
        .filter(Boolean);
      const mi = w.moveInput;
      this.log(
        `  useSkill(${slot + 1}) ${r.join(' ') || 'nada'} | andando=${mi.x || mi.y ? 's' : 'n'} gcd=${w.gcd.toFixed(2)} mana=${Math.round(w.player.mana)}`,
      );
    };
  }
}

export const touchDebug = new TouchDebug();
