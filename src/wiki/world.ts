// Páginas de missões (a cadeia principal, em ordem) e de mapas (minimapa desenhado dos tiles, monstros, NPCs e saídas).
import { MAPS_CONFIG } from '../core/mapsConfig';
import { DUNGEONS, DUNGEON_EQUIP_DROP_MUL } from '../core/dungeons';
import { TRIAL_BOSSES, TRIAL_MIN_LEVEL, TRIAL_TIERS, trialBossLevel, trialCost } from '../core/trial';
import { TELEPORT_COST, teleportById, teleportCost, teleportDestsFrom } from '../core/teleport';
import { MONSTERS, QUESTS, SLOT_NAMES, esc, type Quest } from './data';
import { loadMaps, type WikiMap } from './maps';
import { isSpoiler, monsterSprite } from './monsters';
import { npcName } from './npcs';
import { isBossQuest, monsterLabel, spoiler } from './ui';

const giverLink = (r: string) =>
  r === 'mestre' ? `<a href="#/seitas">Mestre da sua seita</a>` : `<a href="#/npc/${r}">${esc(npcName(r))}</a>`;

// ---------- Missões ----------
function objective(q: Quest, maps: WikiMap[]): string {
  const o = q.objective;
  if (o.type === 'kill' && o.monster) return `Derrotar ${o.count ?? 1}× ${monsterLabel(o.monster)}`;
  if (o.type === 'reach' && o.map) {
    const m = maps.find((x) => x.id === o.map);
    return `Chegar em <a href="#/mapa/${o.map}">${esc(m?.name ?? o.map)}</a>`;
  }
  if (o.type === 'talk' && o.npc) return `Falar com ${giverLink(o.npc)}`;
  return esc(q.goal);
}
function reward(q: Quest): string {
  const r = [`<b>${q.reward.xp}</b> XP`, `<b>${q.reward.gold}</b> ouro`];
  if (q.reward.item)
    r.push(
      `${esc(SLOT_NAMES[q.reward.item] ?? q.reward.item)} <span style="color:#4cd964">Incomum</span> nível ${q.reward.itemLevel ?? 5} da sua seita`,
    );
  return r.join(' · ');
}

export async function questIndexPage(): Promise<string> {
  const maps = await loadMaps();
  const tot = QUESTS.reduce((a, q) => [a[0] + q.reward.xp, a[1] + q.reward.gold], [0, 0]);
  const card = (q: Quest, i: number) => `<li class="panel quest-card" id="q-${q.id}">
      <div class="q-top"><span class="q-n">${i + 1}</span><div><b>${esc(q.name)}</b>
        <div class="muted">a partir do nível ${q.minLevel} · ${q.giver === q.turnIn ? giverLink(q.giver) : `${giverLink(q.giver)} → ${giverLink(q.turnIn)}`}</div></div></div>
      <p class="lore">“${esc(q.offer)}”</p>
      <table class="tbl kv"><tr><th>Objetivo</th><td>${objective(q, maps)}</td></tr><tr><th>Recompensa</th><td>${reward(q)}</td></tr></table>
    </li>`;
  const items = QUESTS.map((q, i) =>
    isBossQuest(q)
      ? `<li>${spoiler(`<ol class="plain">${card(q, i)}</ol>`, `Missão ${i + 1}: chefe`)}</li>`
      : card(q, i),
  );
  return `<h1>Missões</h1><p class="intro">Uma única cadeia de missões, do nível 1 ao ${QUESTS[QUESTS.length - 1]?.minLevel ?? ''}.
    Uma de cada vez: a próxima aparece quando você entrega a atual e tem o nível pedido. Quem tem missão para você mostra um <b>!</b> na cabeça;
    quando ela está pronta para entregar, mostra um <b>?</b>.</p>
    <p class="muted">Total da cadeia: ${tot[0]} XP e ${tot[1]} ouro (sem contar os itens).</p>
    <ol class="plain quest-chain">${items.join('')}</ol>`;
}

