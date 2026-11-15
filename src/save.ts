import { get, set, del } from 'idb-keyval';
import { deleteSlot as dropSlot, emptySaveFile, migrateSaves, setSlot, type SaveFile } from './core/saves';
import type { SaveData } from './core/types';

const KEY = 'rpg-saves-v2', LEGACY_KEY = 'rpg-save-v1';
let file: SaveFile = emptySaveFile();
let active = -1;

// Carrega tudo; migra o save antigo (personagem único) para o espaço 0 sem perder o original até gravar o novo.
export async function loadAll(): Promise<SaveFile> {
  const [cur, legacy] = await Promise.all([get(KEY).catch(() => undefined), get(LEGACY_KEY).catch(() => undefined)]);
  file = migrateSaves(cur, legacy);
  if (!cur && legacy) { await set(KEY, file); await del(LEGACY_KEY); }
  return file;
}
export const currentFile = () => file;
export const setActiveSlot = (i: number) => { active = i; };
export const activeSlot = () => active;
// grava o personagem ativo (e o marca como último jogado)
export const writeSave = (s: SaveData) => {
  if (active < 0) return Promise.resolve();
  file = setSlot(file, active, s);
  return set(KEY, file);
};
export const deleteSlot = (i: number) => { file = dropSlot(file, i); return set(KEY, file); };
