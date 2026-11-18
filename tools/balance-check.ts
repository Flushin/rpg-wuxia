// Verificação headless do módulo de balanceamento (src/core/balance.ts + src/data/balance.json).
// Uso: npm run check:balance
import { readFileSync } from 'node:fs';
import {
  KNOBS,
  bal,
  balanceClasses,
  balanceItems,
  balanceMonsters,
  balanceOffline,
  balanceProgression,
  balanceQuests,
  balanceSkills,
  currentBalance,
  parseBalanceKey,
  setBalance,
  validateBalance,
  type BalanceFile,
  type BalanceScope,
} from '../src/core/balance';
import { skillScale, skillXpToNext } from '../src/core/skills';
import { MONSTERS } from '../src/core/data';
import { parseTiledMap, type GameMap } from '../src/core/map';
import { World } from '../src/core/world';
import { Rng } from '../src/core/rng';
import type { Entity } from '../src/core/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.error('  FALHOU:', m);
  } else console.log('  ok:', m);
};
// JSON do disco (os importados pelo jogo já receberam os multiplicadores)
const raw = (f: string) => JSON.parse(readFileSync(`src/data/${f}.json`, 'utf8'));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const file = raw('balance') as BalanceFile;
const IDS: Record<BalanceScope, string[]> = {
  monstro: Object.keys(raw('monsters')),
  skill: (Object.values(raw('skills')) as { id: string }[][]).flat().map((s) => s.id),
  seita: Object.keys(raw('classes')),
  pocao: Object.keys(raw('items').potions),
  missao: (raw('quests').chain as { id: string }[]).map((q) => q.id),
  nivel: (raw('progression').xpToNext as number[]).map((_, i) => String(i + 1)),
};
const saved = currentBalance();

console.log('\n== balance.json ==');
const errs = validateBalance(file.multiplicadores, IDS);
ok(!errs.length, `chaves e valores válidos${errs.length ? ': ' + errs.join('; ') : ''}`);
ok(Array.isArray(file.historico), 'tem histórico');
ok(same(saved, file.multiplicadores), 'o jogo carrega os mesmos multiplicadores do arquivo');

console.log('\n== chaves ==');
ok(parseBalanceKey('xp.monstros')?.key === 'xp.monstros', 'chave global');
const sc = parseBalanceKey('xp.monstros.lobo');
ok(sc?.key === 'xp.monstros' && sc.id === 'lobo', 'chave com id');
ok(parseBalanceKey('venda.itens.lobo') === null, 'id em chave que não aceita id é recusado');
ok(parseBalanceKey('xp.inexistente') === null, 'chave inexistente é recusada');
ok(validateBalance({ 'xp.monstros.lobinho': 1.1 }, IDS).length === 1, 'id inexistente é recusado');
ok(validateBalance({ 'xp.monstros': 0 }, IDS).length === 1, 'valor 0 é recusado');
ok(
  Object.values(KNOBS).every((k) => k.desc && k.grupo),
  `${Object.keys(KNOBS).length} chaves, todas com grupo e descrição`,
);

console.log('\n== tudo em 0% não muda nenhum número ==');
setBalance({});
{
  const m = raw('monsters'),
    s = raw('skills'),
    c = raw('classes'),
    it = raw('items'),
    q = raw('quests'),
    p = raw('progression');
  const off = [{ eff: 0.6 }, { eff: 0.4 }, { eff: 0.2 }];
  balanceMonsters(m);
  balanceSkills(s);
  balanceClasses(c);
  balanceItems(it);
  balanceQuests(q.chain);
  balanceProgression(p);
  balanceOffline(off);
  ok(same(m, raw('monsters')), 'monstros');
  ok(same(s, raw('skills')), 'skills');
  ok(same(c, raw('classes')), 'seitas');
  ok(same(it, raw('items')), 'itens e poções');
  ok(same(q, raw('quests')), 'missões');
  ok(same(p, raw('progression')), 'curva de XP');
  ok(same(off, [{ eff: 0.6 }, { eff: 0.4 }, { eff: 0.2 }]), 'offline');
  ok(skillXpToNext(1) === 20 && skillXpToNext(3) === 45, 'XP de skill');
  ok(near(skillScale(10), 1.72), 'bônus por nível de skill');
}

