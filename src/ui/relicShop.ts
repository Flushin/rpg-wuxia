// Relíquias (Porto Noturno, etapa 4; regras em docs/decisoes/reliquias.md): loja do Antiquário Lao e o
// detalhe/escolha da relíquia no painel do personagem. Dados em src/data/relics.json.
import { MONSTERS, RELIC_DROP, RELIC_RARITIES, RELIC_REQ_LEVEL, RELICS, relicEffectText } from '../core/data';

export { relicEffectText };
import { L } from '../core/i18n';
import { fmtStat } from '../core/items';
import type { World } from '../core/world';
import { escapeHtml } from './dom';

/** Ícone + nome na cor da raridade, atributos, efeito e descrição. */
export function relicCardHtml(id: string): string {
  const r = RELICS[id],
    rar = RELIC_RARITIES[r.rarity];
  const stats = Object.entries(r.stats)
    .map(([k, v]) => `<div>${fmtStat(k, v)}</div>`)
    .join('');
  return `<div class="rl-card"><span class="rl-ic" style="--c:${rar.color}">${r.icon}</span><div>
    <b style="color:${rar.color}">${escapeHtml(r.name)}</b> <small class="muted">${escapeHtml(rar.name)}</small>
    <div class="rl-stats">${stats}<div class="rl-eff">★ ${relicEffectText(r)}</div></div>
    <div class="dg-info">${escapeHtml(r.desc)}</div></div></div>`;
}

/** Lendária no Antiquário: chefe, fragmentos, montar e vender as sobras. */
function legendaryHtml(w: World, id: string): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR');
  const r = RELICS[id],
    have = w.relicShards[id] ?? 0,
    need = RELIC_DROP.fragments,
    owned = w.relicsOwned.includes(id),
    boss = r.boss ? (MONSTERS[r.boss]?.name ?? r.boss) : '?';
  const info = `<small class="muted">${L(
    `Fragmentos do chefe ${escapeHtml(boss)} (você no nível ${RELIC_DROP.minPlayerLevel}+): ${have}/${need}`,
    `Fragments from the boss ${escapeHtml(boss)} (you at level ${RELIC_DROP.minPlayerLevel}+): ${have}/${need}`,
  )}</small>`;
  if (owned)
    return `${info}${have > 0 ? `<button data-a="relicsell" data-v="${id}">${L(`Vender fragmentos (${fmt(have * RELIC_DROP.fragmentPrice)} ouro)`, `Sell fragments (${fmt(have * RELIC_DROP.fragmentPrice)} gold)`)}</button>` : `<button disabled>${L('Já é sua', 'Owned')}</button>`}`;
  return `${info}<button class="primary" data-a="relicmake" data-v="${id}" ${have < need ? 'disabled' : ''}>${L('Montar relíquia', 'Assemble relic')}</button>`;
}

/** Antiquário Lao: comuns e raras à venda (com confirmação); lendárias listadas como drop de chefe. */
export function antiquaryHtml(w: World, ask: string): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR');
  const lowLevel = w.player.level < RELIC_REQ_LEVEL;
  const row = (id: string) => {
    const r = RELICS[id],
      owned = w.relicsOwned.includes(id);
    let btn = '';
    if (r.rarity === 'lendaria') btn = legendaryHtml(w, id);
    else if (owned) btn = `<button disabled>${L('Já é sua', 'Owned')}</button>`;
    else if (ask === id)
      btn = `<div class="mr-ask"><button class="danger" data-a="relicbuy" data-v="${id}">${L(`Confirmar (${fmt(r.price)} ouro)`, `Confirm (${fmt(r.price)} gold)`)}</button><button data-a="reliccancel">${L('Cancelar', 'Cancel')}</button></div>`;
    else
      btn = `<button class="primary" data-a="relicbuy" data-v="${id}" ${w.gold < r.price || lowLevel ? 'disabled' : ''}>${L(`Comprar (${fmt(r.price)} ouro)`, `Buy (${fmt(r.price)} gold)`)}</button>`;
    return `<div class="dg-row sk-row"><div class="sk-body">${relicCardHtml(id)}${btn}</div></div>`;
  };
  return `<h4>${L('Relíquias', 'Relics')}</h4>
    <small class="muted">${L(`Um espaço próprio no personagem (nível ${RELIC_REQ_LEVEL}). Sem desgaste; troque quando quiser na janela do personagem.`, `A slot of its own on your character (level ${RELIC_REQ_LEVEL}). No wear; swap any time in the character window.`)}</small>
    ${lowLevel ? `<small class="muted">${L(`Requer nível ${RELIC_REQ_LEVEL}.`, `Requires level ${RELIC_REQ_LEVEL}.`)}</small>` : ''}
    ${Object.keys(RELICS).map(row).join('')}`;
}

/** Detalhe da relíquia no painel do personagem: a equipada e a coleção para trocar. */
export function relicPickHtml(w: World): string {
  const cur = w.relic;
  const head = cur
    ? `${relicCardHtml(cur)}<button class="primary" data-relic-eq="">${L('Desequipar', 'Unequip')}</button>`
    : `<div class="muted">${L('Nenhuma relíquia equipada.', 'No relic equipped.')}</div>`;
  const others = w.relicsOwned.filter((id) => id !== cur);
  const list = others.length
    ? others
        .map(
          (id) =>
            `<div class="rl-pick">${relicCardHtml(id)}<button data-relic-eq="${id}">${L('Equipar', 'Equip')}</button></div>`,
        )
        .join('')
    : !w.relicsOwned.length
      ? `<div class="muted">${L('Compre relíquias com o Antiquário Lao (Porto Noturno) ou junte fragmentos de chefes no nível 50.', 'Buy relics from Antiquarian Lao (Night Harbor) or gather boss fragments at level 50.')}</div>`
      : '';
  return head + list;
}
