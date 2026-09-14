import Phaser from 'phaser';

// Barra horizontal branca acima da cabeça do player, mostrando o progresso
// da recarga da aljava (ver spendEnergy em createBulletSystem.js: dispara
// player._reloadTimer quando currentEnergy chega a 0). Só aparece enquanto
// esse timer estiver rodando; some assim que a aljava enche de novo.
const BAR_WIDTH = 10;
const BAR_HEIGHT = 1;
const BAR_OFFSET_Y = 5; // acima da cabeça do player
const BAR_BG_COLOR = 0x1b1b1b;
const BAR_FILL_COLOR = 0xffffff;

export function createReloadBar(scene) {
  const graphics = scene.add.graphics();
  graphics.setDepth(9999);
  graphics.setVisible(false);
  return graphics;
}

export function updateReloadBar(player) {
  const bar = player.reloadBar;
  if (!bar) return;

  const timer = player._reloadTimer;
  if (!timer || player.isDead) {
    bar.setVisible(false);
    return;
  }

  const ratio = Phaser.Math.Clamp(timer.getProgress(), 0, 1);
  const x = player.x - BAR_WIDTH / 2;
  const y = player.body.top - BAR_OFFSET_Y;

  bar.setVisible(true);
  bar.clear();
  bar.fillStyle(BAR_BG_COLOR, 0.8);
  bar.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
  bar.fillStyle(BAR_FILL_COLOR, 1);
  bar.fillRect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT);
}
