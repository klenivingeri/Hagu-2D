// Modal de Game Over em HTML/Tailwind, mostrado quando o player esgota as
// tentativas da fase (ver createPlayer.killPlayer()/MAX_RUN_ATTEMPTS em
// constants.js). UI fora do Phaser vive aqui (CLAUDE.md regra 1) — o Phaser
// só emite o evento (GAME_OVER_EVENTS.OPEN), esta tela só escuta (ligada em
// main.js/BindGameOverEvents).
import gameOverTemplate from './gameOverScreen.html?raw';
import { GAME_OVER_EVENTS } from '../constants.js';

// Tempo de espera, depois que o modal aparece, até revelar os botões — dá
// tempo da animação "GAME OVER" (ver @keyframes game-over-letter-drop em
// main.css) acontecer antes de oferecer as ações.
const ACTIONS_REVEAL_DELAY_MS = 1000;

let elements = null;
let revealTimer = null;
// Cada partida cria um Phaser.Game novo (ver main.js/startMatch) — precisa
// ser um WeakSet por instância, senão o primeiro Game da sessão nunca ganha
// o listener de Game Over nas partidas seguintes.
const boundGames = new WeakSet();

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// `onRetry` e `onBackToMap` decidem o que fazer com a partida encerrada (ver
// main.js): destruir o Phaser.Game e começar um novo (tentativas resetadas)
// ou destruir e voltar pra Welcome.
export function ShowGameOverScreen({ onRetry, onBackToMap } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[GameOverScreen] #app não encontrado no DOM — modal de Game Over não será exibido.');
    return;
  }

  HideGameOverScreen();

  const root = parseTemplate(gameOverTemplate);
  app.append(root);

  elements = {
    root,
    actions: root.querySelector('.game-over-actions'),
    retryBtn: root.querySelector('.game-over-retry-btn'),
    backBtn: root.querySelector('.game-over-back-btn'),
  };

  elements.retryBtn.addEventListener('click', () => onRetry?.());
  elements.backBtn.addEventListener('click', () => onBackToMap?.());

  revealTimer = window.setTimeout(() => {
    if (!elements) return;
    elements.actions.classList.remove('hidden');
    elements.actions.classList.add('flex');
  }, ACTIONS_REVEAL_DELAY_MS);
}

export function HideGameOverScreen() {
  if (revealTimer !== null) {
    window.clearTimeout(revealTimer);
    revealTimer = null;
  }
  if (!elements) return;
  elements.root.remove();
  elements = null;
}

// Liga o modal de Game Over ao EventEmitter global do jogo. Chame uma vez
// por Phaser.Game (main.js chama a cada startMatch, um Game novo por
// partida). Idempotente: chamar de novo com o mesmo `game` não duplica
// listeners.
export function BindGameOverEvents(game, { onRetry, onBackToMap } = {}) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(GAME_OVER_EVENTS.OPEN, () => {
    ShowGameOverScreen({ onRetry, onBackToMap });
  });
}
