// Páginas de NPCs. O papel de cada NPC (o que ele faz) é escrito aqui; falas, nomes e missões vêm dos JSON.
import {
  CLASSES,
  CONSUMABLES,
  MATERIALS,
  MERCHANT,
  NPC_TEXT,
  POTIONS,
  RARITIES,
  SELL_RATIO,
  esc,
  questsOfNpc,
} from './data';
import { itemLink, questList } from './ui';

interface NpcInfo {
  id: string;
  name: string;
  role: string;
  sheet: string; // spritesheet em public/sprites/
  portrait?: string;
  sect?: string;
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
        `<p>Mestre da seita <b>${esc(CLASSES[sect]?.name ?? sect)}</b>. Recebe quem escolheu essa seita, explica o estilo de luta e dá dicas de combate.
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
         <li><b>Trocar um bônus</b> aleatório por outro.</li>
         <li><b>Desmontar</b> itens que você não quer, recebendo materiais de volta.</li></ul>`,
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
    { id: 'anciao', name: t.anciao?.name ?? 'Ancião', role: 'História e missões', sheet: 'npc_anciao', does: talkOnly },
    {
      id: 'guarda',
      name: t.guarda?.name ?? 'Guarda',
      role: 'Dicas de caça e missões',
      sheet: 'npc_guarda',
      does: talkOnly,
    },
    ...['morador1', 'morador2', 'morador3', 'morador4']
      .filter((id) => t[id])
      .map((id): NpcInfo => ({ id, name: t[id].name, role: 'Morador da vila', sheet: 'npc_' + id, does: talkOnly })),
  ];
}

let cache: NpcInfo[] | null = null;
export const NPCS = () => (cache ??= npcList());
export const npcName = (id: string) => NPCS().find((n) => n.id === id)?.name ?? id;

/** Sprite parado (1º quadro da animação idle) do NPC. Lê o atlas em public/sprites/<sheet>.json. */
export function spriteHtml(sheet: string, cls = ''): string {
  return `<span class="sprite ${cls}" data-sheet="${esc(sheet)}"></span>`;
}
export async function fillSprites(root: ParentNode) {
  const els = root.querySelectorAll<HTMLElement>('.sprite[data-sheet]');
  for (const el of els) {
    const sheet = el.dataset.sheet!;
    try {
      const j = await loadSheet(sheet);
      const f = j.frames['idle_0_0']?.frame ?? Object.values(j.frames)[0]?.frame;
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
    others = NPCS().filter((n) => !n.sect);
  return `<h1>NPCs</h1><p class="intro">Todos ficam na <b>Vila das Nuvens</b>. Toque em um NPC no jogo para o personagem andar até ele e abrir a conversa.</p>
    <h2>Mestres das seitas</h2><div class="grid npc-grid">${masters.map(card).join('')}</div>
    <h2>Moradores e lojas</h2><div class="grid npc-grid">${others.map(card).join('')}</div>`;
}

export function npcPage(id: string): string | null {
  const n = NPCS().find((x) => x.id === id);
  if (!n) return null;
  const lines = NPC_TEXT.npcs[id]?.lines ?? [];
  const qs = questsOfNpc(id);
  const pic = n.portrait ? `<img class="portrait" src="../sprites/${n.portrait}" alt="">` : spriteHtml(n.sheet, 'big');
  return `<a class="back" href="#/npcs">‹ NPCs</a>
    <div class="detail-head">${pic}<div><h1>${esc(n.name)}</h1><div class="sub">${esc(n.role)} · Vila das Nuvens</div></div></div>
    <section class="panel"><h2>O que faz</h2>${n.does()}</section>
    ${qs.length ? `<section class="panel"><h2>Missões</h2>${n.sect ? '<p class="muted">Missões do “mestre” são passadas pelo mestre da <i>sua</i> seita.</p>' : ''}${questList(qs, id)}</section>` : ''}
    ${lines.length ? `<section class="panel"><h2>Falas</h2><ol class="lines">${lines.map((l) => `<li class="lore">“${esc(l)}”</li>`).join('')}</ol></section>` : ''}`;
}
