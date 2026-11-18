// Robô do caos: joga o Mistpeak no navegador fazendo todo tipo de coisa "errada" e anota o que quebrar.
//
// Tutorial completo: docs/robo-do-caos.md
//
// Resumo:
//   1) num terminal:  npm run dev
//   2) em outro:      npm run chaos -- --minutos 120
//
// Precisa do jogo rodando com `npm run dev` (não o build): só no modo dev o jogo expõe `window.__game`,
// que o robô usa para conferir o estado (vida, ouro, mochila, posição...).
//
// O robô usa um navegador separado, com armazenamento próprio: não mexe nos seus personagens de verdade.
// Pedidos para fora do jogo (ex.: o envio de "Reportar bug" por e-mail) são bloqueados.

import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try {
  pw = await import('playwright');
} catch {
  try {
    pw = await import('playwright-core');
  } catch {
    console.error(
      'Playwright não está instalado. Rode:  npm install --no-save playwright  e  npx playwright install chromium',
    );
    process.exit(2);
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- opções da linha de comando
function parseArgs(argv) {
  const o = {
    url: 'http://localhost:5173/',
    minutos: 60, // 0 = sem fim (até Ctrl+C)
    semente: Date.now() % 1_000_000_000 >>> 0,
    janela: false, // true = mostra o navegador
    saida: join(ROOT, 'chaos-reports'),
    sessaoMin: 15, // a cada N minutos, fecha tudo e começa do zero com outro aparelho
    trapaca: true, // ações "de deus" (trocar de mapa na hora, ouro infinito, matar o jogador...)
    ritmo: 1, // 2 = duas vezes mais rápido entre ações, 0.5 = mais devagar
    perfil: null, // fixa um aparelho (nome da lista PERFIS)
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i],
      v = () => argv[++i];
    if (a === '--url') o.url = v();
    else if (a === '--minutos') o.minutos = Number(v());
    else if (a === '--semente') o.semente = Number(v()) >>> 0;
    else if (a === '--janela') o.janela = true;
    else if (a === '--saida') o.saida = v();
    else if (a === '--sessao-min') o.sessaoMin = Number(v());
    else if (a === '--sem-trapaca') o.trapaca = false;
    else if (a === '--ritmo') o.ritmo = Math.max(0.05, Number(v()));
    else if (a === '--perfil') o.perfil = v();
    else if (a === '--ajuda' || a === '-h' || a === '--help') {
      console.log(readFileSync(join(ROOT, 'docs/robo-do-caos.md'), 'utf8'));
      process.exit(0);
    } else {
      console.error(`Opção desconhecida: ${a}  (use --ajuda)`);
      process.exit(2);
    }
  }
  return o;
}
const OPT = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------- aleatório com semente (reproduzível)
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(OPT.semente);
const rand = (a, b) => a + rnd() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const chance = (p) => rnd() < p;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function pickWeighted(list) {
  const total = list.reduce((s, x) => s + x.peso, 0);
  let r = rnd() * total;
  for (const x of list) if ((r -= x.peso) <= 0) return x;
  return list[list.length - 1];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pausa = (a, b) => sleep(rand(a, b) / OPT.ritmo);

// ---------------------------------------------------------------- aparelhos simulados
const PERFIS = [
  { nome: 'celular-em-pe', w: 390, h: 844, touch: true },
  { nome: 'celular-deitado', w: 844, h: 390, touch: true },
  { nome: 'celular-pequeno', w: 360, h: 640, touch: true },
  { nome: 'fold-fechado', w: 920, h: 316, touch: true },
  { nome: 'fold-aberto', w: 884, h: 1028, touch: true },
  { nome: 'tablet', w: 1024, h: 768, touch: true },
  { nome: 'pc', w: 1366, h: 768, touch: false },
  { nome: 'pc-grande', w: 1920, h: 1080, touch: false },
  { nome: 'janela-minuscula', w: 280, h: 200, touch: false },
];

// nomes que costumam quebrar coisas
const NOMES_ESTRANHOS = [
  '',
  ' ',
  '   espaços   ',
  'A',
  'a'.repeat(300),
  '<img src=x onerror="window.__chaosXss=1">',
  '<b>negrito</b>',
  '"><script>window.__chaosXss=1</script>',
  "'; DROP TABLE saves; --",
  '😀🐉🗡️🔥',
  'Z̴̢͍a̷l̸g̵o̶ ̷t̸e̶x̴t̸',
  'مرحبا بالعالم',
  '中文名字',
  '__proto__',
  'constructor',
  'null',
  'undefined',
  'NaN',
  '%s%s%n%d',
  '{{7*7}}${7*7}',
  '\\n\\t\\0',
  'Lin\nha',
  'Tab\tTab',
  '‮olleh',
  '​​​',
  'Herói',
  'Mestre Zhang',
];

const TEXTO_LIXO = [...NOMES_ESTRANHOS, '-1', '0', '999999999999', '1e309', '-0', 'abc', '.', '0x10'];

// teclas: as do jogo + outras que um humano aperta sem querer
const TECLAS_JOGO = ['Tab', 'c', 'k', 'i', 'm', 'q', 'e', 'z', 'Escape', '1', '2', '3', '4', ' '];
const TECLAS_LIXO = [
  'Enter',
  'Backspace',
  'Delete',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'F1',
  'Home',
  'End',
  'PageDown',
  'x',
  'p',
  'l',
  '5',
  '9',
  '0',
  'C',
  'I',
  'Control+a',
  'Shift+Tab',
  'Alt+Enter',
];
const TECLAS_MOVER = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// ---------------------------------------------------------------- relatório
const inicio = Date.now();
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const PASTA = join(OPT.saida, `${stamp}-semente${OPT.semente}`);
mkdirSync(join(PASTA, 'bugs'), { recursive: true });

const progression = JSON.parse(readFileSync(join(ROOT, 'src/data/progression.json'), 'utf8'));

const bugs = new Map(); // assinatura → { id, tipo, msg, vezes, primeira, ultima, pasta }
const historico = []; // últimas ações
const HIST_MAX = 120;
let sessao = 0;
let perfilAtual = null;
let acoesTotal = 0;
const contAcoes = {};
const metricas = [];
let encerrando = false;

const decorrido = () => {
  const s = Math.floor((Date.now() - inicio) / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function anotar(acao, detalhe = '') {
  acoesTotal++;
  contAcoes[acao] = (contAcoes[acao] ?? 0) + 1;
  historico.push(`${decorrido()} [s${sessao}] ${acao}${detalhe ? ` ${detalhe}` : ''}`);
  if (historico.length > HIST_MAX) historico.shift();
}

// tira números, endereços e posições da mensagem para juntar o mesmo bug numa entrada só
const assinatura = (tipo, msg) =>
  `${tipo}:${String(msg)
    .replace(/https?:\/\/\S+/g, 'URL')
    .replace(/\?t=\d+/g, '')
    .replace(/:\d+:\d+/g, ':L:C')
    .replace(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi, 'N')
    .slice(0, 300)}`;

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .toLowerCase();

/**
 * Registra um problema. tipo: ERRO-JS | CRASH | TRAVOU | ESTADO | SAVE | XSS | VAZAMENTO | AVISO
 * Bugs repetidos só aumentam o contador; o primeiro guarda print, histórico e estado do jogo.
 */
async function registrar(page, tipo, msg, extra = {}) {
  const sig = assinatura(tipo, msg);
  const b = bugs.get(sig);
  if (b) {
    b.vezes++;
    b.ultima = decorrido();
    return;
  }
  const id = String(bugs.size + 1).padStart(3, '0');
  const pasta = join(PASTA, 'bugs', `${id}-${tipo.toLowerCase()}-${slug(String(msg)) || 'sem-msg'}`);
  mkdirSync(pasta, { recursive: true });
  const novo = { id, tipo, msg: String(msg), vezes: 1, primeira: decorrido(), ultima: decorrido(), pasta, sessao };
  bugs.set(sig, novo);
  console.log(`\n🐞 [${decorrido()}] #${id} ${tipo}: ${String(msg).split('\n')[0].slice(0, 160)}`);

  let estado = null;
  if (page && !page.isClosed()) {
    await comTempo(page.screenshot({ path: join(pasta, 'tela.png') }), 8000).catch(() => {});
    estado = await comTempo(page.evaluate(fotografarEstado), 5000).catch(() => null);
  }
  const info = {
    tipo,
    mensagem: String(msg),
    ...extra,
    quando: novo.primeira,
    semente: OPT.semente,
    sessao,
    aparelho: perfilAtual,
    url: OPT.url,
    ultimasAcoes: [...historico],
    estadoDoJogo: estado,
  };
  writeFileSync(join(pasta, 'info.json'), JSON.stringify(info, null, 2));
  writeFileSync(
    join(pasta, 'LEIA.md'),
    `# ${tipo}: ${String(msg).split('\n')[0]}\n\n` +
      `- Quando: ${novo.primeira} de execução (sessão ${sessao}, aparelho ${perfilAtual?.nome})\n` +
      `- Semente: ${OPT.semente}\n\n` +
      `## Mensagem completa\n\n\`\`\`\n${String(msg)}\n${extra.stack ?? ''}\n\`\`\`\n\n` +
      (extra.detalhes ? `## Detalhes\n\n\`\`\`json\n${JSON.stringify(extra.detalhes, null, 2)}\n\`\`\`\n\n` : '') +
      `## Últimas ações do robô (a última é a mais recente)\n\n\`\`\`\n${historico.join('\n')}\n\`\`\`\n`,
  );
  appendFileSync(
    join(PASTA, 'bugs.jsonl'),
    JSON.stringify({ id, tipo, msg: String(msg), quando: novo.primeira }) + '\n',
  );
  escreverRelatorio();
}

function escreverRelatorio(final = false) {
  const lista = [...bugs.values()].sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo) || b.vezes - a.vezes);
  const top = Object.entries(contAcoes)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n');
  const ultMet = metricas[metricas.length - 1];
  const md =
    `# Relatório do robô do caos ${final ? '(final)' : '(parcial: atualiza sozinho)'}\n\n` +
    `- Início: ${new Date(inicio).toLocaleString('pt-BR')}\n` +
    `- Tempo rodando: ${decorrido()}\n` +
    `- Semente: \`${OPT.semente}\` (para repetir: \`npm run chaos -- --semente ${OPT.semente}\`)\n` +
    `- Sessões (aparelhos diferentes): ${sessao}\n` +
    `- Ações feitas: ${acoesTotal}\n` +
    `- Problemas diferentes encontrados: **${lista.length}**\n` +
    (ultMet
      ? `- Última medida: memória ${ultMet.heapMb} MB, ${ultMet.dom} elementos HTML, ${ultMet.objetos} objetos na cena\n`
      : '') +
    `\n## Problemas\n\n` +
    (lista.length
      ? `| # | Tipo | Vezes | Primeira vez | Mensagem | Pasta |\n|---|---|---|---|---|---|\n` +
        lista
          .map(
            (b) =>
              `| ${b.id} | ${b.tipo} | ${b.vezes} | ${b.primeira} | ${b.msg.split('\n')[0].slice(0, 120).replace(/\|/g, '\\|')} | \`bugs/${b.pasta.split(/[\\/]/).pop()}\` |`,
          )
          .join('\n')
      : 'Nenhum até agora. 🎉') +
    `\n\n## O que cada tipo quer dizer\n\n` +
    `- **CRASH**: a aba do navegador morreu.\n` +
    `- **TRAVOU**: o jogo parou de responder, ou ficou preso na tela de carregamento.\n` +
    `- **ERRO-JS**: erro de JavaScript no console (quase sempre é bug de verdade).\n` +
    `- **ESTADO**: valor impossível no jogo (vida negativa, NaN, item duplicado, personagem dentro da parede...).\n` +
    `- **SAVE**: o que voltou depois de recarregar não bate com o que foi salvo.\n` +
    `- **XSS**: um nome de personagem com HTML foi executado como código.\n` +
    `- **VAZAMENTO**: algo cresce sem parar (memória, objetos na cena, eventos).\n` +
    `- **AVISO**: suspeito, mas pode ser normal. Vale olhar.\n` +
    `\n## Ações mais feitas\n\n| Ação | Vezes |\n|---|---|\n${top}\n`;
  writeFileSync(join(PASTA, 'relatorio.md'), md);
}
const ordemTipo = (t) => ['CRASH', 'TRAVOU', 'XSS', 'SAVE', 'ERRO-JS', 'ESTADO', 'VAZAMENTO', 'AVISO'].indexOf(t);

function comTempo(promise, ms) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error('TEMPO_ESGOTADO')), ms);
    }),
  ]);
}

