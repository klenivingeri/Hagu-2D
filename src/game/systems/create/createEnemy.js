import { resizeCollider } from "./common";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";
import { createEnemyStatus } from "../../config/status.js";
import { MOBS_CONFIG, getEntityAnimationKey } from "../../config/entities.js";
import { getTiledProperty } from "../../commons/tiledUtils.js";

const ENEMY_DAMAGE_COOLDOWN_MS = 300; // tempo sem poder levar outro dano (bullet ou stomp), evita múltiplos hits de uma vez

export function createEnemy(scene) {
  const key = Object.keys(MOBS_CONFIG)[0];
  const config = MOBS_CONFIG[key];
  const enemy = scene.physics.add.sprite(scene.scale.width - 200, scene.scale.height - 200, `${getEntityAnimationKey(key, 'run')}_0`);
  enemy.entityKey = key;
  enemy.entityConfig = config;

  enemy.status = createEnemyStatus(config.stats);
  initEnemyState(enemy);
  enemy.setCollideWorldBounds(true);
  enemy.body.velocity.x = -enemy.status.speed;

  // --- ADICIONE ESTAS DUAS LINHAS AQUI ---
  enemy.setFlipX(true);                // Inicia virado para a esquerda (já que vai para a esquerda)
  enemy.anims.play(getEntityAnimationKey(key, 'run'), true);

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

    const key = getTiledProperty(objectData.properties, 'key')
      || scene.enemyLayer.key || Object.keys(MOBS_CONFIG)[0];
    const config = MOBS_CONFIG[key];
    if (!config) {
      console.warn(`Mob ignorado: não existe configuração para a key "${key}".`);
      return;
    }
    const enemy = scene.physics.add.sprite(x, y, `${getEntityAnimationKey(key, 'run')}_0`);
    enemy.entityKey = key;
    enemy.entityConfig = config;
    enemy.status = createEnemyStatus(config.stats);
    initEnemyState(enemy);
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
        enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
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

// Flags de estado do inimigo. Três coisas independentes, cada uma com uma
// única responsabilidade (é essa mistura que causava o bug de ficar
// "travado" e não virar mais de direção):
//   isStomped    -> só controla ANIMAÇÃO: enquanto true, updateEnemyMovement
//                   não sobrescreve os frames de enemy_stomp/enemy_spark.
//                   Não mexe em velocidade/direção.
//   invulnerable -> só controla DANO: enquanto true (300ms depois do
//                   último hit), bullet e stomp são ignorados. Evita que
//                   vários overlaps no mesmo instante contem como vários
//                   hits de uma vez só.
//   isDead       -> trava PERMANENTE assim que a vida chega a zero: nunca
//                   mais recebe dano (bullet ou stomp), mesmo se por algum
//                   motivo o body ainda estiver habilitado por um frame.
function initEnemyState(enemy) {
  enemy.isStomped = false;
  enemy.invulnerable = false;
  enemy.isDead = false;
}

function bulletDestroy(bullet) {
  // Desativa o tiro
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.setPosition(-1000, -1000);
}

// Dano de tiro (bullet). Só decide a origem do dano — quem realmente
// aplica é applyDamage (evita ter a mesma lógica de cooldown/morte
// duplicada aqui e em stompDamageEnemy).
export function damageEnemy(enemy, damage = 1) {
  applyDamage(enemy, damage, 'bullet');
}

// Dano por "pisão" (stomp - pular em cima do inimigo). Mesma regra de
// cooldown/morte do bullet; a única diferença é que, se o inimigo
// sobreviver, toca a animação "enemy_stomp".
// Usada por createPlayer.js na mecânica de stomp.
export function stompDamageEnemy(enemy, damage = 1) {
  applyDamage(enemy, damage, 'stomp');
}

// Núcleo único de aplicação de dano, usado tanto pelo bullet quanto pelo
// stomp. Centralizar aqui evita que os dois caminhos fiquem com regras
// (cooldown, morte, etc) divergentes/duplicadas.
function applyDamage(enemy, damage, source) {
  if (!enemy || !enemy.active) return;
  if (enemy.isDead) return;        // já morrendo/morto: nunca mais recebe dano
  if (enemy.invulnerable) return;  // ainda no cooldown do último hit

  enemy.status.life -= damage;

  // Cooldown de dano: por ENEMY_DAMAGE_COOLDOWN_MS esse inimigo não pode
  // levar outro hit. Sem isso, o overlap (bullet ou player-em-cima)
  // dispara em vários frames seguidos e contava como vários hits de uma
  // vez só (era a causa do "morre rápido demais"/"trava" antes).
  enemy.invulnerable = true;
  enemy.scene.time.delayedCall(ENEMY_DAMAGE_COOLDOWN_MS, () => {
    if (enemy && enemy.active) {
      enemy.invulnerable = false;
    }
  });

  if (enemy.status.life <= 0) {
    killEnemy(enemy);
    return;
  }

  if (source === 'stomp') {
    playStompAnimation(enemy);
  }
}

// Toca "enemy_stomp" (esmagado, mas vivo). Trava só a ANIMAÇÃO de "run"
// até ela terminar (isStomped) — a velocidade/direção do inimigo não são
// tocadas aqui, então ele continua se deslocando e vira normalmente nas
// bordas/paredes assim que updateEnemyMovement for liberado de novo.
function playStompAnimation(enemy) {
  enemy.isStomped = true;
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'stomp'), true);

  enemy.once(`animationcomplete-${getEntityAnimationKey(enemy.entityKey, 'stomp')}`, () => {
    // Se o inimigo morreu enquanto essa animação ainda tocava (ex: mais
    // um hit chegou assim que o cooldown acabou), quem cuida da animação
    // agora é o killEnemy — não mexe em mais nada aqui.
    if (!enemy.active || enemy.isDead) return;

    enemy.isStomped = false;
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  });
}

// Morte do inimigo, seja por bullet ou por um stomp fatal: toca a
// animação "enemy_spark" e só destrói de fato (enemyDestroy) quando ela
// terminar. Desliga a física NA HORA (não só depois da animação) pra
// garantir que nenhum overlap (bullet ou player) consiga mais atingi-lo
// enquanto ele morre.
function killEnemy(enemy) {
  enemy.isDead = true;
  enemy.isStomped = true; // reaproveita a mesma trava de animação durante a morte
  enemy.setVelocityX(0);
  enemy.body.enable = false;
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'spark'), true);

  enemy.once(`animationcomplete-${getEntityAnimationKey(enemy.entityKey, 'spark')}`, () => {
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
  Object.entries(MOBS_CONFIG).forEach(([key, config]) => {
    preloadAnimations(scene, config.animations.map((animation) => ({
      ...animation, url: `${config.path}${animation.url}`,
    })), key);
  });
}

export function createEnemyAnimations(scene) {
  Object.entries(MOBS_CONFIG).forEach(([key, config]) => {
    createAnimations(scene, config.animations, key);
  });
}
