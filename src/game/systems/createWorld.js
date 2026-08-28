
export function createWorld(scene) {
const map = scene.make.tilemap({ key: 'mapa_json' });
  
    // O primeiro argumento é o nome do tileset lá no Tiled.
    // O segundo argumento é a chave da imagem que você definiu no preload.
    const tileset = map.addTilesetImage('world_tileset', 'tileset_image');
  
    // Cria a camada ('ground' é o nome da camada no seu JSON)

  const layerOrder = [
    'horizon',
    'sky',
    'far-background',
    'near-beckground',
    'ground',
    'foreground',
    'obstacles',
    'collisions',
    'over-player',
  ];

  const layers = {};
  layerOrder.forEach((name) => {
    const layer = map.createLayer(name, tileset, 0, 0);
    if (layer) layers[name] = layer;
  });

  // Camadas que servem de chão/plataforma. Ative a colisão nelas por
  // "tudo que não é o tile vazio (-1)".
  const collidableLayers = ['ground', 'obstacles', 'collisions']
    .map((name) => layers[name])
    .filter(Boolean);

  collidableLayers.forEach((layer) => layer.setCollisionByExclusion([-1]));

  // Camada que deve aparecer na frente do player/inimigos/balas.
  if (layers['over-player']) layers['over-player'].setDepth(10);

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Usado por createPlayer/createEnemy para o collider com physics.add.collider(entidade, scene.platforms)
  scene.platforms = collidableLayers;
  scene.map = map;
}
