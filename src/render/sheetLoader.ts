// Memória (D6): as folhas de personagens e monstros (as imagens mais pesadas, até ~10 MB cada descomprimidas)
// são carregadas por mapa. Ficam na memória só a seita do jogador e quem aparece no mapa atual (monstros,
// invocações do chefe e NPCs); as do mapa anterior são liberadas. Cenários, pisos e ícones ficam sempre (bootScene).
import type Phaser from 'phaser';
import { MONSTERS } from '../core/data';
import type { World } from '../core/world';
import { createSheetAnims, queueSheet, releaseSheet, sheetFor, sheetTexture } from './sprites';

/** Folhas que o mapa atual do mundo usa. */
export function sheetsForMap(world: World): Set<string> {
  const keys = new Set<string>();
  const add = (texture: string) => {
    const s = sheetFor(texture);
    if (s) keys.add(s.key);
  };
  add('player-' + world.classId);
  for (const o of world.map.objects) {
    if (o.type !== 'monsterSpawn') continue;
    const def = MONSTERS[String(o.props.monster)];
    if (!def) continue;
    add(def.sprite);
    const summon = def.boss?.summon && MONSTERS[def.boss.summon.monsterId];
    if (summon) add(summon.sprite);
  }
  for (const n of world.npcs) add('npc-' + (n.npcId ?? ''));
  return keys;
}

let loaded = new Set<string>();

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
    for (const k of loaded) if (!want.has(k)) releaseSheet(scene, k);
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
