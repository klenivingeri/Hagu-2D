// Tela de Welcome (home) em HTML/Tailwind, exibida antes do Phaser existir
// (CLAUDE.md / GUIDELINES.md: UI fora do Phaser vive aqui). Mostra nome do
// player, nível/XP e recursos globais lendo direto de GameManager — não
// precisa da ponte de eventos do game.events porque roda sem nenhuma cena
// do Phaser ativa. O botão "Jogar" delega pra quem chamou ShowWelcomeScreen
// decidir quando instanciar o Phaser.Game (ver main.js).
import welcomeTemplate from './welcomeScreen.html?raw';
import { gameState, getLevelInfo, updateSetting, isMapUnlocked, resetProgress } from '../managers/GameManager.js';
import { MAP_GRID, DEFAULT_MAP_KEY } from '../game/config/maps.js';
import { getStageLabel } from './mapLabels.js';

let elements = null;
let idleAnimationTimer = null;
let selectedMapKey = DEFAULT_MAP_KEY;
let hasCenteredStageGrid = false;
let stageZoom = 1;

const STAGE_ZOOM_MIN = 0.5;
const STAGE_ZOOM_MAX = 1.8;
const STAGE_ZOOM_DEFAULT = 1;

function clampZoom(zoom) {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, zoom));
}

// Zoom é só um transform visual (não muda o tamanho de layout do grid) — o
// scroll continua funcionando porque o navegador considera a caixa
// transformada pra calcular a área rolável do container com overflow.
function applyStageZoom() {
  if (!elements) return;
  elements.stageGrid.style.transform = `scale(${stageZoom})`;
  elements.zoomLevel.textContent = `${Math.round(stageZoom * 100)}%`;
}

// Achata MAP_GRID (ver game/config/maps.js) em [{ mapKey, row, col }], só com
// as células preenchidas — a posição row/col é o que faz a UI desenhar a
// mesma "cruz" (hub no centro, ramos de gelo/fogo/floresta/deserto) que o
// grid de verdade usado pelo GameScene pra decidir vizinhos.
function getStageCells() {
  const cells = [];
  MAP_GRID.forEach((rowMaps, row) => {
    rowMaps.forEach((mapKey, col) => {
      if (mapKey) cells.push({ mapKey, row, col });
    });
  });
  return cells;
}

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

const STAGE_CELL_PX = 76; // tamanho de cada célula do grid, em px (ver grid-template no renderStages)

