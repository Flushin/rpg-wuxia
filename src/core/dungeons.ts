// Masmorras: instâncias escolhidas no menu do Portal das Masmorras (saída oeste da vila).
// Regras (aprovadas pelo Lucas em 19/11/2026; segunda e terceira masmorras também em 19/11/2026): entrada paga em ouro; monstros não renascem; chefe no fim com item
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
  {
    id: 'mosteiro',
    map: 'mosteiro',
    minLevel: 16,
    cost: 500,
    levels: [16, 20],
    desc: {
      pt: 'Um mosteiro tomado pela corrupção do Abade: monges profanados, almas penadas e guardiões de pedra. No salão principal, o Patriarca Profanado entra em fúria quando ferido.',
      en: "A monastery overtaken by the Abbot's corruption: defiled monks, restless souls and stone guardians. In the main hall, the Defiled Patriarch becomes enraged when wounded.",
    },
  },
  {
    id: 'covil',
    map: 'covil',
    minLevel: 20,
    cost: 1000,
    levels: [20, 22],
    desc: {
      pt: 'O esconderijo dos bandidos mais perigosos da região: salteadores, besteiros e brutamontes que atacam em bando. No terreiro, o Rei dos Bandidos corta em linha reta e, ferido, em leque.',
      en: 'The hideout of the most dangerous bandits in the region: raiders, crossbowmen and brutes that attack in packs. In the yard, the Bandit King slashes in straight lines and, when wounded, in a fan.',
    },
  },
];

/** Chance de equipamento dos monstros dentro de uma masmorra: +25% sobre a dos mapas abertos. */
export const DUNGEON_EQUIP_DROP_MUL = 1.25;

export const dungeonById = (id: string) => DUNGEONS.find((d) => d.id === id);
export const isDungeonMap = (mapId: string) => !!MAPS_CONFIG[mapId]?.dungeon;
