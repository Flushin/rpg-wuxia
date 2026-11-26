import type Phaser from 'phaser';
import { L } from '../core/i18n';
import type { GameEvent } from '../core/types';
import type { World } from '../core/world';
import { PREF, getPref, setPref } from '../platform/prefs';
import { audio } from '../render/audio';

// Modo descanso (economia de bateria): com o Auto caçando e sem tocar na tela por um tempo, o jogo para de
// desenhar o mapa, cai para REST_FPS quadros por segundo e mostra uma tela preta (pixels apagados no OLED)
// com o resumo do que foi ganho. A simulação anda em passo fixo (World.advance), então caçar a 10 FPS rende
// o mesmo que a 60: os drops de material continuam (o jogo segue aberto). Sem som (efeitos e música). Mostra a hora atual.
// Dois toques seguidos (em até DOUBLE_TAP_MS) voltam ao normal: um toque solto só avisa, para não sair sem querer.
// Escolha em ⚙ (Desligado / 30 s / 1 min / 2 min); fica salva no aparelho.
export const REST_DELAYS = [0, 30, 60, 120] as const;
const DEFAULT_DELAY = 60;
const REST_FPS = 10;
/** a tela preta só redesenha o resumo a cada 30 s (menos trabalho no descanso) */
const PAINT_MS = 30000;
/** janela para o segundo toque que sai do descanso */
const DOUBLE_TAP_MS = 800;

/** Campos internos do TimeStep do Phaser (3.60+) usados para trocar o FPS em tempo de execução. */
type Loop = Phaser.Core.TimeStep & { _target: number; forceSetTimeOut: boolean };

/** Battery Status API (Chromium/WebView Android); ausente em alguns navegadores (Firefox, Safari). */
type Battery = { level: number; charging: boolean };
type NavBattery = Navigator & { getBattery?: () => Promise<Battery> };

class RestMode {
  delay: number = (() => {
    const raw = getPref(PREF.REST);
    return raw !== null && (REST_DELAYS as readonly number[]).includes(+raw) ? +raw : DEFAULT_DELAY;
  })();
  private lastInput = performance.now();
  private active = false;
  private el: HTMLElement | null = null;
  private scene: Phaser.Scene | null = null;
  private world: World | null = null;
  private since = 0;
  private gain = { kills: 0, xp: 0, gold: 0, items: 0 };
  private lastPaint = 0;
  /** minuto (do relógio) desenhado por último: muda → redesenha a hora na hora */
  private paintedMin = -1;
  /** primeiro toque dado: até quando o segundo toque sai do descanso */
  private armedUntil = 0;
  private paintedHint = false;
  private battery: Battery | null = null;
  /** nível (0–1) ao entrar no descanso; null se ainda não lido ou sem API */
  private batStart: number | null = null;

  constructor() {
    (navigator as NavBattery)
      .getBattery?.()
      .then((b) => (this.battery = b))
      .catch(() => {});
    // qualquer toque/tecla conta como atividade; na fase de captura, antes de qualquer painel tratar
    const poke = () => this.poke();
    window.addEventListener('pointerdown', (e) => this.poke(e), true);
    window.addEventListener('keydown', poke, true);
    window.addEventListener('wheel', poke, true);
  }

  setDelay(sec: number) {
    this.delay = sec;
    setPref(PREF.REST, String(sec));
    this.lastInput = performance.now();
  }

  attach(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.lastInput = performance.now();
    scene.events.once('shutdown', () => {
      this.wake();
      this.scene = this.world = null;
    });
  }

  /** Sai do descanso agora (ex.: o resumo offline vai abrir e não pode ficar atrás da tela preta). */
  wakeNow() {
    this.lastInput = performance.now();
    this.wake();
  }

  private poke(e?: PointerEvent) {
    this.lastInput = performance.now();
    if (!this.active) return;
    // o toque que acorda não chega ao jogo (senão vira um passo e pausa o Auto): a tela preta, por cima de
    // tudo, fica até o dedo sair
    e?.stopPropagation();
    if (!e) return this.wake();
    const now = performance.now();
    if (now < this.armedUntil) {
      this.armedUntil = 0;
      this.wake(true);
    } else {
      this.armedUntil = now + DOUBLE_TAP_MS;
      this.paint(true);
    }
  }

  /** Chamado a cada quadro pela cena: entra no descanso após `delay` s sem toque com o Auto caçando. */
  update() {
    const w = this.world;
    if (!w) return;
    const hunting = w.auto.counting && !w.player.dead;
    if (this.active) {
      // a ida do Auto à cidade (reabastecer) segue no descanso; se o Auto parar ou o personagem cair, mostra o jogo
      if (w.auto.state !== 'on' || w.player.dead) this.wake();
      else this.paint();
      return;
    }
    if (this.delay > 0 && hunting && performance.now() - this.lastInput >= this.delay * 1000) this.sleep();
  }

