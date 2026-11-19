import classesJson from '../data/classes.json';
import monstersJson from '../data/monsters.json';
import progressionJson from '../data/progression.json';
import npcsJson from '../data/npcs.json';
import { localize } from './i18n';
import { balanceClasses, balanceMonsters, balanceProgression } from './balance';
import type { AttrKey, Attributes, DamageType, Element, ElementMap } from './types';

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
  projectile?: 'arrow' | 'ice';
  onHit?: { slow: number; duration: number }; // golpe normal deixa o alvo lento (Espectro de gelo)
  /** golpe em área marcado no chão em volta do próprio monstro (Yeti), além do ataque normal */
  slam?: { radius: number; delay: number; mult: number; interval: number };
  groupAggro?: boolean; // monstros do mesmo grupo (propriedade "group" do mapa) entram juntos
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
}

export const CLASSES = localize('classes', classesJson) as unknown as Record<string, ClassDef>;
export const MONSTERS = localize('monsters', monstersJson) as unknown as Record<string, MonsterDef>;
export const PROGRESSION = progressionJson as Progression;
// multiplicadores de src/data/balance.json (ver src/core/balance.ts)
balanceClasses(CLASSES);
balanceMonsters(MONSTERS);
balanceProgression(PROGRESSION);

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
export const SECT_ORDER = ['lamina', 'pavilhao', 'tita', 'vibora'];
