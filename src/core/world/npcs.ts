// NPCs: abrir e fechar a janela de conversa e os moradores andando pela cidade.
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { findPath, isWalkable } from '../pathfinding';
import { type Entity } from '../types';
import type { World } from '../world';
import { dist } from './geometry';

// ---------- NPCs ----------
export function interactNpc(w: World, entityId: number) {
  const n = w.npcs.find((e) => e.id === entityId);
  if (!n || w.player.dead) return;
  w.auto.manualMove();
  w.pendingSkill = null;
  w.chasing = false;
  w.autoAttack = false;
  w.targetId = null;
  w.moveInput = { x: 0, y: 0 };
  w.player.path = [];
  w.npcGoal = entityId;
}

/** Papel do NPC: 'ferreiro', 'vendedor', 'anciao', 'guarda', 'mercador', 'mestre_<seita>', 'morador1'...
 *  Um personagem com outro id pode ter o papel de uma loja (prop role no mapa: Mestra Ferreira Lin = 'ferreiro'). */
export function npcRole(w: World, n: Entity | null = w.openNpc): string {
  return n?.npcRole ?? n?.npcId ?? '';
}

export function openNpcWindow(w: World, n: Entity) {
  if (w.openNpc === n) return;
  w.openNpc = n;
  w.questTalk(n.npcId); // missões são do personagem, não do papel
  w.emit({ type: 'npcOpen', npcId: npcRole(w, n), entityId: n.id });
}

export function closeNpc(w: World) {
  if (!w.openNpc) return;
  w.openNpc = null;
  w.emit({ type: 'npcClose' });
}

/** Morador: anda até um ponto perto de casa, para um pouco e escolhe outro. Para quando o jogador conversa com ele. */
export function tickWalker(w: World, n: Entity, dt: number) {
  if (w.openNpc === n || (w.npcGoal === n.id && dist(n, w.player) < 2.5)) {
    n.path = [];
    return;
  }
  if (n.path.length) {
    w.followPath(n, dt, 1);
    if (!n.path.length) n.aiTimer = w.npcRng.range(2, 6);
    return;
  }
  n.aiTimer -= dt;
  if (n.aiTimer > 0) return;
  n.aiTimer = 1;
  for (let k = 0; k < 6; k++) {
    const a = w.npcRng.range(0, Math.PI * 2),
      r = w.npcRng.range(1.5, n.wander);
    const t = { x: n.home.x + Math.cos(a) * r, y: n.home.y + Math.sin(a) * r };
    if (!isWalkable(w.map, t.x, t.y)) continue;
    const path = findPath(w.map, n, t);
    if (path.length && path.length < n.wander * 3) {
      n.path = path;
      return;
    }
  }
}
