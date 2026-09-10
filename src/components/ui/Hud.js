// HUD em HTML/CSS, vive em #hud-bar (irmão do .game-screen no grid do
// game-layout — CLAUDE.md / GUIDELINES.md: UI fora do Phaser nunca entra
// em /src/game/). Em landscape o CSS sobrepõe #hud-bar ao canvas (mesma
// grid-area); em portrait ele vira uma faixa própria acima do canvas.
// Este módulo nunca importa nada de /src/game/, e o Phaser nunca importa
// nada daqui — a ponte é só o EventEmitter global do jogo (`game.events`),
// com os nomes de evento combinados em HUD_EVENTS (src/constants.js). Ver
// BindHudEvents(), chamada uma única vez em main.js assim que o
// Phaser.Game é criado.
import hudTemplate from './hud.html?raw';
import { HUD_EVENTS } from '../../constants.js';

let hud = null;
// Cada partida cria um Phaser.Game novo (ver main.js/startMatch) — precisa
// ser um WeakSet por instância, e não um boolean único: um boolean fixo
// faria só o primeiro Game da sessão ganhar os listeners, deixando o HUD
// mudo (vida/munição/moedas nunca atualizam) em toda troca de mapa seguinte.
const boundGames = new WeakSet();

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

function CreateHud({
  initialCoins = 0,
  initialDiamonds = 0,
  attemptsLeft = 0,
  maxAttempts = 0,
} = {}) {
  const hudBar = document.querySelector('#hud-bar');
  if (!hudBar) {
    console.warn('[Hud] #hud-bar não encontrado no DOM — HUD não será exibido.');
    return;
  }

  DestroyHud();

  const fragment = parseTemplate(hudTemplate);
  const lifePanel = fragment.querySelector('.hud-life-panel');
  const attempts = fragment.querySelector('.hud-attempts');
  const resources = fragment.querySelector('.hud-resources');
  hudBar.append(lifePanel, attempts, resources);

  hud = {
    lifePanel,
    healthFill: lifePanel.querySelector('.health-fill'),
    energyBar: lifePanel.querySelector('.energy-bar'),
    energyFill: lifePanel.querySelector('.energy-fill'),
    attempts,
    attemptsCurrent: attempts.querySelector('.attempts-current'),
    attemptsMax: attempts.querySelector('.attempts-max'),
    resources,
    coinTotal: resources.querySelector('.coin-total'),
    diamondTotal: resources.querySelector('.diamond-total'),
  };

  hud.coinTotal.textContent = String(initialCoins);
  hud.diamondTotal.textContent = String(initialDiamonds);
  updateHudAttempts(attemptsLeft, maxAttempts);
}

function DestroyHud() {
  document.querySelectorAll('.hud-life-panel, .hud-attempts, .hud-resources').forEach((el) => el.remove());
  hud = null;
}

function updateHudHealth(life, maxLife = 1) {
  if (!hud?.healthFill) return;
  const percentage = Math.max(0, Math.min(100, (life / (maxLife || 1)) * 100));
  hud.healthFill.style.width = `${percentage}%`;
}

function updateHudEnergy(currentEnergy, maxEnergy = 1) {
  if (!hud?.energyFill) return;
  const percentage = Math.max(0, Math.min(100, (currentEnergy / (maxEnergy || 1)) * 100));
  hud.energyFill.style.width = `${percentage}%`;
}

function shakeHudEnergy() {
  if (!hud?.energyBar) return;
  // Reinicia a animação mesmo em ataques "a seco" consecutivos: sem tirar
  // a classe e forçar reflow, o CSS ignora reaplicar a mesma classe já
  // ativa e a barra não treme de novo.
  hud.energyBar.classList.remove('energy-bar--shake');
  void hud.energyBar.offsetWidth;
  hud.energyBar.classList.add('energy-bar--shake');
}

function updateHudCoins(totalCoins) {
  if (!hud?.coinTotal) return;
  hud.coinTotal.textContent = String(totalCoins);
}

function updateHudDiamonds(totalDiamonds) {
  if (!hud?.diamondTotal) return;
  hud.diamondTotal.textContent = String(totalDiamonds);
}

// "X/Y" de tentativas restantes na fase (ver GameScene.attemptsLeft/
// MAX_RUN_ATTEMPTS em constants.js) — fica entre a vida e os recursos.
function updateHudAttempts(attemptsLeft, maxAttempts) {
  if (!hud?.attemptsCurrent) return;
  hud.attemptsCurrent.textContent = String(attemptsLeft);
  hud.attemptsMax.textContent = String(maxAttempts);
}

// Liga o HUD ao EventEmitter global do jogo. Chame uma vez por Phaser.Game
// (main.js chama a cada startMatch, um Game novo por partida). Idempotente:
// chamar de novo com o mesmo `game` não duplica listeners.
export function BindHudEvents(game) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  game.events.on(HUD_EVENTS.RESET, CreateHud);
  game.events.on(HUD_EVENTS.HEALTH_CHANGED, updateHudHealth);
  game.events.on(HUD_EVENTS.ENERGY_CHANGED, updateHudEnergy);
  game.events.on(HUD_EVENTS.ENERGY_EMPTY, shakeHudEnergy);
  game.events.on(HUD_EVENTS.COINS_CHANGED, updateHudCoins);
  game.events.on(HUD_EVENTS.DIAMONDS_CHANGED, updateHudDiamonds);
  game.events.on(HUD_EVENTS.ATTEMPTS_CHANGED, updateHudAttempts);
  // Phaser emite 'destroy' no próprio game.events quando game.destroy() é
  // chamado (ver regra de ciclo de vida no CLAUDE.md: ao voltar pros menus
  // HTML, destruir o Phaser deve limpar o HUD junto).
  game.events.on('destroy', DestroyHud);
}
