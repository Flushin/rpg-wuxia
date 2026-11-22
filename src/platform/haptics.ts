// Vibração leve (golpes, subir de nível). Web: nada. App (Capacitor): @capacitor/haptics.
// Chamada via vibrate() de src/render/fxPrefs.ts (crítico, golpe em área do chefe, subir de nível), com opção de desligar.
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './index';

export const haptics = {
  light() {
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
};
