import Phaser from 'phaser';
import { L, LANG } from './core/i18n';
import { BootScene } from './scenes/bootScene';
import { CreateScene } from './scenes/createScene';
import { GameScene } from './scenes/gameScene';

// Texto fixo do index.html (os ids ficam em português no HTML; aqui entra o idioma escolhido).
function applyStaticText() {
  document.documentElement.lang = LANG === 'en' ? 'en' : 'pt-BR';
  const txt = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const attr = (id: string, a: string, v: string) => document.getElementById(id)?.setAttribute(a, v);
  txt('sub-slots', L('Escolha seu personagem', 'Choose your character'));
  txt('sub-create', L('Criar personagem', 'Create character'));
  txt('lbl-name', L('Nome', 'Name'));
  txt('lbl-sect', L('Seita', 'Sect'));
  attr('char-name', 'placeholder', L('Seu nome', 'Your name'));
  txt('btn-start', L('Começar jornada', 'Start journey'));
  txt('btn-back', L('Voltar', 'Back'));
  attr('del-name', 'placeholder', L('Digite o nome do personagem', 'Type the character name'));
  txt('btn-del-ok', L('Apagar personagem', 'Delete character'));
  txt('btn-del-cancel', L('Cancelar', 'Cancel'));
  attr('btn-auto-cfg', 'aria-label', L('Menu do auto-combate', 'Auto-battle menu'));
  attr('btn-settings', 'aria-label', L('Configurações', 'Settings'));
  const attrs = document.getElementById('btn-attrs');
  if (attrs?.firstChild) attrs.firstChild.textContent = L('Atributos (C)', 'Attributes (C)');
  txt('btn-bag', L('Mochila (I)', 'Bag (I)'));
  txt('dur-warn', `⚠ ${L('Reparar', 'Repair')}`);
  attr('dur-warn', 'aria-label', L('Equipamento com pouca durabilidade', 'Equipment low on durability'));
  attr('pot-hp', 'aria-label', L('Poção de vida', 'Health potion'));
  attr('pot-mp', 'aria-label', L('Poção de mana', 'Mana potion'));
  txt('btn-attack', L('Atacar', 'Attack'));
  txt('tip-ok', L('Entendi', 'Got it'));
}
applyStaticText();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10141c',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { activePointers: 3 },
  disableContextMenu: true,
  scene: [BootScene, CreateScene, GameScene],
});
