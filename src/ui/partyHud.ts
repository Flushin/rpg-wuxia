// Masmorra em equipe (src/core/world/party.ts): vida de cada bot no quadro do jogador e o botão de reviver.
// Reviver = segurar o botão (ou a tecla F) parado perto do bot caído por REVIVE_SECONDS; o botão enche enquanto
// segura. No HUD novo do celular a posição vem de thumbLayout.ts (revive); no desktop fica no centro, embaixo.
import { L } from '../core/i18n';
import type { World } from '../core/world';
import { REVIVE_SECONDS, revivable } from '../core/world/party';
import { isTouch } from '../platform/input';
import { byId, escapeHtml, setStyle } from './dom';
import { renderPanel } from './panelRender';

export class PartyHud {
  private sig = '';
  constructor(private world: World) {
    const btn = byId('btn-revive');
    btn.classList.toggle('touch', isTouch);
    btn.title = L('Reviver aliado: segure (F)', 'Revive ally: hold (F)');
    const hold = (on: boolean) => () => (this.world.reviving = on);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      hold(true)();
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      btn.addEventListener(ev, hold(false));
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'f' || e.key === 'F') && !(e.target instanceof HTMLInputElement)) hold(true)();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'f' || e.key === 'F') hold(false)();
    });
  }

  update() {
    const w = this.world,
      box = byId('party-frames'),
      btn = byId('btn-revive');
    if (!w.party.length) {
      if (!box.classList.contains('hidden')) {
        box.classList.add('hidden');
        this.sig = '';
      }
      btn.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    const sig = w.party.map((b) => `${b.e.id}:${b.e.dead ? 'x' : Math.ceil((b.e.hp / b.e.derived.maxHp) * 50)}`).join();
    if (sig !== this.sig) {
      this.sig = sig;
      renderPanel(
        box,
        w.party
          .map(
            (b) =>
              `<div class="pm${b.e.dead ? ' down' : ''}"><b>${escapeHtml(b.e.name)}</b><div class="bar hp"><i style="width:${
                b.e.dead ? 0 : Math.max(0, Math.min(100, (b.e.hp / b.e.derived.maxHp) * 100)).toFixed(0)
              }%"></i></div></div>`,
          )
          .join(''),
      );
    }
    const can = !!revivable(w);
    btn.classList.toggle('hidden', !can);
    setStyle(
      btn.querySelector('.fill') as HTMLElement,
      'height',
      `${Math.min(100, (w.reviveT / REVIVE_SECONDS) * 100)}%`,
    );
  }
}
