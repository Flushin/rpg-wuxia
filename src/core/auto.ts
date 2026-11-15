import { MONSTERS } from './data';
import { L } from './i18n';
import { buyPrice, BASES, SLOTS } from './items';
import { findPath } from './pathfinding';
import type { AutoBucket, AutoConfig, AutoRate, AutoSave, AutoState, Entity, GameEvent, ItemInstance, Point } from './types';
import type { World } from './world';

export const TOWN_MAPS = new Set(['cidade']);
export const AUTO_MAX_LEVEL_GAP = 2; // ataca só monstros até 2 níveis acima do personagem
export const AUTO_GRAY_GAP = 1; // monstro com nível < personagem - 2 é "cinza": só se não houver outro
const GRAY_PENALTY = 60;
// escolha de alvo (aprovado pelo Lucas em 15/11/2026):
const NEAR_RANGE = 12;      // prefere monstros até 12 tiles de caminho
const FAR_PENALTY = 100;    // além disso, só se não houver nenhum perto
const CROWD_PENALTY = 10;   // por monstro que o caminho (ou o alvo) atrairia junto
const MAX_PATH_CHECKS = 16; // candidatos com caminho conferido (antes eram 4: às vezes nenhum tinha caminho e o auto parava)
const STUCK_SEC = 4, IGNORE_SEC = 15; // alvo que não fica mais perto em 4 s é ignorado por 15 s
export const RATE_MIN_SEC = 120; // mínimo de dados para o ritmo valer
const BUCKET_SEC = 60, MAX_BUCKETS = 30;
const SHOP_COOLDOWN = 120; // s entre viagens à vila (evita laço se a compra falhar)
const SHIELD_HP = 0.7;
const REST_HP = 0.35, REST_DONE = 0.9, REST_MAX_SEC = 50; // descanso na vila (regenera 3%/s após 5 s sem dano)
const HP_POTION = 'pocao_hp_p', MP_POTION = 'pocao_mp_p';
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const emptyBucket = (): AutoBucket => ({ sec: 0, kills: 0, xp: 0, gold: 0, potHp: 0, potMp: 0, levelSum: 0, drops: {} });