// ---------------------------------------------------------------- código que roda DENTRO da página

// Instalado antes do jogo carregar: batimento (detecta travamento), relógio falso do "aparelho"
// e controle de "app em segundo plano".
function scriptInicial(cfg) {
  try {
    localStorage.setItem('rpg-ui-size', cfg.uiSize);
    if (cfg.lang) localStorage.setItem('rpg-wuxia-lang', cfg.lang);
  } catch {}
  // relógio do aparelho (o jogador pode mudar a hora do celular). Fica guardado entre recarregamentos.
  const realNow = Date.now.bind(Date);
  const off = () => Number(localStorage.getItem('__chaosClock') || 0);
  Date.now = () => realNow() + off();
  window.__chaosShiftClock = (ms) => localStorage.setItem('__chaosClock', String(off() + ms));
  // batimento: conta quadros desenhados
  window.__chaosBeat = 0;
  const beat = () => {
    window.__chaosBeat++;
    requestAnimationFrame(beat);
  };
  requestAnimationFrame(beat);
  // "segundo plano" simulado
  let hidden = false;
  Object.defineProperty(Document.prototype, 'visibilityState', {
    get: () => (hidden ? 'hidden' : 'visible'),
    configurable: true,
  });
  Object.defineProperty(Document.prototype, 'hidden', { get: () => hidden, configurable: true });
  window.__chaosSetHidden = (h) => {
    hidden = h;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  window.alert = () => {};
}

function fase() {
  const vis = (id) => {
    const e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none';
  };
  if (window.__chaosXss) return 'xss';
  if (vis('hud') && window.__game?.world) return 'jogo';
  if (vis('create')) return 'criacao';
  return 'carregando';
}

// resumo do estado (vai junto em cada bug)
function fotografarEstado() {
  const g = window.__game;
  if (!g?.world) return { fase: 'sem jogo carregado' };
  const w = g.world,
    p = w.player;
  const r = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  return {
    mapa: w.mapId,
    personagem: { nome: p.name, classe: w.classId, nivel: p.level, xp: w.xp, pontos: w.freePoints },
    vida: `${r(p.hp)}/${r(p.derived?.maxHp)}`,
    mana: `${r(p.mana)}/${r(p.derived?.maxMana)}`,
    morto: p.dead,
    posicao: { x: r(p.x), y: r(p.y) },
    ouro: w.gold,
    alvo: w.targetId,
    auto: (() => {
      try {
        return w.auto.serialize();
      } catch {
        return '?';
      }
    })(),
    missao: w.quest,
    mochila: w.bag.map((it) => (it ? `${it.baseId}${it.qty ? '×' + it.qty : ''}` : null)),
    equipamento: Object.fromEntries(
      Object.entries(w.equipment).map(([k, it]) => [k, it ? `${it.baseId} (dur ${r(it.durability)})` : null]),
    ),
    monstrosVivos: w.monsters.filter((m) => !m.dead).length,
    monstrosTotal: w.monsters.length,
    npcs: w.npcs.length,
    noChao: w.ground.length,
    eventosPendentes: w.events.length,
    janelasAbertas: [
      ...document.querySelectorAll('[id$="-panel"]:not(.hidden), #bigmap:not(.hidden), #tip-card:not(.hidden)'),
    ].map((e) => e.id),
    relogioDesviadoHoras: r(Number(localStorage.getItem('__chaosClock') || 0) / 3600000),
  };
}

// Confere regras que nunca podem ser quebradas. Devolve a lista de problemas encontrados agora.
// `imediato: true` = é bug na hora; os outros só contam se continuarem na checagem seguinte (evita falso alarme
// de algo que está no meio de mudar).
function checarRegras(cfg) {
  const g = window.__game;
  if (!g?.world) return { ok: false, problemas: [] };
  const w = g.world,
    p = w.player,
    out = [];
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const bad = (chave, msg, imediato = false, dados) => out.push({ chave, msg, imediato, dados });
  const map = w.map;

  // jogador
  for (const k of ['hp', 'mana', 'x', 'y', 'level', 'moveSpeed', 'attackRange', 'attackInterval'])
    if (!fin(p[k])) bad(`p.${k}`, `jogador.${k} não é número válido (${p[k]})`, true);
  for (const [k, v] of Object.entries(p.derived ?? {}))
    if (!fin(v)) bad(`p.d.${k}`, `atributo derivado ${k} = ${v}`, true);
  if (fin(p.hp) && p.hp < -0.001) bad('p.hp<0', `vida negativa: ${p.hp}`);
  if (fin(p.hp) && p.hp > p.derived.maxHp + 0.5) bad('p.hp>max', `vida acima do máximo: ${p.hp} > ${p.derived.maxHp}`);
  if (fin(p.mana) && p.mana < -0.001) bad('p.mp<0', `mana negativa: ${p.mana}`);
  if (fin(p.mana) && p.mana > p.derived.maxMana + 0.5)
    bad('p.mp>max', `mana acima do máximo: ${p.mana} > ${p.derived.maxMana}`);
  if (p.derived && !(p.derived.maxHp > 0)) bad('p.maxhp', `vida máxima <= 0: ${p.derived.maxHp}`, true);
  if (fin(p.hp) && p.hp <= 0 && !p.dead) bad('p.zumbi', 'jogador com vida 0 mas não está morto');
  if (p.dead && p.hp > 0) bad('p.morto-vivo', `jogador morto com vida ${p.hp}`);
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > cfg.levelCap)
    bad('p.level', `nível impossível: ${p.level} (máximo ${cfg.levelCap})`, true);
  if (!fin(w.xp) || w.xp < 0) bad('xp', `XP inválido: ${w.xp}`, true);
  if (p.level < cfg.levelCap && fin(w.xp) && w.xp >= cfg.xpToNext[p.level - 1] * 1.0001)
    bad('xp>need', `XP ${w.xp} passou do necessário (${cfg.xpToNext[p.level - 1]}) e não subiu de nível`);
  if (!Number.isInteger(w.freePoints) || w.freePoints < 0)
    bad('pontos', `pontos livres inválidos: ${w.freePoints}`, true);
  if (!Number.isInteger(w.gold) || w.gold < 0) bad('ouro', `ouro inválido: ${w.gold}`, true);
  for (const [k, v] of Object.entries(p.attrs ?? {}))
    if (!Number.isInteger(v) || v < 0) bad(`attr.${k}`, `atributo ${k} inválido: ${v}`, true);

  // posição
  const dentro = (e) => e.x >= 0 && e.y >= 0 && e.x <= map.width && e.y <= map.height;
  const andavel = (e) => !!map.walkable[Math.floor(e.y) * map.width + Math.floor(e.x)];
  if (fin(p.x) && !dentro(p)) bad('p.fora', `jogador fora do mapa ${w.mapId}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  else if (fin(p.x) && !p.dead && !andavel(p))
    bad('p.parede', `jogador parado em tile não andável em ${w.mapId}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);

  // mochila e equipamento
  window.__chaosBagSize ??= w.bag.length;
  if (w.bag.length !== window.__chaosBagSize)
    bad('bag.len', `mochila mudou de tamanho: ${w.bag.length} (era ${window.__chaosBagSize})`, true);
  const uids = new Map();
  const itens = [
    ...w.bag.map((it, i) => [`mochila[${i}]`, it]),
    ...Object.entries(w.equipment).map(([k, it]) => [`equip.${k}`, it]),
  ];
  for (const [onde, it] of itens) {
    if (!it) continue;
    if (uids.has(it.uid)) bad('dup', `item duplicado (uid ${it.uid}) em ${uids.get(it.uid)} e ${onde}`, true);
    uids.set(it.uid, onde);
    if (it.qty !== undefined && (!Number.isInteger(it.qty) || it.qty < 1))
      bad(`qty`, `quantidade inválida em ${onde}: ${it.qty}`, true);
    if (!fin(it.durability) || it.durability < 0)
      bad('dur', `durabilidade inválida em ${onde}: ${it.durability}`, true);
  }
  if (Object.keys(w.equipment).length !== 6)
    bad('eq.slots', `equipamento com ${Object.keys(w.equipment).length} espaços (eram 6)`, true);

  // monstros e NPCs
  const spawns = map.objects.filter((o) => o.type === 'monsterSpawn').length;
  if (w.monsters.length > spawns * 3 + 10)
    bad('monstros', `monstros demais no mapa: ${w.monsters.length} (spawns: ${spawns})`);
  for (const m of w.monsters) {
    if (!fin(m.hp) || !fin(m.x) || !fin(m.y)) {
      bad('m.nan', `monstro ${m.name} com número inválido (hp ${m.hp}, x ${m.x}, y ${m.y})`, true);
      continue;
    }
    if (m.hp > m.derived.maxHp + 0.5) bad('m.hp>max', `monstro ${m.name} com vida acima do máximo`);
    if (m.hp < -0.001) bad('m.hp<0', `monstro ${m.name} com vida negativa: ${m.hp}`);
    if (!m.dead && m.hp <= 0) bad('m.zumbi', `monstro ${m.name} com vida 0 e vivo`);
    if (!m.dead && !dentro(m)) bad('m.fora', `monstro ${m.name} fora do mapa ${w.mapId}`);
  }
  for (const n of w.npcs) if (!fin(n.x) || !fin(n.y)) bad('n.nan', `NPC ${n.name} com posição inválida`, true);
  if (w.targetId !== null && !w.monsters.some((m) => m.id === w.targetId))
    bad('alvo', `alvo ${w.targetId} não existe mais no mapa`);

  // habilidades, poções, missão
  for (const [id, s] of Object.entries(w.skills)) {
    if (!Number.isInteger(s.level) || s.level < 1 || s.level > 15)
      bad(`sk.lv`, `habilidade ${id} com nível ${s.level}`, true);
    if (!fin(s.cd) || s.cd < -0.001) bad('sk.cd', `habilidade ${id} com recarga ${s.cd}`, true);
    if (!fin(s.xp) || s.xp < 0) bad('sk.xp', `habilidade ${id} com xp ${s.xp}`, true);
  }
  for (const k of ['hp', 'mp'])
    if (!fin(w.potionCd[k]) || w.potionCd[k] < -0.001) bad('pot.cd', `recarga da poção ${k}: ${w.potionCd[k]}`, true);
  if (!Number.isInteger(w.quest.stage) || w.quest.stage < 0 || !fin(w.quest.progress) || w.quest.progress < 0)
    bad('quest', `missão inválida: ${JSON.stringify(w.quest)}`, true);

  // coisas que crescem sem parar
  if (w.events.length > 2000) bad('eventos', `${w.events.length} eventos acumulados sem serem consumidos`);
  if (w.ground.length > 400) bad('chao', `${w.ground.length} itens no chão`);
  if (w.telegraphs.length > 100) bad('tele', `${w.telegraphs.length} avisos de ataque de chefe acumulados`);
  const sc = g.scene;
  if (sc?.views?.size > w.monsters.length + w.npcs.length + 5)
    bad(
      'views',
      `cena com ${sc.views.size} bonecos para ${w.monsters.length + w.npcs.length + 1} entidades (bonecos esquecidos)`,
    );
  if (sc?.groundViews?.size > w.ground.length + 5)
    bad('gviews', `cena com ${sc.groundViews.size} desenhos de chão para ${w.ground.length} itens`);

  // o save tem que ser gravável sem perder números
  try {
    const s = w.serialize();
    const ruins = [];
    const walk = (v, path) => {
      if (typeof v === 'number' && !Number.isFinite(v)) ruins.push(`${path}=${v}`);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(s, 'save');
    if (ruins.length)
      bad('save.nan', `save tem números inválidos (viram null no JSON): ${ruins.slice(0, 5).join(', ')}`, true);
  } catch (e) {
    bad('save.throw', `world.serialize() deu erro: ${e?.message ?? e}`, true);
  }

  return {
    ok: true,
    problemas: out,
    tempoMundo: w.time,
    batida: window.__chaosBeat,
    painelAberto: !!document.querySelector('#offline-panel:not(.hidden), #npc-panel:not(.hidden)'),
  };
}

function medir() {
  const g = window.__game;
  return {
    heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
    dom: document.getElementsByTagName('*').length,
    objetos: g?.scene?.children?.list?.length ?? -1,
  };
}

// lista os elementos clicáveis visíveis na tela
function clicaveis() {
  const sel =
    'button, [data-act], [data-a], [data-attr], [data-dist], [data-eq], [data-bag], [data-id], [data-close], input, label, select, a, [role=button], [role=tab], .cell, .slot, .slot-card, #minimap, #map-name, #player-frame, #target-frame, #quest-tracker, #loot-feed, #toast, #tip-card, #bigmap, #dur-warn, #boss-bar';
  const W = innerWidth,
    H = innerHeight,
    out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    let d = el.tagName.toLowerCase();
    if (el.id) d += `#${el.id}`;
    for (const a of ['act', 'a', 'id', 'bag', 'eq', 'attr', 'i'])
      if (el.dataset[a] !== undefined) d += `[${a}=${el.dataset[a]}]`;
    const t = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (t) d += ` "${t}"`;
    out.push({
      x: Math.max(0, r.left),
      y: Math.max(0, r.top),
      w: Math.min(r.width, W - r.left),
      h: Math.min(r.height, H - r.top),
      d,
    });
  }
  return out;
}

