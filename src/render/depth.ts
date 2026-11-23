// Camadas de desenho (setDepth). Quem anda no mapa usa a profundidade isométrica x + y (tiles), que fica entre
// 0 e algumas centenas; o chão fica bem abaixo disso e a interface desenhada no mundo, bem acima.
export const DEPTH = {
  /** pisos e água */
  GROUND: -100000,
  /** margem da água sobre o piso */
  SHORE: -99999,
  /** chão brilhando dos portais */
  PORTAL_FLOOR: -90000,
  /** área de aviso dos golpes do chefe (telegraph), por cima do chão e por baixo de todos */
  TELEGRAPH: -80000,
  /** véu da noite (Porto Noturno): por cima do mundo, abaixo dos halos, nomes e efeitos */
  NIGHT_VEIL: 99000,
  /** halos das lanternas, por cima do véu */
  NIGHT_LIGHT: 99001,
  /** topo do portão da cidade: por cima de quem passa embaixo */
  GATE_TOP: 99990,
  /** nomes acima das cabeças (casas, árvores e o portão não cortam) */
  NAME: 99995,
  /** "!" e "?" das missões acima dos NPCs */
  QUEST_MARK: 99996,
  /** efeitos das skills (cada efeito pode usar ±2 em volta) */
  SKILL_FX: 99997,
  /** traço do golpe e flechas */
  HIT_LINE: 99998,
  /** item voando até o jogador e nome dos portais */
  DROP_FX: 99999,
  /** números de dano e textos flutuantes */
  FLOAT_TEXT: 100000,
  /** aviso "Auto" acima do jogador */
  AUTO_TEXT: 100001,
} as const;
