// HUD simples em HTML/CSS (fora do canvas do Phaser) para mostrar as vidas do player.
import { getVirtualFrame } from '../../commons/textureUtils.js';

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

  const maxLife = scene.player?.status?.life ?? 3;

  const hearts = document.createElement('div');
  hearts.className = 'hud-hearts';

  const heartEls = [];
  for (let i = 0; i < maxLife; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.innerHTML = HEART_SVG;
    hearts.appendChild(heart);
    heartEls.push(heart);
  }

  gameScreen.appendChild(hearts);

  // Frame 1 da spritesheet coin.png, usando o mesmo recorte virtual do jogo.
  const coinFrame = getVirtualFrame(scene, 'coin', 1, 0, 12, 1);
  const coins = document.createElement('div');
  coins.className = 'hud-coins';
  const coinTotal = document.createElement('span');
  coinTotal.className = 'coin-total';
  coinTotal.textContent = String(scene.player?.status?.totalCoins ?? 0);
  const coinIcon = document.createElement('span');
  coinIcon.className = 'coin-icon';
  coinIcon.dataset.frame = coinFrame;
  coins.append(coinTotal, coinIcon);
  gameScreen.appendChild(coins);

  scene.hud = { container: hearts, hearts: heartEls, coins, coinTotal };

  // Garante que some junto quando a cena for desligada/reiniciada
  scene.events.once('shutdown', () => { hearts.remove(); coins.remove(); });
  scene.events.once('destroy', () => { hearts.remove(); coins.remove(); });
}

// Atualiza os corações preenchidos de acordo com a vida atual.
export function updateHUD(scene, life, totalCoins = scene.player?.status?.totalCoins ?? 0) {
  if (!scene.hud) return;

  scene.hud.hearts.forEach((heart, index) => {
    heart.classList.toggle('empty', index >= life);
  });

  if (scene.hud.coinTotal) scene.hud.coinTotal.textContent = String(totalCoins);
}

const HEART_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 21s-7.5-4.6-10-9.1C0.3 8.3 2 4.5 5.7 4c2-.3 3.8.7 4.9 2.3C11.7 4.7 13.5 3.7 15.5 4c3.7.5 5.4 4.3 3.7 7.9C19.5 16.4 12 21 12 21z"/>
</svg>`;
