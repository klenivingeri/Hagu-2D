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
  getMapStars,
  isAbilityEquipped,
  equipAbility,
  isAccessoryEquipped,
  equipAccessory,
} from '../managers/GameManager.js';
import { UPGRADES_CATALOG, ABILITY_UPGRADE_IDS, ACCESSORY_UPGRADE_IDS } from '../game/config/upgrades.js';
import { MAP_GRID, DEFAULT_MAP_KEY } from '../game/config/maps.js';
import { getStageLabel, getStageNumber } from './mapLabels.js';
import { showMapPreview, updateMapPreview, destroyMapPreview } from './mapPreview.js';
import {
  isFullscreenSupported,
  isFullscreenActive,
  toggleFullscreen,
  onFullscreenChange,
  offFullscreenChange,
} from '../services/FullscreenService.js';
import { BESTIARY, getBestiaryEntry, getBehaviorTraitLabel } from '../game/config/bestiary.js';
import { getCollectionEntries } from '../managers/GameManager.js';
// Só a CONFIG de mobs (dados puros, sem Phaser) — nunca o Phaser em si,
// que fica proibido aqui (CLAUDE.md regra 1: WelcomeScreen é tela HTML).
import { getMobConfig } from '../game/config/entities.js';

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
// Em paisagem a viewport fica bem mais baixa — com o zoom padrão o grid
// inteiro não cabe na tela sem rolar, por isso o default nasce na metade.
const STAGE_ZOOM_DEFAULT_LANDSCAPE = STAGE_ZOOM_DEFAULT * 0.5;

const landscapeMediaQuery = typeof window !== 'undefined'
  ? window.matchMedia('(orientation: landscape)')
  : null;

function isLandscapeOrientation() {
  return Boolean(landscapeMediaQuery?.matches);
}

function getDefaultStageZoom() {
  return isLandscapeOrientation() ? STAGE_ZOOM_DEFAULT_LANDSCAPE : STAGE_ZOOM_DEFAULT;
}

function clampZoom(zoom) {
  return Math.min(STAGE_ZOOM_MAX, Math.max(STAGE_ZOOM_MIN, zoom));
}

