// HUD simples em HTML/CSS (fora do canvas do Phaser) para mostrar as vidas do player.
import { getVirtualFrame } from '../../commons/textureUtils.js';
import { gameState } from '../../state/gameState.js';

// Cria os corações dinamicamente e injeta dentro do container .game-screen,
// já que ele é a área com a mesma dimensão/posição do jogo.

export function createHUD(scene) {
  const gameScreen = document.querySelector('.game-screen');
  if (!gameScreen) {
    console.warn('[HUD] .game-screen não encontrado no DOM — corações não serão exibidos.');
    return;
  }

  // Evita duplicar o HUD se a cena for reiniciada (scene.restart())
  const existing = gameScreen.querySelector('.hud-hearts');
  if (existing) existing.remove();
  const existingCoins = gameScreen.querySelector('.hud-coins');
  if (existingCoins) existingCoins.remove();
  const existingDiamants = gameScreen.querySelector('.hud-diamants');
  if (existingDiamants) existingDiamants.remove();
  const existingAmmo = gameScreen.querySelector('.ammo-bar');
  if (existingAmmo) existingAmmo.remove();
  const existingLifePanel = gameScreen.querySelector('.hud-life-panel');
  if (existingLifePanel) existingLifePanel.remove();

  const lifePanel = document.createElement('div');
  lifePanel.className = 'hud-life-panel';

  const healthBar = document.createElement('div');
  healthBar.className = 'health-bar';
  const healthFill = document.createElement('div');
  healthFill.className = 'health-fill';
  healthBar.appendChild(healthFill);
  lifePanel.appendChild(healthBar);
  gameScreen.appendChild(lifePanel);

  const ammo = document.createElement('div');
  ammo.className = 'ammo-bar';
  const ammoFill = document.createElement('div');
  ammoFill.className = 'ammo-fill';
  ammo.appendChild(ammoFill);
  lifePanel.appendChild(ammo);

  // Frame 1 da spritesheet coin.png, usando o mesmo recorte virtual do jogo.
  const coinFrame = getVirtualFrame(scene, 'coin', 1, 0, 12, 1);
  const coins = document.createElement('div');
  coins.className = 'hud-coins';
  const coinTotal = document.createElement('span');
  coinTotal.className = 'coin-total';
  coinTotal.textContent = String(scene.player?.levelCoins ?? 0);
  const coinIcon = document.createElement('span');
  coinIcon.className = 'coin-icon';
  coinIcon.dataset.frame = coinFrame;
  coins.append(coinTotal, coinIcon);

  const diamants = document.createElement('div');
  diamants.className = 'hud-diamants';
  const diamondTotal = document.createElement('span');
  diamondTotal.className = 'diamond-total';
  diamondTotal.textContent = String(scene.player?.levelDiamants ?? 0);
  const diamondIcon = document.createElement('span');
  diamondIcon.className = 'diamond-icon';
  diamondIcon.textContent = '💎';
  diamants.append(diamondTotal, diamondIcon);

  const resources = document.createElement('div');
  resources.className = 'hud-resources';
  const separator = document.createElement('span');
  separator.className = 'hud-resource-separator';
  separator.textContent = '|';
  resources.append(diamants, separator, coins);
  gameScreen.appendChild(resources);

  scene.hud = { container: lifePanel, hearts: [], heartSvg: HEART_BLOCK, healthBar, healthFill, ammo, ammoFill, lifePanel, coins, coinTotal, diamants, diamondTotal, resources };
  updateAmmoHUD(scene);

  // Garante que some junto quando a cena for desligada/reiniciada
  scene.events.once('shutdown', () => { lifePanel.remove(); resources.remove(); });
  scene.events.once('destroy', () => { lifePanel.remove(); resources.remove(); });
}

// Atualiza os corações preenchidos de acordo com a vida atual.
export function updateHUD(scene, life, totalCoins = scene.player?.levelCoins ?? 0) {
  if (!scene.hud) return;

  const maxLife = gameState.maxlife || 1;
  if (scene.hud.healthFill) {
    scene.hud.healthFill.style.width = `${Math.max(0, Math.min(100, (life / maxLife) * 100))}%`;
  }

  if (scene.hud.coinTotal) scene.hud.coinTotal.textContent = String(totalCoins);
  if (scene.hud.diamondTotal) scene.hud.diamondTotal.textContent = String(scene.player?.levelDiamants ?? 0);
  updateAmmoHUD(scene);
}

export function updateAmmoHUD(scene) {
  if (!scene.hud?.ammoFill || !scene.player?.status) return;

  const maxAmmo = Number(scene.player.status.AljavaBullet) || 1;
  const currentAmmo = Number(scene.player.status.currentAljavaBullet) || 0;
  const percentage = Math.max(0, Math.min(100, (currentAmmo / maxAmmo) * 100));
  scene.hud.ammoFill.style.width = `${percentage}%`;
}

const HEART_BLOCK = 'aa';
