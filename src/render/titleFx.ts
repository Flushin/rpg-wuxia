/** Título exclusivo (ex.: «Discípulo Fundador») acima do nome: texto em degradê dourado, halo que pulsa devagar e
 *  poucas faíscas subindo (no máximo ~6 vivas). Leve para o celular: os textos são desenhados uma vez; por quadro só
 *  mudam posição e transparência. */
import Phaser from 'phaser';
import { DPR } from './display';
import { DEPTH } from './depth';
import type { TitleWing } from '../core/arena';

export class TitleFx {
  private text: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Text;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private wings: Phaser.GameObjects.Image[][]; // por lado: [brilho, asa, estrelinhas]
  private half: number;

  constructor(
    private scene: Phaser.Scene,
    title: string,
    wing: TitleWing,
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
    // asa esquerda e direita (espelhada); ponto de giro no ombro: (34,30) num viewBox -16 -8 54 62
    this.wings = [-1, 1].map((side) =>
      ['-halo', '', '-stars'].map((k) =>
        scene.add
          .image(0, 0, `${WING}-${wing}${k}`)
          .setOrigin(side > 0 ? 1 - 50 / 54 : 50 / 54, 38 / 62)
          .setFlipX(side > 0)
          .setScale(WING_SCALE)
          .setDepth(DEPTH.NAME),
      ),
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
    // bater suave (desce um pouco e volta), brilho e estrelinhas pulsando
    const flap = Math.sin(t * 2 * Math.PI) * 0.5 + 0.5;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.9);
    this.wings.forEach((layers, i) => {
      const side = i ? 1 : -1;
      const rot = Phaser.Math.DegToRad(4 - 11 * flap) * -side;
      layers.forEach((im, j) =>
        im
          .setPosition(x + side * (this.half + WING_GAP), y - 3)
          .setRotation(rot)
          .setAlpha(j === 1 ? 1 : 0.45 + 0.55 * (j === 0 ? pulse : 1 - pulse))
          .setVisible(visible),
      );
    });
    this.sparks.emitting = visible;
  }

  destroy() {
    this.text.destroy();
    this.glow.destroy();
    this.sparks.destroy();
    this.wings.flat().forEach((im) => im.destroy());
  }
}

const WING = 'title-wing';
const WING_SCALE = 0.15; // 216 px do SVG -> ~32 px na tela
const WING_GAP = 5; // espaço (px) entre o texto e o ombro da asa
