// Páginas de itens: lista por categoria e página de cada item (atributos, preços e onde conseguir).
import {
  BASES,
  BONUS_POOL,
  CLASSES,
  CONSUMABLES,
  EQUIP_TIERS,
  MATERIALS,
  MERCHANT,
  POTIONS,
  RARITIES,
  SLOT_NAMES,
  STAT_LABELS,
  dropsOf,
  esc,
  fmtStatValue,
  iconHtml,
  itemKind,
  KIND_NAMES,
  merchantPrice,
  questRewardsFor,
  sellPrice,
  type ItemKind,
} from './data';
import { chance, monsterLabel, spoiler } from './ui';

const TABS: { id: ItemKind; label: string }[] = [
  { id: 'equip', label: 'Equipamentos' },
  { id: 'potion', label: 'Poções' },
  { id: 'material', label: 'Materiais' },
  { id: 'consumable', label: 'Consumíveis' },
];

const sectName = (s?: string) => (s ? (CLASSES[s]?.name ?? s) : '');

function card(id: string, sub: string): string {
  const name = BASES[id]?.name ?? POTIONS[id]?.name ?? MATERIALS[id]?.name ?? CONSUMABLES[id]?.name ?? id;
  return `<a class="card-link item-card" href="#/item/${id}" data-name="${esc(name.toLowerCase())}">${iconHtml(id)}<b>${esc(name)}</b><small>${sub}</small></a>`;
}

/** #/itens/<aba>?seita=<id> */
export function itemIndexPage(tab: string, params: URLSearchParams): string {
  const kind = (TABS.find((t) => t.id === tab)?.id ?? 'equip') as ItemKind;
  const tabs = `<nav class="tabs">${TABS.map((t) => `<a class="${t.id === kind ? 'on' : ''}" href="#/itens/${t.id}">${t.label}</a>`).join('')}</nav>`;
  let body = '';
  if (kind === 'equip') {
    const sect = params.get('seita') ?? '';
    const sects = Object.keys(CLASSES).filter((k) => CLASSES[k]?.name);
    const filter = `<nav class="chips"><span class="muted">Armas da seita:</span>
      <a class="${!sect ? 'on' : ''}" href="#/itens/equip">Todas</a>${sects
        .map(
          (s) =>
            `<a class="${sect === s ? 'on' : ''}" href="#/itens/equip?seita=${s}" style="--c:${CLASSES[s].color}">${esc(CLASSES[s].name)}</a>`,
        )
        .join('')}</nav>`;
    const ids = Object.keys(BASES).filter((id) => !sect || !BASES[id].sect || BASES[id].sect === sect);
    body =
      filter +
      EQUIP_TIERS.map((lv) => {
        const row = ids.filter((id) => BASES[id].reqLevel === lv);
        return row.length
          ? `<h2>Nível ${lv}</h2><div class="grid">${row.map((id) => card(id, `${SLOT_NAMES[BASES[id].slot]}${BASES[id].sect ? ' · ' + esc(sectName(BASES[id].sect)) : ''}`)).join('')}</div>`
          : '';
      }).join('');
  } else if (kind === 'potion') {
    body = `<div class="grid">${Object.entries(POTIONS)
      .map(([id, p]) => card(id, `${p.kind === 'hp' ? 'Vida' : 'Mana'} ${Math.round(p.percent * 100)}%`))
      .join('')}</div>`;
  } else if (kind === 'material') {
    body = `<p class="intro">Usados pelo Ferreiro para forjar. Empilham na aba de materiais da mochila.</p><div class="grid">${Object.entries(
      MATERIALS,
    )
      .map(([id, m]) => card(id, esc(tierName(m.tier))))
      .join('')}</div>`;
  } else {
    body = `<div class="grid">${Object.keys(CONSUMABLES)
      .map((id) => card(id, 'Consumível'))
      .join('')}</div>`;
  }
  return `<h1>Itens</h1>${tabs}${body}`;
}

const tierName = (t: string) => ({ comum: 'Comum', raro: 'Raro', especial: 'Especial' })[t] ?? t;

function row(label: string, value: string) {
  return `<tr><th>${label}</th><td>${value}</td></tr>`;
}

