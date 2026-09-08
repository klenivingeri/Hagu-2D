// Tela de loading em HTML/Tailwind sobreposta ao canvas (CLAUDE.md /
// GUIDELINES.md: UI fora do Phaser vive aqui, nunca dentro de /src/game/).
// Este módulo nunca importa nada de /src/game/, e o Phaser nunca importa
// nada daqui — a ponte é só o EventEmitter global do jogo (`game.events`),
// com os nomes de evento combinados em LOADING_EVENTS (src/constants.js).
//
// ShowLoadingScreen() é chamado em main.js antes de instanciar o
// Phaser.Game, para cobrir o carregamento inicial de assets. BindLoadingEvents()
// liga o progresso do loader do Phaser à barra e remove a tela quando a
// GameScene termina o create().
import loadingTemplate from './loadingScreen.html?raw';
import { LOADING_EVENTS } from '../constants.js';

let screen = null;
let bound = false;

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function ShowLoadingScreen() {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[LoadingScreen] #app não encontrado no DOM — tela de loading não será exibida.');
    return;
  }

  HideLoadingScreen();

  const root = parseTemplate(loadingTemplate);
  app.append(root);

  screen = {
    root,
    fill: root.querySelector('.loading-bar-fill'),
    percent: root.querySelector('.loading-percent'),
  };
}

function updateLoadingProgress(value = 0) {
  if (!screen) return;
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
  screen.fill.style.width = `${percentage}%`;
  screen.percent.textContent = `${percentage}%`;
}

export function HideLoadingScreen() {
  if (!screen) return;
  const { root } = screen;
  screen = null;

  root.classList.add('opacity-0');
  root.addEventListener('transitionend', () => root.remove(), { once: true });
}

// Liga a tela de loading ao EventEmitter global do jogo. Chame uma única
// vez, assim que o Phaser.Game for instanciado (ver main.js). Idempotente:
// chamar de novo com o mesmo `game` não duplica listeners.
export function BindLoadingEvents(game) {
  if (bound) return;
  bound = true;

  game.events.on(LOADING_EVENTS.PROGRESS, updateLoadingProgress);
  game.events.on(LOADING_EVENTS.COMPLETE, HideLoadingScreen);
}
