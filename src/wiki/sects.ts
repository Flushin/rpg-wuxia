// Páginas de seitas (classes) e skills.
import ultimatesJson from '../data/ultimates.json';
import { computeDerived } from '../core/stats';
import {
  BASES,
  CLASSES,
  ELEMENT_NAMES,
  freePointsText,
  SECT_ORDER,
  SKILLS,
  SKILL_MAX_LEVEL,
  STAT_LABELS,
  STARTING_WEAPON,
  NPC_TEXT,
  esc,
  iconHtml,
  skillById,
  skillScale,
  skillSect,
  skillXpToNext,
  type AttrKey,
  type SkillDef,
} from './data';
import { itemLink } from './ui';

const PORTRAITS: Record<string, string> = {
  lamina: 'tormenta_retrato.png',
  pavilhao: 'geada_retrato.png',
  tita: 'tita_retrato.png',
  vibora: 'vibora_retrato.png',
};
const ATTRS: AttrKey[] = ['strength', 'intelligence', 'stamina', 'agility', 'willpower'];
const s1 = (v: number) => String(+v.toFixed(2)).replace('.', ',');
const pc = (v: number) => `${+(v * 100).toFixed(1)}%`.replace('.', ',');
const sects = () => SECT_ORDER.filter((s) => CLASSES[s]);

// ---------- Seitas ----------
export function sectIndexPage(): string {
  return `<h1>Seitas</h1><p class="intro">A seita é a classe do personagem: define o estilo de luta, o elemento, a arma e as skills.
    É escolhida ao criar o personagem. A cada nível você ganha atributos automáticos da seita e mais ${freePointsText()} para distribuir.</p>
    <div class="grid sect-grid">${sects()
      .map((id) => {
        const c = CLASSES[id];
        return `<a class="card-link sect-card" href="#/seita/${id}" style="--c:${c.color}"><img src="../sprites/${PORTRAITS[id]}" alt="" loading="lazy">
          <b>${esc(c.name)}</b><small>${esc(c.rangeLabel)} · ${esc(ELEMENT_NAMES[c.element] ?? c.element)}</small></a>`;
      })
      .join('')}</div>`;
}

export function sectPage(id: string): string | null {
  const c = CLASSES[id];
  if (!c) return null;
  const m = NPC_TEXT.masters[id];
  const lv1 = computeDerived({ ...c.baseAttributes });
  const attrRows = ATTRS.map(
    (a) =>
      `<tr><th>${STAT_LABELS[a]}</th><td>${c.baseAttributes[a]}</td><td>${c.levelUpAttributes[a] ? `+${c.levelUpAttributes[a]}` : '—'}</td></tr>`,
  ).join('');
  const weapons = Object.keys(BASES).filter((b) => BASES[b].sect === id);
  const info = [
    ['Tipo de dano', c.damageType === 'physical' ? 'Físico (usa Ataque físico)' : 'Espiritual (usa Ataque espiritual)'],
    [
      'Elemento',
      `${esc(ELEMENT_NAMES[c.element] ?? c.element)} (+${c.elementAttack[c.element] ?? 0} de ataque elemental)`,
    ],
    ['Alcance', `${esc(c.rangeLabel)} (${s1(c.attackRange)} tiles)`],
    ['Ataque básico', `um a cada ${s1(c.attackInterval)} s${c.attackWhileMoving ? ', <b>ataca andando</b>' : ''}`],
    ['Velocidade', s1(c.moveSpeed)],
    ...(c.lifeSteal
      ? [
          [
            'Roubo de vida',
            `${pc(c.lifeSteal)} do dano causado volta como vida (só o dano que o alvo ainda podia levar; o excesso não cura)`,
          ],
        ]
      : []),
    ['Arma inicial', STARTING_WEAPON[id] ? itemLink(STARTING_WEAPON[id]) : '—'],
  ];
  return `<a class="back" href="#/seitas">‹ Seitas</a>
    <div class="detail-head"><img class="portrait" src="../sprites/${PORTRAITS[id]}" alt="" style="border-color:${c.color}">
      <div><h1>${esc(c.name)}</h1><div class="sub">${esc(c.rangeLabel)}${m ? ` · mestre: <a href="#/npc/mestre_${id}">${esc(m.name)}</a>` : ''}</div></div></div>
    <section class="panel"><p>${esc(c.description)}</p>${m ? `<p class="muted">${esc(m.intro)}</p>` : ''}
      <table class="tbl kv">${info.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table></section>
    <section class="panel"><h2>Atributos</h2>
      <table class="tbl"><thead><tr><th></th><th>No nível 1</th><th>Por nível</th></tr></thead><tbody>${attrRows}</tbody></table>
      <p class="muted">Além disso, ${freePointsText()}. Com os atributos iniciais: ${lv1.maxHp} de vida,
      ${lv1.maxMana} de mana, ${c.damageType === 'physical' ? `${lv1.physAtk} de ataque físico` : `${lv1.spiritAtk} de ataque espiritual`}.</p>
      <h3>Onde pôr os pontos</h3><ul>
      ${c.recommended.map((r) => `<li><b>${STAT_LABELS[r.attr]}</b> — ${esc(r.reason)}</li>`).join('')}
      ${c.optional.map((r) => `<li><span class="muted">Opcional:</span> <b>${STAT_LABELS[r.attr]}</b> — ${esc(r.reason)}</li>`).join('')}</ul></section>
    <section class="panel"><h2>Skills</h2>${skillTable(SKILLS[id] ?? [])}</section>
    ${ultPanel(id)}
    <section class="panel"><h2>Armas</h2><ul class="shop">${weapons
      .map((w) => `<li>${itemLink(w)} <span class="muted">nível ${BASES[w].reqLevel}</span></li>`)
      .join('')}</ul></section>`;
}

