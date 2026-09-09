// Tela de Welcome (home) em HTML/Tailwind, exibida antes do Phaser existir
// (CLAUDE.md / GUIDELINES.md: UI fora do Phaser vive aqui). Mostra nome do
// player, nível/XP e recursos globais lendo direto de GameManager — não
// precisa da ponte de eventos do game.events porque roda sem nenhuma cena
// do Phaser ativa. O botão "Jogar" delega pra quem chamou ShowWelcomeScreen
// decidir quando instanciar o Phaser.Game (ver main.js).
import welcomeTemplate from './welcomeScreen.html?raw';
import {
  gameState,
  getLevelInfo,
  updateSetting,
  isMapUnlocked,
  resetProgress,
  getUpgradeState,
  purchaseUpgrade,
} from '../managers/GameManager.js';
import { UPGRADES_CATALOG } from '../game/config/upgrades.js';
import { MAP_GRID, DEFAULT_MAP_KEY } from '../game/config/maps.js';
import { getStageLabel, getStageNumber } from './mapLabels.js';
import { showMapPreview, updateMapPreview, destroyMapPreview } from './mapPreview.js';

let elements = null;
let idleAnimationTimer = null;
let selectedMapKey = DEFAULT_MAP_KEY;
let hasCenteredStageGrid = false;
let stageZoom = 1;
// Baseline pra detectar fases que acabaram de ser desbloqueadas (ver
// renderStages). Começa null: a primeira renderização da sessão só define a
// baseline, nunca anima — só a partir da segunda é que uma key nova nesse
// conjunto significa "acabou de desbloquear" (voltou da Run que liberou
// uma gate/portal).
let knownUnlockedMapKeys = null;

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

// Mesmos frames/frameRate do run do player dentro do Phaser (ver
// PLAYERS_CONFIG.animations em /src/game/config/entities.js) — tocado como
// <img> comum enquanto o "boneco" do grid corre de uma fase pra outra.
const RUN_SPRITE_FRAMES = [0, 1, 2, 3].map(
  (frame) => `/assets/player/run/sprite_run_two_${frame}.png`
);
const RUN_SPRITE_FRAME_RATE = 10;
const RUNNER_MOVE_MS = 500; // precisa bater com a duration da transition no CSS

let runnerEl = null;
let runnerFrameTimer = null;
let runnerRow = 0;
let runnerCol = 0;
let runnerMoving = false;

function findMapGridPosition(mapKey) {
  for (let row = 0; row < MAP_GRID.length; row += 1) {
    const col = MAP_GRID[row].indexOf(mapKey);
    if (col !== -1) return { row, col };
  }
  return { row: 0, col: 0 };
}

function createRunnerElement() {
  const img = document.createElement('img');
  img.className = 'stage-runner-sprite pointer-events-none absolute z-20 h-10 w-auto [image-rendering:pixelated]';
  img.style.transitionProperty = 'left, top';
  img.style.transitionDuration = `${RUNNER_MOVE_MS}ms`;
  img.style.transitionTimingFunction = 'linear';
  img.src = IDLE_SPRITE_FRAMES[0];
  return img;
}

function startRunnerFrames(frames, frameRate) {
  if (!runnerEl) return;
  window.clearInterval(runnerFrameTimer);
  let frameIndex = 0;
  runnerEl.src = frames[0];
  runnerFrameTimer = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    runnerEl.src = frames[frameIndex];
  }, 1000 / frameRate);
}

