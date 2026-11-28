import Phaser from 'phaser';
import tormenta from '../data/sprites/tormenta.json';
import geada from '../data/sprites/geada.json';
import tita from '../data/sprites/tita.json';
import vibora from '../data/sprites/vibora.json';
import lobo from '../data/sprites/lobo.json';
import cavalo from '../data/sprites/cavalo.json';
// montarias dos Fundadores: por enquanto o Cavalo recolorido (arte provisória)
import grouCelestial from '../data/sprites/grou_celestial.json';
import qilinJovem from '../data/sprites/qilin_jovem.json';
import tigreDeJade from '../data/sprites/tigre_de_jade.json';
import banditSword from '../data/sprites/bandido_espadachim.json';
import banditArcher from '../data/sprites/bandido_arqueiro.json';
import terracota from '../data/sprites/terracota.json';
import general from '../data/sprites/general.json';
import espectro from '../data/sprites/espectro_gelo.json';
import yeti from '../data/sprites/yeti.json';
import discipulo from '../data/sprites/discipulo_caido.json';
import abade from '../data/sprites/abade_caido.json';
import assassino from '../data/sprites/assassino_sombras.json';
import serpente from '../data/sprites/serpente_jade.json';
import grou from '../data/sprites/grou_espiritual.json';
import guardiaoJade from '../data/sprites/guardiao_jade.json';
import senhorNevoa from '../data/sprites/senhor_nevoa.json';
import andarilhoCinzas from '../data/sprites/andarilho_cinzas.json';
import mongeFogo from '../data/sprites/monge_fogo_rubro.json';
import guardaCeleste from '../data/sprites/guarda_celeste.json';
import feiticeiraLua from '../data/sprites/feiticeira_lua_fria.json';
import imperador from '../data/sprites/imperador_carmesim.json';
import { SKINS } from '../core/data';

// skins do jogador (src/data/skins.json): folha com o mesmo nome do id
const SKIN_SHEETS = import.meta.glob('../data/sprites/*.json', { eager: true, import: 'default' }) as Record<
  string,
  SheetMeta
>;
const skinSheets = Object.fromEntries(
  Object.keys(SKINS).flatMap((id) => {
    const m = SKIN_SHEETS[`../data/sprites/${id}.json`];
    return m ? [[id, m]] : [];
  }),
);
/** Nome do sprite do jogador: a skin vestida ou o traje da seita. */
export const playerTexture = (classId: string, skin: string | null) =>
  skin && skinSheets[skin] ? 'skin-' + skin : 'player-' + classId;

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
  // Porto Noturno: as três barracas do mercado noturno usam o mesmo modelo
  vendedor_porto1: 'npc_vendedora_porto',
  vendedor_porto2: 'npc_vendedora_porto',
  vendedor_porto3: 'npc_vendedora_porto',
  estabulo: 'npc_mercador', // Cavalariço Ma usa o modelo do mercador
  mestre_arena: 'npc_mestre_cais', // Mestre da Arena Tie usa o modelo do Mestre do Cais
};
export const npcSheetKey = (npcId: string) => NPC_SHEET_BY_ID[npcId] ?? 'npc_' + npcId;

// Sprites renderizados dos modelos 3D (tools/sprites). Cada folha é um atlas do Phaser
// com quadros "<anim>_<direção>_<i>"; o JSON em src/data/sprites traz animações e âncora.
// Direções: 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW.

/** levelup: só nas folhas do jogador (pose de comemorar, olhando para o alto) */
export type AnimName = 'idle' | 'walk' | 'attack' | 'death' | 'levelup';

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
  tita: tita as SheetMeta,
  vibora: vibora as SheetMeta,
  lobo: lobo as SheetMeta,
  cavalo: cavalo as SheetMeta,
  grou_celestial: grouCelestial as SheetMeta,
  qilin_jovem: qilinJovem as SheetMeta,
  tigre_de_jade: tigreDeJade as SheetMeta,
  bandido_espadachim: banditSword as SheetMeta,
  bandido_arqueiro: banditArcher as SheetMeta,
  terracota: terracota as SheetMeta,
  general: general as SheetMeta,
  espectro_gelo: espectro as SheetMeta,
  yeti: yeti as SheetMeta,
  discipulo_caido: discipulo as SheetMeta,
  abade_caido: abade as SheetMeta,
  assassino_sombras: assassino as SheetMeta,
  serpente_jade: serpente as SheetMeta,
  grou_espiritual: grou as SheetMeta,
  guardiao_jade: guardiaoJade as SheetMeta,
  senhor_nevoa: senhorNevoa as SheetMeta,
  andarilho_cinzas: andarilhoCinzas as SheetMeta,
  monge_fogo_rubro: mongeFogo as SheetMeta,
  guarda_celeste: guardaCeleste as SheetMeta,
  feiticeira_lua_fria: feiticeiraLua as SheetMeta,
  imperador_carmesim: imperador as SheetMeta,
  ...npcSheets,
  ...skinSheets,
};

