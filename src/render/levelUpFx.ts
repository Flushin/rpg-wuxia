import Phaser from 'phaser';
import { L } from '../core/i18n';
import { TILE_H, TILE_W } from '../core/iso';
import { LEVELUP_POSE_S } from '../core/data';
import { audio } from './audio';
import { DEPTH } from './depth';
import { TEXT_RES } from './display';
import type { EntityView } from './entityView';

// Subida de nível: só visual. O personagem faz a pose (EntityView.levelUp) e é envolvido por luz dourada:
// clarão no corpo, coluna de luz subindo, anel abrindo no chão e faíscas subindo. Tudo segue o personagem.
// Níveis marco (múltiplos de 10): a mesma animação, maior, mais intensa, mais longa e com um tremor leve de câmera.
// Vários níveis de uma vez: uma animação por nível, em fila; só a primeira tem a pose.
// O jogador escolhe a hora de subir (XP guardada), então a animação é longa (3× a original) para prints e vídeos.
export const LEVELUP_MS = 3600;
export const LEVELUP_MILESTONE_MS = 5400;
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
    font: 15,
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
    font: 19,
  },
};
const GOLD = 0xffe07a;
const GOLD_LIGHT = 0xfff4c8;
const SPARKS = [0xfff8e0, 0xffe07a, 0xffc040];

export class LevelUpFx {
  private queue: number[] = [];
  private next?: Phaser.Time.TimerEvent; // fim da animação que está tocando

  constructor(
    private scene: Phaser.Scene,
    private playerView: () => EntityView | undefined,
  ) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.queue = [];
      this.next = undefined;
    });
  }

  /** Um nível subiu. pose = primeira do lote: começa já, com a pose. As outras esperam a vez e tocam só a luz. */
  request(level: number, pose: boolean) {
    if (pose) {
      this.next?.remove();
      this.start(level, true);
    } else if (this.next) this.queue.push(level);
    else this.start(level, false);
  }

  private start(level: number, pose: boolean) {
    const view = this.playerView();
    const ms = view ? this.play(view, level, pose) : 0;
    this.next = this.scene.time.delayedCall(ms, () => {
      this.next = undefined;
      const l = this.queue.shift();
      if (l !== undefined) this.start(l, false);
    });
  }

  /** Toca uma animação; devolve a duração (ms) até a próxima da fila poder começar. */
  private play(view: EntityView, level: number, pose: boolean): number {
    const milestone = isMilestoneLevel(level);
    const k = milestone ? LOOK.milestone : LOOK.normal;
    const ms = k.ms;
    view.levelUp(ms, GOLD_LIGHT, k.glow, pose, LEVELUP_POSE_S * 1000);
    audio.levelUp(milestone);
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

    // "Nível 20!" subindo dourado acima da cabeça (maior no marco)
    const label = this.scene.add
      .text(0, 0, L(`Nível ${level}!`, `Level ${level}!`), {
        fontSize: `${k.font}px`,
        color: '#ffe07a',
        fontStyle: 'bold',
        stroke: '#3a2400',
        strokeThickness: 5,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.FLOAT_TEXT)
      .setScale(0.6)
      .setAlpha(0);
    const lift = { y: 0 };
    this.scene.tweens.add({ targets: label, alpha: 1, scale: 1, duration: ms * 0.15, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: lift, y: 26, duration: ms, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: label, alpha: 0, delay: ms * 0.7, duration: ms * 0.3, ease: 'Quad.easeIn' });

    // acompanha o personagem até o fim (troca de mapa destrói o personagem: o efeito some junto)
    const parts: Phaser.GameObjects.GameObject[] = [beam, ring, sparks, label];
    const follow = () => {
      if (!view.container.active) return done();
      const { x, y } = view.container;
      beam.setPosition(x, y + 6).setDepth(view.container.depth - 0.001);
      ring.setPosition(x, y);
      sparks.setPosition(x, y);
      label.setPosition(x, y - h - 18 - lift.y);
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
    return ms;
  }
}
