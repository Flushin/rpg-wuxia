// Arena do Porto Noturno no mundo (regras em src/core/arena.ts; decisões em docs/decisoes/arena.md): o Mestre da
// Arena manda o jogador para o círculo de luta (mapa do Trial, sem chefe) contra um bot de outra seita, com a mesma
// IA dos bots da masmorra em equipe. Perder não é morrer: sem penalidade, o jogador volta ao Porto com a vida cheia.
import {
  titleWing,
  ARENA_COINS,
  ARENA_COUNTDOWN,
  ARENA_SPREAD,
  ARENA_TIME_LIMIT,
  ARENA_TITLES,
  arenaDelta,
  arenaPower,
  arenaDamageMul,
  scaleArenaBot,
} from '../arena';
import {
  botActives,
  botDrink,
  botThink,
  type BotAction,
  dist,
  makeBot,
  pickBotClasses,
  tickBot,
  type Bot,
} from '../bots';
import { findPath, isWalkable } from '../pathfinding';
import { TRIAL_MAP } from '../trial';
import type { ActionError } from '../types';
import type { World } from '../world';
import { BOT_MANA_REGEN, castBotSkill } from './party';

/** Lugares da luta no mapa do Trial (o círculo do meio) e a volta ao Porto (ao lado do Mestre da Arena). */
export const ARENA_SPOTS = { player: { x: 16, y: 12 }, bot: { x: 16, y: 6 } };
export const ARENA_RETURN = { map: 'porto', x: 80, y: 69 };
/** Segundos mostrando o resultado antes de voltar ao Porto. */
export const ARENA_END_DELAY = 3;

export interface ArenaFight {
  bot: Bot;
  /** força sorteada do bot (em pontos) e o poder dele em relação ao jogador */
  rating: number;
  power: number;
  t: number;
  over: boolean;
  endAt: number;
  /** manobra do bot (kite/recuo): destino e segundos restantes; espera até a próxima */
  move: { x: number; y: number; left: number; wait: number };
  /** multiplicador de todo dano na luta (arenaDamageMul) */
  dmg: number;
}

/** Seita do último adversário (só na sessão), para o sorteio não repetir. */
let lastFoeClass: string | null = null;

/** Entra na luta (falando com o Mestre da Arena). */
/** `test`: força a seita e o poder do bot (checagens e simulação). */
export function enterArena(w: World, test?: { classId?: string; power?: number }): ActionError | null {
  if (w.npcRole() !== 'arena') return { code: 'talkToArena' };
  if (w.player.dead || w.arenaFight || !w.maps[TRIAL_MAP]) return null;
  const p = w.player;
  // não repete a seita da luta anterior (com 3 seitas possíveis, saía a mesma várias vezes seguidas)
  const pool = pickBotClasses(w.classId, 3, w.rng),
    cls = test?.classId ?? pool.find((c) => c !== lastFoeClass) ?? pool[0];
  lastFoeClass = cls;
  const bot = makeBot(cls, p.level, 'enemy', w.rng);
  const rating = Math.max(0, w.arena.points + Math.round((w.rng.next() * 2 - 1) * ARENA_SPREAD));
  const power = test?.power ?? arenaPower(rating);
  w.auto.disable();
  w.changeMap(TRIAL_MAP, ARENA_SPOTS.player.x, ARENA_SPOTS.player.y);
  // a luta começa com os dois inteiros (o jogador não perde poções nem vida guardada para lutar)
  p.hp = p.derived.maxHp;
  p.mana = p.derived.maxMana;
  p.buffs = [];
  scaleArenaBot(bot, p, power, w.classId);
  bot.potions = { hp: 0, mp: 0 }; // arena: sem poções dos dois lados
  bot.e.arenaFoe = true;
  bot.e.x = ARENA_SPOTS.bot.x;
  bot.e.y = ARENA_SPOTS.bot.y;
  bot.e.ai = 'chase';
  w.monsters.push(bot.e);
  w.arenaFight = {
    bot,
    rating,
    power,
    t: 0,
    over: false,
    endAt: 0,
    move: { x: 0, y: 0, left: 0, wait: 2 },
    dmg: arenaDamageMul(p, bot.e),
  };
  w.emit({ type: 'arenaStart', botId: bot.e.id, classId: cls, power });
  return null;
}

