// Nome da camada de tiles "coins" dentro do Tiled (map_1.tmj) e nome do
// tileset associado a ela (também definido no Tiled, apontando pra coin.png).
const COINS_LAYER_NAME = 'coins';
const COIN_TILESET_NAME = 'coin';
const COIN_FRAME_COUNT = 12;

export function preloadCoinAssets(scene) {
  // coin.png tem 12 frames de 16x16 lado a lado (192x16 no total).
  scene.load.spritesheet('coin', 'assets/tiledmap/coin.png', {
    frameWidth: 16,
    frameHeight: 16,
  });
}

export function createCoinAnimations(scene) {
  scene.anims.create({
    key: 'coin',
    frames: scene.anims.generateFrameNumbers('coin', {
      start: 0,
      end: COIN_FRAME_COUNT - 1,
    }),
    frameRate: 12,
    repeat: -1, // moeda fica girando/brilhando em loop
  });
}

// Lê a camada "coins" do tilemap (criada no Tiled) e, para cada tile
// encontrado, cria um sprite animado no lugar. Chame depois de createWorld
// (precisa de scene.map já criado) e de createCoinAnimations.
export function createCoins(scene) {
  const map = scene.map;
  if (!map) return null;

  const coinTileset = map.addTilesetImage(COIN_TILESET_NAME, 'coin');
  const coinsLayer = map.createLayer(COINS_LAYER_NAME, coinTileset, 0, 0);

  const coins = scene.physics.add.group({
    allowGravity: false,
    immovable: true,
  });

  if (coinsLayer) {
    coinsLayer.forEachTile((tile) => {
      if (tile.index === -1) return; // célula vazia, sem coin aqui

      const coinSprite = coins.create(tile.getCenterX(), tile.getCenterY(), 'coin');
      coinSprite.setDepth(4);
      coinSprite.anims.play('coin');
    });

    // A camada de tiles estáticos só serviu pra sabermos onde colocar as
    // moedas. Quem aparece na tela agora são os sprites animados acima.
    coinsLayer.setVisible(false);
  }

  scene.coins = coins;
  return coins;
}
