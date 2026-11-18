// Módulo de balanceamento pela linha de comando: aumenta/diminui em porcentagem qualquer item de src/core/balance.ts.
// Grava em src/data/balance.json (multiplicadores + histórico). Os outros JSON de dados não são alterados.
//
//   npm run balance                              lista tudo e os valores atuais
//   npm run balance -- xp.monstros +10%          +10% sobre o valor atual (duas vezes +10% = +21%)
//   npm run balance -- dano.monstros.lobo -15%   só para um monstro (ou skill, seita, poção, missão, nível)
//   npm run balance -- xp.niveis =120%           define direto em 120% do valor original (também aceita =1.2)
//   npm run balance -- xp.monstros +10% ouro.monstros -5%   várias mudanças de uma vez
//   npm run balance -- zerar xp.monstros         volta ao original (zerar tudo = volta tudo)
//   npm run balance -- ver xp.monstros           mostra os números que a chave muda, sem alterar nada
//   npm run balance -- ids monstro               lista os ids aceitos (monstro, skill, seita, pocao, missao, nivel)
import { readFileSync, writeFileSync } from 'node:fs';
import {
  KNOBS,
  balanceItems,
  balanceMonsters,
  balanceProgression,
  balanceQuests,
  balanceSkills,
  balanceOffline,
  parseBalanceKey,
  setBalance,
  validateBalance,
  type BalanceFile,
  type BalanceScope,
  type Knob,
  type KnobKey,
  type Multipliers,
} from '../src/core/balance';
import { SKILL_MAX_LEVEL, skillScale, skillXpToNext } from '../src/core/skills';

// JSON lidos do disco (não importados): os módulos do jogo já aplicaram o balance.json nos objetos importados.
const raw = (f: string) => JSON.parse(readFileSync(`src/data/${f}.json`, 'utf8'));
const monstersJson = raw('monsters') as Record<string, Monster>;
const skillsJson = raw('skills') as Record<string, SkillRaw[]>;
const classesJson = raw('classes') as Record<string, unknown>;
const itemsJson = raw('items') as {
  sellRatio: number;
  repairCostPerPoint: number;
  wearPerHit: number;
  rarities: Record<string, { name: string; weight: number }>;
  potions: Record<string, { name: string; percent: number; price: number }>;
};
const questsJson = raw('quests') as { chain: { id: string; name: string; reward: { xp: number; gold: number } }[] };
const progressionJson = raw('progression') as { xpToNext: number[] };
interface Monster {
  name: string;
  minLevel: number;
  maxLevel: number;
  xpBase: number;
  xpPerLevel: number;
  respawnSeconds: number;
  loot?: {
    gold?: { min: number; max: number; perLevel?: number };
    potions?: { id: string; chance: number }[];
    equipment?: { chance: number } | { chance: number }[];
  };
}
interface SkillRaw {
  id: string;
  name: string;
  mana?: number;
  cooldown?: number;
  hits?: number[];
  poison?: { percent: number };
}

const FILE = 'src/data/balance.json';
const file = JSON.parse(readFileSync(FILE, 'utf8')) as BalanceFile;
file.multiplicadores ??= {};
file.historico ??= [];

const IDS: Record<BalanceScope, string[]> = {
  monstro: Object.keys(monstersJson),
  skill: Object.values(skillsJson)
    .flat()
    .map((s) => s.id),
  seita: Object.keys(classesJson),
  pocao: Object.keys(itemsJson.potions),
  missao: questsJson.chain.map((q) => q.id),
  nivel: progressionJson.xpToNext.map((_, i) => String(i + 1)),
};

