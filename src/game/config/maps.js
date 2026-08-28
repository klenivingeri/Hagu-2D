// ==========================================
// REGISTRO DE MAPAS
// ==========================================
// Para adicionar um novo mapa:
//   1. Exporte o .tmj (Tiled JSON) e o tileset (.png) para public/assets/tiledmap/
//   2. Cadastre uma nova entrada aqui, com uma "key" única
//   3. No mapa (Tiled), crie uma camada de objetos chamada "objects" com objetos
//      do tipo (campo "Class"/"Type" no Tiled):
//        - "player" (point)      -> ponto de nascimento do player
//        - "enemy"  (point)      -> ponto(s) de nascimento dos inimigos (pode repetir)
//        - "limit"  (rectangle)  -> quando o inimigo encosta, ele inverte a direção
//        - "jump"   (rectangle)  -> quando o inimigo encosta, ele pula
//        - "dead-zone" (rectangle) -> quando o player/inimigo cai nela, ele "morre"
//          (volta pro ponto de nascimento)
//   4. Nada mais precisa mudar no código: GameScene, createWorld, createPlayer,
//      createEnemy e createZones leem tudo dinamicamente a partir daqui.
export const MAPS = {
  map_1: {
    key: 'map_1',
    tilemapUrl: '/assets/tiledmap/map_1.tmj',
    tilesetName: 'world_tileset', // precisa bater com o nome do tileset dentro do .tmj
    tilesetImageKey: 'world_tileset_image',
    tilesetImageUrl: '/assets/tiledmap/world_tileset.png',
  },

  // Exemplo de como cadastrar o próximo mapa quando ele existir:
  // mapa_2: {
  //   key: 'mapa_2',
  //   tilemapUrl: '/assets/tiledmap/mapa_2.tmj',
  //   tilesetName: 'world_tileset',
  //   tilesetImageKey: 'world_tileset_image',
  //   tilesetImageUrl: '/assets/tiledmap/world_tileset.png',
  // },
};

export const DEFAULT_MAP_KEY = 'map_1';