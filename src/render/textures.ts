import Phaser from 'phaser';

/** Figura genérica para quem ainda não tem folha de sprites (ex.: seita nova antes da arte). */
export const PLACEHOLDER = 'placeholder';

// Texturas desenhadas em código. Todo o resto (personagens, monstros, NPCs, pisos e cenário) vem dos atlas em public/sprites.
export function makeTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // sombra embaixo dos pés
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(15, 7, 28, 12);
  g.generateTexture('shadow', 30, 14);

  // ponto de luz suave (partículas: portais e efeitos das skills)
  g.clear();
  for (let r = 8; r > 0; r--) {
    g.fillStyle(0xffffff, 0.12 + (8 - r) * 0.11);
    g.fillCircle(8, 8, r);
  }
  g.generateTexture('fx-dot', 16, 16);

  // figura genérica: corpo cinza, faixa clara e cabeça
  g.clear();
  g.fillStyle(0x777777, 1);
  g.fillRoundedRect(6, 16, 16, 26, 5);
  g.fillStyle(0xe0e0e0, 1);
  g.fillRect(6, 28, 16, 4);
  g.fillStyle(0xf0cfa0, 1);
  g.fillCircle(14, 10, 7);
  g.fillStyle(0x222222, 1);
  g.fillRect(7, 3, 14, 4);
  g.generateTexture(PLACEHOLDER, 28, 44);

  g.destroy();
}
