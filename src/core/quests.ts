import questsJson from '../data/quests.json';
import { localize } from './i18n';
import { balanceQuests } from './balance';

// Missões (marco 7; 11–20 no marco 9): uma cadeia principal linear do nível 1 ao 20. Só abater, falar e ir até um mapa.
// Os textos ficam em src/data/quests.json (PT) e na seção "quests" de en.json.

export type QuestObjective =
  | { type: 'kill'; monster: string; count: number }
  | { type: 'talk'; npc: string }
  | { type: 'reach'; map: string };

export interface QuestDef {
  id: string;
  /** NPC que dá a missão; 'mestre' = mestre da seita do personagem */
  giver: string;
  turnIn: string;
  minLevel: number;
  objective: QuestObjective;
  /** item: equipamento Incomum do slot, do nível itemLevel (padrão 5) e da seita do personagem */
  reward: { xp: number; gold: number; item?: 'arma' | 'tronco'; itemLevel?: number };
  name: string;
  offer: string;
  goal: string;
  done: string;
}

export const QUESTS: QuestDef[] = (localize('quests', questsJson) as { chain: QuestDef[] }).chain;
balanceQuests(QUESTS); // multiplicadores de src/data/balance.json

/** pending = ainda não aceita; active = em andamento; ready = objetivo cumprido, falta entregar */
export type QuestStatus = 'pending' | 'active' | 'ready';
export interface QuestState {
  stage: number;
  status: QuestStatus;
  progress: number;
}

/** Como a missão aparece para a interface. */
export type QuestPhase = 'locked' | 'available' | 'active' | 'ready' | 'complete';

/** 'mestre' vira o id do NPC mestre da seita do personagem (ex.: mestre_lamina). */
export const resolveNpc = (id: string, classId: string) => (id === 'mestre' ? 'mestre_' + classId : id);

export const questGoalCount = (q: QuestDef) => (q.objective.type === 'kill' ? q.objective.count : 1);

export function sanitizeQuest(raw: unknown): QuestState {
  const r = (raw ?? {}) as Partial<QuestState>;
  const stage = Math.max(0, Math.min(QUESTS.length, Math.floor(Number(r.stage) || 0)));
  const status: QuestStatus = r.status === 'active' || r.status === 'ready' ? r.status : 'pending';
  const q = QUESTS[stage];
  const progress = q ? Math.max(0, Math.min(questGoalCount(q), Math.floor(Number(r.progress) || 0))) : 0;
  return { stage, status: q ? status : 'pending', progress };
}
