// Aura elemental em volta do jogador: cresce a cada 100 de ataque elemental (nível 1 a 6, máximo em 600+).
// É uma camada própria dentro do container do personagem, desenhada em proporção à altura do sprite,
// então funciona com qualquer skin (atual ou futura) sem ajuste por traje. Por ora só trovão (Tormenta).
import type Phaser from 'phaser';
import type { Element } from '../core/types';
import { fxPrefs } from './fxPrefs';

/** Ataque elemental por nível de aura e nível máximo. */
export const AURA_STEP = 100;
export const AURA_MAX_TIER = 6;
export const auraTier = (elemAtk: number) => Math.max(0, Math.min(AURA_MAX_TIER, Math.floor(elemAtk / AURA_STEP)));

const GOLD = 0xffe14a;
const PALE = 0xfff3a0;
const VIOLET = 0xc8a8ff;
const CORE = 0xfffbe0;
// faíscas e raios por segundo, por nível (0..6); os três primeiros são rápidos para aparecer andando
const SPARK_RATE = [0, 3, 5, 7, 7.5, 8, 9];
const BOLT_RATE = [0, 0, 0, 1.6, 1.8, 2.2, 2.8];
// a arte da aura foi feita para um corpo de ~67 unidades (cabeça aos pés)
const BODY = 67;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  violet: boolean;
}
interface Bolt {
  p: number[];
  life: number;
}

export class ElementAura {
  private back: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private sparks: Spark[] = [];
  private bolts: Bolt[] = [];
  private t = 0;
  private pulse = 0;
  private drawn = false;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    behind: Phaser.GameObjects.GameObject,
    over: Phaser.GameObjects.GameObject,
    private top: number,
  ) {
    this.back = scene.add.graphics();
    this.front = scene.add.graphics();
    container.addAt(this.back, container.getIndex(behind) + 1);
    container.addAt(this.front, container.getIndex(over) + 1);
  }

  update(element: Element | null, elemAtk: number, dtMs: number, visible: boolean) {
    const tier = element === 'thunder' && visible && fxPrefs.aura ? auraTier(elemAtk) : 0;
    if (!tier) {
      if (this.drawn) {
        this.back.clear();
        this.front.clear();
        this.sparks.length = 0;
        this.bolts.length = 0;
        this.drawn = false;
      }
      return;
    }
    this.drawn = true;
    const dt = Math.min(0.05, dtMs / 1000);
    this.t += dt;
    const k = this.top / BODY; // escala pela altura do sprite (qualquer skin)
    const cy = -this.top * 0.45; // centro do corpo, acima dos pés
    const b = this.back.clear();
    const f = this.front.clear();

    // brilho no chão (nível 4+)
    if (tier >= 4) {
      const a = 0.16 + 0.05 * Math.sin(this.t * 3) + (tier - 4) * 0.05;
      b.fillStyle(GOLD, a * 0.5).fillEllipse(0, 0, 92 * k, 24 * k);
      b.fillStyle(GOLD, a).fillEllipse(0, 0, 52 * k, 13 * k);
    }
    // pulso violeta (nível 6)
    if (tier >= 6) {
      this.pulse -= dt;
      if (this.pulse <= 0) this.pulse = 2.2;
      const p = 1 - this.pulse / 2.2;
      if (p < 0.5) b.lineStyle(2 * k, VIOLET, 0.6 * (1 - p * 2)).strokeCircle(0, cy, (20 + p * 70) * k);
    }
    // arcos girando no corpo (nível 5+)
    if (tier >= 5) {
      const n = tier >= 6 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a0 = this.t * 2.2 + (i * Math.PI * 2) / n;
        f.lineStyle(1.6 * k, i % 2 ? VIOLET : GOLD, 0.85).beginPath();
        for (let s = 0; s <= 8; s++) {
          const a = a0 + (0.9 * s) / 8;
          const x = Math.cos(a) * 26 * k;
          const y = cy + Math.sin(a) * 34 * k;
          if (s) f.lineTo(x, y);
          else f.moveTo(x, y);
        }
        f.strokePath();
      }
    }

    const fast = tier <= 3 ? 2.2 : 1;
    if (Math.random() < SPARK_RATE[tier] * dt) {
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * (14 + tier * 3);
      this.sparks.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 1.3,
        vx: (Math.random() - 0.5) * 20 * fast,
        vy: (-10 - Math.random() * 20) * fast,
        life: (0.35 + Math.random() * 0.3) / (tier <= 3 ? 1.4 : 1),
        violet: Math.random() < 0.3,
      });
    }
    if (Math.random() < BOLT_RATE[tier] * dt) {
      const a = Math.random() * Math.PI * 2;
      const r1 = 14;
      const r2 = r1 + 8 + tier * 4;
      this.bolts.push({
        p: bolt(
          Math.cos(a) * r1,
          Math.sin(a) * r1 * 1.3,
          Math.cos(a + 0.4) * r2,
          Math.sin(a + 0.4) * r2 * 1.3,
          tier >= 4 ? 5 : 3,
        ),
        life: 0.12,
      });
    }

    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const x = s.x * k;
      const y = cy + s.y * k;
      const al = Math.min(1, s.life * 3);
      f.fillStyle(s.violet ? VIOLET : PALE, al).fillRect(x - k, y - k, 2 * k, 2 * k);
      f.lineStyle(0.8 * k, GOLD, al)
        .lineBetween(x - 2 * k, y, x + 2 * k, y)
        .lineBetween(x, y - 2 * k, x, y + 2 * k);
    }
    this.bolts = this.bolts.filter((bl) => (bl.life -= dt) > 0);
    for (const bl of this.bolts) {
      for (const [w, c, al] of [
        [3, VIOLET, 0.5],
        [1.2, CORE, 1],
      ]) {
        f.lineStyle(w * k, c, al).beginPath();
        for (let i = 0; i < bl.p.length; i += 2) {
          const x = bl.p[i] * k;
          const y = cy + bl.p[i + 1] * k;
          if (i) f.lineTo(x, y);
          else f.moveTo(x, y);
        }
        f.strokePath();
      }
    }
  }

  destroy() {
    this.back.destroy();
    this.front.destroy();
  }
}

function bolt(x1: number, y1: number, x2: number, y2: number, seg: number): number[] {
  const p = [x1, y1];
  for (let i = 1; i < seg; i++) {
    const q = i / seg;
    p.push(x1 + (x2 - x1) * q + (Math.random() - 0.5) * 10, y1 + (y2 - y1) * q + (Math.random() - 0.5) * 10);
  }
  p.push(x2, y2);
  return p;
}
