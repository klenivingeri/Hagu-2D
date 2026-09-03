import { getEntityAnimationKey } from '../../config/entities.js';

// ==========================================
// COMPORTAMENTOS DE INIMIGO (padrão factory)
// ==========================================
// Cada behavior é um objeto { init, update }:
//   init(scene, enemy)   -> roda 1x, logo depois do inimigo ser criado
//                           (define velocidade/estado inicial)
//   update(scene, enemy) -> roda todo frame, dentro do game loop
//
// updateEnemyMovement.js só faz UMA coisa: descobrir qual behavior o
// inimigo usa (via enemy.entityConfig.behavior, cadastrado no
// MOBS_CONFIG) e chamar o "update" dela. createEnemy.js chama o "init"
// na hora de criar o inimigo. Ou seja, pra dar um comportamento novo a um
// inimigo:
//   1. Escreva um objeto { init, update } aqui embaixo
//   2. Registre ele no ENEMY_BEHAVIORS, com uma chave nova
//   3. Aponte pra essa chave no campo "behavior" do mob, lá no
//      MOBS_CONFIG (game/config/entities.js)
// GameScene, createEnemy e updateEnemyMovement não precisam mudar.

const LOOK_AHEAD_MARGIN = 1; // px que o inimigo "olha" à frente pra detectar beira de plataforma

// --- patrol: anda pra frente e vira ao bater em parede ou chegar na beira
// de uma plataforma. É o comportamento padrão (usado pelo mob_1 hoje).
const patrol = {
  init(scene, enemy) {
    enemy.setVelocityX(-enemy.status.speed);
    enemy.setFlipX(true);
  },

  update(scene, enemy) {
    // IMPORTANTE: não colocar um "if (enemy.isStomped) return;" aqui em
    // cima. A colisão física com paredes/plataformas (physics.add.collider)
    // continua acontecendo sozinha o tempo todo, façamos algo ou não — se a
    // gente parar de rodar essa lógica de virar direção enquanto o stomp
    // toca, o inimigo fica "martelando" contra a parede na mesma direção
    // até a animação acabar (foi exatamente esse o bug). Por isso a virada
    // de direção roda sempre; só a ANIMAÇÃO é que fica travada (ver
    // turnEnemy abaixo).
    if (enemy.body.blocked.left) {
      turnEnemy(enemy, enemy.status.speed, false);
    } else if (enemy.body.blocked.right) {
      turnEnemy(enemy, -enemy.status.speed, true);
    } else if (isAboutToFall(scene, enemy)) {
      const goingLeft = enemy.body.velocity.x < 0;
      turnEnemy(enemy, goingLeft ? enemy.status.speed : -enemy.status.speed, !goingLeft);
    }
  },
};

// --- sentinel: fica parado no lugar, só virando de frente pro player.
// Não anda nem cai de plataforma. Pronto pra usar em qualquer mob (é só
// trocar `behavior: 'patrol'` por `behavior: 'sentinel'` no MOBS_CONFIG) —
// ex: um inimigo estacionário que atira, ou um "boss" que não persegue.
const sentinel = {
  init(scene, enemy) {
    enemy.setVelocityX(0);
  },

  update(scene, enemy) {
    if (scene.player) {
      enemy.setFlipX(scene.player.x < enemy.x);
    }
    if (!enemy.isStomped) {
      enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
    }
  },
};

export const ENEMY_BEHAVIORS = {
  patrol,
  sentinel,
};

// Resolve a behavior de um inimigo já criado (usa 'patrol' se o mob não
// tiver behavior configurada, ou se alguém digitar uma chave inexistente).
export function getEnemyBehavior(enemy) {
  const name = enemy.entityConfig?.behavior;
  return ENEMY_BEHAVIORS[name] || ENEMY_BEHAVIORS.patrol;
}

function turnEnemy(enemy, velocityX, flipX) {
  enemy.setVelocityX(velocityX);
  enemy.setFlipX(flipX);

  // Só troca pra animação de "run" se não estiver no meio de
  // "enemy_stomp"/"enemy_spark" — a direção/velocidade muda de qualquer
  // jeito, mas os frames da animação em andamento não são interrompidos.
  if (!enemy.isStomped) {
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  }
}

// Olha um pouco à frente, na direção do movimento: se não tem chão ali, é beira de plataforma.
function isAboutToFall(scene, enemy) {
  const dir = Math.sign(enemy.body.velocity.x);
  if (dir === 0) return false;

  const lookAheadX = enemy.body.x + (dir > 0 ? enemy.body.width + LOOK_AHEAD_MARGIN : -LOOK_AHEAD_MARGIN);
  const feetY = enemy.body.y + enemy.body.height + LOOK_AHEAD_MARGIN;

  // nonNull=false (padrão) aqui é de propósito: com nonNull=true o Phaser
  // NUNCA devolve null (devolve um tile "fake" com index -1 pra célula
  // vazia), e esse fake também é truthy — um .some() com closure aqui
  // (como era antes) alocava uma função nova por inimigo a cada frame.
  // Loop simples evita essa alocação.
  for (let i = 0; i < scene.platforms.length; i += 1) {
    const tile = scene.platforms[i].getTileAtWorldXY(lookAheadX, feetY);
    if (tile && tile.index !== -1) return false;
  }
  return true;
}
