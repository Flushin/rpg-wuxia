import { MONSTERS } from './data';
import { L } from './i18n';
import { buyPrice, BASES, SLOTS, itemHasGems } from './items';
import { findPath, isWalkable } from './pathfinding';
import type {
  AutoBucket,
  AutoConfig,
  AutoCrowdAvoid,
  AutoGrayMode,
  AutoRate,
  AutoRetaliate,
  AutoSave,
  AutoState,
  AutoStrongAggro,
  Entity,
  GameEvent,
  ItemInstance,
  Point,
} from './types';
import type { World } from './world';
import { HOME_MAP, MAPS_CONFIG, MAP_IDS, TOWN_MAPS, portalMinLevel } from './mapsConfig';
import { teleportBlock, teleportById } from './teleport';
import { isDungeonMap } from './dungeons';
import { inTelegraph, safeSpot } from './world/boss';

export const AUTO_MAX_LEVEL_GAP = 2; // padrão da opção maxLevelAbove: alvos até 2 níveis acima do personagem
export const AUTO_MAX_LEVEL_LIMIT = 5; // máximo da opção no menu
export const AUTO_GRAY_GAP = 1; // monstro com nível < personagem - 1 (2+ abaixo) é "cinza" (opção grayMode)
const GRAY_PENALTY = 60; // grayMode 'last': cinza só se não houver outro
// escolha de alvo (aprovado pelo Lucas em 15/11/2026):
const NEAR_RANGE = 12; // prefere monstros até 12 tiles de caminho
const FAR_PENALTY = 100; // além disso, só se não houver nenhum perto
const CROWD_PENALTY = 10; // por monstro que o caminho (ou o alvo) atrairia junto
const CROWD_MUL: Record<AutoCrowdAvoid, number> = { off: 0, low: 1, high: 3 }; // opção crowdAvoid (padrão 'low')
const STRONG_PENALTY = 200; // se não revida sempre: alvo perto de monstro acima do nível máximo só em último caso
const FLEE_DIST = 6; // opção onStrongAggro 'flee': anda até ~6 tiles para longe do monstro forte
const MAX_PATH_CHECKS = 16; // candidatos com caminho conferido (antes eram 4: às vezes nenhum tinha caminho e o auto parava)
const STUCK_SEC = 4,
  IGNORE_SEC = 15; // alvo que não fica mais perto em 4 s é ignorado por 15 s
export const RATE_MIN_SEC = 120; // mínimo de dados para o ritmo valer
export const BUCKET_SEC = 60,
  MAX_BUCKETS = 30;
const SHOP_COOLDOWN = 120; // s entre viagens à vila (evita laço se a compra falhar)
export const SHIELD_HP = 0.9; // Véu de Névoa / Pele de Ferro: usado ao levar dano em combate (vida abaixo de 90%)
export const SHIELD_CROWD = 2; // ... ou já de cara com 2+ monstros atacando
export const HEAL_HP = 0.6; // Seiva de Jade: usada com a vida abaixo de 60% em combate
const REST_HP = 0.35,
  REST_DONE = 0.9,
  REST_MAX_SEC = 50; // descanso na vila (regenera 3%/s após 5 s sem dano)
const HP_POTION = 'pocao_hp_p',
  MP_POTION = 'pocao_mp_p';
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const emptyBucket = (): AutoBucket => ({
  sec: 0,
  kills: 0,
  xp: 0,
  gold: 0,
  potHp: 0,
  potMp: 0,
  levelSum: 0,
  drops: {},
});

export const defaultAutoConfig = (classId: string): AutoConfig => ({
  skillsOff: [],
  hpThreshold: 40,
  mpThreshold: 30,
  buyHp: 10,
  buyMp: classId === 'lamina' ? 5 : 10,
  sellIncomum: false,
  maxLevelAbove: AUTO_MAX_LEVEL_GAP,
  grayMode: 'last',
  retaliate: 'always',
  onStrongAggro: 'keep',
  crowdAvoid: 'low',
});
export const AUTO_GRAY_MODES: readonly AutoGrayMode[] = ['last', 'ignore', 'normal'];
export const AUTO_RETALIATE: readonly AutoRetaliate[] = ['always', 'inRange', 'never'];
export const AUTO_STRONG_AGGRO: readonly AutoStrongAggro[] = ['keep', 'flee', 'town'];
export const AUTO_CROWD: readonly AutoCrowdAvoid[] = ['off', 'low', 'high'];
const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);
const clampN = (v: unknown, a: number, b: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d;
};

