import { L } from '../core/i18n';
import { closeX } from './labels';
import { escapeHtml } from './dom';
import { audio } from '../render/audio';
// Textos das licenças: os mesmos arquivos guardados como prova em docs/licencas/ (uma fonte só; o Vite embute o texto).
import phaserLicense from '../../docs/licencas/phaser-3.90.0-LICENSE.md?raw';
import eventemitterLicense from '../../docs/licencas/eventemitter3-5.0.4-LICENSE.txt?raw';
import idbHeader from '../../docs/licencas/idb-keyval-6.3.0-LICENCE.txt?raw';
import apacheLicense from '../../docs/licencas/Apache-2.0.txt?raw';

// Créditos e licenças: aberto em ⚙ (no jogo) e no link da tela inicial. Fica no <body> (fora do HUD) para funcionar
// nas duas telas. Créditos de assets CC0 são cortesia; os avisos MIT/Apache-2.0 das bibliotecas são obrigatórios.
// Ao mudar algo aqui, mude também ASSETS_LICENCAS.md e os CREDITS.txt de public/.

interface Credit {
  what: string;
  who: string;
  license: string;
}

const CC0 = L('CC0 (domínio público)', 'CC0 (public domain)');

const ART: Credit[] = [
  {
    what: L(
      'Personagens, NPCs, bandidos e guerreiros de terracota (modelos 3D recoloridos)',
      'Characters, NPCs, bandits and terracotta warriors (recolored 3D models)',
    ),
    who: 'KayKit Adventurers Character Pack — Kay Lousberg (kaylousberg.com)',
    license: CC0,
  },
  {
    what: L('Lobo (modelo 3D)', 'Wolf (3D model)'),
    who: 'Ultimate Animated Animal Pack — Quaternius (quaternius.com)',
    license: CC0,
  },
  {
    what: L(
      'Árvores, pedras, plantas e flores (modelos 3D recoloridos)',
      'Trees, rocks, plants and flowers (recolored 3D models)',
    ),
    who: 'Nature Kit — Kenney (kenney.nl)',
    license: CC0,
  },
];

const SOUND: Credit[] = [
  {
    what: L('Efeitos sonoros', 'Sound effects'),
    who: 'RPG Audio, Impact Sounds, UI Audio — Kenney (kenney.nl)',
    license: CC0,
  },
  {
    what: L('Música da cidade: "Oriental"', 'Town music: "Oriental"'),
    who: 'Shadowfire452 (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Música da floresta: "Asian/Oriental 1"', 'Forest music: "Asian/Oriental 1"'),
    who: 'Tozan (OpenGameArt.org)',
    license: CC0,
  },
];

interface Library {
  name: string;
  notice: string;
  license: string;
  text: string;
}

const LIBRARIES: Library[] = [
  { name: 'Phaser 3.90.0', notice: '© 2024 Richard Davey, Phaser Studio Inc.', license: 'MIT', text: phaserLicense },
  { name: 'eventemitter3 5.0.4', notice: '© 2014 Arnout Kazemier', license: 'MIT', text: eventemitterLicense },
  {
    name: 'idb-keyval 6.3.0',
    notice: '© 2016 Jake Archibald',
    license: 'Apache License 2.0',
    text: `${idbHeader.trim()}\n\n${apacheLicense}`,
  },
];

const creditList = (items: Credit[]) =>
  `<ul class="cr-list">${items
    .map(
      (c) => `<li><b>${escapeHtml(c.what)}</b><br>${escapeHtml(c.who)} · <span class="muted">${c.license}</span></li>`,
    )
    .join('')}</ul>`;

export class CreditsPanel {
  private el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'credits-panel';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.onclick = (e) => {
      const t = (e.target as HTMLElement).closest('[data-act="close"]');
      if (t || e.target === this.el) this.close();
    };
    // Esc fecha (no jogo, o Esc do HUD também roda; não tem problema)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    audio.ui('ui_open');
    this.el.innerHTML = `<div class="card">${closeX('data-act="close"')}<h2>${L('Créditos e licenças', 'Credits and licenses')}</h2>
      <p>${L('Jogo criado por <b>Lucas Silva</b>.', 'Game made by <b>Lucas Silva</b>.')}</p>
      <h3>${L('Arte', 'Art')}</h3>
      ${creditList(ART)}
      <p class="muted">${L(
        'Os modelos 3D foram renderizados em sprites para o jogo. Casas, ruínas, portais, pisos, ícones e o ícone do app foram criados para o jogo.',
        'The 3D models were rendered into sprites for the game. Houses, ruins, portals, floors, icons and the app icon were made for the game.',
      )}</p>
      <h3>${L('Som', 'Sound')}</h3>
      ${creditList(SOUND)}
      <h3>${L('Software de terceiros', 'Third-party software')}</h3>
      <p class="muted">${L(
        'Toque em uma biblioteca para ver o texto completo da licença.',
        'Tap a library to see the full license text.',
      )}</p>
      ${LIBRARIES.map(
        (b) =>
          `<details class="cr-lib"><summary><b>${escapeHtml(b.name)}</b> — ${escapeHtml(b.notice)} · ${b.license}</summary><pre>${escapeHtml(b.text.trim())}</pre></details>`,
      ).join('')}
      <p class="muted">${L(
        'CC0 = os autores abriram mão dos direitos; o crédito aqui é um agradecimento.',
        'CC0 = the authors waived their rights; the credit here is a thank-you.',
      )}</p>
      <button class="primary" data-act="close">${L('Fechar', 'Close')}</button></div>`;
    this.el.classList.remove('hidden');
    this.el.scrollTop = 0;
  }

  close() {
    if (!this.isOpen) return;
    this.el.classList.add('hidden');
    audio.ui('ui_close');
  }
}

/** Uma janela só para o jogo todo (tela inicial e ⚙ usam a mesma). */
let instance: CreditsPanel | null = null;
export const credits = () => (instance ??= new CreditsPanel());
