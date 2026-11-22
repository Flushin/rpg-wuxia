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
import { hudLayout, setHudLayout, type HudLayout } from './hudLayout';
import { isTouch } from '../platform/input';

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
    const hl = (e.target as HTMLElement).closest('[data-hud]') as HTMLElement | null;
    const rest = (e.target as HTMLElement).closest('[data-rest]') as HTMLElement | null;
    if (rest) {
      audio.ui('ui_click');
      restMode.setDelay(+rest.dataset.rest!);
      this.render();
      return;
    }
    if (hl) {
      audio.ui('ui_click');
      setHudLayout(hl.dataset.hud as HudLayout);
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
    byId('settings-panel').innerHTML =
      `<div class="card">${closeX('data-act="close"')}<h2>${L('Configurações', 'Settings')}</h2>
      <div class="opt"><span>${L('Idioma', 'Language')}</span>${langButtons()}</div>
      <div class="opt ui-size-row"><span>${L('Tamanho da interface', 'Interface size')}</span><div class="ui-size">${(
        [
          ['auto', L('Automático', 'Auto')],
          ['p', L('Pequena', 'Small')],
          ['m', L('Normal', 'Normal')],
          ['g', L('Grande', 'Large')],
        ] as [UiSize, string][]
      )
        .map(([k, t]) => `<button data-ui="${k}" class="${uiSize() === k ? 'primary' : ''}">${t}</button>`)
        .join('')}</div></div>${
        isTouch
          ? `<div class="opt ui-size-row"><span>${L('Layout do HUD no celular', 'Mobile HUD layout')}</span><div class="ui-size hud-layout">${(
              [
                ['novo', L('Novo', 'New')],
                ['classico', L('Clássico', 'Classic')],
              ] as [HudLayout, string][]
            )
              .map(([k, t]) => `<button data-hud="${k}" class="${hudLayout() === k ? 'primary' : ''}">${t}</button>`)
              .join('')}</div></div>`
          : ''
      }
      <div class="opt ui-size-row"><span>${L('Economia de bateria no Auto (tela de descanso após ficar sem tocar)', 'Battery saver while on Auto (rest screen after no touch)')}</span><div class="ui-size">${REST_DELAYS.map(
        (s) =>
          `<button data-rest="${s}" class="${restMode.delay === s ? 'primary' : ''}">${s === 0 ? L('Desligado', 'Off') : s < 60 ? `${s} s` : `${s / 60} min`}</button>`,
      ).join('')}</div></div>
      <label class="opt"><input type="checkbox" id="opt-tips" ${this.world.tipsEnabled ? 'checked' : ''}/> ${L('Mostrar dicas', 'Show tips')}</label>
      <label class="opt"><input type="checkbox" id="opt-loot" ${this.rewards?.filter === 'all' ? 'checked' : ''}/> ${L('Avisar todos os itens coletados (padrão: só Incomum e Raro)', 'Show all picked-up items (default: Uncommon and Rare only)')}</label>
      <label class="opt"><input type="checkbox" id="opt-dmg" ${fxPrefs.damageNumbers ? 'checked' : ''}/> ${L('Números de dano', 'Damage numbers')}</label>
      <label class="opt"><input type="checkbox" id="opt-shake" ${fxPrefs.shake ? 'checked' : ''}/> ${L('Tremor de tela', 'Screen shake')}</label>
      <label class="opt"><input type="checkbox" id="opt-aura" ${fxPrefs.aura ? 'checked' : ''}/> ${L('Aura elemental em volta do personagem', 'Elemental aura around your character')}</label>
      ${isNative ? `<label class="opt"><input type="checkbox" id="opt-vibrate" ${fxPrefs.vibrate ? 'checked' : ''}/> ${L('Vibração (crítico, golpe do chefe, subir de nível)', 'Vibration (crit, boss strike, level up)')}</label>` : ''}
      <label class="opt"><input type="checkbox" id="opt-fps" ${perf.enabled ? 'checked' : ''}/> ${L('Mostrar FPS (desempenho)', 'Show FPS (performance)')}</label>
      <label class="opt"><input type="checkbox" id="opt-touchdbg" ${touchDebug.enabled ? 'checked' : ''}/> ${L('Diagnóstico de toque (mostra na tela cada toque e o que a skill fez)', 'Touch diagnostics (shows each touch and what the skill did)')}</label>
      <label class="opt"><input type="checkbox" id="opt-mute" ${audio.settings.muted ? 'checked' : ''}/> ${L('Mudo', 'Mute')}</label>
      <label class="sld">${L('Efeitos', 'Effects')}<input type="range" id="opt-sfx" min="0" max="100" step="1" value="${audio.settings.sfx}"/><output>${audio.settings.sfx}</output></label>
      <label class="sld">${L('Música', 'Music')}<input type="range" id="opt-music" min="0" max="100" step="1" value="${audio.settings.music}"/><output>${audio.settings.music}</output></label>
      <button data-act="reset">${L('Rever dicas', 'Review tips')}</button>
      <small class="muted">${seen ? L(`${seen} dica(s) já vista(s)`, `${seen} tip(s) seen`) : L('Nenhuma dica vista ainda', 'No tips seen yet')}</small>
      <button data-act="news">📜 ${L('Novidades', "What's new")}${pontoNovidades()}</button>
      <button data-act="wiki">📖 ${L('Wiki do jogo', 'Game wiki')} <small class="muted">(${L('em português', 'in Portuguese')})</small></button>
      <button data-act="bug">🐞 ${L('Reportar bug', 'Report a bug')}</button>
      <button data-act="credits">${L('Créditos e licenças', 'Credits and licenses')}</button>
      <button data-act="privacy">${L('Política de privacidade', 'Privacy policy')}</button>
      <button data-act="switch">${L('Trocar personagem', 'Switch character')}</button>
      <button class="primary" data-act="close">${L('Fechar', 'Close')}</button></div>`;
    bindLangButtons(byId('settings-panel'));
    atualizarPontoNovidades();
  }
}