// Auto-combate: lógica pura dirigida pelo tick do World (sem Phaser).
export class AutoCombat {
  state: AutoState = 'off';
  cfg: AutoConfig;
  status = ''; // ação atual (texto para a UI)
  huntMap = '';
  pendingResume = false; // save tinha auto ligado: espera o jogador fechar o resumo offline
  private buckets: AutoBucket[] = [];
  private cur: AutoBucket = emptyBucket();
  private deathPending = false;
  private leaving: false | 'shop' | 'sell' | 'flee' = false; // no mapa de caça, indo à vila (poções / vender / fugir de monstro forte)
  private visit: { shop: boolean | null; sell: boolean; shopped: boolean } = {
    shop: null,
    sell: false,
    shopped: false,
  };
  private lastShop = -Infinity;
  private blocked: Record<string, number> = {};
  private walkCd = 0;
  private ignore: Record<number, number> = {}; // monstro -> até quando ignorar (sem caminho / travado)
  private chase = { id: -1, best: Infinity, since: 0 }; // progresso até o alvo atual
  private restSec = 0;
  private fleeUntil = 0; // fugindo: até quando seguir o caminho atual antes de escolher outro

  constructor(
    private w: World,
    classId: string,
  ) {
    this.cfg = defaultAutoConfig(classId);
  }

  // ---------- comandos ----------
  toggle() {
    this.pendingResume = false;
    if (isDungeonMap(this.w.mapId)) {
      // masmorra: o Auto não funciona de jeito nenhum
      this.setState('off');
      this.w.emit({ type: 'autoBlocked' });
      return;
    }
    if (this.state === 'on') this.setState('off');
    else {
      this.visit = { shop: null, sell: false, shopped: false };
      this.leaving = false;
      this.blocked = {};
      this.setState('on');
    }
  }
  resume() {
    if (this.pendingResume) {
      this.pendingResume = false;
      if (this.state === 'off') this.toggle();
    }
  }
  /** Para o auto enquanto o resumo offline está aberto; resume() o religa. */
  holdForReport() {
    if (this.state !== 'on') return;
    this.setState('off');
    this.pendingResume = true;
  }
  /** Desliga (ligado ou pausado) sem religar depois: usado ao entrar numa masmorra. */
  disable() {
    this.pendingResume = false;
    this.setState('off');
  }
  manualMove() {
    if (this.state === 'on') this.setState('pausado');
  }
  private setState(s: AutoState) {
    if (s === this.state) return;
    this.state = s;
    this.status = '';
    const w = this.w;
    if (s === 'on' && !TOWN_MAPS.has(w.mapId)) this.huntMap = w.mapId;
    if (s === 'on' && !this.huntMap) this.huntMap = this.levelHuntMap() ?? this.portalTo(null)?.target ?? '';
    if (s !== 'on') {
      w.player.path = [];
    }
    w.emit({ type: 'autoState', state: s });
  }
  private stop(reason: 'broken') {
    this.state = 'off';
    this.status = '';
    this.w.emit({ type: 'autoStopped', reason });
    this.w.emit({ type: 'autoState', state: 'off' });
  }

  // ---------- estatísticas ----------
  get counting() {
    return this.state === 'on' && !TOWN_MAPS.has(this.w.mapId);
  }
  observe(ev: GameEvent) {
    if (ev.type === 'playerDeath' && this.state === 'on') this.deathPending = true;
    else if (ev.type === 'mapChange') {
      this.visit = { shop: null, sell: false, shopped: false };
      // indo à vila por um mapa intermediário (ruínas -> floresta -> vila): continua indo
      if (TOWN_MAPS.has(ev.mapId)) this.leaving = false;
    }
    if (!this.counting) return;
    const c = this.cur;
    if (ev.type === 'kill') {
      c.kills++;
      c.levelSum += ev.level ?? 1;
    } else if (ev.type === 'xp') c.xp += ev.amount;
    else if (ev.type === 'goldPickup') c.gold += ev.amount;
    else if (ev.type === 'potionUsed') {
      if (ev.kind === 'hp') c.potHp++;
      else c.potMp++;
    }
  }
  recordDrop(it: ItemInstance) {
    if (!this.counting) return;
    const k = `${it.baseId}|${it.rarity}`;
    this.cur.drops[k] = (this.cur.drops[k] ?? 0) + (it.qty ?? 1);
  }
  rate(): AutoRate | null {
    const all = [...this.buckets, this.cur];
    let sec = 0,
      kills = 0,
      xp = 0,
      gold = 0,
      ph = 0,
      pm = 0,
      ls = 0;
    const drops: Record<string, number> = {};
    for (const b of all) {
      sec += b.sec;
      kills += b.kills;
      xp += b.xp;
      gold += b.gold;
      ph += b.potHp;
      pm += b.potMp;
      ls += b.levelSum;
      for (const [k, n] of Object.entries(b.drops)) drops[k] = (drops[k] ?? 0) + n;
    }
    if (sec < RATE_MIN_SEC || kills < 1) return null;
    return {
      killsPerMin: kills / (sec / 60),
      xpPerKill: xp / kills,
      goldPerKill: gold / kills,
      potHpPerKill: ph / kills,
      potMpPerKill: pm / kills,
      monLevel: Math.max(1, Math.round(ls / kills)),
      sampleMin: sec / 60,
      drops: Object.entries(drops).map(([k, n]) => {
        const [baseId, rarity] = k.split('|');
        return { baseId, rarity: rarity as AutoRate['drops'][0]['rarity'], perKill: n / kills };
      }),
    };
  }

