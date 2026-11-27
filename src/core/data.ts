import classesJson from '../data/classes.json';
import monstersJson from '../data/monsters.json';
import progressionJson from '../data/progression.json';
import npcsJson from '../data/npcs.json';
import skinsJson from '../data/skins.json';
import mountsJson from '../data/mounts.json';
import relicsJson from '../data/relics.json';
import { L, localize } from './i18n';
import { balanceClasses, balanceMonsters, balanceProgression } from './balance';
import type { AttrKey, Attributes, DamageType, Element, ElementMap, ProjectileKind } from './types';

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  rangeLabel: string;
  damageType: DamageType;
  element: Element;
  attackRange: number;
  attackWhileMoving?: boolean;
  attackInterval: number;
  moveSpeed: number;
  color: string;
  baseAttributes: Attributes;
  levelUpAttributes: Attributes;
  elementAttack: Partial<ElementMap>;
  recommended: { attr: AttrKey; reason: string }[];
  optional: { attr: AttrKey; reason: string }[];
  recommendedRatio: Partial<Record<AttrKey, number>>;
  lifeSteal?: number; // fração do dano causado que volta como vida (Tormenta, marco 7)
}
export interface MonsterDef {
  id: string;
  name: string;
  sprite: string;
  minLevel: number;
  maxLevel: number;
  baseAttributes: Attributes;
  perLevel: Attributes;
  damageType: DamageType;
  aggroRange: number;
  leashRange: number;
  attackRange: number;
  attackInterval: number;
  moveSpeed: number;
  xpBase: number;
  xpPerLevel: number;
  respawnSeconds: number;
  scale?: number; // tamanho do sprite
  defMul?: { phys: number; spirit: number }; // multiplicadores sobre a defesa derivada
  keepDistance?: number; // arqueiro: recua se o jogador chegar mais perto que isso
  projectile?: ProjectileKind;
  onHit?: { slow: number; duration: number }; // golpe normal deixa o alvo lento (Espectro de gelo)
  /** golpe em área marcado no chão em volta do próprio monstro (Yeti), além do ataque normal */
  slam?: { radius: number; delay: number; mult: number; interval: number };
  groupAggro?: boolean; // monstros do mesmo grupo (propriedade "group" do mapa) entram juntos
  /** resistência a veneno (0–0,9): reduz o veneno das skills e o dano elemental de veneno (nível 30: inimigos da
   *  seita da Serpente de Jade, espíritos e estátuas) */
  poisonRes?: number;
  boss?: {
    arenaRadius: number; // área do chefe (leash e auto-combate evita)
    aoe: { radius: number; delay: number; mult: number; interval: number; intervalPhase2: number };
    summon?: { monsterId: string; count: number; level: number; atHpPct: number };
    /** fúria (Patriarca Profanado): abaixo de atHpPct da vida ataca mais rápido, bate mais forte e anda mais rápido */
    enrage?: { atHpPct: number; attackIntervalMul: number; damageMul: number; moveSpeedMul: number };
    /** golpe em linha (Rei dos Bandidos): os golpes marcados alternam círculo e linha saindo do chefe na direção do
     * jogador; abaixo de fanAtHpPct da vida a linha vira leque de fanCount linhas separadas por fanSpread rad */
    line?: {
      length: number;
      width: number;
      delay: number;
      mult: number;
      fanAtHpPct: number;
      fanCount: number;
      fanSpread: number;
    };
  };
  loot?: {
    gold?: { min: number; max: number; perLevel?: number }; // perLevel: soma (nível-1)*perLevel aos dois limites
    potions?: { id: string; chance: number; minMonsterLevel?: number }[];
    materials?: { id: string; chance: number; min?: number; max?: number }[]; // forja (marco 9)
    equipment?: EquipDrop | EquipDrop[];
    guaranteed?: { rarity: 'comum' | 'incomum' | 'raro'; reqLevel: number }; // 1 item garantido (slot aleatório)
  };
}
export interface EquipDrop {
  chance: number;
  maxReqLevel: number;
  minReqLevel?: number;
  minMonsterLevel?: number;
}
export interface Progression {
  levelCap: number;
  xpToNext: number[];
  freePointsPerLevel: number;
  /** A partir deste nível, cada nível dá estes pontos livres em vez de freePointsPerLevel (nível 30: 4 do 21 ao 30). */
  freePointsHigh?: { fromLevel: number; points: number };
  /** Ouro cobrado pelo Monge do Pagode (Cidadela) para devolver todos os pontos livres distribuídos. */
  attrResetCost: number;
}

