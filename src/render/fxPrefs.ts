// Preferências de efeitos (Configurações): números de dano, tremor de tela e vibração (só no app).
// Gravadas no aparelho (src/platform/prefs.ts); padrão: tudo ligado.
import type Phaser from 'phaser';
import { haptics } from '../platform/haptics';
import { PREF, getPref, setPref } from '../platform/prefs';

type FxKey = 'damageNumbers' | 'shake' | 'vibrate';
const KEY: Record<FxKey, typeof PREF.FX_DAMAGE | typeof PREF.FX_SHAKE | typeof PREF.FX_VIBRATE> = {
  damageNumbers: PREF.FX_DAMAGE,
  shake: PREF.FX_SHAKE,
  vibrate: PREF.FX_VIBRATE,
};

export const fxPrefs = {
  damageNumbers: getPref(PREF.FX_DAMAGE) !== '0',
  shake: getPref(PREF.FX_SHAKE) !== '0',
  vibrate: getPref(PREF.FX_VIBRATE) !== '0',
  set(k: FxKey, on: boolean) {
    this[k] = on;
    setPref(KEY[k], on ? '1' : '0');
  },
};

/** Tremor da câmera, se ligado nas Configurações. */
export function shakeCamera(scene: Phaser.Scene, ms: number, power: number) {
  if (fxPrefs.shake) scene.cameras.main.shake(ms, power);
}

/** Vibração leve (app Android), se ligada nas Configurações. */
let lastVibe = 0;
export function vibrate() {
  const now = performance.now();
  if (!fxPrefs.vibrate || now - lastVibe < 400) return; // críticos em sequência: no máximo uma a cada 0,4 s
  lastVibe = now;
  haptics.light();
}