// Ao girar a tela: recalcula o zoom padrão pro novo formato de viewport e
// força o preview do mapa a reler clientWidth/clientHeight (mapPreview.js
// escala pela largura ou altura dependendo da orientação).
function handleOrientationChange() {
  if (!elements) return;
  stageZoom = getDefaultStageZoom();
  applyStageZoom();
  showMapPreview(selectedMapKey, elements.stagePreviewViewport);
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

// Timers dos ícones animados do grid da Coleção (ver buildCollectionCard) —
// precisam ser limpos manualmente porque trocam img.src via setInterval,
// não uma anims.create() do Phaser que morre sozinha com a cena.
let collectionCardTimers = [];

function stopCollectionCardAnimations() {
  collectionCardTimers.forEach((timerId) => window.clearInterval(timerId));
  collectionCardTimers = [];
}

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

// Corre o boneco até a fase recém-desbloqueada (chamado só depois que a
// animação de pop/brilho da célula termina — ver isNewlyUnlocked em
// renderStages) e a seleciona ao chegar, como se o player tivesse clicado
// nela. runnerMoving evita disparo duplo se mais de uma fase desbloquear
// junto (não deveria acontecer no fluxo normal, mas é barato de checar).
function moveRunnerToStage(mapKey, cells) {
  if (!runnerEl || runnerMoving) return;
  const target = cells.find((cell) => cell.mapKey === mapKey);
  if (!target) return;

  const path = findStagePath(buildStageGraph(cells), { row: runnerRow, col: runnerCol }, { row: target.row, col: target.col });
  moveRunnerAlongPath(path, () => {
    selectedMapKey = mapKey;
    renderStages();
    updateMapPreview(mapKey, elements.stagePreviewViewport);
  });
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

// Reaproveita a mesma escala 1-3 de GameScene.completeRun()/GameManager.
// getMapStars() — ⭐ preenchida pra cada estrela já conquistada, ☆ vazia pro
// resto, igual ao critério usado em RunSummaryScreen.js.
function renderStageStars(stars) {
  return Array.from({ length: 3 }, (_, index) => (index < stars ? '⭐' : '☆')).join('');
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
      <span class="stage-cell-stars flex gap-0.5 text-[10px] leading-none text-gray-400" aria-hidden="true">${renderStageStars(getMapStars(mapKey))}</span>
      <span class="stage-cell-label absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-gray-300">${getStageLabel(mapKey)}</span>
    `;
    if (isNewlyUnlocked) {
      cell.addEventListener('animationend', () => {
        cell.classList.remove('stage-cell-unlock');
        moveRunnerToStage(mapKey, cells);
      }, { once: true });
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
// que têm mais de 1 nível — os upgrades booleanos (pulo duplo, paraquedas) não
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

  // Pulo duplo/paraquedas/jetpack/parede/armas saíram da Loja pra aba "Equip." (ver
  // renderEquipmentAbilities/renderEquipmentAccessories) — só um item de
  // cada grupo fica ativo por vez, então usam o fluxo comprar-depois-equipar,
  // não o botão de compra normal.
  const EXCLUDED_FROM_SHOP = new Set([...ABILITY_UPGRADE_IDS, ...ACCESSORY_UPGRADE_IDS]);
  UPGRADES_CATALOG.filter((def) => !EXCLUDED_FROM_SHOP.has(def.id)).forEach((def) => {
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

// Habilidades (ver ABILITY_UPGRADE_IDS) têm 3 estados na aba Equip.:
// bloqueada (ainda não comprada, mostra o botão de compra igual à Loja),
// comprada-mas-guardada (mostra "Equipar") e equipada (mostra badge
// desabilitado, destacada com borda verde) — só uma fica equipada por vez
// (ver GameManager.equipAbility).
function renderEquipmentAbilities() {
  if (!elements) return;

  elements.abilityList.innerHTML = '';

  ABILITY_UPGRADE_IDS.forEach((id) => {
    const state = getUpgradeState(id);
    const owned = state.level > 0;
    const equipped = isAbilityEquipped(id);
    const canAfford = !owned && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const statusLine = !owned ? 'Bloqueado' : equipped ? 'Equipado' : 'No inventário';

    const actionHtml = !owned
      ? `<button type="button" data-buy-ability-id="${id}" class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          canAfford ? 'bg-emerald-500 text-gray-950' : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }" ${canAfford ? '' : 'disabled'}>${state.cost} ${currencyIcon}</button>`
      : equipped
        ? `<button type="button" class="ability-equip-btn shrink-0 cursor-not-allowed rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white" disabled>Equipado</button>`
        : `<button type="button" data-equip-ability-id="${id}" class="ability-equip-btn shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-gray-950 transition-transform active:scale-95">Equipar</button>`;

    const row = document.createElement('div');
    row.className = [
      'shop-item flex items-center gap-3 rounded-xl border-2 bg-gray-900/60 px-3 py-2',
      equipped ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10',
    ].join(' ');
    row.innerHTML = `
      <span class="text-xl leading-none shrink-0">${state.def.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${state.def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}</p>
      </div>
      ${actionHtml}
    `;
    elements.abilityList.append(row);
  });
}

function handleAbilityListClick(event) {
  const buyBtn = event.target.closest('[data-buy-ability-id]');
  if (buyBtn && !buyBtn.disabled) {
    const bought = purchaseUpgrade(buyBtn.dataset.buyAbilityId);
    if (bought) {
      renderPlayerInfo();
      renderEquipmentAbilities();
    }
    return;
  }

  const equipBtn = event.target.closest('[data-equip-ability-id]');
  if (equipBtn) {
    equipAbility(equipBtn.dataset.equipAbilityId);
    renderEquipmentAbilities();
  }
}

