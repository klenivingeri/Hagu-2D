// Tela de Welcome (home) em HTML/Tailwind, exibida antes do Phaser existir
// (CLAUDE.md / GUIDELINES.md: UI fora do Phaser vive aqui). Mostra nome do
// player, nível/XP e recursos globais lendo direto de GameManager — não
// precisa da ponte de eventos do game.events porque roda sem nenhuma cena
// do Phaser ativa. O botão "Jogar" delega pra quem chamou ShowWelcomeScreen
// decidir quando instanciar o Phaser.Game (ver main.js).
import welcomeTemplate from './welcomeScreen.html?raw';
import { gameState, getLevelInfo, updateSetting } from '../managers/GameManager.js';

let elements = null;
let idleAnimationTimer = null;

// Mesmos frames/frameRate do idle do player dentro do Phaser (ver
// PLAYERS_CONFIG.animations em /src/game/config/entities.js), só que
// tocados como <img> comum já que aqui fora não tem nenhuma cena do Phaser.
const IDLE_SPRITE_FRAMES = [0, 1, 2, 3].map(
  (frame) => `/assets/player/idle/sprite_base_idle_${frame}.png`
);
const IDLE_SPRITE_FRAME_RATE = 4;

function startIdleAnimation() {
  if (!elements) return;
  let frameIndex = 0;
  idleAnimationTimer = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % IDLE_SPRITE_FRAMES.length;
    elements.playerSprite.src = IDLE_SPRITE_FRAMES[frameIndex];
  }, 1000 / IDLE_SPRITE_FRAME_RATE);
}

function stopIdleAnimation() {
  window.clearInterval(idleAnimationTimer);
  idleAnimationTimer = null;
}

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return [...template.content.children];
}

function renderPlayerInfo() {
  if (!elements) return;
  const { level, percent } = getLevelInfo();
  elements.playerName.textContent = gameState.playerName;
  elements.playerLevel.textContent = `Lvl ${level}`;
  elements.expFill.style.width = `${percent}%`;
  elements.diamondTotal.textContent = String(gameState.diamant);
  elements.coinTotal.textContent = String(gameState.coins);
}

function renderSettings() {
  if (!elements) return;
  elements.settingToggles.forEach((toggle) => {
    toggle.checked = Boolean(gameState.settings[toggle.dataset.setting]);
  });
}

function openSettings() {
  elements?.settingsModal.classList.remove('hidden');
  elements?.settingsModal.classList.add('flex');
}

function closeSettings() {
  elements?.settingsModal.classList.add('hidden');
  elements?.settingsModal.classList.remove('flex');
}

function handleSettingChange(event) {
  const { setting } = event.target.dataset;
  updateSetting(setting, event.target.checked);
}

// Loja/Coleção ainda não têm tela própria (ver IMPLEMENTATION_PLAN.md) —
// por enquanto só trocam qual <section> fica visível dentro do shell da
// Welcome. Quando cada uma virar uma tela de verdade, isso vira navegação
// real entre módulos de /src/screens/.
function switchView(view) {
  if (!elements) return;
  elements.views.forEach((section) => {
    section.classList.toggle('hidden', section.dataset.view !== view);
  });
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('tab-active', active);
    button.classList.toggle('text-emerald-400', active);
    button.classList.toggle('text-gray-400', !active);
  });
}

export function ShowWelcomeScreen({ onPlay } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[WelcomeScreen] #app não encontrado no DOM — tela de welcome não será exibida.');
    return;
  }

  HideWelcomeScreen();

  const [screenRoot, modalRoot] = parseTemplate(welcomeTemplate);
  app.append(screenRoot, modalRoot);

  elements = {
    screenRoot,
    modalRoot,
    playerSprite: screenRoot.querySelector('.player-idle-sprite'),
    playerName: screenRoot.querySelector('.player-name'),
    playerLevel: screenRoot.querySelector('.player-level'),
    expFill: screenRoot.querySelector('.exp-bar-fill'),
    diamondTotal: screenRoot.querySelector('.diamond-total'),
    coinTotal: screenRoot.querySelector('.coin-total'),
    gearBtn: screenRoot.querySelector('.settings-gear-btn'),
    playBtn: screenRoot.querySelector('.play-btn'),
    settingsModal: modalRoot,
    closeBtn: modalRoot.querySelector('.settings-close-btn'),
    settingToggles: [...modalRoot.querySelectorAll('.setting-toggle')],
    views: [...screenRoot.querySelectorAll('.welcome-view')],
    tabButtons: [...screenRoot.querySelectorAll('.tab-btn')],
  };

  elements.gearBtn.addEventListener('click', openSettings);
  elements.closeBtn.addEventListener('click', closeSettings);
  elements.settingsModal.addEventListener('click', (event) => {
    if (event.target === elements.settingsModal) closeSettings();
  });
  elements.settingToggles.forEach((toggle) => {
    toggle.addEventListener('change', handleSettingChange);
  });
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.playBtn.addEventListener('click', () => onPlay?.());

  renderPlayerInfo();
  renderSettings();
  startIdleAnimation();
}

export function HideWelcomeScreen() {
  if (!elements) return;
  stopIdleAnimation();
  elements.screenRoot.remove();
  elements.modalRoot.remove();
  elements = null;
}
