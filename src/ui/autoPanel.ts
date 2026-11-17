import { L } from '../core/i18n';
import { BUCKET_SEC, MAX_BUCKETS, RATE_MIN_SEC, SHIELD_HP } from '../core/auto';
import { GROUND_SECONDS, RARITIES } from '../core/items';
import { OFFLINE_TIERS } from '../core/offline';
import { initials } from '../core/skills';
import { skillIconHtml } from './icons';
import type { World, OfflineReport } from '../core/world';
import { audio } from '../render/audio';
import { closeX } from './labels';
import { byId } from './dom';

const pct = (frac: number) => `${Math.round(frac * 100)}%`;
const RATE_WINDOW_MIN = (BUCKET_SEC * MAX_BUCKETS) / 60;
// "<b>60%</b> até 12 h · <b>40%</b> de 12 h a 18 h · … · <b>0%</b> depois de 24 h", lido de OFFLINE_TIERS
const tierText = (upTo: string, fromTo: string, after: string) => {
  const parts = OFFLINE_TIERS.map((t, i) =>
    i === 0
      ? `<b>${pct(t.eff)}</b> ${upTo} ${t.untilH} h`
      : `<b>${pct(t.eff)}</b> ${fromTo.replace('{a}', String(OFFLINE_TIERS[i - 1].untilH)).replace('{b}', String(t.untilH))}`,
  );
  return [...parts, `<b>0%</b> ${after} ${OFFLINE_TIERS[OFFLINE_TIERS.length - 1].untilH} h`].join(' · ');
};
const tiersPt = tierText('até', 'de {a} h a {b} h', 'depois de'),
  tiersEn = tierText('up to', 'from {a} h to {b} h', 'after');

const fmtDur = (ms: number) => {
  const m = Math.floor(ms / 60000),
    h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
};

// Menu do auto-combate (engrenagem ao lado do botão Auto).
export class AutoPanel {
  constructor(private world: World) {
    const el = byId('auto-panel');
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el || t.closest('[data-act="close"]')) this.set(false);
    });
    el.addEventListener('input', (e) => {
      const i = e.target as HTMLInputElement,
        c = this.world.auto.cfg;
      if (!i.dataset.k) return;
      const v = +i.value,
        o = i.nextElementSibling as HTMLElement | null;
      if (o) o.textContent = i.dataset.k.startsWith('buy') ? String(v) : `${v}%`;
      (c as unknown as Record<string, number>)[i.dataset.k] = v;
    });
    el.addEventListener('change', (e) => {
      const i = e.target as HTMLInputElement,
        c = this.world.auto.cfg;
      if (i.dataset.skill) {
        c.skillsOff = c.skillsOff.filter((x) => x !== i.dataset.skill);
        if (!i.checked) c.skillsOff.push(i.dataset.skill);
      } else if (i.id === 'auto-sell-inc') c.sellIncomum = i.checked;
      audio.ui('ui_click');
    });
  }
  get open() {
    return !byId('auto-panel').classList.contains('hidden');
  }
  set(open: boolean) {
    if (open === this.open) return;
    audio.ui(open ? 'ui_open' : 'ui_close');
    byId('auto-panel').classList.toggle('hidden', !open);
    if (open) this.render();
  }

  private render() {
    const w = this.world,
      c = w.auto.cfg,
      r = w.auto.rate();
    const skills = w
      .activeSkills()
      .map((d) => {
        const unlocked = w.isUnlocked(d);
        return `<label class="opt"><input type="checkbox" data-skill="${d.id}" ${unlocked && !c.skillsOff.includes(d.id) ? 'checked' : ''} ${unlocked ? '' : 'disabled'}/> <span class="opt-ic">${skillIconHtml(d.id, initials(d.name))}</span> ${d.name}${unlocked ? '' : ` <small class="muted">(${L(`nível ${d.unlock}`, `level ${d.unlock}`)})</small>`}</label>`;
      })
      .join('');
    const sld = (label: string, k: string, min: number, max: number, v: number, pct: boolean) =>
      `<label class="sld">${label}<input type="range" data-k="${k}" min="${min}" max="${max}" step="1" value="${v}"/><output>${v}${pct ? '%' : ''}</output></label>`;
    byId('auto-panel').innerHTML =
      `<div class="card">${closeX('data-act="close"')}<h2>${L('Auto-combate', 'Auto-battle')}</h2>
      <h3>${L('Habilidades usadas', 'Skills used')}</h3>${skills}
      <small class="muted">${L(`O ataque básico é sempre usado. Skills de área só saem com monstro no alcance; o Véu de Névoa sai quando a vida está abaixo de ${pct(SHIELD_HP)} em combate.`, `The basic attack is always used. Area skills only fire with a monster in range; Mist Veil fires when health is below ${pct(SHIELD_HP)} in combat.`)}</small>
      <h3>${L('Poções', 'Potions')}</h3>
      ${sld(L('Beber vida abaixo de', 'Drink health below'), 'hpThreshold', 5, 95, c.hpThreshold, true)}
      ${sld(L('Beber mana abaixo de', 'Drink mana below'), 'mpThreshold', 0, 95, c.mpThreshold, true)}
      <h3>${L('Comprar na vila (quando as poções acabam)', 'Buy in village (when potions run out)')}</h3>
      ${sld(L('Poções de vida', 'Health potions'), 'buyHp', 0, 40, c.buyHp, false)}
      ${sld(L('Poções de mana', 'Mana potions'), 'buyMp', 0, 40, c.buyMp, false)}
      <small class="muted">${L('Se faltar ouro, compra o que der. Sem ouro, continua caçando sem poção.', 'If gold runs short, buys what it can. With no gold, keeps hunting without potions.')}</small>
      <h3>${L('Mochila cheia', 'Bag full')}</h3>
      <label class="opt"><input type="checkbox" id="auto-sell-inc" ${c.sellIncomum ? 'checked' : ''}/> ${L('Vender também itens Incomuns', 'Also sell Uncommon items')}</label>
      <small class="muted">${L(`Itens Comuns são vendidos sozinhos quando a mochila enche. Raros (e Incomuns, se a opção estiver desligada) ficam no chão por ${GROUND_SECONDS} s.`, `Common items are sold automatically when the bag fills up. Rare items (and Uncommon, if the option is off) stay on the ground for ${GROUND_SECONDS} s.`)}</small>
      <div class="how">${L(
        `<b>Ganho offline.</b> Se você fechar o jogo com o Auto ligado num mapa de caça, ao voltar recebe XP, ouro e itens pelo tempo fora, no ritmo medido nos últimos ~${RATE_WINDOW_MIN} min de auto-combate (precisa de pelo menos ${RATE_MIN_SEC / 60} min de dados).<br>
      Rendimento: ${tiersPt}.<br>
      Offline não há morte nem perda de durabilidade; as poções são gastas no ritmo medido (se acabarem, os ganhos continuam); itens que não cabem na mochila são vendidos. Skills não ganham XP offline.<br>`,
        `<b>Offline earnings.</b> If you close the game with Auto on in a hunting map, when you return you get XP, gold and items for the time away, at the pace measured over the last ~${RATE_WINDOW_MIN} min of auto-battle (needs at least ${RATE_MIN_SEC / 60} min of data).<br>
      Yield: ${tiersEn}.<br>
      Offline there is no death or durability loss; potions are used at the measured pace (if they run out, earnings continue); items that don't fit in the bag are sold. Skills don't gain XP offline.<br>`,
      )}
      ${r ? L(`Seu ritmo atual: <b>${r.killsPerMin.toFixed(1)}</b> abates por minuto.`, `Your current pace: <b>${r.killsPerMin.toFixed(1)}</b> kills per minute.`) : L('Seu ritmo ainda não foi medido: deixe o Auto ligado por alguns minutos.', 'Your pace has not been measured yet: leave Auto on for a few minutes.')}</div>
      <button class="primary close-btn" data-act="close">${L('Fechar', 'Close')}</button></div>`;
  }
}