// Armas (ver ACCESSORY_UPGRADE_IDS): mesmos 3 estados das habilidades acima,
// só que a já equipada nunca aparece "desequipável" (sempre tem uma arma
// ativa — ver GameManager.equipAccessory) e cada linha mostra a descrição
// do efeito (ainda sem mecânica de gameplay ligada, só o catálogo).
function renderEquipmentAccessories() {
  if (!elements) return;

  elements.accessoryList.innerHTML = '';

  ACCESSORY_UPGRADE_IDS.forEach((id) => {
    const state = getUpgradeState(id);
    const owned = state.level > 0;
    const equipped = isAccessoryEquipped(id);
    const canAfford = !owned && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const statusLine = !owned ? 'Bloqueado' : equipped ? 'Equipado' : 'No inventário';

    const actionHtml = !owned
      ? `<button type="button" data-buy-accessory-id="${id}" class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          canAfford ? 'bg-emerald-500 text-gray-950' : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }" ${canAfford ? '' : 'disabled'}>${state.cost} ${currencyIcon}</button>`
      : equipped
        ? `<button type="button" class="ability-equip-btn shrink-0 cursor-not-allowed rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white" disabled>Equipado</button>`
        : `<button type="button" data-equip-accessory-id="${id}" class="ability-equip-btn shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-gray-950 transition-transform active:scale-95">Equipar</button>`;

    const row = document.createElement('div');
    row.className = [
      'shop-item flex items-center gap-3 rounded-xl border-2 bg-gray-900/60 px-3 py-2',
      equipped ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10',
    ].join(' ');
    row.innerHTML = `
      <span class="text-xl leading-none shrink-0">${state.def.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${state.def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}${state.def.description ? ` · ${state.def.description}` : ''}</p>
      </div>
      ${actionHtml}
    `;
    elements.accessoryList.append(row);
  });
}

function handleAccessoryListClick(event) {
  const buyBtn = event.target.closest('[data-buy-accessory-id]');
  if (buyBtn && !buyBtn.disabled) {
    const bought = purchaseUpgrade(buyBtn.dataset.buyAccessoryId);
    if (bought) {
      renderPlayerInfo();
      renderEquipmentAccessories();
    }
    return;
  }

  const equipBtn = event.target.closest('[data-equip-accessory-id]');
  if (equipBtn) {
    equipAccessory(equipBtn.dataset.equipAccessoryId);
    renderEquipmentAccessories();
  }
}

// Ícone estático (frame 0 do run) de cada espécie — mesma pasta/convenção
// usada em RunSummaryScreen.getMonsterIconSrc (config.path || key).
function getCollectionIconSrc({ key, path }) {
  const folder = path || key;
  return `/assets/mobs/${folder}/run/sprite_run_two_0.png`;
}

// Todos os frames do "run" da espécie (mesma animação que ela usa correndo
// em campo), pra tocar como <img> comum no card da Coleção — mesma técnica
// de trocar src via setInterval do startRunnerFrames, já que aqui fora não
// tem cena do Phaser rodando uma anims.create() de verdade. Sem 'run'
// configurado (mob novo/incompleto), cai pro frame estático de sempre.
function getCollectionRunFrames(entry) {
  const folder = entry.path || entry.key;
  const run = getMobConfig(entry.behavior).animations?.find((animation) => animation.key === 'run');
  if (!run) return { frames: [getCollectionIconSrc(entry)], frameRate: 1 };

  const frames = Array.from(
    { length: run.frames + 1 },
    (_, i) => `/assets/mobs/${folder}/${run.url}${i}.png`
  );
  return { frames, frameRate: run.frameRate };
}

// Poses "de identidade" do mob (o que ele parece fora de combate/reação) —
// deixa fora 'stomp'/'spark', que são feedback de dano/morte, não um jeito
// de mostrar o bicho na galeria. Ordem fixa pra galeria não pular de posição
// entre espécies diferentes.
const GALLERY_POSE_ORDER = ['idle', 'run', 'bow', 'attack'];
const GALLERY_POSE_LABELS = { idle: 'Parado', run: 'Run', bow: 'Arco', attack: 'Ataque' };

