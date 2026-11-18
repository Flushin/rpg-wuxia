// O que o código precisa saber de cada mapa, num lugar só (etapa C5). O desenho do mapa (tiles, portais, spawns)
// continua nos JSON de public/maps/, gerados por tools/gen-maps.mjs.
// Para um mapa novo: gerar o JSON e acrescentar uma entrada aqui.
// Não importa Phaser: é lido pelo núcleo (World, Auto), pela cena de boot e pelo desenho (mapView, áudio).

export interface MapConfig {
  /** Cidade: regenera vida/mana fora de combate e o Auto não caça aqui (vai para o mapa de caça). */
  town?: boolean;
  /** Chave da música em src/data/audio.json ("music"); sem música = continua a que estava. */
  music?: string;
  /** Árvores: 'city' mistura cerejeiras; 'forest' só árvores comuns. */
  trees: 'city' | 'forest';
  /** Chance (0–1) de um tile de grama ganhar enfeite (flor, cogumelo, pedra…). */
  grassDecor?: number;
  /** Arena do chefe: os pilares dentro deste círculo (em tiles) viram braseiros. */
  arena?: { x: number; y: number; r: number };
  /** Auto voltando à cidade: se não houver portal direto para uma cidade, sai por este mapa. */
  autoExitVia?: string;
}

export const MAPS_CONFIG: Record<string, MapConfig> = {
  cidade: { town: true, music: 'music_cidade', trees: 'city', grassDecor: 0.035 },
  floresta: { music: 'music_floresta', trees: 'forest', grassDecor: 0.09 },
  ruinas: { trees: 'forest', arena: { x: 24.5, y: 16.5, r: 6.2 }, autoExitVia: 'floresta' },
};

/** Mapas carregados no boot (public/maps/<id>.json). */
export const MAP_IDS = Object.keys(MAPS_CONFIG);
/** Onde o personagem começa, renasce ao morrer e para onde vai um save com mapa desconhecido. */
export const HOME_MAP = 'cidade';
export const TOWN_MAPS = new Set(MAP_IDS.filter((id) => MAPS_CONFIG[id].town));
