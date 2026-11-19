// Gera o gabarito do check:headless rodando os cenários DENTRO do Chromium (Playwright), com o core empacotado para o
// navegador. O check:headless (Node, na CI) compara o resultado do servidor com este arquivo.
// Rodar só quando uma regra do jogo mudar de propósito (o resultado esperado muda junto). Uso: npm run golden:headless
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

execFileSync(process.execPath, ['tools/headless-build.mjs', '--browser'], { stdio: 'inherit' });
const coreSrc = readFileSync('dist-headless/mistpeak-core.browser.mjs', 'utf8');
const scenSrc = readFileSync('tools/headless-scenarios.mjs', 'utf8');

// o Playwright não é dependência do projeto: usa o instalado na máquina (ex.: o do ambiente de nuvem)
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = createRequire('/usr/lib/node_modules/')('playwright');
}
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
const results = await page.evaluate(
  async ([c, s]) => {
    const url = (src) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const core = await import(url(c));
    const scen = await import(url(s));
    return scen.runScenarios(core);
  },
  [coreSrc, scenSrc],
);
const out = { browser: `Chromium ${browser.version()}`, generatedAt: new Date().toISOString().slice(0, 10), results };
await browser.close();
writeFileSync('tools/fixtures/headless-golden.json', JSON.stringify(out, null, 1) + '\n');
console.log(`gabarito gravado (${Object.keys(results).length} cenários, ${out.browser})`);
