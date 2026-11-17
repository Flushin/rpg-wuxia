import type { World } from '../core/world';
import type { Hud } from './hud';
import { toUi } from './uiScale';

export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const $ = (id: string) => document.getElementById(id) as HTMLElement;

export function setupControls(world: World, hud: Hud, tapAt: (x: number, y: number) => boolean = () => false) {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      world.cycleTarget();
    } else if (e.key === 'c' || e.key === 'C') hud.togglePanel();
    else if (e.key === 'k' || e.key === 'K') hud.toggleSkills();
    else if (e.key === 'i' || e.key === 'I') hud.toggleInventory();
    else if ((e.key === 'm' || e.key === 'M') && !e.repeat) hud.toggleMap();
    else if ((e.key === 'q' || e.key === 'Q') && !e.repeat) world.usePotion('hp');
    else if ((e.key === 'e' || e.key === 'E') && !e.repeat) world.usePotion('mp');
    else if ((e.key === 'z' || e.key === 'Z') && !e.repeat) {
      if (!hud.offlineOpen) world.auto.toggle();
    } else if (e.key === 'Escape') hud.closeAll();
    else if (e.key >= '1' && e.key <= '4' && !e.repeat) world.useSkill(Number(e.key) - 1);
    else if (e.key === ' ') {
      e.preventDefault();
      world.attackNearest();
    }
  });
  $('btn-attrs').addEventListener('click', () => hud.togglePanel());
  $('btn-skills').addEventListener('click', () => hud.toggleSkills());
  $('btn-bag').addEventListener('click', () => hud.toggleInventory());

  if (!isTouch) return;
  setupJoystick(world, tapAt);
  const atk = $('btn-attack');
  atk.classList.remove('hidden');
  atk.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    world.attackNearest();
  });
}

/** Joystick flutuante (17/11/2026): tocar em qualquer lugar da metade esquerda da tela cria o joystick embaixo do dedo;
 *  se o dedo passa do limite, a base vai junto (o pino nunca trava). Parado, o círculo fica no lugar de sempre como guia.
 *  Toque em monstro/NPC dentro da área continua selecionando (não abre o joystick). */
function setupJoystick(world: World, tapAt: (x: number, y: number) => boolean) {
  const zone = $('joy-zone'),
    joy = $('joystick'),
    knob = $('knob');
  zone.classList.remove('hidden');
  joy.classList.remove('hidden');
  let active: number | null = null;
  let home = { x: 0, y: 0 }; // centro do círculo parado (px da tela)
  let base = { x: 0, y: 0 }; // centro atual da base (px da tela)
  let R = 0;
  const place = () => {
    joy.style.transform = `translate(${toUi(base.x - home.x)}px,${toUi(base.y - home.y)}px)`;
  };
  const move = (e: PointerEvent) => {
    let dx = e.clientX - base.x,
      dy = e.clientY - base.y;
    const l = Math.hypot(dx, dy),
      max = R * 0.7;
    if (l > max) {
      // a base segue o dedo
      base = { x: e.clientX - (dx / l) * max, y: e.clientY - (dy / l) * max };
      dx = (dx / l) * max;
      dy = (dy / l) * max;
      place();
    }
    knob.style.transform = `translate(${toUi(dx)}px,${toUi(dy)}px)`;
    if (Math.hypot(dx, dy) < R * 0.15) world.setMoveInput(0, 0);
    else world.setMoveInput(dx, dy);
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    knob.style.transform = '';
    joy.style.transform = '';
    joy.classList.remove('live');
    world.setMoveInput(0, 0);
  };
  zone.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    if (tapAt(e.clientX, e.clientY)) return; // monstro/NPC: só seleciona
    e.preventDefault();
    active = e.pointerId;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      /* dedo já saiu */
    }
    joy.style.transform = '';
    const r = joy.getBoundingClientRect();
    R = r.width / 2;
    home = { x: r.left + R, y: r.top + R };
    // a base nasce embaixo do dedo, sem sair da tela
    const z = zone.getBoundingClientRect();
    base = {
      x: Math.max(z.left + R, Math.min(e.clientX, z.right - R)),
      y: Math.max(z.top + R, Math.min(e.clientY, z.bottom - R)),
    };
    joy.classList.add('live');
    place();
    move(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === active) move(e);
  });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
}
