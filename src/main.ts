import Phaser from 'phaser';
import { BootScene } from './scenes/bootScene';
import { CreateScene } from './scenes/createScene';
import { GameScene } from './scenes/gameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10141c',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { activePointers: 3 },
  disableContextMenu: true,
  scene: [BootScene, CreateScene, GameScene],
});
