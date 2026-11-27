import { L } from '../core/i18n';
import { closeX } from './labels';
import { escapeHtml } from './dom';
import { audio } from '../render/audio';
// Textos das licenças: os mesmos arquivos guardados como prova em docs/licencas/ (uma fonte só; o Vite embute o texto).
import phaserLicense from '../../docs/licencas/phaser-3.90.0-LICENSE.md?raw';
import eventemitterLicense from '../../docs/licencas/eventemitter3-5.0.4-LICENSE.txt?raw';
import idbHeader from '../../docs/licencas/idb-keyval-6.3.0-LICENCE.txt?raw';
import apacheLicense from '../../docs/licencas/Apache-2.0.txt?raw';
import capacitorLicense from '../../docs/licencas/capacitor-8.6.2-LICENSE.txt?raw';
import capacitorPluginsLicense from '../../docs/licencas/capacitor-plugins-app-haptics-status-bar-LICENSE.txt?raw';
import capacitorFilesystemLicense from '../../docs/licencas/capacitor-filesystem-8.1.5-LICENSE.txt?raw';
import ionFilesystemLicense from '../../docs/licencas/ionfilesystem-android-1.1.1-LICENSE.txt?raw';
import cordovaNotice from '../../docs/licencas/cordova-android-14.0.1-NOTICE.txt?raw';
import robotoLicense from '../../docs/licencas/roboto-5.3.0-OFL.txt?raw';

// Créditos e licenças: aberto em ⚙ (no jogo) e no link da tela inicial. Fica no <body> (fora do HUD) para funcionar
// nas duas telas. Créditos de assets CC0 são cortesia; os avisos MIT/Apache-2.0 das bibliotecas são obrigatórios.
// Ao mudar algo aqui, mude também ASSETS_LICENCAS.md e os CREDITS.txt de public/.

interface Credit {
  what: string;
  who: string;
  license: string;
}

