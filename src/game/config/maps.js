// ==========================================
// REGISTRO DE MAPAS
// ==========================================
// Para adicionar um novo mapa:
//   1. Exporte o .tmj (Tiled JSON) e o tileset (.png) para public/assets/tiledmap/
//   2. Cadastre uma nova entrada em MAPS, com uma "key" única
//   3. Posicione essa "key" em MAP_GRID (cada célula é um mapa; null = célula
//      vazia). A posição na matriz define sozinha quem é vizinho de quem
//      (acima/abaixo/esquerda/direita) — não precisa mais declarar "nextMap"
//      manualmente.
//   4. No mapa (Tiled), crie uma camada de objetos chamada "objects" com objetos
//      do tipo (campo "Class"/"Type" no Tiled):
//        - "player" (point)      -> ponto de nascimento do player
//        - "enemy"  (point)      -> ponto(s) de nascimento dos inimigos (pode repetir)
//        - "limit"  (rectangle)  -> quando o inimigo encosta, ele inverte a direção
//        - "jump"   (rectangle)  -> quando o inimigo encosta, ele pula
//        - "dead-zone" (rectangle) -> quando o player/inimigo cai nela, ele "morre"
//          (volta pro ponto de nascimento)
//        - "gate" (rectangle), numa camada de objetos chamada "gate" -> porta que
//          libera o próximo mapa quando o player passa por ela. A propriedade
//          customizada "key" do objeto deve conter a "key" do mapa vizinho que
//          essa porta libera (ex: "map_ice_1"). Ver GameManager.unlockMap().
//   5. Nada mais precisa mudar no código: GameScene, createWorld, createPlayer,
//      createEnemy, createGates e createZones leem tudo dinamicamente a partir
//      daqui.
// Tempo-alvo (ms) pra fase valer as 3 estrelas (ver GameScene.completeRun()).
// Fixo por enquanto pra todo mapa; se algum mapa precisar de um valor
// próprio, basta sobrescrever "starTimeLimitMs" na entrada dele em MAPS.
export const DEFAULT_STAR_TIME_LIMIT_MS = 90000;

const TILESET_DEFAULTS = {
  tilesetName: 'world_tileset', // precisa bater com o nome do tileset dentro do .tmj
  tilesetImageKey: 'world_tileset_image',
  tilesetImageUrl: '/assets/tiledmap/world_tileset.png',
};

export const MAPS = {
  map_0: {
    key: 'map_0',
    tilemapUrl: '/assets/tiledmap/map_0.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_1: {
    key: 'map_forest_1',
    tilemapUrl: '/assets/tiledmap/map_forest_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_2: {
    key: 'map_forest_2',
    tilemapUrl: '/assets/tiledmap/map_forest_2.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_3: {
    key: 'map_forest_3',
    tilemapUrl: '/assets/tiledmap/map_forest_3.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_4: {
    key: 'map_forest_3',
    tilemapUrl: '/assets/tiledmap/map_forest_3.tmj',
    ...TILESET_DEFAULTS,
  },
  map_desert_1: {
    key: 'map_desert_1',
    tilemapUrl: '/assets/tiledmap/map_desert_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_desert_2: {
    key: 'map_desert_2',
    tilemapUrl: '/assets/tiledmap/map_desert_2.tmj',
    ...TILESET_DEFAULTS,
  },
  map_ice_1: {
    key: 'map_ice_1',
    tilemapUrl: '/assets/tiledmap/map_ice_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_ice_2: {
    key: 'map_ice_2',
    tilemapUrl: '/assets/tiledmap/map_ice_2.tmj',
    ...TILESET_DEFAULTS,
  },
  map_fire_1: {
    key: 'map_fire_1',
    tilemapUrl: '/assets/tiledmap/map_fire_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_fire_2: {
    key: 'map_fire_2',
    tilemapUrl: '/assets/tiledmap/map_fire_2.tmj',
    ...TILESET_DEFAULTS,
  },
};

// ==========================================
// GRID DO MUNDO
// ==========================================
// Cada célula é uma "key" de MAPS (ou null pra célula vazia). A posição na
// matriz é que determina os vizinhos: subir uma linha = "up", descer uma
// linha = "down", andar uma coluna = "left"/"right". map_0 é o hub central;
// gelo/fogo esticam pra cima/baixo, floresta/deserto esticam pros lados.
export const MAP_GRID = [
  ['map_forest_4',           null,           'map_ice_2',    null,            null],
  ['map_forest_3',           null,           'map_ice_1',    null,            null],
  ['map_forest_2', 'map_forest_1', 'map_0',        'map_desert_1',  'map_desert_2'],
  [null,           null,           'map_fire_1',   null,            null],
  [null,           null,           'map_fire_2',   null,            null],
];

export const DEFAULT_MAP_KEY = 'map_0';

// Acha [row, col] de uma map key dentro de MAP_GRID.
function findMapPosition(mapKey) {
  for (let row = 0; row < MAP_GRID.length; row += 1) {
    const col = MAP_GRID[row].indexOf(mapKey);
    if (col !== -1) return { row, col };
  }
  return null;
}

// Retorna { up, down, left, right }, cada um com a "key" do mapa vizinho
// (ou null se não houver mapa naquela direção). "up"/"down" seguem o sentido
// visual: "up" é a linha de cima (fica acima do mapa atual).
export function getMapNeighbors(mapKey) {
  const position = findMapPosition(mapKey);
  const neighbors = { up: null, down: null, left: null, right: null };
  if (!position) return neighbors;

  const { row, col } = position;
  neighbors.up = MAP_GRID[row - 1]?.[col] || null;
  neighbors.down = MAP_GRID[row + 1]?.[col] || null;
  neighbors.left = MAP_GRID[row]?.[col - 1] || null;
  neighbors.right = MAP_GRID[row]?.[col + 1] || null;
  return neighbors;
}

// A "key" que a porta (camada de objetos "gate") precisa ter no Tiled pra
// liberar o mapa vizinho é a própria key do mapa vizinho — não existe
// indireção nenhuma: quem quiser liberar "map_ice_1" cria, no mapa atual,
// uma porta com a propriedade key = "map_ice_1".
export function getGateKeyToUnlock(neighborMapKey) {
  return neighborMapKey;
}