export const CLASSES = localize('classes', classesJson) as unknown as Record<string, ClassDef>;
export const MONSTERS = localize('monsters', monstersJson) as unknown as Record<string, MonsterDef>;
export const PROGRESSION = progressionJson as Progression;
// multiplicadores de src/data/balance.json (ver src/core/balance.ts)
balanceClasses(CLASSES);
balanceMonsters(MONSTERS);
balanceProgression(PROGRESSION);

/** subida de nível: o jogador fica parado fazendo a pose (só visual; o auto espera). A animação "levelup" (8 quadros a
 *  12 fps, 0,65 s) toca e o último quadro fica parado até completar este tempo (3× a animação). */
export const LEVELUP_POSE_S = 1.95;
/** XP guardada: o jogador sobe de nível quando quiser (botão no HUD); a XP acumula até este número de níveis prontos
 *  e o excesso se perde ("XP cheia"). */
export const XP_BANK_LEVELS = 3;

/** XP máxima guardada no nível `level`: a soma do necessário para os próximos XP_BANK_LEVELS níveis (até o máximo). */
export function xpBankCap(level: number): number {
  let sum = 0;
  for (let l = level; l < Math.min(PROGRESSION.levelCap, level + XP_BANK_LEVELS); l++)
    sum += PROGRESSION.xpToNext[l - 1];
  return sum;
}

/** Quantos níveis a XP guardada `xp` já paga, a partir de `level`. */
export function levelsReadyFor(level: number, xp: number): number {
  let n = 0;
  for (let l = level; l < PROGRESSION.levelCap && xp >= PROGRESSION.xpToNext[l - 1]; l++, n++)
    xp -= PROGRESSION.xpToNext[l - 1];
  return n;
}

/** Pontos livres ganhos ao chegar ao nível `level` (3 até o 20; 4 do 21 ao 30). */
export function freePointsAt(level: number): number {
  const h = PROGRESSION.freePointsHigh;
  return h && level >= h.fromLevel ? h.points : PROGRESSION.freePointsPerLevel;
}
/** Total de pontos livres de um personagem no nível `level` (sem gastar nenhum). */
export function totalFreePoints(level: number): number {
  let n = 0;
  for (let l = 2; l <= level; l++) n += freePointsAt(l);
  return n;
}

// Falas dos NPCs da cidade e dos mestres das seitas (também usadas na criação de personagem)
export interface MasterText {
  name: string;
  title: string;
  greeting: string;
  intro: string;
  tips?: string[];
  locked?: string;
}
export interface NpcText {
  name: string;
  lines: string[];
}
export const NPC_TEXT = localize('npcs', npcsJson) as unknown as {
  masters: Record<string, MasterText>;
  npcs: Record<string, NpcText>;
};
/** Seitas na ordem da criação: jogáveis primeiro, depois as que ainda virão. */
/** Skin (traje) do jogador: troca só o desenho, sem efeito no combate. Vendida pelo Governador Bai (Cidadela),
 * apenas para a própria seita. A folha de sprites tem o mesmo nome do id (tools/sprites/<id>.json). */
export interface SkinDef {
  sect: string;
  name: string;
  desc: string;
  price: number;
}
export const SKINS = localize('skins', skinsJson) as unknown as Record<string, SkinDef>;

/** Montaria: mais velocidade fora de combate (speedBonus, × balance `montaria.velocidade`). Vendida no estábulo
 * (Cavalariço Ma). Monta sozinha mountDelay s depois do último golpe dado ou recebido; desmonta ao entrar em combate.
 * A folha de sprites tem o mesmo nome do id (tools/sprites/<id>.json). */
