// Chão gerado em tempo de execução para mapas com "proceduralGround: true"
// (ver game/config/maps.js) — a cada scene.restart()/nova partida a
// disposição sai diferente (Math.random()), ao contrário dos demais mapas
// que têm o chão fixo desenhado no .tmj (ver createWorld.js).
const GROUND_TOP_TILE = 1;
const GROUND_FILL_TILE = 17;

const PLATFORM_COUNT_MIN = 4;
const PLATFORM_COUNT_MAX = 8;
const PLATFORM_WIDTH_MIN = 2;
const PLATFORM_WIDTH_MAX = 5;
// Mantém as plataformas longe do topo (fora de visão) e longe do chão base
// (pra não colar nele), sempre deixando espaço de salto acima e abaixo.
const PLATFORM_ROW_MARGIN_TOP = 3;
const PLATFORM_ROW_MARGIN_BOTTOM = 4;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateProceduralGround(map, groundLayer) {
  if (!groundLayer) return;
  const { width, height } = map;

  // Chão base sólido nas duas últimas linhas — garante que a fase nunca
  // fique impossível de completar, mesmo com as plataformas aleatórias acima.
  for (let x = 0; x < width; x += 1) {
    groundLayer.putTileAt(GROUND_TOP_TILE, x, height - 2);
    groundLayer.putTileAt(GROUND_FILL_TILE, x, height - 1);
  }

  const platformCount = randomInt(PLATFORM_COUNT_MIN, PLATFORM_COUNT_MAX);
  for (let i = 0; i < platformCount; i += 1) {
    const platformWidth = randomInt(PLATFORM_WIDTH_MIN, PLATFORM_WIDTH_MAX);
    const row = randomInt(PLATFORM_ROW_MARGIN_TOP, height - PLATFORM_ROW_MARGIN_BOTTOM);
    const col = randomInt(0, width - platformWidth);
    for (let x = col; x < col + platformWidth; x += 1) {
      groundLayer.putTileAt(GROUND_TOP_TILE, x, row);
    }
  }
}