// entry.behavior é a mesma key usada em MOBS_CONFIG (ver
// EnemyBase.killEnemy -> recordEnemyDefeat, que grava enemy.entityConfig.behavior
// vindo de getMobConfig(type) — cada type do MOBS_CONFIG usa a própria key
// como valor de "behavior"), então dá pra buscar de volta a lista de
// animations daquele tipo de mob a partir só do que já está salvo na
// Coleção (sem precisar de nenhuma cena do Phaser ativa).
function getGalleryPoses(entry) {
  if (!entry) return [];
  const folder = entry.path || entry.key;
  const config = getMobConfig(entry.behavior);

  return GALLERY_POSE_ORDER
    .map((poseKey) => config.animations?.find((animation) => animation.key === poseKey))
    .filter(Boolean)
    .map((animation) => ({
      key: animation.key,
      label: GALLERY_POSE_LABELS[animation.key] || animation.key,
      src: `/assets/mobs/${folder}/${animation.url}0.png`,
    }));
}

function buildGallerySpriteSlot({ label, src }, spriteUnlocked) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center gap-1';

  const frame = document.createElement('div');
  frame.className = 'flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-gray-900/80';

  const img = document.createElement('img');
  img.src = src;
  img.alt = `Sprite de ${label}`;
  img.className = `h-10 w-10 object-contain [image-rendering:pixelated] ${getSpriteFilterClass(spriteUnlocked)}`;
  // Nem todo mob tem asset pra toda pose (ex: nem todo type usa 'bow') —
  // some o slot em vez de mostrar o ícone quebrado do navegador.
  img.onerror = () => { wrapper.remove(); };

  const caption = document.createElement('span');
  caption.className = 'text-[9px] font-semibold text-gray-400';
  caption.textContent = label;

  frame.append(img);
  wrapper.append(frame, caption);
  return wrapper;
}

// Sprite ainda não dropado (ver GameManager.hasCollectedSprite): vira
// silhueta preta em vez de sumir, pra dar a mesma sensação de "quem é esse
// bicho?" tanto no card quanto no modal — ver EnemyBase.killEnemy() pra
// onde a chance de drop rola de verdade.
function getSpriteFilterClass(spriteUnlocked) {
  return spriteUnlocked ? '' : '[filter:brightness(0)] opacity-70';
}

// Card da aba Coleção: espécie nunca derrotada (sem entrada em
// GameManager.gameState.collection ou kills === 0) fica travada com "❔",
// sem nome nem clique — só depois de derrotar pelo menos uma vez é que o
// nome aparece (com a sprite em silhueta até dropar o item, ver
// createSpriteDrops.js).
function buildCollectionCard(speciesKey, entry) {
  const discovered = Boolean(entry && entry.kills > 0);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = [
    'collection-card flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-transform',
    discovered ? 'border-white/15 bg-gray-900/60 active:scale-95' : 'cursor-default border-white/5 bg-gray-900/30',
  ].join(' ');

  if (!discovered) {
    const icon = document.createElement('span');
    icon.className = 'flex h-10 w-10 items-center justify-center text-xl text-gray-600';
    icon.textContent = '❔';
    const label = document.createElement('span');
    label.className = 'truncate text-[9px] font-bold text-gray-600';
    label.textContent = '???';
    card.append(icon, label);
    return card;
  }

  // O card do grid revela o bicho assim que ele é derrotado pelo menos uma
  // vez — mas só conta se a run em que ele morreu chegou até o fim (ver
  // GameManager.recordEnemyDefeat, commitado só em GameScene.completeRun()).
  // A silhueta de "quem é esse bicho?" fica só dentro do modal (ver
  // openCollectionModal), na galeria de sprites, até o item colecionável ser
  // pego em campo NUMA RUN CONCLUÍDA (ver GameManager.unlockEnemySprite).
  const bestiaryEntry = getBestiaryEntry(speciesKey);
  const { frames, frameRate } = getCollectionRunFrames(entry);
  const img = document.createElement('img');
  img.src = frames[0];
  img.alt = bestiaryEntry.name;
  img.className = 'h-10 w-10 object-contain [image-rendering:pixelated]';
  img.onerror = () => { img.style.visibility = 'hidden'; };

  if (frames.length > 1) {
    let frameIndex = 0;
    const timerId = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      img.src = frames[frameIndex];
    }, 1000 / frameRate);
    collectionCardTimers.push(timerId);
  }

  const label = document.createElement('span');
  label.className = 'truncate text-[9px] font-bold text-white';
  label.textContent = bestiaryEntry.name;

  card.append(img, label);
  card.addEventListener('click', () => openCollectionModal(speciesKey, entry));
  return card;
}