// Posiciona o runner no centro da célula (row, col), passando por cima do
// número/estrelas — é o mesmo ponto usado pelas trilhas de conexão (ver
// getStageCellCenter), então o boneco corre exatamente em cima da trilha.
// `animate = false` corta a transition pra teleportar sem correr (mount
// inicial e reset de storage).
function setRunnerCell(row, col, animate) {
  if (!runnerEl) return;
  const { x, y } = getStageCellCenter(row, col);
  const facingLeft = col < runnerCol;
  const facingRight = col > runnerCol;
  if (facingLeft) runnerEl.dataset.facing = 'left';
  else if (facingRight) runnerEl.dataset.facing = 'right';
  const flip = runnerEl.dataset.facing === 'left' ? -1 : 1;

  if (!animate) runnerEl.style.transitionDuration = '0ms';
  runnerEl.style.left = `${x}px`;
  runnerEl.style.top = `${y-14}px`;
  runnerEl.style.transform = `translate(-50%, -50%) scaleX(${flip})`;
  if (!animate) {
    void runnerEl.offsetWidth; // força reflow antes de religar a transition
    runnerEl.style.transitionDuration = `${RUNNER_MOVE_MS}ms`;
  }
}

// Mapa "row,col" -> mapKey só das fases desbloqueadas — o mesmo conjunto de
// nós que renderStageConnections usa pra desenhar as trilhas tracejadas, e é
// por essas trilhas que o boneco deve correr (nunca cortando célula bloqueada
// ou "no vazio" fora do grid).
function buildStageGraph(cells) {
  const grid = new Map();
  cells.forEach(({ mapKey, row, col }) => grid.set(`${row},${col}`, mapKey));
  return grid;
}

const STAGE_PATH_DELTAS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

// BFS sobre o grafo de fases desbloqueadas — acha o caminho mais curto de
// `from` até `to` andando só por células vizinhas (ortogonais) que existem
// no grid. Sem caminho conectado (não deveria acontecer, já que o grid é
// sempre uma cruz contínua), cai pra um "salto" direto.
function findStagePath(grid, from, to) {
  const key = ({ row, col }) => `${row},${col}`;
  const startKey = key(from);
  const targetKey = key(to);
  if (startKey === targetKey) return [from];
  if (!grid.has(startKey) || !grid.has(targetKey)) return [from, to];

  const visited = new Set([startKey]);
  const queue = [[from]];
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (key(current) === targetKey) return path;

    for (const [dRow, dCol] of STAGE_PATH_DELTAS) {
      const next = { row: current.row + dRow, col: current.col + dCol };
      const nextKey = key(next);
      if (visited.has(nextKey) || !grid.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push([...path, next]);
    }
  }
  return [from, to];
}

// Faz o boneco "correr" (troca de sprite + desliza) por cada célula do
// `path` (ver findStagePath), uma de cada vez, e só chama onArrive depois
// que a última corrida termina — simula o deslocamento pelas trilhas do
// grid até a fase escolhida, em vez de pular direto pra ela.
function moveRunnerAlongPath(path, onArrive) {
  if (!runnerEl || path.length <= 1) {
    onArrive();
    return;
  }

  runnerMoving = true;
  startRunnerFrames(RUN_SPRITE_FRAMES, RUN_SPRITE_FRAME_RATE);

  let stepIndex = 1;
  const runStep = () => {
    const { row, col } = path[stepIndex];
    setRunnerCell(row, col, true);

    const handleStepArrive = () => {
      runnerEl.removeEventListener('transitionend', handleStepArrive);
      runnerRow = row;
      runnerCol = col;
      stepIndex += 1;
      if (stepIndex < path.length) {
        runStep();
        return;
      }
      runnerMoving = false;
      startRunnerFrames(IDLE_SPRITE_FRAMES, IDLE_SPRITE_FRAME_RATE);
      onArrive();
    };
    runnerEl.addEventListener('transitionend', handleStepArrive, { once: true });
  };
  runStep();
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
// Espaçamento generoso entre células (era só 8px de gap-2) pra dar a sensação
// de "trilha" entre fases distantes, com espaço pra linha de conexão.
const STAGE_GAP_PX = 40;
// Precisa bater com o padding real do container (classe "p-8" no
// welcomeScreen.html) — usado pra alinhar as linhas de conexão em cima das
// células de verdade.
const STAGE_GRID_PADDING_PX = 32;

function getStageCellCenter(row, col) {
  const step = STAGE_CELL_PX + STAGE_GAP_PX;
  return {
    x: STAGE_GRID_PADDING_PX + col * step + STAGE_CELL_PX / 2,
    y: STAGE_GRID_PADDING_PX + row * step + STAGE_CELL_PX / 2,
  };
}

// Desenha uma linha entre cada par de células ADJACENTES no MAP_GRID que
// estejam as duas desbloqueadas (fases ainda bloqueadas não aparecem, então
// não fica trilha "no vazio" apontando pra célula que nem existe na tela).
function renderStageConnections(cells) {
  const unlockedKeys = new Set(cells.map((cell) => cell.mapKey));
  const rows = MAP_GRID.length;
  const cols = Math.max(...MAP_GRID.map((row) => row.length));
  const step = STAGE_CELL_PX + STAGE_GAP_PX;
  const width = STAGE_GRID_PADDING_PX * 2 + cols * STAGE_CELL_PX + (cols - 1) * STAGE_GAP_PX;
  const height = STAGE_GRID_PADDING_PX * 2 + rows * STAGE_CELL_PX + (rows - 1) * STAGE_GAP_PX;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'stage-connections pointer-events-none absolute left-0 top-0');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  cells.forEach(({ mapKey, row, col }) => {
    const rightKey = MAP_GRID[row]?.[col + 1];
    const downKey = MAP_GRID[row + 1]?.[col];
    const from = getStageCellCenter(row, col);

    if (rightKey && unlockedKeys.has(rightKey)) {
      drawStageConnectionLine(svg, from, getStageCellCenter(row, col + 1));
    }
    if (downKey && unlockedKeys.has(downKey)) {
      drawStageConnectionLine(svg, from, getStageCellCenter(row + 1, col));
    }
  });

  return svg;
}

