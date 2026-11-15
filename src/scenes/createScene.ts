import Phaser from 'phaser';
import type { GameMap } from '../core/map';
import type { SaveData } from '../core/types';
import { World } from '../core/world';
import { clearSave } from '../save';
import { showCreateScreen } from '../ui/create';

export class CreateScene extends Phaser.Scene {
  constructor() { super('Create'); }
  create(data: { save?: SaveData }) {
    const maps = this.registry.get('maps') as Record<string, GameMap>;
    const start = (world: World) => this.scene.start('Game', { world });
    showCreateScreen(
      data.save,
      (name, classId) => { void clearSave(); start(World.create(maps, name, classId)); },
      () => start(World.fromSave(maps, data.save!)),
    );
  }
}
