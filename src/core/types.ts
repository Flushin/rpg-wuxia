export type Element = 'fire' | 'ice' | 'thunder' | 'poison';
/** Projétil dos monstros à distância: flecha, gelo (espectro), veneno (Serpente de Jade), qi (Grou Espiritual). */
export type ProjectileKind = 'arrow' | 'ice' | 'poison' | 'qi' | 'fire';
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'poison'];
export type AttrKey = 'strength' | 'intelligence' | 'stamina' | 'agility' | 'willpower';
export const ATTR_KEYS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
export type Attributes = Record<AttrKey, number>;
export type ElementMap = Record<Element, number>;
export type DamageType = 'physical' | 'spiritual';
export interface Point {
  x: number;
  y: number;
}

export type Slot = 'colar' | 'tronco' | 'arma' | 'cabeca' | 'calca' | 'bota';
/** epico: sem nível próprio, acompanha o do personagem; drop próprio, fora do sorteio de raridade. */
export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico';
export interface Bonus {
  stat: string;
  value: number;
}
// Instância de item. Poções usam qty (empilham); equipamentos usam rarity/bonuses/durability.
export interface ItemInstance {
  uid: string;
  baseId: string;
  rarity: Rarity;
  bonuses: Bonus[];
  ilvl: number;
  durability: number;
  qty?: number;
  /** melhoria do ferreiro (+1 a +10, marco 9); sem = +0 */
  plus?: number;
  /** trancado pelo jogador (cadeado): não pode ser vendido, destruído nem desmontado, nem pelo Auto */
  locked?: boolean;
  /** encaixes abertos pelo Ferreiro-mestre (Porto Noturno): id da gema ou null (vazio); sem = nenhum aberto */
  gems?: (string | null)[];
}
export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item?: ItemInstance;
  gold?: number;
  expires: number;
}
export type PotionKind = 'hp' | 'mp';

export interface Derived {
  maxHp: number;
  maxMana: number;
  physAtk: number;
  spiritAtk: number;
  physDef: number;
  spiritDef: number;
  hit: number;
  evasion: number;
  critChance: number;
  critDamage: number;
}

export type BuffKind = 'defReduction' | 'slow' | 'shield' | 'poison' | 'stun' | 'regen' | 'empower';
// value: fração (defReduction/slow), pontos de absorção restantes (shield), dano por segundo (poison),
// vida por segundo (regen), dano extra da próxima skill (empower, Pérola do Qilin); stun não usa value
export interface Buff {
  id: string;
  kind: BuffKind;
  value: number;
  remaining: number;
  duration: number;
  /** poison: segundos até o próximo tique de dano */
  tick?: number;
}
export type SkillFailReason = 'mana' | 'cooldown' | 'notarget' | 'locked' | 'blocked';

export type AiState = 'idle' | 'wander' | 'chase' | 'return';

export interface Entity {
  id: number;
  kind: 'player' | 'monster' | 'npc' | 'bot';
  name: string;
  level: number;
  x: number;
  y: number;
  hp: number;
  mana: number;
  dead: boolean;
  attrs: Attributes;
  derived: Derived;
  elemAtk: ElementMap;
  elemRes: ElementMap;
  damageType: DamageType;
  element: Element | null;
  attackRange: number;
  attackWhileMoving: boolean;
  attackInterval: number;
  attackCd: number;
  moveSpeed: number;
  path: Point[];
  repathCd: number;
  // monstros
  monsterId: string;
  home: Point;
  ai: AiState;
  aiTimer: number;
  respawnAt: number;
  buffs: Buff[];
  group: number; // 0 = sem grupo; monstros do mesmo grupo entram em combate juntos
  summoned: boolean;
  /** monstro: id de quem ele persegue (jogador ou bot da masmorra em equipe); sem = o mais próximo */
  foeId?: number;
  /** título mostrado acima do nome (arena) */
  title?: string;
  /** bot inimigo da arena (nome e vida em vermelho) */
  arenaFoe?: boolean;
  /** chefe em fúria (boss.enrage); volta ao normal quando a luta reseta */
  enraged?: boolean;
  /** chefe com golpe em linha (boss.line): quantos golpes marcados já deu, para alternar círculo e linha */
  strikes?: number;
  /** chefe do Trial: nível do Trial e XP; vida, ataque e defesas vêm de src/core/trial.ts */
  trial?: { tier: number; xp: number };
  spawnKey: string; // "mapa#índice" do ponto de spawn (renascimento com tempo); '' = sem ponto
  levels?: [number, number]; // faixa de nível do ponto do mapa (marco 9); sem = a do monstro
  // NPCs
  npcId: string; // id em npcs.json / papel (ferreiro, vendedor, mestre_lamina, morador1...)
  /** papel (loja) quando difere do personagem: prop role do NPC no mapa (ex.: ferreira_lin -> 'ferreiro') */
  npcRole?: string;
  wander: number; // raio em tiles para andar pela cidade (0 = parado)
  /** NPC parado: direção (0..7, 0 = olhando para a câmera) em que fica virado; prop face do NPC no mapa */
  face?: number;
  /** ponto onde o jogador para para conversar (prop spot do NPC no mapa; ex.: na frente do balcão da barraca) */
  spot?: Point;
}

