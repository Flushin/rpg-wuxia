// Masmorras: instâncias escolhidas no menu do Portal das Masmorras (saída oeste da vila).
// Regras (aprovadas pelo Lucas em 19/11/2026): entrada paga em ouro; monstros não renascem; chefe no fim com item
// garantido; o Auto não funciona lá dentro; morrer, sair ou fechar o jogo encerra a corrida (volta à vila).
// O desenho de cada masmorra é um mapa comum (public/maps/<map>.json) marcado com dungeon: true em mapsConfig.ts.
import { MAPS_CONFIG } from './mapsConfig';

export interface DungeonDef {
  id: string;
  /** id do mapa (public/maps/<map>.json); o nome mostrado é o displayName do mapa */
  map: string;
  /** nível mínimo do personagem para entrar */
  minLevel: number;
  /** ouro cobrado a cada entrada */
  cost: number;
  /** faixa de nível dos monstros (chefe incluído), para o menu e a wiki */
  levels: [number, number];
  desc: { pt: string; en: string };
}

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'gruta',
    map: 'gruta',
    minLevel: 10,
    cost: 250,
    levels: [11, 15],
    desc: {
      pt: 'Um desfiladeiro congelado sob a montanha, cheio de espectros e yetis. No fundo dorme o Yeti Ancestral.',
      en: 'A frozen gorge beneath the mountain, full of spectres and yetis. The Ancestral Yeti sleeps at its end.',
    },
  },
];

/** Chance de equipamento dos monstros dentro de uma masmorra: +25% sobre a dos mapas abertos. */
export const DUNGEON_EQUIP_DROP_MUL = 1.25;

export const dungeonById = (id: string) => DUNGEONS.find((d) => d.id === id);
export const isDungeonMap = (mapId: string) => !!MAPS_CONFIG[mapId]?.dungeon;
