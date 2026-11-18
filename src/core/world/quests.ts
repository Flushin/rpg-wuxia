// Missões (marco 7): estado da cadeia, aceitar, entregar e objetivos.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { BASES, makeEquipment } from '../items';
import { QUESTS, questGoalCount, resolveNpc, type QuestDef, type QuestPhase } from '../quests';
import type { World } from '../world';

// ---------- missões (marco 7) ----------
/** Missão atual da cadeia e em que fase ela está para a interface. */
export function questView(w: World): {
  def: QuestDef | null;
  phase: QuestPhase;
  progress: number;
  count: number;
  giver: string;
  turnIn: string;
} {
  const def = QUESTS[w.quest.stage] ?? null;
  if (!def) return { def: null, phase: 'complete', progress: 0, count: 0, giver: '', turnIn: '' };
  const giver = resolveNpc(def.giver, w.classId),
    turnIn = resolveNpc(def.turnIn, w.classId);
  const phase: QuestPhase =
    w.quest.status === 'pending' ? (w.player.level >= def.minLevel ? 'available' : 'locked') : w.quest.status;
  return { def, phase, progress: w.quest.progress, count: questGoalCount(def), giver, turnIn };
}

/** Marca sobre o NPC: "!" = tem missão para dar; "?" = missão para entregar (ou falar com ele cumpre o objetivo). */
export function questMark(w: World, npcId: string): '!' | '?' | null {
  const v = questView(w);
  if (!v.def) return null;
  if (v.phase === 'available' && v.giver === npcId) return '!';
  if (v.phase === 'ready' && v.turnIn === npcId) return '?';
  if (v.phase === 'active' && v.def.objective.type === 'talk' && resolveNpc(v.def.objective.npc, w.classId) === npcId)
    return '?';
  return null;
}

/** NPC com quem falar numa missão de conversa ('' se não for). */
export function questTalkTarget(w: World): string {
  const o = QUESTS[w.quest.stage]?.objective;
  return o?.type === 'talk' ? resolveNpc(o.npc, w.classId) : '';
}

/** Aceita a missão atual (precisa estar falando com quem dá; force = simulador/testes). */
export function questAccept(w: World, force = false): boolean {
  const v = questView(w);
  if (!v.def || v.phase !== 'available' || (!force && w.npcRole() !== v.giver)) return false;
  w.quest.status = 'active';
  w.quest.progress = 0;
  w.emit({ type: 'quest', kind: 'accepted', questId: v.def.id, name: v.def.name });
  // objetivo já cumprido na hora de aceitar (ex.: falar com quem está aberto, já estar no mapa)
  const o = v.def.objective;
  if (o.type === 'reach' && w.mapId === o.map) questReady(w, v.def);
  if (o.type === 'talk' && w.npcRole() === resolveNpc(o.npc, w.classId)) questReady(w, v.def);
  return true;
}

/** Entrega a missão pronta e dá as recompensas (precisa estar falando com quem recebe; force = simulador/testes). */
export function questTurnIn(w: World, force = false): boolean {
  const v = questView(w);
  if (!v.def || v.phase !== 'ready' || (!force && w.npcRole() !== v.turnIn)) return false;
  const r = v.def.reward;
  w.quest = { stage: w.quest.stage + 1, status: 'pending', progress: 0 };
  w.emit({ type: 'quest', kind: 'completed', questId: v.def.id, name: v.def.name });
  if (r.gold) {
    w.gold += r.gold;
    w.bumpInv();
    w.emit({ type: 'goldPickup', amount: r.gold });
  }
  if (r.item) {
    const lv = r.itemLevel ?? 5;
    const base = Object.entries(BASES).find(
      ([, b]) => b.slot === r.item && b.reqLevel === lv && (!b.sect || b.sect === w.classId),
    );
    if (base) w.collect(makeEquipment(base[0], 'incomum', null, w.rng, lv), w.player.x, w.player.y);
  }
  if (r.xp) w.gainXp(r.xp);
  return true;
}

export function questReady(w: World, def: QuestDef) {
  w.quest.status = 'ready';
  w.quest.progress = questGoalCount(def);
  w.emit({ type: 'quest', kind: 'ready', questId: def.id, name: def.name });
}

export function questKill(w: World, monsterId: string) {
  const def = QUESTS[w.quest.stage];
  if (!def || w.quest.status !== 'active' || def.objective.type !== 'kill' || def.objective.monster !== monsterId)
    return;
  w.quest.progress = Math.min(def.objective.count, w.quest.progress + 1);
  if (w.quest.progress >= def.objective.count) questReady(w, def);
  else w.emit({ type: 'quest', kind: 'progress', questId: def.id, name: def.name });
}

export function questTalk(w: World, npcId: string) {
  const def = QUESTS[w.quest.stage];
  if (
    def &&
    w.quest.status === 'active' &&
    def.objective.type === 'talk' &&
    resolveNpc(def.objective.npc, w.classId) === npcId
  )
    questReady(w, def);
}

export function questReach(w: World, mapId: string) {
  const def = QUESTS[w.quest.stage];
  if (def && w.quest.status === 'active' && def.objective.type === 'reach' && def.objective.map === mapId)
    questReady(w, def);
}