console.log('\n== cada chave muda o que diz ==');
{
  setBalance({
    'xp.monstros': 1.5,
    'ouro.monstros': 2,
    'drop.pocoes': 2,
    'drop.equipamento.lobo': 2,
    'respawn.monstros': 0.5,
  });
  const m = raw('monsters'),
    o = raw('monsters');
  balanceMonsters(m);
  ok(m.lobo.xpBase === o.lobo.xpBase * 1.5 && m.lobo.xpPerLevel === o.lobo.xpPerLevel * 1.5, 'xp.monstros +50%');
  ok(m.lobo.loot.gold.min === o.lobo.loot.gold.min * 2, 'ouro.monstros +100%');
  ok(near(m.lobo.loot.potions[0].chance, o.lobo.loot.potions[0].chance * 2), 'drop.pocoes +100%');
  ok(near(m.lobo.loot.equipment.chance, o.lobo.loot.equipment.chance * 2), 'drop.equipamento.lobo só no lobo');
  ok(
    near(m.bandido_espadachim.loot.equipment[0].chance, o.bandido_espadachim.loot.equipment[0].chance),
    '…não nos bandidos',
  );
  ok(m.lobo.respawnSeconds === o.lobo.respawnSeconds / 2, 'respawn.monstros −50%');

  setBalance({ 'xp.monstros': 2, 'xp.monstros.lobo': 1.5 });
  const m2 = raw('monsters');
  balanceMonsters(m2);
  ok(m2.lobo.xpBase === o.lobo.xpBase * 3, 'global × específico se multiplicam');
  ok(m2.bandido_espadachim.xpBase === o.bandido_espadachim.xpBase * 2, 'específico não vaza para outros');

  setBalance({ 'xp.niveis': 1.1, 'xp.niveis.1': 2 });
  const p = raw('progression'),
    po = raw('progression');
  balanceProgression(p);
  ok(p.xpToNext[0] === Math.round(po.xpToNext[0] * 2.2), 'xp.niveis.1 = nível 1→2');
  ok(p.xpToNext[1] === Math.round(po.xpToNext[1] * 1.1), 'xp.niveis vale para os outros');

  setBalance({ 'skills.mana': 1.5, 'skills.recarga.corte_duplo': 2, 'dano.skills': 1.1 });
  const s = raw('skills'),
    so = raw('skills');
  balanceSkills(s);
  ok(s.lamina[0].mana === Math.round(so.lamina[0].mana * 1.5), 'skills.mana');
  ok(
    s.lamina[0].cooldown === so.lamina[0].cooldown * 2 && s.lamina[1].cooldown === so.lamina[1].cooldown,
    'skills.recarga só na skill',
  );
  ok(near(s.lamina[0].hits[0], so.lamina[0].hits[0] * 1.1), 'dano.skills');
  const vib = (s.vibora as { poison?: { percent: number } }[]).find((x) => x.poison);
  const vibo = (so.vibora as { poison?: { percent: number } }[]).find((x) => x.poison);
  ok(!!vib && near(vib.poison!.percent, vibo!.poison!.percent * 1.1), 'dano.skills vale para o veneno');

  setBalance({
    'precos.pocoes': 1.5,
    'cura.pocoes.pocao_hp_p': 2,
    'venda.itens': 2,
    'conserto.custo': 0.5,
    'desgaste.equipamento': 2,
    'drop.raros': 2,
  });
  const it = raw('items'),
    io = raw('items');
  balanceItems(it);
  ok(it.potions.pocao_hp_p.price === Math.round(io.potions.pocao_hp_p.price * 1.5), 'precos.pocoes');
  ok(near(it.potions.pocao_hp_p.percent, io.potions.pocao_hp_p.percent * 2), 'cura.pocoes.pocao_hp_p');
  ok(near(it.potions.pocao_mp_p.percent, io.potions.pocao_mp_p.percent), '…não muda a de mana');
  ok(near(it.sellRatio, io.sellRatio * 2), 'venda.itens');
  ok(near(it.repairCostPerPoint, io.repairCostPerPoint / 2), 'conserto.custo');
  ok(near(it.wearPerHit, io.wearPerHit * 2), 'desgaste.equipamento');
  ok(
    it.rarities.raro.weight === io.rarities.raro.weight * 2 && it.rarities.comum.weight === io.rarities.comum.weight,
    'drop.raros',
  );

  setBalance({ 'xp.missoes': 1.5, 'ouro.missoes': 2, roubo_vida: 2, 'offline.eficiencia': 2 });
  const q = raw('quests'),
    qo = raw('quests'),
    c = raw('classes'),
    co = raw('classes'),
    off = [{ eff: 0.6 }, { eff: 0.4 }];
  balanceQuests(q.chain);
  balanceClasses(c);
  balanceOffline(off);
  ok(q.chain[0].reward.xp === Math.round(qo.chain[0].reward.xp * 1.5), 'xp.missoes');
  ok(q.chain[0].reward.gold === qo.chain[0].reward.gold * 2, 'ouro.missoes');
  ok(near(c.lamina.lifeSteal, co.lamina.lifeSteal * 2), 'roubo_vida');
  ok(off[0].eff === 1 && near(off[1].eff, 0.8), 'offline.eficiencia (máximo 100%)');

  setBalance({ 'xp.skills': 2, 'skills.bonus_por_nivel': 1.5 });
  ok(skillXpToNext(1) === 10, 'xp.skills +100% = metade dos usos');
  ok(near(skillScale(10), 1 + 0.08 * 1.5 * 9), 'skills.bonus_por_nivel');
}

