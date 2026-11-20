// Mapas da wiki: lê os mesmos public/maps/<id>.json que o jogo carrega (nome, pontos de monstros e portais).
import { MAP_IDS } from '../core/mapsConfig';

export interface Spawn {
  monster: string;
  minLevel?: number;
  maxLevel?: number;
}
export interface Portal {
  target: string;
  minLevel: number;
  /** portal de menu (o Portal das Masmorras da vila): sem destino fixo */
  menu?: string;
}
export interface WikiMap {
  id: string;
  name: string;
  spawns: Spawn[];
  portals: Portal[];
  npcs: string[];
}

type Tiled = {
  properties?: { name: string; value: unknown }[];
  layers: {
    type: string;
    objects?: { type: string; name?: string; properties?: { name: string; value: unknown }[] }[];
  }[];
};
const props = (p?: { name: string; value: unknown }[]) => Object.fromEntries((p ?? []).map((x) => [x.name, x.value]));

async function loadOne(id: string): Promise<WikiMap> {
  const r = await fetch(`../maps/${id}.json`);
  const j = (await r.json()) as Tiled;
  const m: WikiMap = { id, name: String(props(j.properties).displayName ?? id), spawns: [], portals: [], npcs: [] };
  for (const l of j.layers)
    for (const o of l.objects ?? []) {
      const p = props(o.properties);
      if (o.type === 'monsterSpawn')
        m.spawns.push({
          monster: String(p.monster),
          minLevel: Number(p.minLevel) || undefined,
          maxLevel: Number(p.maxLevel) || undefined,
        });
      else if (o.type === 'portal')
        m.portals.push(
          p.menu
            ? { target: '', minLevel: 0, menu: String(p.menu) }
            : { target: String(p.target), minLevel: Number(p.minLevel) || 0 },
        );
      else if (o.type === 'npc') m.npcs.push(String(p.npc));
    }
  return m;
}

let all: Promise<WikiMap[]> | null = null;
const names: Record<string, string> = {};
/** Todos os mapas do jogo, na ordem de src/core/mapsConfig.ts. */
export const loadMaps = () =>
  (all ??= Promise.all(MAP_IDS.map(loadOne)).then((ms) => {
    for (const m of ms) names[m.id] = m.name;
    return ms;
  }));
/** Nome do mapa para páginas que não esperam os mapas (o id enquanto ainda não carregaram). */
export const mapName = (id: string) => names[id] ?? id;
