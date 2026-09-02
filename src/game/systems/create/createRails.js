import { getTextureKeyByImageName, getVirtualFrame } from '../../commons/textureUtils.js';
import { getTiledProperty } from '../../commons/tiledUtils.js';

export function createRails(scene) {
  const rails = scene.physics.add.group({
    allowGravity: false,
    immovable: true
  });

  if (!scene.railLayer?.objects) return rails;

  const layerProperties = scene.railLayer.properties;
  const mapData = scene.cache.tilemap.get('mapa_json')?.data;

  scene.railLayer.objects.forEach((objectData) => {
    // Permite configurar cada rail separadamente. Se o objeto não tiver a
    // propriedade, usa o valor definido na camada como padrão.
    const properties = objectData.properties || [];
    const getRailProperty = (name) =>
      getTiledProperty(properties, name) ?? getTiledProperty(layerProperties, name);
    const imageName = getRailProperty('tile');
    // O tileset dos rails é carregado com uma chave própria no preload.
    // Mantemos esse mapeamento explícito porque o Phaser pode não expor o
    // nome original do arquivo em texture.source[].image.
    const textureKey = imageName === 'platforms.png'
      ? 'platforms_image'
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
    rail.body.setVelocityX(40);

    scene.physics.add.collider(rail, scene.limits);
    scene.physics.add.collider(rail, scene.platforms);
    scene.physics.add.collider(rail, scene.player);
  });

  return rails;
}