function drawStageConnectionLine(svg, from, to) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(svgNS, 'line');
  line.setAttribute('class', 'stage-connection-line');
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  svg.append(line);
}

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

  // Compara com a última leva conhecida pra saber quais células acabaram de
  // ser desbloqueadas (ver knownUnlockedMapKeys). null = primeira
  // renderização da sessão: só define a baseline, sem animar nada.
  const newlyUnlockedKeys = knownUnlockedMapKeys
    ? stageKeys.filter((mapKey) => !knownUnlockedMapKeys.has(mapKey))
    : [];
  knownUnlockedMapKeys = new Set(stageKeys);

  const rows = MAP_GRID.length;
  const cols = Math.max(...MAP_GRID.map((row) => row.length));
  elements.stageGrid.style.gridTemplateRows = `repeat(${rows}, ${STAGE_CELL_PX}px)`;
  elements.stageGrid.style.gridTemplateColumns = `repeat(${cols}, ${STAGE_CELL_PX}px)`;
  elements.stageGrid.style.gap = `${STAGE_GAP_PX}px`;

  elements.stageGrid.innerHTML = '';
  elements.stageGrid.append(renderStageConnections(cells));

  let selectedCell = null;
  cells.forEach(({ mapKey, row, col }) => {
    const isSelected = mapKey === selectedMapKey;
    const isNewlyUnlocked = newlyUnlockedKeys.includes(mapKey);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.dataset.mapKey = mapKey;
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    cell.className = [
      'stage-cell relative z-10 flex flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold text-white transition-colors',
      isSelected ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/15 bg-gray-900/60',
      isNewlyUnlocked ? 'stage-cell-unlock' : '',
    ].join(' ');
    cell.innerHTML = `
      <span class="stage-cell-number text-lg font-black leading-none">${getStageNumber(mapKey)}</span>
      <span class="stage-cell-stars flex gap-0.5 text-[10px] leading-none text-gray-400" aria-hidden="true">☆☆☆</span>
      <span class="stage-cell-label absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-gray-300">${getStageLabel(mapKey)}</span>
    `;
    if (isNewlyUnlocked) {
      cell.addEventListener('animationend', () => cell.classList.remove('stage-cell-unlock'), { once: true });
    }
    cell.addEventListener('click', () => {
      if (mapKey === selectedMapKey || runnerMoving) return;
      const path = findStagePath(buildStageGraph(cells), { row: runnerRow, col: runnerCol }, { row, col });
      moveRunnerAlongPath(path, () => {
        selectedMapKey = mapKey;
        renderStages();
        updateMapPreview(mapKey, elements.stagePreviewViewport);
      });
    });
    elements.stageGrid.append(cell);
    if (isSelected) selectedCell = cell;
  });

  // innerHTML = '' acima já removeu o runner da árvore — reanexa e
  // reposiciona sem transition (o teleporte só "corre" via moveRunnerAlongPath,
  // disparado pelo clique, nunca por um re-render).
  if (runnerEl) {
    elements.stageGrid.append(runnerEl);
    setRunnerCell(runnerRow, runnerCol, false);
  }

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

