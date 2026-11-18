// Onde fica o save dos personagens.
// - Web: IndexedDB (idb-keyval).
// - App (Capacitor): um arquivo JSON por chave na pasta de dados do app, com gravação atômica e 1 backup.
//   No app o save não sofre o limite de 7 dias do Safari nem a limpeza do armazenamento do WebView.
// Só guarda e lê valores; as regras (repetir leitura, bloquear gravação antes de ler) ficam em src/save.ts.
import { del, get, set } from 'idb-keyval';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { isNative } from './index';

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

// Arquivos de uma chave: <chave>.json (o atual), .tmp (gravação em andamento) e .bak (a versão anterior).
// Gravar: escreve o .tmp inteiro → atual vira .bak → .tmp vira atual. Se o app morrer no meio, a leitura
// tenta atual → .tmp → .bak e fica com o primeiro que for um JSON completo.
const DIR = Directory.Data;
const files = (key: string) => ({ cur: `${key}.json`, tmp: `${key}.json.tmp`, bak: `${key}.json.bak` });

async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: DIR });
    return true;
  } catch {
    return false;
  }
}

async function deleteIfExists(path: string) {
  if (await exists(path)) await Filesystem.deleteFile({ path, directory: DIR });
}

async function readJson(path: string): Promise<{ ok: true; value: unknown } | { ok: false }> {
  if (!(await exists(path))) return { ok: false };
  const { data } = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 });
  try {
    return { ok: true, value: JSON.parse(data as string) };
  } catch {
    return { ok: false }; // arquivo cortado no meio da gravação
  }
}

const fileStorage: SaveStorage = {
  async read(key) {
    const f = files(key);
    for (const path of [f.cur, f.tmp, f.bak]) {
      const r = await readJson(path);
      if (r.ok) return r.value;
    }
    return undefined;
  },
  async write(key, value) {
    const f = files(key);
    await Filesystem.writeFile({ path: f.tmp, directory: DIR, data: JSON.stringify(value), encoding: Encoding.UTF8 });
    if (await exists(f.cur)) {
      await deleteIfExists(f.bak);
      await Filesystem.rename({ from: f.cur, to: f.bak, directory: DIR, toDirectory: DIR });
    }
    await Filesystem.rename({ from: f.tmp, to: f.cur, directory: DIR, toDirectory: DIR });
  },
  async remove(key) {
    const f = files(key);
    for (const path of [f.cur, f.tmp, f.bak]) await deleteIfExists(path);
  },
};

export const saveStorage: SaveStorage = isNative ? fileStorage : indexedDbStorage;
