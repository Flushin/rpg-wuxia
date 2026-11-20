// Teleporte do Mestre dos Caminhos (NPC da vila): viagem paga da vila direto para um mapa de caça.
// Regras (aprovadas pelo Lucas em 20/11/2026, docs/decisoes/teleporte.md): só da vila para fora (a volta é a pé ou
// com o Pergaminho de Retorno); liberação só por nível mínimo (nada novo no save); custo fixo em ouro por viagem.
// Destino novo: acrescentar uma entrada aqui; o nível mínimo nunca pode ser menor que o do caminho a pé
// (npm run check:teleport confere).

export interface TeleportDest {
  /** id do destino = id do mapa (public/maps/<map>.json); o nome mostrado é o displayName do mapa */
  map: string;
  /** região, para agrupar a lista na janela de viagem */
  region: { pt: string; en: string };
  /** nível mínimo do personagem para viajar */
  minLevel: number;
  /** ponto de chegada (tiles); sem ele, chega no spawn do mapa */
  x?: number;
  y?: number;
}

/** Ouro cobrado a cada viagem, qualquer destino. */
export const TELEPORT_COST = 200;

const EAST = { pt: 'Caminho do Leste', en: 'Eastern Road' };
const NORTH = { pt: 'Caminho do Norte', en: 'Northern Road' };

export const TELEPORT_DESTS: TeleportDest[] = [
  { map: 'floresta', region: EAST, minLevel: 0 },
  { map: 'ruinas', region: EAST, minLevel: 0 },
  { map: 'montanha', region: NORTH, minLevel: 10 },
  { map: 'bambu', region: NORTH, minLevel: 20 },
  { map: 'pico', region: NORTH, minLevel: 25 },
];

export const teleportById = (map: string) => TELEPORT_DESTS.find((d) => d.map === map);

/** Por que não dá para viajar agora (null = pode). */
export function teleportBlock(
  d: TeleportDest,
  level: number,
  gold: number,
): { code: 'needLevel'; level: number } | { code: 'noGold' } | null {
  if (level < d.minLevel) return { code: 'needLevel', level: d.minLevel };
  if (gold < TELEPORT_COST) return { code: 'noGold' };
  return null;
}
