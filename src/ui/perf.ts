import { L } from '../core/i18n';

// Medidor de desempenho (marco 6): FPS atual, média e pior momento dos últimos 10 s, e quantos objetos
// estão na cena. Liga em ⚙ "Mostrar FPS"; a escolha fica salva no aparelho.
const KEY = 'rpg-fps';
const WINDOW_MS = 10000;

class PerfMeter {
  enabled = (() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  })();
  private el: HTMLElement | null = null;
  private frames: number[] = []; // duração (ms) de cada quadro recente
  private total = 0;
  private lastPaint = 0;

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      /* sem armazenamento */
    }
    if (!on) {
      this.el?.remove();
      this.el = null;
    }
  }

  /** FPS médio e "pior 1%" dos últimos 10 s (para o report de bug). */
  summary(): { avg: number; low: number } | null {
    if (this.frames.length < 10) return null;
    const sorted = [...this.frames].sort((a, b) => b - a),
      n = Math.max(1, Math.floor(sorted.length / 100));
    return {
      avg: Math.round(1000 / (this.total / this.frames.length)),
      low: Math.round(1000 / (sorted.slice(0, n).reduce((a, b) => a + b, 0) / n)),
    };
  }

  /** Chamado a cada quadro pela cena do jogo. */
  tick(deltaMs: number, objects: number) {
    // os quadros são guardados sempre (custo mínimo) para o report de bug; o contador só aparece se ligado
    this.frames.push(deltaMs);
    this.total += deltaMs;
    while (this.total > WINDOW_MS && this.frames.length > 1) this.total -= this.frames.shift()!;
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastPaint < 500) return;
    this.lastPaint = now;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'fps-meter';
      document.body.appendChild(this.el);
    }
    const recent = this.frames.slice(-30),
      cur = 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length);
    const avg = 1000 / (this.total / this.frames.length);
    // "pior": média do 1% de quadros mais lentos (mais estável que o único pior quadro)
    const sorted = [...this.frames].sort((a, b) => b - a),
      n = Math.max(1, Math.floor(sorted.length / 100));
    const low = 1000 / (sorted.slice(0, n).reduce((a, b) => a + b, 0) / n);
    const col = avg >= 50 ? '#9fe8a0' : avg >= 30 ? '#f0d070' : '#ff8a80';
    this.el.style.color = col;
    this.el.textContent = `${Math.round(cur)} FPS · ${L('média', 'avg')} ${Math.round(avg)} · ${L('pior 1%', '1% low')} ${Math.round(low)} · ${objects} obj`;
  }
}

export const perf = new PerfMeter();
