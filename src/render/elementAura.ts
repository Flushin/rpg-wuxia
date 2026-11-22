// Aura elemental em volta do jogador: cresce a cada 100 de ataque elemental (nível 1 a 6, máximo em 600+).
// É uma camada própria dentro do container do personagem, desenhada em proporção à altura do sprite,
// então funciona com qualquer skin (atual ou futura) sem ajuste por traje. Cada elemento tem seu desenhador (DRAWERS).
import type Phaser from 'phaser';
import type { Element } from '../core/types';
import { fxPrefs } from './fxPrefs';

/** Ataque elemental por nível de aura e nível máximo. */
export const AURA_STEP = 100;
export const AURA_MAX_TIER = 6;
export const auraTier = (elemAtk: number) => Math.max(0, Math.min(AURA_MAX_TIER, Math.floor(elemAtk / AURA_STEP)));

type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
// a arte da aura foi feita para um corpo de ~67 unidades (cabeça aos pés)
const BODY = 67;

/** Partícula genérica (faísca, floco, brasa, bolha, gota). */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  sz: number;
  ph: number;
  flag: boolean;
}
interface Bolt {
  p: number[];
  life: number;
}
/** Estado compartilhado entre quadros; cada elemento usa só o que precisa. */
interface AuraState {
  t: number;
  pulse: number;
  ps: P[];
  drops: P[];
  bolts: Bolt[];
}
/** Desenha um quadro da aura: b = camada atrás do corpo, f = na frente; k = escala, cy = centro do corpo. */
type AuraDrawer = (s: AuraState, tier: number, dt: number, b: G, f: G, k: number, cy: number) => void;

const R = Math.random;
const part = (o: Partial<P>): P => ({ x: 0, y: 0, vx: 0, vy: 0, life: 1, sz: 1, ph: 0, flag: false, ...o });
const age = (list: P[], dt: number) => list.filter((p) => (p.life -= dt) > 0);
/** Avança um pulso periódico e devolve a fase 0..1. */
const pulse = (s: AuraState, dt: number, per: number) => {
  s.pulse -= dt;
  if (s.pulse <= 0) s.pulse = per;
  return 1 - s.pulse / per;
};

// ---------- trovão (Tormenta) ----------
const GOLD = 0xffe14a;
const PALE = 0xfff3a0;
const VIOLET = 0xc8a8ff;
const CORE = 0xfffbe0;
// faíscas e raios por segundo, por nível (0..6); os três primeiros são rápidos para aparecer andando
const SPARK_RATE = [0, 6, 8, 10, 10, 11, 12];
const BOLT_RATE = [0, 0.6, 1.2, 2, 2.2, 2.5, 3];

