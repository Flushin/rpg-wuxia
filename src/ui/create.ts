import { CLASSES } from '../core/data';
import type { SaveData } from '../core/types';
import { ATTR_KEYS } from '../core/types';
import { ATTR_LABELS, DAMAGE_LABELS, ELEMENT_LABELS } from './labels';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export function showCreateScreen(save: SaveData | undefined, onNew: (name: string, classId: string) => void, onContinue: () => void) {
  const root = $('create');
  root.classList.remove('hidden');
  let selected = Object.keys(CLASSES)[0];
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
  const cont = $('btn-continue');
  cont.classList.toggle('hidden', !save);
  if (save) cont.textContent = `Continuar: ${save.name} (${CLASSES[save.classId]?.name ?? '?'}, Nv ${save.level})`;
  cont.onclick = () => { root.classList.add('hidden'); onContinue(); };
  $('btn-start').onclick = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); input.classList.add('err'); return; }
    root.classList.add('hidden');
    onNew(name, selected);
  };
  input.oninput = () => input.classList.remove('err');
}
