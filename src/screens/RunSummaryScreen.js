// Tela de resumo da run em HTML/Tailwind, mostrada quando o player colide
// com um portal que encerra a fase (ver GameScene.completeRun() /
// RUN_EVENTS.COMPLETE em constants.js). UI fora do Phaser vive aqui
// (CLAUDE.md regra 1) — o Phaser só emite o evento com os dados, esta tela
// só escuta (ligada em main.js/BindRunEvents).
import runSummaryTemplate from './runSummaryScreen.html?raw';
import { getStageLabel } from './mapLabels.js';

let elements = null;

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

// `onBack` é quem decide o que fazer com a run terminada (ver main.js):
// destruir o Phaser.Game e voltar pra Welcome, já com o mapa liberado
// aparecendo no grid.
export function ShowRunSummaryScreen({ coins = 0, diamonds = 0, unlockedMapKey, onBack } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[RunSummaryScreen] #app não encontrado no DOM — resumo da run não será exibido.');
    return;
  }

  HideRunSummaryScreen();

  const root = parseTemplate(runSummaryTemplate);
  app.append(root);

  elements = {
    root,
    unlockedLabel: root.querySelector('.run-summary-unlocked'),
    coins: root.querySelector('.run-summary-coins'),
    diamonds: root.querySelector('.run-summary-diamonds'),
    backBtn: root.querySelector('.run-summary-back-btn'),
  };

  elements.unlockedLabel.textContent = unlockedMapKey
    ? `${getStageLabel(unlockedMapKey)} liberada!`
    : 'Fase concluída';
  elements.coins.textContent = String(coins);
  elements.diamonds.textContent = String(diamonds);
  elements.backBtn.addEventListener('click', () => onBack?.());
}

export function HideRunSummaryScreen() {
  if (!elements) return;
  elements.root.remove();
  elements = null;
}
