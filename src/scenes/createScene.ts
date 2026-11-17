import Phaser from 'phaser';
import type { GameMap } from '../core/map';
import type { SaveFile } from '../core/saves';
import { World } from '../core/world';
import { currentFile, deleteSlot, setActiveSlot, writeSave } from '../save';
import { showTitleScreen } from '../ui/create';

// Tela inicial (4 espaços de personagem)
export class CreateScene extends Phaser.Scene {
  constructor() {
    super('Create');
  }
  create(data: { file?: SaveFile }) {
    const maps = this.registry.get('maps') as Record<string, GameMap>;
    const start = (world: World) => this.scene.start('Game', { world });
    showTitleScreen(
      data.file ?? currentFile(),
      {
        onPlay: (slot, isLast) => {
          setActiveSlot(slot);
          // ganho offline só para o último personagem jogado; os outros só atualizam o "último acesso" ao jogar
          start(World.fromSave(maps, currentFile().slots[slot]!, Date.now(), isLast));
        },
        onCreate: (slot, name, classId) => {
          setActiveSlot(slot);
          const w = World.create(maps, name, classId);
          void writeSave(w.serialize());
          start(w);
        },
        onDelete: async (slot) => {
          await deleteSlot(slot);
          return currentFile();
        },
      },
      (id) => maps[id]?.name ?? id,
    );
  }
}
