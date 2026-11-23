// Teleporte do Mestre dos Caminhos (NPC das cidades): viagem paga de uma cidade direto para um mapa de caça ou para
// outra cidade. Regras (aprovadas pelo Lucas em 20/11/2026, docs/decisoes/teleporte.md): só de uma cidade para fora (a
// volta dos mapas de caça é a pé ou com o Pergaminho de Retorno); liberação só por nível mínimo (nada novo no save);
// custo fixo em ouro por viagem. Cidadela de Jade (21/11/2026): só pelo teleporte, nível 30; a volta à vila é grátis.
// Destino novo: acrescentar uma entrada aqui; o nível mínimo nunca pode ser menor que o do caminho a pé
// (npm run check:teleport confere).

export interface TeleportDest {
  /** id do destino = id do mapa (public/maps/<map>.json); o nome mostrado é o displayName do mapa */
  map: string;
  /** região, para agrupar a lista na janela de viagem */
  region: { pt: string; en: string };
  /** nível mínimo do personagem para viajar */
  minLevel: number;
  /** ouro cobrado; sem ele, TELEPORT_COST */
  cost?: number;
  /** ponto de chegada (tiles); sem ele, chega no spawn do mapa */
  x?: number;
  y?: number;
}

/** Ouro cobrado a cada viagem, qualquer destino. */
export const TELEPORT_COST = 200;

const EAST = { pt: 'Caminho do Leste', en: 'Eastern Road' };
const NORTH = { pt: 'Caminho do Norte', en: 'Northern Road' };
const CITIES = { pt: 'Cidades', en: 'Cities' };
const CITADEL = { pt: 'Além da Cidadela', en: 'Beyond the Citadel' };

export const TELEPORT_DESTS: TeleportDest[] = [
  // cidades sempre primeiro na lista: o jogador vê logo que existem outras cidades
  // Cidadela de Jade: cidade do meio do jogo, só pelo teleporte; da Cidadela, a volta à vila não cobra (sem ouro
  // ninguém fica preso lá: o Pergaminho de Retorno não funciona dentro de uma cidade)
  { map: 'cidade', region: CITIES, minLevel: 0, cost: 0 },
  { map: 'cidadela', region: CITIES, minLevel: 30 },
  { map: 'porto', region: CITIES, minLevel: 50 },
  { map: 'floresta', region: EAST, minLevel: 0 },
  { map: 'ruinas', region: EAST, minLevel: 0 },
  { map: 'montanha', region: NORTH, minLevel: 10 },
  { map: 'bambu', region: NORTH, minLevel: 20 },
  { map: 'pico', region: NORTH, minLevel: 25 },
  // nível 40: mapas além do portão leste da Cidadela de Jade
  { map: 'vale', region: CITADEL, minLevel: 30 },
  { map: 'palacio', region: CITADEL, minLevel: 35 },
];

export const teleportById = (map: string) => TELEPORT_DESTS.find((d) => d.map === map);
/** Ouro cobrado para viajar até `d`. */
export const teleportCost = (d: TeleportDest) => d.cost ?? TELEPORT_COST;
/** Destinos oferecidos estando em `from` (nunca o próprio mapa). */
export const teleportDestsFrom = (from: string) => TELEPORT_DESTS.filter((d) => d.map !== from);

/** Por que não dá para viajar agora (null = pode). */
export function teleportBlock(
  d: TeleportDest,
  level: number,
  gold: number,
): { code: 'needLevel'; level: number } | { code: 'noGold' } | null {
  if (level < d.minLevel) return { code: 'needLevel', level: d.minLevel };
  if (gold < teleportCost(d)) return { code: 'noGold' };
  return null;
}
