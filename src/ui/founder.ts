/** Boas-vindas do veterano (src/core/founder.ts): título, bônus e escolha definitiva da montaria de Fundador.
 *  Usa o mesmo painel do resumo offline (#offline-panel). "Escolher depois" deixa a escolha para o Cavalariço Ma. */
import { L } from '../core/i18n';
import { MOUNTS } from '../core/data';
import { ARENA_TITLES } from '../core/arena';
import {
  FOUNDER_GOLD_UNTIL,
  FOUNDER_TITLE,
  FOUNDER_XP_UNTIL,
  chooseFounderMount,
  founderMounts,
} from '../core/founder';
import type { World } from '../core/world';
import { audio } from '../render/audio';
import { byId, escapeHtml } from './dom';

/** Miniatura da montaria (public/sprites/thumbs/mount-<id>.png, recorte de lado do 1º quadro parado). */
export const mountThumb = (id: string, size = 64) =>
  `<img class="mount-thumb" src="/sprites/thumbs/mount-${id}.png" alt="" width="${size}" height="${Math.round((size * 133) / 161)}" loading="lazy">`;

/** Título exclusivo em HTML: degradê dourado, brilho pulsante e faíscas (CSS em npc-auto.css, .title-fx). */
export const titleFxHtml = (name: string) =>
  `<b class="title-fx"><span>«${escapeHtml(name)}»</span><i></i><i></i><i></i><i></i></b>`;

export function showFounderWelcome(w: World, onClose: () => void) {
  const el = byId('offline-panel');
  let ask = '';
  const close = () => {
    el.classList.add('hidden');
    audio.ui('ui_close');
    onClose();
  };
  const draw = () => {
    const title = ARENA_TITLES[FOUNDER_TITLE]?.name ?? '';
    const rows = founderMounts()
      .map((id) => {
        const m = MOUNTS[id];
        const btn =
          ask === id
            ? `<button class="danger" data-f="ok" data-v="${id}">${L('Confirmar (definitivo)', 'Confirm (permanent)')}</button><button data-f="back">${L('Voltar', 'Back')}</button>`
            : `<button class="primary" data-f="ask" data-v="${id}">${L('Escolher', 'Choose')}</button>`;
        return `<div class="rep-row mount-pick${ask === id ? ' sel' : ''}">${mountThumb(id, 96)}<div><b>${escapeHtml(m.name)}</b><div class="muted"><small>${escapeHtml(m.desc)}</small></div>${btn}</div></div>`;
      })
      .join('');
    el.innerHTML = `<div class="card"><h2>${L('Bem-vindo de volta, Fundador', 'Welcome back, Founder')}</h2>
      <small class="muted">${L('Obrigado por jogar a primeira versão do jogo. Como lembrança, você recebe:', 'Thank you for playing the first version of the game. As a keepsake, you get:')}</small>
      <div class="rep-row"><span>${L('Título', 'Title')}</span>${titleFxHtml(title)}</div>
      <div class="rep-row"><span>${L('Experiência', 'Experience')}</span><b>${L(`em dobro até o nível ${FOUNDER_XP_UNTIL}`, `doubled up to level ${FOUNDER_XP_UNTIL}`)}</b></div>
      <div class="rep-row"><span>${L('Ouro', 'Gold')}</span><b>${L(`em dobro até o nível ${FOUNDER_GOLD_UNTIL}`, `doubled up to level ${FOUNDER_GOLD_UNTIL}`)}</b></div>
      <h4>${L('Escolha sua montaria (definitivo)', 'Choose your mount (permanent)')}</h4>
      <small class="muted">${L('Vale desde o nível 1: monte pelo botão do cavalo, fora de combate.', 'Works from level 1: mount with the horse button, out of combat.')}</small>
      ${rows}
      <button data-f="later">${L('Escolher depois (no Cavalariço Ma)', 'Choose later (at Stablemaster Ma)')}</button></div>`;
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const f = b.dataset.f,
      v = b.dataset.v ?? '';
    if (f === 'ask') ask = v;
    else if (f === 'back') ask = '';
    else if (f === 'ok') {
      if (chooseFounderMount(w, v)) audio.ui('ui_open');
      el.onclick = null;
      return close();
    } else if (f === 'later') {
      el.onclick = null;
      return close();
    }
    audio.ui('ui_click');
    draw();
  };
  draw();
  el.classList.remove('hidden');
  audio.ui('ui_open');
}