// ---------- Mapas ----------
const TILE_COLORS: Record<string, string> = {
  grass: '#3d6b35',
  path: '#8a7a58',
  water: '#2f5d8a',
  tree: '#24442a',
  house: '#6b4a3a',
  plaza: '#a89a7a',
  ruin: '#7d6a55',
  pillar: '#4a4038',
  snow: '#dfe6ee',
  pine: '#2c4a3c',
  bamboo: '#2f5a34',
  ash: '#4a403e',
  basalt: '#2c2828',
  lava: '#c4461e',
  marble: '#d8d4c8',
  cloud: '#eef2f8',
};

/** Faixa de nível dos monstros comuns do mapa. */
function mapLevels(m: WikiMap): [number, number] | null {
  const lv: number[] = [];
  for (const s of m.spawns) {
    const d = MONSTERS[s.monster];
    if (!d || d.boss) continue;
    lv.push(s.minLevel ?? d.minLevel, s.maxLevel ?? s.minLevel ?? d.maxLevel);
  }
  return lv.length ? [Math.min(...lv), Math.max(...lv)] : null;
}
/** Nível mínimo para entrar: o maior minLevel dos portais que levam a este mapa (0 = livre); masmorra: o do menu. */
const entryLevel = (id: string, maps: WikiMap[]) =>
  (MAPS_CONFIG[id]?.trial ? TRIAL_MIN_LEVEL : undefined) ??
  DUNGEONS.find((d) => d.map === id)?.minLevel ??
  Math.min(...maps.flatMap((m) => m.portals.filter((p) => p.target === id).map((p) => p.minLevel)).concat(Infinity));
const dungeonOf = (id: string) => DUNGEONS.find((d) => d.map === id);

const minimap = (id: string, big = false) => `<canvas class="minimap${big ? ' big' : ''}" data-map="${id}"></canvas>`;

export async function mapIndexPage(): Promise<string> {
  const maps = await loadMaps();
  return `<h1>Mapas</h1><p class="intro">As regiões do jogo, ligadas por portais. As cidades (a vila, a Cidadela de Jade e o Porto Noturno) são seguras: lá a vida e a mana voltam sozinhas fora de combate.
    No jogo, a aba <b>Mundo</b> do mapa (tecla M ou toque no minimapa) mostra todos os mapas; toque num deles para ver, passo a passo, por quais portais ir saindo de onde você está (o próximo portal pisca no minimapa).
    Na praça da vila, o <a href="#/npc/caminhos">${esc(npcName('caminhos'))}</a> leva você direto aos mapas marcados com ✦, por ${TELEPORT_COST} ouro; a <a href="#/mapa/cidadela">Cidadela de Jade</a> (nível 30) só se alcança assim.</p>
    <div class="grid map-grid">${maps
      .map((m) => {
        const lv = mapLevels(m),
          entry = entryLevel(m.id, maps);
        const sub = MAPS_CONFIG[m.id]?.town
          ? 'Cidade'
          : MAPS_CONFIG[m.id]?.trial
            ? `Trial · chefes nível ${trialBossLevel(1)}–${trialBossLevel(TRIAL_TIERS)}`
            : `${dungeonOf(m.id) ? 'Masmorra · ' : ''}${lv ? `monstros nível ${lv[0]}–${lv[1]}` : ''}`;
        return `<a class="card-link" href="#/mapa/${m.id}">${minimap(m.id)}<b>${esc(m.name)}</b><small>${sub}${entry > 0 && entry < Infinity ? ` · entrada nível ${entry}+` : ''}${teleportById(m.id) ? ' · ✦ teleporte' : ''}</small></a>`;
      })
      .join('')}</div>`;
}

