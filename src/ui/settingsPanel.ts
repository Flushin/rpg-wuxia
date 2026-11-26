// Painel de Configurações (botão ⚙): idioma, tamanho da interface, dicas, avisos de itens, FPS, som,
// economia de bateria (modo descanso), novidades, report de bug, créditos e trocar personagem.
// Não guarda estado próprio: cada opção grava no dono dela (audio, perf, uiScale, rewards, World via TipManager).
import { L, bindLangButtons, langButtons } from '../core/i18n';
import type { World } from '../core/world';
import { closeX } from './labels';
import { audio } from '../render/audio';
import { saveLootFilter, type Rewards } from './rewards';
import { perf } from './perf';
import { fxPrefs } from '../render/fxPrefs';
import { isNative } from '../platform';
import { restMode, REST_DELAYS } from './restMode';
import { touchDebug } from './touchDebug';
import { BugReport } from './bugReport';
import { credits } from './credits';
import { novidades, pontoNovidades, atualizarPontoNovidades } from './novidades';
import { openPrivacyPolicy, openWiki } from './privacy';
import { setUiSize, uiSize, type UiSize } from './uiScale';
import type { TipManager } from './tips';
import { byId } from './dom';

export class SettingsPanel {
  private bug: BugReport;

  constructor(
    private world: World,
    private tips: TipManager,
    private onSwitch: () => void,
    private rewards?: Rewards,
  ) {
    this.bug = new BugReport(world);
    byId('btn-settings').onclick = () => this.toggle();
    const panel = byId('settings-panel');
    panel.onclick = (e) => this.onClick(e, panel);
    panel.oninput = (e) => this.onInput(e.target as HTMLInputElement);
    panel.onchange = (e) => this.onToggle(e.target as HTMLInputElement);
  }

  private onClick(e: MouseEvent, panel: HTMLElement) {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    const ui = (e.target as HTMLElement).closest('[data-ui]') as HTMLElement | null;
    const rest = (e.target as HTMLElement).closest('[data-rest]') as HTMLElement | null;
    if (rest) {
      audio.ui('ui_click');
      restMode.setDelay(+rest.dataset.rest!);
      this.render();
      return;
    }
    if (ui) {
      audio.ui('ui_click');
      setUiSize(ui.dataset.ui as UiSize);
      this.render();
      return;
    }
    if (!t) {
      if (e.target === panel) this.toggle(false);
      return;
    }
    audio.ui('ui_click');
    switch (t.dataset.act) {
      case 'close':
        this.toggle(false);
        break;
      case 'bug':
        this.toggle(false);
        this.bug.open();
        break;
      case 'credits':
        this.toggle(false);
        credits().open();
        break;
      case 'news':
        this.toggle(false);
        novidades().open();
        break;
      case 'privacy':
        openPrivacyPolicy();
        break;
      case 'wiki':
        openWiki();
        break;
      case 'switch':
        this.toggle(false);
        this.onSwitch();
        break;
      case 'reset':
        this.tips.resetSeen();
        this.render();
        break;
    }
  }

  /** Sliders de volume: aplica enquanto arrasta e atualiza o número ao lado. */
  private onInput(el: HTMLInputElement) {
    if (el.id !== 'opt-sfx' && el.id !== 'opt-music') return;
    audio.setSettings(el.id === 'opt-sfx' ? { sfx: +el.value } : { music: +el.value });
    const out = el.nextElementSibling as HTMLElement | null;
    if (out) out.textContent = el.value;
  }

  /** Caixas de marcar. */
  private onToggle(el: HTMLInputElement) {
    switch (el.id) {
      case 'opt-loot': {
        const v = el.checked ? 'all' : 'rare';
        saveLootFilter(v);
        if (this.rewards) this.rewards.filter = v;
        break;
      }
      case 'opt-dmg':
        fxPrefs.set('damageNumbers', el.checked);
        break;
      case 'opt-shake':
        fxPrefs.set('shake', el.checked);
        break;
      case 'opt-aura':
        fxPrefs.set('aura', el.checked);
        break;
      case 'opt-vibrate':
        fxPrefs.set('vibrate', el.checked);
        break;
      case 'opt-fps':
        perf.setEnabled(el.checked);
        break;
      case 'opt-touchdbg':
        touchDebug.setEnabled(el.checked);
        break;
      case 'opt-mute':
        audio.setSettings({ muted: el.checked });
        audio.ui('ui_click');
        break;
      case 'opt-tips':
        this.tips.setEnabled(el.checked);
        break;
    }
  }

  private toggle(open?: boolean) {
    const p = byId('settings-panel');
    const show = open ?? p.classList.contains('hidden');
    if (show !== !p.classList.contains('hidden')) audio.ui(show ? 'ui_open' : 'ui_close');
    p.classList.toggle('hidden', !show);
    if (show) this.render();
  }

