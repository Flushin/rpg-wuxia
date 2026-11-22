import Phaser from 'phaser';
import { TILE_H, TILE_W, tileToScreen } from '../core/iso';
import { skillById } from '../core/skills';
import type { GameEvent } from '../core/types';
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

  // ---------- ultimate da Tormenta (prévia aprovada: previews/ultimate-tormenta-a.html) ----------
  /** Raio da ultimate: halo azul-gelo, corpo amarelo e miolo branco, com galhos. */
  private ultBolt(a: Pt, b: Pt, w: number, jag: number, segs = 10) {
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
    g.lineStyle(w * 2.8, 0x9fe6ff, 0.3);
    g.strokePoints(pts);
    g.lineStyle(w * 1.3, 0xffd23a, 0.95);
    g.strokePoints(pts);
    g.lineStyle(w * 0.45, 0xfffdf2, 1);
    g.strokePoints(pts);
    for (let k = 0; k < 2; k++) {
      const q = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
      g.lineStyle(Math.max(1, w * 0.3), 0xb4ebff, 0.85);
      g.lineBetween(q.x, q.y, q.x + (Math.random() - 0.5) * 50, q.y + Math.random() * 30);
    }
    this.fade(g, 260);
  }
  private ultimate(ev: Extract<GameEvent, { type: 'ultimate' }>) {
    const c = tileToScreen(ev.x, ev.y);
    const sky = (p: Pt) => ({ x: p.x + (Math.random() - 0.5) * 60, y: p.y - 320 });
    if (ev.phase === 'start') {
      // círculo de runas amarelas no chão, girando durante os 3 s
      const r = this.iso(2.2);
      const g = this.gfx(FX - 1).setPosition(c.x, c.y);
      const st = { a: 0, k: 0 };
      const draw = () => {
        g.clear();
        g.lineStyle(3, 0xffd23a, 0.85 * st.k);
        g.strokeEllipse(0, 0, r.w * st.k, r.h * st.k);
        g.lineStyle(2, 0x9fe6ff, 0.6 * st.k);
        g.strokeEllipse(0, 0, r.w * 0.74 * st.k, r.h * 0.74 * st.k);
        for (let i = 0; i < 8; i++) {
          const t = st.a + (i / 8) * Math.PI * 2,
            cs = Math.cos(t),
            sn = Math.sin(t);
          g.lineStyle(3, 0xffd23a, 0.85 * st.k);
          g.lineBetween(cs * r.w * 0.37 * st.k, sn * r.h * 0.37 * st.k, cs * r.w * 0.5 * st.k, sn * r.h * 0.5 * st.k);
        }
      };
      this.scene.tweens.add({ targets: st, k: 1, duration: 400, ease: 'Back.easeOut' });
      this.scene.tweens.add({
        targets: st,
        a: Math.PI * 3,
        duration: 3000,
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
        hold: 2400,
        onComplete: () => dark.destroy(),
      });
      // raios soltos no céu o tempo todo (um a cada ~0,1 s): a tempestade nunca para, mesmo sem monstro perto
      this.scene.time.addEvent({
        delay: 110,
        repeat: 26,
        callback: () => {
          const x = c.x + (Math.random() - 0.5) * 560,
            y = c.y - 120 + (Math.random() - 0.5) * 220;
          this.ultBolt({ x, y: y - 220 }, { x: x + (Math.random() - 0.5) * 60, y }, 1.6, 18, 6);
        },
      });
      // faíscas subindo das mãos
      this.burst(c.x, c.y - 70, 24, {
        speed: { min: 60, max: 160 },
        angle: { min: 230, max: 310 },
        lifespan: 700,
        scale: { start: 0.6, end: 0 },
        tint: [0xffd23a, 0xffffff, 0x9fe6ff],
      });
      return;
    }
    const final = ev.phase === 'final';
    for (const t of ev.targets) {
      const p = tileToScreen(t.x, t.y);
      this.ultBolt(sky(p), { x: p.x, y: p.y - 10 }, final ? 4 : 3, 24);
      const ring = this.gfx(FX - 1).setPosition(p.x, p.y);
      ring.lineStyle(3, 0xffd23a, 0.9);
      ring.strokeEllipse(0, 0, 30, 15);
      ring.setScale(0.4);
      this.scene.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, duration: 360, ease: 'Cubic.easeOut' });
      this.fade(ring, 380);
      this.burst(p.x, p.y - 12, final ? 14 : 8, {
        speed: { min: 40, max: 150 },
        lifespan: 450,
        scale: { start: 0.5, end: 0 },
        tint: [0xffd23a, 0xffffff, 0x9fe6ff],
      });
    }
    if (!final) {
      shakeCamera(this.scene, 90, 0.003);
      return;
    }
    // estouro final: raio gigante no personagem, clarão amarelado e anel do tamanho da área
    this.ultBolt({ x: c.x, y: c.y - 420 }, { x: c.x, y: c.y - 40 }, 10, 30, 14);
    this.scene.cameras.main.flash(260, 255, 244, 200);
    shakeCamera(this.scene, 380, 0.012);
    const r = this.iso(ev.radius);
    const ring = this.gfx(FX - 1).setPosition(c.x, c.y);
    ring.lineStyle(10, 0xffd23a, 1);
    ring.strokeEllipse(0, 0, r.w, r.h);
    ring.lineStyle(4, 0x9fe6ff, 0.8);
    ring.strokeEllipse(0, 0, r.w * 1.04, r.h * 1.04);
    ring.setScale(0.1);
    this.scene.tweens.add({ targets: ring, scaleX: 1, scaleY: 1, duration: 520, ease: 'Cubic.easeOut' });
    this.fade(ring, 820);
    this.burst(c.x, c.y - 30, 40, {
      speed: { min: 120, max: 320 },
      lifespan: 800,
      scale: { start: 0.8, end: 0 },
      tint: [0xffd23a, 0xffffff, 0x9fe6ff],
    });
  }
}
