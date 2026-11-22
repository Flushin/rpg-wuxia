import Phaser from 'phaser';
import data from '../data/audio.json';
import { MAPS_CONFIG } from '../core/mapsConfig';
import { skillById } from '../core/skills';
import { ultimateOf } from '../core/ultimate';
import { PREF, getPref, setPref } from '../platform/prefs';

export interface AudioSettings {
  sfx: number;
  music: number;
  muted: boolean;
}
export const DEFAULT_AUDIO: AudioSettings = { sfx: 20, music: 40, muted: false };

/**
 * Volumes do aparelho (decisão de 17/11/2026: por aparelho, não por personagem).
 * Na primeira vez, herda os volumes do personagem que está entrando (o que estava no save dele).
 */
export function loadDeviceAudio(fromCharacter: AudioSettings): AudioSettings {
  try {
    const p = JSON.parse(getPref(PREF.AUDIO) ?? 'null') as Partial<AudioSettings> | null;
    if (p && typeof p === 'object') {
      const vol = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 100 ? v : d);
      return {
        sfx: vol(p.sfx, DEFAULT_AUDIO.sfx),
        music: vol(p.music, DEFAULT_AUDIO.music),
        muted: typeof p.muted === 'boolean' ? p.muted : DEFAULT_AUDIO.muted,
      };
    }
  } catch {
    /* JSON inválido: usa o do personagem */
  }
  return { ...fromCharacter };
}
export const saveDeviceAudio = (s: AudioSettings) =>
  setPref(PREF.AUDIO, JSON.stringify({ sfx: s.sfx, music: s.music, muted: s.muted }));

type SfxDef = { file: string; volume: number };
type MusicDef = { file: string; volume: number };
const SFX = data.sfx as Record<string, SfxDef>;
const MUSIC = data.music as Record<string, MusicDef>;
/** som de ataque de cada monstro (id do monstro -> chave em "sfx"); sem entrada = "monster_attack" */
const MONSTER_ATTACK = data.monsterAttack as Record<string, string>;
/** som de cada efeito de skill ("fx" em skills.json -> chave em "sfx"); sem entrada = "spell" só à distância */
const SKILL_FX = data.skillFx as Record<string, string>;
/** sons do ataque de cada classe (disparo à distância, acerto e crítico); sem entrada = spell/hit/crit */
const CLASS_ATTACK = data.classAttack as Record<string, { cast?: string; hit?: string; crit?: string }>;
const MAX_INSTANCES = 3;
/** segundos até o pico de aoe_warning */
const AOE_WARNING_PEAK = 0.85;
const FADE_MS = 1000;

export const sfxFiles = () =>
  Object.entries(SFX).map(([key, d]) => ({ key, urls: [`audio/sfx/${d.file}.ogg`, `audio/sfx/${d.file}.mp3`] }));

class AudioManager {
  settings: AudioSettings = { ...DEFAULT_AUDIO };
  private scene: Phaser.Scene | null = null;
  private playing = new Map<string, number>();
  private music: { key: string; snd: Phaser.Sound.BaseSound; base: number } | null = null;
  private wantMusic: string | null = null;
  private missing = new Set<string>();
  private loading = new Set<string>();
  private lastRanged = false;
  /** último toque de cada som limitado a 1 por rajada (ex.: leque de linhas do chefe) */
  private lastAt = new Map<string, number>();

  bind(scene: Phaser.Scene, settings: AudioSettings, onChange?: () => void) {
    this.scene = scene;
    this.settings = settings;
    this.onChange = onChange ?? (() => {});
    this.music = null;
    this.playing.clear();
    scene.sound.mute = this.resting;
    scene.events.once('shutdown', () => {
      this.stopMusic();
      this.scene = null;
    });
  }
  private onChange: () => void = () => {};
  /** modo descanso (tela preta): nenhum som, nem efeito nem música */
  private resting = false;

  setResting(on: boolean) {
    this.resting = on;
    if (this.scene) this.scene.sound.mute = on;
  }

  private sfxGain() {
    return this.settings.muted ? 0 : this.settings.sfx / 100;
  }
  private musicGain() {
    return this.settings.muted ? 0 : this.settings.music / 100;
  }

