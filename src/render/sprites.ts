import Phaser from 'phaser';
import tormenta from '../data/sprites/tormenta.json';
import geada from '../data/sprites/geada.json';
import lobo from '../data/sprites/lobo.json';
import banditSword from '../data/sprites/bandido_espadachim.json';
import banditArcher from '../data/sprites/bandido_arqueiro.json';
import terracota from '../data/sprites/terracota.json';
import general from '../data/sprites/general.json';

// NPCs da cidade (marco 6): personagens KayKit recoloridos. Parados = só a animação parada, de frente;
// moradores = parado + andar nas 8 direções.
const NPC_SHEETS = import.meta.glob('../data/sprites/npc_*.json', { eager: true, import: 'default' }) as Record<
  string,
  SheetMeta
>;
const npcSheets = Object.fromEntries(
  Object.entries(NPC_SHEETS).map(([p, m]) => [p.replace(/^.*\/(npc_[^/]+)\.json$/, '$1'), m]),
);
/** npcId (mapa) -> folha. Os mestres usam o nome da seita no mapa. */
const NPC_SHEET_BY_ID: Record<string, string> = {
  mestre_lamina: 'npc_mestre_tormenta',
  mestre_pavilhao: 'npc_mestra_geada',
  mestre_tita: 'npc_mestre_tita',
  mestre_vibora: 'npc_mestra_vibora',
};
export const npcSheetKey = (npcId: string) => NPC_SHEET_BY_ID[npcId] ?? 'npc_' + npcId;

// Sprites renderizados dos modelos 3D (tools/sprites). Cada folha é um atlas do Phaser
// com quadros "<anim>_<direção>_<i>"; o JSON em src/data/sprites traz animações e âncora.
// Direções: 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW.

export type AnimName = 'idle' | 'walk' | 'attack' | 'death';

export interface SheetMeta {
  frameWidth: number;
  frameHeight: number;
  scale: number;
  top: number;
  anchor: number[];
  dirs: number;
  dirList?: number[]; // dirList: só estas direções existem na folha
  anims: Record<string, { frames: number; fps: number; loop: boolean }>;
}

const SHEETS: Record<string, SheetMeta> = {
  tormenta: tormenta as SheetMeta,
  geada: geada as SheetMeta,
  lobo: lobo as SheetMeta,
  bandido_espadachim: banditSword as SheetMeta,
  bandido_arqueiro: banditArcher as SheetMeta,
  terracota: terracota as SheetMeta,
  general: general as SheetMeta,
  ...npcSheets,
};

// nome do sprite nos dados (monsters.json, 'player-' + seita) -> folha animada. Sem folha: figura genérica (PLACEHOLDER).
const BY_TEXTURE: Record<string, string> = {
  'player-lamina': 'tormenta',
  'player-pavilhao': 'geada',
  wolf: 'lobo',
  'bandit-sword': 'bandido_espadachim',
  'bandit-archer': 'bandido_arqueiro',
  terracotta: 'terracota',
  general: 'general',
};

// retrato parado de frente, usado na mochila (por seita)
export const PORTRAITS: Record<string, string> = {
  lamina: 'sprites/tormenta_retrato.png',
  pavilhao: 'sprites/geada_retrato.png',
};

// retrato dos mestres (tela de criação e janela de diálogo), por seita
export const MASTER_PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(NPC_SHEET_BY_ID).map(([id, sheet]) => [id.slice(7), `sprites/${sheet}_retrato.png`]),
);

export const sheetFor = (texture: string): { key: string; meta: SheetMeta } | null => {
  const key =
    BY_TEXTURE[texture] ??
    (texture.startsWith('npc-') && SHEETS[npcSheetKey(texture.slice(4))] ? npcSheetKey(texture.slice(4)) : undefined);
  return key ? { key, meta: SHEETS[key] } : null;
};

export function preloadSprites(scene: Phaser.Scene) {
  for (const key of Object.keys(SHEETS)) scene.load.atlas('sp-' + key, `sprites/${key}.png`, `sprites/${key}.json`);
  scene.load.atlas('props-floresta', 'sprites/floresta.png', 'sprites/floresta.json');
  scene.load.atlas('props-cidade', 'sprites/cidade.png', 'sprites/cidade.json');
  scene.load.atlas('props-ruinas', 'sprites/ruinas.png', 'sprites/ruinas.json');
  scene.load.spritesheet('pisos', 'sprites/pisos.png', { frameWidth: 128, frameHeight: 64 });
}

export function createSpriteAnims(scene: Phaser.Scene) {
  for (const [key, meta] of Object.entries(SHEETS)) {
    for (const [anim, a] of Object.entries(meta.anims)) {
      for (const d of meta.dirList ?? Array.from({ length: meta.dirs }, (_, k) => k)) {
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
  const down = dx + dy,
    right = dx - dy; // tile -> eixos da tela
  const k = Math.round(Math.atan2(right, down) / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}
