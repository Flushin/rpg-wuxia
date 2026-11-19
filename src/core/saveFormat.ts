// Versões do save e migrações (etapa C8). Sem DOM: usado pelo núcleo, pelo save (IndexedDB) e pelos testes.
//
// Há DOIS números de versão, de coisas diferentes:
// - SAVE_FILE_VERSION: o arquivo inteiro guardado no aparelho (os 4 espaços de personagem + último jogado).
//   1 = formato antigo, um personagem só (chave 'rpg-save-v1'); 2 = espaços (chave 'rpg-saves-v2'). Ver core/saves.ts.
// - CHARACTER_SAVE_VERSION: um personagem (SaveData). Sobe quando o formato do personagem mudar de um jeito que
//   precise de conversão; aí entra uma função em CHARACTER_MIGRATIONS que leva da versão anterior para a nova.
//
// Campos novos e opcionais NÃO precisam de versão nova: a leitura (world/saveCodec.ts → restore) já corrige o que
// falta ou vem estranho. Migração é para quando um campo muda de sentido, de nome ou de formato.

export const SAVE_FILE_VERSION = 2;
export const CHARACTER_SAVE_VERSION = 2;

type RawSave = Record<string, unknown>;

/**
 * Migrações do personagem: a função na chave N leva um save da versão N para a N+1.
 * Ex.: { 1: (s) => ({ ...s, novoCampo: converter(s.campoVelho) }) } quando CHARACTER_SAVE_VERSION virar 2.
 */
export const CHARACTER_MIGRATIONS: Record<number, (s: RawSave) => RawSave> = {
  // 1 → 2 (nível máximo 20 → 30, decidido pelo Lucas em 19/11/2026): quem estava no antigo nível máximo (20)
  // continua no 20 com a barra do 21 em 0%. A XP guardada não vira níveis.
  1: (s) => (Number(s.level) >= 20 ? { ...s, level: 20, xp: 0 } : s),
};

/**
 * Leva um personagem salvo (de qualquer versão) até a atual, aplicando as migrações em ordem.
 * Sem número de versão = 1 (os primeiros saves). Save de versão MAIOR que a atual (app mais novo em outro
 * aparelho) não é mexido: os campos desconhecidos são ignorados na leitura.
 */
export function migrateCharacter<T extends object>(
  raw: T,
  migrations: Record<number, (s: RawSave) => RawSave> = CHARACTER_MIGRATIONS,
  current = CHARACTER_SAVE_VERSION,
): T {
  let s = { ...(raw as RawSave) };
  let v = Math.floor(Number(s.version)) || 1;
  if (v > current) return raw;
  while (v < current) {
    const step = migrations[v];
    if (step) s = step(s);
    v++;
  }
  s.version = current;
  return s as T;
}
