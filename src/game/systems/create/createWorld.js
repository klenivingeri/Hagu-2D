import { MAP_LAYERS } from '../../../constants'

export function createWorld(scene) {
const map = scene.make.tilemap({ key: 'mapa_json' });
const { 
  GROUND,
  OBSTACLES,
  COLLISIONS,
  OVER_PLAYER,
  DEAD_ZONE,
  LIMITS,
  PLAYER,
  ENEMY,
  RAIL
} = MAP_LAYERS
    // O primeiro argumento é o nome do tileset lá no Tiled.
    // O segundo argumento é a chave da imagem que você definiu no preload.
    const tileset = map.addTilesetImage('world_tileset', 'tileset_image');
  
    // Cria a camada ('ground' é o nome da camada no seu JSON)

  const layerOrder = Object.values(MAP_LAYERS);

  const layers = {};
  layerOrder.forEach((name) => {
    const layer = map.createLayer(name, tileset, 0, 0);
    if (layer) layers[name] = layer;
  });

  const enemyObjectLayer = map.getObjectLayer(ENEMY);
  const playerObjectLayer = map.getObjectLayer(PLAYER);

  // Camadas que servem de chão/plataforma. Ative a colisão nelas por
  // "tudo que não é o tile vazio (-1)".
  const collidableLayers = [GROUND, OBSTACLES, COLLISIONS, RAIL]
    .map((name) => layers[name])
    .filter(Boolean);
  collidableLayers.forEach((layer) => layer.setCollisionByExclusion([-1]));

  // Camada que deve aparecer na frente do player/inimigos/balas.
  if (layers[OVER_PLAYER]) layers[OVER_PLAYER].setDepth(10);

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Usado por createPlayer/createEnemy para o collider com physics.add.collider(entidade, scene.platforms)

  const enemyLimits = layers[LIMITS];
  enemyLimits.setCollisionByExclusion([-1])

  scene.platforms = collidableLayers;
  scene.deadZoneLayer = layers[DEAD_ZONE];
  scene.limits = enemyLimits;
  scene.enemyLayer = enemyObjectLayer// Guardamos a referência da camada enemy aqui!
  scene.playerLayer = playerObjectLayer

  scene.map = map;
}