/** O bot inimigo da arena (null fora da luta). */
export const arenaBotOf = (w: World, e: { id: number }) => (w.arenaFight?.bot.e.id === e.id ? w.arenaFight.bot : null);

export function tickArena(w: World, dt: number) {
  const f = w.arenaFight;
  if (!f) return;
  if (w.mapId !== TRIAL_MAP) {
    // saiu da arena no meio da luta (pergaminho de retorno etc.): conta como derrota
    if (!f.over) finishArena(w, false);
    w.arenaFight = null;
    return;
  }
  f.t += dt;
  if (f.over) {
    if (f.t >= f.endAt) leaveArena(w);
    return;
  }
  if (f.t > ARENA_COUNTDOWN + ARENA_TIME_LIMIT) {
    const p = w.player,
      e = f.bot.e;
    finishArena(w, p.hp / p.derived.maxHp >= e.hp / e.derived.maxHp);
    return;
  }
  const b = f.bot,
    e = b.e,
    p = w.player;
  tickBot(b, dt);
  w.tickBuffs(e, dt);
  if (e.dead || p.dead || f.t < ARENA_COUNTDOWN) return;
  e.mana = Math.min(e.derived.maxMana, e.mana + e.derived.maxMana * BOT_MANA_REGEN * dt);
  if (w.isStunned(e)) return;
  const a = maneuver(w, f, botThink(b, { leader: null, leaderTargetId: p.id, enemies: [p], allies: [e] }), dt);
  if (a.kind === 'potion') {
    if (botDrink(b, a.potion)) w.emit({ type: 'botPotion', botId: e.id, kind: a.potion });
  } else if (a.kind === 'move') {
    e.repathCd -= dt;
    const goal = e.path[e.path.length - 1];
    if (e.repathCd <= 0 || !goal || dist(goal, a) > 0.8) {
      e.repathCd = 0.3;
      e.path = findPath(w.map, e, a);
    }
    w.followPath(e, dt, 1);
    // anda e bate ao mesmo tempo (kite): golpe pronto e jogador no alcance, ataca sem parar de andar
    if (e.attackCd <= 0 && dist(e, p) <= e.attackRange) {
      e.attackCd = e.attackInterval;
      w.attack(e, p);
    }
  } else if (a.kind === 'attack') {
    if (e.attackCd <= 0 && dist(e, p) <= e.attackRange) {
      e.path = [];
      e.attackCd = e.attackInterval;
      w.attack(e, p);
    }
  } else if (a.kind === 'skill') {
    const def = botActives(b).find((s) => s.id === a.skillId);
    if (def) castBotSkill(w, b, def, p, [p]);
  }
}

/** Centro e raio do círculo de luta (o bot não foge para fora dele). */
const ARENA_CENTER = { x: 16, y: 9 },
  ARENA_RADIUS = 6;

/** Deixa a luta mexida: quem bate de longe faz kite (recua se o jogador chega perto e anda de lado de vez em quando);
 *  quem bate de perto, com todas as skills em recarga, dá uma fugida curta. Skills prontas sempre vêm antes. */
