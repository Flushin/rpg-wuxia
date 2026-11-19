// Primeira coisa que roda no jogo (é o primeiro import de src/main.ts; precisa continuar sendo).
// Prepara o core com o que vem do navegador, antes de qualquer dado do jogo ser carregado:
// - idioma (o core não lê o navegador; roadmap M0, E1b);
// - gerador de uid de itens com o id deste aparelho (roadmap M0, "uid à prova de servidor");
// - pedido de armazenamento persistente na web (roadmap M0).
import { initLang } from './core/i18n';
import { systemClock } from './core/clock';
import { createUidSource, setUidSource } from './core/uid';
import { detectLang } from './ui/lang';
import { PREF, getPref, setPref } from './platform/prefs';
import { requestPersistentStorage } from './platform/storage';

initLang(detectLang());

/** Id aleatório do aparelho, criado na primeira abertura (sem armazenamento, vale só nesta sessão). */
function deviceId(): string {
  const saved = getPref(PREF.DEVICE_ID);
  if (saved && /^[a-z0-9]{8}$/.test(saved)) return saved;
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  setPref(PREF.DEVICE_ID, id);
  return id;
}
const seed = new Uint32Array(1);
globalThis.crypto.getRandomValues(seed);
setUidSource(createUidSource({ clock: systemClock, prefix: deviceId(), seed: seed[0] }));

void requestPersistentStorage();
