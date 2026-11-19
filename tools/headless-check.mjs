// check:headless (roadmap M0, E1c): o core roda no servidor exatamente como no navegador.
// 1. o código de src/core não usa navegador, Phaser, Capacitor, Date.now() (fora do clock.ts) nem Math.random();
// 2. o pacote dist-headless/mistpeak-core.mjs carrega em Node puro (sem window, document, localStorage);
// 3. os cenários de tools/headless-scenarios.mjs dão o mesmo resultado duas vezes seguidas (determinismo) e
//    exatamente o resultado gravado pelo Chromium em tools/fixtures/headless-golden.json.
// Se o gabarito ficar desatualizado por uma mudança de regra de propósito: `npm run golden:headless` (precisa do
// Playwright com Chromium) e conferir a diferença no PR.
// Uso: npm run check:headless
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runScenarios } from './headless-scenarios.mjs';

let fails = 0;
const ok = (c, m) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};

// ---- 1. código-fonte do core
console.log('\n== src/core sem dependências de navegador ==');
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts')) files.push(p);
  }
};
walk('src/core');
// tira comentários de linha e de bloco (o suficiente para o código deste projeto)
const code = (p) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const offenders = (re, skip = []) =>
  files.filter((f) => !skip.includes(f.replaceAll('\\', '/')) && re.test(code(f))).map((f) => f.replaceAll('\\', '/'));
const dn = offenders(/Date\.now\s*\(/, ['src/core/clock.ts']);
ok(dn.length === 0, `Date.now() só no src/core/clock.ts${dn.length ? ` (achado em ${dn.join(', ')})` : ''}`);
const mr = offenders(/Math\.random\s*\(/);
ok(mr.length === 0, `sem Math.random() (sorteio só pelo Rng)${mr.length ? ` (achado em ${mr.join(', ')})` : ''}`);
const br = offenders(/\b(window|document|navigator|localStorage|sessionStorage|indexedDB)\b/);
ok(br.length === 0, `sem window/document/navigator/storage${br.length ? ` (achado em ${br.join(', ')})` : ''}`);
const im = offenders(/from\s+['"](\.\.\/)+(platform|ui|render|scenes)\b|from\s+['"](phaser|@capacitor|idb-keyval)/);
ok(
  im.length === 0,
  `sem imports de platform/ui/render/scenes/Phaser/Capacitor${im.length ? ` (${im.join(', ')})` : ''}`,
);

// ---- 2. pacote headless em Node puro
console.log('\n== pacote headless ==');
execFileSync(process.execPath, ['tools/headless-build.mjs'], { stdio: 'inherit' });
const bundlePath = 'dist-headless/mistpeak-core.mjs';
const bundle = readFileSync(bundlePath, 'utf8');
ok(!/phaser|@capacitor|idb-keyval/i.test(bundle), 'o pacote não inclui Phaser, Capacitor nem idb-keyval');
ok(bundle.length < 1_000_000, `o pacote é pequeno (${Math.round(bundle.length / 1024)} KB)`);
for (const g of ['window', 'document', 'navigator', 'localStorage'])
  ok(typeof globalThis[g] === 'undefined' || g === 'navigator', `Node sem ${g} (como no servidor)`);
const core = await import(pathToFileURL(bundlePath).href);
ok(typeof core.applyOfflineOnServer === 'function', 'o pacote exporta applyOfflineOnServer');

// ---- 3. cenários: determinismo e igualdade com o navegador
console.log('\n== cenários (relógio do servidor injetado) ==');
const a = runScenarios(core);
const b = runScenarios(core);
ok(JSON.stringify(a) === JSON.stringify(b), 'mesmo save + mesmo relógio = mesmo resultado (2 execuções)');
const fl = a['floresta-3h'];
ok(fl.offline && fl.offline.kills > 0 && fl.offline.xp > 0, `floresta 3 h: houve ganho (${fl.offline?.kills} abates)`);
ok(fl.save.lastSeen === 1_800_000_000_000, 'lastSeen do save = relógio do servidor (não o do aparelho)');
ok(a['relogio-voltou'].offline === null, 'relógio do servidor antes do lastSeen: nenhum ganho');
ok(
  Object.values(a).every((r) =>
    [...r.save.bag, ...r.merchant.offers.map((o) => o.item)].every((it) => !it || /^(srv-|[a-z]\d+$)/.test(it.uid)),
  ),
  'itens criados no servidor têm uid com prefixo "srv-"',
);

const goldenPath = 'tools/fixtures/headless-golden.json';
if (!existsSync(goldenPath)) ok(false, `gabarito ${goldenPath} não existe (rode npm run golden:headless)`);
else {
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  ok(golden.browser && /Chrom/i.test(golden.browser), `gabarito gerado no navegador (${golden.browser})`);
  for (const id of Object.keys(a)) {
    const same = JSON.stringify(a[id]) === JSON.stringify(golden.results?.[id]);
    ok(same, `${id}: Node idêntico ao navegador`);
    if (!same) {
      const x = JSON.stringify(a[id]),
        y = JSON.stringify(golden.results?.[id] ?? null);
      let i = 0;
      while (i < x.length && x[i] === y[i]) i++;
      console.error(
        `    primeira diferença no caractere ${i}:\n    node:      …${x.slice(Math.max(0, i - 60), i + 60)}\n    navegador: …${y.slice(Math.max(0, i - 60), i + 60)}`,
      );
    }
  }
}

console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