// nome do sprite nos dados (monsters.json, 'player-' + seita) -> folha animada. Sem folha: figura genérica (PLACEHOLDER).
const BY_TEXTURE: Record<string, string> = {
  'player-lamina': 'tormenta',
  'player-pavilhao': 'geada',
  'player-tita': 'tita',
  'player-vibora': 'vibora',
  wolf: 'lobo',
  'mount-cavalo': 'cavalo', // montarias: 'mount-' + id de mounts.json
  'mount-grou_celestial': 'grou_celestial',
  'mount-qilin_jovem': 'qilin_jovem',
  'mount-tigre_de_jade': 'tigre_de_jade',
  'bandit-sword': 'bandido_espadachim',
  'bandit-archer': 'bandido_arqueiro',
  terracotta: 'terracota',
  general: 'general',
  'ice-spectre': 'espectro_gelo',
  yeti: 'yeti',
  'fallen-disciple': 'discipulo_caido',
  'fallen-abbot': 'abade_caido',
  'shadow-assassin': 'assassino_sombras',
  'jade-serpent': 'serpente_jade',
  'spirit-crane': 'grou_espiritual',
  'jade-guardian': 'guardiao_jade',
  'mist-lord': 'senhor_nevoa',
  'ash-wanderer': 'andarilho_cinzas',
  'crimson-monk': 'monge_fogo_rubro',
  'celestial-guard': 'guarda_celeste',
  'frost-moon-sorceress': 'feiticeira_lua_fria',
  'crimson-emperor': 'imperador_carmesim',
};

// retrato parado de frente, usado na mochila (por seita ou id da skin)
export const PORTRAITS: Record<string, string> = {
  lamina: 'sprites/tormenta_retrato.png',
  pavilhao: 'sprites/geada_retrato.png',
  tita: 'sprites/tita_retrato.png',
  vibora: 'sprites/vibora_retrato.png',
  ...Object.fromEntries(Object.keys(skinSheets).map((id) => [id, `sprites/${id}_retrato.png`])),
};

// retrato animado da mochila: a animação parada em alta resolução, numa tira horizontal (tools/sprites, portrait_anim)
export interface PortraitAnim {
  src: string;
  frames: number;
  fps: number;
  w: number;
  h: number;
}
const PORTRAIT_ANIM_META = import.meta.glob('../data/sprites/*_retrato_idle.json', {
  eager: true,
  import: 'default',
}) as Record<string, Omit<PortraitAnim, 'src'>>;
export const PORTRAIT_ANIMS: Record<string, PortraitAnim> = Object.fromEntries(
  Object.entries(PORTRAITS).flatMap(([cls, still]) => {
    const name = still.replace(/^sprites\/(.*)_retrato\.png$/, '$1');
    const m = PORTRAIT_ANIM_META[`../data/sprites/${name}_retrato_idle.json`];
    return m ? [[cls, { ...m, src: `sprites/${name}_retrato_idle.png` }]] : [];
  }),
);

// retrato das 8 direções (girar o personagem na janela Personagem, na loja de trajes e em tela cheia):
// tira horizontal com a direção 0..7 (tools/sprites, portrait_dirs), mesma chave de PORTRAITS
export interface PortraitDirs {
  src: string;
  dirs: number;
  w: number;
  h: number;
}
const PORTRAIT_DIRS_META = import.meta.glob('../data/sprites/*_retrato_dirs.json', {
  eager: true,
  import: 'default',
}) as Record<string, Omit<PortraitDirs, 'src'>>;
export const PORTRAIT_DIRS: Record<string, PortraitDirs> = Object.fromEntries(
  Object.entries(PORTRAITS).flatMap(([key, still]) => {
    const name = still.replace(/^sprites\/(.*)_retrato\.png$/, '$1');
    const m = PORTRAIT_DIRS_META[`../data/sprites/${name}_retrato_dirs.json`];
    return m ? [[key, { ...m, src: `sprites/${name}_retrato_dirs.png` }]] : [];
  }),
);

