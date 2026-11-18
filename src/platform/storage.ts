// Onde fica o save dos personagens. Web: IndexedDB (idb-keyval).
// Nativo (D2): arquivo JSON via @capacitor/filesystem, com gravação atômica e 1 backup.
// Só guarda e lê valores; as regras (repetir leitura, bloquear gravação antes de ler) ficam em src/save.ts.
import { del, get, set } from 'idb-keyval';

export interface SaveStorage {
  /** undefined se a chave não existe; rejeita se o armazenamento não puder ser lido. */
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

const indexedDbStorage: SaveStorage = {
  read: (key) => get(key),
  write: (key, value) => set(key, value),
  remove: (key) => del(key),
};

export const saveStorage: SaveStorage = indexedDbStorage;