// ---------- Ultimate (src/data/ultimates.json; regras em src/core/ultimate.ts) ----------
type Ult = (typeof ultimatesJson)['lamina'] & {
  strikeDebuff?: { kind: string; value: number; duration: number };
  finalDebuff?: { kind: string; value: number; duration: number };
};
const ULTS = ultimatesJson as unknown as Record<string, Ult>;
const sec = (n: number) => String(n).replace('.', ',');
const DEBUFF_TEXT: Record<string, (d: { value: number; duration: number }, el: string) => string> = {
  slow: (d) => `fica ${pc(d.value)} mais lento por ${sec(d.duration)} s`,
  stun: (d, el) => `fica ${el === 'ice' ? 'congelado (atordoado)' : 'atordoado'} por ${sec(d.duration)} s`,
  poison: (d) => `fica envenenado por ${sec(d.duration)} s`,
  defReduction: (d) => `perde ${pc(d.value)} da defesa por ${sec(d.duration)} s`,
};
const debuffText = (el: string, d?: { kind: string; value: number; duration: number }) =>
  d ? (DEBUFF_TEXT[d.kind]?.(d, el) ?? d.kind) : '';
export function ultPanel(id: string, panel = true): string {
  const u = ULTS[id];
  if (!u) return '';
  const c = CLASSES[id],
    dmgType = c.damageType === 'spiritual' ? 'espiritual' : 'físico',
    el = (ELEMENT_NAMES[c.element] ?? c.element).toLowerCase(),
    onStrike = debuffText(c.element, u.strikeDebuff),
    onFinal = debuffText(c.element, u.finalDebuff);
  const effects =
    onStrike || onFinal
      ? `<li><b>Efeitos:</b> ${[
          onStrike && `a cada golpe que acerta, o monstro ${onStrike}`,
          onFinal && `no estouro, ${onFinal}`,
        ]
          .filter(Boolean)
          .join('; ')}. Se o golpe errar, o efeito não pega.</li>`
      : '';
  const body = `<h3><span style="color:${u.color}">${esc(u.icon)}</span> ${esc(u.name)} <small class="muted">· Ultimate · nível ${u.unlock}</small></h3>
    <p>${esc(u.description)}</p>
    <ul><li><b>Carga:</b> a barra enche 1 ponto a cada skill que acerta pelo menos um monstro; com ${u.charge} pontos fica pronta.
      Usar skill no vazio e o dano da própria ultimate não carregam.</li>
    <li><b>Fora de combate:</b> depois de ${u.idleDelay} s sem lutar, a barra perde ${u.idleDrain} ponto por segundo.</li>
    <li><b>Duração:</b> ${u.duration} s flutuando parado, com os braços para cima; os golpes caem um de cada vez, intercalados entre os monstros: ${u.strikes} golpes de ${pc(u.strikeMult)} do dano em todos os monstros a até ${u.radius} tiles e um estouro final de ${pc(u.finalMult)} (${pc(u.strikes * u.strikeMult + u.finalMult)} no total).</li>
    ${effects}
    <li><b>Muitos alvos:</b> até ${u.fullTargets} monstros levam o dano cheio; com mais, cada um leva ${u.fullTargets} ÷ (monstros no raio) do dano.</li>
    <li><b>Dano:</b> a mesma conta das skills (ataque ${dmgType} + ataque de ${el}, contra defesa ${dmgType} e resistência a ${el} do alvo). Pode errar e dar crítico${c.lifeSteal ? '; não recupera vida' : ''}. Não sobe de nível.</li>
    <li><b>Só o jogador solta:</b> o Auto-combate nunca usa a ultimate. No celular, toque no arco em volta das skills; no PC, botão ao lado das skills ou tecla <b>R</b>.</li></ul>`;
  return panel ? `<section class="panel"><h2>Ultimate</h2>${body}</section>` : body;
}