// Barrinha de "pips" (um quadradinho por nível) usada nos upgrades da loja
// que têm mais de 1 nível — os upgrades booleanos (pulo duplo, jetpack) não
// chamam esta função, eles só mostram um badge de bloqueado/comprado.
function renderUpgradePips(maxLevel, level) {
  return Array.from({ length: maxLevel }, (_, index) => {
    const filled = index < level;
    return `<span class="h-2 flex-1 rounded-sm ${filled ? 'bg-emerald-400' : 'bg-gray-700'}"></span>`;
  }).join('');
}

function renderShop() {
  if (!elements) return;

  elements.shopList.innerHTML = '';

  UPGRADES_CATALOG.forEach((def) => {
    const state = getUpgradeState(def.id);
    const canAfford = !state.isMaxed && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const row = document.createElement('div');
    row.className = 'shop-item flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900/60 px-3 py-2';

    const statusLine = def.boolean
      ? (state.isMaxed ? 'Comprado' : 'Bloqueado')
      : `Nível ${state.level}/${def.maxLevel} · ${state.value}${def.unit ? ` ${def.unit}` : ''}`;

    const bar = def.boolean
      ? ''
      : `<div class="shop-item-pips mt-1.5 flex gap-0.5">${renderUpgradePips(def.maxLevel, state.level)}</div>`;

    const buttonLabel = state.isMaxed ? 'Máximo' : `${state.cost} ${currencyIcon}`;

    row.innerHTML = `
      <span class="text-xl leading-none shrink-0">${def.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}</p>
        ${bar}
      </div>
      <button
        type="button"
        data-upgrade-id="${def.id}"
        class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          state.isMaxed
            ? 'cursor-not-allowed bg-gray-800 text-gray-500'
            : canAfford
              ? 'bg-emerald-500 text-gray-950'
              : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }"
        ${state.isMaxed || !canAfford ? 'disabled' : ''}
      >${buttonLabel}</button>
    `;

    elements.shopList.append(row);
  });
}

function handleShopBuyClick(event) {
  const button = event.target.closest('.shop-buy-btn');
  if (!button || button.disabled) return;

  const bought = purchaseUpgrade(button.dataset.upgradeId);
  if (!bought) return;

  renderPlayerInfo();
  renderShop();
}

