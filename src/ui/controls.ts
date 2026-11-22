import type { World } from '../core/world';
import type { Hud } from './hud';
import { toUi } from './uiScale';
import { byId } from './dom';
import { onPress } from './press';
import { isTouch } from '../platform/input';

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
    else if ((e.key === 'u' || e.key === 'U') && !e.repeat) world.levelUp();
    else if ((e.key === 'r' || e.key === 'R') && !e.repeat) world.useUltimate();
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
  setupKeyMove(world);
  byId('btn-attrs').addEventListener('click', () => hud.togglePanel());
  byId('btn-skills').addEventListener('click', () => hud.toggleSkills());
  byId('btn-bag').addEventListener('click', () => hud.toggleInventory());
  // XP guardada: tocar no quadro do jogador sobe um nível (só faz algo com nível pronto)
  byId('player-frame').addEventListener('click', () => world.levelUp());

  if (!isTouch) return;
  setupJoystick(world, tapAt);
  const atk = byId('btn-attack');
  atk.classList.remove('hidden');
  onPress(atk, () => world.attackNearest());
}

/** Direção na tela de cada tecla de movimento (por e.code, então funciona com Caps Lock e em AZERTY/QWERTZ). */
const MOVE_KEYS: Record<string, readonly [number, number]> = {
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** WASD/setas (18/11/2026): mesma entrada do joystick, direção relativa à tela (W sobe na tela).
 *  Fica ligado sempre (não só com !isTouch) para tablets e notebooks touch com teclado também andarem pelo teclado. */
function setupKeyMove(world: World) {
  const held = new Set<string>();
  let last = '0,0';
  const apply = () => {
    let x = 0,
      y = 0;
    for (const c of held) {
      x += MOVE_KEYS[c][0];
      y += MOVE_KEYS[c][1];
    }
    const k = `${x},${y}`;
    if (k === last) return; // só mexe no movimento quando a direção muda (não briga com o joystick nem com o clique)
    last = k;
    world.setMoveInput(x, y);
  };
  window.addEventListener('keydown', (e) => {
    if (!(e.code in MOVE_KEYS) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault(); // setas não rolam a página
    held.add(e.code);
    apply();
  });
  window.addEventListener('keyup', (e) => {
    if (!held.delete(e.code)) return;
    apply();
  });
  // Alt+Tab com a tecla apertada: o keyup nunca chega, então solta tudo
  const release = () => {
    held.clear();
    apply();
  };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release();
  });
}

/** Joystick flutuante (17/11/2026): tocar em qualquer lugar da metade esquerda da tela cria o joystick embaixo do dedo;
 *  se o dedo passa do limite, a base vai junto (o pino nunca trava). Parado, o círculo fica no lugar de sempre como guia.
 *  Toque em monstro/NPC dentro da área continua selecionando (não abre o joystick). */
function setupJoystick(world: World, tapAt: (x: number, y: number) => boolean) {
  const zone = byId('joy-zone'),
    joy = byId('joystick'),
    knob = byId('knob');
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
