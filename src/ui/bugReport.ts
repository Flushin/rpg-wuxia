import { L, LANG } from '../core/i18n';
import type { World } from '../core/world';
import { CLASSES } from '../core/data';
import { closeX } from './labels';
import { audio } from '../render/audio';
import { isTouch } from './controls';
import { perf } from './perf';

// Reportar bug: botão em ⚙ abre uma caixa de texto; o report vai por e-mail para o Lucas pelo Web3Forms
// (grátis, 250 envios/mês, sem anexo). Junto vão dados do jogo, do aparelho, FPS e os últimos erros do console.
// A chave do Web3Forms é pública por natureza (fica no JS do site); ela só permite enviar e-mail para o dono.
export const BUG_REPORT_KEY = '7eb73268-6a10-45f2-97a1-9325e680240b';
const ENDPOINT = 'https://api.web3forms.com/submit';
const COOLDOWN_MS = 60_000;
const LAST_KEY = 'rpg-bug-last';
const MAX_ERRORS = 10;

const errors: string[] = [];
function pushError(msg: string) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`.slice(0, 500);
  if (errors[errors.length - 1] === line) return;
  errors.push(line);
  if (errors.length > MAX_ERRORS) errors.shift();
}

/** Começa a guardar os erros do console. Chamar o quanto antes (main.ts). */
export function captureErrors() {
  window.addEventListener('error', (e) =>
    pushError(
      `${e.message} @ ${e.filename?.split('/').pop() ?? '?'}:${e.lineno}:${e.colno}${e.error?.stack ? `\n${String(e.error.stack).split('\n').slice(1, 4).join('\n')}` : ''}`,
    ),
  );
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    pushError(
      `Promise: ${r?.message ?? String(e.reason)}${r?.stack ? `\n${r.stack.split('\n').slice(1, 4).join('\n')}` : ''}`,
    );
  });
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushError(
      args.map((a) => (a instanceof Error ? `${a.message}` : typeof a === 'string' ? a : safeJson(a))).join(' '),
    );
    orig(...args);
  };
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function gameInfo(w: World): string {
  const p = w.player,
    q = w.questView();
  return [
    `Personagem: ${p.name} · ${CLASSES[w.classId]?.name ?? w.classId} · nível ${p.level}`,
    `Mapa: ${w.mapId} · posição ${p.x.toFixed(1)}, ${p.y.toFixed(1)} · HP ${Math.round(p.hp)} · ${p.dead ? 'morto' : 'vivo'}`,
    `Auto-combate: ${w.auto.state}`,
    `Missão: ${q.def ? `${w.quest.stage + 1}. ${q.def.name} (${q.phase}, ${q.progress}/${q.count})` : `etapa ${w.quest.stage} (${q.phase})`}`,
    `Alvo: ${w.targetId != null ? (w.monsters.find((m) => m.id === w.targetId)?.name ?? w.targetId) : 'nenhum'} · monstros vivos no mapa: ${w.monsters.filter((m) => !m.dead).length}`,
  ].join('\n');
}

function deviceInfo(): string {
  const f = perf.summary();
  return [
    `Navegador: ${navigator.userAgent}`,
    `Tela: ${screen.width}×${screen.height} · janela ${innerWidth}×${innerHeight} · DPR ${devicePixelRatio} · ${innerWidth > innerHeight ? 'deitado' : 'em pé'} · ${isTouch ? 'toque' : 'mouse'}`,
    `Idioma: ${LANG} (${navigator.language})`,
    `FPS (últimos 10 s): ${f ? `média ${f.avg} · pior 1% ${f.low}` : 'sem dados'}`,
  ].join('\n');
}

export class BugReport {
  private el: HTMLElement;

  constructor(private world: World) {
    this.el = document.createElement('div');
    this.el.id = 'bug-panel';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.onclick = (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!t) {
        if (e.target === this.el) this.close();
        return;
      }
      audio.ui('ui_click');
      if (t.dataset.act === 'close') this.close();
      else if (t.dataset.act === 'send') void this.send();
    };
  }

  open() {
    audio.ui('ui_open');
    const ready = !!BUG_REPORT_KEY;
    this.el.innerHTML = `<div class="card">${closeX('data-act="close"')}<h2>🐞 ${L('Reportar bug', 'Report a bug')}</h2>
      <small class="muted">${L(
        'Conte o que aconteceu e o que você estava fazendo. Junto vão a versão do jogo, seu personagem, mapa, aparelho, FPS e erros técnicos (nada da sua conta ou de outros apps).',
        'Tell what happened and what you were doing. The game version, your character, map, device, FPS and technical errors are sent too (nothing from your accounts or other apps).',
      )}</small>
      <textarea id="bug-text" rows="6" maxlength="2000" placeholder="${L('Ex.: matei o lobo e ele não sumiu…', 'E.g.: I killed the wolf and it did not disappear…')}"></textarea>
      <input id="bug-contact" maxlength="80" placeholder="${L('Seu nome ou contato (opcional)', 'Your name or contact (optional)')}"/>
      <small id="bug-status" class="muted">${ready ? '' : L('O envio de reports ainda não foi configurado.', 'Bug reports are not set up yet.')}</small>
      <button class="primary" data-act="send" ${ready ? '' : 'disabled'}>${L('Enviar', 'Send')}</button>
      <button data-act="close">${L('Cancelar', 'Cancel')}</button></div>`;
    this.el.classList.remove('hidden');
    if (!isTouch) (this.el.querySelector('#bug-text') as HTMLTextAreaElement | null)?.focus();
  }

  close() {
    this.el.classList.add('hidden');
    audio.ui('ui_close');
  }

  private status(msg: string, ok = false) {
    const s = this.el.querySelector('#bug-status') as HTMLElement | null;
    if (s) {
      s.textContent = msg;
      s.style.color = ok ? '#9fe8a0' : '#ff8a80';
    }
  }

  private async send() {
    const text = (this.el.querySelector('#bug-text') as HTMLTextAreaElement).value.trim();
    const contact = (this.el.querySelector('#bug-contact') as HTMLInputElement).value.trim();
    if (text.length < 5) {
      this.status(L('Escreva o que aconteceu.', 'Describe what happened.'));
      return;
    }
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_KEY)) || 0;
    } catch {
      /* sem armazenamento */
    }
    const wait = Math.ceil((last + COOLDOWN_MS - Date.now()) / 1000);
    if (wait > 0) {
      this.status(L(`Aguarde ${wait} s para enviar outro report.`, `Wait ${wait} s to send another report.`));
      return;
    }
    const btn = this.el.querySelector('[data-act="send"]') as HTMLButtonElement;
    btn.disabled = true;
    this.status(L('Enviando…', 'Sending…'), true);
    const w = this.world;
    const message = [
      text,
      '',
      `— Jogo —\nVersão: ${__APP_VERSION__} (${__BUILD__})\n${gameInfo(w)}`,
      '',
      `— Aparelho —\n${deviceInfo()}`,
      '',
      `— Erros do console (${errors.length}) —\n${errors.length ? errors.join('\n') : 'nenhum'}`,
    ].join('\n');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: BUG_REPORT_KEY,
          subject: `[RPG bug] ${w.player.name} nv ${w.player.level} · ${w.mapId} — ${text.slice(0, 50)}`,
          from_name: contact || w.player.name,
          message,
          botcheck: false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {
        /* sem armazenamento */
      }
      this.status(L('Report enviado. Obrigado!', 'Report sent. Thank you!'), true);
      (this.el.querySelector('#bug-text') as HTMLTextAreaElement).value = '';
      setTimeout(() => {
        if (!this.el.classList.contains('hidden')) this.close();
      }, 1500);
    } catch (err) {
      btn.disabled = false;
      this.status(
        L(
          `Não foi possível enviar (${(err as Error).message}). Verifique a internet e tente de novo.`,
          `Could not send (${(err as Error).message}). Check your connection and try again.`,
        ),
      );
    }
  }
}
