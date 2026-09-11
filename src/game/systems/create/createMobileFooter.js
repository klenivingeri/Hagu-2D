// Container "fake" de chão, usado só no modo Mobile (cameraZoom === 3,
// fullscreen — ver GameScene.js/applyScaleModeForZoom): os controles
// virtuais viram uma camada flutuante por cima do canvas
// (.game-layout.zoom-3x .controls-panel, ver main.css) e tampam a última
// linha real do mapa assim que a partida começa.
//
// Em vez de aumentar o mapa/mundo físico de verdade, isto estende só os
// BOUNDS DA CÂMERA (nunca physics.world.setBounds, esse continua do
// tamanho real do .tmj — ver createWorld.js) por mais FOOTER_ROWS tiles
// abaixo do mapa, e preenche esse espaço extra repetindo a última linha
// real de tiles do chão (camada "ground") FOOTER_ROWS vezes. Como não tem
// corpo físico nenhum, player/mobs/coletáveis nunca alcançam essa área (o
// chão real continua sendo o limite físico deles) — só a câmera "vê" mais
// longe ali, dando a impressão de que o mapa continua.
//
// Resultado prático: perto do fim do mapa a câmera passa a poder descer
// mais um pouco, empurrando visualmente o chão real pra cima da faixa dos
// controles. Se o player sobe, esse container desce junto (é um objeto de
// mundo normal, scrollFactor 1, dentro de um Container posicionado logo
// abaixo do mapa) — exatamente como o resto do mapa.
import { MAP_LAYERS } from '../../../constants.js';

const FOOTER_ROWS = 4;
// Ordem de "trás pra frente": horizon é o fundo (céu) que aparece atrás do
// chão no mapa de verdade (ver MAP_DEPTHS em constants.js) — repetir só o
// ground deixaria buracos pretos onde a última linha não tem tile de chão.
const FOOTER_SOURCE_LAYERS = [MAP_LAYERS.HORIZON, MAP_LAYERS.GROUND];

// Acha, para um GID global de tile, qual Tileset do Phaser (já carregado
// via map.addTilesetImage em createWorld.js) é o dono dele.
function findTilesetForGid(map, gid) {
  for (let i = 0; i < map.tilesets.length; i += 1) {
    if (map.tilesets[i].containsTileIndex(gid)) return map.tilesets[i];
  }
  return null;
}

// O Phaser não gera frames nomeados por tile na textura do tileset (ele
// calcula as coordenadas na hora de desenhar a tilemap normal) — então pra
// reaproveitar esse mesmo pedaço de imagem num Image comum, registramos um
// frame com Texture.add usando o retângulo de pixel que o próprio Tileset
// já sabe calcular (getTileTextureCoordinates). Cacheado por GID (seenGids)
// pra nunca registrar o mesmo frame duas vezes.
function ensureTileFrame(map, gid, seenGids) {
  const cached = seenGids.get(gid);
  if (cached) return cached;

  const tileset = findTilesetForGid(map, gid);
  if (!tileset || !tileset.image) return null;

  const coords = tileset.getTileTextureCoordinates(gid);
  if (!coords) return null;

  const imageKey = tileset.image.key;
  const frameName = `mobile-footer-tile-${gid}`;
  if (!tileset.image.has(frameName)) {
    tileset.image.add(frameName, 0, coords.x, coords.y, tileset.tileWidth, tileset.tileHeight);
  }

  const result = { imageKey, frameName };
  seenGids.set(gid, result);
  return result;
}

// Monta o Container uma única vez: lê a última linha de cada camada em
// FOOTER_SOURCE_LAYERS (de trás pra frente) e empilha cada uma FOOTER_ROWS
// vezes. Um retângulo preto por baixo de tudo cobre qualquer coluna sem
// tile em nenhuma das camadas (bem raro — bordas/dead-zone do mapa), pra
// nunca deixar "vazar" o fundo do jogo.
function buildFooterContainer(scene, footerHeight) {
  const map = scene.map;
  const tileWidth = map.tileWidth;
  const tileHeight = map.tileHeight;
  const lastRow = map.height - 1;

  const container = scene.add.container(0, map.heightInPixels);

  const background = scene.add.rectangle(0, 0, map.widthInPixels, footerHeight, 0x000000);
  background.setOrigin(0, 0);
  container.add(background);

  const seenGids = new Map();
  FOOTER_SOURCE_LAYERS.forEach((layerName) => {
    const layerData = map.getLayer(layerName);
    const sourceLayer = layerData && layerData.tilemapLayer;
    if (!sourceLayer) return;

    for (let col = 0; col < map.width; col += 1) {
      const tile = sourceLayer.getTileAt(col, lastRow);
      if (!tile || tile.index <= 0) continue;

      const frameInfo = ensureTileFrame(map, tile.index, seenGids);
      if (!frameInfo) continue;

      for (let row = 0; row < FOOTER_ROWS; row += 1) {
        const image = scene.add.image(col * tileWidth, row * tileHeight, frameInfo.imageKey, frameInfo.frameName);
        image.setOrigin(0, 0);
        container.add(image);
      }
    }
  });

  return container;
}

// Chamado em create() (depois de createWorld) e de novo sempre que o modo
// de câmera muda em tempo real (ver GameScene.applyCameraZoom, disparado
// pela tela de Configurações com a run em andamento).
export function applyMobileFooter(scene, isMobileZoom) {
  const map = scene.map;
  if (!map) return;

  const footerHeight = map.tileHeight * FOOTER_ROWS;

  if (!isMobileZoom) {
    if (scene.mobileFooter) scene.mobileFooter.setVisible(false);
    scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    return;
  }

  if (!scene.mobileFooter) {
    scene.mobileFooter = buildFooterContainer(scene, footerHeight);
  }

  scene.mobileFooter.setVisible(true);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels + footerHeight);
}
