// Identificador único de item (uid). Roadmap M0: "uid à prova de servidor".
// Formato: "<prefixo>-<ms em base 36>-<contador>-<aleatório>", por exemplo "d3k9x2-lq8r1c-0-4fz1".
// - prefixo: identifica o aparelho (ou, no futuro, a conta); assim dois aparelhos nunca geram o mesmo uid;
// - ms: vem do Clock (no servidor, o relógio do servidor);
// - aleatório: vem de um Rng próprio, separado do sorteio do jogo (gerar uid não muda drops nem o simulador).
// Antes era Date.now() + contador + Math.random(), fora do relógio e do RNG com semente. Uids antigos continuam válidos:
// o jogo só compara uids, nunca lê o conteúdo.
import { systemClock, type Clock } from './clock';
import { Rng } from './rng';

export interface UidSource {
  next(): string;
}

/** Gerador de uid com relógio, prefixo e semente explícitos (o servidor e os testes criam o seu). */
export function createUidSource(opts: { clock?: Clock; prefix?: string; seed?: number } = {}): UidSource {
  const clock = opts.clock ?? systemClock;
  const prefix = (opts.prefix ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  const rng = new Rng((opts.seed ?? clock.now()) >>> 0);
  let counter = 0;
  return {
    next() {
      const rand = Math.floor(rng.next() * 36 ** 4).toString(36);
      const body = `${clock.now().toString(36)}-${(counter++).toString(36)}-${rand}`;
      return prefix ? `${prefix}-${body}` : body;
    },
  };
}

let current: UidSource = createUidSource();

/** Troca o gerador usado por newUid (o jogo faz isso ao abrir, com o id do aparelho; o servidor, por envio). */
export function setUidSource(src: UidSource) {
  current = src;
}

export const newUid = () => current.next();