function renderSettings() {
  if (!elements) return;
  elements.settingToggles.forEach((toggle) => {
    toggle.checked = Boolean(gameState.settings[toggle.dataset.setting]);
  });
  elements.cameraZoomButtons.forEach((button) => {
    const isActive = Number(button.dataset.zoom) === gameState.settings.cameraZoom;
    button.classList.toggle('bg-emerald-500', isActive);
    button.classList.toggle('text-gray-950', isActive);
    button.classList.toggle('text-gray-300', !isActive);
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

function handleCameraZoomChange(event) {
  updateSetting('cameraZoom', Number(event.currentTarget.dataset.zoom));
  renderSettings();
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
  knownUnlockedMapKeys = null;
  stageZoom = STAGE_ZOOM_DEFAULT;
  runnerMoving = false;
  ({ row: runnerRow, col: runnerCol } = findMapGridPosition(DEFAULT_MAP_KEY));
  startRunnerFrames(IDLE_SPRITE_FRAMES, IDLE_SPRITE_FRAME_RATE);
  renderPlayerInfo();
  renderSettings();
  renderStages();
  renderShop();
  applyStageZoom();
  closeSettings();
  showMapPreview(selectedMapKey, elements.stagePreviewViewport);
}

// Loja/Coleção ainda não têm tela própria (ver IMPLEMENTATION_PLAN.md) —
// por enquanto só trocam qual <section> fica visível dentro do shell da
// Welcome (header e tabbar continuam fixos, só o miolo do <main> muda). O
// preview do mapa e o botão de zoom ficam DENTRO da <section data-view="home">
// de propósito: assim eles somem junto com a aba, em vez de vazar por cima
// das outras (ver welcomeScreen.html).
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
  if (view === 'shop') renderShop();
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
    stagePreviewViewport: screenRoot.querySelector('.stage-preview-viewport'),
    stageGridViewport: screenRoot.querySelector('.stage-grid-viewport'),
    stageGrid: screenRoot.querySelector('.stage-grid'),
    zoomResetBtn: screenRoot.querySelector('.zoom-reset-btn'),
    zoomLevel: screenRoot.querySelector('.zoom-level'),
    playBtn: screenRoot.querySelector('.play-btn'),
    settingsModal: modalRoot,
    closeBtn: modalRoot.querySelector('.settings-close-btn'),
    resetStorageBtn: modalRoot.querySelector('.reset-storage-btn'),
    settingToggles: [...modalRoot.querySelectorAll('.setting-toggle')],
    cameraZoomButtons: [...modalRoot.querySelectorAll('.camera-zoom-btn')],
    views: [...screenRoot.querySelectorAll('.welcome-view')],
    tabButtons: [...screenRoot.querySelectorAll('.tab-btn')],
    shopList: screenRoot.querySelector('.shop-list'),
  };

  elements.gearBtn.addEventListener('click', openSettings);
  elements.closeBtn.addEventListener('click', closeSettings);
  elements.settingsModal.addEventListener('click', (event) => {
    if (event.target === elements.settingsModal) closeSettings();
  });
  elements.settingToggles.forEach((toggle) => {
    toggle.addEventListener('change', handleSettingChange);
  });
  elements.cameraZoomButtons.forEach((button) => {
    button.addEventListener('click', handleCameraZoomChange);
  });
  elements.resetStorageBtn.addEventListener('click', handleResetStorage);
  elements.shopList.addEventListener('click', handleShopBuyClick);
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.playBtn.addEventListener('click', () => onPlay?.(selectedMapKey));
  elements.zoomResetBtn.addEventListener('click', () => {
    stageZoom = STAGE_ZOOM_DEFAULT;
    applyStageZoom();
  });
  setupGridInteractions(elements.stageGridViewport);

  // O boneco sempre "começa" no hub (fase 0) parado, idle — a corrida só
  // acontece de novo se o player clicar numa fase.
  ({ row: runnerRow, col: runnerCol } = findMapGridPosition(DEFAULT_MAP_KEY));
  runnerEl = createRunnerElement();

  renderPlayerInfo();
  renderSettings();
  renderStages();
  renderShop();
  applyStageZoom();
  startIdleAnimation();
  startRunnerFrames(IDLE_SPRITE_FRAMES, IDLE_SPRITE_FRAME_RATE);
  showMapPreview(selectedMapKey, elements.stagePreviewViewport);
}

export function HideWelcomeScreen() {
  if (!elements) return;
  stopIdleAnimation();
  window.clearInterval(runnerFrameTimer);
  runnerFrameTimer = null;
  runnerEl = null;
  runnerMoving = false;
  destroyMapPreview(elements.stagePreviewViewport);
  elements.screenRoot.remove();
  elements.modalRoot.remove();
  elements = null;
  hasCenteredStageGrid = false;
  stageZoom = STAGE_ZOOM_DEFAULT;
}
