import { getEntityAnimationKey } from '../../config/entities.js';

export const updateEnemyMovement = (scene, enemy) => {
  if (!enemy || !enemy.active) return;

  // IMPORTANTE: não colocar um "if (enemy.isStomped) return;" aqui em
  // cima. A colisão física com paredes/plataformas (physics.add.collider)
  // continua acontecendo sozinha o tempo todo, façamos algo ou não — se a
  // gente parar de rodar essa lógica de virar direção enquanto o stomp
  // toca, o inimigo fica "martelando" contra a parede na mesma direção
  // até a animação acabar (foi exatamente esse o bug). Por isso a virada
  // de direção roda sempre; só a ANIMAÇÃO é que fica travada (ver
  // turnEnemy abaixo).
  if (enemy.body.blocked.left) {
    turnEnemy(enemy, 40, false);
  } else if (enemy.body.blocked.right) {
    turnEnemy(enemy, -40, true);
  } else if (isAboutToFall(scene, enemy)) {
    const goingLeft = enemy.body.velocity.x < 0;
    turnEnemy(enemy, goingLeft ? 40 : -40, !goingLeft);
  }
};

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

  const lookAheadX = enemy.body.x + (dir > 0 ? enemy.body.width + 4 : -4);
  const feetY = enemy.body.y + enemy.body.height + 4;

  return !scene.platforms.some((layer) =>
    layer.getTileAtWorldXY(lookAheadX, feetY, true)
  );
}