  /** Toca no máximo 1 vez a cada `gapMs` (vários avisos no mesmo instante viram um som só). */
  private sfxOnce(key: string, gapMs: number, delay = 0) {
    const now = performance.now();
    if (now - (this.lastAt.get(key) ?? -Infinity) < gapMs) return;
    this.lastAt.set(key, now);
    this.sfx(key, 0, delay);
  }

  sfx(key: string, detune = 0, delay = 0) {
    const s = this.scene,
      d = SFX[key];
    if (!s || !d || this.resting || !s.cache.audio.exists(key)) return;
    const vol = d.volume * this.sfxGain();
    if (vol <= 0) return;
    const n = this.playing.get(key) ?? 0;
    if (n >= MAX_INSTANCES) return;
    this.playing.set(key, n + 1);
    const snd = s.sound.add(key, {
      volume: vol,
      detune: detune ? Phaser.Math.Between(-detune, detune) : 0,
      delay,
    });
    const done = () => {
      this.playing.set(key, Math.max(0, (this.playing.get(key) ?? 1) - 1));
      snd.destroy();
    };
    snd.once('complete', done);
    if (!snd.play()) done();
  }

  /** Subida de nível. Marco: o mesmo som mais grave, com um eco mais baixo logo depois. */
  levelUp(milestone: boolean) {
    if (!milestone) return this.sfx('level_up');
    const s = this.scene,
      d = SFX.level_up;
    if (!s || !d || this.resting || !s.cache.audio.exists('level_up')) return;
    const vol = d.volume * this.sfxGain();
    if (vol <= 0) return;
    const play = (v: number) => {
      const snd = s.sound.add('level_up', { volume: v, detune: -300 });
      snd.once('complete', () => snd.destroy());
      if (!snd.play()) snd.destroy();
    };
    play(Math.min(1, vol * 1.15));
    s.time.delayedCall(170, () => play(vol * 0.4));
  }

  ui(key: string) {
    this.sfx(key);
  }

  setSettings(p: Partial<AudioSettings>) {
    Object.assign(this.settings, p);
    if (this.music) {
      this.scene?.tweens.killTweensOf(this.music.snd);
      (this.music.snd as Phaser.Sound.WebAudioSound).setVolume(this.music.base * this.musicGain());
    }
    this.onChange();
  }

