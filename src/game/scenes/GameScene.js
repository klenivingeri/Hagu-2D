import Phaser from 'phaser';
import { MAPS, DEFAULT_MAP_KEY } from '../config/maps.js';
import { HUD_EVENTS, LOADING_EVENTS, RUN_EVENTS } from '../../constants.js';
import { gameState, unlockMap } from '../../managers/GameManager.js';
import { getVirtualFrame } from '../commons/textureUtils.js';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations, setupPlayerDamage, damagePlayer } from '../systems/create/createPlayer.js';
import { createEnemys, preloadEnemyAssets, createEnemyAnimations } from '../systems/create/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/create/createWorld.js';

import { createBulletSystem } from '../systems/create/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemyMovement.js'
import { createRails } from '../systems/create/createRails.js';
import { updateRailMovement } from '../systems/upgrade/updateRailMovement.js';
import { preloadCoinAssets, createCoinAnimations, createCoins } from '../systems/create/createCoins.js';
import { preloadDiamantAssets, createDiamantAnimations, createDiamants } from '../systems/create/createDiamants.js';
import { createLifes } from '../systems/create/createLifes.js';
import { updateGroundFakeVisibility } from '../systems/upgrade/updateGroundFakeVisibility.js';
import { preloadDustTexture } from '../commons/dustTrail.js';
import { preloadPortalAssets, createPortalAnimations, createPortals } from '../systems/create/createPortals.js';
import { createGates } from '../systems/create/createGates.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.mapKey = MAPS[data.mapKey] ? data.mapKey : DEFAULT_MAP_KEY;
    this.mapConfig = MAPS[this.mapKey];
    // Key própria por mapa: cada .tmj precisa do seu slot no cache do Phaser,
    // senão trocar de mapa (scene.restart) reaproveitaria o JSON do mapa
    // anterior em vez de recarregar o novo.
    this.tilemapCacheKey = `tilemap_${this.mapKey}`;
  }

  preload() {
    this.load.image(this.mapConfig.tilesetImageKey, this.mapConfig.tilesetImageUrl);
    this.load.image('background_tileset_image', 'assets/tiledmap/world_tileset_background.png');
    this.load.image('platforms_image', 'assets/tiledmap/platforms.png');
    this.load.image('world_tileset_shadow_16_image', 'assets/tiledmap/world_tileset_shadow_16.png');
    this.load.image('world_tileset_shadow_32_image', 'assets/tiledmap/world_tileset_shadow_32.png');
    this.load.image('world_tileset_32_image', 'assets/tiledmap/world_tileset_32.png');
    this.load.tilemapTiledJSON(this.tilemapCacheKey, this.mapConfig.tilemapUrl);

    // O mapa precisa carregar primeiro para descobrirmos quais mobs existem.
    // O Phaser aceita novos arquivos enquanto o loader ainda está processando.
    this.load.once(`filecomplete-tilemapJSON-${this.tilemapCacheKey}`, (_key, _type, mapData) => {
      this.enemyDefinitions = getEnemyDefinitionsFromMap(mapData);
      this.enemyAssetKeys = this.enemyDefinitions.map(({ key }) => key);
      preloadEnemyAssets(this, this.enemyDefinitions);
      if (mapData?.layers?.some((layer) => layer.name === 'portal')) {
        preloadPortalAssets(this);
      }
    });

    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
    this.load.audio('bullet_effect_1', 'assets/sounds/bullet_effect_6.mp3');
    this.load.audio('dry_fire_1', 'assets/sounds/dry_fire_1.mp3');
    this.load.audio('coin', 'assets/sounds/coin.wav');
    this.load.audio('jump', 'assets/sounds/jump.wav');
    this.load.audio('tap', 'assets/sounds/tap.wav');

    preloadPlayerAssets(this)
    preloadCoinAssets(this)
    preloadDiamantAssets(this)

    // Log de qualquer asset que falhar ao carregar (ajuda a depurar caminhos errados)
    this.load.on('loaderror', (file) => {
      console.error('[Phaser] Falha ao carregar asset:', file.key, file.src);
    });

    // Progresso da tela de loading em HTML (ver /src/screens/LoadingScreen.js).
    this.load.on('progress', (value) => {
      this.game.events.emit(LOADING_EVENTS.PROGRESS, value);
    });
  }

  create() {
    // scene.restart() (respawn via killPlayer) REAPROVEITA esta mesma
    // instância de GameScene — não cria
    // uma nova. Qualquer propriedade que não seja reatribuída aqui em
    // create() sobrevive de um mapa pro outro como "vestígio". runCompleted
    // é a única flag que create() não recria do zero (tudo mais já é
    // reatribuído por createWorld/createPlayer/createPortals/etc. abaixo),
    // então ela precisa ser resetada explicitamente.
    this.runCompleted = false;

    // Gera a textura de 2x2px da poeira uma única vez, antes de qualquer
    // emitDustTrail/emitBulletImpactDust ser chamado.
    preloadDustTexture(this);

    createWorld(this);
    createControls(this);

    createPlayerAnimations(this);
    this.player = createPlayer(this);

    // Cada fase (ver createWorld.js) tem exatamente o tamanho da resolução
    // lógica do jogo (448x448 — ver gameConfig.js), então zoom 1 (default)
    // mostra o mapa inteiro parado, sem follow. Zoom 2 (Configurações, ver
    // WelcomeScreen.js) mostra só 1/4 da fase, e a câmera passa a seguir o
    // player em vez de ficar estática enquadrando tudo.
    const cameraZoom = gameState.settings.cameraZoom || 1;
    this.cameras.main.setZoom(cameraZoom);
    if (cameraZoom > 1) {
      this.cameras.main.startFollow(this.player, true);
    } else {
      this.cameras.main.stopFollow();
    }

    this.game.events.emit(HUD_EVENTS.RESET, {
      coinFrame: getVirtualFrame(this, 'coin', 1, 0, 12, 1),
      initialCoins: this.player.levelCoins,
      initialDiamonds: this.player.levelDiamants,
    });
    this.game.events.emit(HUD_EVENTS.HEALTH_CHANGED, this.player.status.life, gameState.maxlife);
    this.game.events.emit(HUD_EVENTS.AMMO_CHANGED, this.player.status.currentAljavaBullet, this.player.status.AljavaBullet);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    this.bulletSystem = createBulletSystem(this);
    this.damagePlayer = (damage) => damagePlayer(this, damage);

    createDiamantAnimations(this);
    createDiamants(this);
    createLifes(this);

    createEnemyAnimations(this)
    this.enemies = createEnemys(this);
    this.rails = createRails(this)

    if (this.portalLayer) {
      createPortalAnimations(this);
      this.portals = createPortals(this, this.portalLayer);
    } else {
      this.portals = [];
    }
    this.portals.filter((portal) => portal.unlockMapKey).forEach((portal) => {
      this.physics.add.overlap(this.player, portal, () => this.completeRun(portal.unlockMapKey));
    });

    createCoinAnimations(this);
    this.coins = createCoins(this);

    setupPlayerDamage(this, this.player, this.enemies);
    this.gates = createGates(this);

    // Fase montada: esconde a tela de loading em HTML (ver
    // /src/screens/LoadingScreen.js).
    this.game.events.emit(LOADING_EVENTS.COMPLETE);
  }

  update() {
    updatePlayerMovement(this)
    updateGroundFakeVisibility(this);

    // for clássico em vez de getChildren().forEach(...): evita recriar uma
    // arrow function nova a cada chamada de update() (60x/segundo).
    if (this.enemies) {
      const enemyList = this.enemies.getChildren();
      for (let i = 0; i < enemyList.length; i += 1) {
        updateEnemyMovement(this, enemyList[i]);
      }
    }
    if (this.rails) {
      const railList = this.rails.getChildren();
      for (let i = 0; i < railList.length; i += 1) {
        updateRailMovement(this, railList[i]);
      }
    }
    this.bulletSystem.update();
  }

  // Chamado quando o player encosta num portal com "key" (ver
  // createPortals.js). Libera o mapa correspondente, pausa a "Run" e delega
  // a exibição do resumo pra tela de HTML (ver RunSummaryScreen.js) — o
  // Phaser só emite o evento, nunca mexe em DOM (CLAUDE.md regra 1).
  completeRun(unlockMapKey) {
    if (this.runCompleted) return;
    this.runCompleted = true;

    unlockMap(unlockMapKey);
    this.scene.pause();
    this.game.events.emit(RUN_EVENTS.COMPLETE, {
      mapKey: this.mapKey,
      unlockedMapKey: unlockMapKey,
      coins: this.player.levelCoins,
      diamonds: this.player.levelDiamants,
    });
  }
}

function getEnemyDefinitionsFromMap(mapData) {
  const enemyLayer = mapData?.layers?.find((layer) => layer.name === 'enemy');
  return enemyLayer?.objects?.map((object) => {
    const property = object.properties?.find(({ name }) => name === 'key');
    const type = object.properties?.find(({ name }) => name === 'type');
    const path = object.properties?.find(({ name }) => name === 'path');
    return property?.value
      ? { key: property.value, path: path?.value, type: type?.value }
      : null;
  }).filter(Boolean) || [];
}
