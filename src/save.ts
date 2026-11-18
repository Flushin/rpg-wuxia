import { saveStorage } from './platform/storage';
import { deleteSlot as dropSlot, emptySaveFile, migrateSaves, setSlot, type SaveFile } from './core/saves';
import type { SaveData } from './core/types';

const KEY = 'rpg-saves-v2',
  LEGACY_KEY = 'rpg-save-v1';
// Leitura: o IndexedDB do iPhone às vezes falha uma vez ("Connection to Indexed Database server lost") e funciona na seguinte.
const READ_ATTEMPTS = 3;
const READ_RETRY_MS = 300;

let file: SaveFile = emptySaveFile();
let active = -1;
// Só grava depois de uma leitura bem-sucedida. Antes disso, gravar trocaria os personagens que não foram lidos
// por um arquivo vazio (era assim até a auditoria de 17/11/2026: falha de leitura virava "não há personagens").
let loaded = false;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readWithRetry(key: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await saveStorage.read(key);
    } catch (err) {
      if (attempt >= READ_ATTEMPTS) throw err;
      await wait(READ_RETRY_MS);
    }
  }
}

/**
 * Carrega todos os personagens; migra o save antigo (personagem único) para o espaço 0 sem perder o original até gravar o novo.
 * Se o armazenamento não puder ser lido, REJEITA (não devolve "vazio"): quem chama mostra o erro e não deixa gravar.
 */
export async function loadAll(): Promise<SaveFile> {
  const [cur, legacy] = await Promise.all([readWithRetry(KEY), readWithRetry(LEGACY_KEY)]);
  file = migrateSaves(cur, legacy);
  loaded = true;
  if (!cur && legacy) {
    await saveStorage.write(KEY, file);
    await saveStorage.remove(LEGACY_KEY);
  }
  return file;
}

function assertLoaded() {
  if (!loaded) throw new Error('save: gravação bloqueada porque os personagens não foram lidos');
}

export const currentFile = () => file;
export const setActiveSlot = (i: number) => {
  active = i;
};
export const activeSlot = () => active;

// grava o personagem ativo (e o marca como último jogado)
export const writeSave = async (s: SaveData) => {
  if (active < 0) return;
  assertLoaded();
  file = setSlot(file, active, s);
  await saveStorage.write(KEY, file);
};

export const deleteSlot = async (i: number) => {
  assertLoaded();
  file = dropSlot(file, i);
  await saveStorage.write(KEY, file);
};
