// Lógica do servidor do save na nuvem (roadmap M0: protótipo do backend). Igual para Supabase e Firebase: cada um só
// faz a parte de banco e de login e chama estas funções. Empacotada junto com o core por tools/backend-build.mjs.
//
// Regras (proposta para o M1; nada disto está ligado no jogo ainda):
// - o relógio é SEMPRE o do servidor: o lastSeen que o aparelho manda é ignorado;
// - ao ABRIR o personagem, o servidor aplica o ganho offline com o relógio dele (applyOfflineOnServer);
// - ao SALVAR, o servidor confere a plausibilidade contra o save anterior (XP, ouro, nível de item) e só MARCA
//   o envio como suspeito, sem bloquear (E4c começa assim);
// - cada save guardado leva versão (sobe 1 a cada envio) e checksum (SHA-256 do JSON).
import {
  CHARACTER_SAVE_VERSION,
  QUESTS,
  World,
  applyOfflineOnServer,
  fixedClock,
  loadBundledMaps,
  migrateCharacter,
  plausibility,
  PROGRESSION,
  type GameMap,
  type OfflineReport,
  type SaveData,
} from '../../src/core/headless';

export { CHARACTER_SAVE_VERSION } from '../../src/core/headless';

/** Uma linha guardada no banco (tabela characters / documento characters/{slot}). */
export interface StoredCharacter {
  slot: number;
  save: SaveData;
  /** sobe 1 a cada envio aceito (base para a tela de conflito do M1) */
  version: number;
  checksum: string;
  /** relógio do servidor (ms) na última gravação */
  serverSavedAt: number;
  /** motivos de suspeita do último envio ([] = normal) */
  flags: string[];
}

let maps: Record<string, GameMap> | null = null;
const getMaps = () => (maps ??= loadBundledMaps());

/** SHA-256 em hexadecimal (Web Crypto: existe no Deno, no Node 20+ e no navegador). */
export async function checksum(save: SaveData): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(save));
  const h = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** XP total acumulada desde o nível 1 (nível + XP dentro do nível). */
export function totalXp(level: number, xp: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += PROGRESSION.xpToNext[l - 1] ?? 0;
  return t + xp;
}

/** Saneia um save vindo do aparelho passando pelo core (o mesmo que o jogo faz ao carregar), sem ganho offline. */
export function sanitize(raw: unknown, serverNow: number): SaveData {
  const migrated = migrateCharacter(raw as object) as SaveData;
  const w = World.fromSave(getMaps(), migrated, serverNow, false, fixedClock(serverNow));
  return w.serialize();
}

type Limit = { xpPerHour: number; goldPerHour: number; maxItemLevel: number };
const limitFor = (level: number): Limit =>
  (plausibility.perLevel as unknown as Record<string, Limit>)[String(Math.max(1, Math.min(20, level)))];

/** Confere um envio contra o anterior. Devolve os motivos de suspeita ([] = plausível). */
export function plausibilityFlags(prev: StoredCharacter | null, next: SaveData, serverNow: number): string[] {
  const flags: string[] = [];
  const items = [...(next.bag ?? []), ...Object.values(next.equipment ?? {})].filter(Boolean);
  const lim = limitFor(next.level);
  const maxIlvl = Math.max(0, ...items.map((it) => it!.ilvl ?? 1));
  if (maxIlvl > lim.maxItemLevel) flags.push(`item nível ${maxIlvl} > ${lim.maxItemLevel}`);
  if (!prev) {
    // primeiro envio (migração do save local, E3a): só confere o que não depende do tempo
    if (next.level > 20) flags.push('nível acima do máximo');
    return flags;
  }
  const hours = Math.max(0, serverNow - prev.serverSavedAt) / 3_600_000;
  // folga fixa de 2 min de jogo para envios muito próximos
  const h = hours + 2 / 60;
  const fast = limitFor(Math.max(prev.save.level, next.level));
  const questFrom = prev.save.quest?.stage ?? 0,
    questTo = next.quest?.stage ?? 0;
  const quests = QUESTS.slice(Math.max(0, questFrom), Math.max(0, questTo));
  const questXp = quests.reduce((a, q) => a + (q.reward.xp ?? 0), 0);
  const questGold = quests.reduce((a, q) => a + (q.reward.gold ?? 0), 0);
  const dXp = totalXp(next.level, next.xp) - totalXp(prev.save.level, prev.save.xp);
  const dGold = (next.gold ?? 0) - (prev.save.gold ?? 0);
  if (dXp > fast.xpPerHour * h + questXp) flags.push(`XP +${dXp} em ${hours.toFixed(2)} h`);
  if (dGold > fast.goldPerHour * h + questGold) flags.push(`ouro +${dGold} em ${hours.toFixed(2)} h`);
  if (dXp < 0) flags.push('XP voltou para trás');
  if (questTo < questFrom) flags.push('missão voltou para trás');
  return flags;
}

/** Envio do aparelho: saneia, confere, carimba com o relógio do servidor e devolve a linha a gravar. */
export async function acceptUpload(
  prev: StoredCharacter | null,
  slot: number,
  raw: unknown,
  serverNow: number,
): Promise<StoredCharacter> {
  const save = sanitize(raw, serverNow);
  const flags = plausibilityFlags(prev, save, serverNow);
  return {
    slot,
    save,
    version: (prev?.version ?? 0) + 1,
    checksum: await checksum(save),
    serverSavedAt: serverNow,
    flags,
  };
}

/** Abrir o personagem: aplica o ganho offline com o relógio do servidor (só o último personagem jogado recebe). */
export async function openCharacter(
  stored: StoredCharacter,
  serverNow: number,
  applyOffline: boolean,
): Promise<{ row: StoredCharacter; offline: OfflineReport | null }> {
  // o tempo offline conta da última gravação NO SERVIDOR, não do lastSeen do aparelho
  const base = { ...stored.save, lastSeen: stored.serverSavedAt };
  if (!applyOffline) return { row: stored, offline: null };
  const r = applyOfflineOnServer(getMaps(), base, fixedClock(serverNow));
  const row: StoredCharacter = {
    ...stored,
    save: r.save,
    version: stored.version + 1,
    checksum: await checksum(r.save),
    serverSavedAt: serverNow,
  };
  return { row, offline: r.offline };
}
