import type { World } from '../core/world';
import type { Hud } from './hud';

export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

export function setupControls(world: World, hud: Hud) {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Tab') { e.preventDefault(); world.cycleTarget(); }
    else if (e.key === 'c' || e.key === 'C') hud.togglePanel();
    else if (e.key === 'k' || e.key === 'K') hud.toggleSkills();
    else if (e.key === 'i' || e.key === 'I') hud.toggleInventory();
    else if ((e.key === 'q' || e.key === 'Q') && !e.repeat) world.usePotion('hp');
    else if ((e.key === 'e' || e.key === 'E') && !e.repeat) world.usePotion('mp');
    else if ((e.key === 'z' || e.key === 'Z') && !e.repeat) { if (!hud.offlineOpen) world.auto.toggle(); }
    else if (e.key === 'Escape') hud.closeAll();
    else if (e.key >= '1' && e.key <= '4' && !e.repeat) world.useSkill(Number(e.key) - 1);
    else if (e.key === ' ') { e.preventDefault(); world.attackNearest(); }
  });
  $('btn-attrs').addEventListener('click', () => hud.togglePanel());
  $('btn-skills').addEventListener('click', () => hud.toggleSkills());
  $('btn-bag').addEventListener('click', () => hud.toggleInventory());

  if (!isTouch) return;
  const joy = $('joystick'), knob = $('knob'), atk = $('btn-attack');
  joy.classList.remove('hidden'); atk.classList.remove('hidden');
  let active: number | null = null;
  const move = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const l = Math.hypot(dx, dy), max = R * 0.7;
    if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (l < R * 0.15) world.setMoveInput(0, 0); else world.setMoveInput(dx, dy);
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null; knob.style.transform = ''; world.setMoveInput(0, 0);
  };
  joy.addEventListener('pointerdown', (e) => { active = e.pointerId; joy.setPointerCapture(e.pointerId); move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === active) move(e); });
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  atk.addEventListener('pointerdown', (e) => { e.preventDefault(); world.attackNearest(); });
}
