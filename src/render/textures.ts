import Phaser from 'phaser';

const DIAMOND = (oy: number) => [
  { x: 32, y: oy },
  { x: 64, y: oy + 16 },
  { x: 32, y: oy + 32 },
  { x: 0, y: oy + 16 },
];

export function makeTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const flat = (key: string, color: number, edge: number) => {
    g.clear();
    g.fillStyle(color, 1);
    g.fillPoints(DIAMOND(0), true);
    g.lineStyle(1, edge, 0.6);
    g.strokePoints(DIAMOND(0), true);
    g.generateTexture(key, 64, 32);
  };
  flat('tile-grass', 0x568c48, 0x3f6e36);
  flat('tile-path', 0xaa966e, 0x8a7852);
  flat('tile-plaza', 0xbeb9aa, 0x9a9588);
  flat('tile-ruin', 0x9e7c5c, 0x80613f);
  g.clear();
  g.fillStyle(0x3c6eaa, 1);
  g.fillPoints(DIAMOND(0), true);
  g.lineStyle(1, 0x7fb0e0, 0.7);
  g.lineBetween(18, 14, 30, 14);
  g.lineBetween(36, 20, 48, 20);
  g.generateTexture('tile-water', 64, 32);

  // árvore: base em y=32..64, centro do losango em (32,48)
  flat('tile-tree-base', 0x4a7c3e, 0x3f6e36);
  g.clear();
  g.fillStyle(0x4a7c3e, 1);
  g.fillPoints(DIAMOND(32), true);
  g.fillStyle(0x6b4423, 1);
  g.fillRect(29, 34, 6, 16);
  g.fillStyle(0x2a6a34, 1);
  g.fillCircle(32, 26, 15);
  g.fillStyle(0x378a42, 1);
  g.fillCircle(26, 22, 9);
  g.fillCircle(38, 24, 8);
  g.generateTexture('tile-tree', 64, 64);

  // pilar de ruína: base em y=32..64
  g.clear();
  g.fillStyle(0x9e7c5c, 1);
  g.fillPoints(DIAMOND(32), true);
  g.fillStyle(0x7a5e48, 1);
  g.fillRect(24, 14, 16, 36);
  g.fillStyle(0x9a7c64, 1);
  g.fillRect(24, 14, 6, 36);
  g.fillStyle(0x6a503c, 1);
  g.fillRect(20, 10, 24, 6);
  g.fillRect(20, 46, 24, 5);
  g.generateTexture('tile-pillar', 64, 64);

  // casa: base em y=36..68, centro (32,52)
  g.clear();
  g.fillStyle(0x8a5a46, 1);
  g.fillPoints(
    [
      { x: 0, y: 16 },
      { x: 32, y: 32 },
      { x: 32, y: 68 },
      { x: 0, y: 52 },
    ],
    true,
  );
  g.fillStyle(0x6e4636, 1);
  g.fillPoints(
    [
      { x: 64, y: 16 },
      { x: 32, y: 32 },
      { x: 32, y: 68 },
      { x: 64, y: 52 },
    ],
    true,
  );
  g.fillStyle(0xb03a30, 1);
  g.fillPoints(DIAMOND(0), true);
  g.lineStyle(1, 0x401810, 0.8);
  g.strokePoints(DIAMOND(0), true);
  g.fillStyle(0xf0d070, 1);
  g.fillRect(8, 38, 8, 8);
  g.generateTexture('tile-house', 64, 68);

  g.clear();
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

  const figure = (key: string, body: number, trim: number, extra?: (g: Phaser.GameObjects.Graphics) => void) => {
    g.clear();
    g.fillStyle(body, 1);
    g.fillRoundedRect(6, 16, 16, 26, 5);
    g.fillStyle(trim, 1);
    g.fillRect(6, 28, 16, 4);
    g.fillStyle(0xf0cfa0, 1);
    g.fillCircle(14, 10, 7);
    g.fillStyle(0x222222, 1);
    g.fillRect(7, 3, 14, 4);
    extra?.(g);
    g.generateTexture(key, 28, 44);
  };
  figure('player-lamina', 0xc0623a, 0xf0d060, (x) => {
    x.fillStyle(0xdddddd, 1);
    x.fillRect(23, 10, 3, 24);
    x.fillStyle(0xf0d060, 1);
    x.fillRect(21, 32, 7, 3);
  });
  figure('player-pavilhao', 0x4a8fd0, 0xeeeeff, (x) => {
    x.fillStyle(0x8a6a3a, 1);
    x.fillRect(23, 8, 2, 34);
    x.fillStyle(0x9ee0ff, 1);
    x.fillCircle(24, 8, 4);
  });
  figure('npc-0', 0x777777, 0xff8a30);
  figure('npc-1', 0x3a9a6a, 0xe0e0e0);
  figure('npc-2', 0xe8e8e8, 0x8a8a8a, (x) => {
    x.fillStyle(0xffffff, 1);
    x.fillRect(8, 18, 12, 2);
    x.fillRect(11, 42, 6, 0);
  });

  g.clear();
  g.fillStyle(0x6e6e78, 1);
  g.fillEllipse(18, 20, 32, 16);
  g.fillCircle(32, 13, 7);
  g.fillTriangle(29, 8, 31, 0, 34, 7);
  g.fillTriangle(34, 7, 37, 1, 38, 9);
  g.fillStyle(0x55555e, 1);
  g.fillRect(6, 24, 4, 8);
  g.fillRect(14, 26, 4, 6);
  g.fillRect(24, 26, 4, 6);
  g.fillStyle(0xff4040, 1);
  g.fillCircle(34, 12, 1.5);
  g.fillStyle(0x6e6e78, 1);
  g.fillTriangle(2, 18, 0, 10, 8, 16);
  g.generateTexture('wolf', 42, 34);

  // bandido espadachim: roupa escura, faixa vermelha, espada
  figure('bandit-sword', 0x4a3a3a, 0xc02828, (x) => {
    x.fillStyle(0xc02828, 1);
    x.fillRect(6, 4, 16, 3);
    x.fillStyle(0xcccccc, 1);
    x.fillRect(23, 14, 3, 20);
    x.fillStyle(0x6a4a2a, 1);
    x.fillRect(21, 32, 7, 3);
  });
  // bandido arqueiro: capa verde-oliva e arco com corda
  figure('bandit-archer', 0x5a6a30, 0x8a6a3a, (x) => {
    x.lineStyle(2, 0x7a4a1a, 1);
    x.beginPath();
    x.arc(24, 24, 13, -1.25, 1.25, false);
    x.strokePath();
    x.lineStyle(1, 0xeeeeee, 1);
    x.lineBetween(
      24 + 13 * Math.cos(-1.25),
      24 + 13 * Math.sin(-1.25),
      24 + 13 * Math.cos(1.25),
      24 + 13 * Math.sin(1.25),
    );
    x.fillStyle(0x3a4a20, 1);
    x.fillTriangle(6, 14, 22, 14, 14, 6);
  });
  // guerreiro de terracota: corpo largo, marrom-avermelhado, armadura em placas
  g.clear();
  g.fillStyle(0xa8643c, 1);
  g.fillRoundedRect(3, 16, 22, 28, 4);
  g.fillStyle(0x8a4e2c, 1);
  g.fillRect(3, 24, 22, 3);
  g.fillRect(3, 32, 22, 3);
  g.fillStyle(0xb87444, 1);
  g.fillCircle(14, 10, 8);
  g.fillStyle(0x6a3a1c, 1);
  g.fillRect(6, 2, 16, 4);
  g.fillRect(12, 0, 4, 4);
  g.fillStyle(0x2a1a10, 1);
  g.fillRect(10, 9, 2, 2);
  g.fillRect(16, 9, 2, 2);
  g.fillStyle(0x7a7a7a, 1);
  g.fillRect(25, 12, 3, 26);
  g.generateTexture('terracotta', 30, 46);
  // General de Terracota: maior, elmo com crista e estandarte
  g.clear();
  g.fillStyle(0x8a3a24, 1);
  g.fillRoundedRect(8, 20, 28, 34, 5);
  g.fillStyle(0xd4a017, 1);
  g.fillRect(8, 30, 28, 4);
  g.fillRect(8, 42, 28, 3);
  g.fillStyle(0xb06a40, 1);
  g.fillCircle(22, 12, 10);
  g.fillStyle(0x5a2a14, 1);
  g.fillRect(10, 2, 24, 5);
  g.fillStyle(0xc02828, 1);
  g.fillRect(18, -2, 8, 8);
  g.fillStyle(0x2a1a10, 1);
  g.fillRect(16, 11, 3, 3);
  g.fillRect(25, 11, 3, 3);
  g.fillStyle(0x6a4a2a, 1);
  g.fillRect(38, -8, 3, 64);
  g.fillStyle(0xc02828, 1);
  g.fillTriangle(41, -6, 62, 2, 41, 12);
  g.fillStyle(0xd4a017, 1);
  g.fillCircle(50, 3, 2.5);
  g.fillStyle(0xcccccc, 1);
  g.fillRect(2, 18, 4, 30);
  g.generateTexture('general', 64, 56);
  g.destroy();
}
