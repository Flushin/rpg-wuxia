import Phaser from 'phaser';
import { DPR } from './display';
import { tileToScreen } from '../core/iso';
import { MONSTERS } from '../core/data';
import { L, tn } from '../core/i18n';
import type { Entity } from '../core/types';
import { animKey, dirFromDelta, sheetFor, type AnimName, type SheetMeta } from './sprites';

const DEATH_SHOW_MS = 1400; // monstro morto fica no chão antes de sumir
const MOVE_HOLD_MS = 120; // tempo sem andar até voltar à animação parada

const labelOf = (e: Entity) => (e.kind === 'monster' ? L(`Nv ${e.level} ${e.name}`, `Lv ${e.level} ${e.name}`) : e.kind === 'npc' ? tn(e.name) : e.name);

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
  private deadAt = 0;
  private movedAt = -1e9; // último instante em que se moveu (ms)
  private accX = 0; // deslocamento acumulado desde a última troca de direção
  private accY = 0;
  private top: number; // altura (px) do topo do personagem acima dos pés
  private label!: Phaser.GameObjects.Text;
  private labelY: number | null = null; // NPC: nome solto (fora do container)
  private mark?: Phaser.GameObjects.Text; // missão: "!" ou "?" sobre o NPC (marco 7)
  private markSig: string | null = null;

  constructor(private scene: Phaser.Scene, e: Entity, texture: string) {
    const shadow = scene.add.image(0, 0, 'shadow');
    this.sc = e.kind === 'monster' ? MONSTERS[e.monsterId]?.scale ?? 1 : 1;
    this.sheet = sheetFor(texture);
    if (this.sheet) {
      const m = this.sheet.meta;
      const sp = scene.add.sprite(0, 0, 'sp-' + this.sheet.key, 'idle_0_0').setOrigin(m.anchor[0], m.anchor[1]).setScale(m.scale * this.sc);
      sp.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (this.anim === 'attack') { this.attacking = false; this.anim = ''; } });
      this.sprite = sp;
      this.top = m.top * this.sc;
      this.dir = e.kind === 'monster' ? Phaser.Math.Between(0, 7) : 0;
    } else {
      this.sprite = scene.add.image(0, 2, texture).setOrigin(0.5, e.kind === 'monster' ? 0.92 : 0.93).setScale(this.sc);
      this.top = e.kind === 'monster' ? 40 * this.sc : 48;
    }
    this.lastX = e.x; this.lastY = e.y;
    shadow.setScale(this.sc);
    this.ring = scene.add.graphics();
    this.bar = scene.add.graphics();
    const color = e.kind === 'player' ? '#9fe8a0' : e.kind === 'monster' ? '#ff9a8a' : '#f0d070';
    const text = labelOf(e);
    const labelY = this.sheet ? -this.top - 4 : e.kind === 'monster' ? -36 * this.sc : -52;
    const label = scene.add.text(0, labelY, text, { fontSize: '12px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setResolution(DPR * 2);
    label.setName('label');
    this.label = label;
    // NPCs: nome fora do container, sempre por cima (casas e o portão não cortam o nome)
    if (e.kind === 'npc') { this.labelY = labelY; label.setDepth(99995); }
    this.container = scene.add.container(0, 0, e.kind === 'npc' ? [this.ring, shadow, this.sprite, this.bar] : [this.ring, shadow, this.sprite, this.bar, label]);
    this.sync(e, false);
    this.lastSx = this.container.x;
  }

  sync(e: Entity, selected: boolean) {
    const s = tileToScreen(e.x, e.y);
    if (this.sheet) this.animate(e);
    else if (Math.abs(s.x - this.lastSx) > 0.2) this.sprite.setFlipX(s.x < this.lastSx);
    this.lastSx = s.x;
    this.container.setPosition(s.x, s.y).setDepth(e.x + e.y);
    if (this.labelY !== null) this.label.setPosition(s.x, s.y + this.labelY);
    if (this.mark) this.mark.setPosition(s.x, s.y + (this.labelY ?? -50) - 16 + Math.sin(this.scene.time.now / 260) * 3);
    const deathShown = this.sheet && e.dead && this.scene.time.now - this.deadAt < DEATH_SHOW_MS;
    this.container.setVisible(!(e.dead && e.kind === 'monster') || !!deathShown);
    this.sprite.setAlpha(e.dead && !this.sheet ? 0.35 : 1);
    if (e.dead && this.sheet) { this.ring.clear(); this.bar.clear(); this.label.setVisible(false); return; }
    this.label.setVisible(true);
    this.label.setText(labelOf(e));
    this.ring.clear(); this.bar.clear();
    // buffs/debuffs: lentidão = tom azul + losango; defesa reduzida = seta vermelha; escudo = bolha
    const slow = e.buffs.some((b) => b.kind === 'slow'), broken = e.buffs.some((b) => b.kind === 'defReduction'), shield = e.buffs.some((b) => b.kind === 'shield' && b.value > 0);
    if (!this.flashing) { if (slow) this.sprite.setTint(0x8fc8ff); else this.sprite.clearTint(); }
    let ix = -18;
    if (slow) { this.bar.fillStyle(0x7fd0f0, 1); this.bar.fillPoints([{ x: ix, y: -46 }, { x: ix + 6, y: -40 }, { x: ix, y: -34 }, { x: ix - 6, y: -40 }], true); ix += 14; }
    if (broken) { this.bar.fillStyle(0xe03030, 1); this.bar.fillPoints([{ x: ix - 6, y: -45 }, { x: ix + 6, y: -45 }, { x: ix, y: -34 }], true); }
    if (shield) { this.bar.lineStyle(3, 0xd8e8f8, 0.9); this.bar.fillStyle(0xaad0ff, 0.22); this.bar.fillCircle(0, -20, 30); this.bar.strokeCircle(0, -20, 30); }
    if (selected && e.kind === 'monster') {
      this.ring.lineStyle(2, 0xff5050, 1); this.ring.strokeEllipse(0, 0, 36, 18);
      const w = 40 * Math.min(2, this.sc), top = this.sheet ? -this.top - 22 : -52 * this.sc;
      this.bar.fillStyle(0x000000, 0.8); this.bar.fillRect(-w / 2 - 1, top - 1, w + 2, 6);
      this.bar.fillStyle(0xc0392b, 1); this.bar.fillRect(-w / 2, top, w * Math.max(0, e.hp / e.derived.maxHp), 4);
    }
  }

  /** Escolhe a animação: morte > ataque em andamento > andar > parado.
   *  O mundo anda em passos fixos de 1/60 s: em telas de 120/144 Hz há quadros sem movimento,
   *  então "parado" só vale depois de MOVE_HOLD_MS sem andar (senão pisca entre andar e parado). */
  private animate(e: Entity) {
    const now = this.scene.time.now;
    const dx = e.x - this.lastX, dy = e.y - this.lastY;
    this.lastX = e.x; this.lastY = e.y;
    if (e.dead) {
      if (this.anim !== 'death') { this.deadAt = now; this.attacking = false; this.play('death'); }
      return;
    }
    if (this.anim === 'death') this.anim = ''; // renasceu
    const step = Math.hypot(dx, dy);
    if (step > 1.5) { this.accX = this.accY = 0; } // teleporte/troca de mapa: não conta como andar
    else if (step > 0.0005) {
      this.movedAt = now;
      this.accX += dx; this.accY += dy;
      // direção só muda após um trecho mínimo: evita tremer entre direções vizinhas
      if (Math.hypot(this.accX, this.accY) > 0.12) { this.dir = dirFromDelta(this.accX, this.accY); this.accX = this.accY = 0; }
    }
    const moving = now - this.movedAt < MOVE_HOLD_MS;
    if (moving) { if (!this.attacking || !e.attackWhileMoving) { this.attacking = false; this.play('walk'); } return; }
    if (this.attacking) return;
    this.play('idle');
  }

  private play(anim: AnimName, restart = false) {
    if (!this.sheet) return;
    const sp = this.sprite as Phaser.GameObjects.Sprite;
    const key = animKey(this.sheet.key, anim, this.dir);
    if (!restart && sp.anims.currentAnim?.key === key && sp.anims.isPlaying) { this.anim = anim; return; }
    // trocar só a direção do andar/parado mantém o passo (não volta ao quadro 0)
    const progress = !restart && this.anim === anim && anim !== 'attack' && anim !== 'death' ? sp.anims.getProgress() : 0;
    sp.play(key);
    if (progress > 0) sp.anims.setProgress(progress);
    this.anim = anim;
  }

  /** Em combate, parado: olha para o alvo (x, y em tiles). */
  face(x: number, y: number, fromX: number, fromY: number) {
    if (!this.sheet || this.attacking || this.anim === 'walk' || this.anim === 'death') return;
    if (Math.hypot(x - fromX, y - fromY) > 0.05) this.dir = dirFromDelta(x - fromX, y - fromY);
  }

  /** Golpe (ataque básico ou skill): vira para o alvo e toca o ataque uma vez. */
  attack(towardX: number, towardY: number, fromX: number, fromY: number) {
    if (!this.sheet || this.anim === 'death') return;
    if (Math.hypot(towardX - fromX, towardY - fromY) > 0.01) this.dir = dirFromDelta(towardX - fromX, towardY - fromY);
    this.attacking = true;
    this.play('attack', true);
  }

  flash() {
    this.sprite.setTintFill(0xffffff); this.flashing = true;
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(80, () => { this.flashing = false; this.sprite.clearTint(); });
  }

  /** Marca de missão sobre o NPC: "!" (missão para pegar) ou "?" (para entregar). */
  setMark(m: '!' | '?' | null) {
    if (m === this.markSig) return;
    this.markSig = m;
    if (!m) { this.mark?.destroy(); this.mark = undefined; return; }
    if (!this.mark) {
      this.mark = this.scene.add.text(0, 0, m, { fontSize: '26px', fontStyle: 'bold', color: '#ffd23f', stroke: '#3a2400', strokeThickness: 5 })
        .setOrigin(0.5, 1).setResolution(DPR * 2).setDepth(99996);
    }
    this.mark.setText(m).setColor(m === '!' ? '#ffd23f' : '#9fe8a0');
  }

  destroy() { this.flashTimer?.remove(); this.container.destroy(); if (this.labelY !== null) this.label.destroy(); this.mark?.destroy(); }
}
