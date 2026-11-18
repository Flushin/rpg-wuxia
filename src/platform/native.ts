// Ajustes que só existem no app (Capacitor), feitos uma vez ao abrir o jogo. Na web não faz nada.
import { StatusBar } from '@capacitor/status-bar';
import { isNative } from './index';

export function initNativeApp() {
  if (!isNative) return;
  // tela cheia: esconde a barra de status (hora, bateria) por cima do jogo
  void StatusBar.hide().catch(() => {});
}
