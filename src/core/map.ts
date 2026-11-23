import { tn } from './i18n';

export interface MapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number; // em tiles
  props: Record<string, string | number | boolean>;
}
export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: string[];
  walkable: boolean[];
  objects: MapObject[];
}
interface Prop {
  name: string;
  value: string | number | boolean;
}
const toProps = (p?: Prop[]) => Object.fromEntries((p ?? []).map((q) => [q.name, q.value]));

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseTiledMap(id: string, json: any): GameMap {
  const ts = json.tilesets[0];
  const byGid = new Map<number, { name: string; walkable: boolean }>();
  for (const t of ts.tiles as any[]) {
    const p = toProps(t.properties);
    byGid.set(ts.firstgid + t.id, { name: String(p.name), walkable: p.walkable === true });
  }
  const ground = json.layers.find((l: any) => l.type === 'tilelayer');
  const tiles: string[] = [],
    walkable: boolean[] = [];
  for (const gid of ground.data as number[]) {
    const t = byGid.get(gid);
    tiles.push(t?.name ?? 'water');
    walkable.push(t?.walkable ?? false);
  }
  const th = json.tileheight as number;
  const objects: MapObject[] = [];
  for (const l of json.layers.filter((l: any) => l.type === 'objectgroup'))
    for (const o of l.objects)
      objects.push({
        id: o.id,
        name: o.name,
        type: o.type,
        x: o.x / th,
        y: o.y / th,
        w: o.width / th,
        h: o.height / th,
        props: toProps(o.properties),
      });
  // enfeites que bloqueiam (lanternas, estandartes, poço...) tiram o tile da caminhada; um 'building' com block
  // (banca sobre piso de pedra) tira a área inteira, sem trocar o piso por casa
  for (const o of objects)
    if ((o.type === 'decor' || o.type === 'building') && o.props.block) {
      const w = o.type === 'building' ? Math.max(1, Math.round(o.w)) : 1,
        h = o.type === 'building' ? Math.max(1, Math.round(o.h)) : 1;
      for (let dj = 0; dj < h; dj++)
        for (let di = 0; di < w; di++) {
          const i = Math.floor(o.x) + di,
            j = Math.floor(o.y) + dj;
          if (i >= 0 && j >= 0 && i < json.width && j < json.height) walkable[j * json.width + i] = false;
        }
    }
  const name = tn(String(toProps(json.properties).displayName ?? id));
  return { id, name, width: json.width, height: json.height, tiles, walkable, objects };
}
