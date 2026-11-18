// App das lojas (Capacitor): o mesmo jogo do `dist/` dentro de um WebView nativo. Ver docs/android.md.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // PROVISÓRIO: o Lucas pode mudar o nome do jogo. Depois do primeiro envio à Play Store o appId nunca mais muda.
  // Trocar aqui é o suficiente enquanto a pasta android/ for gerada na hora (npx cap add android).
  appId: 'io.github.flushin.wanderers',
  appName: 'Wanderers',
  webDir: 'dist',
  android: {
    // o jogo não abre sites; bloqueia conteúdo http dentro do app
    allowMixedContent: false,
  },
};

export default config;
