// Módulo de balanceamento: um lugar só para aumentar ou diminuir, em porcentagem, qualquer número do jogo.
//
// Os valores originais continuam nos JSON de src/data/ (monsters, skills, items, classes, quests, progression).
// src/data/balance.json guarda só multiplicadores por cima deles (1 = sem mudança, 1.1 = +10%, 0.8 = −20%).
// Mude pelo comando `npm run balance -- <chave> +10%` (tools/balance.ts), não à mão.
//
// Dois jeitos de aplicar:
//  - "dados": o multiplicador é aplicado nos dados uma vez, ao carregar (XP, ouro, preços, mana, recarga...).
//    Assim a interface, o auto-combate e o ganho offline já mostram e usam o número novo.
//  - "regra": o multiplicador entra na fórmula, no momento do uso (dano, vida, XP de skill...), via bal().
//
// Chave com id (ex.: xp.monstros.lobo) vale só para aquele monstro/skill/seita/poção/missão/nível
// e multiplica junto com a chave global (xp.monstros).
import balanceJson from '../data/balance.json';

export type BalanceScope = 'monstro' | 'skill' | 'seita' | 'pocao' | 'missao' | 'nivel';

export interface Knob {
  grupo: string;
  /** o que +10% faz, em uma frase */
  desc: string;
  /** tipo de id aceito depois da chave (xp.monstros.lobo); sem isso, só a chave global */
  scope?: BalanceScope;
}

export const KNOBS = {
  // Combate
  'dano.jogador': { grupo: 'Combate', desc: 'dano causado pelo jogador (golpes, skills e veneno)', scope: 'seita' },
  'dano.monstros': {
    grupo: 'Combate',
    desc: 'dano causado pelos monstros (golpes e círculos do chefe)',
    scope: 'monstro',
  },
  'dano.skills': { grupo: 'Combate', desc: 'porcentagem de dano das skills (golpes e veneno)', scope: 'skill' },
  'vida.jogador': { grupo: 'Combate', desc: 'vida máxima do jogador', scope: 'seita' },
  'vida.monstros': { grupo: 'Combate', desc: 'vida máxima dos monstros', scope: 'monstro' },
  'equipe.vida_comuns': {
    grupo: 'Combate',
    desc: 'masmorra em equipe (bots): vida dos monstros comuns (valor = multiplicador; 2.5 = 2,5× a vida)',
  },
  'equipe.vida_chefe': {
    grupo: 'Combate',
    desc: 'masmorra em equipe (bots): vida do chefe (valor = multiplicador; 3.5 = 3,5× a vida)',
  },
  'arena.poder_bot': {
    grupo: 'Combate',
    desc: 'arena: poder do bot por seita do JOGADOR (+ = bot mais forte; acerta o ponto de 50% de vitórias de cada seita)',
    scope: 'seita',
  },
  roubo_vida: { grupo: 'Combate', desc: 'roubo de vida da seita (Tormenta)', scope: 'seita' },
  'cura.pocoes': { grupo: 'Combate', desc: 'quanto as poções recuperam', scope: 'pocao' },
  // Progressão
  'xp.monstros': { grupo: 'Progressão', desc: 'XP que cada monstro dá', scope: 'monstro' },
  'xp.missoes': { grupo: 'Progressão', desc: 'XP das recompensas de missão', scope: 'missao' },
  'xp.niveis': {
    grupo: 'Progressão',
    desc: 'XP NECESSÁRIO para subir de nível (+ = níveis mais demorados); id = nível de origem',
    scope: 'nivel',
  },
  'xp.skills': { grupo: 'Progressão', desc: 'XP que as skills ganham por uso (+ = skills sobem mais rápido)' },
  'skills.bonus_por_nivel': { grupo: 'Progressão', desc: 'bônus que cada nível de skill dá (hoje +8% por nível)' },
  'skills.mana': { grupo: 'Progressão', desc: 'custo de mana das skills', scope: 'skill' },
  'skills.recarga': { grupo: 'Progressão', desc: 'tempo de recarga das skills', scope: 'skill' },
  // Economia
  'ouro.monstros': { grupo: 'Economia', desc: 'ouro que os monstros soltam', scope: 'monstro' },
  'ouro.missoes': { grupo: 'Economia', desc: 'ouro das recompensas de missão', scope: 'missao' },
  'precos.pocoes': { grupo: 'Economia', desc: 'preço de compra das poções', scope: 'pocao' },
  'venda.itens': { grupo: 'Economia', desc: 'ouro recebido ao vender itens' },
  'conserto.custo': { grupo: 'Economia', desc: 'custo de conserto' },
  'desgaste.equipamento': { grupo: 'Economia', desc: 'durabilidade perdida por golpe recebido e por morte' },
  'montaria.velocidade': { grupo: 'Mundo', desc: 'bônus de velocidade da montaria fora de combate' },
  // Drops
  'drop.pocoes': { grupo: 'Drops', desc: 'chance de os monstros soltarem poções', scope: 'monstro' },
  'drop.equipamento': { grupo: 'Drops', desc: 'chance de os monstros soltarem equipamento', scope: 'monstro' },
  'drop.raros': { grupo: 'Drops', desc: 'peso de Incomum e Raro no sorteio de raridade (Comum fica igual)' },
  'drop.materiais': { grupo: 'Drops', desc: 'chance de os monstros soltarem materiais de forja', scope: 'monstro' },
  // Forja e Mercador (marco 9)
  'forja.ouro': { grupo: 'Forja', desc: 'ouro cobrado pela forja do ferreiro (melhorar, raridade, trocar bônus)' },
  'forja.chance': { grupo: 'Forja', desc: 'chance de sucesso de melhorar um item (máximo 100%)' },
  'mercador.precos': { grupo: 'Forja', desc: 'preços do Mercador Ambulante' },
  // Mundo
  'respawn.monstros': { grupo: 'Mundo', desc: 'tempo para o monstro renascer (+ = demora mais)', scope: 'monstro' },
  'offline.eficiencia': { grupo: 'Mundo', desc: 'eficiência do ganho offline (máximo 100%)' },
  'offline.teto_ouro': {
    grupo: 'Mundo',
    desc: 'teto de ouro por volta do offline (hoje: 3 h de ouro de caça no ritmo medido, abates + vendas)',
  },
} satisfies Record<string, Knob>;

