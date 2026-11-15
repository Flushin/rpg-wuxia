import { get, set, del } from 'idb-keyval';
import type { SaveData } from './core/types';

const KEY = 'rpg-save-v1';
export const loadSave = () => get<SaveData>(KEY);
export const writeSave = (s: SaveData) => set(KEY, s);
export const clearSave = () => del(KEY);
