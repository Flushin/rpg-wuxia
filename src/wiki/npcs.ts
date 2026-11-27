// Páginas de NPCs. O papel de cada NPC (o que ele faz) é escrito aqui; falas, nomes e missões vêm dos JSON.
import {
  CLASSES,
  CONSUMABLES,
  MATERIALS,
  MERCHANT,
  NPC_TEXT,
  POTIONS,
  PROGRESSION,
  RARITIES,
  SELL_RATIO,
  esc,
  questsOfNpc,
  GEM_CFG,
} from './data';
import { RELIC_DROP } from '../core/data';
import { itemLink, questList } from './ui';
import { mapName } from './maps';
import { TELEPORT_COST, TELEPORT_DESTS, teleportCost } from '../core/teleport';

interface NpcInfo {
  id: string;
  name: string;
  role: string;
  sheet: string; // spritesheet em public/sprites/
  portrait?: string;
  sect?: string;
  /** Onde fica (id do mapa); sem = Vila das Nuvens. */
  place?: string;
  /** O que o NPC faz, em HTML. */
  does: () => string;
}

const MASTER_SHEETS: Record<string, string> = {
  lamina: 'npc_mestre_tormenta',
  pavilhao: 'npc_mestra_geada',
  tita: 'npc_mestre_tita',
  vibora: 'npc_mestra_vibora',
};

const talkOnly = () =>
  '<p>Conversa com você e conta histórias e dicas sobre a vila e os arredores. Toque em <b>Continuar</b> para ouvir todas as falas.</p>';

const PLACES: Record<string, string> = {
  cidade: 'Vila das Nuvens',
  cidadela: 'Cidadela de Jade',
  porto: 'Porto Noturno',
};
const placeName = (n: NpcInfo) => PLACES[n.place ?? 'cidade'];
const talkCitadel = () =>
  '<p>Conversa com você e conta histórias sobre a <a href="#/mapa/cidadela">Cidadela de Jade</a> e o que vem pela frente. Toque em <b>Continuar</b> para ouvir todas as falas.</p>';
const talkHarbor = () =>
  '<p>Conversa com você e conta histórias sobre o <a href="#/mapa/porto">Porto Noturno</a>, os canais e os barcos do cais. Toque em <b>Continuar</b> para ouvir todas as falas.</p>';
/** Monge do Pagode: realinhar meridianos (World.resetAttributes). */
const meridians = () =>
  `${talkCitadel()}<p><b>Realinhar meridianos:</b> por <span class="price">${PROGRESSION.attrResetCost.toLocaleString('pt-BR')} ouro</span>, devolve todos os
  pontos livres que você distribuiu, para redistribuir como quiser na janela Personagem (tecla <b>C</b>). Os atributos da sua
  <a href="#/seitas">seita</a> e os ganhos automáticos de cada nível não mudam. Pode ser feito quantas vezes quiser; o botão pede confirmação
  e fica bloqueado sem ouro suficiente ou sem nenhum ponto distribuído.</p>`;
/** Governador Bai: trajes (skins) por seita (World.buySkin, src/data/skins.json). */
const outfits = () =>
  `${talkCitadel()}<p><b>Trajes das seitas:</b> vende roupas novas para o seu personagem, só da sua seita e sem efeito no
  combate. Veja todos os trajes, preços e como funcionam na página <a href="#/trajes">Trajes</a>.</p>`;
const stable = () =>
  `${talkHarbor()}<p><b>Estábulo</b> (bairro noroeste do Porto Noturno, ao lado do cercado): vende montarias. Fora de combate você monta pelo botão do cavalo, ao lado do Auto, e anda mais rápido; ao entrar em combate desmonta na hora. Veja preços e velocidade em
  <a href="#/mecanicas/montarias">Montarias</a>.</p>`;
