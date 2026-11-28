/** Título exclusivo (ex.: «Discípulo Fundador») acima do nome: texto em degradê dourado, halo que pulsa devagar e
 *  poucas faíscas subindo (no máximo ~6 vivas). Leve para o celular: os textos são desenhados uma vez; por quadro só
 *  mudam posição e transparência. */
import Phaser from 'phaser';
import { DPR } from './display';
import { DEPTH } from './depth';
import { ARENA_TITLES } from '../core/arena';

/** O título (nome já traduzido) é exclusivo? Então ganha o visual especial. */
export const isExclusiveTitle = (name?: string) =>
  !!name && Object.values(ARENA_TITLES).some((t) => t.exclusive && t.name === name);

export class TitleFx {
  private text: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Text;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private wings: Phaser.GameObjects.Sprite[];
  private half: number;

  constructor(
    private scene: Phaser.Scene,
    title: string,
  ) {
    const s = title;
    const style = { fontSize: '12px', fontStyle: 'bold', align: 'center', resolution: DPR * 2 };
    this.glow = scene.add
      .text(0, 0, s, { ...style, color: '#ffd76a', stroke: '#ffcf4a', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setShadow(0, 0, '#ffc23a', 8, true, true)
      .setDepth(DEPTH.NAME - 1);
    this.text = scene.add
      .text(0, 0, s, { ...style, stroke: '#2a1600', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.NAME);
    const g = this.text.context.createLinearGradient(0, 0, 0, this.text.height);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.5, '#f5c46b');
    g.addColorStop(1, '#c8892a');
    this.text.setFill(g);
    const half = (this.half = this.text.width / 2);
    // asinhas nas pontas (a da direita espelhada), batendo devagar
    if (!scene.anims.exists(WING) && scene.textures.exists(WING))
      scene.anims.create({ key: WING, frames: scene.anims.generateFrameNumbers(WING), frameRate: 10, repeat: -1 });
    this.wings = [-1, 1].map((side) =>
      scene.add
        .sprite(0, 0, WING, 0)
        .setOrigin(side > 0 ? 0.17 : 0.83, 0.86) // ponto da base da asa no quadro
        .setFlipX(side > 0)
        .setScale(0.3)
        .setDepth(DEPTH.NAME)
        .play(WING),
    );
    this.sparks = scene.add
      .particles(0, 0, 'fx-dot', {
        x: { min: -half, max: half },
        y: { min: -12, max: -2 },
        speedY: { min: -14, max: -6 },
        speedX: { min: -3, max: 3 },
        lifespan: 1300,
        scale: { start: 0.32, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffe08a, 0xfff2c0, 0xf5c46b],
        blendMode: 'ADD',
        frequency: 240,
        maxAliveParticles: 6,
      })
      .setDepth(DEPTH.NAME + 1);
  }

  /** (x, y) = base do título (logo acima do nome). */
  update(x: number, y: number, visible: boolean) {
    const t = this.scene.time.now / 1000;
    this.text.setPosition(x, y).setVisible(visible);
    this.glow
      .setPosition(x, y)
      .setVisible(visible)
      .setAlpha(0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4)));
    this.sparks.setPosition(x, y).setVisible(visible);
    this.wings.forEach((wg, i) => {
      const side = i ? 1 : -1;
      wg.setPosition(x + side * (this.half + 1), y - 1).setVisible(visible);
    });
    this.sparks.emitting = visible;
  }

  destroy() {
    this.text.destroy();
    this.glow.destroy();
    this.sparks.destroy();
    this.wings.forEach((wg) => wg.destroy());
  }
}

const WING = 'title-wing';