// retrato dos mestres (tela de criação e janela de diálogo), por seita
export const MASTER_PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(NPC_SHEET_BY_ID)
    .filter(([id]) => id.startsWith('mestre_'))
    .map(([id, sheet]) => [id.slice(7), `sprites/${sheet}_retrato.png`]),
);

export const sheetFor = (texture: string): { key: string; meta: SheetMeta } | null => {
  const key =
    BY_TEXTURE[texture] ??
    (texture.startsWith('skin-') && skinSheets[texture.slice(5)] ? texture.slice(5) : undefined) ??
    (texture.startsWith('npc-') && SHEETS[npcSheetKey(texture.slice(4))] ? npcSheetKey(texture.slice(4)) : undefined);
  return key ? { key, meta: SHEETS[key] } : null;
};

/** Boot: só o que é leve e vale para todos os mapas (cenários e pisos). As folhas de personagens são por mapa (sheetLoader). */
export function preloadSprites(scene: Phaser.Scene) {
  // asinha do título exclusivo (tools/sprites/title_wing.py): tira de 8 quadros
  scene.load.spritesheet('title-wing', 'sprites/fx/title-wing.png', { frameWidth: 96, frameHeight: 72 });
  scene.load.atlas('props-floresta', 'sprites/floresta.png', 'sprites/floresta.json');
  scene.load.atlas('props-cidade', 'sprites/cidade.png', 'sprites/cidade.json');
  scene.load.atlas('props-cidadela', 'sprites/cidadela.png', 'sprites/cidadela.json');
  scene.load.atlas('props-porto', 'sprites/porto.png', 'sprites/porto.json');
  scene.load.atlas('props-ruinas', 'sprites/ruinas.png', 'sprites/ruinas.json');
  scene.load.atlas('props-montanha', 'sprites/montanha.png', 'sprites/montanha.json');
  scene.load.atlas('props-bambu', 'sprites/bambu.png', 'sprites/bambu.json');
  scene.load.atlas('props-vale', 'sprites/vale.png', 'sprites/vale.json');
  scene.load.spritesheet('pisos', 'sprites/pisos.png', { frameWidth: 128, frameHeight: 64 });
}

export const sheetTexture = (key: string) => 'sp-' + key;

/** Põe a folha na fila do loader (quem chama dá o start). */
export function queueSheet(scene: Phaser.Scene, key: string) {
  scene.load.atlas(sheetTexture(key), `sprites/${key}.png`, `sprites/${key}.json`);
}

/** Cria as animações de uma folha já carregada. */
export function createSheetAnims(scene: Phaser.Scene, key: string) {
  const meta = SHEETS[key];
  if (!meta) return;
  for (const [anim, a] of Object.entries(meta.anims)) {
    for (const d of meta.dirList ?? Array.from({ length: meta.dirs }, (_, k) => k)) {
      const id = animKey(key, anim, d);
      if (scene.anims.exists(id)) continue;
      scene.anims.create({
        key: id,
        frames: Array.from({ length: a.frames }, (_, i) => ({ key: sheetTexture(key), frame: `${anim}_${d}_${i}` })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

/** Libera a memória de uma folha (textura e animações). Ninguém pode estar usando. */
export function releaseSheet(scene: Phaser.Scene, key: string) {
  const meta = SHEETS[key];
  if (meta)
    for (const anim of Object.keys(meta.anims))
      for (const d of meta.dirList ?? Array.from({ length: meta.dirs }, (_, k) => k))
        scene.anims.remove(animKey(key, anim, d));
  if (scene.textures.exists(sheetTexture(key))) scene.textures.remove(sheetTexture(key));
}

export const animKey = (sheet: string, anim: string, dir: number) => `${sheet}:${anim}:${dir}`;

/** Direção (0..7) a partir de um deslocamento em tiles. */
export function dirFromDelta(dx: number, dy: number): number {
  const down = dx + dy,
    right = dx - dy; // tile -> eixos da tela
  const k = Math.round(Math.atan2(right, down) / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}