console.log('\n== regras no World (dano e vida) ==');
{
  const maps: Record<string, GameMap> = {};
  for (const id of ['cidade', 'floresta'])
    maps[id] = parseTiledMap(id, JSON.parse(readFileSync(`public/maps/${id}.json`, 'utf8')));
  type Priv = { attack: (a: Entity, t: Entity, mult?: number) => { hit: boolean; amount: number } };
  // mesmo sorteio nas duas rodadas: a única diferença é o multiplicador
  const run = (m: Record<string, number>) => {
    setBalance(m);
    const w = World.create(maps, 'T', 'lamina');
    w.changeMap('floresta');
    const lobo = w.monsters.find((x) => x.monsterId === 'lobo')!;
    w.applyMonsterLevel(lobo, MONSTERS.lobo, 2);
    const maxHp = lobo.derived.maxHp;
    lobo.hp = 1e6;
    w.player.hp = 1e6;
    (w as unknown as { rng: Rng }).rng = new Rng(7);
    let dealt = 0,
      taken = 0;
    for (let i = 0; i < 40; i++) {
      w.player.hp = lobo.hp = 1e6; // o roubo de vida limita a vida do jogador ao máximo
      const a = (w as unknown as Priv).attack(w.player, lobo);
      if (a.hit) dealt += a.amount;
      const b = (w as unknown as Priv).attack(lobo, w.player);
      if (b.hit) taken += b.amount;
    }
    w.recalc(w.player, false);
    return { maxHp, dealt, taken, playerHp: w.player.derived.maxHp };
  };
  const base = run({}),
    dmg = run({ 'dano.jogador': 2 }),
    up = run({ 'dano.monstros.lobo': 3, 'vida.monstros': 1.5, 'vida.jogador.lamina': 1.2 });
  ok(dmg.dealt === base.dealt * 2, `dano.jogador ×2 (${base.dealt} → ${dmg.dealt})`);
  ok(Math.abs(up.taken / base.taken - 3) < 0.1, `dano.monstros.lobo ×3 (${base.taken} → ${up.taken})`);
  ok(up.maxHp === Math.round(base.maxHp * 1.5), `vida.monstros +50% (${base.maxHp} → ${up.maxHp})`);
  ok(up.playerHp === Math.round(base.playerHp * 1.2), `vida.jogador.lamina +20% (${base.playerHp} → ${up.playerHp})`);
  const other = run({ 'vida.jogador.pavilhao': 2 });
  ok(other.playerHp === base.playerHp, 'vida.jogador de outra seita não muda a Tormenta');
  ok(bal('vida.jogador', 'pavilhao') === 2 && bal('vida.jogador') === 1, 'bal(): global e por id');
}
setBalance(saved);

console.log(fails ? `\n${fails} FALHA(S)` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
