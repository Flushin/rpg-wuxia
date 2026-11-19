// O que o jogador vê e ouve quando o mundo emite um evento: textos que sobem do mapa, toasts do HUD,
// golpes, flechas, brilho de drop e efeitos de skill (via SkillFx). Uma função por grupo de eventos.
// Não muda o estado do jogo; a troca de mapa (redesenhar o cenário) continua na GameScene.
import Phaser from 'phaser';
import { L } from '../core/i18n';
import { tileToScreen } from '../core/iso';
import type { Entity, GameEvent } from '../core/types';
import type { World } from '../core/world';
import { MONSTERS } from '../core/data';
import { TRIAL_TIERS } from '../core/trial';
import { skillById } from '../core/skills';
import type { Hud } from '../ui/hud';
import { audio } from './audio';
import { DEPTH } from './depth';
import { TEXT_RES } from './display';
import type { EntityView } from './entityView';
import type { SkillFx } from './skillFx';

// Cores dos textos que sobem do mapa
const FLOAT_COLOR = {
  DAMAGE: '#ffffff', // dano normal
  CRIT: '#ffd23f', // crítico e skill subindo de nível
  HURT: '#ff5555', // dano no jogador
  MISS: '#aaaaaa',
  WARNING: '#ff6a50', // golpe em área do chefe
  MANA: '#6aa8ff', // sem mana
  INFO: '#dddddd', // avisos (recarga, sem poção…)
  SHIELD: '#bfe0ff',
  ABSORB: '#9fd0ff', // dano absorvido pelo escudo
  POISON: '#8be06a', // tique de veneno (Víbora)
  STUN: '#ffd23f', // alvo atordoado (Titã)
  HEAL: '#7ff0a8', // cura ao longo do tempo (Víbora)
};

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

// Textos que sobem (dano, avisos): reaproveitados em vez de criados e destruídos a cada golpe. Cada Text novo
// cria um canvas e uma textura na placa de vídeo — com muitos números por segundo (área, veneno) o iPhone engasga.
const FLOAT_POOL_MAX = 24;

