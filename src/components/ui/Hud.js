// HUD em HTML/CSS sobreposto ao canvas (CLAUDE.md / GUIDELINES.md: UI fora
// do Phaser vive aqui, nunca dentro de /src/game/). Este módulo nunca
// importa nada de /src/game/, e o Phaser nunca importa nada daqui — a ponte
// é só o EventEmitter global do jogo (`game.events`), com os nomes de
// evento combinados em HUD_EVENTS (src/constants.js). Ver BindHudEvents(),
// chamada uma única vez em main.js assim que o Phaser.Game é criado.
import hudTemplate from './hud.html?raw';
import { HUD_EVENTS } from '../../constants.js';

let hud = null;
let bound = false;

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

function CreateHud({ initialCoins = 0, initialDiamonds = 0, coinFrame = 0 } = {}) {
  const gameScreen = document.querySelector('.game-screen');
  if (!gameScreen) {
    console.warn('[Hud] .game-screen não encontrado no DOM — HUD não será exibido.');
    return;
  }

  DestroyHud();

  const fragment = parseTemplate(hudTemplate);
  const lifePanel = fragment.querySelector('.hud-life-panel');
  const resources = fragment.querySelector('.hud-resources');
  gameScreen.append(lifePanel, resources);

  hud = {
    lifePanel,
    healthFill: lifePanel.querySelector('.health-fill'),
    ammoFill: lifePanel.querySelector('.ammo-fill'),
    resources,
    coinTotal: resources.querySelector('.coin-total'),
    coinIcon: resources.querySelector('.coin-icon'),
    diamondTotal: resources.querySelector('.diamond-total'),
  };

  hud.coinTotal.textContent = String(initialCoins);
  hud.diamondTotal.textContent = String(initialDiamonds);
  hud.coinIcon.dataset.frame = coinFrame;
}

function DestroyHud() {
  document.querySelectorAll('.hud-life-panel, .hud-resources').forEach((el) => el.remove());
  hud = null;
}

function updateHudHealth(life, maxLife = 1) {
  if (!hud?.healthFill) return;
  const percentage = Math.max(0, Math.min(100, (life / (maxLife || 1)) * 100));
  hud.healthFill.style.width = `${percentage}%`;
}

function updateHudAmmo(currentAmmo, maxAmmo = 1) {
  if (!hud?.ammoFill) return;
  const percentage = Math.max(0, Math.min(100, (currentAmmo / (maxAmmo || 1)) * 100));
  hud.ammoFill.style.width = `${percentage}%`;
}

function updateHudCoins(totalCoins) {
  if (!hud?.coinTotal) return;
  hud.coinTotal.textContent = String(totalCoins);
}

function updateHudDiamonds(totalDiamonds) {
  if (!hud?.diamondTotal) return;
  hud.diamondTotal.textContent = String(totalDiamonds);
}

// Liga o HUD ao EventEmitter global do jogo. Chame uma única vez, assim que
// o Phaser.Game for instanciado (ver main.js). Idempotente: chamar de novo
// com o mesmo `game` não duplica listeners.
export function BindHudEvents(game) {
  if (bound) return;
  bound = true;

  game.events.on(HUD_EVENTS.RESET, CreateHud);
  game.events.on(HUD_EVENTS.HEALTH_CHANGED, updateHudHealth);
  game.events.on(HUD_EVENTS.AMMO_CHANGED, updateHudAmmo);
  game.events.on(HUD_EVENTS.COINS_CHANGED, updateHudCoins);
  game.events.on(HUD_EVENTS.DIAMONDS_CHANGED, updateHudDiamonds);
  // Phaser emite 'destroy' no próprio game.events quando game.destroy() é
  // chamado (ver regra de ciclo de vida no CLAUDE.md: ao voltar pros menus
  // HTML, destruir o Phaser deve limpar o HUD junto).
  game.events.on('destroy', DestroyHud);
}