export type KnobKey = keyof typeof KNOBS;
export type Multipliers = Record<string, number>;

export interface BalanceChange {
  data: string;
  chave: string;
  de: number;
  para: number;
}
export interface BalanceFile {
  _doc?: string[];
  multiplicadores: Multipliers;
  historico: BalanceChange[];
}

let MULT: Multipliers = { ...(balanceJson as BalanceFile).multiplicadores };

/** Multiplicador efetivo: global × específico do id (se houver). */
export function bal(key: KnobKey, id?: string | number): number {
  const g = MULT[key] ?? 1;
  return id === undefined || id === '' ? g : g * (MULT[`${key}.${id}`] ?? 1);
}

/** Troca os multiplicadores em uso (testes). Os dados já carregados não são recalculados. */
export function setBalance(m: Multipliers) {
  MULT = { ...m };
}
export const currentBalance = (): Multipliers => ({ ...MULT });

/** Separa "xp.monstros.lobo" em chave + id. null = chave desconhecida. */
export function parseBalanceKey(full: string): { key: KnobKey; id?: string } | null {
  let best: KnobKey | null = null;
  for (const k of Object.keys(KNOBS) as KnobKey[])
    if ((full === k || full.startsWith(k + '.')) && (!best || k.length > best.length)) best = k;
  if (!best) return null;
  const id = full.slice(best.length + 1);
  if (!id) return { key: best };
  return 'scope' in KNOBS[best] ? { key: best, id } : null;
}

/** Erros de um conjunto de multiplicadores (chave inexistente, id inexistente, valor inválido). */
export function validateBalance(m: Multipliers, ids: Record<BalanceScope, string[]>): string[] {
  const errs: string[] = [];
  for (const [full, v] of Object.entries(m)) {
    const p = parseBalanceKey(full);
    if (!p) errs.push(`chave desconhecida: ${full}`);
    else if (p.id !== undefined) {
      const scope = (KNOBS[p.key] as Knob).scope!;
      if (!ids[scope].includes(p.id)) errs.push(`${full}: "${p.id}" não é ${scope} válido`);
    }
    if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) errs.push(`${full}: valor inválido (${v})`);
  }
  return errs;
}

// ---------- aplicação nos dados (uma vez, ao carregar) ----------
// Com todos os multiplicadores em 1, nenhum número muda (arredondar um inteiro × 1 dá o mesmo inteiro).

