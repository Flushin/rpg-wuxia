// O que o código precisa saber de cada mapa, num lugar só (etapa C5). O desenho do mapa (tiles, portais, spawns)
// continua nos JSON de public/maps/, gerados por tools/gen-maps.mjs.
// Para um mapa novo: gerar o JSON e acrescentar uma entrada aqui.
// Não importa Phaser: é lido pelo núcleo (World, Auto), pela cena de boot e pelo desenho (mapView, áudio).

export interface MapConfig {
  /** Cidade: regenera vida/mana fora de combate e o Auto não caça aqui (vai para o mapa de caça). */
  town?: boolean;
  /** Chave da música em src/data/audio.json ("music"); sem música = continua a que estava. */
  music?: string;
  /** Árvores: 'city' mistura cerejeiras; 'forest' só árvores comuns; 'snow' = pinheiros (tile 'pine');
   *  'bamboo' = moitas de bambu (tile 'bamboo', atlas props-bambu). */
  trees: 'city' | 'forest' | 'snow' | 'bamboo';
  /** Chance (0–1) de um tile de grama ganhar enfeite (flor, cogumelo, pedra…). */
  grassDecor?: number;
  /** Arena do chefe: os pilares dentro deste círculo (em tiles) viram braseiros. */
  arena?: { x: number; y: number; r: number };
  /** Auto voltando à cidade: se não houver portal direto para uma cidade, sai por este mapa. */
  autoExitVia?: string;
  /** Auto ligado na cidade: vai caçar no mapa com o maior autoFromLevel <= nível do personagem (que tenha monstros). */
  autoFromLevel?: number;
  /** Masmorra (instância, src/core/dungeons.ts): só se entra pelo menu do portal; monstros não renascem; sem Auto. */
  dungeon?: boolean;
  /** Trial (src/core/trial.ts): instância como a masmorra, mas o chefe é escolhido no menu do portal sul da vila. */
  trial?: boolean;
  /** Ganho offline caçando aqui: multiplica a eficiência das faixas de tempo (nível 30: 5/6 nos mapas 20–30). */
  offlineMul?: number;
  /** Posição no mapa-múndi (janela do mapa, aba Mundo): coluna e linha de uma grade; mapa sem ela não aparece. */
  world?: { col: number; row: number };
}

export const MAPS_CONFIG: Record<string, MapConfig> = {
  cidade: { town: true, world: { col: 1, row: 2 }, music: 'music_cidade', trees: 'city', grassDecor: 0.035 },
  floresta: {
    music: 'music_floresta',
    trees: 'forest',
    grassDecor: 0.09,
    autoFromLevel: 1,
    world: { col: 2, row: 2 },
  },
  ruinas: { trees: 'forest', arena: { x: 24.5, y: 16.5, r: 6.2 }, autoExitVia: 'floresta', world: { col: 3, row: 2 } },
  // marco 9: entrada pela saída norte da vila (portal com minLevel 10); arena = pátio do templo (tools/gen-maps.mjs)
  montanha: { trees: 'snow', arena: { x: 16, y: 6, r: 5.5 }, autoFromLevel: 10, world: { col: 1, row: 1 } },
  // nível 30: Bosque de Bambu Sombrio (nv 20–25), pelo passo leste da montanha (portal minLevel 20); offline a 5/6
  bambu: {
    music: 'music_floresta',
    trees: 'bamboo',
    grassDecor: 0.06,
    autoFromLevel: 20,
    autoExitVia: 'montanha',
    offlineMul: 5 / 6,
    world: { col: 2, row: 1 },
  },
  // nível 30: Pico da Névoa (nv 25–30), saída norte do Bosque (minLevel 25); santuário = arena do Senhor da Névoa
  pico: {
    trees: 'snow',
    arena: { x: 16, y: 6, r: 5.5 },
    autoFromLevel: 25,
    autoExitVia: 'bambu',
    offlineMul: 5 / 6,
    world: { col: 2, row: 0 },
  },
  // masmorra (src/core/dungeons.ts): Desfiladeiro do Gelo Eterno; arena do Yeti Ancestral no norte
  gruta: { trees: 'snow', arena: { x: 16, y: 6, r: 5.5 }, dungeon: true, world: { col: 0, row: 1 } },
  // masmorra: Mosteiro Profanado; salão do Patriarca Profanado no norte
  mosteiro: {
    trees: 'city',
    grassDecor: 0.08,
    arena: { x: 16, y: 6, r: 5.5 },
    dungeon: true,
    world: { col: 0, row: 2 },
  },
  // masmorra: Covil dos Bandidos; terreiro do Rei dos Bandidos no norte
  covil: {
    trees: 'forest',
    grassDecor: 0.09,
    arena: { x: 16, y: 6, r: 5.5 },
    dungeon: true,
    world: { col: 0, row: 3 },
  },
  // Trial: arena única; o chefe escolhido no menu nasce no centro da arena (World.enterTrial)
  trial: {
    trees: 'city',
    grassDecor: 0.04,
    arena: { x: 16, y: 9, r: 5.5 },
    dungeon: true,
    trial: true,
    world: { col: 1, row: 3 },
  },
};

/** Mapas carregados no boot (public/maps/<id>.json). */
export const MAP_IDS = Object.keys(MAPS_CONFIG);
/** Onde o personagem começa, renasce ao morrer e para onde vai um save com mapa desconhecido. */
export const HOME_MAP = 'cidade';
export const TOWN_MAPS = new Set(MAP_IDS.filter((id) => MAPS_CONFIG[id].town));

/** Nível mínimo para atravessar um portal (propriedade minLevel do objeto no mapa); 0 = livre. */
export const portalMinLevel = (o: { props: Record<string, string | number | boolean> }) =>
  Number(o.props.minLevel) || 0;