  // ---------- save ----------
  serialize(): AutoSave {
    const buckets = [...this.buckets, this.cur].filter((b) => b.sec > 0 || b.kills > 0).slice(-MAX_BUCKETS);
    return {
      active: this.state === 'on' || this.pendingResume,
      mapId: this.huntMap,
      config: JSON.parse(JSON.stringify(this.cfg)),
      buckets: JSON.parse(JSON.stringify(buckets)),
    };
  }
  load(s: AutoSave | undefined) {
    if (!s || typeof s !== 'object') return;
    const c = s.config ?? {},
      d = this.cfg;
    this.cfg = {
      skillsOff: Array.isArray(c.skillsOff) ? c.skillsOff.filter((x) => typeof x === 'string') : d.skillsOff,
      hpThreshold: clampN(c.hpThreshold, 5, 95, d.hpThreshold),
      mpThreshold: clampN(c.mpThreshold, 0, 95, d.mpThreshold),
      buyHp: clampN(c.buyHp, 0, 60, d.buyHp),
      buyMp: clampN(c.buyMp, 0, 60, d.buyMp),
      sellIncomum: !!c.sellIncomum,
      maxLevelAbove: clampN(c.maxLevelAbove, 0, AUTO_MAX_LEVEL_LIMIT, d.maxLevelAbove),
      grayMode: pick(c.grayMode, AUTO_GRAY_MODES, d.grayMode),
      retaliate: pick(c.retaliate, AUTO_RETALIATE, d.retaliate),
      onStrongAggro: pick(c.onStrongAggro, AUTO_STRONG_AGGRO, d.onStrongAggro),
      crowdAvoid: pick(c.crowdAvoid, AUTO_CROWD, d.crowdAvoid),
    };
    this.huntMap = typeof s.mapId === 'string' ? s.mapId : '';
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    this.buckets = (Array.isArray(s.buckets) ? s.buckets : []).slice(-MAX_BUCKETS).map((b) => ({
      sec: num(b?.sec),
      kills: num(b?.kills),
      xp: num(b?.xp),
      gold: num(b?.gold),
      potHp: num(b?.potHp),
      potMp: num(b?.potMp),
      levelSum: num(b?.levelSum),
      drops: Object.fromEntries(Object.entries(b?.drops ?? {}).map(([k, n]) => [k, num(n)])),
    }));
    this.cur = emptyBucket();
    this.pendingResume = !!s.active;
  }

  // ---------- venda automática (mochila cheia) ----------
  sellable(it: ItemInstance): boolean {
    return (
      !!BASES[it.baseId] &&
      !it.locked &&
      !itemHasGems(it) &&
      (it.rarity === 'comum' || (it.rarity === 'incomum' && this.cfg.sellIncomum))
    );
  }
  /** Aba de equipamentos cheia e com algo que a regra vende: hora de ir ao vendedor da vila. */
  private needsSell() {
    const w = this.w;
    return w.freeSlots('equip') === 0 && w.bag.some((it) => !!it && this.sellable(it));
  }
  // vende da mochila tudo que a regra permite; retorna quantos itens foram vendidos
  makeRoom(): number {
    const w = this.w;
    let n = 0;
    for (let i = 0; i < w.bag.length; i++) {
      const it = w.bag[i];
      if (it && this.sellable(it)) {
        w.sellRaw(i, 1);
        n++;
      }
    }
    return n;
  }

