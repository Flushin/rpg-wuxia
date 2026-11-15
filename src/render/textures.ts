import Phaser from 'phaser';

const DIAMOND = (oy: number) => [{ x: 32, y: oy }, { x: 64, y: oy + 16 }, { x: 32, y: oy + 32 }, { x: 0, y: oy + 16 }];

export function makeTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const flat = (key: string, color: number, edge: number) => {
    g.clear(); g.fillStyle(color, 1); g.fillPoints(DIAMOND(0), true);
    g.lineStyle(1, edge, 0.6); g.strokePoints(DIAMOND(0), true);
    g.generateTexture(key, 64, 32);
  };
  flat('tile-grass', 0x568c48, 0x3f6e36);
  flat('tile-path', 0xaa966e, 0x8a7852);
  flat('tile-plaza', 0xbeb9aa, 0x9a9588);
  g.clear(); g.fillStyle(0x3c6eaa, 1); g.fillPoints(DIAMOND(0), true);
  g.lineStyle(1, 0x7fb0e0, 0.7); g.lineBetween(18, 14, 30, 14); g.lineBetween(36, 20, 48, 20);
  g.generateTexture('tile-water', 64, 32);

  // árvore: base em y=32..64, centro do losango em (32,48)
  flat('tile-tree-base', 0x4a7c3e, 0x3f6e36);
  g.clear(); g.fillStyle(0x4a7c3e, 1); g.fillPoints(DIAMOND(32), true);
  g.fillStyle(0x6b4423, 1); g.fillRect(29, 34, 6, 16);
  g.fillStyle(0x2a6a34, 1); g.fillCircle(32, 26, 15);
  g.fillStyle(0x378a42, 1); g.fillCircle(26, 22, 9); g.fillCircle(38, 24, 8);
  g.generateTexture('tile-tree', 64, 64);

  // casa: base em y=36..68, centro (32,52)
  g.clear();
  g.fillStyle(0x8a5a46, 1); g.fillPoints([{ x: 0, y: 16 }, { x: 32, y: 32 }, { x: 32, y: 68 }, { x: 0, y: 52 }], true);
  g.fillStyle(0x6e4636, 1); g.fillPoints([{ x: 64, y: 16 }, { x: 32, y: 32 }, { x: 32, y: 68 }, { x: 64, y: 52 }], true);
  g.fillStyle(0xb03a30, 1); g.fillPoints(DIAMOND(0), true);
  g.lineStyle(1, 0x401810, 0.8); g.strokePoints(DIAMOND(0), true);
  g.fillStyle(0xf0d070, 1); g.fillRect(8, 38, 8, 8);
  g.generateTexture('tile-house', 64, 68);

  g.clear(); g.fillStyle(0x000000, 0.35); g.fillEllipse(15, 7, 28, 12); g.generateTexture('shadow', 30, 14);

  const figure = (key: string, body: number, trim: number, extra?: (g: Phaser.GameObjects.Graphics) => void) => {
    g.clear();
    g.fillStyle(body, 1); g.fillRoundedRect(6, 16, 16, 26, 5);
    g.fillStyle(trim, 1); g.fillRect(6, 28, 16, 4);
    g.fillStyle(0xf0cfa0, 1); g.fillCircle(14, 10, 7);
    g.fillStyle(0x222222, 1); g.fillRect(7, 3, 14, 4);
    extra?.(g);
    g.generateTexture(key, 28, 44);
  };
  figure('player-lamina', 0xc0623a, 0xf0d060, (x) => { x.fillStyle(0xdddddd, 1); x.fillRect(23, 10, 3, 24); x.fillStyle(0xf0d060, 1); x.fillRect(21, 32, 7, 3); });
  figure('player-pavilhao', 0x4a8fd0, 0xeeeeff, (x) => { x.fillStyle(0x8a6a3a, 1); x.fillRect(23, 8, 2, 34); x.fillStyle(0x9ee0ff, 1); x.fillCircle(24, 8, 4); });
  figure('npc-0', 0x777777, 0xff8a30);
  figure('npc-1', 0x3a9a6a, 0xe0e0e0);
  figure('npc-2', 0xe8e8e8, 0x8a8a8a, (x) => { x.fillStyle(0xffffff, 1); x.fillRect(8, 18, 12, 2); x.fillRect(11, 42, 6, 0); });

  g.clear();
  g.fillStyle(0x6e6e78, 1); g.fillEllipse(18, 20, 32, 16);
  g.fillCircle(32, 13, 7);
  g.fillTriangle(29, 8, 31, 0, 34, 7); g.fillTriangle(34, 7, 37, 1, 38, 9);
  g.fillStyle(0x55555e, 1); g.fillRect(6, 24, 4, 8); g.fillRect(14, 26, 4, 6); g.fillRect(24, 26, 4, 6);
  g.fillStyle(0xff4040, 1); g.fillCircle(34, 12, 1.5);
  g.fillStyle(0x6e6e78, 1); g.fillTriangle(2, 18, 0, 10, 8, 16);
  g.generateTexture('wolf', 42, 34);
  g.destroy();
}
