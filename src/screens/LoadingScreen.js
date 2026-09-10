// Tela de loading em HTML/Tailwind sobreposta ao canvas (CLAUDE.md /
// GUIDELINES.md: UI fora do Phaser vive aqui, nunca dentro de /src/game/).
// Este módulo nunca importa nada de /src/game/, e o Phaser nunca importa
// nada daqui — a ponte é só o EventEmitter global do jogo (`game.events`),
// com os nomes de evento combinados em LOADING_EVENTS (src/constants.js).
//
// ShowLoadingScreen() é chamado em main.js antes de instanciar o
// Phaser.Game, para cobrir o carregamento inicial de assets. BindLoadingEvents()
// remove a tela quando a GameScene termina o create().
import loadingTemplate from './loadingScreen.html?raw';
import { LOADING_EVENTS } from '../constants.js';

// Tempo mínimo em tela: sem isso, com os assets já cacheados pelo service
// worker, a tela desaparece rápido demais pra dar tempo da animação de
// tiles rodar.
const MIN_VISIBLE_MS = 2200;

// Tamanho de cada tile renderizado (o tileset original é 16px por tile).
const TILE_DISPLAY_SIZE = 40;
const TILE_SHEET_COLS = 16; // world_tileset.png: 256px / 16px por tile
const TILE_ROW_LENGTH = 8;

// Região de tiles de chão/grama do tileset usada na animação: colunas 1-7
// e linhas 1-3 (0-indexado: col 0-6, row 0-2).
const GROUND_TILE_COORDS = [];
for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 7; col += 1) {
    GROUND_TILE_COORDS.push([col, row]);
  }
}

let screen = null;
let hideTimer = null;
// Cada partida cria um Phaser.Game novo (ver main.js/startMatch) — precisa
// ser um WeakSet por instância, e não um boolean único: um boolean fixo
// faria só o primeiro Game da sessão nunca ganhar os listeners, deixando a
// tela de loading presa pra sempre em toda troca de mapa seguinte.
const boundGames = new WeakSet();

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function pickRandomGroundTile() {
  const index = Math.floor(Math.random() * GROUND_TILE_COORDS.length);
  return GROUND_TILE_COORDS[index];
}

function createFallingTile(index) {
  const [col, row] = pickRandomGroundTile();
  const tile = document.createElement('div');
  tile.className = 'loading-tile';
  tile.style.setProperty('--i', index);
  tile.style.width = `${TILE_DISPLAY_SIZE}px`;
  tile.style.height = `${TILE_DISPLAY_SIZE}px`;
  tile.style.backgroundImage = "url('/assets/tiledmap/world_tileset.png')";
  tile.style.backgroundSize = `${TILE_SHEET_COLS * TILE_DISPLAY_SIZE}px ${TILE_SHEET_COLS * TILE_DISPLAY_SIZE}px`;
  tile.style.backgroundPosition = `-${col * TILE_DISPLAY_SIZE}px -${row * TILE_DISPLAY_SIZE}px`;
  return tile;
}

function mountFallingTiles(container) {
  if (!container) return;
  for (let i = 0; i < TILE_ROW_LENGTH; i += 1) {
    container.appendChild(createFallingTile(i));
  }
}

function removeScreenNode(root) {
  // pointer-events-none já tira a tela do caminho dos cliques mesmo que o
  // transitionend nunca dispare (acontece se a aba perde foco durante a
  // transição, ou em contextos sem compositor de verdade como headless) —
  // sem isso, um elemento fixed inset-0 invisível ainda intercepta cliques
  // por baixo dele indefinidamente.
  root.classList.add('opacity-0', 'pointer-events-none');
  root.addEventListener('transitionend', () => root.remove(), { once: true });
  // Fallback: garante que o node some mesmo sem transitionend.
  window.setTimeout(() => root.remove(), 600);
}

// variant 'tiles' (padrão, usada ao iniciar uma run): só o chão de tiles
// caindo. variant 'player' (usada no boot do app, antes da Welcome): o
// mesmo chão de tiles + a cenografia player-vs-inimigos em CSS (ver
// .loading-actor* / .loading-bullet* em main.css).
export function ShowLoadingScreen(message = 'Carregando...', variant = 'tiles') {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[LoadingScreen] #app não encontrado no DOM — tela de loading não será exibida.');
    return;
  }

  window.clearTimeout(hideTimer);
  hideTimer = null;
  if (screen) removeScreenNode(screen.root);

  const root = parseTemplate(loadingTemplate);
  const messageEl = root.querySelector('.loading-message');
  if (messageEl) messageEl.textContent = message;
  if (variant === 'player') root.classList.add('is-player-variant');
  mountFallingTiles(root.querySelector('.loading-tiles'));
  app.append(root);

  screen = { root, shownAt: performance.now() };
}

export function HideLoadingScreen() {
  if (!screen) return;
  const { root, shownAt } = screen;
  screen = null;

  const elapsed = performance.now() - shownAt;
  const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    hideTimer = null;
    removeScreenNode(root);
  }, remaining);
}

// Liga a tela de loading ao EventEmitter global do jogo. Chame uma vez por
// Phaser.Game (main.js chama a cada startMatch, um Game novo por partida).
// Idempotente: chamar de novo com o mesmo `game` não duplica listeners.
export function BindLoadingEvents(game) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(LOADING_EVENTS.COMPLETE, HideLoadingScreen);
}
