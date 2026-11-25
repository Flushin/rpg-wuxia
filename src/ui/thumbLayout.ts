// HUD novo do celular: posição de Atacar, skills, poções e arco da ultimate com um vão padrão entre todos
// (prévia aprovada em previews/controles-celular.html). Medidas em px do HUD, a partir da borda direita (x)
// e de baixo (y); o tamanho da interface (⚙ Pequena/Média/Grande) amplia tudo junto via --ui (uiScale.ts).

export interface ThumbSizes {
  atk: number;
  sk: number;
  pot: number;
  /** vão padrão entre botões */
  gap: number;
  /** distância mínima da borda direita (gesto de voltar do Android) */
  edge: number;
  /** distância do Atacar até a borda de baixo */
  bot: number;
}
export interface ThumbLayout {
  k: ThumbSizes;
  cx: number;
  cy: number;
  /** anel das skills (centro do botão) */
  r: number;
  skills: { x: number; y: number }[];
  pots: { x: number; y: number }[];
  /** botão de reviver aliado (masmorra em equipe): à esquerda das poções, do tamanho de uma skill */
  revive: { x: number; y: number };
  /** arco da ultimate: raio do centro da faixa e ângulos (graus, 180 = esquerda, 90 = em cima) */
  ult: { r: number; from: number; to: number };
}

export const THUMB_NORMAL: ThumbSizes = { atk: 84, sk: 52, pot: 42, gap: 10, edge: 24, bot: 20 };
/** deitado com pouca altura (Fold fechado, iPhone deitado) */
export const THUMB_COMPACT: ThumbSizes = { atk: 72, sk: 46, pot: 38, gap: 8, edge: 24, bot: 10 };

const rad = (a: number) => (a * Math.PI) / 180;
const deg = (a: number) => (a * 180) / Math.PI;

/** `column`: poções uma em cima da outra (em pé, onde falta largura); senão lado a lado. */
export function thumbLayout(k: ThumbSizes, n: number, column: boolean): ThumbLayout {
  const ra = k.atk / 2,
    rs = k.sk / 2,
    rp = k.pot / 2,
    G = k.gap;
  const r = ra + G + rs; // vão G entre o Atacar e cada skill
  const step = deg(2 * Math.asin((k.sk + G) / (2 * r))); // vão G entre skills vizinhas
  const first = 188,
    last = first - (n - 1) * step;
  const cx = Math.max(k.edge + ra, k.edge + rs + r * Math.cos(rad(last))),
    cy = k.bot + ra;
  const skills = Array.from({ length: n }, (_, i) => {
    const a = rad(first - i * step);
    return { x: cx - r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  // poções: à esquerda da 1ª skill, com vão G
  const s0 = skills[0],
    px = s0.x + rs + G + rp,
    pyBase = Math.max(k.bot, s0.y - rs) + rp;
  const pots = column
    ? [
        { x: px, y: pyBase },
        { x: px, y: pyBase + k.pot + G },
      ]
    : [
        { x: px, y: pyBase },
        { x: px + k.pot + G, y: pyBase },
      ];
  // ultimate: faixa da grossura da skill, vão G por fora das skills; começa acima das poções e para antes da borda
  const ur = r + rs + G + rs;
  const potTop = Math.max(...pots.map((p) => p.y)) + rp;
  const from = 180 - deg(Math.asin(Math.min(1, Math.max(-1, (potTop + G + rs - cy) / ur)))),
    to = deg(Math.acos(Math.min(1, (cx - rs - k.edge) / ur)));
  const revive = { x: Math.max(...pots.map((p) => p.x)) + rp + G + rs, y: pyBase - rp + rs };
  return { k, cx, cy, r, skills, pots, revive, ult: { r: ur, from: Math.min(from, 186), to } };
}
