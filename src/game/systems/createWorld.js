import Phaser from 'phaser';

// Constrói o mundo a partir do mapa Tiled carregado em GameScene.preload()
// (chaves 'mapaDoJogo' e 'world_tileset_image').
export function createWorld(scene) {
  const map = scene.make.tilemap({ key: 'mapaDoJogo' });

  // O nome passado aqui ('world_tileset') precisa ser IGUAL ao nome do
  // tileset dentro do .tmj/.tsx; a chave ('world_tileset_image') precisa
  // ser IGUAL à chave usada em this.load.image(...) no preload().
  const tileset = map.addTilesetImage('world_tileset', 'world_tileset_image');

  // Ordem = ordem de desenho (de trás para frente). Precisa bater com os
  // nomes das camadas criadas no Tiled.
  const layerOrder = [
    'hoziron',
    'sky',
    'far-background',
    'near-beckground',
    'ground',
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