// ---------------------------------------------------------------- ações

async function clicarEm(page, x, y, toque) {
  x = Math.max(0, Math.min(x, page.viewportSize().width - 1));
  y = Math.max(0, Math.min(y, page.viewportSize().height - 1));
  if (toque && chance(0.6)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y, { button: chance(0.92) ? 'left' : pick(['right', 'middle']) });
}

async function elementoAleatorio(page) {
  const els = await page.evaluate(clicaveis);
  return els.length ? pick(els) : null;
}

async function campoVisivel(page, seletor) {
  const els = await page.$$(seletor);
  const vis = [];
  for (const e of els) if (await e.isVisible().catch(() => false)) vis.push(e);
  return vis.length ? pick(vis) : null;
}

const jogo = (page, fn, arg) => page.evaluate(fn, arg); // atalho

// --- ações na tela de criação/escolha de personagem
const ACOES_CRIACAO = [
  {
    nome: 'clicar-qualquer-coisa',
    peso: 6,
    run: async (page, toque) => {
      const el = await elementoAleatorio(page);
      if (!el) return;
      anotar('clicar', el.d);
      await clicarEm(page, el.x + rnd() * el.w, el.y + rnd() * el.h, toque);
    },
  },
  {
    nome: 'criar-personagem',
    peso: 5,
    run: async (page) => {
      const novo = await page.$('[data-act="new"]');
      if (novo && (await novo.isVisible())) await novo.click();
      const nome = chance(0.6) ? pick(NOMES_ESTRANHOS) : `Robo${randInt(1, 9999)}`;
      anotar('criar-personagem', JSON.stringify(nome));
      const campo = await page.$('#char-name');
      if (campo && (await campo.isVisible())) {
        if (chance(0.5)) await campo.fill(nome);
        else {
          await campo.click();
          await page.keyboard.type(nome.slice(0, 60), { delay: rand(0, 30) });
        }
      }
      const cards = await page.$$('.class-card');
      for (let i = randInt(0, 3); i > 0 && cards.length; i--)
        await pick(cards)
          .click()
          .catch(() => {});
      const start = await page.$('#btn-start');
      if (start && (await start.isVisible())) {
        const n = chance(0.25) ? randInt(2, 6) : 1; // clique duplo/triplo no "Começar"
        for (let i = 0; i < n; i++) await start.click({ force: true, timeout: 2000 }).catch(() => {});
      }
    },
  },
  {
    nome: 'jogar',
    peso: 6,
    run: async (page) => {
      const b = await campoVisivel(page, '[data-act="play"]');
      if (!b) return;
      anotar('jogar');
      const n = chance(0.2) ? randInt(2, 5) : 1;
      for (let i = 0; i < n; i++) await b.click({ force: true, timeout: 2000 }).catch(() => {});
    },
  },
  {
    nome: 'apagar-personagem',
    peso: 1,
    run: async (page) => {
      const b = await campoVisivel(page, '[data-act="del"]');
      if (!b) return;
      await b.click();
      const campo = await page.$('#del-name');
      const msg = await page.textContent('#del-msg').catch(() => '');
      const certo = msg?.match(/"(.*)"/)?.[1] ?? '';
      const digita = chance(0.5) ? certo : pick([certo + ' ', certo.toUpperCase(), '', 'errado', certo.slice(0, -1)]);
      anotar('apagar-personagem', `digitou ${JSON.stringify(digita)}`);
      if (campo) await campo.fill(digita).catch(() => {});
      await pausa(50, 400);
      await page.click(chance(0.7) ? '#btn-del-ok' : '#btn-del-cancel', { force: true, timeout: 2000 }).catch(() => {});
    },
  },
  {
    nome: 'teclas-na-criacao',
    peso: 2,
    run: async (page) => {
      const k = pick([...TECLAS_JOGO, ...TECLAS_LIXO]);
      anotar('tecla', k);
      await page.keyboard.press(k);
    },
  },
];

