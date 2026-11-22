// Preferências do aparelho (localStorage). Valem para todos os personagens deste navegador/aparelho.
// O save dos personagens fica no IndexedDB (src/save.ts), não aqui.
// As chaves não mudam: são as que já estão gravadas nos aparelhos dos jogadores.
export const PREF = {
  /** idioma: 'pt' | 'en' */
  LANG: 'rpg-wuxia-lang',
  /** zoom do jogador: 1 a 2 */
  ZOOM: 'rpg-zoom',
  /** tamanho da interface: 'auto' | 'p' | 'm' | 'g' */
  UI_SIZE: 'rpg-ui-size',
  /** contador de FPS: '1' ligado */
  FPS: 'rpg-fps',
  /** diagnóstico de toque na tela: '1' ligado */
  TOUCH_DEBUG: 'rpg-touch-debug',
  /** avisos de itens coletados: 'all' | 'rare' */
  LOOT_FEED: 'rpg.lootFeed',
  /** horário (ms) do último report de bug enviado */
  BUG_LAST: 'rpg-bug-last',
  /** volumes e mudo, em JSON (antes ficavam no save de cada personagem) */
  AUDIO: 'rpg-audio',
  /** layout do HUD no toque: 'novo' (padrão) | 'classico' (o de antes de 18/11/2026) */
  HUD_LAYOUT: 'rpg-hud-layout',
  /** última versão do jogo cujas novidades o jogador abriu (ex.: '0.1.0') */
  NEWS_SEEN: 'rpg-news-seen',
  /** modo descanso (economia de bateria no Auto): segundos sem tocar até entrar; '0' desligado */
  REST: 'rpg-rest',
  /** números de dano flutuantes: '0' desligado (padrão ligado) */
  FX_DAMAGE: 'rpg-fx-damage',
  /** tremor de tela: '0' desligado (padrão ligado) */
  FX_SHAKE: 'rpg-fx-shake',
  /** vibração no app: '0' desligada (padrão ligada) */
  FX_VIBRATE: 'rpg-fx-vibrate',
  /** aura elemental em volta do personagem: '0' desligada (padrão ligada) */
  FX_AURA: 'rpg-fx-aura',
} as const;
export type PrefKey = (typeof PREF)[keyof typeof PREF];

/** Lê uma preferência; null se não existir ou se o armazenamento estiver bloqueado (modo privado, Node nos testes). */
export function getPref(key: PrefKey): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Grava uma preferência; sem armazenamento, não faz nada (o jogo segue com o valor em memória). */
export function setPref(key: PrefKey, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* sem armazenamento */
  }
}
