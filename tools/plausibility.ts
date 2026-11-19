// Coleta do plausibility.json (roadmap M0, E4a): durante o sim:balance, mede XP/h, ouro/h e o nível de item mais alto
// por nível do personagem e por mapa, a partir do registro econômico do World (src/core/world/ledger.ts).
// O servidor (M1, E4c) compara cada envio com estes limites (com folga) e marca a conta suspeita.
// Gerar de novo: npm run sim:plausibility (depois de qualquer mudança de balanceamento).
import { MONSTERS } from '../src/core/data';
import { MAP_IDS, TOWN_MAPS } from '../src/core/mapsConfig';
import type { GameMap } from '../src/core/map';
import type { World } from '../src/core/world';
import type { EconSource } from '../src/core/world/ledger';

/** Fontes que contam no ritmo de caça. Missões (uma vez só, conferidas pela etapa da cadeia) e o ganho offline
 * (calculado pelo próprio servidor) ficam de fora. */
const RATE_SOURCES = new Set<EconSource>(['kill', 'loot', 'sell']); // venda conta no limite por nível (é na cidade)
const ITEM_SOURCES = new Set<EconSource>(['loot', 'merchant', 'quest', 'offline']);

interface Acc {
  sec: number;
  xp: number;
  gold: number;
  maxIlvl: number;
}
/** acumulado de UMA execução: "nível|mapa" → totais */
export class PlausRun {
  acc = new Map<string, Acc>();
  tick(w: World, dt: number) {
    const k = `${w.player.level}|${w.mapId}`;
    let a = this.acc.get(k);
    if (!a) this.acc.set(k, (a = { sec: 0, xp: 0, gold: 0, maxIlvl: 0 }));
    a.sec += dt;
    for (const e of w.drainLedger().entries) {
      if (RATE_SOURCES.has(e.src)) {
        a.xp += e.xp ?? 0;
        a.gold += Math.max(0, e.gold ?? 0);
      }
      if (ITEM_SOURCES.has(e.src)) for (const it of e.itemsIn ?? []) a.maxIlvl = Math.max(a.maxIlvl, it.ilvl ?? 1);
    }
  }
}

/** Maior nível de monstro que nasce em cada mapa (limite teórico do nível dos itens que caem ali). */
function mapMonsterMax(maps: Record<string, GameMap>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of MAP_IDS) {
    let mx = 0;
    for (const o of maps[id]?.objects ?? []) {
      if (o.type !== 'monsterSpawn') continue;
      const def = MONSTERS[String(o.props.monster)];
      if (!def) continue;
      mx = Math.max(mx, Number(o.props.maxLevel) || Number(o.props.minLevel) || def.maxLevel);
    }
    out[id] = mx;
  }
  return out;
}

export const MARGIN = { rate: 2.5, ilvl: 2, minSampleMin: 3 };

