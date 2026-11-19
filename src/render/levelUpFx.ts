import Phaser from 'phaser';
import { TILE_H, TILE_W } from '../core/iso';
import { DEPTH } from './depth';
import type { EntityView } from './entityView';

// Subida de nível: só visual. O personagem faz a pose (EntityView.levelUp) e é envolvido por luz dourada:
// clarão no corpo, coluna de luz subindo, anel abrindo no chão e faíscas subindo. Tudo segue o personagem.
export const LEVELUP_MS = 1200;
const GOLD = 0xffe07a;
const GOLD_LIGHT = 0xfff4c8;
const SPARKS = [0xfff8e0, 0xffe07a, 0xffc040];

export class LevelUpFx {
  constructor(private scene: Phaser.Scene) {}

  play(view: EntityView) {
    const ms = LEVELUP_MS;
    view.levelUp(ms, GOLD_LIGHT);
    const h = Math.max(48, view.height);

    // coluna de luz atrás do corpo (a pose fica à vista): cresce do chão para o alto, segura e se apaga afinando
    const beam = this.scene.add
      .image(0, 0, 'fx-beam')
      .setOrigin(0.5, 1)
      .setTint(GOLD)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.7)
      .setScale(1.6, 0);
    const beamH = (h * 2.4) / 128;
    this.scene.tweens.chain({
      targets: beam,
      tweens: [
        { scaleY: beamH, duration: ms * 0.22, ease: 'Cubic.easeOut' },
        { scaleX: 1.3, duration: ms * 0.38, ease: 'Sine.easeInOut' },
        { alpha: 0, scaleX: 0.4, duration: ms * 0.4, ease: 'Quad.easeIn' },
      ],
    });

    // anel no chão (elipse isométrica) abrindo e sumindo
    const ring = this.scene.add
      .graphics()
      .setDepth(DEPTH.TELEGRAPH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const rw = TILE_W * 0.9,
      rh = TILE_H * 0.9;
    ring.lineStyle(3, GOLD, 1).strokeEllipse(0, 0, rw, rh);
    ring.lineStyle(8, GOLD, 0.25).strokeEllipse(0, 0, rw, rh);
    ring.setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: ms * 0.7, ease: 'Cubic.easeOut' });

    // faíscas subindo em volta do corpo
    const sparks = this.scene.add
      .particles(0, 0, 'fx-dot', {
        x: { min: -16, max: 16 },
        y: { min: -h * 0.6, max: 0 },
        speedY: { min: -120, max: -50 },
        speedX: { min: -18, max: 18 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: SPARKS,
        lifespan: { min: 600, max: 900 },
        frequency: 35,
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.SKILL_FX + 1);
    this.scene.time.delayedCall(ms * 0.55, () => sparks.stop());

    // acompanha o personagem até o fim (troca de mapa destrói o personagem: o efeito some junto)
    const parts: Phaser.GameObjects.GameObject[] = [beam, ring, sparks];
    const follow = () => {
      if (!view.container.active) return done();
      const { x, y } = view.container;
      beam.setPosition(x, y + 6).setDepth(view.container.depth - 0.001);
      ring.setPosition(x, y);
      sparks.setPosition(x, y);
    };
    const done = () => {
      this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, done);
      for (const p of parts) p.destroy();
    };
    follow();
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    this.scene.time.delayedCall(ms + 900, done); // + vida das últimas faíscas
  }
}
