// Save: transforma o World em SaveData (serialize) e preenche um World novo a partir do save (restore).
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { SKILL_MAX_LEVEL } from '../skills';
import { BAG_SIZE, BASES, SLOTS, sanitizeItem } from '../items';
import { HOME_MAP } from '../mapsConfig';
import { sanitizeQuest } from '../quests';
import type { SaveData } from '../types';
import { CHARACTER_SAVE_VERSION } from '../saveFormat';
import type { World } from '../world';
import { restoreMerchant, serializeMerchant } from './merchant';
import { fixedClock, type Clock } from '../clock';

export function serialize(w: World): SaveData {
  return {
    version: CHARACTER_SAVE_VERSION,
    name: w.player.name,
    classId: w.classId,
    level: w.player.level,
    xp: w.xp,
    freePoints: w.freePoints,
    attributes: { ...w.player.attrs },
    mapId: w.mapId,
    lastSeen: w.clock.now(),
    skills: Object.fromEntries(Object.entries(w.skills).map(([id, st]) => [id, { level: st.level, xp: st.xp }])),
    ratioCursor: w.ratioCursor,
    seenTips: [...w.seenTips],
    tipsEnabled: w.tipsEnabled,
    audio: { ...w.audio },
    gold: w.gold,
    bag: JSON.parse(JSON.stringify(w.bag)),
    equipment: JSON.parse(
      JSON.stringify(Object.fromEntries(SLOTS.filter((sl) => w.equipment[sl]).map((sl) => [sl, w.equipment[sl]]))),
    ),
    auto: w.auto.serialize(),
    bossRespawnAt: (w.bossRespawn.general_terracota ?? 0) > w.clock.now() ? w.bossRespawn.general_terracota : undefined,
    bossRespawns: Object.fromEntries(Object.entries(w.bossRespawn).filter(([, t]) => t > w.clock.now())),
    respawns: Object.fromEntries(Object.entries(w.respawnAtMs).filter(([, t]) => t > w.clock.now())),
    quest: { ...w.quest },
    merchant: serializeMerchant(w),
  };
}

// Preenche um World recém-criado (nome, seita, nível e atributos já vêm do construtor) com o resto do save.
// Valores estranhos são corrigidos aqui (save antigo, editado ou corrompido). Não aplica o ganho offline.
export function restore(w: World, s: SaveData, now: number, clock: Clock) {
  w.xp = s.xp;
  w.freePoints = s.freePoints;
  w.ratioCursor = s.ratioCursor ?? 0;
  w.seenTips = [...(s.seenTips ?? [])];
  w.tipsEnabled = s.tipsEnabled ?? true;
  w.audio = { sfx: s.audio?.sfx ?? 80, music: s.audio?.music ?? 50, muted: s.audio?.muted ?? false };
  for (const [id, st] of Object.entries(s.skills ?? {})) {
    const cur = w.skills[id];
    if (!cur) continue;
    cur.level = Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(Number(st.level) || 1)));
    cur.xp = cur.level >= SKILL_MAX_LEVEL ? 0 : Math.max(0, Number(st.xp) || 0);
  }
  w.gold = Math.max(0, Math.floor(Number(s.gold) || 0));
  (Array.isArray(s.bag) ? s.bag : []).slice(0, BAG_SIZE).forEach((raw, i) => {
    w.bag[i] = sanitizeItem(raw);
  });
  for (const sl of SLOTS) {
    const it = sanitizeItem(s.equipment?.[sl]);
    if (it && BASES[it.baseId]?.slot === sl) w.equipment[sl] = it;
  }
  w.recalc(w.player, false);
  w.player.hp = Math.min(w.player.hp, w.player.derived.maxHp);
  w.clock = fixedClock(now); // a troca de mapa abaixo usa o instante da carga
  w.bossRespawn = {};
  if (Number(s.bossRespawnAt) > 0) w.bossRespawn.general_terracota = Number(s.bossRespawnAt); // save antigo
  for (const [k, v] of Object.entries(s.bossRespawns ?? {}))
    if (typeof k === 'string' && Number(v) > 0) w.bossRespawn[k] = Number(v);
  for (const [k, v] of Object.entries(s.respawns ?? {}))
    if (typeof k === 'string' && Number.isFinite(Number(v)) && Number(v) > now) w.respawnAtMs[k] = Number(v);
  w.changeMap(w.maps[s.mapId] ? s.mapId : HOME_MAP);
  w.clock = clock;
  w.auto.load(s.auto);
  w.quest = sanitizeQuest(s.quest);
  w.merchant = restoreMerchant(s.merchant);
}
