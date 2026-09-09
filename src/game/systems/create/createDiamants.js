import { MAP_DEPTHS, HUD_EVENTS } from '../../../constants.js';
import { addGlobalDiamant, gameState } from '../../../managers/GameManager.js';

const DIAMANTS_LAYER_NAME = 'diamants';
const COIN_TILESET_NAME = 'coin';
const DIAMANT_FRAME_COUNT = 12;

export function preloadDiamantAssets(scene) {
  // diamant.png tem 12 frames de 16x16 lado a lado (192x16 no total).
  scene.load.spritesheet('diamant', 'assets/tiledmap/diamant.png', {
    frameWidth: 16,
    frameHeight: 16,
  });
}

export function createDiamantAnimations(scene) {
  scene.anims.create({
    key: 'diamant',
    frames: scene.anims.generateFrameNumbers('diamant', {
      start: 0,
      end: DIAMANT_FRAME_COUNT - 1,
    }),
    frameRate: 12,
    repeat: -1,
  });
}

// Lê a camada "diamants" do tilemap (criada no Tiled) e, para cada tile
// encontrado, cria um sprite animado no lugar. Chame depois de createWorld
// (precisa de scene.map já criado) e de createDiamantAnimations.
export function createDiamants(scene) {
  const map = scene.map;
  if (!map) return null;

  const tileset = map.addTilesetImage(COIN_TILESET_NAME, 'coin');
  const layer = map.createLayer(DIAMANTS_LAYER_NAME, tileset, 0, 0);
  const diamants = scene.physics.add.group({ allowGravity: false, immovable: true });

  if (layer) {
    layer.forEachTile((tile) => {
      if (tile.index === -1) return;

      const diamant = diamants.create(tile.getCenterX(), tile.getCenterY(), 'diamant');
      diamant.setDepth(MAP_DEPTHS.DIAMANTS);
      diamant.body.setSize(8, 12);
      diamant.body.setOffset(4, 2);
      diamant.anims.play('diamant');
    });
    layer.setVisible(false);
  }

  scene.physics.add.overlap(scene.player, diamants, (_player, diamant) => {
    if (!diamant.active || diamant.isCollecting) return;
    diamant.isCollecting = true;
    diamant.body.enable = false;
    scene.player.levelDiamants = (scene.player.levelDiamants || 0) + 1;
    addGlobalDiamant(1);
    scene.player.status.diamant = gameState.diamant;
    scene.sound.play('coin');
    scene.game.events.emit(HUD_EVENTS.DIAMONDS_CHANGED, scene.player.levelDiamants);
    scene.tweens.add({
      targets: diamant,
      y: diamant.y - 24,
      scale: 0.90,
      alpha: 0,
      duration: 360,
      onComplete: () => diamant.destroy(),
    });
  });

  scene.diamants = diamants;
  return diamants;
}

export function spawnDroppedDiamant(scene, x, y) {
  if (!scene.diamants) return;
  const diamant = scene.diamants.create(x, y, 'diamant');
  diamant.setDepth(MAP_DEPTHS.DIAMANTS);
  diamant.body.setAllowGravity(false);
  diamant.body.setSize(8, 12);
  diamant.body.setOffset(4, 2);
  diamant.anims.play('diamant');
}
