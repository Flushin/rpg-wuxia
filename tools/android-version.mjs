// Grava versionName/versionCode em android/app/build.gradle a partir da version do package.json.
// versionCode = MAJOR*10000 + MINOR*100 + PATCH (0.1.0 -> 100). Idempotente. Ver docs/android.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '');
if (!m) throw new Error(`version inválida no package.json: ${version}`);
const [major, minor, patch] = m.slice(1).map(Number);
if (minor > 99 || patch > 99) throw new Error('minor e patch precisam ser <= 99 para o versionCode');
const code = major * 10000 + minor * 100 + patch;

const gradle = join(root, 'android', 'app', 'build.gradle');
let src = readFileSync(gradle, 'utf8');
if (!/versionCode\s+\d+/.test(src) || !/versionName\s+"[^"]*"/.test(src)) {
  throw new Error('versionCode/versionName não encontrados em ' + gradle);
}
src = src
  .replace(/versionCode\s+\d+/, `versionCode ${code}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradle, src);
console.log(`android: versionName ${version}, versionCode ${code}`);
