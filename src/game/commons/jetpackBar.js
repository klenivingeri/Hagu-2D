import Phaser from 'phaser';

const BAR_WIDTH = 2;
const BAR_OFFSET_X = 5;
const BAR_BG_COLOR = 0x1b1b1b;
const BAR_FULL_COLOR = 0x4fd1ff;
const BAR_LOW_COLOR = 0xff5252;
const LOW_FUEL_RATIO = 0.25;

/**
 * Cria a graphics reaproveitada para desenhar a barra de combustível do
 * jetpack ao lado do player. Fica escondida até o jetpack ser ativado.
 */
export function createJetpackFuelBar(scene) {
  const graphics = scene.add.graphics();
  graphics.setDepth(9999);
  graphics.setVisible(false);
  return graphics;
}

/**
 * Redesenha a barra de combustível seguindo a posição do player.
 * Só fica visível enquanto o jetpack está ativo ou ainda recarregando.
 */
export function updateJetpackFuelBar(player) {
  const bar = player.jetpackFuelBar;
  if (!bar) return;

  const maxFuel = player.status.jetpackFuelMs;
  const shouldShow = player.status.isJetpack
    && !player.isDead
    && (player.isJetpackActive || player.jetpackFuel < maxFuel);

  if (!shouldShow) {
    bar.setVisible(false);
    return;
  }

  const ratio = Phaser.Math.Clamp(player.jetpackFuel / maxFuel, 0, 1);
  const height = player.body.height;
  const filledHeight = height * ratio;
  // Fica sempre atrás do player: olhando pra esquerda (flipX) o "atrás"
  // é o lado direito, olhando pra direita é o lado esquerdo.
  const x = player.flipX
    ? player.body.right + BAR_OFFSET_X
    : player.body.left - BAR_OFFSET_X - BAR_WIDTH;
  const top = player.body.top;

  bar.setVisible(true);
  bar.clear();
  bar.fillStyle(BAR_BG_COLOR, 0.8);
  bar.fillRect(x, top, BAR_WIDTH, height);
  bar.fillStyle(ratio <= LOW_FUEL_RATIO ? BAR_LOW_COLOR : BAR_FULL_COLOR, 1);
  bar.fillRect(x, top + (height - filledHeight), BAR_WIDTH, filledHeight);
}
