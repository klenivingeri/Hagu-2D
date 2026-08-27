import Phaser from 'phaser';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations } from '../systems/create/createPlayer.js';
import { createEnemy, preloadEnemyAssets, createEnemyAnimations } from '../systems/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/createWorld.js';
import { createBulletSystem } from '../systems/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemy.js'


export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

preload() {
    // ==========================================
    // ASSETS LOCAIS
    // public/assets -> /assets
    // ==========================================
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');


    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
    this.load.image('enemy', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');

    preloadEnemyAssets(this)
    preloadPlayerAssets(this)
    this.load.image(
        'world_tileset_image',
        '/assets/tiledmap/world_tileset.png'
    );

    this.load.tilemapTiledJSON(
        'mapaDoJogo',
        '/assets/tiledmap/mapa_1.tmj'
    );

    // Log de qualquer asset que falhar ao carregar (ajuda a depurar caminhos errados)
    this.load.on('loaderror', (file) => {
      console.error('[Phaser] Falha ao carregar asset:', file.key, file.src);
    });
}


  create() {
    let larguraTela = this.scale.width;
    let alturaTela = this.scale.height;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.lastDirection = 1
    this.controlState = { left: false, right: false, jump: false };

    this.add.image(larguraTela / 2, alturaTela / 2, 'sky');
    
    this.player = createPlayer(this)
    createPlayerAnimations(this);

    createControls(this);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    this.bulletSystem = createBulletSystem(this);

    this.enemy = createEnemy(this);
    createEnemyAnimations(this)

  }

  update() { 
    updatePlayerMovement(this)
    updateEnemyMovement(this)
    this.bulletSystem.update();
  }
}
