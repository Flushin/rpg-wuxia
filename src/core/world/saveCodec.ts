// Save: transforma o World em SaveData (serialize) e preenche um World novo a partir do save (restore).
// Funções chamadas pelo World (fachada em src/core/world.ts), que passa a si mesmo como `w`.
import { isDungeonMap } from '../dungeons';
import { SKILL_MAX_LEVEL } from '../skills';
import { BAG_SIZE, BASES, SLOTS, sanitizeItem } from '../items';
import { HOME_MAP } from '../mapsConfig';
import { sanitizeQuest } from '../quests';
import type { SaveData } from '../types';
import { MOUNTS, SKINS } from '../data';
import { CHARACTER_SAVE_VERSION } from '../saveFormat';
import type { World } from '../world';
import { restoreMerchant, serializeMerchant } from './merchant';
import { sanitizeTrialProgress } from '../trial';

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
    lastSeen: Date.now(),
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
    bossRespawnAt: (w.bossRespawn.general_terracota ?? 0) > w.clock() ? w.bossRespawn.general_terracota : undefined,
    bossRespawns: Object.fromEntries(Object.entries(w.bossRespawn).filter(([, t]) => t > w.clock())),
    respawns: Object.fromEntries(Object.entries(w.respawnAtMs).filter(([, t]) => t > w.clock())),
    quest: { ...w.quest },
    merchant: serializeMerchant(w),
    trialProgress: Object.keys(w.trialProgress).length ? { ...w.trialProgress } : undefined,
    skins: w.skinsOwned.length ? [...w.skinsOwned] : undefined,
    skin: w.skin ?? undefined,
    mounts: w.mountsOwned.length ? [...w.mountsOwned] : undefined,
    playTime: { auto: Math.round(w.playTime.auto), manual: Math.round(w.playTime.manual) },
  };
}

// Preenche um World recém-criado (nome, seita, nível e atributos já vêm do construtor) com o resto do save.
// Valores estranhos são corrigidos aqui (save antigo, editado ou corrompido). Não aplica o ganho offline.
export function restore(w: World, s: SaveData, now: number) {
  w.xp = Math.min(Math.max(0, Number(s.xp) || 0), w.xpBankCap()); // XP guardada: no máximo XP_BANK_LEVELS níveis
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
  w.skinsOwned = (Array.isArray(s.skins) ? s.skins : []).filter(
    (id, i, a) => typeof id === 'string' && SKINS[id]?.sect === w.classId && a.indexOf(id) === i,
  );
  w.skin = s.skin && w.skinsOwned.includes(s.skin) ? s.skin : null;
  w.mountsOwned = (Array.isArray(s.mounts) ? s.mounts : []).filter(
    (id, i, a) => typeof id === 'string' && !!MOUNTS[id] && a.indexOf(id) === i,
  );
  (Array.isArray(s.bag) ? s.bag : []).slice(0, BAG_SIZE).forEach((raw, i) => {
    w.bag[i] = sanitizeItem(raw);
  });
  for (const sl of SLOTS) {
    const it = sanitizeItem(s.equipment?.[sl]);
    if (it && BASES[it.baseId]?.slot === sl) w.equipment[sl] = it;
  }
  w.recalc(w.player, false);
  w.player.hp = Math.min(w.player.hp, w.player.derived.maxHp);
  w.clock = () => now;
  w.bossRespawn = {};
  if (Number(s.bossRespawnAt) > 0) w.bossRespawn.general_terracota = Number(s.bossRespawnAt); // save antigo
  for (const [k, v] of Object.entries(s.bossRespawns ?? {}))
    if (typeof k === 'string' && Number(v) > 0) w.bossRespawn[k] = Number(v);
  for (const [k, v] of Object.entries(s.respawns ?? {}))
    if (typeof k === 'string' && Number.isFinite(Number(v)) && Number(v) > now) w.respawnAtMs[k] = Number(v);
  // masmorra e Trial não ficam salvos: quem fechou o jogo lá dentro volta para a vila (a corrida acaba)
  w.changeMap(w.maps[s.mapId] && !isDungeonMap(s.mapId) ? s.mapId : HOME_MAP);
  w.clock = () => Date.now();
  w.auto.load(s.auto);
  w.quest = sanitizeQuest(s.quest);
  w.merchant = restoreMerchant(s.merchant);
  w.trialProgress = sanitizeTrialProgress(s.trialProgress);
  const sec = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  w.playTime = { auto: sec(s.playTime?.auto), manual: sec(s.playTime?.manual) };
}
