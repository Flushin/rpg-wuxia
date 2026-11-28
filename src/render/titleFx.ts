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
  private wings: Phaser.GameObjects.Image[];
  private half: number;

  constructor(
    private scene: Phaser.Scene,
    title: string,
  ) {
    const s = title;
    wingTexture(scene);
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
    this.wings = [-1, 1].map((side) =>
      scene.add
        .image(0, 0, WING)
        .setOrigin(1, 0.8)
        .setFlipX(side > 0)
        .setDepth(DEPTH.NAME),
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
    // bater de asa: abre e fecha (escala vertical + giro), com uma parada curta embaixo
    const f = Math.sin(t * 7);
    const flap = f > 0 ? f : f * 0.4;
    this.wings.forEach((wg, i) => {
      const side = i ? 1 : -1;
      wg.setOrigin(side > 0 ? 0 : 1, 0.8)
        .setPosition(x + side * (this.half + 1), y - 4)
        .setScale(0.6, 0.6 * (0.85 + 0.25 * flap))
        .setRotation(-side * 0.25 * flap)
        .setVisible(visible);
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
/** Asinha dourada (aponta para a esquerda; o ponto de apoio fica à direita), desenhada uma vez em 2x. */
function wingTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(WING)) return;
  const g = scene.make.graphics({}, false);
  // penas em leque subindo para fora: [ponta x, ponta y, meia-largura na base]; base em (34, 13..22)
  const feathers: [number, number, number, number][] = [
    [8, 1, 8, 18],
    [2, 9, 12, 21],
    [7, 18, 16, 23],
  ];
  const cols = [0xfff2c0, 0xf5c46b, 0xd99a35];
  feathers.forEach(([px, py, y0, y1]) => {
    g.fillStyle(0x2a1600, 1).fillTriangle(35, y0 - 2, 35, y1 + 2, px - 2, py);
  });
  feathers.forEach(([px, py, y0, y1], i) => {
    g.fillStyle(cols[i], 1).fillTriangle(34, y0, 34, y1, px, py);
  });
  g.generateTexture(WING, 36, 26);
  g.destroy();
}
