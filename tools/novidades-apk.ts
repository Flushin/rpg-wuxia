// Novidades acumuladas desde o último APK gerado, para a release do workflow "APK Android".
// Junta todas as versões de src/data/novidades.json mais novas que <ultima> (até a do package.json) e os itens de
// "proxima" ainda sem versão. Uso: npm run novidades:apk [-- 0.4.2]   (sem versão = desde o início)
// Saída: markdown (pt-BR e en-US) em stdout; o tamanho do texto da Play Store vai para stderr.
import { readFileSync } from 'node:fs';
import en from '../src/data/en.json';
import { LOJA_LIMITE, NOVIDADES, textoLoja, type Novidade } from '../src/core/novidades';

const num = (v: string) => v.split('.').map(Number);
const maior = (a: string, b: string) => {
  const [x, y] = [num(a), num(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

const ultima = process.argv[2] || '';
const atual = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const enData = en.novidades as { proxima: Novidade[]; versoes: { itens: Novidade[] }[] };

const blocos: { titulo: string; pt: string[]; en: string[] }[] = [];
if (NOVIDADES.proxima.length)
  blocos.push({
    titulo: 'Ainda sem versão',
    pt: NOVIDADES.proxima.map((n) => n.texto),
    en: enData.proxima.map((n) => n.texto),
  });
NOVIDADES.versoes.forEach((v, i) => {
  if (maior(v.versao, atual) || (ultima && !maior(v.versao, ultima))) return;
  blocos.push({
    titulo: `${v.versao} (${v.data})`,
    pt: v.itens.map((n) => n.texto),
    en: (enData.versoes[i]?.itens ?? []).map((n) => n.texto),
  });
});

const desde = ultima ? `desde o APK ${ultima}` : 'desde o início (primeiro APK)';
const out: string[] = [`## Novidades ${desde}`, ''];
if (!blocos.length) out.push('Nenhuma novidade nova.', '');
for (const b of blocos) out.push(`### ${b.titulo}`, textoLoja(b.pt), '');
const pt = textoLoja(blocos.flatMap((b) => b.pt));
const ing = textoLoja(blocos.flatMap((b) => b.en));
out.push(
  '<details><summary>Texto para a Play Store</summary>',
  '',
  '```',
  `<pt-BR>\n${pt}\n</pt-BR>\n<en-US>\n${ing}\n</en-US>`,
  '```',
  '</details>',
);
console.log(out.join('\n'));
for (const [l, t] of [
  ['pt-BR', pt],
  ['en-US', ing],
])
  console.error(`${l}: ${t.length}/${LOJA_LIMITE} caracteres${t.length > LOJA_LIMITE ? ' — ACIMA DO LIMITE' : ''}`);
