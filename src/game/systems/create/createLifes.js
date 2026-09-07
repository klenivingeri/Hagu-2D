import { MAP_DEPTHS } from '../../../constants.js';
import { addGlobalMaxLife } from '../../state/gameState.js';
import { animateCollectible, stopCollectibleAnimation } from '../../commons/collectibleAnimation.js';
import { updateHUD } from './createhud.js';

const LIFE_LAYER_NAME = 'life';
const LIFE_TILESET_NAME = 'coin';

export function createLifes(scene) {
  const map = scene.map;
  if (!map) return null;
  const tileset = map.addTilesetImage(LIFE_TILESET_NAME, 'coin');
  const layer = map.createLayer(LIFE_LAYER_NAME, tileset, 0, 0);
  const lifes = scene.physics.add.group({ allowGravity: false, immovable: true });

  if (layer) {
    layer.forEachTile((tile) => {
      if (tile.index === -1) return;
      const life = scene.add.text(tile.getCenterX(), tile.getCenterY(), '❤️', {
        fontFamily: 'system-ui, sans-serif', fontSize: '11px',
      }).setOrigin(0.5).setDepth(MAP_DEPTHS.LIFE);
      scene.physics.add.existing(life);
      life.body.setSize(14, 14).setOffset(-7, -7);
      lifes.add(life);
      animateCollectible(scene, life);
    });
    layer.setVisible(false);
  }

  scene.physics.add.overlap(scene.player, lifes, (_player, life) => {
    if (!life.active || life.isCollecting) return;
    life.isCollecting = true;
    life.body.enable = false;
    stopCollectibleAnimation(life);
    addGlobalMaxLife(1);
    scene.player.status.life += 1;
    updateLifeHUD(scene);
    scene.tweens.add({ targets: life, y: life.y - 24, scaleX: 1.25, scaleY: 1.25, alpha: 0,
      duration: 360, onComplete: () => life.destroy() });
  });

  scene.lifes = lifes;
  return lifes;
}

function updateLifeHUD(scene) {
  if (!scene.hud) return;
  updateHUD(scene, scene.player.status.life);
}
