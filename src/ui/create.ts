import { L, bindLangButtons, langButtons } from '../core/i18n';
import { CLASSES, NPC_TEXT, SECT_ORDER } from '../core/data';
import { MASTER_PORTRAITS } from '../render/sprites';
import { SLOT_COUNT, relativeTime, type SaveFile } from '../core/saves';
import { ATTR_KEYS } from '../core/types';
import { ATTR_LABELS, DAMAGE_LABELS, ELEMENT_LABELS } from './labels';
import { byId, escapeHtml } from './dom';

export interface TitleHandlers {
  onPlay: (slot: number, isLast: boolean) => void;
  onCreate: (slot: number, name: string, classId: string) => void;
  onDelete: (slot: number) => Promise<SaveFile> | SaveFile;
}

type View = 'slots' | 'create' | 'del';

/** Estado da tela inicial, compartilhado pelas três partes (lista, criação, exclusão). */
interface TitleState {
  root: HTMLElement;
  h: TitleHandlers;
  file: SaveFile;
  /** espaço que está sendo criado ou apagado */
  slot: number;
  /** seita escolhida na criação */
  selected: string;
  show: (v: View) => void;
}

// Tela inicial: 4 espaços de personagem + criação + confirmação de exclusão (digitar o nome).
export function showTitleScreen(initial: SaveFile, h: TitleHandlers, mapName: (id: string) => string) {
  const root = byId('create');
  root.classList.remove('hidden');
  const views: Record<View, HTMLElement> = {
    slots: byId('slots-view'),
    create: byId('create-view'),
    del: byId('del-view'),
  };
  const st: TitleState = {
    root,
    h,
    file: initial,
    slot: 0,
    selected: Object.keys(CLASSES)[0],
    show: (v) => {
      for (const [k, el] of Object.entries(views)) el.classList.toggle('hidden', k !== v);
      root.scrollTop = 0;
    },
  };
  const renderSlots = setupSlotList(st, mapName);
  setupCreateView(st);
  setupDeleteView(st, renderSlots);
  byId('lang-slot').innerHTML = langButtons();
  bindLangButtons(byId('lang-slot'));
  renderSlots();
  st.show('slots');
}

/** Lista dos 4 espaços (Jogar, Criar, Apagar). Devolve a função que redesenha a lista. */
function setupSlotList(st: TitleState, mapName: (id: string) => string) {
  const list = byId('slot-list');
  const render = () => {
    list.innerHTML = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const s = st.file.slots[i];
      if (!s)
        return `<div class="slot-card empty"><div class="slot-info"><b>${L(`Espaço ${i + 1}`, `Slot ${i + 1}`)}</b><small>${L('Vazio', 'Empty')}</small></div><div class="slot-btns"><button data-act="new" data-i="${i}" class="primary">${L('Criar personagem', 'Create character')}</button></div></div>`;
      const c = CLASSES[s.classId];
      return `<div class="slot-card${i === st.file.lastPlayedSlot ? ' last' : ''}" style="--c:${c?.color ?? '#667'}"><div class="slot-info"><b>${escapeHtml(s.name)}</b>
        <small>${c?.name ?? s.classId} - ${L(`Nível ${s.level}`, `Level ${s.level}`)}</small><small>${mapName(s.mapId)} - ${relativeTime(s.lastSeen)}</small></div>
        <div class="slot-btns"><button data-act="play" data-i="${i}" class="primary">${L('Jogar', 'Play')}</button><button data-act="del" data-i="${i}" class="danger">${L('Apagar', 'Delete')}</button></div></div>`;
    }).join('');
  };
  list.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!t) return;
    const i = Number(t.dataset.i),
      s = st.file.slots[i];
    if (t.dataset.act === 'play' && s) {
      st.root.classList.add('hidden');
      st.h.onPlay(i, i === st.file.lastPlayedSlot);
    } else if (t.dataset.act === 'new') {
      st.slot = i;
      (byId('char-name') as HTMLInputElement).value = '';
      st.show('create');
    } else if (t.dataset.act === 'del' && s) {
      st.slot = i;
      byId('del-msg').textContent = L(
        `Apagar "${s.name}" (Nv ${s.level}) para sempre? Digite o nome do personagem para confirmar.`,
        `Delete "${s.name}" (Lv ${s.level}) forever? Type the character name to confirm.`,
      );
      (byId('del-name') as HTMLInputElement).value = '';
      (byId('btn-del-ok') as HTMLButtonElement).disabled = true;
      st.show('del');
    }
  };
  return render;
}

