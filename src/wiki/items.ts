// Páginas de itens: lista por categoria e página de cada item (atributos, preços e onde conseguir).
import {
  BASES,
  BONUS_POOL,
  CLASSES,
  CONSUMABLES,
  EPIC,
  EPIC_ITEMS,
  EQUIP_TIERS,
  epicTierBase,
  epicTierStats,
  MATERIALS,
  MERCHANT,
  POTIONS,
  RARITIES,
  SLOT_NAMES,
  STAT_LABELS,
  dropsOf,
  esc,
  fmtStatValue,
  PROGRESSION,
  SECT_ORDER,
  iconHtml,
  itemKind,
  KIND_NAMES,
  merchantPrice,
  questRewardsFor,
  sellPrice,
  type ItemKind,
} from './data';
import { chance, itemLink, monsterLabel, spoiler } from './ui';
import { epicBonusesAt } from './mechanics';

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
    // Épicos: sem nível próprio nem página de item; o cartão leva à página de regras
    const col = RARITIES.epico.color,
      epics = EPIC_ITEMS.filter((e) => !sect || !e.sect || e.sect === sect)
        .map(
          (e) =>
            `<a class="card-link item-card" href="#/item/${e.id}" data-name="${esc(e.name.toLowerCase())}">${iconHtml(e.id)}<b style="color:${col}">${esc(e.name)}</b><small>Épico · ${SLOT_NAMES[e.slot]}${e.sect ? ' · ' + esc(sectName(e.sect)) : ''}</small></a>`,
        )
        .join('');
    body =
      filter +
      `<h2 style="color:${col}">Épicos <small class="muted">(acompanham seu nível)</small></h2><div class="grid">${epics}</div>` +
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

/** Página de um Épico (#/item/epico_<slot> ou epico_arma_<seita>): sem nível, atributos por faixa e bônus por seita. */
function epicPage(id: string): string | null {
  const e = EPIC_ITEMS.find((x) => x.id === id);
  if (!e) return null;
  const col = RARITIES.epico.color,
    tiers = EQUIP_TIERS,
    sects = e.sect ? [e.sect] : SECT_ORDER;
  const rows = tiers
    .map((lv, i) => {
      const hi = i + 1 < tiers.length ? tiers[i + 1] - 1 : PROGRESSION.levelCap,
        base = epicTierBase(e.slot, e.sect, lv),
        st = epicTierStats(e.slot, e.sect, lv);
      // uma coluna só (peça e, embaixo, os atributos): cabe no celular sem rolar para o lado
      return `<tr><td>${lv}–${hi}</td><td>${itemLink(base)}<br><small>${Object.entries(st)
        .map(([s, v]) => `+${fmtStatValue(s, v)} ${esc(STAT_LABELS[s] ?? s)}`)
        .join(' · ')}</small></td></tr>`;
    })
    .join('');
  const lvs = [1, 10, 20, 30];
  const bon = sects
    .map(
      (c) =>
        `<tr><td>${esc(sectName(c))}</td><td>${epicBonusesAt(c, 1)
          .map((b) => esc(STAT_LABELS[b.stat] ?? b.stat))
          .join(' + ')}</td>${lvs
          .map(
            (lv) =>
              `<td>${epicBonusesAt(c, lv)
                .map((b) => `+${b.value}`)
                .join(' / ')}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  const sub = `<b style="color:${col}">${esc(RARITIES.epico.name)}</b> · ${e.sect ? `Arma da seita ${esc(sectName(e.sect))}` : SLOT_NAMES[e.slot]}`;
  return `<a class="back" href="#/itens/equip">‹ Equipamentos</a>
    <div class="detail-head">${iconHtml(id, 'big')}<div><h1 style="color:${col}">${esc(e.name)}</h1><div class="sub">${sub}</div></div></div>
    <section class="panel"><table class="tbl kv">${row('Nível', 'sem nível: acompanha o seu')}${row('Durabilidade', '100')}${row('Venda', 'não pode ser vendido (desmonta no ferreiro)')}</table></section>
    <section class="panel"><h2>Atributos por faixa</h2><table class="tbl"><thead><tr><th>Seu nível</th><th>Peça usada e atributos (+0)</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">Os atributos da peça da sua faixa ×${String(EPIC.mul).replace('.', ',')}. A forja (até +10) soma por cima, como no Raro, com o ouro em dobro.</p></section>
    <section class="panel"><h2>Bônus da classe</h2><div class="scroll"><table class="tbl"><thead><tr><th>Seita</th><th>Bônus</th>${lvs.map((lv) => `<th>Nível ${lv}</th>`).join('')}</tr></thead><tbody>${bon}</tbody></table></div>
      <p class="muted">${e.sect ? 'Arma só da própria seita.' : 'Os bônus seguem a classe de quem usa o item.'}</p></section>
    <section class="panel"><h2>Onde conseguir</h2><p>Qualquer monstro: <b>${String(EPIC.chanceMob * 100).replace('.', ',')}%</b> por abate; chefes: <b>${String(EPIC.chanceBoss * 100).replace('.', ',')}%</b>.
      Só jogando (não no Auto nem offline), nunca de ajudantes invocados, e o monstro precisa ter nível igual ou maior que o seu menos ${EPIC.maxLevelsBelow}.
      A peça é sorteada entre todas as que você usa. Regras completas em <a href="#/mecanicas/epico">Equipamento Épico</a>.</p></section>`;
}

export function itemPage(id: string): string | null {
  if (id.startsWith('epico_')) return epicPage(id);
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
    const total = Object.values(RARITIES).reduce((t, r) => t + r.weight, 0);
    const rar = Object.values(RARITIES)
      .filter((r) => r.weight > 0) // Épico tem drop próprio (fora do sorteio de raridade)
      .map(
        (r) =>
          `<tr><td><b style="color:${r.color}">${esc(r.name)}</b></td><td>${r.bonuses}</td><td>${+((r.weight / total) * 100).toFixed(1)}%</td><td>${sellPrice(b.value, r.valueMul)} ouro</td></tr>`,
      )
      .join('');
    extra = `<section class="panel"><h2>Raridades</h2>
      <table class="tbl"><thead><tr><th>Raridade</th><th>Bônus aleatórios</th><th>Chance no drop</th><th>Venda</th></tr></thead><tbody>${rar}</tbody></table>
      <p class="muted">Bônus aleatórios possíveis: ${BONUS_POOL.map((p) => `${esc(STAT_LABELS[p.stat] ?? p.stat)} (${fmtStatValue(p.stat, p.min)}–${fmtStatValue(p.stat, p.max)})`).join(', ')}.
      Os valores crescem 20% por nível do item acima do 1.</p>
      <p class="muted">Toda peça também pode cair <a href="#/mecanicas/epico" style="color:${RARITIES.epico.color}">Épica</a> (roxa): sem nível, acompanha o seu, com bônus da sua classe.</p></section>`;
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
