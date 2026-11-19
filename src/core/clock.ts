// Relógio injetável do core (roadmap M0, E1a). Todo horário "de verdade" (ms desde 1970) que o core usa passa por aqui:
// ganho offline, estoque do mercador, renascimento de monstros e chefes fora do mapa, lastSeen do save e uid de itens.
// No navegador vale o relógio do aparelho (systemClock); no servidor e nos testes entra outro (fixedClock, ManualClock).
// Regra: este é o ÚNICO arquivo de src/core que pode chamar Date.now() (o tools/headless-check.ts confere).

export interface Clock {
  /** Agora, em ms desde 1970 (como Date.now()). */
  now(): number;
}

/** Relógio do aparelho. */
export const systemClock: Clock = { now: () => Date.now() };

/** Relógio parado num instante (servidor processando um envio, testes). */
export const fixedClock = (ms: number): Clock => ({ now: () => ms });

/** Relógio que só anda quando mandam (testes). */
export class ManualClock implements Clock {
  constructor(public ms: number) {}
  now() {
    return this.ms;
  }
  set(ms: number) {
    this.ms = ms;
  }
  advance(ms: number) {
    this.ms += ms;
  }
}

/** Relógio que acompanha outro número (ex.: o tempo simulado do World no simulador de balanceamento). */
export const derivedClock = (f: () => number): Clock => ({ now: f });