function maneuver(w: World, f: ArenaFight, a: BotAction, dt: number): BotAction {
  const b = f.bot,
    e = b.e,
    p = w.player,
    m = f.move;
  if (a.kind === 'skill') return a;
  m.wait -= dt;
  if (m.left > 0) {
    m.left -= dt;
    if (dist(e, m) > 0.4) return { kind: 'move', x: m.x, y: m.y };
    m.left = 0;
  }
  const ranged = e.attackRange > 3,
    d = dist(e, p) || 0.01,
    ux = (e.x - p.x) / d,
    uy = (e.y - p.y) / d,
    side = w.rng.next() < 0.5 ? 1 : -1;
  let goal: { x: number; y: number } | null = null,
    time = 0;
  if (ranged && d < e.attackRange * 0.3 && m.wait <= 0) {
    // jogador colado: recua um pouco, de lado; com pausa entre recuos para quem bate de perto alcançar
    const r = e.attackRange * 0.55;
    goal = { x: p.x + (ux - uy * side * 0.5) * r, y: p.y + (uy + ux * side * 0.5) * r };
    time = 1;
  } else if (m.wait <= 0) {
    const allCd = botActives(b)
      .filter((s) => !s.shield && !s.heal)
      .every((s) => (b.cds[s.id] ?? 0) > 0.5 || e.mana < (s.mana ?? 0));
    if (ranged) {
      // anda de lado em volta do jogador, na mesma distância
      goal = { x: e.x - uy * side * 2.5, y: e.y + ux * side * 2.5 };
      time = 1;
    } else if (allCd) {
      // corpo a corpo sem skill: foge um pouco na diagonal
      goal = { x: e.x + (ux - uy * side) * 2.5, y: e.y + (uy + ux * side) * 2.5 };
      time = 1;
    }
  }
  if (!goal) return a;
  // dentro do círculo e em chão andável
  const cx = goal.x - ARENA_CENTER.x,
    cy = goal.y - ARENA_CENTER.y,
    cd = Math.hypot(cx, cy);
  if (cd > ARENA_RADIUS)
    goal = { x: ARENA_CENTER.x + (cx / cd) * ARENA_RADIUS, y: ARENA_CENTER.y + (cy / cd) * ARENA_RADIUS };
  if (!isWalkable(w.map, goal.x, goal.y)) {
    m.wait = 0.5;
    return a;
  }
  m.x = goal.x;
  m.y = goal.y;
  m.left = time;
  m.wait = time + (ranged ? 4 : 3) + w.rng.next() * 1.5;
  e.path = [];
  return { kind: 'move', x: m.x, y: m.y };
}

/** Fim da luta: pontos (ELO), moeda, placar; o jogador fica de pé e volta ao Porto depois de ARENA_END_DELAY s. */
export function finishArena(w: World, win: boolean) {
  const f = w.arenaFight;
  if (!f || f.over) return;
  const a = w.arena,
    delta = arenaDelta(a.points, f.rating, win),
    coins = win ? ARENA_COINS.win : ARENA_COINS.loss;
  a.points = Math.max(0, a.points + delta);
  a.coins += coins;
  if (win) a.wins++;
  else a.losses++;
  f.over = true;
  f.endAt = f.t + ARENA_END_DELAY;
  const p = w.player;
  p.hp = Math.max(1, p.hp);
  p.buffs = [];
  p.path = [];
  w.targetId = null;
  w.autoAttack = false;
  w.pendingSkill = null;
  if (win) {
    f.bot.e.dead = true;
    f.bot.e.hp = 0;
  }
  f.bot.e.path = [];
  w.bumpInv();
  w.emit({ type: 'arenaResult', win, delta, points: a.points, coins });
}

/** Volta ao Porto com a vida e a mana cheias. */
export function leaveArena(w: World) {
  w.arenaFight = null;
  const p = w.player;
  p.hp = p.derived.maxHp;
  p.mana = p.derived.maxMana;
  w.changeMap(ARENA_RETURN.map, ARENA_RETURN.x, ARENA_RETURN.y);
}

/** Loja da arena: compra um título com a moeda da arena (alguns pedem pontos mínimos). */
export function buyArenaTitle(w: World, id: string): ActionError | null {
  if (w.npcRole() !== 'arena') return { code: 'talkToArena' };
  const t = ARENA_TITLES[id];
  if (!t) return null;
  if (w.arena.titles.includes(id)) return { code: 'titleOwned' };
  if (t.exclusive) return { code: 'founderOnly' };
  if (w.arena.points < t.minPoints) return { code: 'arenaPoints', points: t.minPoints };
  if (w.arena.coins < t.price) return { code: 'arenaCoins' };
  w.arena.coins -= t.price;
  w.arena.titles.push(id);
  w.arena.title = id;
  w.player.title = t.name;
  w.player.titleWing = titleWing(id);
  w.bumpInv();
  return null;
}

/** Usa um título comprado (null tira). */
export function wearArenaTitle(w: World, id: string | null) {
  if (id !== null && !w.arena.titles.includes(id)) return;
  w.arena.title = id;
  w.player.title = id ? ARENA_TITLES[id].name : undefined;
  w.player.titleWing = titleWing(id);
  w.bumpInv();
}