export async function mapPage(id: string): Promise<string | null> {
  const maps = await loadMaps();
  const m = maps.find((x) => x.id === id);
  if (!m) return null;
  const town = !!MAPS_CONFIG[id]?.town;
  const lv = mapLevels(m),
    entry = entryLevel(id, maps);
  const count = new Map<string, number>();
  for (const s of m.spawns) count.set(s.monster, (count.get(s.monster) ?? 0) + 1);
  const mons = [...count.keys()].filter((k) => MONSTERS[k]);
  const open = mons.filter((k) => !isSpoiler(MONSTERS[k], maps)),
    secret = mons.filter((k) => isSpoiler(MONSTERS[k], maps));
  const monRow = (k: string) =>
    `<li><a href="#/monstro/${k}">${monsterSprite(MONSTERS[k], 'mini')}</a> ${monsterLabel(k)} — ${count.get(k)} ponto(s)</li>`;
  const dungeon = dungeonOf(id),
    trial = !!MAPS_CONFIG[id]?.trial;
  const seenExit = new Set<string>();
  const exits = m.portals
    .filter((p) => {
      const k = p.menu ?? p.target; // a masmorra tem duas saídas para a vila: lista uma vez
      if (seenExit.has(k)) return false;
      seenExit.add(k);
      return true;
    })
    .map((p) => {
      if (p.menu === 'trial')
        return `<li><a href="#/mapa/trial">Trial</a> (escolha o chefe e o nível no menu) <small class="tag">nível ${TRIAL_MIN_LEVEL}+ · ${trialCost(1)}–${trialCost(TRIAL_TIERS)} ouro</small></li>`;
      if (p.menu)
        return `<li>Portal das Masmorras (escolha no menu): ${DUNGEONS.map((d) => {
          const t = maps.find((x) => x.id === d.map);
          return `<a href="#/mapa/${d.map}">${esc(t?.name ?? d.map)}</a> <small class="tag">nível ${d.minLevel}+ · ${d.cost} ouro</small>`;
        }).join(', ')}</li>`;
      const t = maps.find((x) => x.id === p.target);
      return `<li><a href="#/mapa/${p.target}">${esc(t?.name ?? p.target)}</a>${p.minLevel ? ` <small class="tag">nível ${p.minLevel}+</small>` : ''}</li>`;
    })
    .join('');
  // teleporte do Mestre dos Caminhos: na vila, a lista de destinos; no destino, como chegar por ele
  const tpFrom = m.npcs.includes('caminhos')
    ? `<li><a href="#/npc/caminhos">${esc(npcName('caminhos'))}</a> (teleporte): ${teleportDestsFrom(id)
        .map((d) => {
          const t = maps.find((x) => x.id === d.map);
          const tags = [
            d.minLevel ? `nível ${d.minLevel}+` : '',
            teleportCost(d) ? `${teleportCost(d)} ouro` : 'grátis',
          ]
            .filter(Boolean)
            .join(' · ');
          return `<a href="#/mapa/${d.map}">${esc(t?.name ?? d.map)}</a> <small class="tag">${tags}</small>`;
        })
        .join(', ')}</li>`
    : '';
  const tpTo = teleportById(id);
  const tpHere = tpTo
    ? `<p>${id === 'cidadela' ? 'Só se chega aqui' : 'Também se chega aqui'} pelo <a href="#/npc/caminhos">${esc(npcName('caminhos'))}</a>, numa cidade${tpTo.minLevel ? `, a partir do nível <b>${tpTo.minLevel}</b>` : ''}, ${teleportCost(tpTo) ? `por <b>${teleportCost(tpTo)} ouro</b>` : '<b>de graça</b>'}.</p>`
    : '';
  const qs = QUESTS.filter((q) => q.objective.map === id || (q.objective.monster && count.has(q.objective.monster)));
  const qRow = (q: Quest) =>
    `<li><a href="#/missoes">${esc(q.name)}</a> <small class="muted">(nível ${q.minLevel})</small></li>`;
  const qOpen = qs.filter((q) => !isBossQuest(q)),
    qBoss = qs.filter(isBossQuest);
  return `<a class="back" href="#/mapas">‹ Mapas</a><h1>${esc(m.name)}</h1>
    <div class="sub">${town ? 'Cidade (segura)' : trial ? 'Trial (instância)' : dungeon ? 'Masmorra (instância)' : 'Área de caça'}${lv ? ` · monstros nível ${lv[0]}–${lv[1]}` : ''}${entry > 0 && entry < Infinity ? ` · entrada a partir do nível ${entry}` : ''}</div>
    ${id === 'porto' ? HARBOR : ''}
    <section class="panel">${minimap(id, true)}
      <div class="legend"><span><i style="background:#f0d27a"></i>Saída</span><span><i style="background:#7fd4ff"></i>NPC</span><span><i style="background:#e04848"></i>Monstro</span></div></section>
    ${m.npcs.length ? `<section class="panel"><h2>NPCs</h2><ul>${m.npcs.map((n) => `<li><a href="#/npc/${n}">${esc(npcName(n))}</a></li>`).join('')}</ul></section>` : ''}
    ${mons.length ? `<section class="panel"><h2>Monstros</h2><ul class="mon-rows">${open.map(monRow).join('')}</ul>${secret.length ? spoiler(`<ul class="mon-rows">${secret.map(monRow).join('')}</ul>`, 'Chefe desta região') : ''}</section>` : ''}
    ${dungeon ? dungeonPanel(dungeon) : ''}
    ${trial ? trialPanel() : ''}
    <section class="panel"><h2>Saídas</h2><ul>${exits}${tpFrom}</ul>${tpHere}</section>
    ${qs.length ? `<section class="panel"><h2>Missões aqui</h2><ul>${qOpen.map(qRow).join('')}</ul>${qBoss.length ? spoiler(`<ul>${qBoss.map(qRow).join('')}</ul>`, 'Missão de chefe') : ''}</section>` : ''}`;
}