  // ---------- tick ----------
  tick(dt: number) {
    const w = this.w;
    if (isDungeonMap(w.mapId)) {
      if (this.state !== 'off') this.disable(); // garantia: nada liga o Auto dentro da masmorra
      return;
    }
    if (this.state !== 'on') return;
    this.walkCd -= dt;
    if (TOWN_MAPS.has(w.mapId)) {
      this.tickTown(dt);
      return;
    }
    if (!this.huntMap || (!this.nextHop(w.mapId, this.huntMap) && !this.byTeleport(this.huntMap)))
      this.huntMap = w.mapId;
    this.cur.sec += dt;
    if (this.cur.sec >= BUCKET_SEC) {
      this.buckets.push(this.cur);
      this.cur = emptyBucket();
      if (this.buckets.length >= MAX_BUCKETS) this.buckets.shift();
    }
    this.drinkPotions();
    if (
      !this.leaving &&
      ((this.shouldShop() && w.time - this.lastShop > SHOP_COOLDOWN) || this.needsRest() || this.needsSell()) &&
      this.exitPortal()
    ) {
      this.leaving = this.needsSell() ? 'sell' : 'shop';
      w.targetId = null;
      w.autoAttack = false;
    }
    const strong = this.cfg.retaliate === 'always' ? [] : this.strongAggressors();
    if (!this.leaving && strong.length && this.cfg.onStrongAggro === 'town' && this.exitPortal()) {
      this.leaving = 'flee';
      w.targetId = null;
      w.autoAttack = false;
    }
    // de passagem por outro mapa a caminho do mapa de caça: só revida quem atacar
    if (!this.leaving && w.mapId !== this.huntMap) {
      // mapa de caça só pelo teleporte: volta para a vila e viaja de lá (tickTown)
      const p =
        this.portalTo(this.nextHop(w.mapId, this.huntMap)) ??
        (this.byTeleport(this.huntMap) ? this.exitPortal() : null);
      if (p && !this.nearestAggressor()) {
        w.targetId = null;
        w.autoAttack = false;
        this.status = L('Voltando para caçar', 'Heading back to hunt');
        this.walkTo({ x: p.o.x + p.o.w / 2, y: p.o.y + p.o.h / 2 });
        return;
      }
      if (!p) this.huntMap = w.mapId;
    }
    if (this.leaving) {
      this.status =
        this.leaving === 'flee'
          ? L('Fugindo para a vila', 'Fleeing to the village')
          : this.leaving === 'sell'
            ? L('Mochila cheia: indo vender', 'Bag full: going to sell')
            : L('Indo comprar poções', 'Buying potions');
      const p = this.exitPortal();
      if (p) this.walkTo({ x: p.o.x + p.o.w / 2, y: p.o.y + p.o.h / 2 });
      return;
    }
    if (strong.length && this.cfg.onStrongAggro === 'flee') {
      if (this.flee(strong)) {
        this.status = L('Fugindo de monstro forte', 'Fleeing a strong monster');
        return;
      }
      // encurralado: revida o forte mais perto
      const t = w.getTarget();
      if (!t || !strong.includes(t)) {
        const n = strong.reduce((a, b) => (dist(b, w.player) < dist(a, w.player) ? b : a));
        w.setTarget(n.id);
      }
      this.status = L('Encurralado: revidando', 'Cornered: fighting back');
      this.combat();
      return;
    }
    this.status = L('Caçando', 'Hunting');
    this.combat();
  }