const thunder: AuraDrawer = (s, tier, dt, b, f, k, cy) => {
  // brilho no chão (nível 4+)
  if (tier >= 4) {
    const a = 0.16 + 0.05 * Math.sin(s.t * 3) + (tier - 4) * 0.05;
    b.fillStyle(GOLD, a * 0.5).fillEllipse(0, 0, 92 * k, 24 * k);
    b.fillStyle(GOLD, a).fillEllipse(0, 0, 52 * k, 13 * k);
  }
  // pulso violeta (nível 6)
  if (tier >= 6) {
    const p = pulse(s, dt, 2.2);
    if (p < 0.5) b.lineStyle(2 * k, VIOLET, 0.6 * (1 - p * 2)).strokeCircle(0, cy, (20 + p * 70) * k);
  }
  // arcos girando no corpo (nível 5+)
  if (tier >= 5) {
    const n = tier >= 6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a0 = s.t * 2.2 + (i * TAU) / n;
      f.lineStyle(1.6 * k, i % 2 ? VIOLET : GOLD, 0.85).beginPath();
      for (let q = 0; q <= 8; q++) {
        const a = a0 + (0.9 * q) / 8;
        const x = Math.cos(a) * 26 * k;
        const y = cy + Math.sin(a) * 34 * k;
        if (q) f.lineTo(x, y);
        else f.moveTo(x, y);
      }
      f.strokePath();
    }
  }

  const fast = tier <= 3 ? 2.2 : 1;
  if (R() < SPARK_RATE[tier] * dt) {
    const a = R() * TAU;
    const r = 16 + R() * (14 + tier * 3);
    s.ps.push(
      part({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 1.3,
        vx: (R() - 0.5) * 20 * fast,
        vy: (-10 - R() * 20) * fast,
        life: (0.35 + R() * 0.3) / (tier <= 3 ? 1.15 : 1),
        flag: R() < 0.3,
      }),
    );
  }
  if (R() < BOLT_RATE[tier] * dt) {
    const a = R() * TAU;
    const r1 = 14;
    const r2 = r1 + 12 + tier * 4;
    s.bolts.push({
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

  s.ps = age(s.ps, dt);
  for (const p of s.ps) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const x = p.x * k;
    const y = cy + p.y * k;
    const al = Math.min(1, p.life * 3);
    f.fillStyle(GOLD, al * 0.35).fillCircle(x, y, 3.5 * k);
    f.fillStyle(p.flag ? VIOLET : PALE, al).fillRect(x - 1.5 * k, y - 1.5 * k, 3 * k, 3 * k);
    f.lineStyle(1.5 * k, GOLD, al)
      .lineBetween(x - 4 * k, y, x + 4 * k, y)
      .lineBetween(x, y - 4 * k, x, y + 4 * k);
  }
  s.bolts = s.bolts.filter((bl) => (bl.life -= dt) > 0);
  for (const bl of s.bolts) {
    for (const [w, c, al] of [
      [5.5, VIOLET, 0.5],
      [2.2, CORE, 1],
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
};

// ---------- gelo (Geada) ---------- paletas de skillFx
const ICE = [0xe8fbff, 0x9ee8ff, 0x6ab8f0];
const ICE_DEEP = 0x3a78c8;
const FLAKE_RATE = [0, 5, 7, 9, 10, 11, 12];

function flake(g: G, x: number, y: number, r: number, rot: number, c: number, al: number) {
  g.lineStyle(Math.max(1.2, r * 0.32), c, al);
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * Math.PI) / 3;
    g.lineBetween(x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
}

const ice: AuraDrawer = (s, tier, dt, b, f, k, cy) => {
  // névoa fria no chão (4+)
  if (tier >= 4) {
    const a = 0.18 + 0.05 * Math.sin(s.t * 1.5) + (tier - 4) * 0.05;
    b.fillStyle(ICE[2], a * 0.45).fillEllipse(0, 0, 100 * k, 26 * k);
    b.fillStyle(ICE[1], a).fillEllipse(0, 0, 58 * k, 14 * k);
    for (let i = 0; i < 4; i++) {
      const ph = (s.t * 0.25 + i / 4) % 1;
      const x = Math.cos(i * 1.7) * 36 * k;
      b.fillStyle(ICE[0], 0.22 * Math.sin(ph * Math.PI)).fillEllipse(
        x + ph * 10 * k,
        -2 * k - ph * 6 * k,
        30 * k,
        9 * k,
      );
    }
  }
  // pulso de geada (6): anel no chão com espinhos de gelo
  if (tier >= 6) {
    const p = pulse(s, dt, 2.6);
    if (p < 0.5) {
      const r = (18 + p * 70) * k;
      const al = 0.7 * (1 - p * 2);
      b.lineStyle(2.2 * k, ICE[1], al).strokeEllipse(0, -2 * k, r * 2.2, r * 0.6);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        const x = Math.cos(a) * r * 1.1;
        const y = -2 * k + Math.sin(a) * r * 0.3;
        f.fillStyle(ICE[0], al).fillTriangle(x, y - 5 * k, x - 2 * k, y, x + 2 * k, y);
      }
    }
  }
  // anel de cristais orbitando (5+)
  if (tier >= 5) {
    const n = tier >= 6 ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = s.t * 1.1 + (i * TAU) / n;
      const x = Math.cos(a) * 28 * k;
      const y = cy + Math.sin(a) * 10 * k;
      const g = Math.sin(a) > 0 ? f : b;
      const h = 7 * k;
      g.fillStyle(ICE_DEEP, 0.5).fillTriangle(x, y - h - 1.5 * k, x - 3.5 * k, y, x + 3.5 * k, y);
      g.fillStyle(ICE[0], 0.95)
        .fillTriangle(x, y - h, x - 2.5 * k, y, x + 2.5 * k, y)
        .fillTriangle(x, y + h * 0.6, x - 2.5 * k, y, x + 2.5 * k, y);
    }
  }
  // flocos caindo e girando devagar
  if (R() < FLAKE_RATE[tier] * dt) {
    const a = R() * TAU;
    const r = 14 + R() * (14 + tier * 3);
    s.ps.push(
      part({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 1.3 - 6,
        vx: (R() - 0.5) * 8,
        vy: 6 + R() * 8,
        ph: R() * 3,
        flag: R() < 0.5,
        life: 0.9 + R() * 0.5,
        sz: 3.2 + R() * 1.6,
      }),
    );
  }
  s.ps = age(s.ps, dt);
  for (const p of s.ps) {
    p.x += p.vx * dt + Math.sin(s.t * 2 + p.ph) * 4 * dt;
    p.y += p.vy * dt;
    p.ph += (p.flag ? 1.2 : -1.2) * dt;
    const x = p.x * k;
    const y = cy + p.y * k;
    const al = Math.min(1, p.life * 2.5);
    f.fillStyle(ICE[1], al * 0.3).fillCircle(x, y, p.sz * 1.2 * k);
    flake(f, x, y, p.sz * k, p.ph, ICE[0], al);
    f.fillStyle(0xffffff, al).fillCircle(x, y, 1 * k);
  }
};

// ---------- fogo (Titã) ----------
const EMBER = [0xfff0a0, 0xffa030, 0xe05020];
const EMBER_RATE = [0, 7, 9, 11, 12, 13, 15];

const fire: AuraDrawer = (s, tier, dt, b, f, k, cy) => {
  // brilho laranja tremulando no chão (4+)
  if (tier >= 4) {
    const a = 0.2 + 0.07 * Math.sin(s.t * 7) + 0.04 * Math.sin(s.t * 13) + (tier - 4) * 0.05;
    b.fillStyle(EMBER[2], a * 0.5).fillEllipse(0, 0, 96 * k, 25 * k);
    b.fillStyle(EMBER[1], a).fillEllipse(0, 0, 54 * k, 13 * k);
  }
  // pulso de calor (6)
  if (tier >= 6) {
    const p = pulse(s, dt, 2);
    if (p < 0.55) {
      const al = 0.55 * (1 - p / 0.55);
      b.lineStyle(3 * k, EMBER[1], al).strokeCircle(0, cy, (20 + p * 65) * k);
      b.lineStyle(1.5 * k, EMBER[0], al).strokeCircle(0, cy, (17 + p * 62) * k);
    }
  }
  // chamas lambendo os pés (3+)
  if (tier >= 3) {
    const n = tier >= 5 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 9 * k;
      const h = (9 + tier * 1.2 + 5 * Math.sin(s.t * 9 + i * 2.1)) * k;
      const w = 4.5 * k;
      const sw = Math.sin(s.t * 6 + i) * 2 * k;
      b.fillStyle(EMBER[2], 0.75).fillTriangle(x - w, 2 * k, x + w, 2 * k, x + sw, -h - 2 * k);
      f.fillStyle(EMBER[1], 0.85).fillTriangle(x - w * 0.65, 2 * k, x + w * 0.65, 2 * k, x + sw * 1.2, -h * 0.7);
      f.fillStyle(EMBER[0], 0.9).fillTriangle(x - w * 0.3, 2 * k, x + w * 0.3, 2 * k, x + sw, -h * 0.35);
    }
  }
  // espiral de fogo subindo pelo corpo (5+)
  if (tier >= 5) {
    const n = tier >= 6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      for (let q = 0; q < 14; q++) {
        const u = q / 14;
        const a = s.t * 3 + (i * TAU) / n + u * 4;
        const x = Math.cos(a) * (24 - u * 4) * k;
        const y = -u * BODY * 0.95 * k;
        const g = Math.sin(a) > 0 ? f : b;
        g.fillStyle(u < 0.5 ? EMBER[1] : EMBER[2], 0.8 * (1 - u * 0.6)).fillCircle(x, y, (3.4 - u * 1.6) * k);
      }
    }
  }
  // brasas subindo
  if (R() < EMBER_RATE[tier] * dt) {
    const r = R() * (20 + tier * 3);
    s.ps.push(
      part({
        x: (R() - 0.5) * 2 * r,
        y: 10 + R() * 14,
        vx: (R() - 0.5) * 10,
        vy: -(30 + R() * 25) * (tier <= 3 ? 1.3 : 1),
        life: 0.6 + R() * 0.4,
        sz: 2.4 + R() * 1.4,
        ph: R() * 6,
      }),
    );
  }
  s.ps = age(s.ps, dt);
  for (const p of s.ps) {
    p.x += (p.vx + Math.sin(s.t * 8 + p.ph) * 10) * dt;
    p.y += p.vy * dt;
    const x = p.x * k;
    const y = cy + p.y * k;
    const al = Math.min(1, p.life * 2.5);
    f.fillStyle(EMBER[2], al * 0.4).fillCircle(x, y, p.sz * 1.8 * k);
    f.fillStyle(p.life > 0.5 ? EMBER[0] : EMBER[1], al).fillCircle(x, y, p.sz * k);
  }
};

