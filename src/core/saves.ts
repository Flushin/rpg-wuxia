import { L } from './i18n';
import type { SaveData } from './types';

export const SLOT_COUNT = 4;
export interface SaveFile {
  version: 2;
  slots: (SaveData | null)[];
  lastPlayedSlot: number;
}

export const emptySaveFile = (): SaveFile => ({ version: 2, slots: Array(SLOT_COUNT).fill(null), lastPlayedSlot: 0 });

const isSave = (s: unknown): s is SaveData =>
  !!s &&
  typeof s === 'object' &&
  typeof (s as SaveData).name === 'string' &&
  typeof (s as SaveData).classId === 'string';

// Aceita o formato novo (slots) ou um save antigo de personagem único (vira o espaço 0).
export function migrateSaves(raw: unknown, legacy?: unknown): SaveFile {
  const out = emptySaveFile();
  const r = raw as Partial<SaveFile> | undefined;
  if (r && Array.isArray(r.slots)) {
    for (let i = 0; i < SLOT_COUNT; i++) out.slots[i] = isSave(r.slots[i]) ? r.slots[i] : null;
    const l = Math.floor(Number(r.lastPlayedSlot));
    out.lastPlayedSlot =
      l >= 0 && l < SLOT_COUNT && out.slots[l]
        ? l
        : Math.max(
            0,
            out.slots.findIndex((s) => !!s),
          );
    return out;
  }
  const old = isSave(raw) ? raw : isSave(legacy) ? legacy : null;
  if (old) out.slots[0] = old;
  return out;
}

export function setSlot(f: SaveFile, i: number, s: SaveData | null, played = true): SaveFile {
  const slots = [...f.slots];
  slots[i] = s;
  return { version: 2, slots, lastPlayedSlot: played && s ? i : f.lastPlayedSlot };
}
export function deleteSlot(f: SaveFile, i: number): SaveFile {
  const n = setSlot(f, i, null, false);
  if (n.lastPlayedSlot === i)
    n.lastPlayedSlot = Math.max(
      0,
      n.slots.findIndex((s) => !!s),
    );
  return n;
}

// "há 2 h", "há 5 min", "agora"
export function relativeTime(ms: number, now = Date.now()): string {
  const d = Math.max(0, now - (Number(ms) || now)) / 1000;
  if (d < 60) return L('agora há pouco', 'just now');
  if (d < 3600) return L(`há ${Math.floor(d / 60)} min`, `${Math.floor(d / 60)} min ago`);
  if (d < 86400) return L(`há ${Math.floor(d / 3600)} h`, `${Math.floor(d / 3600)} h ago`);
  return L(`há ${Math.floor(d / 86400)} d`, `${Math.floor(d / 86400)} d ago`);
}
