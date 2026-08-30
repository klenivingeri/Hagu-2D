// HUD simples em HTML/CSS (fora do canvas do Phaser) para mostrar as vidas do player.
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

  scene.hud = { container: hearts, hearts: heartEls };

  // Garante que some junto quando a cena for desligada/reiniciada
  scene.events.once('shutdown', () => hearts.remove());
  scene.events.once('destroy', () => hearts.remove());
}

// Atualiza os corações preenchidos de acordo com a vida atual.
export function updateHUD(scene, life) {
  if (!scene.hud) return;

  scene.hud.hearts.forEach((heart, index) => {
    heart.classList.toggle('empty', index >= life);
  });
}

const HEART_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 21s-7.5-4.6-10-9.1C0.3 8.3 2 4.5 5.7 4c2-.3 3.8.7 4.9 2.3C11.7 4.7 13.5 3.7 15.5 4c3.7.5 5.4 4.3 3.7 7.9C19.5 16.4 12 21 12 21z"/>
</svg>`;