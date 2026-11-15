import Phaser from 'phaser';
import { TILE_H, TILE_W, tileToScreen } from '../core/iso';
import { SKILLS } from '../core/skills';
import type { GameEvent } from '../core/types';

const DEPTH = 99997;
const DEFS = Object.fromEntries(Object.values(SKILLS).flat().map((d) => [d.id, d]));

// Efeitos visuais placeholder das skills (formas simples em Graphics).
export class SkillFx {
  constructor(private scene: Phaser.Scene) {}

  private gfx() { return this.scene.add.graphics().setDepth(DEPTH); }
  private fade(g: Phaser.GameObjects.Graphics, ms: number, extra?: Partial<Phaser.Types.Tweens.TweenBuilderConfig>) {
    this.scene.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => g.destroy(), ...extra });
  }
  // elipse isométrica para um raio em tiles
  private ellipse(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill = false) {
    const w = r * TILE_W * Math.SQRT2, h = r * TILE_H * Math.SQRT2;
    if (fill) g.fillEllipse(x, y, w, h); else g.strokeEllipse(x, y, w, h);
  }
  private grow(g: Phaser.GameObjects.Graphics, ms: number, from = 0.3) {
    g.setScale(from);
    this.scene.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: ms, ease: 'Cubic.easeOut' });
  }

  onEvent(ev: GameEvent) {
    if (ev.type === 'dash') this.dash(ev.fromX, ev.fromY, ev.toX, ev.toY);
    else if (ev.type === 'skillCast') this.cast(ev);
  }

  private cast(ev: Extract<GameEvent, { type: 'skillCast' }>) {
    const d = DEFS[ev.skillId];
    if (!d) return;
    const color = Phaser.Display.Color.HexStringToColor(d.color).color;
    const t = tileToScreen(ev.tx, ev.ty), c = tileToScreen(ev.x, ev.y);
    const radius = d.radius ?? 0;
    switch (d.fx) {
      case 'slash2': this.slash(t.x, t.y - 20, 0xffe14a, -0.7); this.scene.time.delayedCall(90, () => this.slash(t.x, t.y - 20, 0xffe14a, 0.7)); break;
      case 'heavy': this.slash(t.x, t.y - 20, 0xff4a3a, -0.4, 52, 8); break;
      case 'dash': break; // o rastro vem do evento dash
      case 'storm': {
        const g = this.gfx(); g.lineStyle(5, color, 0.9); this.ellipse(g, 0, 0, radius); g.lineStyle(3, 0xffffff, 0.7); this.ellipse(g, 0, 0, radius * 0.7);
        g.setPosition(c.x, c.y); this.grow(g, 220, 0.2); this.fade(g, 420);
        break;
      }
      case 'orb': case 'lotus': this.orb(c.x, c.y - 22, t.x, t.y - 20, d.fx === 'lotus' ? 0x9ee8ff : color, d.fx === 'lotus'); break;
      case 'rain': {
        const g = this.gfx(); g.setPosition(t.x, t.y);
        g.fillStyle(color, 0.18); this.ellipse(g, 0, 0, radius, true);
        g.lineStyle(3, color, 0.9); this.ellipse(g, 0, 0, radius, false);
        this.fade(g, 700);
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius * 0.5;
          const x = t.x + Math.cos(a) * r * TILE_W * 0.7, y = t.y + Math.sin(a) * r * TILE_H * 0.7;
          const l = this.gfx(); l.lineStyle(2, 0xcfd8ff, 0.9); l.lineBetween(x, y - 70, x, y - 56);
          l.setAlpha(0);
          this.scene.tweens.add({ targets: l, alpha: 1, y: 56, duration: 260, delay: i * 35, onComplete: () => { l.destroy(); const s = this.gfx(); s.lineStyle(2, color, 0.9); s.strokeEllipse(x, y, 14, 7); this.fade(s, 220); } });
        }
        break;
      }
      case 'bubble': {
        const g = this.gfx(); g.setPosition(c.x, c.y - 18); g.lineStyle(3, 0xd8e8f8, 0.9); g.fillStyle(0xaad0ff, 0.25);
        g.fillCircle(0, 0, 30); g.strokeCircle(0, 0, 30); this.grow(g, 250, 0.4); this.fade(g, 500, { delay: 150 });
        break;
      }
      default: break;
    }
  }

  private slash(x: number, y: number, color: number, tilt: number, len = 40, width = 5) {
    const g = this.gfx(); g.setPosition(x, y); g.setRotation(tilt);
    g.lineStyle(width, color, 1); g.beginPath(); g.arc(0, 0, len, -1.1, 1.1); g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9); g.beginPath(); g.arc(0, 0, len - 6, -0.9, 0.9); g.strokePath();
    this.fade(g, 220);
  }

  private orb(x1: number, y1: number, x2: number, y2: number, color: number, lotus: boolean) {
    const g = this.gfx(); g.fillStyle(color, 0.35); g.fillCircle(0, 0, 13); g.fillStyle(color, 1); g.fillCircle(0, 0, 7); g.fillStyle(0xffffff, 0.9); g.fillCircle(-2, -2, 3);
    g.setPosition(x1, y1);
    this.scene.tweens.add({
      targets: g, x: x2, y: y2, duration: 180, onComplete: () => {
        g.destroy();
        const b = this.gfx(); b.setPosition(x2, y2 + 20);
        if (lotus) {
          b.lineStyle(2, 0xe8fbff, 1); b.fillStyle(0x7fd0f0, 0.45);
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.fillEllipse(Math.cos(a) * 14, Math.sin(a) * 7, 16, 8); }
          b.lineStyle(3, 0x9ee8ff, 0.9); b.strokeEllipse(0, 0, 70, 35);
          this.grow(b, 200, 0.3); this.fade(b, 600, { delay: 100 });
        } else { b.lineStyle(3, color, 1); b.strokeEllipse(0, 0, 36, 18); this.grow(b, 150, 0.4); this.fade(b, 250); }
      },
    });
  }

  private dash(fx: number, fy: number, tx: number, ty: number) {
    const a = tileToScreen(fx, fy), b = tileToScreen(tx, ty);
    for (let i = 0; i < 6; i++) {
      const k = i / 5, g = this.gfx();
      g.fillStyle(0x8a6ad0, 0.55); g.fillEllipse(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - 16, 22, 34);
      this.fade(g, 320 + i * 20);
    }
  }
}
