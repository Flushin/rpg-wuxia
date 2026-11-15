import Phaser from 'phaser';
import { parseTiledMap, type GameMap } from '../core/map';
import { makeTextures } from '../render/textures';
import { sfxFiles } from '../render/audio';
import { loadAll } from '../save';

export const MAP_IDS = ['cidade', 'floresta', 'ruinas'];

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    for (const f of sfxFiles()) this.load.audio(f.key, f.urls);
    for (const id of MAP_IDS) this.load.json('map-' + id, `maps/${id}.json`); }
  create() {
    makeTextures(this);
    const maps: Record<string, GameMap> = {};
    for (const id of MAP_IDS) maps[id] = parseTiledMap(id, this.cache.json.get('map-' + id));
    this.registry.set('maps', maps);
    loadAll().then((file) => this.scene.start('Create', { file }), () => this.scene.start('Create', {}));
  }
}
