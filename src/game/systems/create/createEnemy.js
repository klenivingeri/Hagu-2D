import { resizeCollider } from "./common";
import { ANIME_ENEMY } from "../../config/animations.js";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";
import { createEnemyStatus } from "../../config/status.js";

export function createEnemy(scene) {
  const enemy = scene.physics.add.sprite(scene.scale.width - 200, scene.scale.height - 200, 'enemy_run_0');

  enemy.status = createEnemyStatus();
  enemy.isStomped = false;
  enemy.setCollideWorldBounds(true);
  enemy.body.velocity.x = -enemy.status.speed;

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
      damageEnemy(inimigo, bullet.damage)
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
    enemy.status = createEnemyStatus();
    enemy.isStomped = false;
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
        enemy.body.velocity.x = -enemy.status.speed;
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
      damageEnemy(inimigo, bullet.damage);
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

// Desconta o dano do tiro (status.bulletDamage do player) da vida do
// inimigo. Se isso matar o inimigo, toca a animação de morte (enemy_spark)
// antes de sumir de vez (ver killEnemy).
export function damageEnemy(enemy, damage = 1) {
  if (!enemy || !enemy.active) return;

  enemy.status.life -= damage;

  if (enemy.status.life <= 0) {
    killEnemy(enemy);
  }
}

// Dano por "pisão" (stomp - pular em cima do inimigo).
// - Se o dano NÃO for suficiente pra matar (dano < vida): o inimigo
//   sobrevive, toca a animação "enemy_stomp" (esmagado, mas vivo) e volta
//   a correr normalmente assim que ela terminar.
// - Se o dano for igual ou maior que a vida: o inimigo morre igual a
//   qualquer outra morte (toca "enemy_spark", não "enemy_stomp" — senão a
//   morte cortaria a animação de esmagado no meio).
// Usada por createPlayer.js na mecânica de stomp.
export function stompDamageEnemy(enemy, damage = 1) {
  if (!enemy || !enemy.active) return;

  const willSurvive = damage < enemy.status.life;
  enemy.status.life -= damage;

  if (!willSurvive) {
    killEnemy(enemy);
    return;
  }

  // Trava a animação de "run" até "enemy_stomp" terminar, e para o
  // inimigo no lugar pra não ficar deslizando enquanto é "esmagado".
  enemy.isStomped = true;
  enemy.setVelocityX(0);
  enemy.anims.play('enemy_stomp', true);

  enemy.once('animationcomplete-enemy_stomp', () => {
    enemy.isStomped = false;
  });
}

// Morte do inimigo, seja por bullet ou por um stomp fatal: toca a
// animação "enemy_spark" e só destrói de fato (enemyDestroy) quando ela
// terminar. Desliga a física na hora pra não poder ser atingido de novo
// nem continuar colidindo enquanto a animação de morte roda.
function killEnemy(enemy) {
  enemy.isStomped = true; // trava updateEnemyMovement também durante a morte
  enemy.setVelocityX(0);
  enemy.body.enable = false;
  enemy.anims.play('enemy_spark', true);

  enemy.once('animationcomplete-enemy_spark', () => {
    enemyDestroy(enemy);
  });
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