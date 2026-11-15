import Phaser from 'phaser';
import { tn } from '../core/i18n';
import { tileToScreen } from '../core/iso';
import type { GameMap } from '../core/map';

const TALL: Record<string, { key: string; oy: number; base?: string }> = {
  tree: { key: 'tile-tree', oy: 48 / 64 },
  pillar: { key: 'tile-pillar', oy: 48 / 64, base: 'tile-ruin' },
  house: { key: 'tile-house', oy: 52 / 68 },
};

export function buildMapView(scene: Phaser.Scene, map: GameMap): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  for (let j = 0; j < map.height; j++) for (let i = 0; i < map.width; i++) {
    const name = map.tiles[j * map.width + i], pos = tileToScreen(i + 0.5, j + 0.5), tall = TALL[name];
    if (tall) {
      out.push(scene.add.image(pos.x, pos.y, tall.base ?? 'tile-grass').setDepth(-100000));
      out.push(scene.add.image(pos.x, pos.y, tall.key).setOrigin(0.5, tall.oy).setDepth(i + j + 1));
    } else {
      out.push(scene.add.image(pos.x, pos.y, 'tile-' + name).setDepth(-100000));
    }
  }
  for (const o of map.objects) {
    if (o.type !== 'portal') continue;
    const g = scene.add.graphics().setDepth(-90000);
    g.fillStyle(0xa060ff, 0.45); g.lineStyle(1, 0xe0c0ff, 0.9);
    for (let j = Math.floor(o.y); j < o.y + o.h; j++) for (let i = Math.floor(o.x); i < o.x + o.w; i++) {
      const pts = [tileToScreen(i, j), tileToScreen(i + 1, j), tileToScreen(i + 1, j + 1), tileToScreen(i, j + 1)];
      g.fillPoints(pts, true); g.strokePoints(pts, true);
    }
    scene.tweens.add({ targets: g, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });
    const c = tileToScreen(o.x + o.w / 2, o.y + o.h / 2);
    const label = scene.add.text(c.x, c.y - 20, tn(o.name), { fontSize: '13px', color: '#e8d0ff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(99999);
    out.push(g, label);
  }
  return out;
}
