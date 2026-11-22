import Phaser from 'phaser';
import { TILE_H, TILE_W, tileToScreen } from '../core/iso';
import { skillById } from '../core/skills';
import type { GameEvent } from '../core/types';
import { ultimateOf } from '../core/ultimate';
import { FIST_ORIGIN, GIANT_ORIGIN, GIANT_RES, ensureGiantTextures } from './ultGiant';
import { DEPTH } from './depth';
import { shakeCamera } from './fxPrefs';

const FX: number = DEPTH.SKILL_FX;

// cores dos elementos (marco 6): Tormenta = trovão (amarelo/violeta), Geada = gelo (azul/branco)
const THUNDER = [0xfff3a0, 0xffe14a, 0xc8a8ff];
const THUNDER_CORE = 0xfffbe0;
const ICE = [0xe8fbff, 0x9ee8ff, 0x6ab8f0];
const ICE_DEEP = 0x4a8fd0;
const BLOOD = [0xffd0a0, 0xff6a3a, 0xc03a3a];
// Titã = fogo e terra, Víbora = veneno e jade (marco 8)
const EMBER = [0xfff0a0, 0xffa030, 0xe05020];
const DUST = [0xc8a070, 0xa07a4a, 0x7a5a3a];
const POISON = [0xd8ff90, 0x8ae05a, 0x4ca040];
const POISON_DEEP = 0x2f7a3a;
const JADE = [0xe0fff0, 0x90f0b8, 0x40c080];

type Pt = { x: number; y: number };
type UltEvent = Extract<GameEvent, { type: 'ultimate' }>;
/** cores da ultimate da seita (ultimates.json) e duração em ms */
type UltColors = { main: number; glow: number; core: number; dur: number };
const hex = (s: string) => parseInt(s.slice(1), 16);

/**
 * Efeitos visuais das skills (marco 6): só visuais, não mudam regras.
 * Graphics para formas (cortes, raios, cristais) + partículas (fx-dot) para faíscas, neve e névoa.
 */
export class SkillFx {
  constructor(private scene: Phaser.Scene) {}

  onEvent(ev: GameEvent) {
    if (ev.type === 'dash') this.dash(ev.fromX, ev.fromY, ev.toX, ev.toY);
    else if (ev.type === 'skillCast') this.cast(ev);
    else if (ev.type === 'ultimate') this.ultimate(ev);
  }