// ---------- Minimapa (canvas) ----------
type Tiled = {
  width: number;
  height: number;
  tileheight: number;
  tilesets: { firstgid: number; tiles?: { id: number; properties?: { name: string; value: unknown }[] }[] }[];
  layers: {
    type: string;
    data?: number[];
    objects?: {
      type: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      properties?: { name: string; value: unknown }[];
    }[];
  }[];
};
const raw: Record<string, Promise<Tiled>> = {};
const loadRaw = (id: string) => (raw[id] ??= fetch(`../maps/${id}.json`).then((r) => r.json() as Promise<Tiled>));

/** Desenha os minimapas (<canvas data-map>) em vista isométrica, como no jogo. Chefes não aparecem (spoiler). */
export async function fillMinimaps(root: ParentNode) {
  for (const c of root.querySelectorAll<HTMLCanvasElement>('canvas[data-map]')) {
    const j = await loadRaw(c.dataset.map!).catch(() => null);
    if (!j) continue;
    const ts = j.tilesets[0];
    const names: Record<number, string> = {};
    for (const t of ts.tiles ?? [])
      names[t.id + ts.firstgid] = String(t.properties?.find((p) => p.name === 'name')?.value ?? '');
    const hw = c.classList.contains('big') ? 9 : 4,
      hh = hw / 2;
    const W = (j.width + j.height) * hw,
      H = (j.width + j.height) * hh;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.aspectRatio = `${W} / ${H}`;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const at = (tx: number, ty: number) => [(tx - ty) * hw + j.height * hw, (tx + ty) * hh] as const;
    const ground = j.layers.find((l) => l.type === 'tilelayer')?.data ?? [];
    for (let ty = 0; ty < j.height; ty++)
      for (let tx = 0; tx < j.width; tx++) {
        const [x, y] = at(tx, ty);
        g.fillStyle = TILE_COLORS[names[ground[ty * j.width + tx]]] ?? '#333';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + hw, y + hh);
        g.lineTo(x, y + 2 * hh);
        g.lineTo(x - hw, y + hh);
        g.closePath();
        g.fill();
      }
    const dot = (tx: number, ty: number, color: string, r: number) => {
      const [x, y] = at(tx, ty);
      g.fillStyle = color;
      g.strokeStyle = '#000a';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    };
    const R = hw * 0.6;
    for (const l of j.layers)
      for (const o of l.objects ?? []) {
        const p = Object.fromEntries((o.properties ?? []).map((x) => [x.name, x.value]));
        const tx = (o.x + (o.width ?? 0) / 2) / j.tileheight,
          ty = (o.y + (o.height ?? 0) / 2) / j.tileheight;
        if (o.type === 'portal') dot(tx, ty, '#f0d27a', R * 1.6);
        else if (o.type === 'npc') dot(tx, ty, '#7fd4ff', R);
        else if (o.type === 'monsterSpawn' && !MONSTERS[String(p.monster)]?.boss) dot(tx, ty, '#e04848', R);
      }
  }
}