// União do bestiário (espécies conhecidas de antemão, ver
// game/config/bestiary.js) com o que já foi encontrado em jogo — mob novo
// derrotado antes de ganhar entrada no bestiário ainda aparece no grid (ver
// getBestiaryEntry, cai no fallback genérico).
function renderCollection() {
  if (!elements) return;
  stopCollectionCardAnimations();
  const entries = getCollectionEntries();
  const speciesKeys = Array.from(new Set([...Object.keys(BESTIARY), ...Object.keys(entries)]));

  elements.collectionGrid.innerHTML = '';
  speciesKeys.forEach((speciesKey) => {
    elements.collectionGrid.append(buildCollectionCard(speciesKey, entries[speciesKey]));
  });
}

function openCollectionModal(speciesKey, entry) {
  if (!elements || !entry) return;
  const bestiaryEntry = getBestiaryEntry(speciesKey);
  const spriteUnlocked = Boolean(entry.spriteUnlocked);

  elements.collectionModalName.textContent = bestiaryEntry.name;
  elements.collectionModalDescription.textContent = bestiaryEntry.description;

  elements.collectionModalTraits.innerHTML = '';
  if (entry.behavior) {
    const badge = document.createElement('span');
    badge.className = 'rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300';
    badge.textContent = getBehaviorTraitLabel(entry.behavior);
    elements.collectionModalTraits.append(badge);
  }

  elements.collectionModalSpriteGallery.innerHTML = '';
  getGalleryPoses(entry).forEach((pose) => {
    elements.collectionModalSpriteGallery.append(buildGallerySpriteSlot(pose, spriteUnlocked));
  });
  elements.collectionModalSpriteHint.classList.toggle('hidden', spriteUnlocked);
  elements.collectionModalKills.textContent = `Derrotados nas runs: ${entry.kills}`;

  elements.collectionModal.classList.remove('hidden');
  elements.collectionModal.classList.add('flex');
}

function closeCollectionModal() {
  elements?.collectionModal.classList.add('hidden');
  elements?.collectionModal.classList.remove('flex');
}

