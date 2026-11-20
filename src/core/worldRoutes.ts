// Mapa-múndi: o grafo de portais entre os mapas e a rota (menor número de portais) de qualquer mapa a qualquer outro.
// Lido dos próprios mapas (objetos portal de public/maps/*.json): mapa ou portal novo entra sozinho.
// Portais de menu (Portal das Masmorras, Trial) viram uma ligação para cada mapa que o menu oferece.
// O Mestre dos Caminhos (teleporte, src/core/teleport.ts) vira uma ligação da vila para cada destino (menu 'caminhos');
// a rota só usa o teleporte quando não há caminho a pé (decisão de 20/11/2026).
import { MONSTERS } from './data';
import { DUNGEONS } from './dungeons';
import type { GameMap, MapObject } from './map';
import { portalMinLevel } from './mapsConfig';
import { TELEPORT_COST, TELEPORT_DESTS } from './teleport';
import { TRIAL_MAP, TRIAL_MIN_LEVEL } from './trial';

export interface WorldLink {
  from: string;
  to: string;
  /** o portal no mapa de origem (nome, posição); no teleporte, o próprio NPC */
  portal: MapObject;
  /** nível mínimo para atravessar (portal com minLevel ou entrada da masmorra/Trial) */
  minLevel: number;
  /** 'masmorras' | 'trial' quando é um portal de menu (escolher o destino no menu); 'caminhos' = teleporte do NPC */
  menu?: string;
  /** ouro cobrado para entrar (masmorras) ou viajar (teleporte) */
  cost?: number;
}

/** Todas as ligações de um mapa para outro, na ordem dos objetos de cada mapa. */
export function worldLinks(maps: Record<string, GameMap>): WorldLink[] {
  const out: WorldLink[] = [];
  for (const m of Object.values(maps))
    for (const o of m.objects) {
      if (o.type !== 'portal') continue;
      const menu = o.props.menu ? String(o.props.menu) : undefined;
      if (menu === 'masmorras') {
        for (const d of DUNGEONS)
          if (maps[d.map]) out.push({ from: m.id, to: d.map, portal: o, minLevel: d.minLevel, menu, cost: d.cost });
      } else if (menu === 'trial') {
        if (maps[TRIAL_MAP]) out.push({ from: m.id, to: TRIAL_MAP, portal: o, minLevel: TRIAL_MIN_LEVEL, menu });
      } else if (o.props.target && maps[String(o.props.target)])
        out.push({ from: m.id, to: String(o.props.target), portal: o, minLevel: portalMinLevel(o) });
    }
  for (const m of Object.values(maps)) {
    const npc = m.objects.find((o) => o.type === 'npc' && o.props.npc === 'caminhos');
    if (!npc) continue;
    for (const d of TELEPORT_DESTS)
      if (maps[d.map] && d.map !== m.id)
        out.push({ from: m.id, to: d.map, portal: npc, minLevel: d.minLevel, menu: 'caminhos', cost: TELEPORT_COST });
  }
  return out;
}

/** Caminho de `from` até `to`: a pé (portais) sempre que der; o teleporte do Mestre dos Caminhos só se não houver
 *  caminho a pé. [] se já está lá; null se não há caminho. */
export function worldRoute(links: WorldLink[], from: string, to: string): WorldLink[] | null {
  return (
    shortestRoute(
      links.filter((l) => l.menu !== 'caminhos'),
      from,
      to,
    ) ?? shortestRoute(links, from, to)
  );
}

/** Caminho de `from` até `to` (busca em largura: menos portais). [] se já está lá; null se não há caminho. */
function shortestRoute(links: WorldLink[], from: string, to: string): WorldLink[] | null {
  if (from === to) return [];
  const prev = new Map<string, WorldLink>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const l of links) {
      if (l.from !== cur || seen.has(l.to)) continue;
      seen.add(l.to);
      prev.set(l.to, l);
      if (l.to === to) {
        const path: WorldLink[] = [];
        for (let at = to; at !== from; ) {
          const step = prev.get(at)!;
          path.unshift(step);
          at = step.from;
        }
        return path;
      }
      queue.push(l.to);
    }
  }
  return null;
}

/** Faixa de nível dos monstros comuns de um mapa (como a wiki), ou null se não tem monstros. */
export function mapLevels(m: GameMap): [number, number] | null {
  const lv: number[] = [];
  for (const o of m.objects) {
    if (o.type !== 'monsterSpawn') continue;
    const d = MONSTERS[String(o.props.monster)];
    if (!d || d.boss) continue;
    const lo = Number(o.props.minLevel) || d.minLevel;
    lv.push(lo, Number(o.props.maxLevel) || Number(o.props.minLevel) || d.maxLevel);
  }
  return lv.length ? [Math.min(...lv), Math.max(...lv)] : null;
}

/** Em que lado da tela (vista isométrica) fica o portal, olhando o mapa inteiro:
 *  0 = acima, 1 = acima à direita, 2 = à direita, ... 7 = acima à esquerda (sentido horário). */
export function portalSide(m: GameMap, o: MapObject): number {
  const dx = o.x + o.w / 2 - m.width / 2,
    dy = o.y + o.h / 2 - m.height / 2;
  // tile -> tela: x cresce para baixo-direita, y para baixo-esquerda
  const sx = dx - dy,
    sy = (dx + dy) / 2;
  const ang = Math.atan2(sx, -sy); // 0 = para cima, sentido horário
  return (Math.round(ang / (Math.PI / 4)) + 8) % 8;
}
