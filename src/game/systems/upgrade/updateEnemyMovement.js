export const updateEnemyMovement = (scene, enemy) => {
  if (!enemy || !enemy.active) return;

  // Enquanto está tocando a animação de "esmagado" (stomp) ou "morte"
  // (spark), não deixa a lógica de movimento trocar de volta pra
  // "enemy_run" no meio do caminho.
  if (enemy.isStomped) return;

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
  enemy.anims.play('enemy_run', true);
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