// ---------- veneno (Víbora) ----------
const POISON = [0xd8ff90, 0x8ae05a, 0x4ca040];
const POISON_DEEP = 0x2a6a30;
const BUBBLE_RATE = [0, 5, 7, 9, 10, 11, 12];
const DRIP_RATE = [0, 0, 0, 1.5, 2, 2.5, 3];

const poison: AuraDrawer = (s, tier, dt, b, f, k, cy) => {
  // poça tóxica borbulhando no chão (4+)
  if (tier >= 4) {
    const a = 0.22 + 0.05 * Math.sin(s.t * 2) + (tier - 4) * 0.05;
    b.fillStyle(POISON_DEEP, a * 1.3).fillEllipse(0, 0, 90 * k, 24 * k);
    b.fillStyle(POISON[1], a).fillEllipse(-4 * k, 0, 56 * k, 13 * k);
    for (let i = 0; i < 3; i++) {
      const ph = (s.t * 0.8 + i / 3) % 1;
      b.lineStyle(1.4 * k, POISON[0], 0.6 * (1 - ph)).strokeEllipse(
        [-22, 6, 24][i] * k,
        0,
        (4 + ph * 10) * k,
        (1.5 + ph * 3) * k,
      );
    }
  }
  // pulso venenoso (6)
  if (tier >= 6) {
    const p = pulse(s, dt, 2.4);
    if (p < 0.5) {
      const al = 0.55 * (1 - p * 2);
      b.fillStyle(POISON[1], al * 0.35).fillCircle(0, cy, (20 + p * 70) * k);
      b.lineStyle(2 * k, POISON[0], al).strokeCircle(0, cy, (20 + p * 70) * k);
    }
  }
  // névoa verde girando (5+)
  if (tier >= 5) {
    const n = tier >= 6 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = s.t * 1.3 + (i * TAU) / n;
      const x = Math.cos(a) * 26 * k;
      const y = cy + 12 * k + Math.sin(a) * 9 * k - Math.sin(s.t + i) * 6 * k;
      const g = Math.sin(a) > 0 ? f : b;
      g.fillStyle(POISON[2], 0.32).fillEllipse(x, y, 22 * k, 12 * k);
      g.fillStyle(POISON[1], 0.3).fillEllipse(x + 3 * k, y - 2 * k, 13 * k, 7 * k);
    }
  }
  // bolhas subindo e estourando
  if (R() < BUBBLE_RATE[tier] * dt) {
    const a = R() * TAU;
    const r = 12 + R() * (14 + tier * 3);
    s.ps.push(
      part({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 1.1 + 10,
        vx: (R() - 0.5) * 6,
        vy: -(14 + R() * 14) * (tier <= 3 ? 1.4 : 1),
        life: 0.7 + R() * 0.5,
        sz: 2.8 + R() * 2,
        ph: R() * 6,
      }),
    );
  }
  // gotas pingando (3+)
  if (R() < DRIP_RATE[tier] * dt) s.drops.push(part({ x: (R() - 0.5) * 30, y: -10 - R() * 20 }));
  s.ps = age(s.ps, dt);
  for (const p of s.ps) {
    p.x += (p.vx + Math.sin(s.t * 5 + p.ph) * 6) * dt;
    p.y += p.vy * dt;
    const x = p.x * k;
    const y = cy + p.y * k;
    if (p.life < 0.12) {
      const q = 1 - p.life / 0.12; // estouro
      f.lineStyle(1.4 * k, POISON[0], 1 - q).strokeCircle(x, y, (p.sz + q * 4) * k);
      continue;
    }
    const al = Math.min(1, p.life * 2);
    f.fillStyle(POISON[2], al * 0.55).fillCircle(x, y, p.sz * k);
    f.lineStyle(1.3 * k, POISON[0], al).strokeCircle(x, y, p.sz * k);
    f.fillStyle(0xffffff, al * 0.85).fillCircle(x - p.sz * 0.35 * k, y - p.sz * 0.35 * k, 0.9 * k);
  }
  s.drops = age(s.drops, dt);
  const ground = -cy / k;
  for (const d of s.drops) {
    if (!d.flag) {
      d.vy += 140 * dt;
      d.y += d.vy * dt;
      if (d.y >= ground) {
        d.y = ground;
        d.flag = true; // caiu: respingo
        d.life = 0.2;
      }
    }
    if (d.flag) {
      const q = 1 - d.life / 0.2;
      b.lineStyle(1.3 * k, POISON[0], 1 - q).strokeEllipse(d.x * k, 0, (3 + q * 10) * k, (1 + q * 3) * k);
      continue;
    }
    const x = d.x * k;
    const y = cy + d.y * k;
    f.fillStyle(POISON[1], 1)
      .fillCircle(x, y, 2.4 * k)
      .fillTriangle(x - 2.2 * k, y - 0.5 * k, x + 2.2 * k, y - 0.5 * k, x, y - 6 * k);
    f.fillStyle(POISON[0], 1).fillCircle(x - 0.7 * k, y - 0.4 * k, 0.8 * k);
  }
};

/** Estilo de aura por elemento. */
const DRAWERS: Partial<Record<Element, AuraDrawer>> = { thunder, ice, fire, poison };

export class ElementAura {
  private back: G;
  private front: G;
  private s: AuraState = { t: 0, pulse: 0, ps: [], drops: [], bolts: [] };
  private drawn: Element | null = null;

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
    const draw = element ? DRAWERS[element] : undefined;
    const tier = draw && visible && fxPrefs.aura ? auraTier(elemAtk) : 0;
    if (!tier || !draw || this.drawn !== element) {
      if (this.drawn) {
        this.back.clear();
        this.front.clear();
        this.s.ps.length = 0;
        this.s.drops.length = 0;
        this.s.bolts.length = 0;
        this.drawn = null;
      }
      if (!tier || !draw) return;
    }
    this.drawn = element;
    const dt = Math.min(0.05, dtMs / 1000);
    this.s.t += dt;
    const k = this.top / BODY; // escala pela altura do sprite (qualquer skin)
    const cy = -this.top * 0.45; // centro do corpo, acima dos pés
    draw(this.s, tier, dt, this.back.clear(), this.front.clear(), k, cy);
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
