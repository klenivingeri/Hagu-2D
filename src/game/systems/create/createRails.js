import { getTextureKeyByImageName, getVirtualFrame } from '../../commons/textureUtils.js';
import { getTiledProperty } from '../../commons/tiledUtils.js';

export function createRails(scene) {
  const rails = scene.physics.add.group({
    allowGravity: false,
    immovable: true
  });

  if (!scene.railLayer?.objects) return rails;

  const layerProperties = scene.railLayer.properties;
  const mapData = scene.cache.tilemap.get(scene.tilemapCacheKey)?.data;

  scene.railLayer.objects.forEach((objectData) => {
    // Permite configurar cada rail separadamente. Se o objeto não tiver a
    // propriedade, usa o valor definido na camada como padrão.
    const properties = objectData.properties || [];
    const getRailProperty = (name) =>
      getTiledProperty(properties, name) ?? getTiledProperty(layerProperties, name);
    const direction = getRailProperty('direction') === 'up-down'
      ? 'up-down'
      : 'left-right';
    const imageName = getRailProperty('tile');
    // O tileset dos rails é carregado com uma chave própria no preload.
    // Mantemos esse mapeamento explícito porque o Phaser carrega as imagens
    // como blob: URLs — texture.source[].image.src nunca bate com o nome de
    // arquivo original, então getTextureKeyByImageName não consegue casar
    // "world_tileset.png" e cai no fallback, virando a textura __MISSING.
    const tilesetImageName = scene.mapConfig?.tilesetImageUrl?.split('/').pop();
    const textureKey = imageName === 'platforms.png'
      ? 'platforms_image'
      : imageName === tilesetImageName
        ? scene.mapConfig.tilesetImageKey
        : getTextureKeyByImageName(scene, imageName, 'tileset_image');
    const texture = scene.textures.get(textureKey);
    const tileset = scene.map?.tilesets?.find(({ name, image }) =>
      name === imageName || image === imageName
    );
    const tilesetData = mapData?.tilesets?.find(({ name, image }) =>
      name === imageName || image === imageName
    );
    const totalCols = tilesetData?.columns || tileset?.columns || 16;
    const tileHeight = tilesetData?.tileheight || tileset?.tileHeight;
    const imageHeight = tilesetData?.imageheight || texture?.source?.[0]?.height;
    const totalRows = tileHeight && imageHeight
      ? Math.max(1, Math.floor(imageHeight / tileHeight))
      : 16;

    // As propriedades do Tiled são 1-based: column=1,row=1 é o primeiro tile.
    const column = Number(getRailProperty('column'));
    const row = Number(getRailProperty('row'));
    const col = Number.isInteger(column) ? column - 1 : 0;
    const tileRow = Number.isInteger(row) ? row - 1 : 0;
    const frameName = getVirtualFrame(scene, textureKey, col, tileRow, totalCols, totalRows);
    const width = objectData.width || 16;
    const height = objectData.height || 16;
    const x = objectData.x + width / 2;
    const y = objectData.y - height / 2;

    const rail = scene.add.tileSprite(x, y + 16, width, height, textureKey, frameName);
    scene.physics.add.existing(rail);
    rails.add(rail);

    rail.body.setImmovable(true);
    rail.body.setAllowGravity(false);
    // Faz o rail respeitar os limites físicos definidos para o mundo Phaser.
    // As flags blocked.left/right são usadas por updateRailMovement para
    // inverter o sentido ao alcançar a borda da tela/mapa.
    rail.body.setCollideWorldBounds(true);
    rail.direction = direction;
    if (direction === 'up-down') {
      rail.body.setVelocity(0, 40);
    } else {
      rail.body.setVelocity(40, 0);
    }

    scene.physics.add.collider(rail, scene.limits);
    scene.physics.add.collider(rail, scene.platforms);
    scene.physics.add.collider(rail, scene.player, null, canPlayerLandOnRail);
  });

  return rails;
}

// Rails funcionam como plataformas semissólidas: o player pode atravessá-los
// subindo, mas pousa neles quando está parado ou descendo e vem de cima.
function canPlayerLandOnRail(rail, player) {
  const playerBody = player?.body;
  const railBody = rail?.body;
  if (!playerBody || !railBody) return false;

  // Usa a posição anterior para detectar a passagem pelo topo. A posição
  // atual já pode estar alguns pixels dentro do rail quando o callback roda.
  const previousBottom = playerBody.prev.y + playerBody.height;
  const wasAboveRail = previousBottom <= railBody.top + 4;
  if (!wasAboveRail) return false;

  const isFallingOrStopped = playerBody.velocity.y >= 0;
  const isBeingCarriedByElevator =
    rail.direction === 'up-down'
    && railBody.velocity.y < 0
    && playerBody.velocity.y > -100;

  // Durante o pulo (velocidade bem negativa), atravessa o rail. A velocidade
  // negativa pequena do elevador, porém, não deve cancelar a sustentação.
  return isFallingOrStopped || isBeingCarriedByElevator;
}
