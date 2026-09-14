// ==========================================
// REGISTRO DE MAPAS
// ==========================================
// Para adicionar um novo mapa:
//   1. Exporte o .tmj (Tiled JSON) e o tileset (.png) para public/assets/tiledmap/
//   2. Cadastre uma nova entrada em MAPS, com uma "key" única
//   3. Se for uma fase jogável (aparece na galeria da Welcome), declare
//      "world: { id, name }" e "fase" (número, 0-based). "world.id" agrupa as
//      fases na mesma galeria horizontal; "fase" é a ordem dentro dela. A
//      progressão é sempre sequencial por (world.id, fase) — sem "key" nem
//      grid espacial nenhum, ver getWorldsList()/getNextMapKey() abaixo.
//      map_0 (tutorial) fica de fora disso: não tem world/fase, e é sempre o
//      mapa liberado por padrão junto com a primeira fase da galeria.
//   4. No mapa (Tiled), crie uma camada de objetos chamada "objects" com objetos
//      do tipo (campo "Class"/"Type" no Tiled):
//        - "player" (point)      -> ponto de nascimento do player
//        - "enemy"  (point)      -> ponto(s) de nascimento dos inimigos (pode repetir)
//        - "limit"  (rectangle)  -> quando o inimigo encosta, ele inverte a direção
//        - "jump"   (rectangle)  -> quando o inimigo encosta, ele pula
//        - "dead-zone" (rectangle) -> quando o player/inimigo cai nela, ele "morre"
//          (volta pro ponto de nascimento)
//        - "gate" (rectangle), numa camada de objetos chamada "gate" -> ao
//          encostar, libera de imediato a PRÓXIMA fase da sequência (ver
//          getNextMapKey()). Não precisa de nenhuma propriedade customizada.
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
  tilesetImageUrl: 'assets/tiledmap/world_tileset.png',
};

export const MAPS = {
  map_0: {
    key: 'map_0',
    tile: {
      column: 1,
      row: 1
    },
    tilemapUrl: 'assets/tiledmap/map_0.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_1: {
    key: 'map_forest_1',
    fase: 0,
    world: {
      id: 0,
      name: 'forest',
    },
    tile: {
      column: 0,
      row: 0
    },
    tilemapUrl: 'assets/tiledmap/map_forest_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_2: {
    key: 'map_forest_2',
    world: {
      id: 0,
      name: 'forest',
    },
    fase: 1,
    tile: {
      column: 0,
      row: 0
    },
    tilemapUrl: 'assets/tiledmap/map_forest_2.tmj',
    ...TILESET_DEFAULTS,
  },
  map_forest_3: {
    key: 'map_forest_3',
    world: {
      id: 0,
      name: 'forest',
    },
    fase: 2,
    tile: {
      column: 0,
      row: 0
    },
    tilemapUrl: 'assets/tiledmap/map_forest_3.tmj',
    ...TILESET_DEFAULTS,
  },
  map_desert_1: {
    key: 'map_desert_1',
    world: {
      id: 1,
      name: 'desert',
    },
    fase: 0,
    tile: {
      column: 5,
      row: 1
    },
    tilemapUrl: 'assets/tiledmap/map_desert_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_ice_1: {
    key: 'map_ice_1',
    world: {
      id: 2,
      name: 'ice',
    },
    fase: 0,
    tile: {
      column: 8,
      row: 1
    },
    tilemapUrl: 'assets/tiledmap/map_ice_1.tmj',
    ...TILESET_DEFAULTS,
  },
  map_fire_1: {
    key: 'map_fire_1',
    world: {
      id: 3,
      name: 'fire',
    },
    fase: 0,
    tilemapUrl: 'assets/tiledmap/map_fire_1.tmj',
    tile: {
      column: 3,
      row: 1
    },
    ...TILESET_DEFAULTS,
  },
  map_dungeon_1: {
    key: 'map_dungeon_1',
    // Masmorras têm a própria lista na aba "Masmorra" da Welcome (ver
    // getDungeonsList() abaixo/WelcomeScreen.js) — NÃO usam "world"/"fase":
    // não entram na galeria de progressão principal da aba "Início".
    dungeon: true,
    tile: {
      column: 11,
      row: 1
    },
    tilemapUrl: 'assets/tiledmap/map_dungeon_1.tmj',
    // O .tmj só traz as layers vazias (spawn do player incluso) — o chão é
    // sorteado a cada entrada na fase (ver createProceduralGround.js).
    proceduralGround: true,
    ...TILESET_DEFAULTS,
  },
};

export const DEFAULT_MAP_KEY = 'map_0';

// ==========================================
// MASMORRAS (Welcome > aba "Masmorra")
// ==========================================
// Lista simples (sem world/fase, sem progressão sequencial): qualquer mapa
// com "dungeon: true" aparece aqui, na ordem em que foi cadastrado em MAPS.
export function getDungeonsList() {
  return Object.entries(MAPS)
    .filter(([, config]) => config.dungeon)
    .map(([mapKey]) => mapKey);
}

// ==========================================
// GALERIA DE FASES (Welcome)
// ==========================================
// Só entram aqui os mapas com "world"/"fase" (map_0, o tutorial, fica de
// fora). A ordem de progressão é sempre (world.id, fase) — nada de grid
// espacial nem de propriedade "key" no Tiled.
function getStageEntries() {
  return Object.entries(MAPS)
    .filter(([, config]) => config.world && Number.isInteger(config.fase))
    .map(([mapKey, config]) => ({ mapKey, world: config.world, fase: config.fase }));
}

// [{ id, name, maps: [mapKey, ...] }, ...], ordenado por world.id, com
// "maps" ordenado por "fase" — é a estrutura que a Welcome desenha: uma
// galeria vertical de worlds, cada world com uma galeria horizontal de fases
// (ver WelcomeScreen.js).
export function getWorldsList() {
  const worldsById = new Map();
  getStageEntries().forEach(({ mapKey, world, fase }) => {
    if (!worldsById.has(world.id)) {
      worldsById.set(world.id, { id: world.id, name: world.name, maps: [] });
    }
    worldsById.get(world.id).maps.push({ mapKey, fase });
  });

  return Array.from(worldsById.values())
    .sort((a, b) => a.id - b.id)
    .map((world) => ({
      ...world,
      maps: world.maps.sort((a, b) => a.fase - b.fase).map((entry) => entry.mapKey),
    }));
}

function getFlattenedStageKeys() {
  return getWorldsList().flatMap((world) => world.maps);
}

// Primeira fase de todas (world.id 0, fase 0) — o que o tutorial (map_0)
// libera ao ser concluído, e a seleção inicial da galeria na Welcome.
export const FIRST_STAGE_MAP_KEY = getFlattenedStageKeys()[0] || DEFAULT_MAP_KEY;

// Mapa que a run ATUAL libera ao terminar (ver GameScene.completeRun(),
// createPortals.js e createGates.js): o tutorial sempre libera a primeira
// fase da galeria; qualquer fase libera a próxima da sequência (world.id,
// fase); a última fase de todas não libera mais nada (retorna null).
export function getNextMapKey(mapKey) {
  if (mapKey === DEFAULT_MAP_KEY) return FIRST_STAGE_MAP_KEY;
  const flatKeys = getFlattenedStageKeys();
  const index = flatKeys.indexOf(mapKey);
  if (index === -1) return null;
  return flatKeys[index + 1] || null;
}
