// Prévia (não-interativa) do mapa selecionado no grid da Welcome — ver
// WelcomeScreen.js. Puro DOM + CSS: busca o .tmj (mesmo JSON que o Phaser
// usa em createWorld.js) e desenha só as camadas de terreno/arte como uma
// <div> por tile, posicionada via background-position no PNG do tileset.
// Nenhum Phaser, nenhum canvas, nenhum collider — é só leitura de dado
// estático e CSS (CLAUDE.md regra 4: Phaser só existe durante a partida).
import { MAPS } from '../game/config/maps.js';
import { MAP_LAYERS } from '../constants.js';

// Só as camadas visuais de terreno — nada de object layers
// (player/enemy/rail/portal/gate) nem das camadas lógicas/de gameplay
// (collisions, dead-zone, limits, coins, diamants, life).
const PREVIEW_LAYER_NAMES = [
  MAP_LAYERS.HORIZON,
  MAP_LAYERS.SKY,
  MAP_LAYERS.FAR_BACKGROUND,
  MAP_LAYERS.NEAR_BECKGROUND,
  MAP_LAYERS.GROUND,
  MAP_LAYERS.GROUND_FAKE,
  MAP_LAYERS.FOREGROUND,
  MAP_LAYERS.OBSTACLES,
  MAP_LAYERS.OVER_PLAYER,
];

const PREVIEW_TILE_PX = 32; // tamanho de exibição de cada tile (upscale do tile original de 16px)
const PREVIEW_FADE_MS = 300;

const mapDataCache = new Map(); // mapKey -> .tmj já parseado, evita refetch ao ir e voltar da mesma fase
let activeMapKey = null;
let requestToken = 0;

async function loadMapData(mapKey) {
  if (mapDataCache.has(mapKey)) return mapDataCache.get(mapKey);

  const response = await fetch(MAPS[mapKey].tilemapUrl);
  const data = await response.json();
  mapDataCache.set(mapKey, data);
  return data;
}

// gids no .tmj são globais (cada tileset ocupa uma faixa a partir do seu
// firstgid) — ordenar do maior firstgid pro menor permite achar, por busca
// linear, o primeiro tileset cujo firstgid é <= o gid procurado.
function sortTilesetsByFirstGidDesc(tilesets) {
  return [...tilesets].sort((a, b) => b.firstgid - a.firstgid);
}

function findTilesetForGid(tilesetsByFirstGidDesc, gid) {
  return tilesetsByFirstGidDesc.find((tileset) => gid >= tileset.firstgid);
}

function createTileElement(tileset, gid, col, row) {
  const localId = gid - tileset.firstgid;
  const columns = tileset.columns || Math.floor(tileset.imagewidth / tileset.tilewidth);
  const tileCol = localId % columns;
  const tileRow = Math.floor(localId / columns);
  const scale = PREVIEW_TILE_PX / tileset.tilewidth;

  const tile = document.createElement('div');
  tile.className = 'stage-preview-tile absolute bg-no-repeat';
  tile.style.left = `${col * PREVIEW_TILE_PX}px`;
  tile.style.top = `${row * PREVIEW_TILE_PX}px`;
  tile.style.width = `${PREVIEW_TILE_PX}px`;
  tile.style.height = `${PREVIEW_TILE_PX}px`;
  tile.style.backgroundImage = `url(/assets/tiledmap/${tileset.image})`;
  tile.style.backgroundPosition = `-${tileCol * PREVIEW_TILE_PX}px -${tileRow * PREVIEW_TILE_PX}px`;
  tile.style.backgroundSize = `${tileset.imagewidth * scale}px ${tileset.imageheight * scale}px`;
  return tile;
}

function renderLayer(fragment, mapData, layerName, tilesetsByFirstGidDesc) {
  const layer = mapData.layers.find((candidate) => candidate.type === 'tilelayer' && candidate.name === layerName);
  if (!layer) return;

  for (let row = 0; row < layer.height; row += 1) {
    for (let col = 0; col < layer.width; col += 1) {
      const gid = layer.data[row * layer.width + col];
      if (!gid) continue; // 0 = tile vazio

      const tileset = findTilesetForGid(tilesetsByFirstGidDesc, gid);
      if (!tileset) continue;

      fragment.append(createTileElement(tileset, gid, col, row));
    }
  }
}

export async function showMapPreview(mapKey, viewport) {
  if (!viewport || !MAPS[mapKey]) return;
  activeMapKey = mapKey;
  const token = ++requestToken;

  const mapData = await loadMapData(mapKey);
  // Trocou de fase (ou a Welcome fechou) antes do fetch voltar: descarta.
  if (token !== requestToken || activeMapKey !== mapKey) return;

  const tilesetsByFirstGidDesc = sortTilesetsByFirstGidDesc(mapData.tilesets);
  const naturalWidth = mapData.width * PREVIEW_TILE_PX;
  const naturalHeight = mapData.height * PREVIEW_TILE_PX;
  // Em portrait, escala pela altura (a largura pode "vazar" pras laterais —
  // o viewport tem overflow-hidden e corta, dando um efeito de cover
  // horizontal sem esmagar o mapa verticalmente). Em landscape a viewport
  // fica baixa e larga — escalar pela altura deixaria o mapa minúsculo, por
  // isso a base vira a largura (agora é a altura que pode vazar/cortar).
  const isLandscape = viewport.clientWidth > viewport.clientHeight;
  const scale = isLandscape
    ? Math.min(1, viewport.clientWidth / naturalWidth)
    : Math.min(1, viewport.clientHeight / naturalHeight);

  const surface = document.createElement('div');
  surface.className = 'stage-preview-surface absolute left-1/2 top-1/2';
  surface.style.width = `${naturalWidth}px`;
  surface.style.height = `${naturalHeight}px`;
  surface.style.transform = `translate(-50%, -50%) scale(${scale})`;
  surface.style.opacity = '0';
  surface.style.transition = `opacity ${PREVIEW_FADE_MS}ms ease`;

  const fragment = document.createDocumentFragment();
  PREVIEW_LAYER_NAMES.forEach((layerName) => renderLayer(fragment, mapData, layerName, tilesetsByFirstGidDesc));
  surface.append(fragment);

  // prepend, não append: o gradiente de escurecimento (ver
  // welcomeScreen.html) precisa continuar por cima dos tiles pra manter o
  // texto da UI legível.
  const previousSurface = viewport.querySelector('.stage-preview-surface');
  viewport.prepend(surface);

  // Crossfade: a nova entra (opacity 0 -> 1) enquanto a anterior sai (1 ->
  // 0) por cima dela, só removendo a antiga depois da transição acabar.
  requestAnimationFrame(() => {
    surface.style.opacity = '1';
  });
  if (previousSurface) {
    previousSurface.style.transition = `opacity ${PREVIEW_FADE_MS}ms ease`;
    previousSurface.style.opacity = '0';
    setTimeout(() => previousSurface.remove(), PREVIEW_FADE_MS);
  }
}

export function updateMapPreview(mapKey, viewport) {
  if (mapKey === activeMapKey) return;
  showMapPreview(mapKey, viewport);
}

export function destroyMapPreview(viewport) {
  activeMapKey = null;
  requestToken += 1;
  viewport?.querySelector('.stage-preview-surface')?.remove();
}
