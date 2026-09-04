import { getEntityAnimationKey } from '../../config/entities.js';
import { turnEnemy, isAboutToFall, isKnockedBack, isPlayerInVision, updateVisionDebug } from '../EnemyBase.js';

// ==========================================
// patrol_and_shoot
// ==========================================
// Igual ao patrol (anda, vira em parede/beira de plataforma, respeita
// `enemy.patrol` pra ficar parado), mas também observa o campo de visão
// (`visionRangeTilesWidth`/`visionRangeTilesHeight`/`bidirectional`, ver
// EnemyBase.isPlayerInVision). Quando o player entra na visão, dispara a
// animação de arco e solta um bullet no frame certo.

export const patrolAndShootBehavior = {
  init(scene, enemy) {
    if (enemy.patrol) {
      turnEnemy(enemy, enemy.facingDirection * enemy.status.speed, enemy.facingDirection);
    } else {
      enemy.setVelocityX(0);
    }
    enemy.nextAttackAt = 0;
  },

  update(scene, enemy) {
    if (enemy.patrol && !isKnockedBack(scene, enemy)) {
      if (enemy.body.blocked.left) {
        turnEnemy(enemy, enemy.status.speed, 1);
      } else if (enemy.body.blocked.right) {
        turnEnemy(enemy, -enemy.status.speed, -1);
      } else if (isAboutToFall(scene, enemy)) {
        const goingLeft = enemy.body.velocity.x < 0;
        turnEnemy(enemy, goingLeft ? enemy.status.speed : -enemy.status.speed, goingLeft ? 1 : -1);
      }
    }

    // patrol_and_shoot NUNCA persegue: só usa a visão pra decidir quando
    // atirar (ver contrato em EnemyBase.isPlayerInVision).
    const canSeePlayer = isPlayerInVision(scene, enemy);
    updateVisionDebug(scene, enemy, canSeePlayer);

    if (canSeePlayer && scene.bulletSystem && scene.time.now >= (enemy.nextAttackAt || 0)) {
      fireAtPlayer(scene, enemy);
    }
  },
};

function fireAtPlayer(scene, enemy) {
  enemy.nextAttackAt = scene.time.now + getAttackCooldown(enemy);
  if (enemy.isStomped) return;

  const direction = enemy.facingDirection || 1;
  const bowAnimation = getEntityAnimationKey(enemy.entityKey, 'bow');
  const bowFrame = `${bowAnimation}_3`;

  enemy._onBowFrame = (anim, frame) => {
    if (anim.key === bowAnimation && frame.textureKey === bowFrame) {
      scene.bulletSystem.fireEnemy(enemy, direction);
      enemy.off('animationupdate', enemy._onBowFrame);
    }
  };
  enemy.on('animationupdate', enemy._onBowFrame);
  enemy.anims.play(bowAnimation, true);
  enemy.once(`animationcomplete-${bowAnimation}`, () => {
    enemy.off('animationupdate', enemy._onBowFrame);
    if (enemy.active && !enemy.isStomped) {
      enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
    }
  });
}

function getAttackCooldown(enemy) {
  const cooldown = enemy.entityConfig?.attack?.cooldown;
  return Number.isFinite(Number(cooldown)) ? Math.max(0, Number(cooldown)) : 1500;
}
