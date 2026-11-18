// App das lojas (Capacitor): o mesmo jogo do `dist/` dentro de um WebView nativo. Ver docs/android.md.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Nome escolhido pelo Lucas em 18/11/2026. Depois do primeiro envio à Play Store o appId nunca mais muda.
  appId: 'io.github.flushin.mistpeak',
  appName: 'Mistpeak',
  webDir: 'dist',
  android: {
    // o jogo não abre sites; bloqueia conteúdo http dentro do app
    allowMixedContent: false,
  },
};

export default config;
