import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import { MONSTERS } from '../core/data';
import type { Entity } from '../core/types';

export class EntityView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  private lastSx = 0;
  private flashTimer?: Phaser.Time.TimerEvent;
  private flashing = false;
  private sc = 1;

  constructor(private scene: Phaser.Scene, e: Entity, texture: string) {
    const shadow = scene.add.image(0, 0, 'shadow');
    this.sc = e.kind === 'monster' ? MONSTERS[e.monsterId]?.scale ?? 1 : 1;
    this.sprite = scene.add.image(0, 2, texture).setOrigin(0.5, e.kind === 'monster' ? 0.92 : 0.93).setScale(this.sc);
    shadow.setScale(this.sc);
    this.ring = scene.add.graphics();
    this.bar = scene.add.graphics();
    const color = e.kind === 'player' ? '#9fe8a0' : e.kind === 'monster' ? '#ff9a8a' : '#f0d070';
    const text = e.kind === 'monster' ? `Nv ${e.level} ${e.name}` : e.name;
    const label = scene.add.text(0, e.kind === 'monster' ? -36 * this.sc : -52, text, { fontSize: '12px', color, stroke: '#000', strokeThickness: 3 })
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
    // buffs/debuffs: lentidão = tom azul + losango; defesa reduzida = seta vermelha; escudo = bolha
    const slow = e.buffs.some((b) => b.kind === 'slow'), broken = e.buffs.some((b) => b.kind === 'defReduction'), shield = e.buffs.some((b) => b.kind === 'shield' && b.value > 0);
    if (!this.flashing) { if (slow) this.sprite.setTint(0x8fc8ff); else this.sprite.clearTint(); }
    let ix = -18;
    if (slow) { this.bar.fillStyle(0x7fd0f0, 1); this.bar.fillPoints([{ x: ix, y: -46 }, { x: ix + 6, y: -40 }, { x: ix, y: -34 }, { x: ix - 6, y: -40 }], true); ix += 14; }
    if (broken) { this.bar.fillStyle(0xe03030, 1); this.bar.fillPoints([{ x: ix - 6, y: -45 }, { x: ix + 6, y: -45 }, { x: ix, y: -34 }], true); }
    if (shield) { this.bar.lineStyle(3, 0xd8e8f8, 0.9); this.bar.fillStyle(0xaad0ff, 0.22); this.bar.fillCircle(0, -20, 30); this.bar.strokeCircle(0, -20, 30); }
    if (selected && e.kind === 'monster') {
      this.ring.lineStyle(2, 0xff5050, 1); this.ring.strokeEllipse(0, 0, 36, 18);
      const w = 40 * Math.min(2, this.sc), top = -52 * this.sc;
      this.bar.fillStyle(0x000000, 0.8); this.bar.fillRect(-w / 2 - 1, top - 1, w + 2, 6);
      this.bar.fillStyle(0xc0392b, 1); this.bar.fillRect(-w / 2, top, w * Math.max(0, e.hp / e.derived.maxHp), 4);
    }
  }

  flash() {
    this.sprite.setTintFill(0xffffff); this.flashing = true;
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(80, () => { this.flashing = false; this.sprite.clearTint(); });
  }

  destroy() { this.flashTimer?.remove(); this.container.destroy(); }
}
