import Phaser from 'phaser';
import { MAPS, DEFAULT_MAP_KEY } from '../config/maps.js';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations } from '../systems/create/createPlayer.js';
import { createEnemy, preloadEnemyAssets, createEnemyAnimations } from '../systems/create/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/create/createWorld.js';

import { createBulletSystem } from '../systems/create/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemy.js'


export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.mapKey = MAPS[data.mapKey] ? data.mapKey : DEFAULT_MAP_KEY;
    this.mapConfig = MAPS[this.mapKey];
  }

  preload() {
    // ==========================================
    // MAPA (Tiled) - carregado dinamicamente
    // A entrada usada vem de src/game/config/maps.js (this.mapConfig).
    // Para adicionar um novo mapa, cadastre-o lá; nada aqui precisa mudar.
    // ==========================================
    // Carrega a imagem do tileset
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
    createWorld(this)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.lastDirection = 1
    this.controlState = { left: false, right: false, jump: false };

    this.player = createPlayer(this)
    createPlayerAnimations(this);

    createControls(this);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    this.bulletSystem = createBulletSystem(this);

    this.enemy = createEnemy(this);
    createEnemyAnimations(this)
    //createWorld(this)
  }

  update() {
    updatePlayerMovement(this)
    updateEnemyMovement(this)
    this.bulletSystem.update();
  }
}