/** Resumo do Trial na página do mapa; as regras completas ficam em Mecânicas › Trial. */
/** Porto Noturno: bairros da planta (docs/decisoes/porto-noturno.md). */
const HARBOR = `<section class="panel"><p>Cidade do nível 50, quatro vezes maior que as outras e <b>sempre de noite</b>: as lanternas
  iluminam as ruas, e os juncos balançam no mar ao sul. Chega-se pelo portão sul da <a href="#/mapa/cidadela">Cidadela de Jade</a>
  ou pelo Mestre dos Caminhos.</p><ul>
  <li><b>Norte:</b> portão (volta à Cidadela) e a avenida até a praça central, com o círculo do Mestre dos Caminhos.</li>
  <li><b>Noroeste:</b> estábulo do <a href="#/npc/estabulo">Cavalariço Ma</a>, com o cercado dos cavalos.</li>
  <li><b>Nordeste:</b> forja-mestre do <a href="#/npc/ferreiro_mestre">Ferreiro-mestre Gang</a> e joalheria do <a href="#/npc/joalheiro">Joalheiro Yu</a>.</li>
  <li><b>Sul:</b> casa de chá, jardim com lago e ponte, antiquário do <a href="#/npc/antiquario">Antiquário Lao</a> e o banco com a arena (portal do Trial).</li>
  <li><b>Cais:</b> mercado noturno (poções), trapiches e o <a href="#/npc/mestre_cais">Mestre do Cais</a>. Três canais cortam a cidade até o mar; cruze pelas pontes.</li>
  </ul></section>`;
function trialPanel(): string {
  return `<section class="panel"><h2>Trial</h2><p class="lore">Uma arena de lajes e braseiros onde os chefes do jogo voltam mais fortes.</p><ul>
      <li>Entrada pelo portal da saída sul da <a href="#/mapa/cidade">vila</a> (ou da arena do <a href="#/mapa/porto">Porto Noturno</a>), a partir do nível <b>${TRIAL_MIN_LEVEL}</b>: escolha o chefe e o nível (1 a ${TRIAL_TIERS}, chefe nível ${trialBossLevel(1)} a ${trialBossLevel(TRIAL_TIERS)}).</li>
      <li>Chefes: ${TRIAL_BOSSES.map((b) => `<a href="#/monstro/${b}">${esc(MONSTERS[b]?.name ?? b)}</a>`).join(', ')}.</li>
      <li>Entrada de ${trialCost(1)} a ${trialCost(TRIAL_TIERS)} ouro; vencer um nível libera o seguinte daquele chefe.</li>
      <li>Regras, ponto fraco de cada chefe, tabela de níveis e drops: <a href="#/mecanicas/trial">Mecânicas › Trial</a>.</li>
    </ul></section>`;
}

