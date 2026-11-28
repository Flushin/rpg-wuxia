/** Brilho das montarias de Fundador (mounts.json "fx"): halo pulsando no chão, faíscas subindo do corpo, estrelinhas
 *  que piscam e, andando, um rastro que fica para trás. Leve para o celular: 2 emissores (~26 partículas vivas). */
import Phaser from 'phaser';

export class MountFx {
  private halo: Phaser.GameObjects.Image;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private stars: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private scene: Phaser.Scene,
    colors: string[],
  ) {
    const tint = colors.map((c) => Phaser.Display.Color.HexStringToColor(c).color);
    this.halo = scene.add.image(0, 0, 'fx-dot').setTint(tint[0]).setBlendMode('ADD').setScale(5.5, 2.2);
    this.sparks = scene.add.particles(0, 0, 'fx-dot', {
      x: { min: -26, max: 26 },
      y: { min: -44, max: -6 },
      speedY: { min: -26, max: -8 },
      speedX: { min: -6, max: 6 },
      lifespan: { min: 800, max: 1400 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      blendMode: 'ADD',
      frequency: 90,
      maxAliveParticles: 18,
    });
    // estrelinhas: aparecem e somem no lugar (piscar), em volta do corpo
    this.stars = scene.add.particles(0, 0, 'fx-dot', {
      x: { min: -30, max: 30 },
      y: { min: -50, max: -4 },
      lifespan: 600,
      alpha: { values: [0, 1, 0] },
      scaleX: { values: [0.1, 0.5, 0.1] },
      scaleY: { values: [0.1, 0.5, 0.1] },
      tint: 0xffffff,
      blendMode: 'ADD',
      frequency: 220,
      maxAliveParticles: 8,
    });
  }

  /** (x, y) = pés da montaria na tela; andando, solta mais faíscas (que ficam para trás como rastro). */
  update(x: number, y: number, depth: number, moving: boolean, visible: boolean) {
    const t = this.scene.time.now / 1000;
    this.halo
      .setPosition(x, y - 2)
      .setDepth(depth - 0.002)
      .setAlpha(0.3 + 0.25 * Math.sin(t * 3))
      .setVisible(visible);
    this.sparks
      .setPosition(x, y)
      .setDepth(depth + 0.002)
      .setVisible(visible);
    this.sparks.frequency = moving ? 28 : 90;
    this.sparks.emitting = visible;
    this.stars
      .setPosition(x, y)
      .setDepth(depth + 0.003)
      .setVisible(visible);
    this.stars.emitting = visible;
  }

  destroy() {
    this.halo.destroy();
    this.sparks.destroy();
    this.stars.destroy();
  }
}
