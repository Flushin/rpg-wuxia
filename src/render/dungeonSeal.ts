import Phaser from 'phaser';
import { tileToScreen } from '../core/iso';
import type { Seal } from '../core/world/seal';
import { TEXT_RES } from './display';

/**
 * Desenho do selo da arena do chefe (src/core/world/seal.ts): dois pilares de pedra nas pontas da passagem e uma
 * cortina de qi dourada com talismãs entre eles, mais o contador de inimigos restantes. Ao romper, a cortina e os
 * talismãs somem num clarão e os pilares ficam apagados.
 */
const HEIGHT = 74; // altura da cortina (px de tela)
const GOLD = 0xffd36a,
  JADE = 0x7fe8c8;

export class SealView {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private curtain: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private posts: Phaser.GameObjects.Graphics;
  private opened = false;
  private shown = -1;

  constructor(
    private scene: Phaser.Scene,
    seal: Seal,
  ) {
    // linha da cortina: meio da faixa de tiles da passagem, ao longo do eixo mais comprido
    const alongX = seal.w >= seal.h;
    const a = alongX ? tileToScreen(seal.x, seal.y + seal.h / 2) : tileToScreen(seal.x + seal.w / 2, seal.y);
    const b = alongX
      ? tileToScreen(seal.x + seal.w, seal.y + seal.h / 2)
      : tileToScreen(seal.x + seal.w / 2, seal.y + seal.h);
    const depth = seal.x + seal.w / 2 + seal.y + seal.h / 2 + 0.4;

    // pilares (caixas isométricas simples) nas duas pontas
    const posts = scene.add.graphics().setDepth(depth + 0.6);
    for (const p of [a, b]) {
      const w = 9,
        h = HEIGHT + 14;
      posts.fillStyle(0x3b3a40).fillRect(p.x - w, p.y - h, w, h);
      posts.fillStyle(0x56545c).fillRect(p.x, p.y - h, w, h);
      posts.fillStyle(0x77747e).fillPoints(
        [
          { x: p.x - w, y: p.y - h },
          { x: p.x, y: p.y - h - 5 },
          { x: p.x + w, y: p.y - h },
          { x: p.x, y: p.y - h + 5 },
        ],
        true,
      );
      posts.fillStyle(0xd94a3a).fillRect(p.x - 3, p.y - h + 14, 6, 18); // faixa vermelha com o selo
      posts.fillStyle(GOLD).fillCircle(p.x, p.y - h + 23, 2.2);
    }
    this.posts = posts;

    // cortina de qi: faixas verticais translúcidas entre os pilares
    const c = scene.add.container(0, 0).setDepth(depth);
    const g = scene.add.graphics();
    const steps = 14;
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps,
        t1 = (k + 1) / steps;
      const x0 = a.x + (b.x - a.x) * t0,
        y0 = a.y + (b.y - a.y) * t0,
        x1 = a.x + (b.x - a.x) * t1,
        y1 = a.y + (b.y - a.y) * t1;
      g.fillStyle(k % 2 ? GOLD : JADE, k % 2 ? 0.34 : 0.26);
      g.fillPoints(
        [
          { x: x0, y: y0 },
          { x: x1, y: y1 },
          { x: x1, y: y1 - HEIGHT },
          { x: x0, y: y0 - HEIGHT },
        ],
        true,
      );
    }
    g.lineStyle(2, GOLD, 0.9);
    g.lineBetween(a.x, a.y - HEIGHT, b.x, b.y - HEIGHT);
    g.lineBetween(a.x, a.y - 2, b.x, b.y - 2);
    c.add(g);
    // talismãs pendurados na linha de cima
    const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 26));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n,
        x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t - HEIGHT + 4;
      const tg = scene.add.graphics({ x, y });
      tg.fillStyle(0xf1d27a).fillRect(-5, 0, 10, 26);
      tg.lineStyle(1.5, 0xc0281e).strokeRect(-3.5, 2, 7, 22);
      tg.lineBetween(0, 5, 0, 21);
      tg.lineBetween(-2.5, 10, 2.5, 10);
      tg.lineBetween(-2.5, 15, 2.5, 15);
      c.add(tg);
      scene.tweens.add({ targets: tg, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 900 + k * 130 });
    }
    scene.tweens.add({ targets: g, alpha: 0.55, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    this.curtain = c;

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.label = scene.add
      .text(mid.x, mid.y - HEIGHT - 26, '', {
        fontFamily: 'serif',
        fontSize: '15px',
        color: '#ffe9a8',
        stroke: '#2a1408',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES)
      .setDepth(depth + 1);
    this.objs.push(posts, c, this.label);
    this.sync(seal);
  }

  sync(seal: Seal) {
    if (this.opened) return;
    if (seal.open) return this.breakOpen();
    if (seal.left !== this.shown) {
      this.shown = seal.left;
      this.label.setText(`封  ${seal.left}`);
    }
  }

  private breakOpen() {
    this.opened = true;
    const s = this.scene;
    s.tweens.killTweensOf(this.curtain.list);
    s.tweens.add({
      targets: [this.curtain, this.label],
      alpha: 0,
      scaleY: 1.15,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.curtain.setVisible(false);
        this.label.setVisible(false);
      },
    });
    s.tweens.add({ targets: this.posts, alpha: 0.75, duration: 700 });
  }

  destroy() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }
}
