import { MAP_LAYERS, MAP_DEPTHS } from '../../../constants'
import { getTiledProperty } from '../../commons/tiledUtils.js';

export function createWorld(scene) {
const map = scene.make.tilemap({ key: scene.tilemapCacheKey });
const { 
  GROUND,
  GROUND_FAKE,
  OBSTACLES,
  COLLISIONS,
  OVER_PLAYER,
  DEAD_ZONE,
  LIMITS,
  PLAYER,
  ENEMY,
  RAIL,
  GATE
} = MAP_LAYERS
    // O primeiro argumento é o nome do tileset lá no Tiled.
    // O segundo argumento é a chave da imagem que você definiu no preload.
    const worldTileset = map.addTilesetImage(scene.mapConfig.tilesetName, scene.mapConfig.tilesetImageKey);
    const backgroundTileset = map.addTilesetImage(
      'world_tileset_background',
      'background_tileset_image'
    );
    const platformsTileset = map.addTilesetImage('platforms', 'platforms_image');
    const tilesets = [worldTileset, backgroundTileset, platformsTileset].filter(Boolean);
  
    // Cria a camada ('ground' é o nome da camada no seu JSON)

  const layerOrder = Object.values(MAP_LAYERS);

  const layers = {};
  layerOrder.forEach((name) => {
    const layer = map.createLayer(name, tilesets, 0, 0);
    if (layer) layers[name] = layer;
  });

  const enemyObjectLayer = map.getObjectLayer(ENEMY);
  const playerObjectLayer = map.getObjectLayer(PLAYER);
  const railObjectLayer = map.getObjectLayer(RAIL);
  const portalObjectLayer = map.getObjectLayer(MAP_LAYERS.PORTAL);
  const gateObjectLayer = map.getObjectLayer(GATE);

  // Camadas que servem de chão/plataforma. Ative a colisão nelas por
  // "tudo que não é o tile vazio (-1)".
  const collidableLayers = [GROUND, OBSTACLES, COLLISIONS, RAIL]
    .map((name) => layers[name])
    .filter(Boolean);
  collidableLayers.forEach((layer) => layer.setCollisionByExclusion([-1]));

  // A ordem do Tiled é apenas a ordem de criação. Definimos o depth de cada
  // layer para manter a sobreposição mesmo quando sprites são criados depois.
  Object.entries(MAP_DEPTHS).forEach(([layerKey, depth]) => {
    const layerName = MAP_LAYERS[layerKey];
    if (layers[layerName]) layers[layerName].setDepth(depth);
  });

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Usado por createPlayer/createEnemy para o collider com physics.add.collider(entidade, scene.platforms)

  const enemyLimits = layers[LIMITS];
  enemyLimits.setCollisionByExclusion([-1])

  // Habilita overlap (sem bloquear o movimento) na dead-zone, pra detectar
  // quando o player cai nela.
  const deadZone = layers[DEAD_ZONE];
  if (deadZone) deadZone.setCollisionByExclusion([-1]);

  scene.platforms = collidableLayers;
  // Camada visual usada para cobrir a entrada da caverna. Ela não participa
  // da física: sua transparência será controlada pela posição do player.
  scene.groundLayer = layers[GROUND] || null;
  scene.groundFakeLayer = layers[GROUND_FAKE] || null;
  // Apenas esta layer pode ativar a habilidade de grudar na parede.
  scene.obstacles = layers[OBSTACLES] || null;
  scene.deadZoneLayer = deadZone;
  scene.limits = enemyLimits;
  scene.enemyLayer = enemyObjectLayer// Guardamos a referência da camada enemy aqui!
  scene.playerLayer = playerObjectLayer
  if (scene.playerLayer) {
    scene.playerLayer.key = getTiledProperty(playerObjectLayer.properties, 'key');
  }
  scene.railLayer = railObjectLayer
  scene.portalLayer = portalObjectLayer
  scene.gateLayer = gateObjectLayer

  scene.map = map;
}