  private render() {
    const seen = this.world.seenTips.length;
    const seg = (attr: string, cur: string, opts: [string | number, string][]) =>
      `<div class="st-seg" style="--n:${opts.length}">${opts
        .map(([k, t]) => `<button data-${attr}="${k}" class="${String(k) === cur ? 'on' : ''}">${t}</button>`)
        .join('')}</div>`;
    const sw = (id: string, on: boolean, txt: string, hint = '') =>
      `<label class="st-row"><span class="st-txt">${txt}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="st-sw" id="${id}" ${on ? 'checked' : ''}/></label>`;
    const sld = (id: string, txt: string, v: number) =>
      `<label class="st-row st-sld"><span class="st-txt">${txt}</span><input type="range" id="${id}" min="0" max="100" step="1" value="${v}"/><output>${v}</output></label>`;
    const sec = (title: string, body: string) =>
      `<section class="st-sec"><h3>${title}</h3><div class="st-group">${body}</div></section>`;
    const act = (k: string, txt: string) => `<button data-act="${k}">${txt}</button>`;
    byId('settings-panel').innerHTML =
      `<div class="card st-card">${closeX('data-act="close"')}<h2>⚙ ${L('Configurações', 'Settings')}</h2>
      ${sec(
        L('Geral', 'General'),
        `<div class="st-row"><span class="st-txt">${L('Idioma', 'Language')}</span>${langButtons()}</div>
        <div class="st-row st-col"><span class="st-txt">${L('Tamanho da interface', 'Interface size')}</span>${seg(
          'ui',
          uiSize(),
          [
            ['auto', L('Auto', 'Auto')],
            ['p', L('Pequena', 'Small')],
            ['m', L('Normal', 'Normal')],
            ['g', L('Grande', 'Large')],
          ],
        )}</div>
        <div class="st-row st-col"><span class="st-txt">${L('Economia de bateria no Auto', 'Battery saver on Auto')}<small>${L('Tela de descanso após ficar sem tocar', 'Rest screen after no touch')}</small></span>${seg(
          'rest',
          String(restMode.delay),
          REST_DELAYS.map((s) => [s, s === 0 ? L('Desligado', 'Off') : s < 60 ? `${s} s` : `${s / 60} min`]),
        )}</div>`,
      )}
      ${sec(
        L('Som', 'Sound'),
        sw('opt-mute', audio.settings.muted, L('Mudo', 'Mute')) +
          sld('opt-sfx', L('Efeitos', 'Effects'), audio.settings.sfx) +
          sld('opt-music', L('Música', 'Music'), audio.settings.music),
      )}
      ${sec(
        L('Tela e efeitos', 'Display and effects'),
        sw('opt-dmg', fxPrefs.damageNumbers, L('Números de dano', 'Damage numbers')) +
          sw('opt-shake', fxPrefs.shake, L('Tremor de tela', 'Screen shake')) +
          sw(
            'opt-aura',
            fxPrefs.aura,
            L('Aura elemental', 'Elemental aura'),
            L('Em volta do personagem', 'Around your character'),
          ) +
          (isNative
            ? sw(
                'opt-vibrate',
                fxPrefs.vibrate,
                L('Vibração', 'Vibration'),
                L('Crítico, golpe do chefe, subir de nível', 'Crit, boss strike, level up'),
              )
            : '') +
          sw(
            'opt-loot',
            this.rewards?.filter === 'all',
            L('Avisar todos os itens', 'Show all items'),
            L('Padrão: só Incomum e Raro', 'Default: Uncommon and Rare only'),
          ),
      )}
      ${sec(
        L('Dicas', 'Tips'),
        sw('opt-tips', this.world.tipsEnabled, L('Mostrar dicas', 'Show tips')) +
          `<div class="st-row"><span class="st-txt">${L('Rever dicas', 'Review tips')}<small>${seen ? L(`${seen} dica(s) já vista(s)`, `${seen} tip(s) seen`) : L('Nenhuma dica vista ainda', 'No tips seen yet')}</small></span><button class="st-small" data-act="reset">${L('Rever', 'Review')}</button></div>`,
      )}
      ${sec(
        L('Diagnóstico', 'Diagnostics'),
        sw('opt-fps', perf.enabled, L('Mostrar FPS', 'Show FPS')) +
          sw(
            'opt-touchdbg',
            touchDebug.enabled,
            L('Diagnóstico de toque', 'Touch diagnostics'),
            L('Mostra cada toque e o que a skill fez', 'Shows each touch and what the skill did'),
          ),
      )}
      <div class="st-grid">
        ${act('news', `📜 ${L('Novidades', "What's new")}${pontoNovidades()}`)}
        ${act('wiki', `📖 ${L('Wiki', 'Wiki')} <small class="muted">(PT)</small>`)}
        ${act('bug', `🐞 ${L('Reportar bug', 'Report a bug')}`)}
        ${act('credits', `📄 ${L('Créditos', 'Credits')}`)}
        ${act('privacy', `🔒 ${L('Privacidade', 'Privacy')}`)}
        ${act('switch', `👤 ${L('Trocar personagem', 'Switch character')}`)}
      </div>
      <button class="primary" data-act="close">${L('Fechar', 'Close')}</button></div>`;
    bindLangButtons(byId('settings-panel'));
    atualizarPontoNovidades();
  }
}
