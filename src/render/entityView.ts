import Phaser from 'phaser';
import { DPR } from './display';
import { tileToScreen } from '../core/iso';
import { MONSTERS } from '../core/data';
import { L, tn } from '../core/i18n';
import type { Entity } from '../core/types';
import { animKey, dirFromDelta, sheetFor, sheetTexture, type AnimName, type SheetMeta } from './sprites';
import { PLACEHOLDER } from './textures';
import { DEPTH } from './depth';
import { ElementAura } from './elementAura';

const DEATH_SHOW_MS = 1400; // monstro morto fica no chão antes de sumir
const MOVE_HOLD_MS = 120; // tempo sem andar até voltar à animação parada
const RIDE_Y = 27; // montado: altura (px) da sela acima do chão

const labelOf = (e: Entity) =>
  e.kind === 'monster'
    ? L(`Nv ${e.level} ${e.name}`, `Lv ${e.level} ${e.name}`)
    : e.kind === 'npc'
      ? tn(e.name)
      : e.name;

export class EntityView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  private ring: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  private lastSx = 0;
  private flashTimer?: Phaser.Time.TimerEvent;
  private flashing = false;
  private sc = 1;
  // sprites animados (marco 6)
  private sheet: { key: string; meta: SheetMeta } | null;
  private dir = 0;
  private anim: AnimName | '' = '';
  private lastX = 0;
  private lastY = 0;
  private attacking = false;
  private posing = false; // pose de subida de nível tocando
  private poseHold?: Phaser.Time.TimerEvent; // último quadro da pose parado até o fim do tempo da pose
  private glowSp?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; // brilho por cima do corpo
  private deadAt = 0;
  private movedAt = -1e9; // último instante em que se moveu (ms)
  private accX = 0; // deslocamento acumulado desde a última troca de direção
  private accY = 0;
  private top: number; // altura (px) do topo do personagem acima dos pés
  private label!: Phaser.GameObjects.Text;
  private labelY: number | null = null; // nome solto (fora do container), sempre por cima
  private mark?: Phaser.GameObjects.Text; // missão: "!" ou "?" sobre o NPC (marco 7)
  private markSig: string | null = null;
  private aura?: ElementAura; // aura elemental do jogador (independe da skin)
  private mountSp?: Phaser.GameObjects.Sprite; // montaria embaixo do jogador (só fora de combate)
  private mountKey: string | null = null;
  private mountAnim = '';

  constructor(
    private scene: Phaser.Scene,
    e: Entity,
    texture: string,
  ) {
    const shadow = scene.add.image(0, 0, 'shadow');
    this.sc = e.kind === 'monster' ? (MONSTERS[e.monsterId]?.scale ?? 1) : 1;
    const sheet = sheetFor(texture);
    // folha que não carregou (rede/arquivo): figura genérica em vez de travar
    this.sheet = sheet && scene.textures.exists(sheetTexture(sheet.key)) ? sheet : null;
    if (this.sheet) {
      const m = this.sheet.meta;
      const sp = scene.add
        .sprite(0, 0, 'sp-' + this.sheet.key, 'idle_0_0')
        .setOrigin(m.anchor[0], m.anchor[1])
        .setScale(m.scale * this.sc);
      sp.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.anim === 'attack') {
          this.attacking = false;
          this.anim = '';
        } else if (this.anim === 'levelup' && !this.poseHold) {
          this.posing = false;
          this.anim = '';
        }
      });
      this.sprite = sp;
      this.top = m.top * this.sc;
      this.dir = e.kind === 'monster' ? Phaser.Math.Between(0, 7) : (e.face ?? 0);
    } else {
      this.sprite = scene.add
        .image(0, 2, PLACEHOLDER)
        .setOrigin(0.5, e.kind === 'monster' ? 0.92 : 0.93)
        .setScale(this.sc);
      this.top = e.kind === 'monster' ? 40 * this.sc : 48;
    }
    this.lastX = e.x;
    this.lastY = e.y;
    shadow.setScale(this.sc);
    this.ring = scene.add.graphics();
    this.bar = scene.add.graphics();
    const color = e.kind === 'player' ? '#9fe8a0' : e.kind === 'monster' ? '#ff9a8a' : '#f0d070';
    const text = labelOf(e);
    const labelY = this.sheet ? -this.top - 4 : e.kind === 'monster' ? -36 * this.sc : -52;
    const label = scene.add
      .text(0, labelY, text, { fontSize: '12px', color, stroke: '#000', strokeThickness: 3, resolution: DPR * 2 })
      .setOrigin(0.5, 1);
    label.setName('label');
    this.label = label;
    // nome fora do container, sempre por cima (árvores, casas e o portão não cortam o nome) — NPCs, monstros e jogador
    this.labelY = labelY;
    label.setDepth(DEPTH.NAME);
    this.container = scene.add.container(0, 0, [this.ring, shadow, this.sprite, this.bar]);
    if (e.kind === 'player') this.aura = new ElementAura(scene, this.container, shadow, this.sprite, this.top);
    this.sync(e, false);
    this.lastSx = this.container.x;
  }

  sync(e: Entity, selected: boolean) {
    const s = tileToScreen(e.x, e.y);
    if (this.sheet) this.animate(e);
    else if (Math.abs(s.x - this.lastSx) > 0.2) this.sprite.setFlipX(s.x < this.lastSx);
    if (this.glowSp) this.glowSp.setFrame(this.sprite.frame.name).setFlipX(this.sprite.flipX);
    this.lastSx = s.x;
    this.container.setPosition(s.x, s.y);
    // setDepth sempre manda o Phaser reordenar a cena inteira (~1.500 objetos), mesmo com o mesmo valor
    if (this.container.depth !== e.x + e.y) this.container.setDepth(e.x + e.y);
    if (this.labelY !== null) this.label.setPosition(s.x, s.y + this.labelY);
    if (this.mark)
      this.mark.setPosition(s.x, s.y + (this.labelY ?? -50) - 16 + Math.sin(this.scene.time.now / 260) * 3);
    const deathShown = this.sheet && e.dead && this.scene.time.now - this.deadAt < DEATH_SHOW_MS;
    this.container.setVisible(!(e.dead && e.kind === 'monster') || !!deathShown);
    this.sprite.setAlpha(e.dead && !this.sheet ? 0.35 : 1);
    if (this.aura && e.element)
      this.aura.update(e.element, e.elemAtk[e.element], this.scene.game.loop.delta, this.container.visible && !e.dead);
    if (e.dead && this.sheet) {
      this.ring.clear();
      this.bar.clear();
      this.label.setVisible(false);
      return;
    }
    this.label.setVisible(this.container.visible);
    this.label.setText(labelOf(e));
    this.ring.clear();
    this.bar.clear();
    // buffs/debuffs: lentidão = tom azul + losango; defesa reduzida = seta vermelha; escudo = bolha;
    // chefe em fúria = tom vermelho
    const slow = e.buffs.some((b) => b.kind === 'slow'),
      broken = e.buffs.some((b) => b.kind === 'defReduction'),
      shield = e.buffs.some((b) => b.kind === 'shield' && b.value > 0);
    if (!this.flashing) {
      if (slow) this.sprite.setTint(0x8fc8ff);
      else if (e.enraged) this.sprite.setTint(0xff7a6a);
      else this.sprite.clearTint();
    }
    let ix = -18;
    if (slow) {
      this.bar.fillStyle(0x7fd0f0, 1);
      this.bar.fillPoints(
        [
          { x: ix, y: -46 },
          { x: ix + 6, y: -40 },
          { x: ix, y: -34 },
          { x: ix - 6, y: -40 },
        ],
        true,
      );
      ix += 14;
    }
    if (broken) {
      this.bar.fillStyle(0xe03030, 1);
      this.bar.fillPoints(
        [
          { x: ix - 6, y: -45 },
          { x: ix + 6, y: -45 },
          { x: ix, y: -34 },
        ],
        true,
      );
    }
    if (shield) {
      this.bar.lineStyle(3, 0xd8e8f8, 0.9);
      this.bar.fillStyle(0xaad0ff, 0.22);
      this.bar.fillCircle(0, -20, 30);
      this.bar.strokeCircle(0, -20, 30);
    }
    if (selected && e.kind === 'monster') {
      this.ring.lineStyle(2, 0xff5050, 1);
      this.ring.strokeEllipse(0, 0, 36, 18);
      const w = 40 * Math.min(2, this.sc),
        top = this.sheet ? -this.top - 22 : -52 * this.sc;
      this.bar.fillStyle(0x000000, 0.8);
      this.bar.fillRect(-w / 2 - 1, top - 1, w + 2, 6);
      this.bar.fillStyle(0xc0392b, 1);
      this.bar.fillRect(-w / 2, top, w * Math.max(0, e.hp / e.derived.maxHp), 4);
    }
  }

  /** Escolhe a animação: morte > ataque em andamento > andar > parado.
   *  O mundo anda em passos fixos de 1/60 s: em telas de 120/144 Hz há quadros sem movimento,
   *  então "parado" só vale depois de MOVE_HOLD_MS sem andar (senão pisca entre andar e parado). */
  private animate(e: Entity) {
    const now = this.scene.time.now;
    const dx = e.x - this.lastX,
      dy = e.y - this.lastY;
    this.lastX = e.x;
    this.lastY = e.y;
    if (e.dead) {
      if (this.anim !== 'death') {
        this.deadAt = now;
        this.attacking = false;
        this.play('death');
      }
      return;
    }
    if (this.anim === 'death') this.anim = ''; // renasceu
    if (this.posing) return; // pose de subida de nível: o mundo deixa o jogador parado até ela acabar
    const step = Math.hypot(dx, dy);
    if (step > 1.5) {
      this.accX = this.accY = 0;
    } // teleporte/troca de mapa: não conta como andar
    else if (step > 0.0005) {
      this.movedAt = now;
      this.accX += dx;
      this.accY += dy;
      // direção só muda após um trecho mínimo: evita tremer entre direções vizinhas
      if (Math.hypot(this.accX, this.accY) > 0.12) {
        this.dir = dirFromDelta(this.accX, this.accY);
        this.accX = this.accY = 0;
      }
    }
    const moving = now - this.movedAt < MOVE_HOLD_MS;
    if (moving) {
      if (!this.attacking || !e.attackWhileMoving) {
        this.attacking = false;
        this.play(this.mountSp ? 'idle' : 'walk'); // montado, quem anda é a montaria
      }
      return;
    }
    if (this.attacking) return;
    this.play('idle');
  }

  private play(anim: AnimName, restart = false) {
    if (!this.sheet) return;
    const sp = this.sprite as Phaser.GameObjects.Sprite;
    const key = animKey(this.sheet.key, anim, this.dir);
    if (!restart && sp.anims.currentAnim?.key === key && sp.anims.isPlaying) {
      this.anim = anim;
      return;
    }
    // trocar só a direção do andar/parado mantém o passo (não volta ao quadro 0)
    const progress =
      !restart && this.anim === anim && anim !== 'attack' && anim !== 'death' ? sp.anims.getProgress() : 0;
    sp.play(key);
    if (progress > 0) sp.anims.setProgress(progress);
    this.anim = anim;
  }

  /**
   * Montaria (sheet de sheetFor('mount-' + id)) ou null = a pé. Montado, o cavaleiro sobe RIDE_Y px e fica na
   * pose parada; a montaria anda/para na mesma direção. Folha não carregada: fica a pé.
   */
  setMount(key: string | null) {
    if (key && !this.scene.textures.exists(sheetTexture(key))) key = null;
    if (key === this.mountKey) {
      if (key) this.animateMount();
      return;
    }
    this.mountKey = key;
    this.mountSp?.destroy();
    this.mountSp = undefined;
    this.mountAnim = '';
    this.anim = '';
    if (key) {
      const meta = sheetFor('mount-' + key)?.meta;
      if (!meta) return ((this.mountKey = null), undefined);
      this.mountSp = this.scene.add
        .sprite(0, 0, 'sp-' + key, 'idle_0_0')
        .setOrigin(meta.anchor[0], meta.anchor[1])
        .setScale(meta.scale);
      this.container.addAt(this.mountSp, this.container.getIndex(this.sprite));
      this.animateMount();
    }
    const dy = key ? -RIDE_Y : 0;
    this.sprite.y = dy;
    if (this.glowSp) this.glowSp.y = dy;
    this.aura?.setLift(dy);
  }

  private animateMount() {
    if (!this.mountSp || !this.mountKey) return;
    const moving = this.scene.time.now - this.movedAt < MOVE_HOLD_MS;
    const key = animKey(this.mountKey, moving ? 'walk' : 'idle', this.dir);
    if (key !== this.mountAnim) {
      const progress =
        this.mountAnim && moving === this.mountAnim.startsWith('walk') ? this.mountSp.anims.getProgress() : 0;
      this.mountSp.play(key);
      if (progress > 0) this.mountSp.anims.setProgress(progress);
      this.mountAnim = key;
    }
  }

  /** Altura (px) do topo do personagem acima dos pés. */
  get height() {
    return this.top;
  }

  /** Em combate, parado: olha para o alvo (x, y em tiles). */
  face(x: number, y: number, fromX: number, fromY: number) {
    if (!this.sheet || this.attacking || this.posing || this.anim === 'walk' || this.anim === 'death') return;
    if (Math.hypot(x - fromX, y - fromY) > 0.05) this.dir = dirFromDelta(x - fromX, y - fromY);
  }

  /** Golpe (ataque básico ou skill): vira para o alvo e toca o ataque uma vez. */
  attack(towardX: number, towardY: number, fromX: number, fromY: number) {
    if (!this.sheet || this.anim === 'death') return;
    if (Math.hypot(towardX - fromX, towardY - fromY) > 0.01) this.dir = dirFromDelta(towardX - fromX, towardY - fromY);
    this.posing = false;
    this.attacking = true;
    this.play('attack', true);
  }

  /** Levita (ultimate): o corpo sobe `px`, flutua balançando e desce no fim de `ms`; a sombra fica no chão. */
  levitate(ms: number, px = 26) {
    const st = { h: 0 },
      base = this.sprite.y;
    const apply = () => {
      const y = base - st.h - (st.h > 0 ? Math.sin(this.scene.time.now / 180) * 3 : 0);
      this.sprite.y = y;
      if (this.glowSp) this.glowSp.y = y;
    };
    this.scene.tweens.add({ targets: st, h: px, duration: 350, ease: 'Back.easeOut', onUpdate: apply });
    this.scene.tweens.add({
      targets: st,
      h: 0,
      delay: ms - 300,
      duration: 300,
      ease: 'Quad.easeIn',
      onUpdate: apply,
      onComplete: () => (this.sprite.y = base),
    });
    const bob = this.scene.time.addEvent({ delay: 16, repeat: Math.floor((ms - 650) / 16), callback: apply });
    this.scene.time.delayedCall(ms, () => bob.remove());
  }

  /** Subida de nível: pose de comemorar (olhando para o alto) e brilho no corpo. Só o jogador tem a pose;
   *  pose = false (níveis seguintes da fila): só o brilho. holdMs: a pose (último quadro) fica parada até este tempo. */
  levelUp(glowMs: number, color: number, intensity = 1, pose = true, holdMs = 0) {
    if (pose && this.sheet?.meta.anims.levelup && this.anim !== 'death') {
      this.attacking = false;
      this.posing = true;
      this.play('levelup', true);
      this.poseHold?.remove();
      this.poseHold = holdMs
        ? this.scene.time.delayedCall(holdMs, () => {
            this.poseHold = undefined;
            if (this.anim === 'levelup') {
              this.posing = false;
              this.anim = '';
            }
          })
        : undefined;
    }
    this.glow(glowMs, color, intensity);
  }

  /** Cópia do sprite pintada de uma cor, somando luz por cima do corpo: acende, pulsa e se apaga. */
  private glow(ms: number, color: number, intensity = 1) {
    this.glowSp?.destroy();
    const sp = this.sprite;
    const g = this.scene.add
      .image(sp.x, sp.y, sp.texture.key, sp.frame.name)
      .setOrigin(sp.originX, sp.originY)
      .setScale(sp.scaleX, sp.scaleY)
      .setFlipX(sp.flipX)
      .setTintFill(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.container.addAt(g, this.container.getIndex(sp) + 1);
    this.glowSp = g;
    this.scene.tweens.chain({
      targets: g,
      tweens: [
        { alpha: 0.6 * intensity, duration: ms * 0.12, ease: 'Quad.easeOut' },
        { alpha: 0.2 * intensity, duration: ms * 0.25, ease: 'Sine.easeInOut' },
        { alpha: 0.45 * intensity, duration: ms * 0.2, ease: 'Sine.easeInOut' },
        { alpha: 0, duration: ms * 0.43, ease: 'Quad.easeIn' },
      ],
      onComplete: () => {
        g.destroy();
        if (this.glowSp === g) this.glowSp = undefined;
      },
    });
  }

  flash() {
    this.sprite.setTintFill(0xffffff);
    this.flashing = true;
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(80, () => {
      this.flashing = false;
      this.sprite.clearTint();
    });
  }

  /** Marca de missão sobre o NPC: "!" (missão para pegar) ou "?" (para entregar). */
  setMark(m: '!' | '?' | null) {
    if (m === this.markSig) return;
    this.markSig = m;
    if (!m) {
      this.mark?.destroy();
      this.mark = undefined;
      return;
    }
    if (!this.mark) {
      this.mark = this.scene.add
        .text(0, 0, m, {
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#ffd23f',
          stroke: '#3a2400',
          strokeThickness: 5,
          resolution: DPR * 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.QUEST_MARK);
    }
    this.mark.setText(m).setColor(m === '!' ? '#ffd23f' : '#9fe8a0');
  }

  destroy() {
    this.flashTimer?.remove();
    this.aura?.destroy();
    this.container.destroy();
    if (this.labelY !== null) this.label.destroy();
    this.mark?.destroy();
  }
}