export function showOfflineReport(rep: OfflineReport, onClose: () => void) {
  const el = byId('offline-panel');
  const row = (a: string, b: string) => `<div class="rep-row"><span>${a}</span><b>${b}</b></div>`;
  const items = (['raro', 'incomum', 'comum'] as const)
    .map((r) => {
      const list = rep.items.filter((i) => i.rarity === r);
      const n = list.reduce((a, i) => a + i.qty, 0);
      if (!n) return '';
      return `<div class="rep-row"><span style="color:${RARITIES[r].color}">${RARITIES[r].name} x${n}</span><b style="font-weight:400;font-size:12px;color:#aab">${list.map((i) => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ')}</b></div>`;
    })
    .join('');
  const pots = rep.potionsUsed.hp + rep.potionsUsed.mp;
  el.innerHTML = `<div class="card"><h2>${L('Enquanto você esteve fora', 'While you were away')}</h2>
    ${row(L('Tempo fora', 'Time away'), fmtDur(rep.elapsedMs))}
    ${row(L('Eficiência aplicada', 'Efficiency applied'), L(`${Math.round(rep.efficiency * 100)}% (${fmtDur(rep.effMin * 60000)} de caça)`, `${Math.round(rep.efficiency * 100)}% (${fmtDur(rep.effMin * 60000)} of hunting)`))}
    ${row(L('Monstros derrotados', 'Monsters defeated'), String(rep.kills))}
    ${row(L('Experiência', 'Experience'), rep.xp > 0 ? `+${rep.xp}${rep.levelsGained > 0 ? L(` (+${rep.levelsGained} nível, agora Nv ${rep.newLevel})`, ` (+${rep.levelsGained} level${rep.levelsGained > 1 ? 's' : ''}, now Lv ${rep.newLevel})`) : ''}` : L('0 (nível máximo)', '0 (max level)'))}
    ${row(L('Ouro', 'Gold'), `+${rep.gold}`)}
    ${items || row(L('Itens', 'Items'), L('nenhum', 'none'))}
    ${row(L('Poções gastas', 'Potions used'), pots ? L(`${rep.potionsUsed.hp} de vida, ${rep.potionsUsed.mp} de mana`, `${rep.potionsUsed.hp} health, ${rep.potionsUsed.mp} mana`) : L('nenhuma', 'none'))}
    ${rep.soldCount ? row(L('Vendido automaticamente', 'Sold automatically'), L(`${rep.soldCount} itens (+${rep.soldGold} ouro)`, `${rep.soldCount} items (+${rep.soldGold} gold)`)) : ''}
    <small class="muted">${L('O auto-combate volta a caçar assim que você continuar.', 'Auto-battle resumes hunting as soon as you continue.')}</small>
    <button class="primary" id="offline-ok">${L('Continuar', 'Continue')}</button></div>`;
  el.classList.remove('hidden');
  audio.ui('ui_open');
  (byId('offline-ok') as HTMLButtonElement).onclick = () => {
    el.classList.add('hidden');
    audio.ui('ui_close');
    onClose();
  };
}