export type GameEvent =
  | { type: 'attack'; fromId: number; toId: number; ranged: boolean; monster?: string }
  | {
      type: 'hit';
      targetId: number;
      targetKind: Entity['kind'];
      x: number;
      y: number;
      amount: number;
      crit: boolean;
      /** tique de veneno (número verde) */
      poison?: boolean;
    }
  | { type: 'miss'; targetId: number; targetKind: Entity['kind']; x: number; y: number }
  | { type: 'death'; id: number }
  | { type: 'kill'; monsterId: string; level?: number }
  | { type: 'quest'; kind: 'accepted' | 'progress' | 'ready' | 'completed'; questId: string; name: string }
  | { type: 'xp'; amount: number }
  /** points: pontos livres ganhos; pose: primeira do lote (pose + parado); replay: animação do ganho offline (sem aviso) */
  | { type: 'levelup'; level: number; points: number; pose: boolean }
  /** XP guardada pagou mais um nível: `ready` níveis prontos, o próximo é `level` */
  | { type: 'levelReady'; ready: number; level: number }
  /** XP cheia (XP_BANK_LEVELS níveis prontos): `lost` de XP se perdeu */
  | { type: 'xpFull'; lost: number }
  | { type: 'playerDeath' }
  | { type: 'mapChange'; mapId: string }
  | { type: 'portalLocked'; name: string; minLevel: number }
  /** pisou no Portal das Masmorras: a interface abre o menu de escolha (World.dungeonMenu) */
  | { type: 'dungeonMenu' }
  /** masmorra em equipe: bot bebeu poção, caiu, foi revivido */
  | { type: 'botPotion'; botId: number; kind: 'hp' | 'mp' }
  | { type: 'botDeath'; botId: number; name: string }
  | { type: 'botRevive'; botId: number; name: string }
  | { type: 'arenaStart'; botId: number; classId: string; power: number }
  | { type: 'arenaResult'; win: boolean; delta: number; points: number; coins: number }
  /** entrou numa masmorra (já pagou a entrada) */
  | { type: 'dungeonEnter'; dungeonId: string; cost: number; team?: boolean }
  | { type: 'teleport'; map: string; cost: number }
  /** chefe da masmorra derrotado */
  | { type: 'dungeonCleared'; dungeonId: string }
  /** pisou no portal do Trial (saída sul da vila): a interface abre o menu de chefe e nível (World.trialMenu) */
  | { type: 'trialMenu' }
  /** entrou no Trial (já pagou a entrada) */
  | { type: 'trialEnter'; bossId: string; tier: number; cost: number }
  /** venceu o chefe do Trial: o próximo nível desse chefe fica liberado */
  | { type: 'trialCleared'; bossId: string; tier: number }
  /** tentou ligar o Auto dentro de uma masmorra */
  | { type: 'autoBlocked' }
  | {
      type: 'skillCast';
      skillId: string;
      casterId: number;
      x: number;
      y: number;
      targetId: number | null;
      tx: number;
      ty: number;
      ranged: boolean;
    }
  | { type: 'skillFail'; skillId: string; reason: SkillFailReason }
  /** ultimate: start (pose), strike (cada raio), final (estouro); targets = monstros atingidos */
  | {
      type: 'ultimate';
      /** seita de quem soltou (ULTIMATES[sect]: efeito, cores e sons) */
      sect: string;
      phase: 'start' | 'strike' | 'final';
      x: number;
      y: number;
      radius: number;
      /** hit: só no estouro (false = errou; o efeito não pega) */
      targets: { x: number; y: number; hit?: boolean }[];
    }
  | { type: 'skillLevelUp'; skillId: string; level: number }
  | { type: 'skillUnlocked'; skillId: string }
  | { type: 'dash'; fromX: number; fromY: number; toX: number; toY: number }
  | {
      type: 'buffApplied';
      targetId: number;
      id: string;
      kind: BuffKind;
      duration: number;
      /** só renovou um efeito que o alvo já tinha */ refresh?: boolean;
    }
  /** broken: escudo esgotado pelo dano (não pelo tempo) */
  | { type: 'buffExpired'; targetId: number; id: string; kind: BuffKind; broken?: boolean }
  | { type: 'shieldAbsorb'; targetId: number; amount: number; x: number; y: number }
  | { type: 'drop'; x: number; y: number; color: string; epic?: boolean }
  /** caiu um Épico (aviso no centro, som) */
  | { type: 'epicDrop'; name: string }
  | { type: 'relicDrop'; name: string }
  | { type: 'relicFragment'; name: string; count: number; total: number }
  | { type: 'itemPickup'; baseId: string; name: string; color: string; qty: number; potion: boolean; rarity?: Rarity }
  | { type: 'goldPickup'; amount: number }
  | { type: 'bagFull'; tab?: 'equip' | 'pot' | 'mat' }
  | { type: 'groundGone'; id: number }
  | { type: 'equipChange' }
  | { type: 'potionUsed'; id: string; kind: PotionKind }
  | { type: 'potionFail'; kind: PotionKind; reason: 'none' | 'cooldown' | 'full' | 'arena' }
  | { type: 'npcOpen'; npcId: string; entityId: number }
  | { type: 'npcClose' }
  | { type: 'skinChange' }
  | { type: 'trade'; kind: 'buy' | 'sell'; gold: number }
  | { type: 'repair'; gold: number }
  | { type: 'forge'; kind: 'upgrade' | 'rarity' | 'reroll' | 'salvage'; success: boolean; plus: number; rarity: Rarity }
  | { type: 'durabilityLost' }
  | { type: 'autoState'; state: AutoState }
  | { type: 'autoStopped'; reason: 'broken' }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; kind: ProjectileKind }
  | { type: 'telegraph'; id: number; x: number; y: number; radius: number; delay: number; shape?: 'line' }
  | { type: 'telegraphResolved'; id: number; x: number; y: number; radius: number; hit: boolean }
  | { type: 'bossArena' }
  /** jogador entrou na arena com o chefe vivo (a cada entrada; bossArena só na primeira do mapa) */
  | { type: 'bossArenaEnter' }
  | { type: 'sealProgress'; left: number }
  | { type: 'sealOpen' }
  | { type: 'bossSummon'; ids: number[]; name: string }
  /** chefe entrou em fúria (boss.enrage) */
  | { type: 'bossEnrage'; id: number; name: string }
  | { type: 'bossDefeated'; name: string; respawnAt: number };

