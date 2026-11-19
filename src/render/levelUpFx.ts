import Phaser from 'phaser';
import { TILE_H, TILE_W } from '../core/iso';
import { DEPTH } from './depth';
import type { EntityView } from './entityView';

// Subida de nível: só visual. O personagem faz a pose (EntityView.levelUp) e é envolvido por luz dourada:
// clarão no corpo, coluna de luz subindo, anel abrindo no chão e faíscas subindo. Tudo segue o personagem.
// Níveis marco (múltiplos de 10): a mesma animação, maior, mais intensa, mais longa e com um tremor leve de câmera.
export const LEVELUP_MS = 1200;
export const LEVELUP_MILESTONE_MS = 1800;
export const isMilestoneLevel = (level: number) => level % 10 === 0;

/** Medidas da versão normal e da versão marco. */
const LOOK = {
  normal: {
    ms: LEVELUP_MS,
    glow: 1,
    beamW: 1.6,
    beamH: 2.4,
    beamA: 0.7,
    ring: 1.5,
    ringW: 3,
    sparkScale: 0.5,
    sparkFreq: 35,
    sparkSpeed: 120,
  },
  milestone: {
    ms: LEVELUP_MILESTONE_MS,
    glow: 1.2,
    beamW: 2.3,
    beamH: 3.4,
    beamA: 0.9,
    ring: 2.2,
    ringW: 4,
    sparkScale: 0.7,
    sparkFreq: 22,
    sparkSpeed: 160,
  },
};
const GOLD = 0xffe07a;
const GOLD_LIGHT = 0xfff4c8;
const SPARKS = [0xfff8e0, 0xffe07a, 0xffc040];

export class LevelUpFx {
  constructor(private scene: Phaser.Scene) {}

  play(view: EntityView, level: number) {
    const k = isMilestoneLevel(level) ? LOOK.milestone : LOOK.normal;
    const ms = k.ms;
    view.levelUp(ms, GOLD_LIGHT, k.glow);
    const h = Math.max(48, view.height);

    // coluna de luz atrás do corpo (a pose fica à vista): cresce do chão para o alto, segura e se apaga afinando
    const beam = this.scene.add
      .image(0, 0, 'fx-beam')
      .setOrigin(0.5, 1)
      .setTint(GOLD)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(k.beamA)
      .setScale(k.beamW, 0);
    const beamH = (h * k.beamH) / 128;
    this.scene.tweens.chain({
      targets: beam,
      tweens: [
        { scaleY: beamH, duration: ms * 0.22, ease: 'Cubic.easeOut' },
        { scaleX: k.beamW * 0.8, duration: ms * 0.38, ease: 'Sine.easeInOut' },
        { alpha: 0, scaleX: k.beamW * 0.25, duration: ms * 0.4, ease: 'Quad.easeIn' },
      ],
    });

    // anel no chão (elipse isométrica) abrindo e sumindo
    const ring = this.scene.add
      .graphics()
      .setDepth(DEPTH.TELEGRAPH + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const rw = TILE_W * 0.9,
      rh = TILE_H * 0.9;
    ring.lineStyle(k.ringW, GOLD, 1).strokeEllipse(0, 0, rw, rh);
    ring.lineStyle(k.ringW * 2.7, GOLD, 0.25).strokeEllipse(0, 0, rw, rh);
    ring.setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: k.ring, alpha: 0, duration: ms * 0.7, ease: 'Cubic.easeOut' });

    // faíscas subindo em volta do corpo
    const sparks = this.scene.add
      .particles(0, 0, 'fx-dot', {
        x: { min: -16 * k.glow, max: 16 * k.glow },
        y: { min: -h * 0.6, max: 0 },
        speedY: { min: -k.sparkSpeed, max: -50 },
        speedX: { min: -18, max: 18 },
        scale: { start: k.sparkScale, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: SPARKS,
        lifespan: { min: 600, max: 900 },
        frequency: k.sparkFreq,
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.SKILL_FX + 1);
    this.scene.time.delayedCall(ms * 0.55, () => sparks.stop());

    // marco: tremor curto e fraco quando a coluna chega ao alto
    if (k === LOOK.milestone) this.scene.time.delayedCall(ms * 0.2, () => this.scene.cameras.main.shake(260, 0.004));

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