export interface MountDef {
  name: string;
  desc: string;
  price: number;
  speedBonus: number;
  mountDelay: number;
}
export const MOUNTS = localize('mounts', mountsJson) as unknown as Record<string, MountDef>;

/** Relíquia (Porto Noturno, etapa 4): 1 espaço no personagem; atributos fixos (somam como equipamento) + 1 efeito.
 * Comum/rara: Antiquário Lao; lendária: drop de chefe. Sem durabilidade, forja nem gemas. */
export type RelicRarity = 'comum' | 'rara' | 'lendaria';
export type RelicEffectKind =
  | 'lifeSteal'
  | 'attackSpeed'
  | 'cooldown'
  | 'maxHpPct'
  | 'lastBreath' // abaixo de `below` da vida: cura `value` da vida máx. em `duration` s (recarga `cooldown`)
  | 'shieldPulse' // escudo de `value` da vida máx. a cada `every` s
  | 'skillRhythm'; // a cada `every` skills, a seguinte causa +`value` de dano
/** Atributos de PvP das relíquias (frações): tenacidade (controles duram menos), resiliência (menos dano crítico
 * recebido), penetração (ignora parte da defesa do alvo). */
export const RELIC_PVP_STATS = ['tenacity', 'resilience', 'penetration'] as const;
export type RelicPvpStat = (typeof RELIC_PVP_STATS)[number];
export interface RelicDef {
  name: string;
  desc: string;
  icon: string;
  rarity: RelicRarity;
  price: number;
  stats: Record<string, number>;
  effect: {
    kind: RelicEffectKind;
    value: number;
    below?: number;
    duration?: number;
    cooldown?: number;
    every?: number;
  };
  /** lendária: chefe que dá os fragmentos */
  boss?: string;
}
const RJ = localize('relics', structuredClone(relicsJson)) as unknown as {
  slotName: string;
  reqLevel: number;
  rarities: Record<RelicRarity, { name: string; color: string }>;
  drop: {
    minPlayerLevel: number;
    fragments: number;
    perKill: number;
    perKillDungeon: number;
    fullChance: number;
    fragmentPrice: number;
  };
  list: Record<string, RelicDef>;
};
export const RELICS = RJ.list,
  RELIC_RARITIES = RJ.rarities,
  RELIC_DROP = RJ.drop,
  RELIC_REQ_LEVEL = RJ.reqLevel,
  RELIC_SLOT_NAME = RJ.slotName;

const relicPct = (v: number) => `${+(v * 100).toFixed(1)}%`;

/** Texto do efeito único da relíquia. */
export function relicEffectText(r: RelicDef): string {
  const v = relicPct(r.effect.value);
  switch (r.effect.kind) {
    case 'lifeSteal':
      return L(`Roubo de vida +${v}`, `Life steal +${v}`);
    case 'attackSpeed':
      return L(`Velocidade de ataque +${v}`, `Attack speed +${v}`);
    case 'cooldown':
      return L(`Recarga das skills −${v}`, `Skill cooldowns −${v}`);
    case 'maxHpPct':
      return L(`Vida máxima +${v}`, `Max health +${v}`);
    case 'lastBreath': {
      const e = r.effect;
      return L(
        `Último fôlego: abaixo de ${relicPct(e.below ?? 0)} da vida, cura ${v} da vida máxima em ${e.duration} s (recarga ${e.cooldown} s)`,
        `Last breath: below ${relicPct(e.below ?? 0)} health, heals ${v} of max health over ${e.duration} s (${e.cooldown} s cooldown)`,
      );
    }
    case 'shieldPulse':
      return L(
        `Muralha imperial: escudo de ${v} da vida máxima a cada ${r.effect.every} s`,
        `Imperial wall: shield of ${v} of max health every ${r.effect.every} s`,
      );
    case 'skillRhythm':
      return L(
        `Ritmo do qilin: a cada ${r.effect.every} skills, a seguinte causa +${v} de dano`,
        `Qilin rhythm: every ${r.effect.every} skills, the next one deals +${v} damage`,
      );
  }
}

export const SECT_ORDER = ['lamina', 'pavilhao', 'tita', 'vibora'];