// cada seita é apresentada pelo seu mestre (o mesmo que fica na praça da cidade)
function masterBlock(id: string, color: string) {
  const m = NPC_TEXT.masters[id];
  if (!m) return '';
  return `<div class="master" style="--c:${color}"><img src="${MASTER_PORTRAITS[id] ?? ''}" alt="" loading="lazy"><div><strong>${escapeHtml(m.name)}</strong><i>${escapeHtml(m.title)}</i></div></div>
      <q>${escapeHtml(m.intro)}</q>`;
}

/** Criação: cartões das seitas, nome e "Começar". */
function setupCreateView(st: TitleState) {
  const cards = byId('class-cards');
  cards.innerHTML = SECT_ORDER.map((id) => {
    const c = CLASSES[id];
    if (c)
      return `<button class="class-card" data-id="${c.id}" style="--c:${c.color}">
    <b>${c.name}</b><span>${c.rangeLabel} - ${L('dano', 'damage:')} ${DAMAGE_LABELS[c.damageType].toLowerCase()} - ${ELEMENT_LABELS[c.element]}</span>
    ${masterBlock(id, c.color)}
    <small>${ATTR_KEYS.map((k) => `${ATTR_LABELS[k].slice(0, 3)} ${c.baseAttributes[k]}`).join(' / ')}</small></button>`;
    return '';
  }).join('');
  const refresh = () =>
    cards
      .querySelectorAll<HTMLElement>('.class-card')
      .forEach((el) => el.classList.toggle('sel', el.dataset.id === st.selected));
  cards.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('.class-card') as HTMLElement | null;
    if (t && !t.dataset.locked) {
      st.selected = t.dataset.id!;
      refresh();
    }
  };
  refresh();
  const input = byId('char-name') as HTMLInputElement;
  input.oninput = () => input.classList.remove('err');
  byId('btn-start').onclick = () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      input.classList.add('err');
      return;
    }
    st.root.classList.add('hidden');
    st.h.onCreate(st.slot, name, st.selected);
  };
  byId('btn-back').onclick = () => st.show('slots');
}

/** Exclusão: só libera "Apagar" quando o nome digitado é igual ao do personagem. */
function setupDeleteView(st: TitleState, renderSlots: () => void) {
  const del = byId('del-name') as HTMLInputElement,
    ok = byId('btn-del-ok') as HTMLButtonElement;
  del.oninput = () => {
    ok.disabled = del.value.trim() !== (st.file.slots[st.slot]?.name ?? '\u0000');
  };
  byId('btn-del-cancel').onclick = () => st.show('slots');
  ok.onclick = async () => {
    if (ok.disabled) return;
    st.file = await st.h.onDelete(st.slot);
    renderSlots();
    st.show('slots');
  };
}

/** Tela inicial quando os personagens não puderam ser lidos: aviso + "Tentar de novo" (nada é gravado até ler). */
export function showLoadError(onRetry: () => void) {
  const root = byId('create');
  root.classList.remove('hidden');
  byId('create-view').classList.add('hidden');
  byId('del-view').classList.add('hidden');
  byId('slots-view').classList.remove('hidden');
  byId('slot-list').innerHTML = `<div class="slot-card empty"><div class="slot-info">
    <b>${L('Não foi possível ler seus personagens', 'Could not read your characters')}</b>
    <small>${L('Eles não foram apagados. Tente de novo; se continuar, feche e abra o jogo.', 'They were not deleted. Try again; if it keeps happening, close and reopen the game.')}</small>
    </div><div class="slot-btns"><button id="btn-load-retry" class="primary">${L('Tentar de novo', 'Try again')}</button></div></div>`;
  const retry = byId('btn-load-retry') as HTMLButtonElement;
  retry.onclick = () => {
    retry.disabled = true;
    onRetry();
  };
}