// --- ações dentro do jogo
function acoesJogo(toque) {
  const lista = [
    {
      nome: 'tecla',
      peso: 10,
      run: async (page) => {
        const k = chance(0.8) ? pick(TECLAS_JOGO) : pick(TECLAS_LIXO);
        anotar('tecla', k);
        await page.keyboard.press(k);
      },
    },
    {
      nome: 'esmagar-teclado',
      peso: 4,
      run: async (page) => {
        const n = randInt(10, 60);
        anotar('esmagar-teclado', `${n} teclas`);
        for (let i = 0; i < n; i++) {
          await page.keyboard.press(pick([...TECLAS_JOGO, ...TECLAS_MOVER, ...TECLAS_LIXO]));
          if (chance(0.3)) await sleep(rand(0, 40));
        }
      },
    },
    {
      nome: 'andar-teclado',
      peso: 8,
      run: async (page) => {
        const teclas = [...new Set(Array.from({ length: randInt(1, 3) }, () => pick(TECLAS_MOVER)))];
        const ms = rand(100, 3000);
        anotar('andar-teclado', `${teclas.join('+')} por ${Math.round(ms)}ms`);
        for (const k of teclas) await page.keyboard.down(k);
        await sleep(ms / OPT.ritmo);
        if (chance(0.15)) {
          // "Alt+Tab" com a tecla apertada: o navegador perde o foco antes de soltar
          anotar('perder-foco-andando');
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          await pausa(100, 1500);
        }
        for (const k of teclas) await page.keyboard.up(k);
      },
    },
    {
      nome: 'clicar-no-mapa',
      peso: 10,
      run: async (page, toque) => {
        const { width: W, height: H } = page.viewportSize();
        const x = rand(0, W),
          y = rand(0, H);
        anotar('clicar-no-mapa', `(${Math.round(x)},${Math.round(y)})`);
        await clicarEm(page, x, y, toque);
        if (chance(0.15)) {
          const n = randInt(2, 8);
          anotar('cliques-rapidos-mesmo-ponto', `${n}x`);
          for (let i = 0; i < n; i++) await clicarEm(page, x, y, toque);
        }
      },
    },
    {
      nome: 'clicar-qualquer-coisa',
      peso: 14,
      run: async (page, toque) => {
        const el = await elementoAleatorio(page);
        if (!el) return;
        anotar('clicar', el.d);
        await clicarEm(page, el.x + rnd() * el.w, el.y + rnd() * el.h, toque);
      },
    },
    {
      nome: 'metralhar-botao',
      peso: 4,
      run: async (page, toque) => {
        const el = await elementoAleatorio(page);
        if (!el) return;
        const n = randInt(5, 40);
        anotar('metralhar-botao', `${el.d} ${n}x`);
        for (let i = 0; i < n; i++) {
          await clicarEm(page, el.x + el.w / 2, el.y + el.h / 2, toque);
          if (chance(0.2)) await sleep(rand(0, 60));
        }
      },
    },
    {
      nome: 'arrastar',
      peso: 5,
      run: async (page) => {
        // joystick (metade esquerda) ou arrasto qualquer; às vezes solta lá na borda da tela
        const { width: W, height: H } = page.viewportSize();
        let x = rand(0, W * 0.5),
          y = rand(H * 0.3, H);
        anotar('arrastar', `de (${Math.round(x)},${Math.round(y)})`);
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = randInt(3, 25); i > 0; i--) {
          x = chance(0.1) ? pick([0, W - 1]) : Math.max(0, Math.min(W - 1, x + rand(-120, 120)));
          y = chance(0.1) ? pick([0, H - 1]) : Math.max(0, Math.min(H - 1, y + rand(-120, 120)));
          await page.mouse.move(x, y, { steps: randInt(1, 5) });
          await sleep(rand(10, 200) / OPT.ritmo);
        }
        if (chance(0.1)) {
          anotar('perder-foco-arrastando');
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        }
        await page.mouse.up();
      },
    },
    {
      nome: 'zoom-roda',
      peso: 3,
      run: async (page) => {
        const n = randInt(1, 30);
        anotar('zoom-roda', `${n}x`);
        for (let i = 0; i < n; i++) await page.mouse.wheel(0, pick([-1, 1]) * rand(10, 2000));
      },
    },
    {
      nome: 'abrir-tudo',
      peso: 3,
      run: async (page) => {
        const teclas = ['c', 'k', 'i', 'm'].sort(() => rnd() - 0.5);
        anotar('abrir-todas-as-janelas', teclas.join(','));
        for (const k of teclas) await page.keyboard.press(k);
        if (chance(0.5)) await page.keyboard.press('Escape');
      },
    },
    {
      nome: 'spam-habilidades',
      peso: 4,
      run: async (page) => {
        const n = randInt(5, 40);
        anotar('spam-habilidades', `${n}x`);
        for (let i = 0; i < n; i++) await page.keyboard.press(pick(['1', '2', '3', '4', ' ', 'Tab']));
      },
    },
    {
      nome: 'spam-pocoes',
      peso: 3,
      run: async (page) => {
        const n = randInt(3, 30);
        anotar('spam-pocoes', `${n}x`);
        for (let i = 0; i < n; i++) await page.keyboard.press(pick(['q', 'e']));
      },
    },
    {
      nome: 'mexer-em-campos',
      peso: 5,
      run: async (page) => {
        const el = await campoVisivel(page, 'input, select, textarea');
        if (!el) return;
        const tipo = await el.evaluate((e) => e.type || e.tagName.toLowerCase());
        if (tipo === 'range' || tipo === 'number') {
          const v = chance(0.3) ? pick(TEXTO_LIXO) : String(randInt(-50, 150));
          anotar('mexer-em-campo', `${tipo} = ${v}`);
          await el.evaluate((e, v) => {
            e.value = v;
            e.dispatchEvent(new Event('input', { bubbles: true }));
            e.dispatchEvent(new Event('change', { bubbles: true }));
          }, v);
        } else if (tipo === 'checkbox' || tipo === 'radio') {
          const n = chance(0.2) ? randInt(2, 10) : 1;
          anotar('mexer-em-campo', `${tipo} ${n}x`);
          for (let i = 0; i < n; i++) await el.click({ force: true, timeout: 2000 }).catch(() => {});
        } else if (tipo === 'select' || tipo === 'select-one') {
          const ops = await el.evaluate((e) => [...e.options].map((o) => o.value));
          if (ops.length) await el.selectOption(pick(ops)).catch(() => {});
          anotar('mexer-em-campo', 'select');
        } else {
          const t = pick(TEXTO_LIXO);
          anotar('digitar-em-campo', JSON.stringify(t));
          await el.fill(t).catch(() => {});
          if (chance(0.5)) await page.keyboard.press('Enter');
        }
      },
    },
    {
      nome: 'falar-com-npc',
      peso: 4,
      run: async (page) => {
        const r = await jogo(
          page,
          (i) => {
            const w = window.__game?.world;
            if (!w?.npcs.length) return null;
            const n = w.npcs[i % w.npcs.length];
            w.interactNpc(n.id);
            return n.name;
          },
          randInt(0, 99),
        );
        anotar('falar-com-npc', r ?? '(nenhum)');
      },
    },
    {
      nome: 'atacar-monstro',
      peso: 5,
      run: async (page) => {
        const r = await jogo(
          page,
          (i) => {
            const w = window.__game?.world;
            const vivos = w?.monsters.filter((m) => !m.dead) ?? [];
            if (!vivos.length) return null;
            const m = vivos[i % vivos.length];
            w.setTarget(m.id);
            w.attackNearest();
            return `${m.name} nv${m.level}`;
          },
          randInt(0, 999),
        );
        anotar('atacar-monstro', r ?? '(nenhum)');
      },
    },
    {
      nome: 'andar-para-portal',
      peso: 3,
      run: async (page) => {
        const r = await jogo(
          page,
          (i) => {
            const w = window.__game?.world;
            const ps = w?.map.objects.filter((o) => o.type === 'portal') ?? [];
            if (!ps.length) return null;
            const o = ps[i % ps.length];
            w.moveTo(o.x + o.w / 2, o.y + o.h / 2);
            return String(o.props.target);
          },
          randInt(0, 99),
        );
        anotar('andar-para-portal', r ?? '(nenhum)');
      },
    },
    {
      nome: 'andar-para-lugar-aleatorio',
      peso: 3,
      run: async (page) => {
        const r = await jogo(
          page,
          (seed) => {
            const w = window.__game?.world;
            if (!w) return null;
            // inclui lugares impossíveis (água, parede, fora do mapa)
            const x = ((seed % 1000) / 1000) * (w.map.width + 4) - 2,
              y = (((seed / 1000) % 1000) / 1000) * (w.map.height + 4) - 2;
            w.moveTo(x, y);
            return `(${x.toFixed(1)}, ${y.toFixed(1)})`;
          },
          randInt(0, 999_999),
        );
        anotar('andar-para', r ?? '');
      },
    },
    {
      nome: 'auto',
      peso: 3,
      run: async (page) => {
        const n = chance(0.3) ? randInt(2, 15) : 1;
        anotar('liga-desliga-auto', `${n}x`);
        for (let i = 0; i < n; i++) await page.keyboard.press('z');
      },
    },
    {
      nome: 'deixar-o-auto-jogar',
      peso: 4,
      run: async (page) => {
        const ms = rand(3000, 40000);
        anotar('deixar-o-auto-jogar', `${Math.round(ms / 1000)}s`);
        await page
          .evaluate(() => {
            const w = window.__game?.world;
            if (w && w.auto.state === 'off') w.auto.toggle();
          })
          .catch(() => {});
        await sleep(ms / OPT.ritmo);
      },
    },
    {
      nome: 'parado',
      peso: 3,
      run: async () => {
        const ms = rand(500, 8000);
        anotar('parado', `${Math.round(ms)}ms`);
        await sleep(ms / OPT.ritmo);
      },
    },
    {
      nome: 'redimensionar',
      peso: 2,
      run: async (page) => {
        const w = chance(0.2) ? pick([200, 240, 3000]) : randInt(300, 1800),
          h = chance(0.2) ? pick([150, 180, 2000]) : randInt(250, 1100);
        anotar('redimensionar', `${w}x${h}`);
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
      },
    },
    {
      nome: 'girar-tela',
      peso: 2,
      run: async (page) => {
        const { width, height } = page.viewportSize();
        const n = chance(0.2) ? randInt(2, 6) : 1;
        anotar('girar-tela', `${n}x`);
        let s = { width: height, height: width };
        for (let i = 0; i < n; i++) {
          await page.setViewportSize(s);
          await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
          s = { width: s.height, height: s.width };
          await sleep(rand(0, 400));
        }
      },
    },
    {
      nome: 'segundo-plano',
      peso: 3,
      run: async (page) => {
        const ms = chance(0.8) ? rand(200, 4000) : rand(10000, 60000);
        anotar('app-em-segundo-plano', `${Math.round(ms / 1000)}s`);
        await page.evaluate(() => window.__chaosSetHidden(true));
        await sleep(ms / OPT.ritmo);
        await page.evaluate(() => window.__chaosSetHidden(false));
      },
    },
    {
      nome: 'mudar-relogio',
      peso: 1,
      run: async (page) => {
        // o jogador muda a hora do celular (adiantar = ganho offline; atrasar = tempo "voltando")
        const h = pick([-48, -5, -1, 0.1, 1, 6, 30, 200]);
        anotar('mudar-relogio-do-aparelho', `${h > 0 ? '+' : ''}${h}h com o app em segundo plano`);
        await page.evaluate((ms) => {
          window.__chaosSetHidden(true);
          window.__chaosShiftClock(ms);
        }, h * 3600_000);
        await pausa(300, 2000);
        await page.evaluate(() => window.__chaosSetHidden(false));
      },
    },
    {
      nome: 'botao-voltar',
      peso: 2,
      run: async (page) => {
        const n = chance(0.3) ? randInt(2, 4) : 1;
        anotar('botao-voltar', `${n}x`);
        for (let i = 0; i < n; i++) {
          await page.goBack({ timeout: 3000 }).catch(() => {});
          await sleep(rand(50, 800));
        }
        if (!page.url().startsWith(OPT.url)) {
          anotar('saiu-do-jogo-e-voltou');
          await page.goto(OPT.url);
        }
      },
    },
    {
      nome: 'sem-internet',
      peso: 1,
      run: async (page) => {
        const ms = rand(1000, 20000);
        anotar('sem-internet', `${Math.round(ms / 1000)}s`);
        await page.context().setOffline(true);
        await sleep(ms / OPT.ritmo);
        await page.context().setOffline(false);
      },
    },
    {
      nome: 'recarregar-bruto',
      peso: 1,
      run: async (page) => {
        anotar('recarregar-pagina-no-meio-do-jogo');
        await page.reload({ timeout: 30000 }).catch(() => {});
      },
    },
    {
      nome: 'recarregar-e-conferir-save',
      peso: 1,
      run: conferirSave,
    },
  ];

  if (toque)
    lista.push({
      nome: 'varios-dedos',
      peso: 3,
      run: async (page) => {
        // vários dedos na tela ao mesmo tempo (joystick + botões + pinça)
        const { width: W, height: H } = page.viewportSize();
        const cdp = await page.context().newCDPSession(page);
        const n = randInt(2, 5);
        let pts = Array.from({ length: n }, (_, i) => ({ x: rand(0, W), y: rand(0, H), id: i }));
        anotar('varios-dedos', `${n} dedos`);
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
          for (let k = randInt(2, 15); k > 0; k--) {
            pts = pts.map((p) => ({
              ...p,
              x: Math.max(0, Math.min(W - 1, p.x + rand(-80, 80))),
              y: Math.max(0, Math.min(H - 1, p.y + rand(-80, 80))),
            }));
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts });
            await sleep(rand(10, 120));
          }
          await cdp.send('Input.dispatchTouchEvent', {
            type: chance(0.1) ? 'touchCancel' : 'touchEnd',
            touchPoints: [],
          });
        } finally {
          await cdp.detach().catch(() => {});
        }
      },
    });

  if (OPT.trapaca)
    lista.push(
      {
        nome: 'trapaca-trocar-mapa',
        peso: 2,
        run: async (page) => {
          const r = await jogo(
            page,
            (i) => {
              const w = window.__game?.world;
              if (!w) return null;
              const ids = Object.keys(w.maps);
              const id = ids[i % ids.length];
              w.changeMap(id);
              return id;
            },
            randInt(0, 99),
          );
          anotar('trapaca-teleporte-para-mapa', r ?? '');
        },
      },
      {
        nome: 'trapaca-ouro',
        peso: 1,
        run: async (page) => {
          const v = pick([1, 1000, 1_000_000, 2_000_000_000]);
          anotar('trapaca-ouro', `+${v}`);
          await jogo(
            page,
            (v) => {
              const w = window.__game?.world;
              if (!w) return;
              w.gold += v;
              w.bumpInv();
            },
            v,
          );
        },
      },
      {
        nome: 'trapaca-xp',
        peso: 1,
        run: async (page) => {
          const v = pick([10, 500, 5000, 100000]);
          anotar('trapaca-xp', `+${v}`);
          await jogo(page, (v) => window.__game?.world?.gainXp(v), v);
        },
      },
      {
        nome: 'trapaca-encher-mochila',
        peso: 1,
        run: async (page) => {
          anotar('trapaca-encher-mochila');
          await jogo(page, () => {
            const w = window.__game?.world;
            const modelo = w?.bag.find(Boolean) ?? Object.values(w?.equipment ?? {}).find(Boolean);
            if (!modelo) return;
            for (let i = 0; i < w.bag.length; i++)
              if (!w.bag[i]) w.bag[i] = { ...structuredClone(modelo), uid: `caos-${Date.now()}-${i}-${Math.random()}` };
            w.bumpInv();
          });
        },
      },
      {
        nome: 'trapaca-morrer',
        peso: 1,
        run: async (page) => {
          const quase = chance(0.5);
          anotar(quase ? 'trapaca-vida-1' : 'trapaca-matar-jogador');
          await jogo(
            page,
            (quase) => {
              const w = window.__game?.world;
              if (!w || w.player.dead) return;
              if (quase) w.player.hp = 1;
              else w.killPlayer();
            },
            quase,
          );
        },
      },
    );
  return lista;
}

