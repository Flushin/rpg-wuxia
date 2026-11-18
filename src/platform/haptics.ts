// Vibração leve (golpes, subir de nível). Web: nada. App (Capacitor): @capacitor/haptics.
// Ainda não é chamada pelo jogo; onde vibrar é decisão de jogabilidade.
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './index';

export const haptics = {
  light() {
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
};