/** Onde conseguir: drops (chefes num spoiler), lojas e missões. */
function sources(id: string): string {
  const kind = itemKind(id)!;
  const drops = dropsOf(id);
  const li = (d: (typeof drops)[number]) =>
    `<li>${monsterLabel(d.monster)} — <b>${chance(d.chance)}</b>${d.note ? ` <small class="muted">(${esc(d.note)})</small>` : ''}</li>`;
  const normal = drops.filter((d) => !d.boss),
    boss = drops.filter((d) => d.boss);
  const parts: string[] = [];
  if (normal.length || boss.length) {
    const eqNote =
      kind === 'equip'
        ? '<p class="muted">A chance é de cair <i>um equipamento</i> deste nível; o tipo é sorteado entre todos os do nível (armas só da sua seita).</p>'
        : '';
    parts.push(
      `<h3>Monstros</h3>${eqNote}${normal.length ? `<ul>${normal.map(li).join('')}</ul>` : ''}${boss.length ? spoiler(`<ul>${boss.map(li).join('')}</ul>`, 'Chefes que deixam cair') : ''}`,
    );
  }
  const shops: string[] = [];
  if (POTIONS[id])
    shops.push(`<li><a href="#/npc/vendedor">Vendedor de Poções</a> — <b>${POTIONS[id].price} ouro</b></li>`);
  if (MERCHANT.materials[id])
    shops.push(`<li><a href="#/npc/mercador">Mercador Ambulante</a> — <b>${MERCHANT.materials[id]} ouro</b></li>`);
  if (CONSUMABLES[id])
    shops.push(`<li><a href="#/npc/mercador">Mercador Ambulante</a> — <b>${CONSUMABLES[id].price} ouro</b></li>`);
  const b = BASES[id];
  if (b) {
    const i = EQUIP_TIERS.indexOf(b.reqLevel),
      next = EQUIP_TIERS[i + 1];
    shops.push(
      `<li><a href="#/npc/mercador">Mercador Ambulante</a> — às vezes, quando você está entre o nível ${b.reqLevel} e ${next ? next - 1 : 'o máximo'}.
       Incomum <b>${merchantPrice(b.value, 'incomum')} ouro</b>, Raro <b>${merchantPrice(b.value, 'raro')} ouro</b>.</li>`,
    );
  }
  if (shops.length) parts.push(`<h3>Lojas</h3><ul>${shops.join('')}</ul>`);
  const qs = questRewardsFor(id);
  if (qs.length)
    parts.push(
      `<h3>Missões</h3><p class="muted">Recompensa: um equipamento Incomum deste tipo de peça e nível, da sua seita.</p><ul>${qs.map((q) => `<li><b>${esc(q.name)}</b> <small class="muted">(nv ${q.minLevel})</small></li>`).join('')}</ul>`,
    );
  return parts.join('') || '<p class="muted">Nenhuma fonte conhecida.</p>';
}

export function itemPage(id: string): string | null {
  const kind = itemKind(id);
  if (!kind) return null;
  const tab = `#/itens/${kind}`;
  let name = '',
    sub = KIND_NAMES[kind],
    info = '',
    extra = '';
  if (kind === 'equip') {
    const b = BASES[id];
    name = b.name;
    sub = `${SLOT_NAMES[b.slot]}${b.sect ? ` · arma da seita ${esc(sectName(b.sect))}` : ''}`;
    info =
      row('Nível necessário', String(b.reqLevel)) +
      row('Durabilidade', String(b.durability)) +
      Object.entries(b.stats)
        .map(([s, v]) => row(esc(STAT_LABELS[s] ?? s), `+${fmtStatValue(s, v)}`))
        .join('');
    const rar = Object.values(RARITIES)
      .map(
        (r) =>
          `<tr><td><b style="color:${r.color}">${esc(r.name)}</b></td><td>${r.bonuses}</td><td>${r.weight}%</td><td>${sellPrice(b.value, r.valueMul)} ouro</td></tr>`,
      )
      .join('');
    extra = `<section class="panel"><h2>Raridades</h2>
      <table class="tbl"><thead><tr><th>Raridade</th><th>Bônus aleatórios</th><th>Chance no drop</th><th>Venda</th></tr></thead><tbody>${rar}</tbody></table>
      <p class="muted">Bônus aleatórios possíveis: ${BONUS_POOL.map((p) => `${esc(STAT_LABELS[p.stat] ?? p.stat)} (${fmtStatValue(p.stat, p.min)}–${fmtStatValue(p.stat, p.max)})`).join(', ')}.
      Os valores crescem 20% por nível do item acima do 1.</p></section>`;
  } else if (kind === 'potion') {
    const p = POTIONS[id];
    name = p.name;
    info =
      row(
        'Efeito',
        `Recupera ${Math.round(p.percent * 100)}% da ${p.kind === 'hp' ? 'vida' : 'mana'} máxima em ${p.duration} s`,
      ) +
      row('Recarga', `${p.cooldown} s`) +
      row('Compra', `${p.price} ouro`) +
      row('Venda', `${sellPrice(p.price)} ouro`);
    extra = `<p class="muted">Só um efeito de cada tipo (vida/mana) por vez: tomar outra poção do mesmo tipo reinicia o efeito.</p>`;
  } else if (kind === 'material') {
    const m = MATERIALS[id];
    name = m.name;
    info = row('Tipo', tierName(m.tier)) + row('Venda', `${sellPrice(m.value)} ouro`);
    extra = `<p>${esc(m.desc)}</p>`;
  } else {
    const c = CONSUMABLES[id];
    name = c.name;
    info = row('Compra', `${c.price} ouro`) + row('Venda', `${sellPrice(c.price)} ouro`);
    extra = `<p>${esc(c.desc)}</p>`;
  }
  return `<a class="back" href="${tab}">‹ ${esc(KIND_NAMES[kind])}s</a>
    <div class="detail-head">${iconHtml(id, 'big')}<div><h1>${esc(name)}</h1><div class="sub">${sub}</div></div></div>
    <section class="panel"><table class="tbl kv">${info}</table>${kind !== 'equip' ? extra : ''}</section>
    ${kind === 'equip' ? extra : ''}
    <section class="panel"><h2>Onde conseguir</h2>${sources(id)}</section>`;
}