// Círculo de aviso no chão (golpe em área do chefe)
export interface Telegraph {
  id: number;
  x: number;
  y: number;
  radius: number;
  delay: number;
  remaining: number;
  ownerId: number;
  mult: number;
  /** golpe em linha (Rei dos Bandidos): retângulo que sai de (x, y) na direção angle, com length de comprimento e
   * meia-largura radius. Sem shape = círculo de raio radius centrado em (x, y). */
  shape?: 'line';
  angle?: number;
  length?: number;
}

export type AutoState = 'off' | 'on' | 'pausado';
export interface AutoConfig {
  skillsOff: string[]; // skills ativas desligadas no menu (o resto é usado)
  hpThreshold: number;
  mpThreshold: number; // % abaixo da qual bebe poção
  buyHp: number;
  buyMp: number; // quantidade comprada por viagem à vila
  sellIncomum: boolean;
  // escolha de alvo e revide (18/11/2026); os padrões reproduzem o comportamento antigo
  maxLevelAbove: number; // nível máximo dos alvos acima do personagem (0..5)
  grayMode: AutoGrayMode; // monstros 2+ níveis abaixo
  retaliate: AutoRetaliate; // revidar quem ataca
  onStrongAggro: AutoStrongAggro; // monstro acima do limite atacando (se não revida sempre)
  crowdAvoid: AutoCrowdAvoid; // peso de evitar atrair grupos
}
export type AutoGrayMode = 'last' | 'ignore' | 'normal';
export type AutoRetaliate = 'always' | 'inRange' | 'never';
export type AutoStrongAggro = 'keep' | 'flee' | 'town';
export type AutoCrowdAvoid = 'off' | 'low' | 'high';
// Balde de ~60 s de auto-combate ativo em mapa de caça (janela móvel de ~30 min)
export interface AutoBucket {
  sec: number;
  kills: number;
  xp: number;
  gold: number;
  potHp: number;
  potMp: number;
  levelSum: number;
  drops: Record<string, number>;
}
export interface AutoRate {
  killsPerMin: number;
  xpPerKill: number;
  goldPerKill: number;
  potHpPerKill: number;
  potMpPerKill: number;
  monLevel: number;
  sampleMin: number;
  drops: { baseId: string; rarity: Rarity; perKill: number }[];
}
export interface AutoSave {
  active: boolean;
  mapId: string;
  config?: Partial<AutoConfig>;
  buckets?: AutoBucket[];
}