/** Junta as execuções: em cada nível|mapa, o MAIOR ritmo médio entre todas (seitas × sementes). */
export function buildPlausibility(runs: PlausRun[], maps: Record<string, GameMap>) {
  const best = new Map<string, { xpH: number; goldH: number; maxIlvl: number; sampleMin: number }>();
  for (const r of runs)
    for (const [k, a] of r.acc) {
      if (TOWN_MAPS.has(k.split('|')[1])) continue;
      const b = best.get(k) ?? { xpH: 0, goldH: 0, maxIlvl: 0, sampleMin: 0 };
      b.sampleMin += a.sec / 60;
      b.maxIlvl = Math.max(b.maxIlvl, a.maxIlvl);
      if (a.sec >= MARGIN.minSampleMin * 60) {
        b.xpH = Math.max(b.xpH, (a.xp / a.sec) * 3600);
        b.goldH = Math.max(b.goldH, (a.gold / a.sec) * 3600);
      }
      best.set(k, b);
    }
  const monMax = mapMonsterMax(maps);
  const levels: Record<string, Record<string, unknown>> = {};
  const huntMaps = MAP_IDS.filter((m) => !TOWN_MAPS.has(m));
  for (let L = 1; L <= 20; L++) {
    const row: Record<string, unknown> = {};
    for (const m of huntMaps) {
      const b = best.get(`${L}|${m}`);
      if (!b || !b.xpH) continue;
      row[m] = {
        xpPerHour: Math.ceil(b.xpH * MARGIN.rate),
        goldPerHour: Math.ceil(b.goldH * MARGIN.rate),
        maxItemLevel: Math.max(b.maxIlvl, monMax[m]) + MARGIN.ilvl,
        observed: { xpPerHour: Math.round(b.xpH), goldPerHour: Math.round(b.goldH), maxItemLevel: b.maxIlvl },
        sampleMin: Math.round(b.sampleMin),
      };
    }
    // sem amostra neste nível em mapa nenhum: herda o vizinho de baixo (o servidor sempre tem um limite)
    if (!Object.keys(row).length && L > 1) Object.assign(row, levels[String(L - 1)]);
    levels[String(L)] = row;
  }
  // limite por nível, contando o tempo TODO naquele nível (caça, cidade, viagens; vendas incluídas): é o ritmo real de
  // jogo que o servidor vê entre dois envios. Maior média entre as execuções, vezes a folga.
  const any: Record<string, unknown> = {};
  const lvBest = new Map<number, { xpH: number; goldH: number }>();
  for (const r of runs) {
    const tot = new Map<number, { sec: number; xp: number; gold: number }>();
    for (const [k, a] of r.acc) {
      const L = Number(k.split('|')[0]);
      const t = tot.get(L) ?? { sec: 0, xp: 0, gold: 0 };
      t.sec += a.sec;
      t.xp += a.xp;
      t.gold += a.gold;
      tot.set(L, t);
    }
    for (const [L, t] of tot) {
      if (t.sec < MARGIN.minSampleMin * 60) continue;
      const b = lvBest.get(L) ?? { xpH: 0, goldH: 0 };
      b.xpH = Math.max(b.xpH, (t.xp / t.sec) * 3600);
      b.goldH = Math.max(b.goldH, (t.gold / t.sec) * 3600);
      lvBest.set(L, b);
    }
  }
  for (let L = 1; L <= 20; L++) {
    const b = lvBest.get(L);
    const v = Object.values(levels[String(L)]) as { maxItemLevel: number }[];
    if (!b) {
      if (L > 1) any[String(L)] = any[String(L - 1)];
      continue;
    }
    any[String(L)] = {
      xpPerHour: Math.ceil(b.xpH * MARGIN.rate),
      goldPerHour: Math.ceil(b.goldH * MARGIN.rate),
      maxItemLevel: v.length ? Math.max(...v.map((x) => x.maxItemLevel)) : undefined,
      observed: { xpPerHour: Math.round(b.xpH), goldPerHour: Math.round(b.goldH) },
    };
  }
  // níveis sem amostra suficiente no começo (o 1 e o 2 passam em menos de 3 min): usam o primeiro nível acima
  for (let L = 19; L >= 1; L--) {
    if (!Object.keys(levels[String(L)]).length) levels[String(L)] = levels[String(L + 1)];
    if (!any[String(L)]) any[String(L)] = any[String(L + 1)];
  }
  return {
    _doc: 'Limites de plausibilidade (roadmap M0 E4a; usados pelo servidor no M1 E4c). Gerado por `npm run sim:plausibility` a partir do sim:balance: maior ritmo médio de caça entre as 4 seitas e as sementes, vezes a folga. XP e ouro contam só abates, saque e venda (missões e ganho offline ficam de fora). maxItemLevel = maior entre o observado e o monstro mais forte do mapa, mais a folga. Não editar à mão.',
    margin: MARGIN,
    perLevelAndMap: levels,
    perLevel: any,
  };
}