function skillTable(list: SkillDef[]): string {
  return `<ul class="skill-list">${list
    .map(
      (
        s,
      ) => `<li><a href="#/skill/${s.id}">${iconHtml('skill_' + s.id)}</a><div><a href="#/skill/${s.id}"><b>${esc(s.name)}</b></a>
        <small class="muted"> · nível ${s.unlock} · ${s.type === 'passive' ? 'passiva' : `${s.mana} mana, recarga ${s1(s.cooldown ?? 0)} s`}</small>
        <div class="muted">${esc(s.description)}</div></div></li>`,
    )
    .join('')}</ul>`;
}

// ---------- Skills ----------
export function skillIndexPage(): string {
  return `<h1>Skills</h1><p class="intro">Cada seita tem 4 skills ativas e 1 passiva, liberadas pelo nível do personagem.
    As ativas sobem de nível com o <b>uso</b>; as passivas sobem junto com o nível do personagem. Nível máximo ${SKILL_MAX_LEVEL}.</p>
    ${sects()
      .map(
        (id) =>
          `<h2 style="color:${CLASSES[id].color}">${esc(CLASSES[id].name)}</h2>${skillTable(SKILLS[id] ?? [])}${ultPanel(id, false)}`,
      )
      .join('')}`;
}

const PASSIVE_LABEL: Record<string, (v: number) => string> = {
  attackSpeed: (v) => `+${pc(v)} de velocidade de ataque`,
  crit: (v) => `+${pc(v)} de chance de crítico`,
  manaRegen: (v) => `regenera ${pc(v)} da mana máxima por segundo (fora da cidade)`,
  damageTaken: (v) => `recebe ${pc(v)} menos dano`,
  maxHp: (v) => `+${pc(v)} de vida máxima`,
  poisonedBonus: (v) => `+${pc(v)} de dano em alvos envenenados`,
};
const DEBUFF: Record<string, string> = { slow: 'lentidão', defReduction: 'redução de defesa' };