/** Página das masmorras: lista (src/core/dungeons.ts) e regras gerais; detalhes de cada uma na página do mapa. */
export async function dungeonIndexPage(): Promise<string> {
  const maps = await loadMaps();
  const bonus = Math.round((DUNGEON_EQUIP_DROP_MUL - 1) * 100);
  const rows = DUNGEONS.map((d) => {
    const name = maps.find((m) => m.id === d.map)?.name ?? d.map;
    return `<li><a href="#/mapa/${d.map}"><b>${esc(name)}</b></a>
      <div class="muted">${d.minLevel > 1 ? `Nível ${d.minLevel}+` : 'Qualquer nível'} · monstros nível ${d.levels[0]}–${d.levels[1]} · ${d.cost.toLocaleString('pt-BR')} ouro</div>
      <p class="lore">${esc(d.desc.pt)}</p></li>`;
  }).join('');
  return `<h1>Masmorras</h1><p class="intro">Instâncias com monstros que não renascem e um chefe no fim. Entrada pelo <b>Portal das Masmorras</b>, na saída oeste da <a href="#/mapa/cidade">vila</a>: pisar nele abre o menu com todas.</p>
    <section class="panel"><h2>Lista</h2><ul class="dungeon-list">${rows}</ul>
      <p class="muted">As três últimas são difíceis: entra quem quiser, mas são pensadas para personagens fortes, com mais câmaras e chefes com várias mecânicas.</p></section>
    <section class="panel"><h2>Regras</h2><ul>
      <li>Cada entrada é uma corrida nova e se paga de novo; não há limite de entradas.</li>
      <li>Os monstros <b>não renascem</b>. O chefe fica no fim e dá item garantido.</li>
      <li><b>Selo do chefe:</b> a passagem para a arena do chefe fica fechada por um selo dourado até todos os monstros comuns da masmorra morrerem (o número em cima do selo mostra quantos faltam). Selado, o chefe não pode ser mirado nem ferido.</li>
      <li>Os monstros daqui têm <b>+${bonus}%</b> de chance de deixar equipamento.</li>
      <li>O <a href="#/mecanicas/auto">Auto</a> não funciona, e a masmorra não rende ganho offline.</li>
      <li>Morrer, sair por um portal ou fechar o jogo encerra a corrida (você volta para a vila).</li>
    </ul></section>
    <section class="panel"><h2>Sozinho ou em equipe</h2><p>Cada masmorra tem os botões <b>Sozinho</b> e <b>Equipe (bots)</b>, com o mesmo custo. Em equipe você leva 3 bots aliados e os monstros têm mais vida; a recompensa é a mesma. Regras: <a href="#/mecanicas/equipe">Mecânicas › Equipe (bots)</a>.</p></section>`;
}

/** Regras da masmorra (src/core/dungeons.ts, World.enterDungeon/killMonster, AutoCombat). */
function dungeonPanel(d: (typeof DUNGEONS)[number]): string {
  const bonus = Math.round((DUNGEON_EQUIP_DROP_MUL - 1) * 100);
  return `<section class="panel"><h2>Masmorra</h2><p class="lore">${esc(d.desc.pt)}</p><ul>
      <li>Entrada pelo <b>Portal das Masmorras</b>, na saída oeste da <a href="#/mapa/cidade">vila</a>: a partir do nível <b>${d.minLevel}</b>, custa <b>${d.cost}</b> ouro por entrada.</li>
      <li>Cada entrada é uma corrida nova: todos os monstros vivos, e eles <b>não renascem</b>. O chefe fica no fim e dá um item garantido.</li>
      <li>Os monstros daqui têm <b>+${bonus}%</b> de chance de deixar equipamento (sobre a chance normal deles).</li>
      <li><b>Masmorra em equipe (bots):</b> o botão <b>Equipe (bots)</b> leva 3 bots aliados, com a vida dos monstros aumentada e a opção de reviver os bots caídos; recompensa igual à do modo solo. Regras: <a href="#/mecanicas/equipe">Mecânicas › Equipe (bots)</a>.</li>
      <li>O <a href="#/mecanicas/auto">Auto</a> não funciona aqui, e a masmorra não rende ganho offline.</li>
      <li>Morrer, sair por um portal ou fechar o jogo encerra a corrida: você volta para a vila e precisa pagar de novo para entrar.</li>
    </ul></section>`;
}
