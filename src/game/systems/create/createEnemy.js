import { resizeCollider } from "./common";
import { ANIME_ENEMY } from "../../config/animations.js";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";

export function createEnemy(scene) {
  const enemy = scene.physics.add.sprite(scene.scale.width - 200, scene.scale.height - 200, 'enemy_run_0');

  enemy.setCollideWorldBounds(true);
  enemy.body.velocity.x = -150;

  // --- ADICIONE ESTAS DUAS LINHAS AQUI ---
  enemy.setFlipX(true);                // Inicia virado para a esquerda (já que vai para a esquerda)
  enemy.anims.play('enemy_run', true); // Já começa animando desde o nascimento

  scene.physics.add.collider(enemy, scene.limits);
  scene.physics.add.collider(enemy, scene.platforms);

  if (scene.inimigoOverlap) {
    scene.inimigoOverlap.destroy(); // Remove o overlap antigo do inimigo morto
  }
  scene.inimigoOverlap = scene.physics.add.overlap(
    scene.bullets,
    enemy,
    (bullet, inimigo) => {
      bulletDestroy(bullet)
      enemyDestroy(inimigo)
    },
    null,
    scene
  );

  return enemy;
}

export function createEnemys(scene){
  const enemies = scene.physics.add.group();
  
  if (!scene.enemyLayer || !scene.enemyLayer.objects) return enemies;

  scene.enemyLayer.objects.forEach((objectData) => {
    const x = objectData.x;
    const y = objectData.y - 10; 

    const enemy = scene.physics.add.sprite(x, y, 'enemy_run_0');
    enemy.setCollideWorldBounds(true);
    
    const {
      newWidth,
      newHeight,
      offsetX,
      offsetY
    } = resizeCollider(enemy)  

    enemy.body.setSize(newWidth, newHeight);
    enemy.body.setOffset(offsetX, offsetY);
    
    // Adiciona as colisões primeiro
    scene.physics.add.collider(enemy, scene.limits);
    scene.physics.add.collider(enemy, scene.platforms);

    // ADICIONE ESTE BLOCO: Garante que a velocidade só é injetada 
    // após o motor do Phaser estabilizar a posição nas camadas
    scene.time.delayedCall(10, () => {
      if (enemy && enemy.active) {
        enemy.body.velocity.x = -50;
        enemy.setFlipX(true);
        enemy.anims.play('enemy_run', true);
      }
    });

    enemies.add(enemy);
  });

  scene.physics.add.overlap(
    scene.bullets,
    enemies,
    (bullet, inimigo) => {
      bulletDestroy(bullet);
      enemyDestroy(inimigo);
    },
    null,
    scene
  );

  return enemies;
}


function bulletDestroy(bullet) {
  // Desativa o tiro
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.setPosition(-1000, -1000);
}

function enemyDestroy (enemy) {
  
  enemy.setActive(false);
  enemy.setVisible(false);
  enemy.body.enable = false; // Desliga a física para ele não colidir mais
  enemy.destroy();
}


export function preloadEnemyAssets(scene) {
  preloadAnimations(scene, ANIME_ENEMY);
}

export function createEnemyAnimations(scene) {
  createAnimations(scene, ANIME_ENEMY);
}