/** Efeitos que crescem com o nível da skill, num nível dado. */
function effects(s: SkillDef, lv: number): string[] {
  const k = skillScale(lv),
    out: string[] = [];
  if (s.hits?.length) {
    const each = s.hits.map((h) => pc(h * k));
    out.push(s.hits.length > 1 ? `${s.hits.length} golpes de ${each.join(' + ')} do dano` : `${each[0]} do dano`);
  }
  if (s.poison) out.push(`veneno de ${pc(s.poison.percent * k)} do dano em ${s1(s.poison.duration)} s`);
  if (s.shield) out.push(`escudo de ${pc(s.shield.percent * k)} da vida máxima por ${s1(s.shield.duration)} s`);
  if (s.heal) out.push(`cura ${pc(s.heal.percent * k)} da vida máxima em ${s1(s.heal.duration)} s`);
  for (const [key, v] of Object.entries(s.passive ?? {}))
    out.push(PASSIVE_LABEL[key]?.(v * k) ?? `${key} ${pc(v * k)}`);
  return out;
}

export function skillPage(id: string): string | null {
  const s = skillById(id);
  if (!s) return null;
  const sect = skillSect(id)!,
    c = CLASSES[sect];
  const range =
    s.area === 'self'
      ? `área em volta de você (raio ${s1(s.radius ?? 0)})`
      : s.area === 'target'
        ? `área em volta do alvo (raio ${s1(s.radius ?? 0)}), alcance ${s1(Number(s.range) || 0)}`
        : s.range === 'melee'
          ? 'corpo a corpo'
          : s.range
            ? `alcance ${s1(s.range)}${s.dash ? ', avança até o alvo' : ''}`
            : 'em você mesmo';
  const info = [
    ['Seita', `<a href="#/seita/${sect}">${esc(c.name)}</a>`],
    ['Tipo', s.type === 'passive' ? 'Passiva' : 'Ativa'],
    ['Libera no nível', String(s.unlock)],
    ...(s.type === 'active'
      ? [
          ['Mana', String(s.mana ?? 0)],
          ['Recarga', `${s1(s.cooldown ?? 0)} s`],
          ['Alvo', s.target === 'none' ? 'não precisa de alvo' : 'precisa de alvo'],
          ['Alcance', range],
        ]
      : []),
    ...(s.debuff
      ? [
          [
            'Efeito no alvo',
            `${DEBUFF[s.debuff.kind] ?? s.debuff.kind} de ${pc(s.debuff.value)} por ${s1(s.debuff.duration)} s`,
          ],
        ]
      : []),
    ...(s.stun ? [['Atordoamento', `${s1(s.stun)} s`]] : []),
  ];
  // nível da skill: usos acumulados até cada nível (ativas) ou nível do personagem (passivas)
  const levels = [1, 2, 3, 5, 10, SKILL_MAX_LEVEL].filter((l, i, a) => a.indexOf(l) === i);
  let uses = 0;
  const cum: Record<number, number> = { 1: 0 };
  for (let l = 1; l < SKILL_MAX_LEVEL; l++) cum[l + 1] = uses += skillXpToNext(l);
  const rows = levels
    .map(
      (l) =>
        `<tr><td><b>${l}</b></td><td>${s.type === 'passive' ? `personagem nível ${s.unlock + l - 1}` : l === 1 ? 'ao liberar' : `${cum[l]} usos`}</td><td>${effects(s, l).join('; ') || '—'}</td></tr>`,
    )
    .join('');
  return `<a class="back" href="#/skills">‹ Skills</a>
    <div class="detail-head">${iconHtml('skill_' + id, 'big')}<div><h1>${esc(s.name)}</h1><div class="sub">${s.type === 'passive' ? 'Passiva' : 'Ativa'} · ${esc(c.name)}</div></div></div>
    <section class="panel"><p>${esc(s.description)}</p><table class="tbl kv">${info.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table></section>
    <section class="panel"><h2>Por nível da skill</h2>
      <p class="muted">${s.type === 'passive' ? 'Sobe 1 nível a cada nível do personagem.' : 'Cada uso dá 1 de experiência à skill.'}
      Cada nível soma ${Math.round((skillScale(2) - 1) * 100)}% ao efeito (dano, veneno, escudo, cura e bônus passivos); lentidão e atordoamento não mudam.</p>
      <table class="tbl"><thead><tr><th>Nível</th><th>Quando</th><th>Efeito</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
