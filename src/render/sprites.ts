import Phaser from 'phaser';
import tormenta from '../data/sprites/tormenta.json';
import geada from '../data/sprites/geada.json';
import lobo from '../data/sprites/lobo.json';

// Sprites renderizados dos modelos 3D (tools/sprites). Cada folha é um atlas do Phaser
// com quadros "<anim>_<direção>_<i>"; o JSON em src/data/sprites traz animações e âncora.
// Direções: 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW.

export type AnimName = 'idle' | 'walk' | 'attack' | 'death';

export interface SheetMeta {
  frameWidth: number; frameHeight: number; scale: number; top: number;
  anchor: number[]; dirs: number;
  anims: Record<string, { frames: number; fps: number; loop: boolean }>;
}

const SHEETS: Record<string, SheetMeta> = {
  tormenta: tormenta as SheetMeta,
  geada: geada as SheetMeta,
  lobo: lobo as SheetMeta,
};

// textura antiga (placeholder) -> folha animada. O que não estiver aqui continua placeholder.
const BY_TEXTURE: Record<string, string> = {
  'player-lamina': 'tormenta',
  'player-pavilhao': 'geada',
  wolf: 'lobo',
};

// retrato parado de frente, usado na mochila (por seita)
export const PORTRAITS: Record<string, string> = {
  lamina: 'sprites/tormenta_retrato.png',
  pavilhao: 'sprites/geada_retrato.png',
};

export const sheetFor = (texture: string): { key: string; meta: SheetMeta } | null => {
  const key = BY_TEXTURE[texture];
  return key ? { key, meta: SHEETS[key] } : null;
};

export function preloadSprites(scene: Phaser.Scene) {
  for (const key of Object.keys(SHEETS)) scene.load.atlas('sp-' + key, `sprites/${key}.png`, `sprites/${key}.json`);
  scene.load.atlas('props-floresta', 'sprites/floresta.png', 'sprites/floresta.json');
  scene.load.spritesheet('pisos', 'sprites/pisos.png', { frameWidth: 128, frameHeight: 64 });
}

export function createSpriteAnims(scene: Phaser.Scene) {
  for (const [key, meta] of Object.entries(SHEETS)) {
    for (const [anim, a] of Object.entries(meta.anims)) {
      for (let d = 0; d < meta.dirs; d++) {
        const id = animKey(key, anim, d);
        if (scene.anims.exists(id)) continue;
        scene.anims.create({
          key: id,
          frames: Array.from({ length: a.frames }, (_, i) => ({ key: 'sp-' + key, frame: `${anim}_${d}_${i}` })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
  }
}

export const animKey = (sheet: string, anim: string, dir: number) => `${sheet}:${anim}:${dir}`;

/** Direção (0..7) a partir de um deslocamento em tiles. */
export function dirFromDelta(dx: number, dy: number): number {
  const down = dx + dy, right = dx - dy; // tile -> eixos da tela
  const k = Math.round(Math.atan2(right, down) / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}
