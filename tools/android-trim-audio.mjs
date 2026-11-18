// APK menor (D6): o jogo pede cada som em .ogg e, se o navegador não tocar ogg, em .mp3 (render/audio.ts).
// O WebView do Android toca ogg, então os .mp3 que têm um .ogg ao lado saem da cópia do jogo dentro do APK.
// Roda depois do `npx cap sync android`. Não mexe em public/ nem em dist/.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'audio');
if (!existsSync(audioDir))
  throw new Error('pasta de áudio do APK não encontrada (rode npx cap sync android): ' + audioDir);

let removed = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.mp3') && existsSync(p.slice(0, -4) + '.ogg')) {
      bytes += statSync(p).size;
      rmSync(p);
      removed++;
    }
  }
};
walk(audioDir);
console.log(`android: ${removed} arquivos .mp3 fora do APK (${(bytes / 2 ** 20).toFixed(1)} MB)`);
