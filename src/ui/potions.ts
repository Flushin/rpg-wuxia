import { POTIONS } from '../core/items';
import type { PotionKind } from '../core/types';
import type { World } from '../core/world';
import { isTouch } from './controls';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const KEYS: Record<PotionKind, string> = { hp: 'Q', mp: 'E' };

// Botões de poção (HP = Q, mana = E): contagem e tempo restante do efeito.
export class PotionBar {
  private sigs: Record<PotionKind, string> = { hp: '', mp: '' };
  constructor(private world: World) {
    $('potion-bar').classList.toggle('touch', isTouch);
    for (const k of ['hp', 'mp'] as PotionKind[]) {
      const b = $(`pot-${k}`);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.world.usePotion(k);
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('focus', () => b.blur());
    }
  }
  update() {
    const w = this.world;
    for (const k of ['hp', 'mp'] as PotionKind[]) {
      const fx = w.potionFx[k],
        n = w.kindCount(k);
      const frac = fx ? Math.max(0, fx.remaining / POTIONS[fx.id].duration) : 0;
      const sig = `${n}|${fx ? Math.ceil(fx.remaining) : 0}|${Math.round(frac * 50)}|${w.potionCd[k] > 0}`;
      if (sig === this.sigs[k]) continue;
      this.sigs[k] = sig;
      const b = $(`pot-${k}`);
      b.classList.toggle('empty', n <= 0);
      b.classList.toggle('active', !!fx);
      (b.querySelector('.fill') as HTMLElement).style.height = `${frac * 100}%`;
      (b.querySelector('.cnt') as HTMLElement).textContent = String(n);
      (b.querySelector('.rem') as HTMLElement).textContent = fx ? `${Math.ceil(fx.remaining)}s` : '';
      (b.querySelector('.hk') as HTMLElement).textContent = isTouch ? '' : KEYS[k];
    }
  }
}
