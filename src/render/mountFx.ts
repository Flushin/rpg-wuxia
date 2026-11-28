/** Brilho das montarias de Fundador (mounts.json "fx"): faíscas subindo do corpo e, andando, um rastro curto que fica
 *  para trás. Leve para o celular: um emissor só, no máximo ~14 partículas vivas. */
import Phaser from 'phaser';

export class MountFx {
  private em: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, colors: string[]) {
    const tint = colors.map((c) => Phaser.Display.Color.HexStringToColor(c).color);
    this.em = scene.add.particles(0, 0, 'fx-dot', {
      x: { min: -22, max: 22 },
      y: { min: -38, max: -8 },
      speedY: { min: -18, max: -6 },
      speedX: { min: -4, max: 4 },
      lifespan: { min: 700, max: 1200 },
      scale: { start: 0.38, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint,
      blendMode: 'ADD',
      frequency: 160,
      maxAliveParticles: 14,
    });
  }

  /** (x, y) = pés da montaria na tela; andando, solta mais faíscas (que ficam para trás como rastro). */
  update(x: number, y: number, depth: number, moving: boolean, visible: boolean) {
    this.em
      .setPosition(x, y)
      .setDepth(depth + 0.002)
      .setVisible(visible);
    this.em.frequency = moving ? 45 : 160;
    this.em.emitting = visible;
  }

  destroy() {
    this.em.destroy();
  }
}
