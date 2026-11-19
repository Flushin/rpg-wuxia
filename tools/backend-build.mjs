// Empacota a lógica do servidor (backend/shared/saveSync.ts + core do jogo) para o protótipo do backend:
// - backend/supabase/functions/_shared/mistpeak-server.mjs (Edge Function, Deno)
// - backend/firebase/functions/lib/mistpeak-server.mjs (Cloud Functions, Node)
// Os arquivos gerados não vão para o repositório. Uso: npm run build:backend
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const outs = ['backend/supabase/functions/_shared', 'backend/firebase/functions/lib'];
for (const dir of outs) {
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: ['backend/shared/saveSync.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2022',
    outfile: `${dir}/mistpeak-server.mjs`,
    logLevel: 'error',
    legalComments: 'none',
  });
  // tipos mínimos para o editor/Deno (o código real é o .mjs acima)
  writeFileSync(
    `${dir}/mistpeak-server.d.ts`,
    `// gerado por tools/backend-build.mjs\n` +
      `export interface StoredCharacter { slot: number; save: any; version: number; checksum: string; serverSavedAt: number; flags: string[] }\n` +
      `export function acceptUpload(prev: StoredCharacter | null, slot: number, raw: unknown, serverNow: number): Promise<StoredCharacter>;\n` +
      `export function openCharacter(stored: StoredCharacter, serverNow: number, applyOffline: boolean): Promise<{ row: StoredCharacter; offline: any }>;\n` +
      `export function checksum(save: any): Promise<string>;\n` +
      `export const CHARACTER_SAVE_VERSION: number;\n`,
  );
}
console.log('backend: lógica do servidor empacotada em ' + outs.join(' e '));
