// Mestre da Arena Tie (Porto Noturno; regras em docs/decisoes/arena.md): placar, botão de lutar e a loja de títulos
// paga com a moeda da arena. A luta fica em src/core/world/arena.ts.
import {
  ARENA_COINS,
  ARENA_POWER_MAX,
  ARENA_POWER_MIN,
  ARENA_RANKS,
  ARENA_TITLES,
  arenaPower,
  arenaRank,
} from '../core/arena';
import { L, LANG } from '../core/i18n';
import type { World } from '../core/world';
import { escapeHtml } from './dom';

export function arenaHtml(w: World): string {
  const a = w.arena,
    r = arenaRank(a.points),
    next = ARENA_RANKS.find((x) => x.min > a.points);
  const rankName = (x: (typeof ARENA_RANKS)[number]) => (LANG === 'en' ? x.en : x.name);
  const stats = `<div class="ar-stats">
    <div><b style="color:${r.color}">${rankName(r)}</b> · ${a.points} ${L('pontos', 'points')}${next ? ` <small class="muted">(${rankName(next)}: ${next.min})</small>` : ''}</div>
    <div>${L('Vitórias', 'Wins')} ${a.wins} · ${L('Derrotas', 'Losses')} ${a.losses}</div>
    <div>${L('Moedas da arena', 'Arena coins')}: <b>${a.coins}</b></div>
    <small class="muted">${L(
      `O adversário é um lutador de outra seita com ${Math.round(ARENA_POWER_MIN * 100)}% a ${Math.round(ARENA_POWER_MAX * 100)}% do seu poder: quanto mais pontos, mais forte (agora ~${Math.round(arenaPower(a.points) * 100)}%). Vitória +${ARENA_COINS.win} moedas, derrota +${ARENA_COINS.loss}. Perder não tem penalidade.`,
      `Your opponent is a fighter from another sect with ${Math.round(ARENA_POWER_MIN * 100)}% to ${Math.round(ARENA_POWER_MAX * 100)}% of your power: the more points, the stronger (now ~${Math.round(arenaPower(a.points) * 100)}%). Win +${ARENA_COINS.win} coins, loss +${ARENA_COINS.loss}. Losing has no penalty.`,
    )}</small>
    <button class="primary" data-a="arenafight">${L('Lutar', 'Fight')}</button></div>`;
  const row = (id: string) => {
    const t = ARENA_TITLES[id],
      owned = a.titles.includes(id),
      worn = a.title === id;
    let btn: string;
    if (worn) btn = `<button data-a="titlewear" data-v="">${L('Tirar', 'Remove')}</button>`;
    else if (owned) btn = `<button class="primary" data-a="titlewear" data-v="${id}">${L('Usar', 'Use')}</button>`;
    else if (t.exclusive) btn = `<small class="muted">${L('Exclusivo dos Fundadores', 'Founders exclusive')}</small>`;
    else if (a.points < t.minPoints)
      btn = `<small class="muted">${L(`Requer ${t.minPoints} pontos`, `Requires ${t.minPoints} points`)}</small>`;
    else
      btn = `<button class="primary" data-a="titlebuy" data-v="${id}" ${a.coins < t.price ? 'disabled' : ''}>${L(`Comprar (${t.price} moedas)`, `Buy (${t.price} coins)`)}</button>`;
    return `<div class="dg-row sk-row"><div class="sk-body"><b style="color:${t.color}">«${escapeHtml(t.name)}»</b>${worn ? ` <small class="muted">${L('(em uso)', '(in use)')}</small>` : ''}${btn}</div></div>`;
  };
  return `${stats}<h4>${L('Títulos', 'Titles')}</h4>
    <small class="muted">${L('Aparecem acima do seu nome. Só visual: não dão poder.', 'Shown above your name. Cosmetic only: no power.')}</small>
    ${Object.keys(ARENA_TITLES).map(row).join('')}`;
}
