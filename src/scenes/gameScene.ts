import Phaser from 'phaser';
import { screenToTile, tileToScreen } from '../core/iso';
import type { Entity, GameEvent } from '../core/types';
import type { World } from '../core/world';
import { EntityView } from '../render/entityView';
import { buildMapView } from '../render/mapView';
import { audio } from '../render/audio';
import { SkillFx } from '../render/skillFx';
import { SKILLS } from '../core/skills';
import { writeSave } from '../save';
import { setupControls } from '../ui/controls';
import { Hud } from '../ui/hud';
import { TipManager } from '../ui/tips';
import { MONSTERS } from '../core/data';
import { itemColor } from '../core/items';

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hud!: Hud;
  private tips!: TipManager;
  private fx!: SkillFx;
  private mapObjs: Phaser.GameObjects.GameObject[] = [];
  private views = new Map<number, EntityView>();
  private groundViews = new Map<number, Phaser.GameObjects.Graphics>();

  constructor() { super('Game'); }
  init(data: { world: World }) { this.world = data.world; }

  create() {
    audio.bind(this, this.world.audio, () => { void writeSave(this.world.serialize()); });
    audio.playMusicForMap(this.world.mapId);
    this.hud = new Hud(this.world);
    this.fx = new SkillFx(this);
    setupControls(this.world, this.hud);
    this.tips = new TipManager(this.world, () => { void writeSave(this.world.serialize()); });
    this.cameras.main.setBackgroundColor('#10141c');
    this.rebuildMap();
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));

    const save = () => { void writeSave(this.world.serialize()); };
    const timer = window.setInterval(save, 30000);
    const vis = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', save);
    this.events.once('shutdown', () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', save); });
  }

  private applyZoom() {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.min(width, height) / 520, 0.9, 1.6));
  }

  private rebuildMap() {
    this.mapObjs.forEach((o) => o.destroy());
    this.views.forEach((v) => v.destroy());
    this.views.clear();
    this.mapObjs = buildMapView(this, this.world.map);
    const pv = this.viewFor(this.world.player);
    this.cameras.main.startFollow(pv.container, true, 0.12, 0.12);
    const s = tileToScreen(this.world.player.x, this.world.player.y);
    this.cameras.main.centerOn(s.x, s.y);
  }

  private textureFor(e: Entity, idx = 0): string {
    if (e.kind === 'player') return 'player-' + this.world.classId;
    if (e.kind === 'monster') return MONSTERS[e.monsterId].sprite;
    return 'npc-' + (idx % 3);
  }

  private viewFor(e: Entity, idx = 0): EntityView {
    let v = this.views.get(e.id);
    if (!v) { v = new EntityView(this, e, this.textureFor(e, idx)); this.views.set(e.id, v); }
    return v;
  }

  private onPointer(p: Phaser.Input.Pointer) {
    if (this.world.player.dead || p.button !== 0) return;
    let best: Entity | null = null, bd = Infinity;
    for (const m of this.world.monsters) {
      if (m.dead) continue;
      const s = tileToScreen(m.x, m.y), dx = p.worldX - s.x, dy = p.worldY - (s.y - 14);
      if (Math.abs(dx) < 26 && Math.abs(dy) < 26 && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); best = m; }
    }
    if (best) { this.world.setTarget(best.id); return; }
    let npc: Entity | null = null; bd = Infinity;
    for (const n of this.world.npcs) {
      const s = tileToScreen(n.x, n.y), dx = p.worldX - s.x, dy = p.worldY - (s.y - 20);
      if (Math.abs(dx) < 28 && Math.abs(dy) < 36 && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); npc = n; }
    }
    if (npc) { this.world.interactNpc(npc.id); return; }
    if (p.wasTouch) return; // toque usa o joystick; mouse continua com clique-para-mover
    const t = screenToTile(p.worldX, p.worldY);
    this.world.moveTo(t.x, t.y);
  }

  update(_t: number, delta: number) {
    const w = this.world;
    w.advance(delta / 1000);
    const evs = w.events.splice(0);
    for (const ev of evs) this.handle(ev);

    const live = new Set<number>([w.player.id]);
    this.viewFor(w.player).sync(w.player, false);
    w.npcs.forEach((n, i) => { live.add(n.id); this.viewFor(n, i).sync(n, false); });
    for (const m of w.monsters) { live.add(m.id); this.viewFor(m).sync(m, m.id === w.targetId); }
    for (const [id, v] of this.views) if (!live.has(id)) { v.destroy(); this.views.delete(id); }
    this.syncGround();
    this.tips.update();
    this.hud.update();
  }

  private syncGround() {
    const live = new Set<number>();
    for (const g of this.world.ground) {
      live.add(g.id);
      let v = this.groundViews.get(g.id);
      if (!v) {
        const col = Phaser.Display.Color.HexStringToColor(itemColor(g.item!)).color;
        v = this.add.graphics();
        v.fillStyle(col, 0.35); v.fillEllipse(0, 0, 30, 15);
        v.fillStyle(col, 1); v.fillPoints([{ x: 0, y: -14 }, { x: 7, y: -7 }, { x: 0, y: 0 }, { x: -7, y: -7 }], true);
        v.lineStyle(1, 0xffffff, 0.9); v.strokePoints([{ x: 0, y: -14 }, { x: 7, y: -7 }, { x: 0, y: 0 }, { x: -7, y: -7 }], true);
        this.groundViews.set(g.id, v);
      }
      const s = tileToScreen(g.x, g.y);
      v.setPosition(s.x, s.y + Math.sin(this.time.now / 250 + g.id) * 2).setDepth(g.x + g.y);
      v.setAlpha(g.expires - this.world.time < 10 ? 0.4 + 0.6 * Math.abs(Math.sin(this.time.now / 150)) : 1);
    }
    for (const [id, v] of this.groundViews) if (!live.has(id)) { v.destroy(); this.groundViews.delete(id); }
  }

  // drop coletado: brilho que voa até o jogador
  private dropFx(x: number, y: number, color: string) {
    const col = Phaser.Display.Color.HexStringToColor(color).color;
    const a = tileToScreen(x, y), b = tileToScreen(this.world.player.x, this.world.player.y);
    const g = this.add.graphics().setDepth(99999);
    g.fillStyle(col, 1); g.fillCircle(0, 0, 5); g.lineStyle(1, 0xffffff, 1); g.strokeCircle(0, 0, 5);
    g.setPosition(a.x, a.y - 10);
    this.tweens.add({ targets: g, y: a.y - 34, duration: 250, ease: 'Cubic.easeOut', onComplete: () => {
      this.tweens.add({ targets: g, x: b.x, y: b.y - 24, alpha: 0, duration: 300, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    } });
  }

  private handle(ev: GameEvent) {
    this.tips.onEvent(ev);
    audio.onEvent(ev, this.world.player.id);
    switch (ev.type) {
      case 'mapChange': this.rebuildMap(); break;
      case 'hit': {
        const s = tileToScreen(ev.x, ev.y), toPlayer = ev.targetKind === 'player';
        this.floatText(s.x, s.y - 40, ev.crit ? `${ev.amount}!` : String(ev.amount), toPlayer ? '#ff5555' : ev.crit ? '#ffd23f' : '#ffffff', ev.crit ? 22 : 16);
        this.views.get(ev.targetId)?.flash();
        break;
      }
      case 'miss': {
        const s = tileToScreen(ev.x, ev.y);
        this.floatText(s.x, s.y - 40, 'Errou', '#aaaaaa', 13);
        break;
      }
      case 'attack': this.beam(ev); break;
      case 'skillCast': case 'dash': this.fx.onEvent(ev); break;
      case 'skillFail': {
        const msg = { mana: 'Sem mana', cooldown: 'Recarregando', notarget: 'Sem alvo', blocked: 'Caminho bloqueado', locked: 'Bloqueada' }[ev.reason];
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 64, msg, ev.reason === 'mana' ? '#6aa8ff' : '#dddddd', 15);
        break;
      }
      case 'skillUnlocked': this.hud.toast(`Nova skill desbloqueada: ${Object.values(SKILLS).flat().find((d) => d.id === ev.skillId)?.name ?? ''}`); break;
      case 'skillLevelUp': {
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 80, `${Object.values(SKILLS).flat().find((d) => d.id === ev.skillId)?.name} nv ${ev.level}!`, '#ffd23f', 15);
        break;
      }
      case 'buffApplied':
        if (ev.kind === 'shield' && ev.targetId === this.world.player.id) { const s = tileToScreen(this.world.player.x, this.world.player.y); this.floatText(s.x, s.y - 64, 'Escudo', '#bfe0ff', 15); }
        break;
      case 'shieldAbsorb': { const s = tileToScreen(ev.x, ev.y); this.floatText(s.x, s.y - 40, `(${Math.round(ev.amount)})`, '#9fd0ff', 14); break; }
      case 'drop': this.dropFx(ev.x, ev.y, ev.color); break;
      case 'itemPickup': this.hud.toast(`+ ${ev.name}${ev.qty > 1 ? ` x${ev.qty}` : ''}`, ev.color); break;
      case 'goldPickup': this.hud.toast(`+ ${ev.amount} ouro`, '#ffd23f'); break;
      case 'bagFull': this.hud.toast('Mochila cheia', '#ff8a80'); break;
      case 'durabilityLost': this.hud.toast('Seus equipamentos perderam durabilidade', '#f1a02e'); break;
      case 'potionFail': {
        const msg = { none: 'Sem poção', cooldown: 'Recarregando', full: ev.kind === 'hp' ? 'Vida cheia' : 'Mana cheia' }[ev.reason];
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 64, msg, '#dddddd', 15);
        break;
      }
      case 'levelup': this.hud.toast(`Nível ${ev.level}! +3 pontos de atributo`); break;
      case 'playerDeath': this.hud.toast('Você morreu... Renascendo na vila'); break;
      default: break;
    }
  }

  private beam(ev: Extract<GameEvent, { type: 'attack' }>) {
    const a = this.views.get(ev.fromId), t = this.views.get(ev.toId);
    if (!a || !t) return;
    const fromPlayer = ev.fromId === this.world.player.id;
    const color = !fromPlayer ? 0xffffff : this.world.player.element === 'ice' ? 0x9ee0ff : 0xffe14a;
    const g = this.add.graphics().setDepth(99998);
    g.lineStyle(ev.ranged ? 3 : 4, color, 1);
    const x1 = a.container.x, y1 = a.container.y - 18, x2 = t.container.x, y2 = t.container.y - 18;
    if (ev.ranged) g.lineBetween(x1, y1, x2, y2);
    else { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; g.lineBetween(mx - 10, my - 10, mx + 10, my + 10); }
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: string, size: number) {
    x += Phaser.Math.Between(-8, 8);
    const t = this.add.text(x, y, text, { fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(100000).setResolution(2);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