const r1 = (v: number) => Math.round(v * 10) / 10;

interface MonsterLike {
  xpBase: number;
  xpPerLevel: number;
  respawnSeconds: number;
  loot?: {
    gold?: { min: number; max: number; perLevel?: number };
    potions?: { chance: number }[];
    equipment?: { chance: number } | { chance: number }[];
    materials?: { chance: number }[];
  };
}
export function balanceMonsters(monsters: Record<string, MonsterLike>) {
  for (const [id, m] of Object.entries(monsters)) {
    const xp = bal('xp.monstros', id);
    m.xpBase *= xp; // fracionário de propósito: o total é arredondado no abate
    m.xpPerLevel *= xp;
    m.respawnSeconds = r1(m.respawnSeconds * bal('respawn.monstros', id));
    const L = m.loot;
    if (!L) continue;
    const g = bal('ouro.monstros', id);
    if (L.gold) {
      L.gold.min *= g;
      L.gold.max *= g;
      if (L.gold.perLevel) L.gold.perLevel *= g;
    }
    const dp = bal('drop.pocoes', id);
    for (const p of L.potions ?? []) p.chance = Math.min(1, p.chance * dp);
    const de = bal('drop.equipamento', id);
    for (const e of L.equipment ? (Array.isArray(L.equipment) ? L.equipment : [L.equipment]) : [])
      e.chance = Math.min(1, e.chance * de);
    const dm = bal('drop.materiais', id);
    for (const md of L.materials ?? []) md.chance = Math.min(1, md.chance * dm);
  }
}

export function balanceProgression(p: { xpToNext: number[] }) {
  p.xpToNext = p.xpToNext.map((v, i) => Math.max(1, Math.round(v * bal('xp.niveis', i + 1))));
}

interface SkillLike {
  id: string;
  mana?: number;
  cooldown?: number;
  hits?: number[];
  poison?: { percent: number };
}
export function balanceSkills(skills: Record<string, SkillLike[]>) {
  for (const s of Object.values(skills).flat()) {
    if (s.mana !== undefined) s.mana = Math.max(0, Math.round(s.mana * bal('skills.mana', s.id)));
    if (s.cooldown !== undefined) s.cooldown = r1(s.cooldown * bal('skills.recarga', s.id));
    const d = bal('dano.skills', s.id);
    if (s.hits) s.hits = s.hits.map((h) => h * d);
    if (s.poison) s.poison.percent *= d;
  }
}

export function balanceClasses(classes: Record<string, { lifeSteal?: number }>) {
  for (const [id, c] of Object.entries(classes)) if (c.lifeSteal) c.lifeSteal *= bal('roubo_vida', id);
}

export function balanceItems(j: {
  sellRatio: number;
  repairCostPerPoint: number;
  wearPerHit: number;
  rarities: Record<string, { weight: number }>;
  potions: Record<string, { percent: number; price: number }>;
  consumables: Record<string, { price: number }>;
  merchant: { priceMul: number; materials: Record<string, number> };
}) {
  const mp = bal('mercador.precos');
  j.merchant.priceMul *= mp;
  for (const id of Object.keys(j.merchant.materials))
    j.merchant.materials[id] = Math.max(1, Math.round(j.merchant.materials[id] * mp));
  for (const c of Object.values(j.consumables)) c.price = Math.max(1, Math.round(c.price * mp));
  j.sellRatio *= bal('venda.itens');
  j.repairCostPerPoint *= bal('conserto.custo');
  j.wearPerHit *= bal('desgaste.equipamento');
  for (const [id, r] of Object.entries(j.rarities)) if (id !== 'comum') r.weight *= bal('drop.raros');
  for (const [id, p] of Object.entries(j.potions)) {
    p.percent *= bal('cura.pocoes', id);
    p.price = Math.max(1, Math.round(p.price * bal('precos.pocoes', id)));
  }
}

export function balanceQuests(chain: { id: string; reward: { xp: number; gold: number } }[]) {
  for (const q of chain) {
    q.reward.xp = Math.round(q.reward.xp * bal('xp.missoes', q.id));
    q.reward.gold = Math.round(q.reward.gold * bal('ouro.missoes', q.id));
  }
}

export function balanceOffline(tiers: { eff: number }[]) {
  for (const t of tiers) t.eff = Math.min(1, t.eff * bal('offline.eficiencia'));
}