export const defaultAutoConfig = (classId: string): AutoConfig => ({
  skillsOff: [], hpThreshold: 40, mpThreshold: 30, buyHp: 10, buyMp: classId === 'lamina' ? 5 : 10, sellIncomum: false,
});
const clampN = (v: unknown, a: number, b: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };

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
  private leaving = false; // no mapa de caça, indo à vila comprar poções
  private visit: { shop: boolean | null; shopped: boolean } = { shop: null, shopped: false };
  private lastShop = -Infinity;
  private blocked: Record<string, number> = {};
  private walkCd = 0;
  private ignore: Record<number, number> = {}; // monstro -> até quando ignorar (sem caminho / travado)
  private chase = { id: -1, best: Infinity, since: 0 }; // progresso até o alvo atual
  private restSec = 0;

  constructor(private w: World, classId: string) { this.cfg = defaultAutoConfig(classId); }

  // ---------- comandos ----------
  toggle() {
    this.pendingResume = false;
    if (this.state === 'on') this.setState('off');
    else { this.visit = { shop: null, shopped: false }; this.leaving = false; this.blocked = {}; this.setState('on'); }
  }
  resume() { if (this.pendingResume) { this.pendingResume = false; if (this.state === 'off') this.toggle(); } }
  manualMove() { if (this.state === 'on') this.setState('pausado'); }
  private setState(s: AutoState) {
    if (s === this.state) return;
    this.state = s; this.status = '';
    const w = this.w;
    if (s === 'on' && !TOWN_MAPS.has(w.mapId)) this.huntMap = w.mapId;
    if (s === 'on' && !this.huntMap) this.huntMap = this.portalTo(null)?.target ?? '';
    if (s !== 'on') { w.player.path = []; }
    w.emit({ type: 'autoState', state: s });
  }
  private stop(reason: 'broken') { this.state = 'off'; this.status = ''; this.w.emit({ type: 'autoStopped', reason }); this.w.emit({ type: 'autoState', state: 'off' }); }

  // ---------- estatísticas ----------
  get counting() { return this.state === 'on' && !TOWN_MAPS.has(this.w.mapId); }
  observe(ev: GameEvent) {
    if (ev.type === 'playerDeath' && this.state === 'on') this.deathPending = true;
    else if (ev.type === 'mapChange') { this.visit = { shop: null, shopped: false }; this.leaving = false; }
    if (!this.counting) return;
    const c = this.cur;
    if (ev.type === 'kill') { c.kills++; c.levelSum += ev.level ?? 1; }
    else if (ev.type === 'xp') c.xp += ev.amount;
    else if (ev.type === 'goldPickup') c.gold += ev.amount;
    else if (ev.type === 'potionUsed') { if (ev.kind === 'hp') c.potHp++; else c.potMp++; }
  }
  recordDrop(it: ItemInstance) {
    if (!this.counting) return;
    const k = `${it.baseId}|${it.rarity}`;
    this.cur.drops[k] = (this.cur.drops[k] ?? 0) + (it.qty ?? 1);
  }
  rate(): AutoRate | null {
    const all = [...this.buckets, this.cur];
    let sec = 0, kills = 0, xp = 0, gold = 0, ph = 0, pm = 0, ls = 0;
    const drops: Record<string, number> = {};
    for (const b of all) { sec += b.sec; kills += b.kills; xp += b.xp; gold += b.gold; ph += b.potHp; pm += b.potMp; ls += b.levelSum; for (const [k, n] of Object.entries(b.drops)) drops[k] = (drops[k] ?? 0) + n; }
    if (sec < RATE_MIN_SEC || kills < 1) return null;
    return {
      killsPerMin: kills / (sec / 60), xpPerKill: xp / kills, goldPerKill: gold / kills, potHpPerKill: ph / kills, potMpPerKill: pm / kills,
      monLevel: Math.max(1, Math.round(ls / kills)), sampleMin: sec / 60,
      drops: Object.entries(drops).map(([k, n]) => { const [baseId, rarity] = k.split('|'); return { baseId, rarity: rarity as AutoRate['drops'][0]['rarity'], perKill: n / kills }; }),
    };
  }

  // ---------- save ----------
  serialize(): AutoSave {
    const buckets = [...this.buckets, this.cur].filter((b) => b.sec > 0 || b.kills > 0).slice(-MAX_BUCKETS);
    return { active: this.state === 'on' || this.pendingResume, mapId: this.huntMap, config: JSON.parse(JSON.stringify(this.cfg)), buckets: JSON.parse(JSON.stringify(buckets)) };
  }
  load(s: AutoSave | undefined) {
    if (!s || typeof s !== 'object') return;
    const c = s.config ?? {}, d = this.cfg;
    this.cfg = {
      skillsOff: Array.isArray(c.skillsOff) ? c.skillsOff.filter((x) => typeof x === 'string') : d.skillsOff,
      hpThreshold: clampN(c.hpThreshold, 5, 95, d.hpThreshold), mpThreshold: clampN(c.mpThreshold, 0, 95, d.mpThreshold),
      buyHp: clampN(c.buyHp, 0, 60, d.buyHp), buyMp: clampN(c.buyMp, 0, 60, d.buyMp), sellIncomum: !!c.sellIncomum,
    };
    this.huntMap = typeof s.mapId === 'string' ? s.mapId : '';
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    this.buckets = (Array.isArray(s.buckets) ? s.buckets : []).slice(-MAX_BUCKETS).map((b) => ({
      sec: num(b?.sec), kills: num(b?.kills), xp: num(b?.xp), gold: num(b?.gold), potHp: num(b?.potHp), potMp: num(b?.potMp), levelSum: num(b?.levelSum),
      drops: Object.fromEntries(Object.entries(b?.drops ?? {}).map(([k, n]) => [k, num(n)])),
    }));
    this.cur = emptyBucket();
    this.pendingResume = !!s.active;
  }

  // ---------- venda automática (mochila cheia) ----------
  get sellingActive() { return this.state === 'on'; }
  sellable(it: ItemInstance): boolean {
    return !!BASES[it.baseId] && (it.rarity === 'comum' || (it.rarity === 'incomum' && this.cfg.sellIncomum));
  }
  // vende da mochila tudo que a regra permite; retorna quantos itens foram vendidos
  makeRoom(): number {
    const w = this.w;
    let n = 0;
    for (let i = 0; i < w.bag.length; i++) { const it = w.bag[i]; if (it && this.sellable(it)) { w.sellRaw(i, 1); n++; } }
    return n;
  }

  // ---------- tick ----------
  tick(dt: number) {
    if (this.state !== 'on') return;
    const w = this.w;
    this.walkCd -= dt;
    if (TOWN_MAPS.has(w.mapId)) { this.tickTown(dt); return; }
    this.huntMap = w.mapId;
    this.cur.sec += dt;
    if (this.cur.sec >= BUCKET_SEC) { this.buckets.push(this.cur); this.cur = emptyBucket(); if (this.buckets.length >= MAX_BUCKETS) this.buckets.shift(); }
    this.drinkPotions();
    if (!this.leaving && ((this.shouldShop() && w.time - this.lastShop > SHOP_COOLDOWN) || this.needsRest()) && this.exitPortal()) {
      this.leaving = true; w.targetId = null; w.autoAttack = false;
    }
    if (this.leaving) {
      this.status = L('Indo comprar poções', 'Buying potions');
      const p = this.exitPortal();
      if (p) this.walkTo({ x: p.o.x + p.o.w / 2, y: p.o.y + p.o.h / 2 });
      return;
    }
    this.status = L('Caçando', 'Hunting');
    this.combat();
  }

  private needsHp() { return this.cfg.buyHp > 0 && this.w.kindCount('hp') === 0 && this.w.gold >= buyPrice(HP_POTION); }
  private needsMp() { return this.cfg.buyMp > 0 && this.w.kindCount('mp') === 0 && this.w.gold >= buyPrice(MP_POTION); }
  // sem poção de vida e com pouca vida: volta à vila (a vida regenera lá) em vez de morrer
  private needsRest() { const p = this.w.player; return this.w.kindCount('hp') === 0 && p.hp < p.derived.maxHp * REST_HP; }
  private shouldShop() { return this.needsHp() || this.needsMp(); }

  // saída para a vila; fora da floresta (ex.: ruínas) usa o portal de volta ao mapa anterior
  private exitPortal() { return this.portalTo(TOWN_TARGET) ?? this.portalTo('floresta'); }

  private portalTo(target: string | null) {
    for (const o of this.w.map.objects) {
      if (o.type !== 'portal') continue;
      const t = String(o.props.target);
      if (target === null ? !TOWN_MAPS.has(t) : target === TOWN_TARGET ? TOWN_MAPS.has(t) : t === target) return { o, target: t };
    }
    return null;
  }

  private walkTo(pt: Point) {
    const w = this.w, p = w.player;
    if (this.walkCd > 0 && p.path.length) return;
    this.walkCd = 0.5;
    w.autoMove(pt.x, pt.y, true);
  }

  private tickTown(dt: number) {
    const w = this.w;
    if (this.deathPending) {
      this.deathPending = false;
      if (SLOTS.some((s) => { const it = w.equipment[s]; return !!it && it.durability <= 0; })) { this.stop('broken'); return; }
    }
    if (this.visit.shop === null) { this.visit.shop = this.shouldShop(); this.restSec = 0; }
    if (this.visit.shop && !this.visit.shopped) {
      const v = w.npcs.find((n) => w.npcRole(n) === 'vendedor');
      if (v) {
        this.status = L('Indo comprar poções', 'Buying potions');
        if (dist(w.player, v) > 1.5) { this.walkTo(v); return; }
        this.shop();
      }
      this.visit.shopped = true;
    }
    const pl = w.player;
    if (pl.hp < pl.derived.maxHp * REST_DONE && this.restSec < REST_MAX_SEC) { this.restSec += dt; this.status = L('Descansando na vila', 'Resting in village'); return; }
    this.status = L('Voltando para caçar', 'Heading back to hunt');
    const p = this.portalTo(this.huntMap || null) ?? this.portalTo(null);
    if (p) { this.huntMap = p.target; this.walkTo({ x: p.o.x + p.o.w / 2, y: p.o.y + p.o.h / 2 }); }
  }

  // compra as quantidades do menu, o máximo que o ouro e a mochila permitirem (vida primeiro)
  private shop() {
    const w = this.w;
    this.lastShop = w.time;
    for (const [id, want] of [[HP_POTION, this.cfg.buyHp], [MP_POTION, this.cfg.buyMp]] as [string, number][]) {
      let q = Math.min(want, Math.floor(w.gold / Math.max(1, buyPrice(id))));
      while (q > 0 && !w.canFit(id, q)) q--;
      if (q > 0) w.purchase(id, q);
    }
  }

  private drinkPotions() {
    const w = this.w, p = w.player, c = this.cfg;
    const hp = (p.hp / p.derived.maxHp) * 100, mp = p.derived.maxMana > 0 ? (p.mana / p.derived.maxMana) * 100 : 100;
    // contra 2+ monstros em combate bebe mais cedo (+15 pontos): a cura é lenta (8 s)
    const th = c.hpThreshold + (w.monsters.filter((m) => !m.dead && m.ai === 'chase').length >= 2 ? 15 : 0);
    if (hp < th && w.potionCd.hp <= 0 && w.kindCount('hp') > 0 && (!w.potionFx.hp || hp < th / 2)) w.usePotion('hp');
    if (mp < c.mpThreshold && w.potionCd.mp <= 0 && w.kindCount('mp') > 0 && (!w.potionFx.mp || mp < c.mpThreshold / 2)) w.usePotion('mp');
  }

  private eligible(m: Entity): boolean {
    const p = this.w.player;
    return !m.dead && m.level <= p.level + AUTO_MAX_LEVEL_GAP && !this.forbidden(m) && (this.ignore[m.id] ?? 0) <= this.w.time;
  }

  /** Monstros que já estão atacando o personagem: revida primeiro (o mais perto). */
  private nearestAggressor(): Entity | null {
    const w = this.w, p = w.player;
    let best: Entity | null = null, bd = Infinity;
    for (const m of w.monsters) {
      if (m.ai !== 'chase' || m.dead || this.forbidden(m)) continue;
      const d = dist(m, p);
      if (d < bd) { bd = d; best = m; }
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

  /** Alvo novo: perto pelo caminho real, sem atrair outros monstros no caminho; cinzas e longe só em último caso. */
  private pickTarget(): Entity | null {
    const w = this.w, p = w.player;
    const cands = w.monsters.filter((m) => this.eligible(m)).map((m) => ({ m, d: dist(m, p) })).sort((a, b) => a.d - b.d);
    let best: Entity | null = null, bs = Infinity;
    for (const c of cands.slice(0, MAX_PATH_CHECKS)) {
      if (c.d >= bs) break; // linha reta já é pior que o melhor custo: os próximos também
      const path = c.d < 1 ? [] : w.pathFromPlayer(c.m);
      if (c.d >= 1 && !path.length) { this.ignore[c.m.id] = w.time + IGNORE_SEC; continue; } // sem caminho
      let len = 0, a: Point = p;
      for (const q of path) { len += dist(a, q); a = q; }
      const score = len
        + (c.m.level < p.level - AUTO_GRAY_GAP ? GRAY_PENALTY : 0)
        + (len > NEAR_RANGE ? FAR_PENALTY : 0)
        + this.crowdOn(c.m, path) * CROWD_PENALTY;
      if (score < bs) { bs = score; best = c.m; }
    }
    return best;
  }

  /** Alvo que não fica mais perto (preso atrás de algo) é largado e ignorado por um tempo. */
  private stuckOn(t: Entity): boolean {
    const w = this.w, d = dist(w.player, t);
    if (this.chase.id !== t.id) { this.chase = { id: t.id, best: d, since: w.time }; return false; }
    if (t.ai === 'chase' || d <= w.player.attackRange + 0.5 || d < this.chase.best - 0.5) {
      this.chase.best = Math.min(this.chase.best, d); this.chase.since = w.time; return false;
    }
    if (w.time - this.chase.since < STUCK_SEC) return false;
    this.ignore[t.id] = w.time + IGNORE_SEC; this.chase.id = -1;
    return true;
  }

  // o auto ignora o chefe e qualquer monstro dentro da arena dele (inclusive invocados)
  private forbidden(m: Entity) { return !!MONSTERS[m.monsterId]?.boss || this.w.inArena(m); }

  private combat() {
    const w = this.w, p = w.player;
    let t = w.getTarget();
    if (t && (this.forbidden(t) || this.stuckOn(t))) { w.setTarget(null); t = null; }
    // revidar primeiro: se alguém está atacando e o alvo atual ainda não entrou na briga, troca
    const aggressor = this.nearestAggressor();
    if (aggressor && (!t || t.ai !== 'chase')) { t = aggressor; w.setTarget(t.id); }
    else if (!t) { t = this.pickTarget(); if (t) w.setTarget(t.id); }
    else if (!w.autoAttack) w.setTarget(t.id);
    if (w.gcd > 0) return;
    const defs = w.activeSkills();
    const aggroed = w.monsters.some((m) => !m.dead && m.ai === 'chase');
    // da mais forte (desbloqueada por último) para a mais básica
    for (let slot = defs.length - 1; slot >= 0; slot--) {
      const def = defs[slot], st = w.skills[def.id];
      if (this.cfg.skillsOff.includes(def.id) || !w.isUnlocked(def) || st.cd > 0 || p.mana < (def.mana ?? 0) || (this.blocked[def.id] ?? 0) > w.time) continue;
      if (def.shield) { if (!(aggroed && p.hp < p.derived.maxHp * SHIELD_HP) || w.hasBuff(p, 'shield')) continue; }
      else if (def.area === 'self') { if (!w.monsters.some((m) => !m.dead && dist(m, p) <= (def.radius ?? 0))) continue; }
      else if (def.area === 'target') {
        if (!t || dist(p, t) > w.skillReach(def) || !w.monsters.some((m) => !m.dead && dist(m, t!) <= (def.radius ?? 0))) continue;
      } else if (def.target === 'target') { if (!t || dist(p, t) > w.skillReach(def)) continue; }
      else continue;
      w.useSkill(slot);
      if (st.cd <= 0) this.blocked[def.id] = w.time + 1.5; // não saiu (ex.: caminho bloqueado): tenta de novo depois
      else return;
    }
  }
}
const TOWN_TARGET = '#town';
