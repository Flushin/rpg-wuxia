import buffsJson from '../data/buffs.json';
import type { Buff, BuffKind } from '../core/types';
import { L } from '../core/i18n';

interface BuffInfo {
  debuff: boolean;
  icon: string;
  color: string;
  pt: string;
  en: string;
  fx: { pt: string; en: string };
}
export type BuffIconKey = IconKey;
type IconKey = BuffKind | 'freeze';
const DATA = buffsJson as unknown as Record<IconKey, BuffInfo> & { freezeSources: string[] };
const { freezeSources: _f, ...INFO } = DATA;
export const BUFF_INFO = INFO as unknown as Record<IconKey, BuffInfo>;
export const FREEZE_SOURCES = new Set(DATA.freezeSources);
const FREEZE = FREEZE_SOURCES;
const MAX = 6;

/** Ícone a usar: atordoar vindo de gelo aparece como "Congelado". */
export const buffIcon = (b: Buff): IconKey => (b.kind === 'stun' && FREEZE.has(b.id) ? 'freeze' : b.kind);

export function buffText(b: Buff): string {
  const k = buffIcon(b),
    i = BUFF_INFO[k],
    fx = L(i.fx.pt, i.fx.en)
      .replace('{pct}', String(Math.round(b.value * 100)))
      .replace('{dps}', String(Math.round(b.value)))
      .replace('{val}', String(Math.round(b.value)));
  return `${L(i.pt, i.en)}: ${fx} (${Math.ceil(b.remaining)}s)`;
}

/** Fileira de ícones de buffs/debuffs; só redesenha quando muda (tipos ou segundos). */
export class BuffRow {
  private sig = '';
  constructor(private el: HTMLElement) {}
  update(buffs: Buff[] | undefined, filter: 'debuff' | 'all' = 'all') {
    const list = (buffs ?? [])
      .filter((b) => b.remaining > 0 && (filter === 'all' || BUFF_INFO[buffIcon(b)].debuff))
      .sort((a, b) => Number(BUFF_INFO[buffIcon(b)].debuff) - Number(BUFF_INFO[buffIcon(a)].debuff));
    const sig = list
      .map((b) => `${buffIcon(b)}:${Math.ceil(b.remaining)}:${Math.round((10 * b.remaining) / b.duration)}`)
      .join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.classList.toggle('hidden', !list.length);
    this.el.replaceChildren(
      ...list.slice(0, MAX).map((b) => {
        const i = BUFF_INFO[buffIcon(b)],
          d = document.createElement('span'),
          left = Math.max(0, Math.min(1, b.remaining / b.duration));
        d.className = `buff ${i.debuff ? 'neg' : 'pos'}${b.remaining <= 3 ? ' ending' : ''}`;
        d.style.setProperty('--c', i.color);
        d.style.setProperty('--left', String(left));
        d.title = buffText(b);
        d.textContent = i.icon;
        if (b.remaining <= 3) {
          const s = document.createElement('small');
          s.textContent = String(Math.ceil(b.remaining));
          d.append(s);
        }
        return d;
      }),
    );
    if (list.length > MAX) {
      const m = document.createElement('span');
      m.className = 'buff more';
      m.textContent = `+${list.length - MAX}`;
      this.el.append(m);
    }
  }
}