  /** Nível máximo que o auto escolhe/revida (opção maxLevelAbove). */
  private get maxLevel() {
    return this.w.player.level + this.cfg.maxLevelAbove;
  }
  private isGray(m: Entity) {
    return m.level < this.w.player.level - AUTO_GRAY_GAP;
  }
  /** Monstros acima do limite de nível atacando o personagem (chefes/arena ficam de fora, como no resto do auto). */
  private strongAggressors(): Entity[] {
    return this.w.monsters.filter((m) => m.ai === 'chase' && !m.dead && m.level > this.maxLevel && !this.forbidden(m));
  }
  /** Anda para longe dos monstros fortes (e da casa deles) até eles desistirem pelo leash.
   *  Retorna false se não há para onde ir (encurralado). Nunca atravessa portal. */
  private flee(from: Entity[]): boolean {
    const w = this.w,
      p = w.player;
    w.targetId = null;
    w.autoAttack = false;
    if (p.path.length && w.time < this.fleeUntil) return true; // segue o caminho escolhido (não fica trocando de direção)
    const away = (q: Point) => Math.min(...from.map((m) => dist(q, m.home) + dist(q, m)));
    let best: Point | null = null,
      bs = away(p) + 1; // precisa ganhar pelo menos 1 tile
    for (const r of [FLEE_DIST, FLEE_DIST / 2])
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const q = { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r };
        if (!isWalkable(w.map, q.x, q.y)) continue;
        const path = w.pathFromPlayer(q);
        if (!path.length) continue;
        const s = away(path[path.length - 1]);
        if (s > bs) {
          bs = s;
          best = q;
        }
      }
    if (!best) return false;
    this.fleeUntil = w.time + 2;
    w.autoMove(best.x, best.y);
    return true;
  }

  private needsHp() {
    return this.cfg.buyHp > 0 && this.w.kindCount('hp') === 0 && this.w.gold >= buyPrice(HP_POTION);
  }
  private needsMp() {
    return this.cfg.buyMp > 0 && this.w.kindCount('mp') === 0 && this.w.gold >= buyPrice(MP_POTION);
  }
  // sem poção de vida e com pouca vida: volta à vila (a vida regenera lá) em vez de morrer
  private needsRest() {
    const p = this.w.player;
    return this.w.kindCount('hp') === 0 && p.hp < p.derived.maxHp * REST_HP;
  }
  private shouldShop() {
    return this.needsHp() || this.needsMp();
  }

  // saída para a vila; sem portal direto (ex.: ruínas), sai pelo mapa de MAPS_CONFIG.autoExitVia
  private exitPortal() {
    const via = MAPS_CONFIG[this.w.mapId]?.autoExitVia;
    return this.portalTo(TOWN_TARGET) ?? (via ? this.portalTo(via) : null);
  }

  /** Próximo mapa no caminho de `from` até `to` pelos portais (busca em largura); null se não há caminho. */
  private nextHop(from: string, to: string): string | null {
    if (from === to) return to;
    const maps = this.w.maps,
      first: Record<string, string> = {};
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const o of maps[cur]?.objects ?? []) {
        if (o.type !== 'portal' || o.props.menu || portalMinLevel(o) > this.w.player.level) continue;
        const t = String(o.props.target);
        if (t === from || first[t] || !maps[t]) continue;
        first[t] = cur === from ? t : first[cur];
        if (t === to) return first[t];
        queue.push(t);
      }
    }
    return null;
  }

  /** Mapa de caça pelo nível (autoFromLevel em mapsConfig): o maior que o nível permite, com monstros e caminho. */
  private levelHuntMap(): string | null {
    const w = this.w;
    let best: string | null = null,
      bestLv = -1;
    for (const id of MAP_IDS) {
      const lv = MAPS_CONFIG[id].autoFromLevel;
      if (lv === undefined || lv > w.player.level || lv <= bestLv || id === w.mapId) continue;
      if (!w.maps[id]?.objects.some((o) => o.type === 'monsterSpawn')) continue;
      if (!this.nextHop(w.mapId, id) && !this.teleportNpc(id)) continue;
      best = id;
      bestLv = lv;
    }
    return best;
  }

  /** Teleporte (Mestre dos Caminhos) até `map`: só da vila, só quando não há caminho a pé e com nível e ouro
   *  (decisão de 20/11/2026: o Auto nunca paga o teleporte se der para ir andando). Retorna o NPC ou null. */
  private teleportNpc(map: string): Entity | null {
    const w = this.w;
    if (!TOWN_MAPS.has(w.mapId) || this.nextHop(w.mapId, map)) return null;
    const d = teleportById(map);
    if (!d || !w.maps[map] || teleportBlock(d, w.player.level, w.gold)) return null;
    return w.npcs.find((n) => w.npcRole(n) === 'caminhos') ?? null;
  }

  /** `map` é destino do teleporte liberado pelo nível (o ouro só é conferido na vila, na hora de viajar). */
  private byTeleport(map: string): boolean {
    const d = teleportById(map);
    return !!d && d.minLevel <= this.w.player.level;
  }

  private portalTo(target: string | null) {
    for (const o of this.w.map.objects) {
      if (o.type !== 'portal' || o.props.menu || portalMinLevel(o) > this.w.player.level) continue;
      const t = String(o.props.target);
      if (target === null ? !TOWN_MAPS.has(t) : target === TOWN_TARGET ? TOWN_MAPS.has(t) : t === target)
        return { o, target: t };
    }
    return null;
  }

  private walkTo(pt: Point) {
    const w = this.w,
      p = w.player;
    if (this.walkCd > 0 && p.path.length) return;
    this.walkCd = 0.5;
    w.autoMove(pt.x, pt.y, true);
  }

  private tickTown(dt: number) {
    const w = this.w;
    if (this.deathPending) {
      this.deathPending = false;
      if (
        SLOTS.some((s) => {
          const it = w.equipment[s];
          return !!it && it.durability <= 0;
        })
      ) {
        this.stop('broken');
        return;
      }
    }
    if (this.visit.shop === null) {
      this.visit.sell = this.needsSell();
      this.visit.shop = this.shouldShop();
      this.restSec = 0;
    }
    if ((this.visit.shop || this.visit.sell) && !this.visit.shopped) {
      const v = w.npcs.find((n) => w.npcRole(n) === 'vendedor');
      if (v) {
        this.status = this.visit.sell
          ? L('Indo vender equipamentos', 'Selling equipment')
          : L('Indo comprar poções', 'Buying potions');
        if (dist(w.player, v) > 1.5) {
          this.walkTo(v);
          return;
        }
        if (this.visit.sell) this.makeRoom();
        if (this.visit.shop || this.shouldShop()) this.shop();
      }
      this.visit.shopped = true;
    }
    const pl = w.player;
    if (pl.hp < pl.derived.maxHp * REST_DONE && this.restSec < REST_MAX_SEC) {
      this.restSec += dt;
      this.status = L('Descansando na vila', 'Resting in village');
      return;
    }
    const tp = this.huntMap ? this.teleportNpc(this.huntMap) : null;
    if (tp) {
      this.status = L('Indo ao Mestre dos Caminhos', 'Going to the Wayfarer Master');
      if (dist(w.player, tp) > 1.5) this.walkTo(tp);
      else w.travelTo(this.huntMap);
      return;
    }
    this.status = L('Voltando para caçar', 'Heading back to hunt');
    const hop = this.huntMap ? this.nextHop(w.mapId, this.huntMap) : null;
    const p = (hop ? this.portalTo(hop) : null) ?? this.portalTo(null);
    if (p) {
      if (!hop) this.huntMap = p.target;
      this.walkTo({ x: p.o.x + p.o.w / 2, y: p.o.y + p.o.h / 2 });
      return;
    }
    // cidade sem saída a pé (Cidadela de Jade) e sem ouro para o mapa de caça: volta à vila (viagem grátis)
    const home = w.mapId !== HOME_MAP ? this.teleportNpc(HOME_MAP) : null;
    if (home) {
      if (dist(w.player, home) > 1.5) this.walkTo(home);
      else w.travelTo(HOME_MAP);
    }
  }

  // compra as quantidades do menu, o máximo que o ouro e a mochila permitirem (vida primeiro)
  private shop() {
    const w = this.w;
    this.lastShop = w.time;
    for (const [id, want] of [
      [HP_POTION, this.cfg.buyHp],
      [MP_POTION, this.cfg.buyMp],
    ] as [string, number][]) {
      let q = Math.min(want, Math.floor(w.gold / Math.max(1, buyPrice(id))));
      while (q > 0 && !w.canFit(id, q)) q--;
      if (q > 0) w.purchase(id, q);
    }
  }

  private drinkPotions() {
    const w = this.w,
      p = w.player,
      c = this.cfg;
    const hp = (p.hp / p.derived.maxHp) * 100,
      mp = p.derived.maxMana > 0 ? (p.mana / p.derived.maxMana) * 100 : 100;
    // contra 2+ monstros em combate bebe mais cedo (+15 pontos): a cura é lenta (8 s)
    const th = c.hpThreshold + (w.monsters.filter((m) => !m.dead && m.ai === 'chase').length >= 2 ? 15 : 0);
    if (hp < th && w.potionCd.hp <= 0 && w.kindCount('hp') > 0 && (!w.potionFx.hp || hp < th / 2)) w.usePotion('hp');
    if (mp < c.mpThreshold && w.potionCd.mp <= 0 && w.kindCount('mp') > 0 && (!w.potionFx.mp || mp < c.mpThreshold / 2))
      w.usePotion('mp');
  }

  private eligible(m: Entity): boolean {
    return (
      !m.dead &&
      m.level <= this.maxLevel &&
      !(this.cfg.grayMode === 'ignore' && this.isGray(m)) &&
      !this.forbidden(m) &&
      (this.ignore[m.id] ?? 0) <= this.w.time
    );
  }

  /** Monstros que já estão atacando o personagem: revida primeiro (o mais perto), conforme a opção retaliate.
   *  'inRange' revida só até o nível máximo (mais fracos sempre, mesmo com cinzas ignorados). */
  private nearestAggressor(): Entity | null {
    const w = this.w,
      p = w.player,
      r = this.cfg.retaliate;
    if (r === 'never') return null;
    let best: Entity | null = null,
      bd = Infinity;
    for (const m of w.monsters) {
      if (m.ai !== 'chase' || m.dead || this.forbidden(m)) continue;
      if (r === 'inRange' && m.level > this.maxLevel) continue;
      const d = dist(m, p);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  /** Quantos outros monstros vivos seriam atraídos indo até `t` por `path` (visão de cada um + meio tile). */
  private crowdOn(t: Entity, path: Point[]): number {
    let n = 0;
    for (const m of this.w.monsters) {
      if (m === t || m.dead || m.ai === 'chase') continue;
      const r = (MONSTERS[m.monsterId]?.aggroRange ?? 3) + 0.5;
      if (dist(m, t) <= r || path.some((q) => dist(m, q) <= r)) n++;
    }
    return n;
  }

  /** Se não revida sempre: o alvo (ou o caminho) fica na visão de um monstro acima do nível máximo? */
  private nearStrong(t: Entity, path: Point[]): boolean {
    for (const m of this.w.monsters) {
      if (m === t || m.dead || m.level <= this.maxLevel || this.forbidden(m)) continue;
      const r = (MONSTERS[m.monsterId]?.aggroRange ?? 3) + 1;
      if (dist(m, t) <= r || path.some((q) => dist(m, q) <= r)) return true;
    }
    return false;
  }

  /** Alvo novo: perto pelo caminho real, sem atrair outros monstros no caminho; cinzas e longe só em último caso. */
  private pickTarget(): Entity | null {
    const w = this.w,
      p = w.player;
    const cands = w.monsters
      .filter((m) => this.eligible(m))
      .map((m) => ({ m, d: dist(m, p) }))
      .sort((a, b) => a.d - b.d);
    const crowdW = CROWD_PENALTY * CROWD_MUL[this.cfg.crowdAvoid],
      avoidStrong = this.cfg.retaliate !== 'always';
    let best: Entity | null = null,
      bs = Infinity;
    for (const c of cands.slice(0, MAX_PATH_CHECKS)) {
      if (c.d >= bs) break; // linha reta já é pior que o melhor custo: os próximos também
      const path = c.d < 1 ? [] : w.pathFromPlayer(c.m);
      if (c.d >= 1 && !path.length) {
        this.ignore[c.m.id] = w.time + IGNORE_SEC;
        continue;
      } // sem caminho
      let len = 0,
        a: Point = p;
      for (const q of path) {
        len += dist(a, q);
        a = q;
      }
      const score =
        len +
        (this.cfg.grayMode === 'last' && this.isGray(c.m) ? GRAY_PENALTY : 0) +
        (len > NEAR_RANGE ? FAR_PENALTY : 0) +
        (crowdW ? this.crowdOn(c.m, path) * crowdW : 0) +
        (avoidStrong && this.nearStrong(c.m, path) ? STRONG_PENALTY : 0);
      if (score < bs) {
        bs = score;
        best = c.m;
      }
    }
    return best;
  }

  /** Alvo que não fica mais perto (preso atrás de algo) é largado e ignorado por um tempo. */
  private stuckOn(t: Entity): boolean {
    const w = this.w,
      d = dist(w.player, t);
    if (this.chase.id !== t.id) {
      this.chase = { id: t.id, best: d, since: w.time };
      return false;
    }
    if (t.ai === 'chase' || d <= w.player.attackRange + 0.5 || d < this.chase.best - 0.5) {
      this.chase.best = Math.min(this.chase.best, d);
      this.chase.since = w.time;
      return false;
    }
    if (w.time - this.chase.since < STUCK_SEC) return false;
    this.ignore[t.id] = w.time + IGNORE_SEC;
    this.chase.id = -1;
    return true;
  }

  // o auto ignora o chefe e qualquer monstro dentro da arena dele (inclusive invocados)
  private forbidden(m: Entity) {
    return !!MONSTERS[m.monsterId]?.boss || this.w.inArena(m);
  }

  /** Golpe em área marcado em cima do personagem: sai do círculo (Yeti) pelo lado oposto ao centro; da linha, para o
   * lugar livre mais perto. */
  private dodge(): boolean {
    const w = this.w,
      p = w.player;
    const tg = w.telegraphs.find((t) => inTelegraph(t, p, 0.3));
    if (!tg) return false;
    if (tg.shape === 'line') {
      const q = safeSpot(w, p);
      if (!q) return false;
      w.autoAttack = false;
      w.pendingSkill = null;
      w.autoMove(q.x, q.y);
      this.status = L('Desviando', 'Dodging');
      return true;
    }
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
      const a = (Math.atan2(p.y - tg.y, p.x - tg.x) || 0) + turn,
        r = tg.radius + 1.1;
      const q = { x: tg.x + Math.cos(a) * r, y: tg.y + Math.sin(a) * r };
      if (!isWalkable(w.map, q.x, q.y)) continue;
      w.autoAttack = false; // senão o ataque parado no alcance apaga o caminho (o alvo continua; volta depois)
      w.pendingSkill = null;
      w.autoMove(q.x, q.y);
      this.status = L('Desviando', 'Dodging');
      return true;
    }
    return false;
  }

  private combat() {
    const w = this.w,
      p = w.player;
    if (this.dodge()) return;
    let t = w.getTarget();
    if (t && (this.forbidden(t) || this.stuckOn(t))) {
      w.setTarget(null);
      t = null;
    }
    // revidar primeiro: se alguém está atacando e o alvo atual ainda não entrou na briga, troca
    const aggressor = this.nearestAggressor();
    if (aggressor && (!t || t.ai !== 'chase')) {
      t = aggressor;
      w.setTarget(t.id);
    } else if (!t) {
      t = this.pickTarget();
      if (t) w.setTarget(t.id);
    } else if (!w.autoAttack) w.setTarget(t.id);
    if (w.gcd > 0) return;
    const defs = w.activeSkills();
    const chasers = w.monsters.filter((m) => !m.dead && m.ai === 'chase').length,
      aggroed = chasers > 0;
    // reserva mana para o escudo/cura pronto: senão as skills de ataque gastam tudo e ele nunca sai na hora certa
    const reserve = defs
      .filter(
        (d) =>
          (d.shield || d.heal) &&
          !this.cfg.skillsOff.includes(d.id) &&
          w.isUnlocked(d) &&
          w.skills[d.id].cd <= 0 &&
          !w.hasBuff(p, d.shield ? 'shield' : 'regen'),
      )
      .reduce((a, d) => Math.max(a, d.mana ?? 0), 0);
    // da mais forte (desbloqueada por último) para a mais básica
    for (let slot = defs.length - 1; slot >= 0; slot--) {
      const def = defs[slot],
        st = w.skills[def.id];
      if (
        this.cfg.skillsOff.includes(def.id) ||
        !w.isUnlocked(def) ||
        st.cd > 0 ||
        p.mana < (def.mana ?? 0) ||
        (this.blocked[def.id] ?? 0) > w.time
      )
        continue;
      if (def.shield) {
        if (!(aggroed && (p.hp < p.derived.maxHp * SHIELD_HP || chasers >= SHIELD_CROWD)) || w.hasBuff(p, 'shield'))
          continue;
      } else if (def.heal) {
        if (!(aggroed && p.hp < p.derived.maxHp * HEAL_HP) || w.hasBuff(p, 'regen')) continue;
      } else if (p.mana - (def.mana ?? 0) < reserve) continue;
      else if (def.area === 'self') {
        if (!w.monsters.some((m) => !m.dead && dist(m, p) <= (def.radius ?? 0))) continue;
      } else if (def.area === 'target') {
        if (
          !t ||
          dist(p, t) > w.skillReach(def) ||
          !w.monsters.some((m) => !m.dead && dist(m, t!) <= (def.radius ?? 0))
        )
          continue;
      } else if (def.target === 'target') {
        if (!t || dist(p, t) > w.skillReach(def)) continue;
      } else continue;
      w.useSkill(slot);
      if (st.cd <= 0)
        this.blocked[def.id] = w.time + 1.5; // não saiu (ex.: caminho bloqueado): tenta de novo depois
      else return;
    }
  }
}
const TOWN_TARGET = '#town';
