// Pedaços de HTML usados por várias páginas da wiki.
import { MONSTERS, SLOT_NAMES, type Quest, esc, iconHtml, itemName, itemKind, pct } from './data';
import { npcName } from './npcs';

export const itemLink = (id: string) =>
  itemKind(id) ? `<a class="ilink" href="#/item/${id}">${iconHtml(id, 'sm')}${esc(itemName(id))}</a>` : esc(id);

/** Link para a página do monstro, com a faixa de nível dele. */
export function monsterLabel(id: string): string {
  const m = MONSTERS[id];
  if (!m) return esc(id);
  const lv = m.minLevel === m.maxLevel ? `nv ${m.minLevel}` : `nv ${m.minLevel}–${m.maxLevel}`;
  return `<a href="#/monstro/${id}"><b>${esc(m.name)}</b></a> <small class="muted">(${lv}${m.boss ? ', chefe' : ''})</small>`;
}

/** Conteúdo escondido atrás de um botão (chefes, segredos). */
export const spoiler = (html: string, label = 'Mostrar spoiler') =>
  `<details class="spoiler"><summary>⚠ ${label}</summary><div>${html}</div></details>`;

const SLOT_LABEL: Record<string, string> = SLOT_NAMES;

export const isBossQuest = (q: Quest) => !!(q.objective.monster && MONSTERS[q.objective.monster]?.boss);

/** Lista de missões; as que envolvem chefe ficam num spoiler. */
export function questList(qs: Quest[], npc?: string): string {
  const row = (q: Quest) => {
    const role = npc?.startsWith('mestre_') ? 'mestre' : npc;
    const tag = !npc ? '' : q.giver === role && q.turnIn === role ? 'dá e recebe' : q.giver === role ? 'dá' : 'recebe';
    const rew = [`${q.reward.xp} XP`, `${q.reward.gold} ouro`];
    if (q.reward.item) rew.push(`${SLOT_LABEL[q.reward.item] ?? q.reward.item} incomum nv ${q.reward.itemLevel ?? 5}`);
    const other =
      npc && q.giver !== q.turnIn
        ? ` <small class="muted">· entregar a: ${esc(q.turnIn === 'mestre' ? 'mestre da seita' : npcName(q.turnIn))}</small>`
        : '';
    return `<li><span class="lv">nv ${q.minLevel}</span> <b>${esc(q.name)}</b>${tag ? ` <small class="tag">${tag}</small>` : ''}${other}
      <div class="muted">${esc(q.goal)} — ${rew.join(', ')}</div></li>`;
  };
  const open = qs.filter((q) => !isBossQuest(q)),
    boss = qs.filter(isBossQuest);
  return `<ul class="quests">${open.map(row).join('')}</ul>${boss.length ? spoiler(`<ul class="quests">${boss.map(row).join('')}</ul>`, `${boss.length} missão(ões) com chefe`) : ''}`;
}

export const chance = (c: number) => (c >= 1 ? 'garantido' : pct(c));
