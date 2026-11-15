import Phaser from 'phaser';
import { L } from '../core/i18n';
import { screenToTile, tileToScreen } from '../core/iso';
import type { Entity, GameEvent } from '../core/types';
import type { World } from '../core/world';
import { EntityView } from '../render/entityView';
import { buildMapView, fadeTreesNear } from '../render/mapView';
import { audio } from '../render/audio';
import { SkillFx } from '../render/skillFx';
import { SKILLS } from '../core/skills';
import { writeSave } from '../save';
import { setupControls } from '../ui/controls';
import { Hud } from '../ui/hud';
import { TipManager } from '../ui/tips';
import { MONSTERS } from '../core/data';
import { itemColor } from '../core/items';
import { DPR, cssSize } from '../render/display';

// zoom do jogador: só aproxima (100% = visão normal, até 200%) para não dar vantagem de ver longe
const ZOOM_MIN = 1, ZOOM_MAX = 2, ZOOM_KEY = 'rpg-zoom';
const TEXT_RES = DPR * 2;
const loadZoom = () => { try { const v = Number(localStorage.getItem(ZOOM_KEY)); return v >= ZOOM_MIN && v <= ZOOM_MAX ? v : 1; } catch { return 1; } };

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hud!: Hud;
  private tips!: TipManager;
  private fx!: SkillFx;
  private mapObjs: Phaser.GameObjects.GameObject[] = [];
  private trees: Phaser.GameObjects.Image[] | null = null;
  private views = new Map<number, EntityView>();
  private groundViews = new Map<number, Phaser.GameObjects.Graphics>();
  private autoText!: Phaser.GameObjects.Text;
  private teleViews = new Map<number, Phaser.GameObjects.Graphics>();
  private userZoom = loadZoom();
  private pinch: { d: number; z: number } | null = null;

  constructor() { super('Game'); }
  init(data: { world: World }) { this.world = data.world; }

  create() {
    audio.bind(this, this.world.audio, () => { void writeSave(this.world.serialize()); });
    audio.playMusicForMap(this.world.mapId);
    this.hud = new Hud(this.world);
    this.fx = new SkillFx(this);
    setupControls(this.world, this.hud);
    this.tips = new TipManager(this.world, () => { void writeSave(this.world.serialize()); }, () => {
      // salva e recarrega a página: volta à tela inicial com tudo limpo (HUD, áudio e timers)
      void writeSave(this.world.serialize()).finally(() => window.location.reload());
    });
    this.autoText = this.add.text(0, 0, '', { fontSize: '12px', color: '#9fe8a0', fontStyle: 'bold', align: 'center', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(100001).setResolution(TEXT_RES).setVisible(false);
    const rep = this.world.offlineReport;
    this.world.offlineReport = null;
    if (rep) this.hud.showOffline(rep, () => this.world.auto.resume()); else this.world.auto.resume();
    this.cameras.main.setBackgroundColor('#10141c');
    this.rebuildMap();
    this.applyZoom();
    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setUserZoom(this.userZoom * (dy > 0 ? 1 / 1.1 : 1.1)));
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    const save = () => { void writeSave(this.world.serialize()); };
    const timer = window.setInterval(save, 30000);
    const vis = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', save);
    this.events.once('shutdown', () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', save); });
  }

  private applyZoom() {
    const { w, h } = cssSize();
    const base = Phaser.Math.Clamp(Math.min(w, h) / 520, 0.9, 1.6);
    this.cameras.main.setZoom(base * DPR * this.userZoom);
  }

  private setUserZoom(z: number) {
    z = Phaser.Math.Clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(z - 1) < 0.03) z = 1; // gruda em 100%
    if (z === this.userZoom) return;
    this.userZoom = z;
    try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* sem armazenamento */ }
    this.applyZoom();
  }

  // pinça com dois dedos no canvas (o joystick e os botões são HTML e não contam aqui)
  private touchPointers() { return this.input.manager.pointers.filter((p) => p.isDown && p.wasTouch); }
  private updatePinch() {
    const ps = this.touchPointers();
    if (ps.length < 2) { this.pinch = null; return; }
    const d = Phaser.Math.Distance.Between(ps[0].x, ps[0].y, ps[1].x, ps[1].y);
    if (!this.pinch) { this.pinch = { d: Math.max(1, d), z: this.userZoom }; return; }
    this.setUserZoom(this.pinch.z * (d / this.pinch.d));
  }

  private rebuildMap() {
    this.mapObjs.forEach((o) => o.destroy());
    this.views.forEach((v) => v.destroy());
    this.views.clear();
    this.mapObjs = buildMapView(this, this.world.map);
    this.trees = null;
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

  /** Posição do toque/clique no mundo, medida na hora com a posição real do canvas.
   *  No celular a barra do navegador aparece/some e desloca a página; a posição que o Phaser
   *  guardou fica velha e o toque caía fora do NPC/monstro. */
  private pointerWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    const ev = p.event as (TouchEvent | MouseEvent | undefined);
    let cx: number | undefined, cy: number | undefined;
    if (ev && 'changedTouches' in ev && ev.changedTouches.length) {
      const t = [...ev.changedTouches].find((q) => q.identifier === p.identifier) ?? ev.changedTouches[0];
      cx = t.clientX; cy = t.clientY;
    } else if (ev && 'clientX' in ev) { cx = ev.clientX; cy = ev.clientY; }
    const canvas = this.game.canvas, r = canvas.getBoundingClientRect();
    if (cx === undefined || cy === undefined || !r.width || !r.height) return { x: p.worldX, y: p.worldY };
    const wp = this.cameras.main.getWorldPoint((cx - r.left) * (canvas.width / r.width), (cy - r.top) * (canvas.height / r.height));
    return { x: wp.x, y: wp.y };
  }

  private onPointer(p: Phaser.Input.Pointer) {
    if (this.world.player.dead || p.button !== 0) return;
    const fingers = p.event && 'touches' in p.event ? (p.event as TouchEvent).touches.length : this.touchPointers().length;
    if (p.wasTouch && fingers > 1) return; // segundo dedo = pinça
    const { x: wx, y: wy } = this.pointerWorld(p);
    const k = p.wasTouch ? 1.5 : 1; // dedo é menos preciso que o mouse: área de toque maior
    let best: Entity | null = null, bd = Infinity;
    for (const m of this.world.monsters) {
      if (m.dead) continue;
      const s = tileToScreen(m.x, m.y), dx = wx - s.x, dy = wy - (s.y - 14);
      if (Math.abs(dx) < 26 * k && Math.abs(dy) < 26 * k && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); best = m; }
    }
    if (best) { this.world.setTarget(best.id); return; }
    let npc: Entity | null = null; bd = Infinity;
    for (const n of this.world.npcs) {
      const s = tileToScreen(n.x, n.y), dx = wx - s.x, dy = wy - (s.y - 24);
      if (Math.abs(dx) < 28 * k && Math.abs(dy) < 40 * k && Math.hypot(dx, dy) < bd) { bd = Math.hypot(dx, dy); npc = n; }
    }
    if (npc) { this.world.interactNpc(npc.id); return; }
    if (p.wasTouch) return; // toque usa o joystick; mouse continua com clique-para-mover
    const t = screenToTile(wx, wy);
    this.world.moveTo(t.x, t.y);
  }

  update(_t: number, delta: number) {
    const w = this.world;
    this.updatePinch();
    w.advance(delta / 1000);
    const evs = w.events.splice(0);
    for (const ev of evs) this.handle(ev);

    const live = new Set<number>([w.player.id]);
    const tgt = w.monsters.find((m) => m.id === w.targetId && !m.dead);
    if (tgt && Math.hypot(tgt.x - w.player.x, tgt.y - w.player.y) <= w.player.attackRange + 1) this.viewFor(w.player).face(tgt.x, tgt.y, w.player.x, w.player.y);
    this.viewFor(w.player).sync(w.player, false);
    w.npcs.forEach((n, i) => { live.add(n.id); this.viewFor(n, i).sync(n, false); });
    for (const m of w.monsters) {
      live.add(m.id);
      const v = this.viewFor(m);
      if (m.ai === 'chase' && !w.player.dead) v.face(w.player.x, w.player.y, m.x, m.y);
      v.sync(m, m.id === w.targetId);
    }
    for (const [id, v] of this.views) if (!live.has(id)) { v.destroy(); this.views.delete(id); }
    if (!this.trees) this.trees = this.mapObjs.filter((o) => o.name === 'tree') as Phaser.GameObjects.Image[];
    {
      const who: { x: number; y: number; depth: number }[] = [];
      for (const e of [w.player, tgt]) { const v = e && this.views.get(e.id); if (e && v) who.push({ x: v.container.x, y: v.container.y, depth: e.x + e.y }); }
      fadeTreesNear(this.trees, who);
    }
    this.syncGround();
    this.syncTelegraphs();
    this.syncAutoText();
    this.tips.update();
    this.hud.update();
  }

  // círculo vermelho no chão: preenche até o impacto
  private syncTelegraphs() {
    const live = new Set<number>();
    for (const t of this.world.telegraphs) {
      live.add(t.id);
      let g = this.teleViews.get(t.id);
      if (!g) { g = this.add.graphics().setDepth(-80000); this.teleViews.set(t.id, g); }
      const c = tileToScreen(t.x, t.y), rx = t.radius * 45.25, ry = t.radius * 22.63, k = Math.max(0, Math.min(1, 1 - t.remaining / t.delay));
      g.clear().setPosition(c.x, c.y);
      g.fillStyle(0xff2020, 0.14); g.fillEllipse(0, 0, rx * 2, ry * 2);
      g.fillStyle(0xff3030, 0.28 + 0.25 * k); g.fillEllipse(0, 0, rx * 2 * k, ry * 2 * k);
      g.lineStyle(3, 0xff5050, 0.95); g.strokeEllipse(0, 0, rx * 2, ry * 2);
    }
    for (const [id, g] of this.teleViews) if (!live.has(id)) { g.destroy(); this.teleViews.delete(id); }
  }

  private arrowFx(ev: Extract<GameEvent, { type: 'projectile' }>) {
    const a = tileToScreen(ev.fromX, ev.fromY), b = tileToScreen(ev.toX, ev.toY);
    const g = this.add.graphics().setDepth(99998);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.lineStyle(2, 0xe8d8a8, 1); g.lineBetween(-9, 0, 9, 0);
    g.fillStyle(0xcccccc, 1); g.fillTriangle(9, 0, 4, -3, 4, 3);
    g.fillStyle(0xc02828, 1); g.fillTriangle(-9, 0, -12, -3, -12, 3);
    g.setPosition(a.x, a.y - 20).setRotation(ang);
    this.tweens.add({ targets: g, x: b.x, y: b.y - 20, duration: Math.max(120, Math.hypot(b.x - a.x, b.y - a.y) * 1.6), ease: 'Linear', onComplete: () => g.destroy() });
  }

  private syncAutoText() {
    const a = this.world.auto, p = this.world.player, show = a.state !== 'off' && !p.dead;
    this.autoText.setVisible(show);
    if (!show) return;
    const s = tileToScreen(p.x, p.y);
    this.autoText.setText(a.state === 'pausado' ? L('Auto pausado', 'Auto paused') : a.status ? `Auto\n${a.status}` : 'Auto')
      .setColor(a.state === 'pausado' ? '#f0c060' : '#9fe8a0').setPosition(s.x, s.y - 70);
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
        this.floatText(s.x, s.y - 40, L('Errou', 'Miss'), '#aaaaaa', 13);
        break;
      }
      case 'attack': this.swing(ev.fromId, ev.toId); if (!this.isArcher(ev.fromId)) this.beam(ev); break;
      case 'projectile': this.arrowFx(ev); break;
      case 'bossSummon': this.hud.toast(L('O General invoca guerreiros!', 'The General summons warriors!'), '#ff8a60'); break;
      case 'bossDefeated': this.hud.toast(L('General de Terracota derrotado!', 'Terracotta General defeated!'), '#ffd23f'); break;
      case 'telegraphResolved': if (ev.hit) { const s = tileToScreen(ev.x, ev.y); this.cameras.main.shake(180, 0.006); this.floatText(s.x, s.y - 20, L('Golpe em área!', 'Area strike!'), '#ff6a50', 15); } break;
      case 'skillCast': {
        const c = this.entityById(ev.casterId);
        if (c) this.views.get(c.id)?.attack(ev.tx, ev.ty, c.x, c.y); // sem alvo: tx,ty = posição dele (mantém a direção)
        this.fx.onEvent(ev); break;
      }
      case 'dash': this.fx.onEvent(ev); break;
      case 'skillFail': {
        const msg = { mana: L('Sem mana', 'No mana'), cooldown: L('Recarregando', 'On cooldown'), notarget: L('Sem alvo', 'No target'), blocked: L('Caminho bloqueado', 'Path blocked'), locked: L('Bloqueada', 'Locked') }[ev.reason];
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 64, msg, ev.reason === 'mana' ? '#6aa8ff' : '#dddddd', 15);
        break;
      }
      case 'skillUnlocked': this.hud.toast(L('Nova skill desbloqueada: ', 'New skill unlocked: ') + (Object.values(SKILLS).flat().find((d) => d.id === ev.skillId)?.name ?? '')); break;
      case 'skillLevelUp': {
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 80, `${Object.values(SKILLS).flat().find((d) => d.id === ev.skillId)?.name} ${L('nv', 'lv')} ${ev.level}!`, '#ffd23f', 15);
        break;
      }
      case 'buffApplied':
        if (ev.kind === 'shield' && ev.targetId === this.world.player.id) { const s = tileToScreen(this.world.player.x, this.world.player.y); this.floatText(s.x, s.y - 64, L('Escudo', 'Shield'), '#bfe0ff', 15); }
        break;
      case 'shieldAbsorb': { const s = tileToScreen(ev.x, ev.y); this.floatText(s.x, s.y - 40, `(${Math.round(ev.amount)})`, '#9fd0ff', 14); break; }
      case 'drop': this.dropFx(ev.x, ev.y, ev.color); break;
      case 'itemPickup': this.hud.toast(`+ ${ev.name}${ev.qty > 1 ? ` x${ev.qty}` : ''}`, ev.color); break;
      case 'goldPickup': this.hud.toast(`+ ${ev.amount} ${L('ouro', 'gold')}`, '#ffd23f'); break;
      case 'bagFull': this.hud.toast(L('Mochila cheia', 'Bag full'), '#ff8a80'); break;
      case 'autoStopped': this.hud.toast(L('Auto-combate parado: item quebrado. Conserte no Ferreiro.', 'Auto-battle stopped: broken item. Repair it with the Blacksmith.'), '#ff8a80'); break;
      case 'durabilityLost': this.hud.toast(L('Seus equipamentos perderam durabilidade', 'Your equipment lost durability'), '#f1a02e'); break;
      case 'potionFail': {
        const msg = { none: L('Sem poção', 'No potion'), cooldown: L('Recarregando', 'On cooldown'), full: ev.kind === 'hp' ? L('Vida cheia', 'Health full') : L('Mana cheia', 'Mana full') }[ev.reason];
        const s = tileToScreen(this.world.player.x, this.world.player.y);
        this.floatText(s.x, s.y - 64, msg, '#dddddd', 15);
        break;
      }
      case 'levelup': this.hud.toast(L(`Nível ${ev.level}! +3 pontos de atributo`, `Level ${ev.level}! +3 attribute points`)); break;
      case 'playerDeath': this.hud.toast(L('Você morreu... Renascendo na vila', 'You died... Respawning in the village')); break;
      default: break;
    }
  }

  private entityById(id: number): Entity | undefined {
    const w = this.world;
    return id === w.player.id ? w.player : w.monsters.find((m) => m.id === id) ?? w.npcs.find((n) => n.id === id);
  }

  /** Animação de golpe virada para o alvo (sprites do marco 6). */
  private swing(fromId: number, toId: number) {
    const a = this.entityById(fromId), t = this.entityById(toId);
    if (a && t) this.views.get(fromId)?.attack(t.x, t.y, a.x, a.y);
  }

  private isArcher(id: number) { const m = this.world.monsters.find((e) => e.id === id); return !!m && !!MONSTERS[m.monsterId]?.projectile; }

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
      .setOrigin(0.5).setDepth(100000).setResolution(TEXT_RES);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