// Pausa o jogo, força o salvamento (como se o app fosse fechado), recarrega e confere se voltou igual.
async function conferirSave(page) {
  anotar('recarregar-e-conferir-save');
  const antes = await page.evaluate(() => {
    const g = window.__game;
    if (!g?.world) return null;
    g.scene.scene.pause(); // congela o mundo para o retrato bater com o que foi gravado
    window.__chaosSetHidden(true); // dispara o salvamento de "saiu do app"
    const s = g.world.serialize();
    return {
      name: s.name,
      classId: s.classId,
      level: s.level,
      xp: s.xp,
      gold: s.gold ?? 0,
      freePoints: s.freePoints,
      mapId: s.mapId,
      bag: (s.bag ?? []).map((i) => (i ? `${i.uid}:${i.qty ?? 1}` : null)),
      equip: Object.fromEntries(Object.entries(s.equipment ?? {}).map(([k, i]) => [k, i?.uid ?? null])),
      quest: s.quest,
    };
  });
  if (!antes) return;
  await sleep(1500); // dá tempo do IndexedDB gravar
  await page.reload({ timeout: 30000 });
  await sleep(1500);
  const depois = await page.evaluate(
    (nome) =>
      new Promise((res) => {
        const req = indexedDB.open('keyval-store');
        req.onerror = () => res({ erro: 'não abriu o IndexedDB' });
        req.onsuccess = () => {
          try {
            const tx = req.result.transaction('keyval', 'readonly');
            const g = tx.objectStore('keyval').get('rpg-saves-v2');
            g.onsuccess = () => {
              const f = g.result;
              const s = f?.slots?.find((x) => x && x.name === nome);
              if (!s) return res({ erro: 'personagem sumiu do save', slots: f?.slots?.map((x) => x?.name ?? null) });
              res({
                name: s.name,
                classId: s.classId,
                level: s.level,
                xp: s.xp,
                gold: s.gold ?? 0,
                freePoints: s.freePoints,
                mapId: s.mapId,
                bag: (s.bag ?? []).map((i) => (i ? `${i.uid}:${i.qty ?? 1}` : null)),
                equip: Object.fromEntries(Object.entries(s.equipment ?? {}).map(([k, i]) => [k, i?.uid ?? null])),
                quest: s.quest,
              });
            };
            g.onerror = () => res({ erro: 'não leu o save' });
          } catch (e) {
            res({ erro: String(e) });
          }
        };
      }),
    antes.name,
  );
  if (depois.erro) {
    await registrar(page, 'SAVE', `Depois de recarregar: ${depois.erro}`, { detalhes: { antes, depois } });
    return;
  }
  const dif = [];
  for (const k of Object.keys(antes)) if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) dif.push(k);
  if (dif.length)
    await registrar(page, 'SAVE', `Save não bate com o jogo depois de recarregar (campos: ${dif.join(', ')})`, {
      detalhes: Object.fromEntries(dif.map((k) => [k, { antes: antes[k], depois: depois[k] }])),
    });
}

