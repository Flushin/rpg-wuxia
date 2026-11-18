import Phaser from 'phaser';
import { parseTiledMap, type GameMap } from '../core/map';
import { makeTextures } from '../render/textures';
import { preloadSprites } from '../render/sprites';
import { sfxFiles } from '../render/audio';
import { loadAll } from '../save';
import { showLoadError } from '../ui/create';
import { MAP_IDS } from '../core/mapsConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  preload() {
    // barra da tela de carregamento (HTML) acompanha o loader do Phaser
    const fill = document.getElementById('ld-fill');
    this.load.on('progress', (v: number) => {
      if (fill) fill.style.width = `${Math.round(v * 100)}%`;
    });
    for (const f of sfxFiles()) this.load.audio(f.key, f.urls);
    for (const id of MAP_IDS) this.load.json('map-' + id, `maps/${id}.json`);
    preloadSprites(this);
  }
  create() {
    makeTextures(this);
    const maps: Record<string, GameMap> = {};
    for (const id of MAP_IDS) maps[id] = parseTiledMap(id, this.cache.json.get('map-' + id));
    this.registry.set('maps', maps);
    // some com a tela de carregamento antes de aparecer a seleção de personagem
    const ld = document.getElementById('loading');
    if (ld) {
      ld.classList.add('out');
      setTimeout(() => ld.remove(), 300);
    }
    this.openTitle();
  }

  // Lê os personagens e abre a tela inicial. Se a leitura falhar, NÃO abre a lista vazia (o jogador poderia criar
  // um personagem e a gravação apagaria os outros): mostra o erro com "Tentar de novo".
  private openTitle() {
    loadAll().then(
      (file) => this.scene.start('Create', { file }),
      (err) => {
        console.error('Falha ao ler os personagens', err);
        showLoadError(() => this.openTitle());
      },
    );
  }
}
