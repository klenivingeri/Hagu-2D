// Modal de pausa em HTML/Tailwind, mostrado quando o player aperta START ou
// SELECT (ver GameScene.openPauseMenu() / PAUSE_EVENTS em constants.js). UI
// fora do Phaser vive aqui (CLAUDE.md regra 1) — o Phaser só emite o evento,
// esta tela só escuta (ligada em main.js/BindPauseEvents).
import pauseTemplate from './pauseScreen.html?raw';
import { PAUSE_EVENTS } from '../constants.js';

let elements = null;
// Cada partida cria um Phaser.Game novo (ver main.js/startMatch) — precisa
// ser um WeakSet por instância, senão o primeiro Game da sessão nunca ganha
// o listener de pausa nas partidas seguintes.
const boundGames = new WeakSet();

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// `onResume` e `onBackToMap` decidem o que fazer com a partida pausada (ver
// main.js): retomar a GameScene ou destruir o Phaser.Game e voltar pra
// Welcome.
export function ShowPauseScreen({ onResume, onBackToMap } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[PauseScreen] #app não encontrado no DOM — modal de pausa não será exibido.');
    return;
  }

  HidePauseScreen();

  const root = parseTemplate(pauseTemplate);
  app.append(root);

  elements = {
    root,
    resumeBtn: root.querySelector('.pause-resume-btn'),
    backBtn: root.querySelector('.pause-back-btn'),
  };

  elements.resumeBtn.addEventListener('click', () => onResume?.());
  elements.backBtn.addEventListener('click', () => onBackToMap?.());
  elements.root.addEventListener('click', (event) => {
    if (event.target === elements.root) onResume?.();
  });
}

export function HidePauseScreen() {
  if (!elements) return;
  elements.root.remove();
  elements = null;
}

// Liga o modal de pausa ao EventEmitter global do jogo. Chame uma vez por
// Phaser.Game (main.js chama a cada startMatch, um Game novo por partida).
// Idempotente: chamar de novo com o mesmo `game` não duplica listeners.
export function BindPauseEvents(game, { onResume, onBackToMap } = {}) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(PAUSE_EVENTS.OPEN, () => {
    ShowPauseScreen({ onResume, onBackToMap });
  });
}
