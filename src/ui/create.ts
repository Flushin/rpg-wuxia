import { CLASSES } from '../core/data';
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
      if (!s) return `<div class="slot-card empty"><div class="slot-info"><b>Espaço ${i + 1}</b><small>Vazio</small></div><div class="slot-btns"><button data-act="new" data-i="${i}" class="primary">Criar personagem</button></div></div>`;
      const c = CLASSES[s.classId];
      return `<div class="slot-card${i === file.lastPlayedSlot ? ' last' : ''}" style="--c:${c?.color ?? '#667'}"><div class="slot-info"><b>${esc(s.name)}</b>
        <small>${c?.name ?? s.classId} - Nível ${s.level}</small><small>${mapName(s.mapId)} - ${relativeTime(s.lastSeen)}</small></div>
        <div class="slot-btns"><button data-act="play" data-i="${i}" class="primary">Jogar</button><button data-act="del" data-i="${i}" class="danger">Apagar</button></div></div>`;
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
      $('del-msg').textContent = `Apagar "${s.name}" (Nv ${s.level}) para sempre? Digite o nome do personagem para confirmar.`;
      const inp = $('del-name') as HTMLInputElement; inp.value = ''; ($('btn-del-ok') as HTMLButtonElement).disabled = true;
      show('del');
    }
  };

  // criação
  const cards = $('class-cards');
  cards.innerHTML = Object.values(CLASSES).map((c) => `<button class="class-card" data-id="${c.id}" style="--c:${c.color}">
    <b>${c.name}</b><span>${c.rangeLabel} - dano ${DAMAGE_LABELS[c.damageType].toLowerCase()} - ${ELEMENT_LABELS[c.element]}</span>
    <em>${c.description}</em>
    <small>${ATTR_KEYS.map((k) => `${ATTR_LABELS[k].slice(0, 3)} ${c.baseAttributes[k]}`).join(' / ')}</small></button>`).join('');
  const refresh = () => cards.querySelectorAll<HTMLElement>('.class-card').forEach((el) => el.classList.toggle('sel', el.dataset.id === selected));
  cards.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('.class-card') as HTMLElement | null;
    if (t) { selected = t.dataset.id!; refresh(); }
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

  renderSlots(); show('slots');
}