  // ---------- utilidades ----------
  private gfx(depth = FX) {
    return this.scene.add.graphics().setDepth(depth);
  }
  private fade(o: Phaser.GameObjects.GameObject, ms: number, extra?: Partial<Phaser.Types.Tweens.TweenBuilderConfig>) {
    this.scene.tweens.add({
      targets: o,
      alpha: 0,
      duration: ms,
      ease: 'Quad.easeIn',
      onComplete: () => o.destroy(),
      ...extra,
    });
  }
  /** Rajada única de partículas que se apaga sozinha. */
  private burst(
    x: number,
    y: number,
    n: number,
    cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
    depth = FX + 1,
  ) {
    const life = typeof cfg.lifespan === 'number' ? cfg.lifespan : 700;
    const e = this.scene.add.particles(x, y, 'fx-dot', { emitting: false, blendMode: 'ADD', ...cfg }).setDepth(depth);
    e.explode(n);
    this.scene.time.delayedCall(life + 200, () => e.destroy());
    return e;
  }
  /** Elipse isométrica (raio em tiles). */
  private iso(r: number) {
    return { w: r * TILE_W * Math.SQRT2, h: r * TILE_H * Math.SQRT2 };
  }
  /** Raio em zigue-zague de a até b. */
  private bolt(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, jag = 10, segs = 7) {
    const pts: Pt[] = [a];
    const nx = -(b.y - a.y),
      ny = b.x - a.x,
      len = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
      const k = i / segs,
        off = (Math.random() - 0.5) * 2 * jag;
      pts.push({ x: a.x + (b.x - a.x) * k + (nx / len) * off, y: a.y + (b.y - a.y) * k + (ny / len) * off });
    }
    pts.push(b);
    g.lineStyle(9, 0xb090ff, 0.35);
    g.strokePoints(pts);
    g.lineStyle(4.5, 0xffe14a, 0.95);
    g.strokePoints(pts);
    g.lineStyle(1.8, THUNDER_CORE, 1);
    g.strokePoints(pts);
  }
  /** Corte em arco (lâmina) com brilho. */
  private slash(x: number, y: number, colors: number[], tilt: number, len = 40, width = 6, ms = 240) {
    const g = this.gfx();
    g.setPosition(x, y).setRotation(tilt).setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < 4; k++) {
      // arco que afina nas pontas
      const a = 1.15 - k * 0.22;
      g.lineStyle(width * (1 - k * 0.22), colors[Math.min(k, colors.length - 1)], 0.55 + k * 0.15);
      g.beginPath();
      g.arc(0, 0, len - k * 2, -a, a);
      g.strokePath();
    }
    g.lineStyle(1.5, 0xffffff, 1);
    g.beginPath();
    g.arc(0, 0, len - 8, -0.6, 0.6);
    g.strokePath();
    g.setScale(0.7);
    this.scene.tweens.add({ targets: g, scaleX: 1.1, scaleY: 1.1, duration: ms * 0.6, ease: 'Cubic.easeOut' });
    this.fade(g, ms);
  }
  /** Cristal de gelo (losango alongado). */
  private crystal(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number, w: number, tilt = 0) {
    const c = Math.cos(tilt),
      s = Math.sin(tilt);
    const p = (dx: number, dy: number) => ({ x: x + dx * c - dy * s, y: y + dx * s + dy * c });
    const pts = [p(0, -h), p(w, -h * 0.25), p(0, 0), p(-w, -h * 0.25)];
    g.fillStyle(0x9ee8ff, 0.85);
    g.fillPoints(pts, true);
    g.fillStyle(0xe8fbff, 0.9);
    g.fillPoints([pts[0], pts[1], pts[2]], true);
    g.lineStyle(1, 0xffffff, 0.9);
    g.strokePoints(pts, true);
  }

  // ---------- skills ----------
  private cast(ev: Extract<GameEvent, { type: 'skillCast' }>) {
    const d = skillById(ev.skillId);
    if (!d) return;
    const t = tileToScreen(ev.tx, ev.ty),
      c = tileToScreen(ev.x, ev.y);
    const radius = d.radius ?? 0;
    switch (d.fx) {
      case 'slash2':
        this.twinFangs(t);
        break;
      case 'heavy':
        this.guardbreak(t);
        break;
      case 'dash':
        break; // o rastro vem do evento dash
      case 'storm':
        this.bladeStorm(c, radius);
        break;
      case 'orb':
        this.frostOrb(c, t);
        break;
      case 'lotus':
        this.icebloom(c, t);
        break;
      case 'rain':
        this.blizzard(t, radius);
        break;
      case 'bubble':
        this.mistVeil(c);
        break;
      case 'quake':
        this.quake(c, radius);
        break;
      case 'fistfire':
        this.fistFire(t);
        break;
      case 'needle':
        this.needles(c, t, d.hits?.length ?? 1);
        break;
      case 'toxic':
        this.toxicCloud(t, radius);
        break;
      case 'sap':
        this.jadeSap(c);
        break;
      default:
        break;
    }
  }

  /** Presas Gêmeas: dois cortes cruzados com faíscas de trovão. */
  private twinFangs(t: Pt) {
    const y = t.y - 22;
    this.slash(t.x, y, THUNDER, -0.75);
    this.burst(t.x, y, 8, {
      speed: { min: 60, max: 140 },
      lifespan: 300,
      scale: { start: 0.45, end: 0 },
      tint: THUNDER,
    });
    this.scene.time.delayedCall(110, () => {
      this.slash(t.x, y, THUNDER, 0.75 + Math.PI);
      const g = this.gfx();
      this.bolt(g, { x: t.x - 16, y: y - 18 }, { x: t.x + 14, y: y + 14 }, 6, 4);
      this.fade(g, 180);
      this.burst(t.x, y, 10, {
        speed: { min: 80, max: 170 },
        lifespan: 320,
        scale: { start: 0.5, end: 0 },
        tint: THUNDER,
      });
    });
  }

  /** Quebra-Guarda: corte pesado de cima para baixo, onda de choque e rachadura no chão. */
  private guardbreak(t: Pt) {
    const g = this.gfx();
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10, 0xff6a3a, 0.5);
    g.lineBetween(t.x - 8, t.y - 70, t.x + 4, t.y - 4);
    g.lineStyle(4, 0xffe0c0, 1);
    g.lineBetween(t.x - 8, t.y - 70, t.x + 4, t.y - 4);
    this.fade(g, 260);
    this.scene.time.delayedCall(70, () => {
      const r = this.iso(1.4);
      const w = this.gfx(FX - 1);
      w.setPosition(t.x, t.y);
      w.lineStyle(4, 0xff5a3a, 0.9);
      w.strokeEllipse(0, 0, r.w, r.h);
      w.lineStyle(2, 0xffd0a0, 0.8);
      w.strokeEllipse(0, 0, r.w * 0.6, r.h * 0.6);
      w.setScale(0.2);
      this.scene.tweens.add({ targets: w, scaleX: 1, scaleY: 1, duration: 260, ease: 'Cubic.easeOut' });
      this.fade(w, 420);
      // rachaduras no chão
      const cr = this.gfx(-90000 + 1);
      cr.lineStyle(2, 0x2a1a10, 0.8);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + Math.random() * 0.5;
        let px = t.x,
          py = t.y;
        cr.beginPath();
        cr.moveTo(px, py);
        for (let s = 0; s < 3; s++) {
          px += Math.cos(a + (Math.random() - 0.5)) * 9;
          py += Math.sin(a + (Math.random() - 0.5)) * 4.5;
          cr.lineTo(px, py);
        }
        cr.strokePath();
      }
      cr.setDepth(FX - 2);
      this.fade(cr, 900, { delay: 300 });
      this.burst(t.x, t.y - 10, 16, {
        speed: { min: 90, max: 200 },
        angle: { min: 200, max: 340 },
        gravityY: 400,
        lifespan: 500,
        scale: { start: 0.55, end: 0.1 },
        tint: BLOOD,
      });
    });
  }

  /** Passo do Raio: relâmpago do ponto de saída ao de chegada + imagens residuais. */
  private dash(fx: number, fy: number, tx: number, ty: number) {
    const a = tileToScreen(fx, fy),
      b = tileToScreen(tx, ty);
    const g = this.gfx();
    this.bolt(g, { x: a.x, y: a.y - 22 }, { x: b.x, y: b.y - 22 }, 12, 9);
    this.fade(g, 450);
    for (let i = 0; i < 5; i++) {
      const k = i / 4,
        s = this.gfx(FX - 1);
      s.fillStyle(0x8a6ad0, 0.55);
      s.fillEllipse(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - 18, 20, 34);
      this.fade(s, 260 + i * 40);
    }
    this.burst(b.x, b.y - 20, 14, {
      speed: { min: 70, max: 160 },
      lifespan: 380,
      scale: { start: 0.5, end: 0 },
      tint: THUNDER,
    });
    this.burst(a.x, a.y - 20, 6, {
      speed: { min: 30, max: 80 },
      lifespan: 300,
      scale: { start: 0.4, end: 0 },
      tint: [0xc8a8ff],
    });
  }

  /** Tempestade de Lâminas: lâminas girando em volta + raios curtos na borda. */
  private bladeStorm(c: Pt, radius: number) {
    const r = this.iso(radius);
    const ring = this.gfx(FX - 1);
    ring.setPosition(c.x, c.y);
    ring.fillStyle(0xffe14a, 0.12);
    ring.fillEllipse(0, 0, r.w, r.h);
    ring.lineStyle(3, 0xffe14a, 0.8);
    ring.strokeEllipse(0, 0, r.w, r.h);
    ring.setScale(0.3);
    this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 220, ease: 'Cubic.easeOut' });
    this.fade(ring, 600, { delay: 100 });
    const blades = this.gfx();
    blades.setPosition(c.x, c.y - 16).setBlendMode(Phaser.BlendModes.ADD);
    const draw = (rot: number) => {
      blades.clear();
      for (let k = 0; k < 6; k++) {
        const a = rot + (k / 6) * Math.PI * 2;
        const x = Math.cos(a) * r.w * 0.38,
          y = Math.sin(a) * r.h * 0.38;
        // rastro + lâmina
        blades.lineStyle(4, 0xffe14a, 0.35);
        const tx = Math.cos(a - 0.5) * r.w * 0.38,
          ty = Math.sin(a - 0.5) * r.h * 0.38;
        blades.lineBetween(tx, ty, x, y);
        blades.fillStyle(0xfffbe0, 1);
        const dx = -Math.sin(a) * 9,
          dy = Math.cos(a) * 4.5;
        blades.fillTriangle(x + dx, y + dy, x - dx * 0.4, y - dy * 0.4 - 3, x - dx * 0.4, y - dy * 0.4 + 3);
      }
    };
    const st = { rot: 0 };
    this.scene.tweens.add({
      targets: st,
      rot: Math.PI * 3,
      duration: 560,
      ease: 'Sine.easeInOut',
      onUpdate: () => draw(st.rot),
      onComplete: () => blades.destroy(),
    });
    for (let k = 0; k < 4; k++)
      this.scene.time.delayedCall(80 + k * 110, () => {
        const a = Math.random() * Math.PI * 2,
          g = this.gfx();
        const p = { x: c.x + Math.cos(a) * r.w * 0.5, y: c.y + Math.sin(a) * r.h * 0.5 };
        this.bolt(g, { x: p.x, y: p.y - 46 }, p, 6, 4);
        this.fade(g, 160);
        this.burst(p.x, p.y, 5, {
          speed: { min: 40, max: 110 },
          lifespan: 260,
          scale: { start: 0.4, end: 0 },
          tint: THUNDER,
        });
      });
  }

  /** Orbe Gélido: esfera de gelo com rastro de flocos; estoura em cristais. */
  private frostOrb(c: Pt, t: Pt) {
    const from = { x: c.x, y: c.y - 24 },
      to = { x: t.x, y: t.y - 22 };
    const orb = this.gfx();
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.fillStyle(ICE_DEEP, 0.35);
    orb.fillCircle(0, 0, 13);
    orb.fillStyle(0x9ee8ff, 0.9);
    orb.fillCircle(0, 0, 7);
    orb.fillStyle(0xffffff, 1);
    orb.fillCircle(-2, -2, 3);
    orb.setPosition(from.x, from.y);
    const trail = this.scene.add
      .particles(0, 0, 'fx-dot', {
        follow: orb,
        lifespan: 260,
        speed: { min: 5, max: 25 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: ICE,
        frequency: 16,
        blendMode: 'ADD',
      })
      .setDepth(FX);
    const dur = Math.max(140, Math.hypot(to.x - from.x, to.y - from.y) * 1.1);
    this.scene.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      duration: dur,
      ease: 'Quad.easeIn',
      onComplete: () => {
        orb.destroy();
        trail.stop();
        this.scene.time.delayedCall(300, () => trail.destroy());
        const g = this.gfx();
        for (let k = 0; k < 5; k++) this.crystal(g, to.x, to.y + 6, 14 + Math.random() * 6, 4, (k / 5) * Math.PI * 2);
        g.setScale(0.4);
        g.setPosition(0, 0);
        this.scene.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: 140 });
        this.fade(g, 320, { delay: 80 });
        this.burst(to.x, to.y, 12, {
          speed: { min: 50, max: 140 },
          lifespan: 360,
          scale: { start: 0.45, end: 0 },
          tint: ICE,
        });
      },
    });
  }

  /** Flor de Gelo: orbe que abre uma flor de cristais no chão do alvo. */
  private icebloom(c: Pt, t: Pt) {
    const from = { x: c.x, y: c.y - 24 },
      to = { x: t.x, y: t.y - 20 };
    const orb = this.gfx();
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.fillStyle(0x9ee8ff, 0.5);
    orb.fillCircle(0, 0, 10);
    orb.fillStyle(0xffffff, 1);
    orb.fillCircle(0, 0, 4);
    orb.setPosition(from.x, from.y);
    this.scene.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      duration: 170,
      onComplete: () => {
        orb.destroy();
        const base = this.gfx(FX - 1);
        base.setPosition(t.x, t.y);
        base.fillStyle(0x7fd0f0, 0.25);
        base.fillEllipse(0, 0, 76, 38);
        base.lineStyle(2, 0xe8fbff, 0.8);
        base.strokeEllipse(0, 0, 76, 38);
        this.fade(base, 900, { delay: 300 });
        const petals = this.gfx();
        petals.setPosition(t.x, t.y);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          this.crystal(
            petals,
            Math.cos(a) * 18,
            Math.sin(a) * 9 + 4,
            18 + (k % 2) * 8,
            5,
            a * 0.25 + Math.cos(a) * 0.5,
          );
        }
        this.crystal(petals, 0, 2, 30, 7);
        petals.setScale(0.2, 0);
        this.scene.tweens.add({ targets: petals, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
        this.fade(petals, 600, { delay: 450 });
        this.burst(t.x, t.y - 10, 14, {
          speed: { min: 20, max: 70 },
          angle: { min: 220, max: 320 },
          lifespan: 700,
          scale: { start: 0.4, end: 0 },
          tint: ICE,
        });
      },
    });
  }

  /** Nevasca: área marcada, cristais caindo do céu e neve girando. */
  private blizzard(t: Pt, radius: number) {
    const r = this.iso(radius);
    const area = this.gfx(FX - 1);
    area.setPosition(t.x, t.y);
    area.fillStyle(0x6ab8f0, 0.16);
    area.fillEllipse(0, 0, r.w, r.h);
    area.lineStyle(3, 0xbfe6ff, 0.9);
    area.strokeEllipse(0, 0, r.w, r.h);
    area.lineStyle(1, 0xffffff, 0.6);
    area.strokeEllipse(0, 0, r.w * 0.75, r.h * 0.75);
    area.setScale(0.5);
    this.scene.tweens.add({ targets: area, scaleX: 1, scaleY: 1, duration: 200 });
    this.fade(area, 500, { delay: 600 });
    const snow = this.scene.add
      .particles(t.x, t.y - 70, 'fx-dot', {
        x: { min: -r.w * 0.45, max: r.w * 0.45 },
        y: { min: -10, max: 10 },
        lifespan: 700,
        speedY: { min: 80, max: 140 },
        speedX: { min: -40, max: -10 },
        scale: { start: 0.35, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0xe8fbff],
        frequency: 14,
        blendMode: 'ADD',
      })
      .setDepth(FX);
    this.scene.time.delayedCall(650, () => {
      snow.stop();
      this.scene.time.delayedCall(800, () => snow.destroy());
    });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2,
        rr = Math.sqrt(Math.random()) * 0.42;
      const x = t.x + Math.cos(a) * r.w * rr,
        y = t.y + Math.sin(a) * r.h * rr;
      const s = this.gfx();
      this.crystal(s, 0, 0, 18, 4, Math.PI); // ponta para baixo
      s.setPosition(x + 14, y - 80).setAlpha(0);
      this.scene.tweens.add({
        targets: s,
        x,
        y: y + 2,
        alpha: 1,
        duration: 240,
        delay: i * 40,
        ease: 'Quad.easeIn',
        onComplete: () => {
          s.destroy();
          const hit = this.gfx(FX - 1);
          hit.lineStyle(2, 0xe8fbff, 0.9);
          hit.strokeEllipse(x, y, 16, 8);
          this.fade(hit, 240);
          this.burst(x, y, 4, {
            speed: { min: 20, max: 60 },
            angle: { min: 200, max: 340 },
            lifespan: 240,
            scale: { start: 0.3, end: 0 },
            tint: ICE,
          });
        },
      });
    }
  }

  /** Véu de Névoa: névoa girando em volta do personagem que se fecha numa bolha. */
  private mistVeil(c: Pt) {
    const y = c.y - 20;
    const g = this.gfx();
    g.setPosition(c.x, y);
    g.fillStyle(0xaad0ff, 0.2);
    g.fillCircle(0, 0, 30);
    g.lineStyle(3, 0xe8f4ff, 0.9);
    g.strokeCircle(0, 0, 30);
    g.lineStyle(1, 0xffffff, 0.6);
    g.beginPath();
    g.arc(0, 0, 24, -2.4, -1.2);
    g.strokePath();
    g.setScale(1.6).setAlpha(0);
    this.scene.tweens.add({ targets: g, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    this.fade(g, 450, { delay: 320 });
    this.burst(c.x, y, 26, {
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, 44),
        quantity: 26,
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      speed: { min: 10, max: 30 },
      lifespan: 700,
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.5, end: 0 },
      tint: [0xffffff, 0xd8e8f8, 0xaad0ff],
      blendMode: 'NORMAL',
    });
  }

  /** Tremor: ondas de choque no chão em volta do jogador, rachaduras e um pouco de poeira. */
  private quake(c: Pt, radius: number) {
    const r = this.iso(radius);
    for (let k = 0; k < 2; k++) {
      const w = this.gfx(FX - 1);
      w.setPosition(c.x, c.y);
      w.lineStyle(5 - k * 2, k ? 0xe0b070 : 0xa0703a, 0.9);
      w.strokeEllipse(0, 0, r.w, r.h);
      w.setScale(0.15);
      this.scene.tweens.add({ targets: w, scaleX: 1, scaleY: 1, duration: 300, delay: k * 110, ease: 'Cubic.easeOut' });
      this.fade(w, 450, { delay: k * 110 + 120 });
    }
    const cr = this.gfx(FX - 2);
    cr.lineStyle(2, 0x2a1a10, 0.8);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.random() * 0.4;
      let px = c.x,
        py = c.y;
      cr.beginPath();
      cr.moveTo(px, py);
      for (let i = 0; i < 4; i++) {
        px += Math.cos(a + (Math.random() - 0.5) * 0.8) * (r.w * 0.11);
        py += Math.sin(a + (Math.random() - 0.5) * 0.8) * (r.h * 0.11);
        cr.lineTo(px, py);
      }
      cr.strokePath();
    }
    this.fade(cr, 800, { delay: 400 });
    this.burst(c.x, c.y, 14, {
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Ellipse(0, 0, r.w * 0.7, r.h * 0.7),
        quantity: 14,
      } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      speedY: { min: -60, max: -25 },
      speedX: { min: -12, max: 12 },
      lifespan: 600,
      scale: { start: 0.7, end: 0.2 },
      alpha: { start: 0.6, end: 0 },
      tint: DUST,
      blendMode: 'NORMAL',
    });
  }

  /** Punho Vulcânico: clarão de fogo no alvo, anel de brasa e brasas subindo. */
  private fistFire(t: Pt) {
    const y = t.y - 22;
    const g = this.gfx();
    g.setPosition(t.x, y).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xe05020, 0.45);
    g.fillCircle(0, 0, 22);
    g.fillStyle(0xffa030, 0.85);
    g.fillCircle(0, 0, 13);
    g.fillStyle(0xfff0c0, 1);
    g.fillCircle(0, 0, 6);
    g.setScale(0.4);
    this.scene.tweens.add({ targets: g, scaleX: 1.3, scaleY: 1.3, duration: 200, ease: 'Cubic.easeOut' });
    this.fade(g, 300);
    const ring = this.gfx(FX - 1);
    ring.setPosition(t.x, t.y);
    ring.lineStyle(3, 0xff7a30, 0.9);
    ring.strokeEllipse(0, 0, 70, 35);
    ring.setScale(0.2);
    this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 240, ease: 'Cubic.easeOut' });
    this.fade(ring, 400, { delay: 60 });
    this.burst(t.x, y, 14, {
      speed: { min: 60, max: 150 },
      angle: { min: 200, max: 340 },
      gravityY: -60,
      lifespan: 600,
      scale: { start: 0.5, end: 0 },
      tint: EMBER,
    });
  }

  /** Agulhas: fios finos de jade voando do jogador ao alvo, uma após a outra. */
  private needles(c: Pt, t: Pt, n: number) {
    const from = { x: c.x, y: c.y - 24 },
      to = { x: t.x, y: t.y - 22 };
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = Math.max(90, Math.min(200, dist * 0.7));
    const step = n > 1 ? 90 : 0;
    for (let i = 0; i < n; i++) {
      const jy = n > 1 ? (i - (n - 1) / 2) * 5 : 0; // espalha um pouco
      this.scene.time.delayedCall(i * step, () => {
        const g = this.gfx();
        g.setBlendMode(Phaser.BlendModes.ADD).setRotation(ang);
        g.lineStyle(5, POISON_DEEP, 0.4);
        g.lineBetween(-26, 0, 0, 0);
        g.lineStyle(2, 0xd8ffd8, 1);
        g.lineBetween(-20, 0, 4, 0);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(4, 0, 1.6);
        g.setPosition(from.x, from.y + jy);
        this.scene.tweens.add({
          targets: g,
          x: to.x,
          y: to.y + jy * 0.4,
          duration: dur,
          ease: 'Quad.easeIn',
          onComplete: () => {
            g.destroy();
            this.burst(to.x, to.y + jy * 0.4, n > 1 ? 3 : 6, {
              speed: { min: 30, max: 90 },
              lifespan: 260,
              scale: { start: 0.35, end: 0 },
              tint: POISON,
            });
          },
        });
      });
    }
  }

  /** Névoa Tóxica: nuvem verde no chão em volta do alvo por cerca de 1,5 s. */
  private toxicCloud(t: Pt, radius: number) {
    const r = this.iso(radius);
    const g = this.gfx(FX - 1);
    g.setPosition(t.x, t.y);
    g.fillStyle(POISON_DEEP, 0.32);
    g.fillEllipse(0, 0, r.w, r.h);
    g.lineStyle(2, 0x8ae05a, 0.6);
    g.strokeEllipse(0, 0, r.w, r.h);
    const puffs = [
      [-0.28, -0.1, 0.3],
      [0.05, -0.22, 0.34],
      [0.3, 0.02, 0.28],
      [-0.1, 0.18, 0.32],
      [0.2, 0.22, 0.24],
    ];
    for (const [u, v, k] of puffs) {
      g.fillStyle(0x7ac85a, 0.42);
      g.fillEllipse(u * r.w, v * r.h, k * r.w, k * r.h * 1.1);
    }
    g.setScale(0.4).setAlpha(0);
    this.scene.tweens.add({ targets: g, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    this.fade(g, 450, { delay: 1050 });
    const gas = this.scene.add
      .particles(t.x, t.y, 'fx-dot', {
        x: { min: -r.w * 0.38, max: r.w * 0.38 },
        y: { min: -r.h * 0.3, max: r.h * 0.3 },
        speedY: { min: -26, max: -10 },
        lifespan: 800,
        scale: { start: 0.8, end: 0.3 },
        alpha: { start: 0.45, end: 0 },
        tint: POISON,
        frequency: 110,
        blendMode: 'NORMAL',
      })
      .setDepth(FX);
    this.scene.time.delayedCall(1100, () => {
      gas.stop();
      this.scene.time.delayedCall(900, () => gas.destroy());
    });
  }

  /** Seiva de Jade: anéis e brilho verde subindo do chão em volta do jogador. */
  private jadeSap(c: Pt) {
    for (let k = 0; k < 2; k++) {
      const w = this.gfx(FX - 1);
      w.setPosition(c.x, c.y);
      w.lineStyle(3, k ? 0x90f0b8 : 0x40c080, 0.9);
      w.strokeEllipse(0, 0, 54, 27);
      w.setScale(1.3).setAlpha(0);
      this.scene.tweens.add({
        targets: w,
        scaleX: 0.7,
        scaleY: 0.7,
        y: c.y - 30 - k * 10,
        alpha: 1,
        duration: 500,
        delay: k * 160,
        ease: 'Cubic.easeOut',
      });
      this.fade(w, 400, { delay: 500 + k * 160 });
    }
    this.burst(c.x, c.y, 16, {
      x: { min: -22, max: 22 },
      y: { min: -4, max: 6 },
      speedY: { min: -90, max: -40 },
      speedX: { min: -10, max: 10 },
      lifespan: 800,
      scale: { start: 0.5, end: 0 },
      tint: JADE,
    });
  }

  // ---------- ultimates (src/data/ultimates.json: "fx" escolhe o efeito; cores color/glow/core) ----------
  private ultimate(ev: UltEvent) {
    const u = ultimateOf(ev.sect);
    if (!u) return;
    const col: UltColors = { main: hex(u.color), glow: hex(u.glow), core: hex(u.core), dur: u.duration * 1000 };
    if (u.fx === 'geada') this.ultGeada(ev, col, u.finalDebuff?.duration ?? 0);
    else if (u.fx === 'tita') this.ultTita(ev, col);
    else this.ultTormenta(ev, col);
  }

  // Tormenta (prévia aprovada: previews/ultimate-tormenta-a.html)
  /** Raio da ultimate: halo (glow), corpo (main) e miolo (core), com galhos. */
  private ultBolt(a: Pt, b: Pt, w: number, jag: number, col: UltColors, segs = 10) {
    const g = this.gfx(FX + 2).setBlendMode(Phaser.BlendModes.ADD);
    const pts: Pt[] = [a];
    for (let i = 1; i < segs; i++) {
      const k = i / segs;
      pts.push({
        x: a.x + (b.x - a.x) * k + (Math.random() - 0.5) * 2 * jag,
        y: a.y + (b.y - a.y) * k + (Math.random() - 0.5) * jag * 0.6,
      });
    }
    pts.push(b);
    g.lineStyle(w * 2.8, col.glow, 0.3);
    g.strokePoints(pts);
    g.lineStyle(w * 1.3, col.main, 0.95);
    g.strokePoints(pts);
    g.lineStyle(w * 0.45, col.core, 1);
    g.strokePoints(pts);
    for (let k = 0; k < 2; k++) {
      const q = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
      g.lineStyle(Math.max(1, w * 0.3), col.glow, 0.85);
      g.lineBetween(q.x, q.y, q.x + (Math.random() - 0.5) * 50, q.y + Math.random() * 30);
    }
    this.fade(g, 260);
  }
  private ultTormenta(ev: UltEvent, col: UltColors) {
    const c = tileToScreen(ev.x, ev.y);
    const sky = (p: Pt) => ({ x: p.x + (Math.random() - 0.5) * 60, y: p.y - 320 });
    if (ev.phase === 'start') {
      // círculo de runas no chão, girando durante os 3 s
      const r = this.iso(2.2);
      const g = this.gfx(FX - 1).setPosition(c.x, c.y);
      const st = { a: 0, k: 0 };
      const draw = () => {
        g.clear();
        g.lineStyle(3, col.main, 0.85 * st.k);
        g.strokeEllipse(0, 0, r.w * st.k, r.h * st.k);
        g.lineStyle(2, col.glow, 0.6 * st.k);
        g.strokeEllipse(0, 0, r.w * 0.74 * st.k, r.h * 0.74 * st.k);
        for (let i = 0; i < 8; i++) {
          const t = st.a + (i / 8) * Math.PI * 2,
            cs = Math.cos(t),
            sn = Math.sin(t);
          g.lineStyle(3, col.main, 0.85 * st.k);
          g.lineBetween(cs * r.w * 0.37 * st.k, sn * r.h * 0.37 * st.k, cs * r.w * 0.5 * st.k, sn * r.h * 0.5 * st.k);
        }
      };
      this.scene.tweens.add({ targets: st, k: 1, duration: 400, ease: 'Back.easeOut' });
      this.scene.tweens.add({
        targets: st,
        a: Math.PI * 3,
        duration: col.dur,
        onUpdate: draw,
        onComplete: () => this.fade(g, 300),
      });
      // tela escurece um pouco (céu de tempestade)
      const cam = this.scene.cameras.main;
      const dark = this.scene.add
        .rectangle(0, 0, cam.width, cam.height, 0x050819, 0)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(FX - 2);
      this.scene.tweens.add({
        targets: dark,
        fillAlpha: 0.45,
        duration: 400,
        yoyo: true,
        hold: col.dur - 600,
        onComplete: () => dark.destroy(),
      });
      // raios soltos no céu o tempo todo (um a cada ~0,1 s): a tempestade nunca para, mesmo sem monstro perto
      this.scene.time.addEvent({
        delay: 110,
        repeat: Math.round(col.dur / 110) - 1,
        callback: () => {
          const x = c.x + (Math.random() - 0.5) * 560,
            y = c.y - 120 + (Math.random() - 0.5) * 220;
          this.ultBolt({ x, y: y - 220 }, { x: x + (Math.random() - 0.5) * 60, y }, 1.6, 18, col, 6);
        },
      });
      // faíscas subindo das mãos
      this.burst(c.x, c.y - 70, 24, {
        speed: { min: 60, max: 160 },
        angle: { min: 230, max: 310 },
        lifespan: 700,
        scale: { start: 0.6, end: 0 },
        tint: [col.main, col.core, col.glow],
      });
      return;
    }
    const final = ev.phase === 'final';
    for (const t of ev.targets) {
      const p = tileToScreen(t.x, t.y);
      this.ultBolt(sky(p), { x: p.x, y: p.y - 10 }, final ? 4 : 3, 24, col);
      const ring = this.gfx(FX - 1).setPosition(p.x, p.y);
      ring.lineStyle(3, col.main, 0.9);
      ring.strokeEllipse(0, 0, 30, 15);
      ring.setScale(0.4);
      this.scene.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, duration: 360, ease: 'Cubic.easeOut' });
      this.fade(ring, 380);
      this.burst(p.x, p.y - 12, final ? 14 : 8, {
        speed: { min: 40, max: 150 },
        lifespan: 450,
        scale: { start: 0.5, end: 0 },
        tint: [col.main, col.core, col.glow],
      });
    }
    if (!final) {
      shakeCamera(this.scene, 90, 0.003);
      return;
    }
    // estouro final: raio gigante no personagem, clarão amarelado e anel do tamanho da área
    this.ultBolt({ x: c.x, y: c.y - 420 }, { x: c.x, y: c.y - 40 }, 10, 30, col, 14);
    this.scene.cameras.main.flash(260, 255, 244, 200);
    shakeCamera(this.scene, 380, 0.012);
    const r = this.iso(ev.radius);
    const ring = this.gfx(FX - 1).setPosition(c.x, c.y);
    ring.lineStyle(10, col.main, 1);
    ring.strokeEllipse(0, 0, r.w, r.h);
    ring.lineStyle(4, col.glow, 0.8);
    ring.strokeEllipse(0, 0, r.w * 1.04, r.h * 1.04);
    ring.setScale(0.1);
    this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 520, ease: 'Cubic.easeOut' });
    this.fade(ring, 820);
    this.burst(c.x, c.y - 30, 40, {
      speed: { min: 120, max: 320 },
      lifespan: 800,
      scale: { start: 0.8, end: 0 },
      tint: [col.main, col.core, col.glow],
    });
  }

  // Titã (prévia aprovada: previews/ultimate-tita.html, opção B "Punhos do Gigante")
  /** gigante de brasa atrás do Titã durante a ultimate (troca de pose a cada soco) */
  private giant: Phaser.GameObjects.Image | null = null;
  private ultTita(ev: UltEvent, col: UltColors) {
    ensureGiantTextures(this.scene);
    const c = tileToScreen(ev.x, ev.y);
    const K = 1.25 / GIANT_RES; // prévia → mundo (o personagem do jogo é 1,25× o da prévia)
    const tints = [col.core, col.main, col.glow];
    if (ev.phase === 'start') {
      // brasa no chão e tela avermelhada
      const r = this.iso(2.6);
      const floor = this.gfx(FX - 1).setPosition(c.x, c.y);
      floor.fillStyle(col.glow, 0.22);
      floor.fillEllipse(0, 0, r.w, r.h);
      floor.fillStyle(col.main, 0.25);
      floor.fillEllipse(0, 0, r.w * 0.55, r.h * 0.55);
      floor.setScale(0.2);
      this.scene.tweens.add({ targets: floor, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut' });
      this.fade(floor, 400, { delay: col.dur });
      const cam = this.scene.cameras.main;
      const tint = this.scene.add
        .rectangle(0, 0, cam.width, cam.height, 0x280800, 0)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(FX - 2);
      this.scene.tweens.add({
        targets: tint,
        fillAlpha: 0.4,
        duration: 400,
        yoyo: true,
        hold: col.dur - 600,
        onComplete: () => tint.destroy(),
      });
      // o gigante sobe atrás dele (profundidade logo abaixo da do personagem) e respira
      this.giant?.destroy();
      const g = this.scene.add
        .image(c.x, c.y - 98 + 40, 'ult-giant-up')
        .setOrigin(GIANT_ORIGIN.x, GIANT_ORIGIN.y)
        .setScale(K)
        .setAlpha(0)
        .setDepth(ev.x + ev.y - 0.5);
      this.giant = g;
      // se a ultimate for interrompida (morte, troca de mapa) o estouro não vem: some sozinho
      this.scene.time.delayedCall(col.dur + 1500, () => {
        if (this.giant !== g) return;
        this.giant = null;
        this.fade(g, 400);
      });
      this.scene.tweens.add({ targets: g, alpha: 0.9, y: c.y - 98, duration: 400, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({
        targets: g,
        scaleX: K * 1.03,
        scaleY: K * 1.03,
        duration: 260,
        yoyo: true,
        repeat: Math.round(col.dur / 520),
      });
      // fagulhas subindo do gigante o tempo todo
      this.scene.time.addEvent({
        delay: 120,
        repeat: Math.round(col.dur / 120) - 1,
        callback: () =>
          this.burst(c.x + (Math.random() - 0.5) * 220, c.y - 60 - Math.random() * 120, 3, {
            speedY: { min: -90, max: -40 },
            speedX: { min: -20, max: 20 },
            lifespan: 700,
            scale: { start: 0.45, end: 0 },
            tint: tints,
          }),
      });
      this.burst(c.x, c.y - 60, 30, {
        speed: { min: 60, max: 180 },
        angle: { min: 200, max: 340 },
        lifespan: 800,
        scale: { start: 0.6, end: 0 },
        tint: tints,
      });
      return;
    }
    const final = ev.phase === 'final';
    if (final) {
      // esmagamento: as duas mãos caem no centro
      for (const s of [-1, 1]) this.giantFist({ x: c.x + s * 50, y: c.y + 6 }, ev.x + ev.y + 1, K * 1.7, col, true);
      this.scene.time.delayedCall(110, () => {
        this.scene.cameras.main.flash(260, 255, 210, 150);
        shakeCamera(this.scene, 420, 0.016);
        const r = this.iso(ev.radius);
        const ring = this.gfx(FX - 1).setPosition(c.x, c.y);
        ring.lineStyle(12, col.main, 1);
        ring.strokeEllipse(0, 0, r.w, r.h);
        ring.lineStyle(5, col.glow, 0.85);
        ring.strokeEllipse(0, 0, r.w * 1.04, r.h * 1.04);
        ring.setScale(0.1);
        this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 520, ease: 'Cubic.easeOut' });
        this.fade(ring, 820);
        this.burst(c.x, c.y - 20, 50, {
          speed: { min: 120, max: 340 },
          angle: { min: 180, max: 360 },
          gravityY: 300,
          lifespan: 900,
          scale: { start: 0.9, end: 0 },
          tint: tints,
        });
      });
      const g = this.giant;
      this.giant = null;
      if (g)
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          y: g.y - 30,
          duration: 700,
          delay: 250,
          onComplete: () => g.destroy(),
        });
      return;
    }
    for (const t of ev.targets) {
      const p = tileToScreen(t.x, t.y);
      // o braço daquele lado desce enquanto o punho cai no monstro
      const side = p.x < c.x ? 'l' : 'r';
      if (this.giant) {
        const g = this.giant;
        g.setTexture(`ult-giant-${side}`);
        this.scene.time.delayedCall(260, () => g.active && g === this.giant && g.setTexture('ult-giant-up'));
      }
      this.giantFist({ x: p.x, y: p.y + 4 }, t.x + t.y + 0.5, K * 0.75, col, false);
    }
  }
  /** Punho de fogo caindo do alto até `at`, com impacto (anel, pedras e fagulhas). */
  private giantFist(at: Pt, depth: number, scale: number, col: UltColors, big: boolean) {
    const f = this.scene.add
      .image(at.x, at.y - 170, 'ult-fist')
      .setOrigin(FIST_ORIGIN.x, FIST_ORIGIN.y)
      .setScale(scale)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: f,
      y: at.y,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.fade(f, big ? 500 : 260, { delay: big ? 150 : 40 });
        const ring = this.gfx(FX - 1).setPosition(at.x, at.y);
        ring.lineStyle(big ? 6 : 4, col.main, 0.95);
        ring.strokeEllipse(0, 0, 34, 17);
        ring.setScale(0.4);
        this.scene.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, duration: 380, ease: 'Cubic.easeOut' });
        this.fade(ring, 400);
        // pedras e fagulhas
        this.burst(at.x, at.y - 6, big ? 20 : 10, {
          speed: { min: 60, max: 180 },
          angle: { min: 200, max: 340 },
          gravityY: 500,
          lifespan: 600,
          scale: { start: big ? 0.8 : 0.55, end: 0 },
          tint: [0x5a3a2a, 0x7a4a2a, col.main],
          blendMode: 'NORMAL',
        });
        this.burst(at.x, at.y - 10, big ? 16 : 9, {
          speed: { min: 40, max: 150 },
          lifespan: 450,
          scale: { start: 0.5, end: 0 },
          tint: [col.core, col.main, col.glow],
        });
        if (!big) shakeCamera(this.scene, 80, 0.004);
      },
    });
  }

  // Geada (prévia aprovada: previews/ultimate-geada.html, opção B "Leque dos Mil Cristais")
  /** Lâmina de cristal apontando para +x (origem na ponta de trás do brilho). */
  private iceBlade(g: Phaser.GameObjects.Graphics, len: number, w: number, col: UltColors) {
    const pts = [
      { x: len * 0.4, y: 0 },
      { x: -len * 0.2, y: -w },
      { x: -len, y: 0 },
      { x: -len * 0.2, y: w },
    ];
    g.fillStyle(col.glow, 0.35);
    g.fillEllipse(-len * 0.3, 0, len * 1.6, w * 3.2);
    g.fillStyle(col.main, 0.9);
    g.fillPoints(pts, true);
    g.fillStyle(col.core, 1);
    g.fillPoints([pts[0], pts[1], { x: -len * 0.2, y: 0 }], true);
    g.lineStyle(1.2, col.core, 0.95);
    g.lineBetween(len * 0.4, 0, -len * 0.6, 0);
  }
  /** Bloco de gelo em volta de um monstro (congelado). */
  private iceBlock(g: Phaser.GameObjects.Graphics, col: UltColors) {
    const pts = [
      { x: -22, y: 6 },
      { x: -24, y: -30 },
      { x: -9, y: -46 },
      { x: 13, y: -44 },
      { x: 24, y: -26 },
      { x: 21, y: 6 },
      { x: 0, y: 12 },
    ];
    g.fillStyle(col.glow, 0.25);
    g.fillEllipse(0, -18, 64, 72);
    g.fillStyle(col.main, 0.45);
    g.fillPoints(pts, true);
    g.lineStyle(2, col.core, 0.95);
    g.strokePoints(pts, true);
    g.lineStyle(1.5, col.core, 0.7);
    g.lineBetween(-12, -36, -5, -4);
    g.lineBetween(8, -40, 14, -22);
  }
  private ultGeada(ev: UltEvent, col: UltColors, freezeSecs: number) {
    const c = tileToScreen(ev.x, ev.y);
    const tints = [col.core, col.main, col.glow];
    if (ev.phase === 'start') {
      const R = this.iso(ev.radius);
      const st = { k: 0, t: 0 };
      // floco de neve no chão + redemoinho de neve em volta dela, redesenhados a cada quadro
      const floor = this.gfx(FX - 1).setPosition(c.x, c.y);
      const swirl = this.gfx(FX + 1)
        .setPosition(c.x, c.y)
        .setBlendMode(Phaser.BlendModes.ADD);
      const fr = this.iso(2.2);
      const draw = () => {
        const k = st.k,
          a0 = st.t * 0.0012;
        floor.clear();
        floor.lineStyle(2, col.core, 0.7 * k);
        floor.strokeEllipse(0, 0, fr.w * k, fr.h * k);
        for (let i = 0; i < 6; i++) {
          const a = a0 + (i / 6) * Math.PI * 2,
            cs = Math.cos(a),
            sn = Math.sin(a),
            ex = cs * fr.w * 0.48 * k,
            ey = sn * fr.h * 0.48 * k;
          floor.lineStyle(3, col.main, 0.85 * k);
          floor.lineBetween(0, 0, ex, ey);
          // galhos do floco
          for (const f of [0.55, 0.78]) {
            const bx = ex * f,
              by = ey * f,
              len = 0.16 * k;
            for (const s of [-0.6, 0.6]) {
              const b = a + s;
              floor.lineBetween(bx, by, bx + Math.cos(b) * fr.w * len, by + Math.sin(b) * fr.h * len);
            }
          }
        }
        swirl.clear();
        const t = st.t;
        for (let i = 0; i < 56; i++) {
          const a = t / 260 + i * 0.7,
            r = 48 + ((i * 37) % 110),
            y0 = -((i * 13) % 60);
          swirl.fillStyle(i % 3 ? col.core : col.main, 0.65 * k);
          swirl.fillCircle(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.5 + y0 - 10, 1.2 + (i % 3));
        }
        for (let i = 0; i < 4; i++) {
          swirl.lineStyle(3, col.main, 0.4 * k);
          swirl.beginPath();
          const rx = 64 + i * 24,
            ry = 18 + i * 8,
            s0 = t / 200 + i;
          for (let q = 0; q <= 12; q++) {
            const a = s0 + (q / 12) * 2.2;
            const px = Math.cos(a) * rx,
              py = Math.sin(a) * ry - 10 - i * 12;
            if (q) swirl.lineTo(px, py);
            else swirl.moveTo(px, py);
          }
          swirl.strokePath();
        }
      };
      this.scene.tweens.add({ targets: st, k: 1, duration: 350, ease: 'Back.easeOut' });
      this.scene.tweens.add({
        targets: st,
        t: col.dur,
        duration: col.dur,
        onUpdate: draw,
        onComplete: () => {
          this.fade(floor, 300);
          this.fade(swirl, 300);
        },
      });
      // tela azulada (frio)
      const cam = this.scene.cameras.main;
      const tint = this.scene.add
        .rectangle(0, 0, cam.width, cam.height, 0x0a1e46, 0)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(FX - 2);
      this.scene.tweens.add({
        targets: tint,
        fillAlpha: 0.4,
        duration: 400,
        yoyo: true,
        hold: col.dur - 600,
        onComplete: () => tint.destroy(),
      });
      // ondas de lâminas de cristal em espiral, sem parar (uma a cada 0,25 s, 8 lâminas por onda)
      const waves = Math.round(col.dur / 250);
      this.scene.time.addEvent({
        delay: 250,
        repeat: waves - 1,
        callback: () => {
          const base = Math.random() * Math.PI * 2;
          for (let k = 0; k < 8; k++) {
            const g = this.gfx(FX + 2).setBlendMode(Phaser.BlendModes.ADD);
            this.iceBlade(g, 26, 5, col);
            const sp = { r: 0.15, a: base + (k / 8) * Math.PI * 2 };
            this.scene.tweens.add({
              targets: sp,
              r: 1,
              a: sp.a + 1.1,
              duration: 650,
              ease: 'Sine.easeOut',
              onUpdate: () => {
                const x = Math.cos(sp.a) * R.w * 0.5 * sp.r,
                  y = Math.sin(sp.a) * R.h * 0.5 * sp.r;
                g.setPosition(c.x + x, c.y - 30 + y);
                g.setRotation(Math.atan2(Math.sin(sp.a) * R.h, Math.cos(sp.a) * R.w) + Math.PI / 2 + 0.6);
                g.setAlpha(Math.min(1, (1 - sp.r) * 3));
              },
              onComplete: () => g.destroy(),
            });
          }
        },
      });
      // neve saindo do leque
      this.burst(c.x, c.y - 60, 28, {
        speed: { min: 60, max: 170 },
        angle: { min: 200, max: 340 },
        lifespan: 800,
        scale: { start: 0.6, end: 0 },
        tint: tints,
      });
      return;
    }
    const final = ev.phase === 'final';
    for (const t of ev.targets) {
      const p = tileToScreen(t.x, t.y);
      // lâmina cravando no alvo e cristais brotando
      const g = this.gfx(FX + 2).setBlendMode(Phaser.BlendModes.ADD);
      const ang = Math.atan2(p.y - c.y, p.x - c.x);
      this.iceBlade(g, final ? 40 : 30, final ? 7 : 5, col);
      g.setPosition(p.x - Math.cos(ang) * 40, p.y - 20 - Math.sin(ang) * 40).setRotation(ang);
      this.scene.tweens.add({ targets: g, x: p.x, y: p.y - 20, duration: 90 });
      this.fade(g, 260, { delay: 90 });
      const cr = this.gfx(FX).setPosition(p.x, p.y);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.45;
        this.crystal(cr, Math.cos(a) * 6, 4, 16 + (k % 2) * 8, 4, a + Math.PI / 2);
      }
      cr.setScale(0.2, 0);
      this.scene.tweens.add({ targets: cr, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
      this.fade(cr, 380, { delay: 220 });
      const ring = this.gfx(FX - 1).setPosition(p.x, p.y);
      ring.lineStyle(3, col.main, 0.9);
      ring.strokeEllipse(0, 0, 30, 15);
      ring.setScale(0.4);
      this.scene.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, duration: 360, ease: 'Cubic.easeOut' });
      this.fade(ring, 380);
      this.burst(p.x, p.y - 14, final ? 14 : 8, {
        speed: { min: 30, max: 130 },
        lifespan: 500,
        scale: { start: 0.5, end: 0 },
        tint: tints,
      });
      if (final && t.hit !== false && freezeSecs > 0) {
        // congelado: bloco de gelo enquanto dura o atordoamento, depois estilhaça
        const b = this.gfx(FX + 1).setPosition(p.x, p.y);
        this.iceBlock(b, col);
        b.setScale(0.3);
        this.scene.tweens.add({ targets: b, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
        const hold = Math.max(300, freezeSecs * 1000);
        this.scene.time.delayedCall(hold, () => {
          b.destroy();
          this.burst(p.x, p.y - 18, 18, {
            speed: { min: 60, max: 200 },
            angle: { min: 180, max: 360 },
            gravityY: 400,
            lifespan: 600,
            scale: { start: 0.7, end: 0 },
            tint: tints,
          });
        });
      }
    }
    if (!final) {
      shakeCamera(this.scene, 70, 0.0025);
      return;
    }
    // estouro: clarão gelado, anel de geada do tamanho da área e estilhaços
    this.scene.cameras.main.flash(260, 220, 240, 255);
    shakeCamera(this.scene, 360, 0.01);
    const r = this.iso(ev.radius);
    const ring = this.gfx(FX - 1).setPosition(c.x, c.y);
    ring.lineStyle(10, col.main, 1);
    ring.strokeEllipse(0, 0, r.w, r.h);
    ring.lineStyle(4, col.glow, 0.8);
    ring.strokeEllipse(0, 0, r.w * 1.04, r.h * 1.04);
    ring.setScale(0.1);
    this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 520, ease: 'Cubic.easeOut' });
    this.fade(ring, 820);
    this.burst(c.x, c.y - 30, 44, {
      speed: { min: 120, max: 320 },
      lifespan: 800,
      scale: { start: 0.8, end: 0 },
      tint: tints,
    });
  }
}