  onEvent(ev: import('../core/types').GameEvent, playerId: number, classId = '') {
    const cls = CLASS_ATTACK[classId] ?? {};
    switch (ev.type) {
      case 'attack':
        if (ev.fromId === playerId) {
          this.lastRanged = ev.ranged;
          if (ev.ranged) this.sfx(cls.cast ?? 'spell', cls.cast ? 0 : 500);
        } else this.sfx((ev.monster && MONSTER_ATTACK[ev.monster]) || 'monster_attack', 300);
        break;
      case 'hit':
        if (ev.targetKind === 'player') {
          if (ev.crit) this.sfx('crit', 300);
        } else if (ev.crit) this.sfx(cls.crit ?? 'crit', cls.crit ? 100 : 500);
        else if (cls.hit) this.sfx(cls.hit, 150);
        else this.sfx(this.lastRanged ? 'spell' : 'hit', 500);
        break;
      case 'miss':
        this.sfx('miss', 500);
        break;
      case 'death':
        if (ev.id !== playerId) this.sfx('monster_death', 300);
        break;
      case 'playerDeath':
        this.sfx('player_death');
        break;
      // levelup: tocado por LevelUpFx junto com cada animação da fila (levelUp)
      case 'skillLevelUp':
        this.sfx('skill_up');
        break;
      case 'skillCast':
        this.lastRanged = ev.ranged;
        {
          const fx = skillById(ev.skillId)?.fx;
          const key = fx ? SKILL_FX[fx] : undefined;
          if (key) this.sfx(key);
          else if (ev.ranged) this.sfx('spell', 300);
        }
        break;
      case 'ultimate': {
        // sons da seita (ultimates.json "sounds"): pose, cada golpe e o estouro
        const snd = ultimateOf(ev.sect)?.sounds;
        if (!snd) break;
        if (ev.phase === 'start') this.sfx(snd.start);
        else if (ev.phase === 'strike') this.sfxOnce(snd.strike, 100);
        else this.sfxOnce(snd.final, 200);
        break;
      }
      case 'telegraph':
        // o pico do prato ao contrário (~0,85 s) cai junto com o golpe
        this.sfxOnce('aoe_warning', 200, Math.max(0, ev.delay - AOE_WARNING_PEAK));
        break;
      case 'telegraphResolved':
        this.sfxOnce('aoe_impact', 200);
        break;
      case 'shieldAbsorb':
        if (ev.targetId === playerId) this.sfx('shield_hit', 200);
        break;
      case 'buffExpired':
        if (ev.broken && ev.targetId === playerId) this.sfx('shield_break');
        break;
      case 'skillFail':
        this.sfx('fail');
        break;
      case 'itemPickup':
        this.sfx('pickup', 200);
        break;
      case 'epicDrop':
        this.sfx('boss_defeated');
        break;
      case 'goldPickup':
        this.sfx('coin', 200);
        break;
      case 'bagFull':
        this.sfx('bag_full');
        break;
      case 'equipChange':
        this.sfx('equip');
        break;
      case 'potionUsed':
        this.sfx('potion');
        break;
      case 'potionFail':
        this.sfx('fail');
        break;
      case 'npcOpen':
        this.sfx('ui_open');
        break;
      case 'npcClose':
        this.sfx('ui_close');
        break;
      case 'trade':
        this.sfx('coin');
        break;
      case 'repair':
        this.sfx('repair');
        break;
      case 'bossArenaEnter':
        this.sfx('boss_arena', 1000);
        break;
      case 'bossEnrage':
        this.sfx('boss_enrage');
        break;
      case 'bossSummon':
        this.sfx('boss_summon');
        break;
      case 'bossDefeated':
        this.sfx('boss_defeated');
        break;
      case 'mapChange':
        this.sfx('portal');
        this.playMusicForMap(ev.mapId);
        break;
      default:
        break;
    }
  }

  playMusicForMap(mapId: string) {
    const key = MAPS_CONFIG[mapId]?.music;
    if (key) this.playMusic(key);
  }

  playMusic(key: string) {
    const s = this.scene;
    this.wantMusic = key;
    if (!s || this.music?.key === key || this.missing.has(key)) return;
    if (s.sound.locked) {
      s.sound.once('unlocked', () => {
        if (this.wantMusic === key) this.playMusic(key);
      });
      return;
    }
    if (!s.cache.audio.exists(key)) {
      this.loadMusic(key);
      return;
    }
    const d = MUSIC[key];
    const old = this.music;
    const snd = s.sound.add(key, { loop: true, volume: 0 });
    snd.play();
    this.music = { key, snd, base: d.volume };
    s.tweens.add({ targets: snd, volume: d.volume * this.musicGain(), duration: FADE_MS });
    if (old) {
      s.tweens.killTweensOf(old.snd);
      s.tweens.add({ targets: old.snd, volume: 0, duration: FADE_MS, onComplete: () => old.snd.destroy() });
    }
  }

  private loadMusic(key: string) {
    const s = this.scene,
      d = MUSIC[key];
    if (!s || !d || this.loading.has(key)) return;
    this.loading.add(key);
    const fail = () => {
      this.missing.add(key);
      this.loading.delete(key);
    };
    const l = s.load;
    const onErr = (f: Phaser.Loader.File) => {
      if (f.key === key) fail();
    };
    l.on('loaderror', onErr);
    l.once('complete', () => {
      l.off('loaderror', onErr);
      if (!this.loading.has(key)) return;
      this.loading.delete(key);
      if (!s.cache.audio.exists(key)) {
        this.missing.add(key);
        return;
      }
      if (this.wantMusic === key && this.scene === s) this.playMusic(key);
    });
    try {
      l.audio(key, [`audio/music/${d.file}.ogg`, `audio/music/${d.file}.mp3`]);
      l.start();
    } catch {
      fail();
    }
  }

  private stopMusic() {
    this.music?.snd.destroy();
    this.music = null;
  }
}

export const audio = new AudioManager();
