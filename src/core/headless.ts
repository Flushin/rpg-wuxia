// Ponto de entrada do core "headless" (roadmap M0, E1c): o mesmo código do jogo, sem Phaser, DOM nem navegador,
// para rodar no servidor (Node, Deno, Supabase Edge Functions, Cloud Functions) e nos testes.
// Gerado por `npm run build:headless` em dist-headless/mistpeak-core.mjs; o `npm run check:headless` confere que o
// pacote roda em Node puro e que dá exatamente o mesmo resultado que o navegador (tools/fixtures/headless-golden.json).
//
// Regras para o servidor:
// - o relógio é SEMPRE o do servidor (Clock), nunca o lastSeen ou o horário que o aparelho mandou;
// - o idioma não importa para o resultado (só muda nomes); o padrão é português;
// - chame applyOfflineOnServer uma vez por envio (ele troca o gerador de uid global; o código é síncrono).
import cidade from '../../public/maps/cidade.json';
import floresta from '../../public/maps/floresta.json';
import ruinas from '../../public/maps/ruinas.json';
import montanha from '../../public/maps/montanha.json';
import { parseTiledMap, type GameMap } from './map';
import { MAP_IDS } from './mapsConfig';
import { World, type OfflineReport } from './world';
import { type Clock } from './clock';
import { createUidSource, setUidSource } from './uid';
import type { SaveData } from './types';

export { World, type OfflineReport } from './world';
export { systemClock, fixedClock, ManualClock, derivedClock, type Clock } from './clock';
export { createUidSource, setUidSource, newUid, type UidSource } from './uid';
export { initLang, type Lang } from './i18n';
export { computeOffline } from './offline';
export { migrateSaves } from './saves';
export { CHARACTER_SAVE_VERSION } from './saveFormat';
export { parseTiledMap, type GameMap } from './map';
export { sumLedger, type EconEntry, type EconSource } from './world/ledger';
/** Limites de XP/h, ouro/h e nível de item por nível e mapa (gerado por npm run sim:plausibility). */
export { default as plausibility } from '../data/plausibility.json';
export type { SaveData, ItemInstance, GameEvent } from './types';

const RAW_MAPS: Record<string, unknown> = { cidade, floresta, ruinas, montanha };

/** Os mapas do jogo, já lidos (vêm embutidos no pacote headless). */
export function loadBundledMaps(): Record<string, GameMap> {
  const maps: Record<string, GameMap> = {};
  for (const id of MAP_IDS) {
    if (!RAW_MAPS[id]) throw new Error(`mapa ${id} não está embutido em src/core/headless.ts`);
    maps[id] = parseTiledMap(id, RAW_MAPS[id] as Parameters<typeof parseTiledMap>[1]);
  }
  return maps;
}

export interface ServerLoadResult {
  /** o save depois do ganho offline, com lastSeen = relógio do servidor */
  save: SaveData;
  /** o resumo do ganho offline (null se não houve) */
  offline: OfflineReport | null;
  /** o World carregado, para conferências extras */
  world: World;
}

/**
 * Carrega um save e aplica o ganho offline com o relógio do servidor (o mesmo que o jogo faz ao abrir o último
 * personagem). Com o mesmo save e o mesmo instante, o resultado é idêntico ao do navegador.
 */
export function applyOfflineOnServer(
  maps: Record<string, GameMap>,
  save: SaveData,
  clock: Clock,
  opts: { uidPrefix?: string } = {},
): ServerLoadResult {
  const now = clock.now();
  setUidSource(createUidSource({ clock, prefix: opts.uidPrefix ?? 'srv', seed: now }));
  const world = World.fromSave(maps, save, now, true, clock);
  return { save: world.serialize(), offline: world.offlineReport, world };
}
