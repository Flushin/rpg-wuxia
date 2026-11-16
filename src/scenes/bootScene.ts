import Phaser from 'phaser';
import { parseTiledMap, type GameMap } from '../core/map';
import { makeTextures } from '../render/textures';
import { createSpriteAnims, preloadSprites } from '../render/sprites';
import { sfxFiles } from '../render/audio';
import { loadAll } from '../save';

export const MAP_IDS = ['cidade', 'floresta', 'ruinas'];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // barra da tela de carregamento (HTML) acompanha o loader do Phaser
    const fill = document.getElementById('ld-fill');
    this.load.on('progress', (v: number) => { if (fill) fill.style.width = `${Math.round(v * 100)}%`; });
    for (const f of sfxFiles()) this.load.audio(f.key, f.urls);
    for (const id of MAP_IDS) this.load.json('map-' + id, `maps/${id}.json`);
    preloadSprites(this);
  }
  create() {
    makeTextures(this);
    createSpriteAnims(this);
    const maps: Record<string, GameMap> = {};
    for (const id of MAP_IDS) maps[id] = parseTiledMap(id, this.cache.json.get('map-' + id));
    this.registry.set('maps', maps);
    // some com a tela de carregamento antes de aparecer a seleção de personagem
    const ld = document.getElementById('loading');
    if (ld) { ld.classList.add('out'); setTimeout(() => ld.remove(), 300); }
    loadAll().then((file) => this.scene.start('Create', { file }), () => this.scene.start('Create', {}));
  }
}
