import { L, bindLangButtons, langButtons } from '../core/i18n';
import { CLASSES, NPC_TEXT, SECT_ORDER } from '../core/data';
import { MASTER_PORTRAITS } from '../render/sprites';
import { SLOT_COUNT, relativeTime, type SaveFile } from '../core/saves';
import { ATTR_KEYS } from '../core/types';
import { ATTR_LABELS, DAMAGE_LABELS, ELEMENT_LABELS } from './labels';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export interface TitleHandlers {
  onPlay: (slot: number, isLast: boolean) => void;
  onCreate: (slot: number, name: string, classId: string) => void;
  onDelete: (slot: number) => Promise<SaveFile> | SaveFile;
}

// Tela inicial: 4 espaços de personagem + criação + confirmação de exclusão (digitar o nome).
export function showTitleScreen(initial: SaveFile, h: TitleHandlers, mapName: (id: string) => string) {
  const root = $('create');
  root.classList.remove('hidden');
  let file = initial, selected = Object.keys(CLASSES)[0], slot = 0;
  const views = { slots: $('slots-view'), create: $('create-view'), del: $('del-view') };
  const show = (v: keyof typeof views) => { for (const [k, el] of Object.entries(views)) el.classList.toggle('hidden', k !== v); root.scrollTop = 0; };

  const list = $('slot-list');
  const renderSlots = () => {
    list.innerHTML = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const s = file.slots[i];
      if (!s) return `<div class="slot-card empty"><div class="slot-info"><b>${L(`Espaço ${i + 1}`, `Slot ${i + 1}`)}</b><small>${L('Vazio', 'Empty')}</small></div><div class="slot-btns"><button data-act="new" data-i="${i}" class="primary">${L('Criar personagem', 'Create character')}</button></div></div>`;
      const c = CLASSES[s.classId];
      return `<div class="slot-card${i === file.lastPlayedSlot ? ' last' : ''}" style="--c:${c?.color ?? '#667'}"><div class="slot-info"><b>${esc(s.name)}</b>
        <small>${c?.name ?? s.classId} - ${L(`Nível ${s.level}`, `Level ${s.level}`)}</small><small>${mapName(s.mapId)} - ${relativeTime(s.lastSeen)}</small></div>
        <div class="slot-btns"><button data-act="play" data-i="${i}" class="primary">${L('Jogar', 'Play')}</button><button data-act="del" data-i="${i}" class="danger">${L('Apagar', 'Delete')}</button></div></div>`;
    }).join('');
  };
  list.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!t) return;
    const i = Number(t.dataset.i), s = file.slots[i];
    if (t.dataset.act === 'play' && s) { root.classList.add('hidden'); h.onPlay(i, i === file.lastPlayedSlot); }
    else if (t.dataset.act === 'new') { slot = i; ($('char-name') as HTMLInputElement).value = ''; show('create'); }
    else if (t.dataset.act === 'del' && s) {
      slot = i;
      $('del-msg').textContent = L(`Apagar "${s.name}" (Nv ${s.level}) para sempre? Digite o nome do personagem para confirmar.`, `Delete "${s.name}" (Lv ${s.level}) forever? Type the character name to confirm.`);
      const inp = $('del-name') as HTMLInputElement; inp.value = ''; ($('btn-del-ok') as HTMLButtonElement).disabled = true;
      show('del');
    }
  };

  // criação
  const cards = $('class-cards');
  // cada seita é apresentada pelo seu mestre (o mesmo que fica na praça da cidade);
  // Titã e Víbora aparecem bloqueadas ("em breve")
  const LOCKED: Record<string, { name: string; color: string; range: string }> = {
    tita: { name: L('Titã', 'Titan'), color: '#c48028', range: L('Corpo a corpo - tanque', 'Melee - tank') },
    vibora: { name: L('Víbora', 'Viper'), color: '#34804a', range: L('À distância - veneno', 'Ranged - poison') },
  };
  const masterBlock = (id: string, color: string) => {
    const m = NPC_TEXT.masters[id];
    if (!m) return '';
    return `<div class="master" style="--c:${color}"><img src="${MASTER_PORTRAITS[id] ?? ''}" alt="" loading="lazy"><div><strong>${esc(m.name)}</strong><i>${esc(m.title)}</i></div></div>
      <q>${esc(m.intro)}</q>`;
  };
  cards.innerHTML = SECT_ORDER.map((id) => {
    const c = CLASSES[id];
    if (c) return `<button class="class-card" data-id="${c.id}" style="--c:${c.color}">
    <b>${c.name}</b><span>${c.rangeLabel} - ${L('dano', 'damage:')} ${DAMAGE_LABELS[c.damageType].toLowerCase()} - ${ELEMENT_LABELS[c.element]}</span>
    ${masterBlock(id, c.color)}
    <small>${ATTR_KEYS.map((k) => `${ATTR_LABELS[k].slice(0, 3)} ${c.baseAttributes[k]}`).join(' / ')}</small></button>`;
    const lk = LOCKED[id];
    return lk ? `<button class="class-card locked" data-locked="1" disabled aria-disabled="true" style="--c:${lk.color}">
    <b>${lk.name}</b><span>${lk.range}</span><span class="soon">${L('Em breve', 'Coming soon')}</span>
    ${masterBlock(id, lk.color)}</button>` : '';
  }).join('');
  const refresh = () => cards.querySelectorAll<HTMLElement>('.class-card').forEach((el) => el.classList.toggle('sel', el.dataset.id === selected));
  cards.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('.class-card') as HTMLElement | null;
    if (t && !t.dataset.locked) { selected = t.dataset.id!; refresh(); }
  };
  refresh();
  const input = $('char-name') as HTMLInputElement;
  input.oninput = () => input.classList.remove('err');
  $('btn-start').onclick = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); input.classList.add('err'); return; }
    root.classList.add('hidden');
    h.onCreate(slot, name, selected);
  };
  $('btn-back').onclick = () => show('slots');

  // exclusão
  const del = $('del-name') as HTMLInputElement, ok = $('btn-del-ok') as HTMLButtonElement;
  del.oninput = () => { ok.disabled = del.value.trim() !== (file.slots[slot]?.name ?? '\u0000'); };
  $('btn-del-cancel').onclick = () => show('slots');
  ok.onclick = async () => {
    if (ok.disabled) return;
    file = await h.onDelete(slot);
    renderSlots(); show('slots');
  };

  $('lang-slot').innerHTML = langButtons(); bindLangButtons($('lang-slot'));
  renderSlots(); show('slots');
}

/** Tela inicial quando os personagens não puderam ser lidos: aviso + "Tentar de novo" (nada é gravado até ler). */
export function showLoadError(onRetry: () => void) {
  const root = $('create');
  root.classList.remove('hidden');
  $('create-view').classList.add('hidden');
  $('del-view').classList.add('hidden');
  $('slots-view').classList.remove('hidden');
  $('slot-list').innerHTML = `<div class="slot-card empty"><div class="slot-info">
    <b>${L('Não foi possível ler seus personagens', 'Could not read your characters')}</b>
    <small>${L('Eles não foram apagados. Tente de novo; se continuar, feche e abra o jogo.', 'They were not deleted. Try again; if it keeps happening, close and reopen the game.')}</small>
    </div><div class="slot-btns"><button id="btn-load-retry" class="primary">${L('Tentar de novo', 'Try again')}</button></div></div>`;
  const retry = $('btn-load-retry') as HTMLButtonElement;
  retry.onclick = () => { retry.disabled = true; onRetry(); };
}