  onEvent(ev: GameEvent) {
    if (!this.active) return;
    if (ev.type === 'kill') this.gain.kills++;
    else if (ev.type === 'xp') this.gain.xp += ev.amount;
    else if (ev.type === 'goldPickup') this.gain.gold += ev.amount;
    else if (ev.type === 'itemPickup' && !ev.potion) this.gain.items += ev.qty;
  }

  private sleep() {
    const s = this.scene;
    if (!s || this.active) return;
    this.active = true;
    audio.setResting(true);
    this.since = performance.now();
    this.gain = { kills: 0, xp: 0, gold: 0, items: 0 };
    this.batStart = this.battery ? this.battery.level : null;
    s.sys.setVisible(false); // o canvas só é limpo; nada do mapa é desenhado
    setLoopFps(s.game, REST_FPS);
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'rest-screen';
      document.body.appendChild(this.el);
    }
    this.el.classList.remove('hidden');
    this.lastPaint = 0;
    this.armedUntil = 0;
    this.paint(true);
  }

  private wake(afterRelease = false) {
    if (!this.active) return;
    this.active = false;
    audio.setResting(false);
    this.lastInput = performance.now();
    const el = this.el;
    if (el && afterRelease) {
      let done = false;
      const hide = () => {
        if (done) return;
        done = true;
        window.removeEventListener('pointerup', later, true);
        window.removeEventListener('pointercancel', later, true);
        if (!this.active) el.classList.add('hidden');
      };
      const later = () => setTimeout(hide, 50);
      window.addEventListener('pointerup', later, true);
      window.addEventListener('pointercancel', later, true);
      setTimeout(hide, 1500); // garantia, se o pointerup não vier
    } else el?.classList.add('hidden');
    const s = this.scene;
    if (!s) return;
    s.sys.setVisible(true);
    setLoopFps(s.game, 0);
  }

  private paint(force = false) {
    const now = performance.now(),
      date = new Date(),
      hint = now < this.armedUntil;
    if (!this.el || !this.world) return;
    if (!force && now - this.lastPaint < PAINT_MS && date.getMinutes() === this.paintedMin && hint === this.paintedHint)
      return;
    this.lastPaint = now;
    this.paintedMin = date.getMinutes();
    this.paintedHint = hint;
    const clock = date.toLocaleTimeString(L('pt-BR', 'en-US'), { hour: '2-digit', minute: '2-digit' });
    const p = this.world.player,
      g = this.gain,
      min = Math.floor((now - this.since) / 60000);
    this.el.innerHTML = `<div class="rest-box">
      <div class="rest-clock">${clock}</div>
      <b>🌙 ${L('Modo descanso', 'Rest mode')}</b>
      <span>${L('Auto caçando', 'Auto hunting')} · ${L('HP', 'HP')} ${Math.round((100 * p.hp) / p.derived.maxHp)}%</span>
      <span>${min} min · ${g.kills} ${L('abates', 'kills')} · ${g.xp} XP · ${g.gold} ${L('ouro', 'gold')} · ${g.items} ${L('itens', 'items')}</span>
      ${this.batteryLine(now)}
      <small class="${hint ? 'rest-hint' : ''}">${hint ? L('Toque de novo para voltar', 'Tap again to return') : L('Toque duas vezes para voltar', 'Double-tap to return')}</small></div>`;
    // a caixa muda um pouco de lugar a cada minuto (evita marcar a tela)
    const box = this.el.firstElementChild as HTMLElement;
    box.style.transform = `translate(${((min * 37) % 41) - 20}vw, ${((min * 23) % 51) - 25}vh)`;
  }

  /** Bateria atual e quanto caiu desde que o descanso começou (com média por hora após 10 min). */
  private batteryLine(now: number): string {
    const b = this.battery;
    if (!b) return '';
    const cur = Math.round(b.level * 100);
    let txt = `🔋 ${cur}%`;
    if (b.charging) txt += ` · ${L('carregando', 'charging')}`;
    if (this.batStart === null) this.batStart = b.level;
    const used = Math.round((this.batStart - b.level) * 100);
    if (b.charging && used <= 0) return `<span>${txt}</span>`;
    txt += ` · ${L('gasto no descanso', 'used while resting')}: ${Math.max(0, used)}%`;
    const h = (now - this.since) / 3600000;
    if (used > 0 && h >= 1 / 6) txt += ` (~${(used / h).toFixed(1)}%/h)`;
    return `<span>${txt}</span>`;
  }
}

/**
 * fps > 0: roda o laço por setTimeout nesse ritmo (sem acordar a cada vsync); 0: volta ao requestAnimationFrame.
 * A troca fica para depois do quadro atual: feita dentro dele, o passo do rAF pediria mais um quadro depois do
 * sleep/wake e ficariam dois laços rodando juntos.
 */
function setLoopFps(game: Phaser.Game, fps: number) {
  setTimeout(() => {
    const loop = game.loop as Loop;
    loop.sleep();
    loop.forceSetTimeOut = fps > 0;
    loop._target = 1000 / (fps > 0 ? fps : loop.targetFps);
    loop.wake(true);
  }, 0);
}

export const restMode = new RestMode();