function renderStages() {
  if (!elements) return;
  // Só mostra mapas já desbloqueados (ver GameManager.isMapUnlocked): o
  // grid nasce só com o map_0 e vai ganhando célula conforme o player passa
  // pelas gates dentro do jogo (createGates.js).
  const cells = getStageCells().filter((cell) => isMapUnlocked(cell.mapKey));
  const stageKeys = cells.map((cell) => cell.mapKey);
  if (!stageKeys.includes(selectedMapKey)) {
    selectedMapKey = stageKeys[0] || DEFAULT_MAP_KEY;
  }

  const rows = MAP_GRID.length;
  const cols = Math.max(...MAP_GRID.map((row) => row.length));
  elements.stageGrid.style.gridTemplateRows = `repeat(${rows}, ${STAGE_CELL_PX}px)`;
  elements.stageGrid.style.gridTemplateColumns = `repeat(${cols}, ${STAGE_CELL_PX}px)`;

  elements.stageGrid.innerHTML = '';
  let selectedCell = null;
  cells.forEach(({ mapKey, row, col }) => {
    const isSelected = mapKey === selectedMapKey;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.dataset.mapKey = mapKey;
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    cell.className = [
      'stage-cell flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold text-white transition-colors',
      isSelected ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/15 bg-gray-900/60',
    ].join(' ');
    cell.innerHTML = `
      <span class="text-2xl leading-none">🗺️</span>
      <span class="px-1 text-center leading-tight">${getStageLabel(mapKey)}</span>
    `;
    cell.addEventListener('click', () => {
      selectedMapKey = mapKey;
      renderStages();
    });
    elements.stageGrid.append(cell);
    if (isSelected) selectedCell = cell;
  });

  // Só centraliza no mapa selecionado na primeira renderização (troca de
  // seleção depois disso não deve "puxar" o scroll debaixo do dedo do
  // player).
  if (!hasCenteredStageGrid) {
    selectedCell?.scrollIntoView({ block: 'center', inline: 'center' });
    hasCenteredStageGrid = true;
  }
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Arrastar com 1 ponteiro (mouse, trackpad ou dedo) pan-eia o grid inteiro
// (vertical + horizontal, já que o grid é uma cruz: gelo/fogo ficam
// acima/abaixo do hub, floresta/deserto aos lados). Com 2 dedos na tela vira
// pinch-to-zoom. Desktop ganha zoom com ctrl+wheel (gesto de pinça de
// trackpad chega como wheel com ctrlKey=true no Chrome/Firefox).
function setupGridInteractions(viewport) {
  const pointers = new Map();
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  function startDrag(point) {
    isDragging = true;
    startX = point.x;
    startY = point.y;
    startScrollLeft = viewport.scrollLeft;
    startScrollTop = viewport.scrollTop;
  }

  viewport.addEventListener('pointerdown', (event) => {
    // Sem isso, nenhum <button> dentro do viewport (célula do grid, botão
    // de reset de zoom) dispararia "click": o pointerdown vazaria pro
    // drag/pinch e capturaria o ponteiro antes do clique se completar —
    // era por isso que trocar de fase selecionada no grid não tinha efeito
    // nenhum (a seleção nunca mudava, então "Jogar" sempre reabria a fase
    // antiga).
    if (event.target.closest('button')) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.setPointerCapture(event.pointerId);

    if (pointers.size === 2) {
      isDragging = false;
      const [a, b] = pointers.values();
      pinchStartDistance = pointerDistance(a, b);
      pinchStartZoom = stageZoom;
    } else if (pointers.size === 1) {
      startDrag({ x: event.clientX, y: event.clientY });
    }
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      const distance = pointerDistance(a, b);
      if (pinchStartDistance > 0) {
        stageZoom = clampZoom(pinchStartZoom * (distance / pinchStartDistance));
        applyStageZoom();
      }
      return;
    }

    if (isDragging) {
      viewport.scrollLeft = startScrollLeft - (event.clientX - startX);
      viewport.scrollTop = startScrollTop - (event.clientY - startY);
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const [remaining] = pointers.values();
      startDrag(remaining);
    } else {
      isDragging = false;
    }
  }
  viewport.addEventListener('pointerup', releasePointer);
  viewport.addEventListener('pointercancel', releasePointer);
  viewport.addEventListener('pointerleave', releasePointer);

  viewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return; // wheel normal continua fazendo scroll nativo
    event.preventDefault();
    stageZoom = clampZoom(stageZoom - event.deltaY * 0.003);
    applyStageZoom();
  }, { passive: false });
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

// Destrutivo e sem undo — por isso o confirm nativo antes de mexer em
// qualquer coisa (StorageService.clearAll() + reset do gameState em
// memória, ver GameManager.resetProgress()).
function handleResetStorage() {
  const confirmed = window.confirm(
    'Isso vai apagar moedas, diamantes, fases liberadas e configurações salvas. Essa ação não pode ser desfeita. Continuar?'
  );
  if (!confirmed) return;

  resetProgress();
  selectedMapKey = DEFAULT_MAP_KEY;
  hasCenteredStageGrid = false;
  stageZoom = STAGE_ZOOM_DEFAULT;
  renderPlayerInfo();
  renderSettings();
  renderStages();
  applyStageZoom();
  closeSettings();
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
    stageGridViewport: screenRoot.querySelector('.stage-grid-viewport'),
    stageGrid: screenRoot.querySelector('.stage-grid'),
    zoomResetBtn: screenRoot.querySelector('.zoom-reset-btn'),
    zoomLevel: screenRoot.querySelector('.zoom-level'),
    playBtn: screenRoot.querySelector('.play-btn'),
    settingsModal: modalRoot,
    closeBtn: modalRoot.querySelector('.settings-close-btn'),
    resetStorageBtn: modalRoot.querySelector('.reset-storage-btn'),
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
  elements.resetStorageBtn.addEventListener('click', handleResetStorage);
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.playBtn.addEventListener('click', () => onPlay?.(selectedMapKey));
  elements.zoomResetBtn.addEventListener('click', () => {
    stageZoom = STAGE_ZOOM_DEFAULT;
    applyStageZoom();
  });
  setupGridInteractions(elements.stageGridViewport);

  renderPlayerInfo();
  renderSettings();
  renderStages();
  applyStageZoom();
  startIdleAnimation();
}

export function HideWelcomeScreen() {
  if (!elements) return;
  stopIdleAnimation();
  elements.screenRoot.remove();
  elements.modalRoot.remove();
  elements = null;
  hasCenteredStageGrid = false;
  stageZoom = STAGE_ZOOM_DEFAULT;
}
