import { touchDebug } from '../ui/touchDebug';
import Phaser from 'phaser';
import { L } from '../core/i18n';
import { TILE_H, TILE_W, screenToTile, tileToScreen } from '../core/iso';
import type { Entity, GameEvent } from '../core/types';
import type { World } from '../core/world';
import { EntityView } from '../render/entityView';
import { buildMapView, cullMap, fadeTreesNear } from '../render/mapView';
import { audio, loadDeviceAudio, saveDeviceAudio } from '../render/audio';
import { SkillFx } from '../render/skillFx';
import { perf } from '../ui/perf';
import { writeSave } from '../save';
import { setupControls } from '../ui/controls';
import { Hud } from '../ui/hud';
import { TipManager } from '../ui/tips';
import { SettingsPanel } from '../ui/settingsPanel';
import { MONSTERS } from '../core/data';
import { itemColor } from '../core/items';
import { DPR, TEXT_RES, cssSize } from '../render/display';
import { EventFeedback } from '../render/eventFeedback';
import { DEPTH } from '../render/depth';
import { prefetchSheets, releasePrefetched, sheetsForMap, syncSheets } from '../render/sheetLoader';
import { queueSheet, sheetTexture } from '../render/sprites';
import { PREF, getPref, setPref } from '../platform/prefs';
import { exitApp, onBackButton } from '../platform/backButton';
import { askExit, closeTopWindow } from '../ui/backAction';
import { onPause, onResume } from '../platform/lifecycle';
import { isNative, restartApp } from '../platform';

/** Distância (tiles) do portal em que as folhas do mapa de destino começam a carregar. */
const PREFETCH_DIST = 8;
/** Distância (tiles) de todos os portais em que as folhas adiantadas são liberadas (folga para não ficar indo e vindo). */
const RELEASE_DIST = 12;

// zoom do jogador: só aproxima (100% = visão normal, até 200%) para não dar vantagem de ver longe
const ZOOM_MIN = 1,
  ZOOM_MAX = 2;
// Área de clique/toque para escolher alvo (px do mundo, em volta do ponto acima dos pés)
const PICK = {
  TOUCH_SCALE: 1.5, // dedo é menos preciso que o mouse: área de toque maior
  MONSTER_LIFT: 14, // centro da área: 14 px acima dos pés
  MONSTER_HALF: 26, // meia largura e meia altura
  NPC_LIFT: 24,
  NPC_HALF_W: 28,
  NPC_HALF_H: 40,
};
// Elipse do aviso do chefe: um raio de 1 tile vira meia diagonal do losango (TILE/2 × √2)
const TELEGRAPH_RX = (TILE_W / 2) * Math.SQRT2,
  TELEGRAPH_RY = (TILE_H / 2) * Math.SQRT2;