export interface SaveData {
  version: number; // CHARACTER_SAVE_VERSION ao salvar; saves antigos passam por migrateCharacter (core/saveFormat.ts)
  name: string;
  classId: string;
  level: number;
  xp: number;
  freePoints: number;
  attributes: Attributes;
  mapId: string;
  lastSeen: number;
  ratioCursor?: number;
  seenTips?: string[];
  tipsEnabled?: boolean;
  skills?: Record<string, { level: number; xp: number }>;
  audio?: { sfx: number; music: number; muted: boolean };
  gold?: number;
  bag?: (ItemInstance | null)[];
  equipment?: Partial<Record<Slot, ItemInstance>>;
  auto?: AutoSave;
  bossRespawnAt?: number; // ms (relógio real) em que o General renasce (saves antigos; desde o marco 9 = bossRespawns.general_terracota)
  bossRespawns?: Record<string, number>; // id do chefe → ms (relógio real) em que renasce (marco 9)
  respawns?: Record<string, number>; // "mapa#índice" → ms (relógio real) em que o monstro comum renasce
  quest?: { stage: number; status: string; progress: number }; // cadeia principal de missões (marco 7)
  /** estoque do Mercador Ambulante (marco 9): janela de renovação e ofertas (item, preço, vendido) */
  /** Trial: maior nível vencido de cada chefe (id do chefe → 1–10) */
  trialProgress?: Record<string, number>;
  /** tempo de jogo em segundos (jogo aberto): com o auto ligado e desligado */
  playTime?: { auto: number; manual: number };
  /** skins compradas (ids de skins.json) e a vestida (ausente = traje da seita) */
  skins?: string[];
  skin?: string;
  /** montarias compradas (ids de mounts.json); a primeira é a usada */
  mounts?: string[];
  /** relíquias obtidas (ids de relics.json) e a equipada */
  relics?: string[];
  relic?: string;
  /** fragmentos de relíquia lendária (id da relíquia → quantidade) */
  relicShards?: Record<string, number>;
  /** veterano da primeira versão (src/core/founder.ts): montaria escolhida (ausente = ainda não escolheu) */
  founder?: { mount?: string };
  /** arena do Porto Noturno (src/core/arena.ts): pontos, moeda, vitórias/derrotas, títulos comprados e o usado */
  arena?: { points: number; coins: number; wins: number; losses: number; titles: string[]; title?: string };
  merchant?: { period: number; offers: { item: ItemInstance; price: number; sold: boolean }[] };
}

/** Por que uma ação de inventário/loja/ferreiro não aconteceu. A interface traduz (src/ui/actionError.ts). */
export type ActionError =
  | { code: 'notEquippable' }
  | { code: 'needLevel'; level: number }
  | { code: 'sectOnly'; sect: string }
  | { code: 'bagFull' }
  | { code: 'noGold' }
  | { code: 'talkToSeller' }
  | { code: 'talkToBlacksmith' }
  | { code: 'cannotForge' }
  | { code: 'noMaterials' }
  | { code: 'talkToMerchant' }
  | { code: 'soldOut' }
  | { code: 'trialLocked' }
  | { code: 'epicLocked' }
  | { code: 'itemLocked' }
  | { code: 'talkToMonk' }
  | { code: 'nothingToReset' }
  | { code: 'talkToGovernor' }
  | { code: 'talkToJeweler' }
  | { code: 'talkToMasterSmith' }
  | { code: 'hasGems' }
  | { code: 'noSocket' }
  | { code: 'gemDuplicate' }
  | { code: 'socketsMax' }
  | { code: 'gemMaxLevel' }
  | { code: 'skinOwned' }
  | { code: 'talkToStable' }
  | { code: 'mountOwned' }
  | { code: 'noMount' }
  | { code: 'mountCombat' }
  | { code: 'talkToAntiquary' }
  | { code: 'relicOwned' }
  | { code: 'relicShards'; need: number }
  | { code: 'talkToArena' }
  | { code: 'titleOwned' }
  | { code: 'founderOnly' }
  | { code: 'arenaPoints'; points: number }
  | { code: 'arenaCoins' }
  | { code: 'relicNotOwned' };
