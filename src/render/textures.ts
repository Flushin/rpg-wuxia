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

  // coluna de luz (subida de nível): branca, forte no meio, some nas laterais, no alto e na base; tingida no uso
  const beam = scene.textures.exists('fx-beam') ? null : scene.textures.createCanvas('fx-beam', 32, 128);
  if (beam) {
    const c = beam.getContext();
    const across = c.createLinearGradient(0, 0, 32, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = across;
    c.fillRect(0, 0, 32, 128);
    const up = c.createLinearGradient(0, 0, 0, 128);
    up.addColorStop(0, 'rgba(255,255,255,0)');
    up.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    up.addColorStop(0.9, 'rgba(255,255,255,1)');
    up.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = up;
    c.fillRect(0, 0, 32, 128);
    beam.refresh();
  }
}
