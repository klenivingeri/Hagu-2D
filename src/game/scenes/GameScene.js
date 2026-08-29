import Phaser from 'phaser';
import { MAPS, DEFAULT_MAP_KEY } from '../config/maps.js';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations } from '../systems/create/createPlayer.js';
import { createEnemy, createEnemys, preloadEnemyAssets, createEnemyAnimations } from '../systems/create/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/create/createWorld.js';

import { createBulletSystem } from '../systems/create/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemyMovement.js'
import { createRails } from '../systems/create/createRails.js';
import { updateRailMovement } from '../systems/upgrade/updateRailMovement.js';

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
    this.load.tilemapTiledJSON('mapa_json', 'assets/tiledmap/map_1.tmj');

    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');

    preloadEnemyAssets(this)
    preloadPlayerAssets(this)

    // Log de qualquer asset que falhar ao carregar (ajuda a depurar caminhos errados)
    this.load.on('loaderror', (file) => {
      console.error('[Phaser] Falha ao carregar asset:', file.key, file.src);
    });
  }

  create() {
    createWorld(this);
    createControls(this);

    createPlayerAnimations(this);
    this.player = createPlayer(this);


    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    this.bulletSystem = createBulletSystem(this);

    createEnemyAnimations(this)
    this.enemies = createEnemys(this);
    this.rails = createRails(this)

    //this.enemy = createEnemy(this);
  }

  update() {
    updatePlayerMovement(this)
    updateEnemyMovement(this, this.enemy)
    if (this.enemies) {
      this.enemies.getChildren().forEach((enemy) => {
        updateEnemyMovement(this, enemy);
      });
    }
    if (this.rails) {
      this.rails.getChildren().forEach((rail) => {
        updateRailMovement(this, rail);
      });
    }
    this.bulletSystem.update();
  }
}