/** Loja da Cidadela: o mesmo serviço da loja da vila (prop role no mapa). */
const sameAs =
  (id: string, name: string, place = 'cidadela') =>
  () =>
    `<p>Faz exatamente o mesmo que o <a href="#/npc/${id}">${esc(name)}</a> da vila, aqui ${place === 'porto' ? 'no' : 'na'} <a href="#/mapa/${place}">${PLACES[place]}</a>.</p>`;

const shopRow = (id: string, price: number) => `<li>${itemLink(id)} <span class="price">${price} ouro</span></li>`;

function npcList(): NpcInfo[] {
  const t = NPC_TEXT.npcs;
  const masters = Object.entries(NPC_TEXT.masters).map(
    ([sect, m]): NpcInfo => ({
      id: 'mestre_' + sect,
      name: m.name,
      role: m.title,
      sheet: MASTER_SHEETS[sect] ?? 'npc_' + sect,
      portrait: MASTER_SHEETS[sect] ? `${MASTER_SHEETS[sect]}_retrato.png` : undefined,
      sect,
      does: () =>
        `<p>Mestre da seita <a href="#/seita/${sect}"><b>${esc(CLASSES[sect]?.name ?? sect)}</b></a>. Recebe quem escolheu essa seita, explica o estilo de luta e dá dicas de combate.
         Também é quem passa várias missões da história para os alunos da seita.</p>
         <p class="lore">“${esc(m.greeting)}”</p><p>${esc(m.intro)}</p>
         ${m.tips?.length ? `<h3>Dicas do mestre</h3><ul>${m.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`,
    }),
  );
  return [
    ...masters,
    {
      id: 'ferreiro',
      name: 'Ferreiro',
      role: 'Conserto e forja',
      sheet: 'npc_ferreiro',
      does: () =>
        `<p>Cuida do seu equipamento. Na aba <b>Consertar</b> devolve a durabilidade dos itens (equipados ou na mochila).
         Um item com durabilidade 0 para de dar bônus, mas não some.</p>
         <p>Na aba <b>Forjar</b>, usando ouro e materiais (${itemLink('minerio_ferro')}, ${itemLink('cristal_gelo')}, ${itemLink('essencia_qi')}):</p>
         <ul><li><b>Melhorar</b> o item de +1 até +10, somando força aos atributos base.</li>
         <li><b>Subir a raridade</b> (Comum → Incomum → Raro), ganhando bônus aleatórios.</li>
         <li><b>Trocar um bônus</b> aleatório por outro.</li></ul>
         <p>Na aba <b>Desmontar</b> transforma equipamentos da mochila que você não quer em materiais de volta.</p>`,
    },
    {
      id: 'vendedor',
      name: 'Vendedor de Poções',
      role: 'Loja',
      sheet: 'npc_vendedor',
      does: () =>
        `<p>Vende poções e compra qualquer item seu por ${Math.round(SELL_RATIO * 100)}% do valor de referência
         (equipamentos valem mais conforme a raridade).</p>
         <h3>À venda</h3><ul class="shop">${Object.entries(POTIONS)
           .map(([id, p]) => shopRow(id, p.price))
           .join('')}</ul>`,
    },
    {
      id: 'mercador',
      name: t.mercador?.name ?? 'Mercador Ambulante',
      role: 'Equipamentos raros',
      sheet: 'npc_mercador',
      does: () =>
        `<p>Vende <b>${MERCHANT.stockMin} a ${MERCHANT.stockMax} equipamentos</b> sorteados para a sua seita e para a sua faixa de nível.
         Cada um tem ${Math.round(MERCHANT.rareChance * 100)}% de chance de ser <span style="color:${RARITIES.raro.color}">Raro</span>
         (senão, <span style="color:${RARITIES.incomum.color}">Incomum</span>). O preço é ${MERCHANT.priceMul}× o valor do item.
         O estoque é renovado a cada <b>${MERCHANT.refreshMinutes} minutos</b>.</p>
         <h3>Sempre à venda</h3><ul class="shop">${[
           ...Object.entries(MERCHANT.materials).filter(([id]) => id in MATERIALS),
           ...Object.entries(CONSUMABLES).map(([id, c]) => [id, c.price] as [string, number]),
         ]
           .map(([id, p]) => shopRow(id, p))
           .join('')}</ul>`,
    },
    {
      id: 'caminhos',
      name: t.caminhos?.name ?? 'Mestre dos Caminhos',
      role: 'Teleporte',
      sheet: 'npc_caminhos',
      does: () => {
        const regions = new Map<string, string[]>();
        for (const d of TELEPORT_DESTS)
          regions.set(d.region.pt, [
            ...(regions.get(d.region.pt) ?? []),
            `<a href="#/mapa/${d.map}">${esc(mapName(d.map))}</a>${d.minLevel ? ` (nível ${d.minLevel}+)` : ''}${teleportCost(d) ? '' : ' (grátis)'}`,
          ]);
        return `<p>Fica na praça da <a href="#/mapa/cidade">Vila das Nuvens</a>, da <a href="#/mapa/cidadela">Cidadela de Jade</a> e do <a href="#/mapa/porto">Porto Noturno</a>, de pé sobre o círculo dourado. Por <b>${TELEPORT_COST} ouro</b> por viagem, leva você
         direto a um mapa de caça, sem passar pelos mapas do caminho. Cada destino abre no mesmo nível em que você chegaria a pé.</p>
         <p>Também leva às cidades: a Cidadela de Jade (nível 30), o Porto Noturno (nível 50; também a pé pelo portão sul da Cidadela) e, de volta à vila, de graça.</p>
         <p>Só leva de uma cidade para fora: para voltar de um mapa de caça, vá a pé ou use um ${itemLink('pergaminho_retorno')}.</p>
         <h3>Destinos</h3><ul>${[...regions].map(([r, ds]) => `<li><b>${esc(r)}:</b> ${ds.join(', ')}</li>`).join('')}</ul>`;
      },
    },
    { id: 'anciao', name: t.anciao?.name ?? 'Ancião', role: 'História e missões', sheet: 'npc_anciao', does: talkOnly },
    {
      id: 'guarda',
      name: t.guarda?.name ?? 'Guarda',
      role: 'Dicas de caça e missões',
      sheet: 'npc_guarda',
      does: talkOnly,
    },
    ...(
      [
        ['ferreira_lin', 'Conserto e forja', sameAs('ferreiro', 'Ferreiro')],
        ['boticario_wen', 'Loja', sameAs('vendedor', 'Vendedor de Poções')],
        ['mercadora_jin', 'Equipamentos raros', sameAs('mercador', t.mercador?.name ?? 'Mercador Ambulante')],
        ['governador', 'Autoridade da Cidadela, trajes das seitas e missões', outfits],
        ['monge_pagode', 'Guardião do pagode, realinhar atributos e missões', meridians],
        ['guarda_jade', 'Guarda dos portões e missões', talkCitadel],
      ] as [string, string, () => string][]
    )
      .filter(([id]) => t[id])
      .map(
        ([id, role, does]): NpcInfo => ({
          id,
          name: t[id].name,
          role,
          sheet: 'npc_' + id,
          place: 'cidadela',
          does,
        }),
      ),
    // Porto Noturno (nível 50): NPCs dos bairros (folhas em src/render/sprites.ts)
    ...(
      [
        ['guarda_porto', 'Guarda do portão e missões', 'npc_guarda_porto', talkHarbor],
        ['estabulo', 'Estábulo (montarias)', 'npc_mercador', stable],
        ['ferreiro_mestre', 'Encaixes: abrir, colocar e retirar gemas', 'npc_ferreiro_mestre', masterSmith],
        ['joalheiro', 'Gemas: vender e fundir', 'npc_joalheiro', jeweler],
        ['antiquario', 'Relíquias (nível 50)', 'npc_antiquario', antiquary],
        ['mestre_arena', 'Arena: lutas contra bots e títulos', 'npc_mestre_cais', arenaMaster],
        ['mestre_cais', 'Histórias do cais e missões', 'npc_mestre_cais', talkHarbor],
        [
          'vendedor_porto1',
          'Barraca do mercado noturno',
          'npc_vendedora_porto',
          sameAs('vendedor', 'Vendedor de Poções', 'porto'),
        ],
        [
          'vendedor_porto2',
          'Barraca do mercado noturno',
          'npc_vendedora_porto',
          sameAs('vendedor', 'Vendedor de Poções', 'porto'),
        ],
        [
          'vendedor_porto3',
          'Barraca do mercado noturno',
          'npc_vendedora_porto',
          sameAs('vendedor', 'Vendedor de Poções', 'porto'),
        ],
      ] as [string, string, string, () => string][]
    )
      .filter(([id]) => t[id])
      .map(([id, role, sheet, does]): NpcInfo => ({ id, name: t[id].name, role, sheet, place: 'porto', does })),
    ...['morador1', 'morador2', 'morador3', 'morador4']
      .filter((id) => t[id])
      .map((id): NpcInfo => ({ id, name: t[id].name, role: 'Morador da vila', sheet: 'npc_' + id, does: talkOnly })),
  ];
}

let cache: NpcInfo[] | null = null;
export const NPCS = () => (cache ??= npcList());
export const npcName = (id: string) => NPCS().find((n) => n.id === id)?.name ?? id;

/** Sprite parado (1º quadro da animação idle; idle_<direção>_0) de NPC ou monstro. Lê o atlas em public/sprites/<sheet>.json. */
export function spriteHtml(sheet: string, cls = '', frame = 'idle_0_0'): string {
  return `<span class="sprite ${cls}" data-sheet="${esc(sheet)}" data-frame="${frame}"></span>`;
}
export async function fillSprites(root: ParentNode) {
  const els = root.querySelectorAll<HTMLElement>('.sprite[data-sheet]');
  for (const el of els) {
    const sheet = el.dataset.sheet!;
    try {
      const j = await loadSheet(sheet);
      const f = j.frames[el.dataset.frame ?? 'idle_0_0']?.frame ?? Object.values(j.frames)[0]?.frame;
      if (!f) continue;
      el.style.width = f.w + 'px';
      el.style.height = f.h + 'px';
      el.style.backgroundImage = `url(../sprites/${j.meta.image})`;
      el.style.backgroundPosition = `-${f.x}px -${f.y}px`;
    } catch {
      el.classList.add('none');
    }
  }
}
type Sheet = {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { image: string };
};
const sheets: Record<string, Promise<Sheet>> = {};
const loadSheet = (s: string) =>
  (sheets[s] ??= fetch(`../sprites/${s}.json`).then((r) => {
    if (!r.ok) throw new Error(s);
    return r.json() as Promise<Sheet>;
  }));

export function npcIndexPage(): string {
  const card = (n: NpcInfo) =>
    `<a class="card-link npc-card" href="#/npc/${n.id}">${spriteHtml(n.sheet)}<b>${esc(n.name)}</b><small>${esc(n.role)}</small></a>`;
  const masters = NPCS().filter((n) => n.sect),
    others = NPCS().filter((n) => !n.sect && !n.place),
    citadel = NPCS().filter((n) => n.place === 'cidadela'),
    harbor = NPCS().filter((n) => n.place === 'porto');
  return `<h1>NPCs</h1><p class="intro">Quase todos ficam na <b>Vila das Nuvens</b>; os da <a href="#/mapa/cidadela">Cidadela de Jade</a> (nível 30) e do <a href="#/mapa/porto">Porto Noturno</a> (nível 50) estão no fim da página, e o Mestre dos Caminhos fica nas três cidades. Toque em um NPC no jogo para o personagem andar até ele e abrir a conversa.</p>
    <h2>Mestres das seitas</h2><div class="grid npc-grid">${masters.map(card).join('')}</div>
    <h2>Moradores e lojas</h2><div class="grid npc-grid">${others.map(card).join('')}</div>
    <h2>Cidadela de Jade</h2><div class="grid npc-grid">${citadel.map(card).join('')}</div>
    <h2>Porto Noturno</h2><div class="grid npc-grid">${harbor.map(card).join('')}</div>`;
}

export function npcPage(id: string): string | null {
  const n = NPCS().find((x) => x.id === id);
  if (!n) return null;
  const lines = NPC_TEXT.npcs[id]?.lines ?? [];
  const qs = questsOfNpc(id);
  const pic = n.portrait ? `<img class="portrait" src="../sprites/${n.portrait}" alt="">` : spriteHtml(n.sheet, 'big');
  return `<a class="back" href="#/npcs">‹ NPCs</a>
    <div class="detail-head">${pic}<div><h1>${esc(n.name)}</h1><div class="sub">${esc(n.role)} · ${n.id === 'caminhos' ? 'Vila das Nuvens, Cidadela de Jade e Porto Noturno' : placeName(n)}</div></div></div>
    <section class="panel"><h2>O que faz</h2>${n.does()}</section>
    ${qs.length ? `<section class="panel"><h2>Missões</h2>${n.sect ? '<p class="muted">Missões do “mestre” são passadas pelo mestre da <i>sua</i> seita.</p>' : ''}${questList(qs, id)}</section>` : ''}
    ${lines.length ? `<section class="panel"><h2>Falas</h2><ol class="lines">${lines.map((l) => `<li class="lore">“${esc(l)}”</li>`).join('')}</ol></section>` : ''}`;
}

const gemsLink = '<a href="#/mecanicas/gemas">Gemas e encaixes</a>';
function jeweler(): string {
  const names = Object.values(GEM_CFG.types)
    .map((t) => esc(t.name))
    .join(', ');
  return `<p>Vende gemas de nível ${GEM_CFG.levelNames[0]} (${names}) por <b>${GEM_CFG.price} ouro</b> cada e funde ${GEM_CFG.fuse} gemas iguais em
    1 do nível seguinte. Fica na joalheria do bairro nordeste do <a href="#/mapa/porto">Porto Noturno</a>. Ver ${gemsLink}.</p>
    <h3>Sempre à venda</h3><ul class="shop">${shopRow('po_estrela', GEM_CFG.starDustPrice)}</ul>`;
}
function antiquary(): string {
  return `<p>Vende relíquias comuns e raras para o novo espaço de relíquia do personagem (nível 50). Também monta as
    lendárias com ${RELIC_DROP.fragments} fragmentos (deixados pelo chefe de cada uma) e compra os fragmentos que sobram.
    Fica no bairro sul do <a href="#/mapa/porto">Porto Noturno</a>, entre o jardim e a arena. Veja todas em
    <a href="#/mecanicas/reliquias">Relíquias</a>.</p>`;
}
function arenaMaster(): string {
  return `<p>Manda você para o círculo da arena contra um lutador de outra seita e vende títulos com a moeda da arena.
    Fica no bairro sul do <a href="#/mapa/porto">Porto Noturno</a>, ao lado do portal do Trial. Veja as regras em
    <a href="#/mecanicas/arena">Arena</a>.</p>`;
}
function masterSmith(): string {
  const s = GEM_CFG.socketsByRarity;
  return `<p>Abre encaixes nos equipamentos (comum ${s.comum}, incomum ${s.incomum}, raro ${s.raro}, épico ${s.epico}), coloca e retira gemas.
    Retirar devolve a gema e custa ${Math.round(GEM_CFG.removeCostPct * 100)}% do valor dela. Fica na forja-mestre do
    bairro nordeste do <a href="#/mapa/porto">Porto Noturno</a>. Ver ${gemsLink}.</p>`;
}
