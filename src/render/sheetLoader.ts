// Memória (D6): as folhas de personagens e monstros (as imagens mais pesadas, até ~10 MB cada descomprimidas)
// são carregadas por mapa. Ficam na memória só a seita do jogador e quem aparece no mapa atual (monstros,
// invocações do chefe e NPCs); as do mapa anterior são liberadas. Cenários, pisos e ícones ficam sempre (bootScene).
import type Phaser from 'phaser';
import { MONSTERS } from '../core/data';
import type { GameMap } from '../core/map';
import type { World } from '../core/world';
import { createSheetAnims, playerTexture, queueSheet, releaseSheet, sheetFor, sheetTexture } from './sprites';

/** Folhas que um mapa usa (sprite do jogador: seita ou skin + monstros, invocações do chefe e NPCs). */
function sheetsOf(map: GameMap, player: string): Set<string> {
  const keys = new Set<string>();
  const add = (texture: string) => {
    const s = sheetFor(texture);
    if (s) keys.add(s.key);
  };
  add(player);
  for (const o of map.objects) {
    if (o.type === 'npc') add('npc-' + String(o.props.npc ?? ''));
    if (o.type !== 'monsterSpawn') continue;
    const def = MONSTERS[String(o.props.monster)];
    if (!def) continue;
    add(def.sprite);
    const summon = def.boss?.summon && MONSTERS[def.boss.summon.monsterId];
    if (summon) add(summon.sprite);
  }
  return keys;
}

/** Folhas que o mapa atual do mundo usa (mais os monstros vivos que não vêm do mapa: o chefe do Trial). */
export function sheetsForMap(world: World): Set<string> {
  const keys = sheetsOf(world.map, playerTexture(world.classId, world.skin));
  for (const m of world.monsters) {
    const def = MONSTERS[m.monsterId],
      summon = def?.boss?.summon && MONSTERS[def.boss.summon.monsterId];
    for (const texture of [def?.sprite, summon && summon.sprite]) {
      const sh = texture ? sheetFor(texture) : null;
      if (sh) keys.add(sh.key);
    }
  }
  return keys;
}

let loaded = new Set<string>();
/** Folhas adiantadas para o mapa do outro lado de um portal (ver prefetchSheets). */
let prefetched = new Set<string>();

/**
 * Jogador perto de um portal: começa a carregar em segundo plano as folhas do mapa de destino, para a troca
 * de mapa não ficar parada esperando. As que o novo mapa não usar são liberadas na próxima troca.
 */
export function prefetchSheets(scene: Phaser.Scene, map: GameMap, player: string) {
  let any = false;
  for (const k of sheetsOf(map, player)) {
    if (loaded.has(k) || prefetched.has(k)) continue;
    prefetched.add(k);
    if (scene.textures.exists(sheetTexture(k))) continue;
    queueSheet(scene, k);
    any = true;
  }
  if (any) scene.load.start();
}

/** Jogador se afastou dos portais: libera as folhas adiantadas que o mapa atual não usa (as que ainda estão
 *  chegando ficam na lista e saem na próxima troca de mapa). */
export function releasePrefetched(scene: Phaser.Scene) {
  for (const k of prefetched) {
    if (loaded.has(k)) prefetched.delete(k);
    else if (scene.textures.exists(sheetTexture(k))) {
      releaseSheet(scene, k);
      prefetched.delete(k);
    }
  }
}

/**
 * Deixa na memória exatamente as folhas do mapa atual: carrega as que faltam e libera as outras.
 * `done` é chamado quando tudo está pronto (na hora, se nada faltava). Folha que falhar ao carregar vira a
 * figura genérica (EntityView confere se a textura existe).
 */
export function syncSheets(scene: Phaser.Scene, world: World, done: () => void) {
  const want = sheetsForMap(world);
  const missing = [...want].filter((k) => !scene.textures.exists(sheetTexture(k)));
  const finish = () => {
    for (const k of want) if (scene.textures.exists(sheetTexture(k))) createSheetAnims(scene, k);
    done(); // quem chama troca os desenhos do mapa: as folhas antigas deixam de ser usadas
    for (const k of new Set([...loaded, ...prefetched])) if (!want.has(k)) releaseSheet(scene, k);
    prefetched = new Set();
    loaded = new Set([...want].filter((k) => scene.textures.exists(sheetTexture(k))));
  };
  if (!missing.length) {
    finish();
    return;
  }
  for (const k of missing) queueSheet(scene, k);
  scene.load.once('complete', finish);
  scene.load.start();
}