export class EventFeedback {
  private floatPool = new Map<number, Phaser.GameObjects.Text[]>(); // por tamanho da fonte (trocar a fonte remede)
  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private hud: Hud,
    private views: Map<number, EntityView>,
    private fx: SkillFx,
  ) {}

  /** Devolve true se o evento foi tratado aqui. */
  handle(ev: GameEvent): boolean {
    return this.combat(ev) || this.skills(ev) || this.rewards(ev) || this.messages(ev);
  }

  // ---- combate: dano, errou, golpes, flechas, aviso do chefe, escudo
  private combat(ev: GameEvent): boolean {
    switch (ev.type) {
      case 'hit': {
        const s = tileToScreen(ev.x, ev.y),
          toPlayer = ev.targetKind === 'player';
        this.floatText(
          s.x,
          s.y - 40,
          ev.crit ? `${ev.amount}!` : String(ev.amount),
          ev.poison
            ? FLOAT_COLOR.POISON
            : toPlayer
              ? FLOAT_COLOR.HURT
              : ev.crit
                ? FLOAT_COLOR.CRIT
                : FLOAT_COLOR.DAMAGE,
          ev.crit ? 22 : ev.poison ? 13 : 16,
        );
        this.views.get(ev.targetId)?.flash();
        return true;
      }
      case 'miss': {
        const s = tileToScreen(ev.x, ev.y);
        this.floatText(s.x, s.y - 40, L('Errou', 'Miss'), FLOAT_COLOR.MISS, 13);
        return true;
      }
      case 'attack':
        this.swing(ev.fromId, ev.toId);
        if (!this.isArcher(ev.fromId)) this.beam(ev);
        return true;
      case 'projectile':
        this.arrow(ev);
        return true;
      case 'telegraphResolved':
        if (ev.hit) {
          const s = tileToScreen(ev.x, ev.y);
          this.scene.cameras.main.shake(180, 0.006);
          this.floatText(s.x, s.y - 20, L('Golpe em área!', 'Area strike!'), FLOAT_COLOR.WARNING, 15);
        }
        return true;
      case 'buffApplied':
        if (ev.kind === 'shield' && ev.targetId === this.world.player.id)
          this.overPlayer(64, L('Escudo', 'Shield'), FLOAT_COLOR.SHIELD);
        else if (ev.kind === 'regen' && ev.targetId === this.world.player.id)
          this.overPlayer(64, L('Cura', 'Heal'), FLOAT_COLOR.HEAL);
        else if (ev.kind === 'stun') {
          const m = this.world.monsters.find((x) => x.id === ev.targetId);
          if (m) {
            const s = tileToScreen(m.x, m.y);
            this.floatText(s.x, s.y - 56, L('Atordoado', 'Stunned'), FLOAT_COLOR.STUN, 14);
          }
        }
        return true;
      case 'shieldAbsorb': {
        const s = tileToScreen(ev.x, ev.y);
        this.floatText(s.x, s.y - 40, `(${Math.round(ev.amount)})`, FLOAT_COLOR.ABSORB, 14);
        return true;
      }
    }
    return false;
  }

  // ---- skills: lançar, avanço, falha, desbloqueio e nível
  private skills(ev: GameEvent): boolean {
    switch (ev.type) {
      case 'skillCast': {
        const c = this.entityById(ev.casterId);
        if (c) this.views.get(c.id)?.attack(ev.tx, ev.ty, c.x, c.y); // sem alvo: tx,ty = posição dele (mantém a direção)
        this.fx.onEvent(ev);
        return true;
      }
      case 'dash':
        this.fx.onEvent(ev);
        return true;
      case 'skillFail': {
        const msg = {
          mana: L('Sem mana', 'No mana'),
          cooldown: L('Recarregando', 'On cooldown'),
          notarget: L('Sem alvo', 'No target'),
          blocked: L('Caminho bloqueado', 'Path blocked'),
          locked: L('Bloqueada', 'Locked'),
        }[ev.reason];
        this.overPlayer(64, msg, ev.reason === 'mana' ? FLOAT_COLOR.MANA : FLOAT_COLOR.INFO);
        return true;
      }
      case 'skillUnlocked':
        this.hud.toast(L('Nova skill desbloqueada: ', 'New skill unlocked: ') + (skillById(ev.skillId)?.name ?? ''));
        return true;
      case 'skillLevelUp':
        this.overPlayer(80, `${skillById(ev.skillId)?.name} ${L('nv', 'lv')} ${ev.level}!`, FLOAT_COLOR.CRIT);
        return true;
    }
    return false;
  }

  // ---- recompensas: drop, itens, ouro, XP, mochila cheia, poções
  private rewards(ev: GameEvent): boolean {
    switch (ev.type) {
      case 'drop':
        this.dropGlow(ev.x, ev.y, ev.color);
        return true;
      case 'itemPickup':
        this.hud.rewards.item(ev.name, ev.color, ev.qty, ev.rarity, ev.potion);
        return true;
      case 'goldPickup':
        this.hud.rewards.gold(ev.amount);
        return true;
      case 'xp':
        this.hud.rewards.xp();
        return true;
      case 'bagFull':
        this.hud.toast(L('Mochila cheia', 'Bag full'), '#ff8a80');
        return true;
      case 'potionFail': {
        const msg = {
          none: L('Sem poção', 'No potion'),
          cooldown: L('Recarregando', 'On cooldown'),
          full: ev.kind === 'hp' ? L('Vida cheia', 'Health full') : L('Mana cheia', 'Mana full'),
        }[ev.reason];
        this.overPlayer(64, msg, FLOAT_COLOR.INFO);
        return true;
      }
    }
    return false;
  }

  // ---- avisos no HUD: chefe, Auto, durabilidade, missões, nível, morte
  private messages(ev: GameEvent): boolean {
    const toast = (msg: string, color?: string) => this.hud.toast(msg, color);
    switch (ev.type) {
      case 'bossSummon':
        toast(L(`${ev.name} invoca reforços!`, `${ev.name} summons reinforcements!`), '#ff8a60');
        return true;
      case 'bossEnrage':
        toast(L(`${ev.name} entra em fúria!`, `${ev.name} becomes enraged!`), '#ff5a4a');
        return true;
      case 'portalLocked':
        toast(
          L(`${ev.name}: só a partir do nível ${ev.minLevel}`, `${ev.name}: requires level ${ev.minLevel}`),
          '#ff8a80',
        );
        return true;
      case 'bossDefeated':
        toast(L(`${ev.name} derrotado!`, `${ev.name} defeated!`), '#ffd23f');
        return true;
      case 'dungeonEnter':
        toast(
          L(
            `Masmorra: −${ev.cost} ouro. O Auto não funciona aqui.`,
            `Dungeon: −${ev.cost} gold. Auto doesn't work here.`,
          ),
          '#c08cff',
        );
        return true;
      case 'dungeonCleared':
        toast(
          L(
            'Masmorra concluída! A saída é o portal da entrada.',
            'Dungeon cleared! The exit is the portal at the entrance.',
          ),
          '#ffd23f',
        );
        return true;
      case 'trialEnter':
        toast(
          L(
            `Trial nível ${ev.tier}: −${ev.cost} ouro. O Auto não funciona aqui.`,
            `Trial level ${ev.tier}: −${ev.cost} gold. Auto doesn't work here.`,
          ),
          '#c08cff',
        );
        return true;
      case 'trialCleared':
        toast(
          L(
            ev.tier < TRIAL_TIERS
              ? `Trial nível ${ev.tier} vencido! O nível ${ev.tier + 1} deste chefe está liberado. A saída é o portal da entrada.`
              : `Trial nível ${ev.tier} vencido: o mais alto! A saída é o portal da entrada.`,
            ev.tier < TRIAL_TIERS
              ? `Trial level ${ev.tier} cleared! Level ${ev.tier + 1} of this boss is unlocked. The exit is the portal at the entrance.`
              : `Trial level ${ev.tier} cleared: the highest! The exit is the portal at the entrance.`,
          ),
          '#ffd23f',
        );
        return true;
      case 'autoBlocked':
        toast(
          L('O Auto não funciona nas masmorras nem no Trial.', "Auto doesn't work in dungeons or the Trial."),
          '#ff8a80',
        );
        return true;
      case 'autoStopped':
        toast(
          L(
            'Auto-combate parado: item quebrado. Conserte no Ferreiro.',
            'Auto-battle stopped: broken item. Repair it with the Blacksmith.',
          ),
          '#ff8a80',
        );
        return true;
      case 'durabilityLost':
        toast(L('Seus equipamentos perderam durabilidade', 'Your equipment lost durability'), '#f1a02e');
        return true;
      case 'quest':
        if (ev.kind === 'accepted') toast(L(`Missão aceita: ${ev.name}`, `Quest accepted: ${ev.name}`), '#f0d070');
        else if (ev.kind === 'ready') {
          toast(L(`Objetivo cumprido: ${ev.name}`, `Objective complete: ${ev.name}`), '#9fe8a0');
          audio.ui('tip');
        } else if (ev.kind === 'completed')
          toast(L(`Missão concluída: ${ev.name}`, `Quest complete: ${ev.name}`), '#ffd23f');
        return true;
      case 'levelup':
        toast(L(`Nível ${ev.level}! +3 pontos de atributo`, `Level ${ev.level}! +3 attribute points`));
        return true;
      case 'playerDeath':
        toast(L('Você morreu... Renascendo na vila', 'You died... Respawning in the village'));
        return true;
    }
    return false;
  }

  // ---- desenho

  private entityById(id: number): Entity | undefined {
    const w = this.world;
    return id === w.player.id ? w.player : (w.monsters.find((m) => m.id === id) ?? w.npcs.find((n) => n.id === id));
  }

  /** Animação de golpe virada para o alvo (sprites do marco 6). */
  private swing(fromId: number, toId: number) {
    const a = this.entityById(fromId),
      t = this.entityById(toId);
    if (a && t) this.views.get(fromId)?.attack(t.x, t.y, a.x, a.y);
  }

  private isArcher(id: number) {
    const m = this.world.monsters.find((e) => e.id === id);
    return !!m && !!MONSTERS[m.monsterId]?.projectile;
  }

  private beam(ev: Ev<'attack'>) {
    const a = this.views.get(ev.fromId),
      t = this.views.get(ev.toId);
    if (!a || !t) return;
    const fromPlayer = ev.fromId === this.world.player.id;
    const color = !fromPlayer ? 0xffffff : this.world.player.element === 'ice' ? 0x9ee0ff : 0xffe14a;
    const g = this.scene.add.graphics().setDepth(DEPTH.HIT_LINE);
    g.lineStyle(ev.ranged ? 3 : 4, color, 1);
    const x1 = a.container.x,
      y1 = a.container.y - 18,
      x2 = t.container.x,
      y2 = t.container.y - 18;
    if (ev.ranged) g.lineBetween(x1, y1, x2, y2);
    else {
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      g.lineBetween(mx - 10, my - 10, mx + 10, my + 10);
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  private arrow(ev: Ev<'projectile'>) {
    const a = tileToScreen(ev.fromX, ev.fromY),
      b = tileToScreen(ev.toX, ev.toY);
    const g = this.scene.add.graphics().setDepth(DEPTH.HIT_LINE);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (ev.kind === 'ice') {
      // estilhaço de gelo (Espectro de gelo, marco 9)
      g.fillStyle(0x9ee0ff, 0.35);
      g.fillEllipse(-4, 0, 18, 7);
      g.fillStyle(0xe6f7ff, 1);
      g.fillTriangle(9, 0, -5, -3.5, -5, 3.5);
      g.lineStyle(1, 0x5fb6f0, 1);
      g.strokeTriangle(9, 0, -5, -3.5, -5, 3.5);
    } else if (ev.kind === 'poison') {
      // gota de veneno verde-jade (Serpente de Jade, nível 30)
      g.fillStyle(0x5fe0a8, 0.3);
      g.fillEllipse(-5, 0, 20, 8);
      g.fillStyle(0x3fbf6a, 1);
      g.fillCircle(3, 0, 4);
      g.fillTriangle(-6, 0, 1, -3, 1, 3);
      g.lineStyle(1, 0x1f6b3a, 1);
      g.strokeCircle(3, 0, 4);
    } else if (ev.kind === 'qi') {
      // pena de qi branca com ponta vermelha (Grou Espiritual, nível 30)
      g.fillStyle(0xffffff, 0.35);
      g.fillEllipse(-4, 0, 22, 8);
      g.fillStyle(0xf4f8ff, 1);
      g.fillEllipse(0, 0, 16, 5);
      g.fillStyle(0xd83a3a, 1);
      g.fillCircle(7, 0, 2.5);
    } else {
      g.lineStyle(2, 0xe8d8a8, 1);
      g.lineBetween(-9, 0, 9, 0);
      g.fillStyle(0xcccccc, 1);
      g.fillTriangle(9, 0, 4, -3, 4, 3);
      g.fillStyle(0xc02828, 1);
      g.fillTriangle(-9, 0, -12, -3, -12, 3);
    }
    g.setPosition(a.x, a.y - 20).setRotation(ang);
    this.scene.tweens.add({
      targets: g,
      x: b.x,
      y: b.y - 20,
      duration: Math.max(120, Math.hypot(b.x - a.x, b.y - a.y) * 1.6),
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // drop coletado: brilho que voa até o jogador
  private dropGlow(x: number, y: number, color: string) {
    const col = Phaser.Display.Color.HexStringToColor(color).color;
    const a = tileToScreen(x, y),
      b = tileToScreen(this.world.player.x, this.world.player.y);
    const g = this.scene.add.graphics().setDepth(DEPTH.DROP_FX);
    g.fillStyle(col, 1);
    g.fillCircle(0, 0, 5);
    g.lineStyle(1, 0xffffff, 1);
    g.strokeCircle(0, 0, 5);
    g.setPosition(a.x, a.y - 10);
    this.scene.tweens.add({
      targets: g,
      y: a.y - 34,
      duration: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: g,
          x: b.x,
          y: b.y - 24,
          alpha: 0,
          duration: 300,
          ease: 'Cubic.easeIn',
          onComplete: () => g.destroy(),
        });
      },
    });
  }

  /** Texto acima da cabeça do jogador (avisos de skill/poção/escudo), tamanho 15. */
  private overPlayer(lift: number, text: string, color: string) {
    const s = tileToScreen(this.world.player.x, this.world.player.y);
    this.floatText(s.x, s.y - lift, text, color, 15);
  }

  private floatText(x: number, y: number, text: string, color: string, size: number) {
    x += Phaser.Math.Between(-8, 8);
    const pool = this.floatPool.get(size) ?? [];
    this.floatPool.set(size, pool);
    let t = pool.pop();
    while (t && !t.scene) t = pool.pop(); // destruído junto com a cena
    if (t) {
      t.style.color = color; // sem redesenhar duas vezes: a cor entra junto com o texto
      if (t.text !== text) t.setText(text);
      else t.updateText();
      t.setPosition(x, y).setAlpha(1).setVisible(true).setActive(true);
    } else
      t = this.scene.add
        .text(x, y, text, {
          fontSize: `${size}px`,
          color,
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 4,
          resolution: TEXT_RES, // no estilo (e não setResolution depois): desenha uma vez só
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.FLOAT_TEXT);
    const txt = t;
    this.scene.tweens.add({
      targets: txt,
      y: y - 36,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (pool.length >= FLOAT_POOL_MAX) return txt.destroy();
        txt.setVisible(false).setActive(false);
        pool.push(txt);
      },
    });
  }
}