const pct = (m: number) => {
  const d = Math.round((m - 1) * 1000) / 10;
  return d === 0 ? '0%' : `${d > 0 ? '+' : ''}${d}%`;
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fmt = (v: number) => String(Math.round(v * 100) / 100);
const die = (msg: string): never => {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
};

// ---------- prévia: os números que a chave muda, calculados com o código real do jogo ----------
function preview(full: string, m: Multipliers): string[] {
  setBalance(m);
  const p = parseBalanceKey(full)!;
  const only = (id: string) => p.id === undefined || p.id === id;
  const out: string[] = [];
  switch (p.key) {
    case 'xp.monstros':
    case 'ouro.monstros':
    case 'respawn.monstros':
    case 'drop.pocoes':
    case 'drop.equipamento': {
      const ms = clone(monstersJson);
      balanceMonsters(ms);
      for (const [id, d] of Object.entries(ms)) {
        if (!only(id)) continue;
        const lv = (l: number) => `nv ${l}`;
        if (p.key === 'xp.monstros')
          out.push(
            `${d.name}: ${[...new Set([d.minLevel, d.maxLevel])].map((l) => `${lv(l)} ${Math.round(d.xpBase + d.xpPerLevel * (l - 1))} XP`).join(' · ')}`,
          );
        if (p.key === 'ouro.monstros' && d.loot?.gold) {
          const g = d.loot.gold,
            add = (g.perLevel ?? 0) * (d.minLevel - 1);
          out.push(`${d.name}: ${Math.round(g.min + add)}–${Math.round(g.max + add)} ouro (${lv(d.minLevel)})`);
        }
        if (p.key === 'respawn.monstros') out.push(`${d.name}: ${d.respawnSeconds} s`);
        if (p.key === 'drop.pocoes' && d.loot?.potions)
          out.push(`${d.name}: ${d.loot.potions.map((x) => `${x.id} ${fmt(x.chance * 100)}%`).join(' · ')}`);
        if (p.key === 'drop.equipamento' && d.loot?.equipment) {
          const eq = d.loot.equipment;
          out.push(`${d.name}: ${(Array.isArray(eq) ? eq : [eq]).map((x) => `${fmt(x.chance * 100)}%`).join(' · ')}`);
        }
      }
      break;
    }
    case 'xp.niveis': {
      const pr = clone(progressionJson);
      balanceProgression(pr);
      out.push(pr.xpToNext.map((v, i) => `${i + 1}→${i + 2}: ${v}`).join(' · '));
      break;
    }
    case 'skills.mana':
    case 'skills.recarga':
    case 'dano.skills': {
      const sk = clone(skillsJson);
      balanceSkills(sk);
      for (const s of Object.values(sk).flat()) {
        if (!only(s.id)) continue;
        if (p.key === 'skills.mana' && s.mana !== undefined) out.push(`${s.name}: ${s.mana} mana`);
        if (p.key === 'skills.recarga' && s.cooldown !== undefined) out.push(`${s.name}: ${s.cooldown} s`);
        if (p.key === 'dano.skills' && (s.hits?.length || s.poison))
          out.push(
            `${s.name}: ${[...(s.hits ?? []).map((h) => `${fmt(h * 100)}%`), ...(s.poison ? [`veneno ${fmt(s.poison.percent * 100)}%`] : [])].join(' + ')}`,
          );
      }
      break;
    }
    case 'precos.pocoes':
    case 'cura.pocoes':
    case 'venda.itens':
    case 'conserto.custo':
    case 'desgaste.equipamento':
    case 'drop.raros': {
      const it = clone(itemsJson);
      balanceItems(it);
      if (p.key === 'precos.pocoes' || p.key === 'cura.pocoes')
        for (const [id, d] of Object.entries(it.potions))
          if (only(id))
            out.push(p.key === 'precos.pocoes' ? `${d.name}: ${d.price} ouro` : `${d.name}: ${fmt(d.percent * 100)}%`);
      if (p.key === 'venda.itens') out.push(`venda = ${fmt(it.sellRatio * 100)}% do valor`);
      if (p.key === 'conserto.custo') out.push(`${fmt(it.repairCostPerPoint)} ouro por ponto × nível do item`);
      if (p.key === 'desgaste.equipamento') out.push(`${fmt(it.wearPerHit)} de durabilidade por golpe recebido`);
      if (p.key === 'drop.raros') {
        const tot = Object.values(it.rarities).reduce((a, r) => a + r.weight, 0);
        out.push(
          Object.values(it.rarities)
            .map((r) => `${r.name} ${fmt((r.weight / tot) * 100)}%`)
            .join(' · '),
        );
      }
      break;
    }
    case 'xp.missoes':
    case 'ouro.missoes': {
      const q = clone(questsJson);
      balanceQuests(q.chain);
      const k = p.key === 'xp.missoes' ? 'xp' : 'gold';
      const sel = q.chain.filter((x) => only(x.id));
      out.push(
        `${sel.length === 1 ? sel[0].name : 'total da cadeia'}: ${sel.reduce((a, x) => a + x.reward[k], 0)} ${k === 'xp' ? 'XP' : 'ouro'}`,
      );
      break;
    }
    case 'xp.skills':
    case 'skills.bonus_por_nivel':
      out.push(
        p.key === 'xp.skills'
          ? `usos para subir: ${Array.from({ length: SKILL_MAX_LEVEL - 1 }, (_, i) => `${i + 1}→${i + 2}: ${skillXpToNext(i + 1)}`).join(' · ')}`
          : `skill nível 10 = ${fmt(skillScale(10) * 100)}% do efeito do nível 1`,
      );
      break;
    case 'offline.eficiencia': {
      const tiers = [{ eff: 0.6 }, { eff: 0.4 }, { eff: 0.2 }];
      balanceOffline(tiers);
      out.push(
        `até 12 h ${fmt(tiers[0].eff * 100)}% · 12–18 h ${fmt(tiers[1].eff * 100)}% · 18–24 h ${fmt(tiers[2].eff * 100)}%`,
      );
      break;
    }
    default:
      out.push(`multiplicador ×${fmt(bal(full, m))} na fórmula do jogo`);
  }
  return out;
}
const bal = (full: string, m: Multipliers) => {
  const p = parseBalanceKey(full)!;
  return (m[p.key] ?? 1) * (p.id ? (m[full] ?? 1) : 1);
};

function showDiff(full: string, before: Multipliers, after: Multipliers) {
  const a = preview(full, before),
    b = preview(full, after);
  const shown = b.map((line, i) => (line === a[i] ? `    ${line}` : `    ${a[i]}\n      → ${line}`));
  const max = 14;
  console.log(shown.slice(0, max).join('\n'));
  if (shown.length > max) console.log(`    … e mais ${shown.length - max}`);
}

// ---------- comandos ----------
function list() {
  const m = file.multiplicadores;
  let grupo = '';
  console.log('\nBalanceamento (src/data/balance.json). 0% = valor original dos JSON.\n');
  for (const [k, def] of Object.entries(KNOBS) as [KnobKey, Knob][]) {
    if (def.grupo !== grupo) console.log(`${(grupo = def.grupo)}`);
    const extra = Object.keys(m)
      .filter((x) => x.startsWith(k + '.') && parseBalanceKey(x)?.key === k)
      .map((x) => `${x.slice(k.length + 1)} ${pct(m[x])}`);
    console.log(
      `  ${k.padEnd(24)} ${pct(m[k] ?? 1).padStart(7)}  ${def.desc}${def.scope ? ` [por ${def.scope}]` : ''}` +
        (extra.length ? `\n  ${''.padEnd(24)}          específicos: ${extra.join(', ')}` : ''),
    );
  }
  if (file.historico.length) {
    console.log('\nÚltimas mudanças:');
    for (const h of file.historico.slice(-8)) console.log(`  ${h.data}  ${h.chave}: ${pct(h.de)} → ${pct(h.para)}`);
  }
  console.log('\nUso: npm run balance -- <chave> +10%   (veja o topo de tools/balance.ts)\n');
}

function save(changes: { full: string; to: number }[]) {
  const before = { ...file.multiplicadores },
    after = { ...before };
  for (const c of changes) {
    const v = Math.round(c.to * 1e6) / 1e6;
    if (Math.abs(v - 1) < 1e-9) delete after[c.full];
    else after[c.full] = v;
  }
  const errs = validateBalance(after, IDS);
  if (errs.length) die(errs.join('\n  '));
  const today = new Date().toISOString().slice(0, 10);
  for (const c of changes) {
    const de = before[c.full] ?? 1,
      para = after[c.full] ?? 1;
    if (de === para) continue;
    file.historico.push({ data: today, chave: c.full, de, para });
    console.log(`\n${c.full}: ${pct(de)} → ${pct(para)}  (${(KNOBS[parseBalanceKey(c.full)!.key] as Knob).desc})`);
    showDiff(c.full, before, after);
  }
  // ordem das chaves igual à da lista, para o diff do git ficar legível
  const order = Object.keys(KNOBS);
  const sorted: Multipliers = {};
  for (const k of Object.keys(after).sort(
    (a, b) => order.indexOf(parseBalanceKey(a)!.key) - order.indexOf(parseBalanceKey(b)!.key) || a.localeCompare(b),
  ))
    sorted[k] = after[k];
  file.multiplicadores = sorted;
  // histórico com uma mudança por linha
  const hist = file.historico.map((h) => `    ${JSON.stringify(h)}`).join(',\n');
  const text = JSON.stringify({ ...file, historico: [] }, null, 2).replace(
    '"historico": []',
    file.historico.length ? `"historico": [\n${hist}\n  ]` : '"historico": []',
  );
  writeFileSync(FILE, text + '\n');
  console.log('\nGravado em src/data/balance.json. Confira o efeito com: npm run sim:balance\n');
}

function checkKey(full: string): string {
  const p = parseBalanceKey(full);
  if (!p) die(`Chave desconhecida: "${full}". Rode "npm run balance" para ver a lista.`);
  if (p!.id !== undefined) {
    const scope = (KNOBS[p!.key] as Knob).scope!;
    if (!IDS[scope].includes(p!.id)) die(`"${p!.id}" não é ${scope} válido. Aceitos: ${IDS[scope].join(', ')}`);
  }
  return full;
}

const args = process.argv.slice(2);
if (!args.length || args[0] === 'listar') list();
else if (args[0] === 'ids') {
  const s = args[1] as BalanceScope;
  if (!IDS[s]) die(`Escopos: ${Object.keys(IDS).join(', ')}`);
  console.log(`\n${s}: ${IDS[s].join(', ')}\n`);
} else if (args[0] === 'ver') {
  const full = checkKey(args[1] ?? '');
  console.log(`\n${full}: ${pct(bal(full, file.multiplicadores))}`);
  console.log(
    preview(full, file.multiplicadores)
      .map((l) => `    ${l}`)
      .join('\n') + '\n',
  );
} else if (args[0] === 'zerar' || args[0] === 'reset') {
  const target = args[1];
  if (!target) die('Use: zerar <chave> ou zerar tudo');
  const keys =
    target === 'tudo'
      ? Object.keys(file.multiplicadores)
      : Object.keys(file.multiplicadores).filter(
          (k) =>
            k === checkKey(target) ||
            (k.startsWith(target + '.') && !parseBalanceKey(target)!.id && parseBalanceKey(k)!.key === target),
        );
  if (!keys.length) die('Nada para zerar: já está no valor original.');
  save(keys.map((full) => ({ full, to: 1 })));
} else {
  if (args.length % 2) die('Use pares <chave> <mudança>, ex.: xp.monstros +10%');
  const changes: { full: string; to: number }[] = [];
  const pending = { ...file.multiplicadores };
  for (let i = 0; i < args.length; i += 2) {
    const full = checkKey(args[i]),
      op = args[i + 1].replace(',', '.');
    const cur = pending[full] ?? 1;
    let to: number;
    const rel = /^([+-])(\d+(?:\.\d+)?)%$/.exec(op),
      abs = /^=(\d+(?:\.\d+)?)(%?)$/.exec(op);
    if (rel) to = cur * (1 + (rel[1] === '-' ? -1 : 1) * (Number(rel[2]) / 100));
    else if (abs) to = abs[2] ? Number(abs[1]) / 100 : Number(abs[1]);
    else die(`Mudança inválida: "${args[i + 1]}". Use +10%, -15%, =120% ou =1.2`);
    if (!(to! > 0)) die(`${full}: o resultado precisa ser maior que 0% (deu ${pct(to!)})`);
    pending[full] = to!;
    changes.push({ full, to: to! });
  }
  save(changes);
}