const loadZoom = () => {
  const v = Number(getPref(PREF.ZOOM));
  return v >= ZOOM_MIN && v <= ZOOM_MAX ? v : 1;
};

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hud!: Hud;
  private tips!: TipManager;
  private fx!: SkillFx;
  private feedback!: EventFeedback;
  private mapObjs: Phaser.GameObjects.GameObject[] = [];
  private trees: Phaser.GameObjects.Image[] | null = null;
  private views = new Map<number, EntityView>();
  private groundViews = new Map<number, Phaser.GameObjects.Graphics>();
  private autoText!: Phaser.GameObjects.Text;
  private teleViews = new Map<number, Phaser.GameObjects.Graphics>();
  private userZoom = loadZoom();
  private pinch: { d: number; z: number } | null = null;
  private mapLoading = false;
  /** Mapas de destino cujas folhas já foram adiantadas neste mapa (prefetchNearPortal). */
  private prefetchedMaps = new Set<string>();

  constructor() {
    super('Game');
  }
  init(data: { world: World }) {
    this.world = data.world;
  }

  // folhas de personagens do primeiro mapa (as dos outros mapas são carregadas na troca: ver onMapChange)
  preload() {
    for (const k of sheetsForMap(this.world)) if (!this.textures.exists(sheetTexture(k))) queueSheet(this, k);
  }

  create() {
    // só no `npm run dev`: acesso ao mundo pelo console (testes visuais); some no build
    if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = { world: this.world, scene: this };
    // volumes são do aparelho; o campo audio do save fica como estava (só é lido na primeira vez)
    const sound = loadDeviceAudio(this.world.audio);
    saveDeviceAudio(sound);
    audio.bind(this, sound, () => saveDeviceAudio(sound));
    audio.playMusicForMap(this.world.mapId);
    this.hud = new Hud(this.world);
    touchDebug.attach(this.world);
    this.fx = new SkillFx(this);
    this.feedback = new EventFeedback(this, this.world, this.hud, this.views, this.fx);
    setupControls(this.world, this.hud, (x, y) => this.tapAt(x, y));
    const persist = () => {
      void writeSave(this.world.serialize());
    };
    this.tips = new TipManager(this.world, persist);
    new SettingsPanel(
      this.world,
      this.tips,
      () => {
        // salva e recarrega a página: volta à tela inicial com tudo limpo (HUD, áudio e timers)
        void writeSave(this.world.serialize()).finally(restartApp);
      },
      this.hud.rewards,
    );
    this.autoText = this.add
      .text(0, 0, '', {
        fontSize: '12px',
        color: '#9fe8a0',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000',
        strokeThickness: 3,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.AUTO_TEXT)
      .setVisible(false);
    const rep = this.world.offlineReport;
    this.world.offlineReport = null;
    if (rep) this.hud.showOffline(rep, () => this.world.auto.resume());
    else this.world.auto.resume();
    this.cameras.main.setBackgroundColor('#10141c');
    syncSheets(this, this.world, () => this.rebuildMap());
    this.applyZoom();
    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) =>
      this.setUserZoom(this.userZoom * (dy > 0 ? 1 / 1.1 : 1.1)),
    );
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    const save = () => {
      void writeSave(this.world.serialize());
    };
    const timer = window.setInterval(save, 30000);
    // segundo plano: salva ao sair; ao voltar depois de 5 min ou mais com o auto ligado, aplica o ganho offline (D5)
    let pausedAt = 0;
    let autoAtPause = this.world.auto.serialize();
    const offPause = onPause(() => {
      save();
      if (pausedAt) return; // web: visibilitychange e pagehide chegam juntos
      pausedAt = Date.now();
      autoAtPause = this.world.auto.serialize();
    });
    const offResume = onResume(() => {
      const at = pausedAt;
      pausedAt = 0;
      if (!at || this.hud.offlineOpen) return;
      const rep = this.world.applyResumeOffline(Date.now(), at, autoAtPause);
      if (!rep) return;
      save();
      this.hud.showOffline(rep, () => this.world.auto.resume());
    });
    // voltar: fecha a janela de cima; sem janela, no app pergunta se quer sair e na web avisa
    // (salva já, caso o jogador saia de verdade)
    const disarmBack = onBackButton({
      closeSomething: () => closeTopWindow(this.hud),
      onExitAttempt: () => {
        save();
        if (isNative) askExit(() => void writeSave(this.world.serialize()).finally(exitApp));
        else this.hud.toast(L('Faça o gesto de voltar de novo para sair', 'Go back again to exit'), '#ffd23f');
      },
    });
    this.events.once('shutdown', () => {
      disarmBack();
      clearInterval(timer);
      offPause();
      offResume();
    });
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
    setPref(PREF.ZOOM, String(z));
    this.applyZoom();
  }

  // pinça com dois dedos no canvas (o joystick e os botões são HTML e não contam aqui)
  private touchPointers() {
    return this.input.manager.pointers.filter((p) => p.isDown && p.wasTouch);
  }
  private updatePinch() {
    const ps = this.touchPointers();
    if (ps.length < 2) {
      this.pinch = null;
      return;
    }
    const d = Phaser.Math.Distance.Between(ps[0].x, ps[0].y, ps[1].x, ps[1].y);
    if (!this.pinch) {
      this.pinch = { d: Math.max(1, d), z: this.userZoom };
      return;
    }
    this.setUserZoom(this.pinch.z * (d / this.pinch.d));
  }

  /** Troca de mapa: o jogo espera as folhas do novo mapa carregarem (fração de segundo) e redesenha. */
  private onMapChange() {
    this.mapLoading = true;
    this.prefetchedMaps.clear();
    syncSheets(this, this.world, () => {
      this.mapLoading = false;
      this.rebuildMap();
    });
  }

  /** Perto de um portal (até PREFETCH_DIST tiles): adianta as folhas do mapa de destino (sheetLoader).
   *  Longe de todos (mais de RELEASE_DIST): libera de novo, para não segurar memória de dois mapas (D6). */
  private prefetchNearPortal() {
    const w = this.world,
      p = w.player;
    let nearest = Infinity;
    for (const o of w.map.objects) {
      if (o.type !== 'portal') continue;
      const dx = Math.max(o.x - p.x, 0, p.x - (o.x + o.w)),
        dy = Math.max(o.y - p.y, 0, p.y - (o.y + o.h));
      const d = Math.hypot(dx, dy);
      nearest = Math.min(nearest, d);
      const id = String(o.props.target),
        target = w.maps[id];
      if (!target || this.prefetchedMaps.has(id) || d > PREFETCH_DIST) continue;
      this.prefetchedMaps.add(id);
      prefetchSheets(this, target, w.classId);
    }
    if (nearest > RELEASE_DIST && this.prefetchedMaps.size) {
      this.prefetchedMaps.clear();
      releasePrefetched(this);
    }
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

  /** Nome do sprite da entidade; sheetFor() acha a folha animada (sem folha: figura genérica). */
  private textureFor(e: Entity): string {
    if (e.kind === 'player') return 'player-' + this.world.classId;
    if (e.kind === 'monster') return MONSTERS[e.monsterId].sprite;
    return 'npc-' + (e.npcId ?? '');
  }

  private viewFor(e: Entity): EntityView {
    let v = this.views.get(e.id);
    if (!v) {
      v = new EntityView(this, e, this.textureFor(e));
      this.views.set(e.id, v);
    }
    return v;
  }

  /** Posição do toque/clique no mundo, medida na hora com a posição real do canvas.
   *  No celular a barra do navegador aparece/some e desloca a página; a posição que o Phaser
   *  guardou fica velha e o toque caía fora do NPC/monstro. */
  private pointerWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    const ev = p.event as TouchEvent | MouseEvent | undefined;
    let cx: number | undefined, cy: number | undefined;
    if (ev && 'changedTouches' in ev && ev.changedTouches.length) {
      const t = [...ev.changedTouches].find((q) => q.identifier === p.identifier) ?? ev.changedTouches[0];
      cx = t.clientX;
      cy = t.clientY;
    } else if (ev && 'clientX' in ev) {
      cx = ev.clientX;
      cy = ev.clientY;
    }
    return this.clientWorld(cx, cy) ?? { x: p.worldX, y: p.worldY };
  }

  /** Ponto da tela (clientX/Y) → mundo. */
  private clientWorld(cx: number | undefined, cy: number | undefined): { x: number; y: number } | null {
    const canvas = this.game.canvas,
      r = canvas.getBoundingClientRect();
    if (cx === undefined || cy === undefined || !r.width || !r.height) return null;
    const wp = this.cameras.main.getWorldPoint(
      (cx - r.left) * (canvas.width / r.width),
      (cy - r.top) * (canvas.height / r.height),
    );
    return { x: wp.x, y: wp.y };
  }

  /** Toque na área do joystick flutuante: se caiu num monstro/NPC, seleciona e não abre o joystick. */
  tapAt(cx: number, cy: number): boolean {
    if (this.world.player.dead) return false;
    const w = this.clientWorld(cx, cy);
    return !!w && this.pickAt(w.x, w.y, true);
  }

  private onPointer(p: Phaser.Input.Pointer) {
    if (this.world.player.dead || p.button !== 0) return;
    const fingers =
      p.event && 'touches' in p.event ? (p.event as TouchEvent).touches.length : this.touchPointers().length;
    if (p.wasTouch && fingers > 1) return; // segundo dedo = pinça
    const { x: wx, y: wy } = this.pointerWorld(p);
    if (this.pickAt(wx, wy, p.wasTouch)) return;
    if (p.wasTouch) return; // toque usa o joystick; mouse continua com clique-para-mover
    const t = screenToTile(wx, wy);
    this.world.moveTo(t.x, t.y);
  }

  /** Seleciona o monstro ou fala com o NPC sob o ponto do mundo; devolve se acertou algum. */
  private pickAt(wx: number, wy: number, touch: boolean): boolean {
    const k = touch ? PICK.TOUCH_SCALE : 1;
    let best: Entity | null = null,
      bd = Infinity;
    for (const m of this.world.monsters) {
      if (m.dead) continue;
      const s = tileToScreen(m.x, m.y),
        dx = wx - s.x,
        dy = wy - (s.y - PICK.MONSTER_LIFT);
      if (Math.abs(dx) < PICK.MONSTER_HALF * k && Math.abs(dy) < PICK.MONSTER_HALF * k && Math.hypot(dx, dy) < bd) {
        bd = Math.hypot(dx, dy);
        best = m;
      }
    }
    if (best) {
      this.world.setTarget(best.id);
      return true;
    }
    let npc: Entity | null = null;
    bd = Infinity;
    for (const n of this.world.npcs) {
      const s = tileToScreen(n.x, n.y),
        dx = wx - s.x,
        dy = wy - (s.y - PICK.NPC_LIFT);
      if (Math.abs(dx) < PICK.NPC_HALF_W * k && Math.abs(dy) < PICK.NPC_HALF_H * k && Math.hypot(dx, dy) < bd) {
        bd = Math.hypot(dx, dy);
        npc = n;
      }
    }
    if (npc) {
      this.world.interactNpc(npc.id);
      return true;
    }
    return false;
  }

  update(_t: number, delta: number) {
    perf.tick(delta, this.children.length);
    if (this.mapLoading) return; // nada anda nem é desenhado até as folhas do novo mapa chegarem
    const w = this.world;
    this.updatePinch();
    w.advance(delta / 1000);
    const evs = w.events.splice(0);
    for (const ev of evs) this.handle(ev);
    if (this.mapLoading) return; // trocou de mapa neste quadro e as folhas ainda estão chegando
    this.prefetchNearPortal();

    const live = new Set<number>([w.player.id]);
    const tgt = w.monsters.find((m) => m.id === w.targetId && !m.dead);
    if (tgt && Math.hypot(tgt.x - w.player.x, tgt.y - w.player.y) <= w.player.attackRange + 1)
      this.viewFor(w.player).face(tgt.x, tgt.y, w.player.x, w.player.y);
    this.viewFor(w.player).sync(w.player, false);
    for (const n of w.npcs) {
      live.add(n.id);
      const v = this.viewFor(n);
      v.sync(n, false);
      v.setMark(w.questMark(n.npcId ?? ''));
    }
    for (const m of w.monsters) {
      live.add(m.id);
      const v = this.viewFor(m);
      if (m.ai === 'chase' && !w.player.dead) v.face(w.player.x, w.player.y, m.x, m.y);
      v.sync(m, m.id === w.targetId);
    }
    for (const [id, v] of this.views)
      if (!live.has(id)) {
        v.destroy();
        this.views.delete(id);
      }
    cullMap(this.mapObjs, this.cameras.main, !this.trees);
    if (!this.trees)
      this.trees = this.mapObjs.filter((o) => o.name === 'tree' || o.name === 'building') as Phaser.GameObjects.Image[];
    {
      const who: { x: number; y: number; depth: number }[] = [];
      for (const e of [w.player, tgt]) {
        const v = e && this.views.get(e.id);
        if (e && v) who.push({ x: v.container.x, y: v.container.y, depth: e.x + e.y });
      }
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
      if (!g) {
        g = this.add.graphics().setDepth(DEPTH.TELEGRAPH);
        this.teleViews.set(t.id, g);
      }
      const c = tileToScreen(t.x, t.y),
        rx = t.radius * TELEGRAPH_RX,
        ry = t.radius * TELEGRAPH_RY,
        k = Math.max(0, Math.min(1, 1 - t.remaining / t.delay));
      g.clear().setPosition(c.x, c.y);
      g.fillStyle(0xff2020, 0.14);
      g.fillEllipse(0, 0, rx * 2, ry * 2);
      g.fillStyle(0xff3030, 0.28 + 0.25 * k);
      g.fillEllipse(0, 0, rx * 2 * k, ry * 2 * k);
      g.lineStyle(3, 0xff5050, 0.95);
      g.strokeEllipse(0, 0, rx * 2, ry * 2);
    }
    for (const [id, g] of this.teleViews)
      if (!live.has(id)) {
        g.destroy();
        this.teleViews.delete(id);
      }
  }

  private syncAutoText() {
    const a = this.world.auto,
      p = this.world.player,
      show = a.state !== 'off' && !p.dead;
    this.autoText.setVisible(show);
    if (!show) return;
    const s = tileToScreen(p.x, p.y);
    const text = a.state === 'pausado' ? L('Auto pausado', 'Auto paused') : a.status ? `Auto\n${a.status}` : 'Auto',
      color = a.state === 'pausado' ? '#f0c060' : '#9fe8a0';
    // setColor do Phaser redesenha o texto e reenvia a textura para a placa de vídeo mesmo com a mesma cor:
    // a cada quadro isso derrubava o FPS no iPhone com o Auto ligado. Só mexe quando muda.
    if (this.autoText.style.color !== color) {
      this.autoText.style.color = color;
      if (this.autoText.text === text) this.autoText.updateText();
    }
    if (this.autoText.text !== text) this.autoText.setText(text);
    this.autoText.setPosition(s.x, s.y - 70);
  }

  private syncGround() {
    const live = new Set<number>();
    for (const g of this.world.ground) {
      live.add(g.id);
      let v = this.groundViews.get(g.id);
      if (!v) {
        const col = Phaser.Display.Color.HexStringToColor(itemColor(g.item!)).color;
        v = this.add.graphics();
        v.fillStyle(col, 0.35);
        v.fillEllipse(0, 0, 30, 15);
        v.fillStyle(col, 1);
        v.fillPoints(
          [
            { x: 0, y: -14 },
            { x: 7, y: -7 },
            { x: 0, y: 0 },
            { x: -7, y: -7 },
          ],
          true,
        );
        v.lineStyle(1, 0xffffff, 0.9);
        v.strokePoints(
          [
            { x: 0, y: -14 },
            { x: 7, y: -7 },
            { x: 0, y: 0 },
            { x: -7, y: -7 },
          ],
          true,
        );
        this.groundViews.set(g.id, v);
      }
      const s = tileToScreen(g.x, g.y);
      v.setPosition(s.x, s.y + Math.sin(this.time.now / 250 + g.id) * 2);
      if (v.depth !== g.x + g.y) v.setDepth(g.x + g.y); // setDepth reordena a cena toda: só quando muda
      v.setAlpha(g.expires - this.world.time < 10 ? 0.4 + 0.6 * Math.abs(Math.sin(this.time.now / 150)) : 1);
    }
    for (const [id, v] of this.groundViews)
      if (!live.has(id)) {
        v.destroy();
        this.groundViews.delete(id);
      }
  }

  private handle(ev: GameEvent) {
    this.tips.onEvent(ev);
    audio.onEvent(ev, this.world.player.id);
    if (ev.type === 'mapChange') this.onMapChange();
    else this.feedback.handle(ev);
  }
}
