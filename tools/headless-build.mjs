// Gera o core headless (roadmap M0, E1c): dist-headless/mistpeak-core.mjs para Node/servidor e, com --browser,
// dist-headless/mistpeak-core.browser.mjs (o mesmo código para o Chromium do gabarito).
import { build } from 'esbuild';

const browser = process.argv.includes('--browser');
await build({
  entryPoints: ['src/core/headless.ts'],
  bundle: true,
  format: 'esm',
  platform: browser ? 'browser' : 'node',
  target: browser ? 'es2022' : 'node20',
  outfile: browser ? 'dist-headless/mistpeak-core.browser.mjs' : 'dist-headless/mistpeak-core.mjs',
  logLevel: 'error',
  legalComments: 'none',
});
