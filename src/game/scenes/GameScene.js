import Phaser from 'phaser';
import { MAPS, DEFAULT_MAP_KEY } from '../config/maps.js';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations, setupPlayerDamage, damagePlayer } from '../systems/create/createPlayer.js';
import { createHUD, updateHUD } from '../systems/create/createhud.js';
import { createEnemys, preloadEnemyAssets, createEnemyAnimations } from '../systems/create/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/create/createWorld.js';

import { createBulletSystem } from '../systems/create/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemyMovement.js'
import { createRails } from '../systems/create/createRails.js';
import { updateRailMovement } from '../systems/upgrade/updateRailMovement.js';
import { preloadCoinAssets, createCoinAnimations, createCoins } from '../systems/create/createCoins.js';
import { updateGroundFakeVisibility } from '../systems/upgrade/updateGroundFakeVisibility.js';
import { preloadDustTexture } from '../commons/dustTrail.js';
import { preloadPortalAssets, createPortalAnimations, createPortals } from '../systems/create/createPortals.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.mapKey = MAPS[data.mapKey] ? data.mapKey : DEFAULT_MAP_KEY;
    this.mapConfig = MAPS[this.mapKey];
  }

  preload() {
    this.load.image('tileset_image', 'assets/tiledmap/world_tileset.png');
    this.load.image('platforms_image', 'assets/tiledmap/platforms.png');
    this.load.tilemapTiledJSON('mapa_json', 'assets/tiledmap/map_1.tmj');

    // O mapa precisa carregar primeiro para descobrirmos quais mobs existem.
    // O Phaser aceita novos arquivos enquanto o loader ainda está processando.
    this.load.once('filecomplete-tilemapJSON-mapa_json', (_key, _type, mapData) => {
      this.enemyDefinitions = getEnemyDefinitionsFromMap(mapData);
      this.enemyAssetKeys = this.enemyDefinitions.map(({ key }) => key);
      preloadEnemyAssets(this, this.enemyDefinitions);
      if (mapData?.layers?.some((layer) => layer.name === 'portal')) {
        preloadPortalAssets(this);
      }
    });

    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');

    preloadPlayerAssets(this)
    preloadCoinAssets(this)

    // Log de qualquer asset que falhar ao carregar (ajuda a depurar caminhos errados)
    this.load.on('loaderror', (file) => {
      console.error('[Phaser] Falha ao carregar asset:', file.key, file.src);
    });
  }

  create() {
    // Gera a textura de 2x2px da poeira uma única vez, antes de qualquer
    // emitDustTrail/emitBulletImpactDust ser chamado.
    preloadDustTexture(this);

    createWorld(this);
    createControls(this);

    createPlayerAnimations(this);
    this.player = createPlayer(this);

    createHUD(this);
    updateHUD(this, this.player.status.life, this.player.status.totalCoins);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    this.bulletSystem = createBulletSystem(this);
    this.damagePlayer = (damage) => damagePlayer(this, damage);

    createEnemyAnimations(this)
    this.enemies = createEnemys(this);
    this.rails = createRails(this)

    if (this.portalLayer) {
      createPortalAnimations(this);
      this.portals = createPortals(this, this.portalLayer);
    } else {
      this.portals = [];
    }

    createCoinAnimations(this);
    this.coins = createCoins(this);

    setupPlayerDamage(this, this.player, this.enemies);
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
}

function getEnemyDefinitionsFromMap(mapData) {
  const enemyLayer = mapData?.layers?.find((layer) => layer.name === 'enemy');
  return enemyLayer?.objects?.map((object) => {
    const property = object.properties?.find(({ name }) => name === 'key');
    const type = object.properties?.find(({ name }) => name === 'type');
    const path = object.properties?.find(({ name }) => name === 'path');
    const chaser = object.properties?.find(({ name }) => name === 'chaser');
    return property?.value
      ? { key: property.value, path: path?.value, type: type?.value, chaser: chaser?.value }
      : null;
  }).filter(Boolean) || [];
}
