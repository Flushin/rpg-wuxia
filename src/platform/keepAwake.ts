// Tela sempre acesa enquanto o Auto caça: se o celular apagar a tela, o jogo vai para segundo plano e passa a
// contar como offline (sem drop de material). Junto com o modo descanso (src/ui/restMode.ts) a tela fica preta,
// mas o jogo segue aberto. App: @capacitor-community/keep-awake; web: Screen Wake Lock, onde existir.
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './index';

type Lock = { release(): Promise<void> };
type WakeNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } };

let want = false;
let webLock: Lock | null = null;

async function applyWeb() {
  const wl = (navigator as WakeNav).wakeLock;
  if (!wl) return;
  if (want && !webLock && document.visibilityState === 'visible') {
    try {
      const lock = await wl.request('screen');
      if (want) webLock = lock;
      else void lock.release().catch(() => {});
    } catch {
      /* negado (economia de energia do aparelho etc.): segue sem */
    }
  } else if (!want && webLock) {
    const l = webLock;
    webLock = null;
    void l.release().catch(() => {});
  }
}

// na web o navegador solta o bloqueio ao trocar de aba; pede de novo ao voltar
if (!isNative && typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    webLock = null;
    void applyWeb();
  });

/** Liga/desliga a tela sempre acesa; chamadas repetidas com o mesmo valor não fazem nada. */
export function keepScreenOn(on: boolean) {
  if (on === want) return;
  want = on;
  if (isNative) void (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});
  else void applyWeb();
}
