// Texto "O que há de novo" da Play Store, gerado de src/data/novidades.json (pt-BR e en-US, no formato que o
// Play Console aceita colar). Uso: npm run novidades:loja [-- 0.2.0]   (sem versão = a do package.json)
import { readFileSync } from 'node:fs';
import en from '../src/data/en.json';
import { LOJA_LIMITE, NOVIDADES, textoLoja } from '../src/core/novidades';

const versao = process.argv[2] ?? (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const i = NOVIDADES.versoes.findIndex((v) => v.versao === versao);
if (i < 0) {
  console.error(`Sem novidades para a versão ${versao} em src/data/novidades.json.`);
  process.exit(1);
}
const pt = textoLoja(NOVIDADES.versoes[i].itens.map((n) => n.texto));
const ing = textoLoja(((en.novidades.versoes[i]?.itens ?? []) as { texto: string }[]).map((n) => n.texto));
console.log(`<pt-BR>\n${pt}\n</pt-BR>\n<en-US>\n${ing}\n</en-US>`);
for (const [l, t] of [
  ['pt-BR', pt],
  ['en-US', ing],
])
  console.error(`${l}: ${t.length}/${LOJA_LIMITE} caracteres${t.length > LOJA_LIMITE ? ' — ACIMA DO LIMITE' : ''}`);