const CC0 = L('CC0 (domínio público)', 'CC0 (public domain)');
const CCBY4 = 'CC-BY 4.0 (creativecommons.org/licenses/by/4.0)';

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
    what: L('Efeitos sonoros de combate', 'Combat sound effects'),
    who: 'CYBERDEViL, VishwaJai, Spring Spring, JaggedStone, pauliuw (OpenGameArt.org); stephan (Wikimedia Commons)',
    license: CC0,
  },
  {
    what: L('Sons de itens, forja, missões e ações', 'Item, forge, quest and action sounds'),
    who: 'Mateusz_Chenc, Err0rC0de, mrickey13, ValentinPetiteau, michorvath, ralph.whitehead, Mr._Fritz_, Wagna, Q.K., Raclure, EntoClash, Selector, UnderASpell (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons da interface e do portal', 'Interface and portal sounds'),
    who: 'NenadSimic, LilMati, tia666, marcusgar (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons de subir de nível e de gastar pontos', 'Level-up and point sounds'),
    who: 'qubodup, Breviceps, hollandm (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons dos chefes (arena, fúria, invocação e vitória)', 'Boss sounds (arena, enrage, summon and victory)'),
    who: 'SoundsExciting, Robson220pl, adharca, qubodup (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons das skills das classes', 'Class skill sounds'),
    who: 'gulfstreamav, CAT-FOX_ALEX, mateusboga, nekoninja, ElevatorFan2020, lotteria001, PanxoZerok, qubodup, rafaelzimrp, joseph.larralde, GrimGrum, pfranzen, spookymodem (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons do escudo (golpe absorvido e quebra)', 'Shield sounds (absorbed hit and break)'),
    who: 'AudioPapkin, unfa (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Sons do golpe em área dos chefes (aviso e impacto)', 'Boss area strike sounds (warning and impact)'),
    who: 'Lynx_5969, AudioPapkin (Freesound.org)',
    license: CC0,
  },
  {
    what: L(
      'Sons do ataque de cada classe (disparo, acerto e crítico)',
      'Class attack sounds (shot, hit and critical)',
    ),
    who: 'SypherZent, ethanchase7744, maatre, Abacagi, DustyWind, giwake, InMotionAudio, kylepyke, ihitokage (Freesound.org); rubberduck (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Sons de ataque dos monstros', 'Monster attack sounds'),
    who: 'Mrthenoronha, GaussTheWizard, Ali_6868, CamoMano, LilMati, Christopherderp, Sadiquecat, erkanozan, TheKingOfGeeks360, qubodup, mark205, AudioPapkin, Nightflame, el_boss, julianmateo_, PrdiChlp (Freesound.org)',
    license: CC0,
  },
  {
    what: L('Música da cidade: "Hot Springs Town"', 'Town music: "Hot Springs Town"'),
    who: 'Kistol (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Música da floresta: "Bamboo Blitz"', 'Forest music: "Bamboo Blitz"'),
    who: 'Tsorthan Grove (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Música das ruínas: "Ancient Temple"', 'Ruins music: "Ancient Temple"'),
    who: 'Umplix (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L(
      'Músicas da montanha e do pico: "Harmony in the Mists" e "Kingdom of Icereach"',
      'Mountain and peak music: "Harmony in the Mists" and "Kingdom of Icereach"',
    ),
    who: 'Tsorthan Grove (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Música do Desfiladeiro do Gelo Eterno: "Frozen Desert"', 'Eternal Ice Gorge music: "Frozen Desert"'),
    who: 'Dizzy Crow (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L(
      'Músicas do Mosteiro Profanado e do Covil dos Bandidos: "Epic Endgame Cinematic" e "Battle Theme A"',
      'Defiled Monastery and Bandit Lair music: "Epic Endgame Cinematic" and "Battle Theme A"',
    ),
    who: 'cynicmusic (OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L('Música do Trial: "Epic Boss Battle"', 'Trial music: "Epic Boss Battle"'),
    who: 'Juhani Junkala (SubspaceAudio, OpenGameArt.org)',
    license: CC0,
  },
  {
    what: L(
      'Música do Porto Noturno: "Samurai Nights" (volume igualado)',
      'Night Harbor music: "Samurai Nights" (volume matched)',
    ),
    who: 'Majadroid — Maik Hoffmann (majadroid.com, OpenGameArt.org)',
    license: CCBY4,
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
  {
    name: L('Fonte Roboto 5.3.0 (letra no iPhone)', 'Roboto font 5.3.0 (text on iPhone)'),
    notice: '© 2011 The Roboto Project Authors',
    license: 'SIL Open Font License 1.1',
    text: robotoLicense,
  },
  { name: 'Capacitor 8.6.2', notice: '© 2017-present Drifty Co.', license: 'MIT', text: capacitorLicense },
  {
    name: 'Capacitor App 8.1.2, Haptics 8.0.2, Status Bar 8.0.4',
    notice: '© 2020-present Ionic',
    license: 'MIT',
    text: capacitorPluginsLicense,
  },
  { name: 'Capacitor Filesystem 8.1.5', notice: '© 2025 Ionic', license: 'MIT', text: capacitorFilesystemLicense },
  // Bibliotecas nativas que entram no APK (Android), puxadas pelo Capacitor e pelos plugins. Ver docs/licencas/README.md.
  { name: 'ionfilesystem-android 1.1.1', notice: '© 2025 Ionic', license: 'MIT', text: ionFilesystemLicense },
  {
    name: 'Apache Cordova Android 14.0.1',
    notice: '© 2015-2020 The Apache Software Foundation',
    license: 'Apache License 2.0',
    text: `${cordovaNotice.trim()}\n\n${apacheLicense}`,
  },
  {
    name: 'AndroidX (appcompat, core, core-splashscreen, activity, fragment, coordinatorlayout, webkit)',
    notice: '© The Android Open Source Project',
    license: 'Apache License 2.0',
    text: apacheLicense,
  },
  {
    name: 'Kotlin standard library, kotlinx.coroutines 1.10.2',
    notice: '© JetBrains s.r.o. and Kotlin Programming Language contributors',
    license: 'Apache License 2.0',
    text: apacheLicense,
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
