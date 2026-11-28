/**
 * Pacote do veterano ("Fundadores"): para quem jogou a primeira versão (offline) do jogo.
 * Quem é veterano será decidido pelo servidor (lista manual); por enquanto só o modo de desenvolvimento marca
 * (?fundador=1 na URL). Decisões em docs/decisoes/ (veteranos).
 * - Título «Discípulo Fundador» (arena.json, exclusive: 'fundador'), dado na hora e vestido se não usa outro.
 * - Uma montaria exclusiva à escolha (mounts.json, exclusive: 'fundador'), definitiva, valendo desde o nível 1.
 * - XP em dobro até o nível FOUNDER_XP_UNTIL e ouro ganho (monstros, missões, offline) em dobro até FOUNDER_GOLD_UNTIL.
 */
import { MOUNTS } from './data';
import { ARENA_TITLES, titleWing } from './arena';
import type { World } from './world';

/** Título vestido ao virar Fundador; o Fundador ganha todos de FOUNDER_TITLES (mesmo nome, asas de cores diferentes). */
export const FOUNDER_TITLE = 'discipulo_fundador';
export const FOUNDER_TITLES = ['discipulo_fundador', 'discipulo_fundador_celeste', 'discipulo_fundador_noite'];
export const FOUNDER_XP_UNTIL = 30;
export const FOUNDER_GOLD_UNTIL = 50;
export const FOUNDER_MUL = 2;
/** Versão offline: todo personagem é Fundador (agradecimento a quem joga antes do online). No online, desligar e
 *  marcar pelo campo `fundador` da conta no banco (docs/decisoes/veteranos.md). */
export const FOUNDER_FOR_ALL = true;

/** Estado salvo: null = não é veterano; mount null = ainda não escolheu. */
export interface FounderState {
  mount: string | null;
}

export const founderMounts = () => Object.keys(MOUNTS).filter((id) => MOUNTS[id].exclusive === 'fundador');

/** Multiplicador de XP agora (abaixo do nível FOUNDER_XP_UNTIL). */
export const founderXpMul = (w: World) => (w.founder && w.player.level < FOUNDER_XP_UNTIL ? FOUNDER_MUL : 1);
/** Multiplicador de ouro ganho agora (abaixo do nível FOUNDER_GOLD_UNTIL). */
export const founderGoldMul = (w: World) => (w.founder && w.player.level < FOUNDER_GOLD_UNTIL ? FOUNDER_MUL : 1);
/** Ouro ganho já com o bônus do veterano. */
export const founderGold = (w: World, g: number) => Math.round(g * founderGoldMul(w));

/** Marca o personagem como veterano (idempotente): dá o título e o veste se não usa outro. */
export function grantFounder(w: World) {
  if (!w.founder) w.founder = { mount: null };
  for (const id of FOUNDER_TITLES) if (ARENA_TITLES[id] && !w.arena.titles.includes(id)) w.arena.titles.push(id);
  if (!w.arena.title && ARENA_TITLES[FOUNDER_TITLE]) {
    w.arena.title = FOUNDER_TITLE;
    w.player.title = ARENA_TITLES[FOUNDER_TITLE].name;
    w.player.titleWing = titleWing(FOUNDER_TITLE);
  }
  w.bumpInv();
}

/** Escolha definitiva da montaria de Fundador; ela passa a ser a usada (primeira da lista). */
export function chooseFounderMount(w: World, id: string): boolean {
  if (!w.founder || w.founder.mount || MOUNTS[id]?.exclusive !== 'fundador') return false;
  w.founder.mount = id;
  w.mountsOwned = [id, ...w.mountsOwned.filter((m) => m !== id)];
  w.bumpInv();
  w.emit({ type: 'skinChange' }); // a cena carrega a folha da montaria
  return true;
}

/** Validação do save: só aceita montaria exclusiva. */
export function restoreFounder(raw: unknown): FounderState | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = (raw as { mount?: unknown }).mount;
  return { mount: typeof m === 'string' && MOUNTS[m]?.exclusive === 'fundador' ? m : null };
}
