import { MAP_DEPTHS } from '../../../constants.js';
import { addGlobalDiamant, gameState } from '../../state/gameState.js';
import { animateCollectible, stopCollectibleAnimation } from '../../commons/collectibleAnimation.js';

const DIAMANTS_LAYER_NAME = 'diamants';
const COIN_TILESET_NAME = 'coin';

// A camada usa o tileset coin apenas como marcador de posição. O que aparece
// no jogo é um emoji, conforme solicitado.
export function createDiamants(scene) {
  const map = scene.map;
  if (!map) return null;

  const tileset = map.addTilesetImage(COIN_TILESET_NAME, 'coin');
  const layer = map.createLayer(DIAMANTS_LAYER_NAME, tileset, 0, 0);
  const diamants = scene.physics.add.group({ allowGravity: false, immovable: true });

  if (layer) {
    layer.forEachTile((tile) => {
      if (tile.index === -1) return;
      const diamant = scene.add.text(tile.getCenterX(), tile.getCenterY(), '💎', {
        fontFamily: 'system-ui, sans-serif', fontSize: '10px',
      }).setOrigin(0.5).setDepth(MAP_DEPTHS.DIAMANTS);
      scene.physics.add.existing(diamant);
      diamant.body.setSize(14, 14).setOffset(-7, -7);
      diamants.add(diamant);
      animateCollectible(scene, diamant);
    });
    layer.setVisible(false);
  }

  scene.physics.add.overlap(scene.player, diamants, (_player, diamant) => {
    if (!diamant.active || diamant.isCollecting) return;
    diamant.isCollecting = true;
    diamant.body.enable = false;
    stopCollectibleAnimation(diamant);
    scene.player.levelDiamants = (scene.player.levelDiamants || 0) + 1;
    addGlobalDiamant(1);
    scene.player.status.diamant = gameState.diamant;
    scene.sound.play('coin');
    if (scene.hud?.diamondTotal) scene.hud.diamondTotal.textContent = String(scene.player.levelDiamants);
    scene.tweens.add({ targets: diamant, y: diamant.y - 24, alpha: 0, duration: 360, onComplete: () => diamant.destroy() });
  });

  scene.diamants = diamants;
  return diamants;
}

export function spawnDroppedDiamant(scene, x, y) {
  if (!scene.diamants) return;
  const diamant = scene.add.text(x, y, '💎', { fontFamily: 'system-ui, sans-serif', fontSize: '15px' })
    .setOrigin(0.5).setDepth(MAP_DEPTHS.DIAMANTS);
  scene.physics.add.existing(diamant);
  diamant.body.setAllowGravity(false);
  diamant.body.setSize(14, 14).setOffset(-7, -7);
  scene.diamants.add(diamant);
  animateCollectible(scene, diamant);
}