// ---------------------------------------------------------------- uma sessão (um "aparelho")

async function rodarSessao(browser, fimGeral) {
  sessao++;
  const perfil = OPT.perfil ? (PERFIS.find((p) => p.nome === OPT.perfil) ?? PERFIS[0]) : pick(PERFIS);
  perfilAtual = perfil;
  const cfgPagina = { uiSize: pick(['auto', 'p', 'm', 'g']), lang: chance(0.25) ? 'en' : null };
  console.log(
    `\n=== sessão ${sessao}: ${perfil.nome} ${perfil.w}x${perfil.h}${perfil.touch ? ' (toque)' : ''} · interface ${cfgPagina.uiSize}${cfgPagina.lang ? ' · inglês' : ''}`,
  );
  anotar('nova-sessao', `${perfil.nome} ${perfil.w}x${perfil.h}`);

  const ctx = await browser.newContext({
    viewport: { width: perfil.w, height: perfil.h },
    isMobile: perfil.touch,
    hasTouch: perfil.touch,
    deviceScaleFactor: 1,
  });
  const host = new URL(OPT.url).host;
  // nada sai para a internet (o "Reportar bug" mandaria e-mail de verdade)
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol.startsWith('http') && u.host !== host) return route.abort();
    return route.continue();
  });
  ctx.on('page', (p) => {
    // abas novas (ex.: link de privacidade) são fechadas na hora
    p.waitForLoadState()
      .then(() => p.close())
      .catch(() => {});
  });
  await ctx.addInitScript(scriptInicial, cfgPagina);
  const page = await ctx.newPage();
  const fimSessao = Math.min(fimGeral, Date.now() + OPT.sessaoMin * 60_000);

  let morreu = false;
  page.on('pageerror', (e) => void registrar(page, 'ERRO-JS', e.message, { stack: e.stack }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/\[vite\]|Failed to load resource|ERR_FAILED|ERR_INTERNET_DISCONNECTED|net::/i.test(t)) return; // ruído do servidor dev/rede bloqueada
    void registrar(page, 'ERRO-JS', `console.error: ${t}`, { local: m.location() });
  });
  page.on('crash', () => {
    morreu = true;
    void registrar(page, 'CRASH', 'A aba do navegador travou e morreu (crash)');
  });
  page.on('dialog', (d) => void (chance(0.5) ? d.accept() : d.dismiss()).catch(() => {}));

  await page
    .goto(OPT.url, { timeout: 60000 })
    .catch((e) => registrar(null, 'TRAVOU', `Não abriu o jogo: ${e.message}`));

  const acoesNoJogo = acoesJogo(perfil.touch);
  const pendentes = new Map(); // problemas vistos uma vez esperando confirmação
  let ultimaChecagem = 0,
    ultimaMedida = 0,
    carregandoDesde = Date.now(),
    acoesNaCriacao = 0;
  let ultimoTempoMundo = null,
    tempoParadoDesde = Date.now(),
    ultimaBatida = -1,
    batidaParadaDesde = Date.now();
  const medidasSessao = [];

  while (!encerrando && !morreu && Date.now() < fimSessao) {
    let f;
    try {
      f = await comTempo(page.evaluate(fase), 15000);
    } catch (e) {
      if (/TEMPO_ESGOTADO/.test(e.message)) {
        await registrar(page, 'TRAVOU', 'A página não responde há 15s (loop infinito ou trava pesada)');
        break;
      }
      await sleep(500); // navegando/recarregando
      continue;
    }

    if (f === 'xss') {
      await registrar(page, 'XSS', 'Um nome com HTML/JS foi executado na página (window.__chaosXss foi definido)');
      await page.evaluate(() => (window.__chaosXss = 0));
    }

    if (f === 'carregando') {
      if (Date.now() - carregandoDesde > 45_000) {
        await registrar(page, 'TRAVOU', 'Preso na tela de carregamento por mais de 45s');
        break;
      }
      await sleep(300);
      continue;
    }
    carregandoDesde = Date.now();

    try {
      if (f === 'criacao') {
        acoesNaCriacao++;
        // se ficou muito tempo enrolando na criação, força entrar no jogo
        const a = acoesNaCriacao > 25 ? ACOES_CRIACAO[chance(0.5) ? 1 : 2] : pickWeighted(ACOES_CRIACAO);
        await comTempo(a.run(page, perfil.touch), 60_000);
      } else {
        acoesNaCriacao = 0;
        const a = pickWeighted(acoesNoJogo);
        await comTempo(a.run(page, perfil.touch), 120_000);
      }
    } catch (e) {
      if (/TEMPO_ESGOTADO/.test(e.message)) {
        anotar('acao-demorou-demais');
      } else if (/Target (page|closed)|has been closed|crash/i.test(e.message)) break;
      // outros erros do Playwright (elemento sumiu no meio do clique etc.) são normais no caos
    }
    await pausa(20, 400);

    // ---- checagens
    const agora = Date.now();
    if (agora - ultimaChecagem > 2000 && f === 'jogo') {
      ultimaChecagem = agora;
      let r;
      try {
        r = await comTempo(
          page.evaluate(checarRegras, { levelCap: progression.levelCap, xpToNext: progression.xpToNext }),
          15000,
        );
      } catch (e) {
        if (/TEMPO_ESGOTADO/.test(e.message)) {
          await registrar(page, 'TRAVOU', 'A página não responde há 15s durante a checagem');
          break;
        }
        continue;
      }
      if (r?.ok) {
        const agoraVistos = new Set();
        for (const p of r.problemas) {
          agoraVistos.add(p.chave);
          if (p.imediato || pendentes.has(p.chave)) await registrar(page, 'ESTADO', p.msg, { detalhes: p.dados });
          else pendentes.set(p.chave, p);
        }
        for (const k of [...pendentes.keys()]) if (!agoraVistos.has(k)) pendentes.delete(k);

        // o mundo parou? (o jogo desenha, mas o tempo do jogo não anda)
        if (r.tempoMundo !== ultimoTempoMundo) {
          ultimoTempoMundo = r.tempoMundo;
          tempoParadoDesde = agora;
        } else if (agora - tempoParadoDesde > 90_000 && !r.painelAberto) {
          await registrar(page, 'AVISO', 'O tempo do mundo não anda há 90s (jogo pausado ou congelado?)');
          tempoParadoDesde = agora;
        }
        // parou de desenhar?
        if (r.batida !== ultimaBatida) {
          ultimaBatida = r.batida;
          batidaParadaDesde = agora;
        } else if (agora - batidaParadaDesde > 20_000) {
          await registrar(page, 'TRAVOU', 'A tela parou de ser desenhada há 20s');
          batidaParadaDesde = agora;
        }
      }
    }
    if (agora - ultimaMedida > 60_000 && f === 'jogo') {
      ultimaMedida = agora;
      const m = await comTempo(page.evaluate(medir), 10000).catch(() => null);
      if (m) {
        m.tempo = decorrido();
        m.sessao = sessao;
        metricas.push(m);
        medidasSessao.push(m);
        appendFileSync(join(PASTA, 'metricas.csv'), `${m.tempo},${m.sessao},${m.heapMb},${m.dom},${m.objetos}\n`);
        checarVazamento(page, medidasSessao);
      }
      escreverRelatorio();
      const vivos = [...bugs.values()].length;
      process.stdout.write(
        `\r[${decorrido()}] sessão ${sessao} · ${acoesTotal} ações · ${vivos} problema(s) · memória ${m?.heapMb ?? '?'} MB   `,
      );
    }
  }
  await ctx.close().catch(() => {});
}

