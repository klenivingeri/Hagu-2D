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

// Liga a tela de loading ao EventEmitter global do jogo. Chame uma vez por
// Phaser.Game (main.js chama a cada startMatch, um Game novo por partida).
// Idempotente: chamar de novo com o mesmo `game` não duplica listeners.
export function BindLoadingEvents(game) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(LOADING_EVENTS.PROGRESS, updateLoadingProgress);
  game.events.on(LOADING_EVENTS.COMPLETE, HideLoadingScreen);
}