function switchEquipmentSubview(subview) {
  if (!elements) return;
  elements.equipmentSubviews.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.subview !== subview);
  });
  elements.equipmentSubtabButtons.forEach((button) => {
    const active = button.dataset.subview === subview;
    button.classList.toggle('equipment-subtab-active', active);
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

  // Navegadores sem Fullscreen API (ex: Safari iOS) escondem a opção em vez
  // de mostrar um toggle que nunca funciona.
  elements.fullscreenRow?.classList.toggle('hidden', !isFullscreenSupported());
  if (elements.fullscreenToggle) {
    elements.fullscreenToggle.checked = isFullscreenActive();
  }
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

// Não usa updateSetting/gameState.settings: fullscreen não é uma preferência
// persistível (o navegador exige gesto do usuário pra entrar, então não dá
// pra restaurar sozinho num reload) — o estado real é sempre
// document.fullscreenElement (ver FullscreenService.js).
function handleFullscreenToggle() {
  // document.documentElement (default do FullscreenService), nunca um nó da
  // tela atual: screenRoot é substituído a cada troca de view/tela e sairia
  // do fullscreen sozinho se fosse removido do DOM.
  toggleFullscreen();
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
  stageZoom = getDefaultStageZoom();
  runnerMoving = false;
  ({ row: runnerRow, col: runnerCol } = findMapGridPosition(DEFAULT_MAP_KEY));
  startRunnerFrames(IDLE_SPRITE_FRAMES, IDLE_SPRITE_FRAME_RATE);
  renderPlayerInfo();
  renderSettings();
  renderStages();
  renderShop();
  renderEquipmentAbilities();
  renderEquipmentAccessories();
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
  if (view === 'equipment') {
    renderEquipmentAbilities();
    renderEquipmentAccessories();
  }
  if (view === 'collection') {
    renderCollection();
  } else {
    stopCollectionCardAnimations();
  }
}

export function ShowWelcomeScreen({ onPlay } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[WelcomeScreen] #app não encontrado no DOM — tela de welcome não será exibida.');
    return;
  }

  HideWelcomeScreen();

  const [screenRoot, modalRoot, collectionModalRoot] = parseTemplate(welcomeTemplate);
  app.append(screenRoot, modalRoot, collectionModalRoot);

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
    fullscreenRow: modalRoot.querySelector('.fullscreen-setting-row'),
    fullscreenToggle: modalRoot.querySelector('.fullscreen-toggle'),
    views: [...screenRoot.querySelectorAll('.welcome-view')],
    tabButtons: [...screenRoot.querySelectorAll('.tab-btn')],
    shopList: screenRoot.querySelector('.shop-list'),
    abilityList: screenRoot.querySelector('.equipment-ability-list'),
    accessoryList: screenRoot.querySelector('.equipment-accessory-list'),
    equipmentSubviews: [...screenRoot.querySelectorAll('.equipment-subview')],
    equipmentSubtabButtons: [...screenRoot.querySelectorAll('.equipment-subtab-btn')],
    collectionGrid: screenRoot.querySelector('.collection-grid'),
    collectionModalRoot,
    collectionModal: collectionModalRoot,
    collectionModalClose: collectionModalRoot.querySelector('.collection-modal-close'),
    collectionModalName: collectionModalRoot.querySelector('.collection-modal-name'),
    collectionModalTraits: collectionModalRoot.querySelector('.collection-modal-traits'),
    collectionModalDescription: collectionModalRoot.querySelector('.collection-modal-description'),
    collectionModalSpriteGallery: collectionModalRoot.querySelector('.collection-modal-sprite-gallery'),
    collectionModalSpriteHint: collectionModalRoot.querySelector('.collection-modal-sprite-hint'),
    collectionModalKills: collectionModalRoot.querySelector('.collection-modal-kills'),
  };

  elements.gearBtn.addEventListener('click', openSettings);
  elements.closeBtn.addEventListener('click', closeSettings);
  elements.settingsModal.addEventListener('click', (event) => {
    if (event.target === elements.settingsModal) closeSettings();
  });
  elements.settingToggles.forEach((toggle) => {
    toggle.addEventListener('change', handleSettingChange);
  });
  elements.fullscreenToggle?.addEventListener('change', handleFullscreenToggle);
  // O player pode sair do fullscreen sem usar o toggle (Esc, gesto do
  // navegador) — resincroniza o checkbox nesses casos.
  onFullscreenChange(renderSettings);
  elements.resetStorageBtn.addEventListener('click', handleResetStorage);
  elements.shopList.addEventListener('click', handleShopBuyClick);
  elements.abilityList.addEventListener('click', handleAbilityListClick);
  elements.accessoryList.addEventListener('click', handleAccessoryListClick);
  elements.equipmentSubtabButtons.forEach((button) => {
    button.addEventListener('click', () => switchEquipmentSubview(button.dataset.subview));
  });
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.collectionModalClose.addEventListener('click', closeCollectionModal);
  elements.collectionModal.addEventListener('click', (event) => {
    if (event.target === elements.collectionModal) closeCollectionModal();
  });
  elements.playBtn.addEventListener('click', () => onPlay?.(selectedMapKey));
  elements.zoomResetBtn.addEventListener('click', () => {
    stageZoom = getDefaultStageZoom();
    applyStageZoom();
  });
  setupGridInteractions(elements.stageGridViewport);
  landscapeMediaQuery?.addEventListener('change', handleOrientationChange);

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
  offFullscreenChange(renderSettings);
  landscapeMediaQuery?.removeEventListener('change', handleOrientationChange);
  elements.screenRoot.remove();
  elements.modalRoot.remove();
  elements.collectionModalRoot.remove();
  elements = null;
  hasCenteredStageGrid = false;
  stageZoom = getDefaultStageZoom();
}