// memória/objetos que só sobem ao longo de uma sessão
function checarVazamento(page, ms) {
  if (ms.length < 10) return;
  const ini = ms.slice(0, 3),
    fim = ms.slice(-3);
  const media = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
  for (const [k, nome, limite] of [
    ['heapMb', 'memória JS (MB)', 3],
    ['dom', 'elementos HTML', 2],
    ['objetos', 'objetos na cena do Phaser', 3],
  ]) {
    const a = media(ini, k),
      b = media(fim, k);
    if (a > 0 && b > a * limite && b - a > 50)
      void registrar(page, 'VAZAMENTO', `${nome} cresceu de ${Math.round(a)} para ${Math.round(b)} na mesma sessão`, {
        detalhes: ms.map((x) => ({ tempo: x.tempo, [k]: x[k] })),
      });
  }
}

// ---------------------------------------------------------------- principal

async function main() {
  console.log(
    `🤖 Robô do caos · semente ${OPT.semente} · ${OPT.minutos ? `${OPT.minutos} min` : 'sem fim (Ctrl+C para parar)'} · ${OPT.url}`,
  );
  console.log(`   relatório: ${join(PASTA, 'relatorio.md')}`);
  writeFileSync(join(PASTA, 'metricas.csv'), 'tempo,sessao,memoria_mb,elementos_html,objetos_cena\n');

  // confere se o jogo está no ar antes de começar
  try {
    const r = await fetch(OPT.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(
      `\n❌ Não consegui abrir ${OPT.url} (${e.message}).\n   O jogo está rodando? Abra outro terminal e rode:  npm run dev\n`,
    );
    process.exit(2);
  }

  const browser = await pw.chromium
    .launch({
      headless: !OPT.janela,
      executablePath: process.env.CHROME || undefined,
      args: ['--enable-precise-memory-info'],
    })
    .catch(() => pw.chromium.launch({ headless: !OPT.janela, executablePath: '/usr/bin/google-chrome' }));

  const fimGeral = OPT.minutos > 0 ? Date.now() + OPT.minutos * 60_000 : Infinity;
  let parar = 0;
  process.on('SIGINT', () => {
    if (++parar > 1) process.exit(130);
    console.log('\n⏹  Parando... (Ctrl+C de novo para sair na hora)');
    encerrando = true;
  });

  while (!encerrando && Date.now() < fimGeral) {
    try {
      await rodarSessao(browser, fimGeral);
    } catch (e) {
      console.error(`\n(sessão ${sessao} terminou com erro do robô: ${e.message})`);
      await sleep(2000);
    }
    if (!browser.isConnected()) {
      await registrar(null, 'CRASH', 'O navegador inteiro fechou');
      break;
    }
  }
  await browser.close().catch(() => {});
  escreverRelatorio(true);
  console.log(`\n\n✅ Fim. ${acoesTotal} ações em ${sessao} sessão(ões), ${bugs.size} problema(s) diferente(s).`);
  console.log(`   Relatório: ${join(PASTA, 'relatorio.md')}`);
  process.exit(0);
}

await main();
