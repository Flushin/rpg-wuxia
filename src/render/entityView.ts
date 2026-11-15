import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import type { Entity } from '../core/types';

export class EntityView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  private lastSx = 0;
  private flashTimer?: Phaser.Time.TimerEvent;

  constructor(private scene: Phaser.Scene, e: Entity, texture: string) {
    const shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.image(0, 2, texture).setOrigin(0.5, e.kind === 'monster' ? 0.92 : 0.93);
    this.ring = scene.add.graphics();
    this.bar = scene.add.graphics();
    const color = e.kind === 'player' ? '#9fe8a0' : e.kind === 'monster' ? '#ff9a8a' : '#f0d070';
    const text = e.kind === 'monster' ? `Nv ${e.level} ${e.name}` : e.name;
    const label = scene.add.text(0, e.kind === 'monster' ? -36 : -52, text, { fontSize: '12px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setResolution(2);
    label.setName('label');
    this.container = scene.add.container(0, 0, [this.ring, shadow, this.sprite, this.bar, label]);
    this.sync(e, false);
    this.lastSx = this.container.x;
  }

  sync(e: Entity, selected: boolean) {
    const s = tileToScreen(e.x, e.y);
    if (Math.abs(s.x - this.lastSx) > 0.2) this.sprite.setFlipX(s.x < this.lastSx);
    this.lastSx = s.x;
    this.container.setPosition(s.x, s.y).setDepth(e.x + e.y);
    this.container.setVisible(!(e.dead && e.kind === 'monster'));
    this.sprite.setAlpha(e.dead ? 0.35 : 1);
    (this.container.getByName('label') as Phaser.GameObjects.Text).setText(e.kind === 'monster' ? `Nv ${e.level} ${e.name}` : e.name);
    this.ring.clear(); this.bar.clear();
    if (selected && e.kind === 'monster') {
      this.ring.lineStyle(2, 0xff5050, 1); this.ring.strokeEllipse(0, 0, 36, 18);
      const w = 40, top = -52;
      this.bar.fillStyle(0x000000, 0.8); this.bar.fillRect(-w / 2 - 1, top - 1, w + 2, 6);
      this.bar.fillStyle(0xc0392b, 1); this.bar.fillRect(-w / 2, top, w * Math.max(0, e.hp / e.derived.maxHp), 4);
    }
  }

  flash() {
    this.sprite.setTintFill(0xffffff);
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(80, () => this.sprite.clearTint());
  }

  destroy() { this.flashTimer?.remove(); this.container.destroy(); }
}
