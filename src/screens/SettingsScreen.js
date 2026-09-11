// Modal de configurações em HTML/Tailwind, mostrado durante a Run quando o
// player aperta SELECT (ver GameScene.openSettingsMenu() / SETTINGS_EVENTS
// em constants.js). Mesmas opções (som, vibração, daltonismo, zoom da
// câmera) do modal de Configurações da Welcome (ver WelcomeScreen.js), só
// que sem o botão de resetar dados — destrutivo demais pra ficar acessível
// no meio de uma partida. UI fora do Phaser vive aqui (CLAUDE.md regra 1) —
// o Phaser só emite o evento, esta tela só escuta (ligada em
// main.js/BindSettingsEvents).
import settingsTemplate from './settingsScreen.html?raw';
import { gameState, updateSetting, setPlatformMode } from '../managers/GameManager.js';
import { SETTINGS_EVENTS } from '../constants.js';
import {
  isFullscreenSupported,
  isFullscreenActive,
  toggleFullscreen,
  onFullscreenChange,
  offFullscreenChange,
} from '../services/FullscreenService.js';

let elements = null;
// Cada partida cria um Phaser.Game novo (ver main.js/startMatch) — precisa
// ser um WeakSet por instância, senão o primeiro Game da sessão nunca ganha
// o listener de configurações nas partidas seguintes.
const boundGames = new WeakSet();

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// Ver comentário em main.css ("TEMAS DE BOTÕES"): o atributo fica em #app
// (não em .game-layout) porque este modal de Configurações vive fora de
// .game-layout no DOM — os dois são filhos diretos de #app.
function applyControlsTheme(theme) {
  document.getElementById('app')?.setAttribute('data-controls-theme', theme);
}

function switchSettingsTab(tab) {
  if (!elements) return;
  elements.settingsTabPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tab !== tab);
  });
  elements.settingsTabButtons.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('settings-tab-active', active);
    button.classList.toggle('border-emerald-400', active);
    button.classList.toggle('bg-emerald-500/10', active);
    button.classList.toggle('text-emerald-400', active);
    button.classList.toggle('border-white/15', !active);
    button.classList.toggle('bg-gray-900/60', !active);
    button.classList.toggle('text-gray-400', !active);
  });
}

function renderSettings() {
  if (!elements) return;
  elements.settingToggles.forEach((toggle) => {
    toggle.checked = Boolean(gameState.settings[toggle.dataset.setting]);
  });
  elements.platformModeButtons.forEach((button) => {
    const isActive = button.dataset.platform === gameState.settings.platformMode;
    button.classList.toggle('bg-emerald-500', isActive);
    button.classList.toggle('text-gray-950', isActive);
    button.classList.toggle('text-gray-300', !isActive);
  });
  // No modo Mobile o zoom é sempre 3x/fullscreen automático (ver
  // setPlatformMode em GameManager.js) — a escolha manual 1x/2x só faz
  // sentido no Game Boy.
  elements.cameraZoomRow?.classList.toggle('hidden', gameState.settings.platformMode === 'mobile');
  elements.cameraZoomButtons.forEach((button) => {
    const isActive = Number(button.dataset.zoom) === gameState.settings.cameraZoom;
    button.classList.toggle('bg-emerald-500', isActive);
    button.classList.toggle('text-gray-950', isActive);
    button.classList.toggle('text-gray-300', !isActive);
  });

  elements.controlsThemeButtons.forEach((button) => {
    const isActive = button.dataset.theme === gameState.settings.controlsTheme;
    button.classList.toggle('border-emerald-400', isActive);
    button.classList.toggle('bg-emerald-500/10', isActive);
    button.classList.toggle('border-white/15', !isActive);
    button.classList.toggle('bg-gray-900/60', !isActive);
  });
  applyControlsTheme(gameState.settings.controlsTheme);

  elements.fullscreenRow?.classList.toggle('hidden', !isFullscreenSupported());
  if (elements.fullscreenToggle) {
    elements.fullscreenToggle.checked = isFullscreenActive();
  }
}

// Não usa updateSetting/gameState.settings: fullscreen não é uma preferência
// persistível (o navegador exige gesto do usuário pra entrar, então não dá
// pra restaurar sozinho num reload) — o estado real é sempre
// document.fullscreenElement (ver FullscreenService.js).
function handleFullscreenToggle() {
  toggleFullscreen();
}

// `onClose` decide o que fazer com a Run pausada (ver main.js): retomar a
// GameScene. `onCameraZoomChange` deixa a câmera da fase em andamento
// refletir o zoom escolhido na hora, sem esperar a próxima partida.
export function ShowSettingsScreen({ onClose, onCameraZoomChange } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[SettingsScreen] #app não encontrado no DOM — modal de configurações não será exibido.');
    return;
  }

  HideSettingsScreen();

  const root = parseTemplate(settingsTemplate);
  app.append(root);

  elements = {
    root,
    closeBtn: root.querySelector('.settings-close-btn'),
    settingsTabButtons: [...root.querySelectorAll('.settings-tab-btn')],
    settingsTabPanels: [...root.querySelectorAll('.settings-tab-panel')],
    settingToggles: [...root.querySelectorAll('.setting-toggle')],
    platformModeButtons: [...root.querySelectorAll('.platform-mode-btn')],
    cameraZoomRow: root.querySelector('.camera-zoom-row'),
    cameraZoomButtons: [...root.querySelectorAll('.camera-zoom-btn')],
    controlsThemeButtons: [...root.querySelectorAll('.controls-theme-btn')],
    fullscreenRow: root.querySelector('.fullscreen-setting-row'),
    fullscreenToggle: root.querySelector('.fullscreen-toggle'),
  };

  elements.closeBtn.addEventListener('click', () => onClose?.());
  elements.root.addEventListener('click', (event) => {
    if (event.target === elements.root) onClose?.();
  });
  elements.settingsTabButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      switchSettingsTab(event.currentTarget.dataset.tab);
    });
  });
  elements.settingToggles.forEach((toggle) => {
    toggle.addEventListener('change', (event) => {
      updateSetting(event.target.dataset.setting, event.target.checked);
    });
  });
  elements.platformModeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      setPlatformMode(event.currentTarget.dataset.platform);
      renderSettings();
      onCameraZoomChange?.(gameState.settings.cameraZoom);
    });
  });
  elements.cameraZoomButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const zoom = Number(event.currentTarget.dataset.zoom);
      updateSetting('cameraZoom', zoom);
      renderSettings();
      onCameraZoomChange?.(zoom);
    });
  });
  elements.controlsThemeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      updateSetting('controlsTheme', event.currentTarget.dataset.theme);
      renderSettings();
    });
  });
  elements.fullscreenToggle?.addEventListener('change', handleFullscreenToggle);
  // O player pode sair do fullscreen sem usar o toggle (Esc, gesto do
  // navegador) — resincroniza o checkbox nesses casos.
  onFullscreenChange(renderSettings);

  renderSettings();
}

export function HideSettingsScreen() {
  if (!elements) return;
  offFullscreenChange(renderSettings);
  elements.root.remove();
  elements = null;
}

// Liga o modal de configurações ao EventEmitter global do jogo. Chame uma
// vez por Phaser.Game (main.js chama a cada startMatch, um Game novo por
// partida). Idempotente: chamar de novo com o mesmo `game` não duplica
// listeners.
export function BindSettingsEvents(game, { onClose, onCameraZoomChange } = {}) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(SETTINGS_EVENTS.OPEN, () => {
    ShowSettingsScreen({ onClose, onCameraZoomChange });
  });
}
