import { getEntityAnimationKey } from '../../config/entities.js';
import { isKnockedBack, isPlayerInVision, updateVisionDebug } from '../EnemyBase.js';

// ==========================================
// patrol_fly (substitui o antigo aggro_fly)
// ==========================================
// Sem gravidade (setAllowGravity(false) já é feito na spawn via
// config.noGravity). Se `enemy.patrol` for true, fica indo e voltando na
// altura de origem; se false, fica parado na origem. Quando o player entra
// no campo de visão (visionRangeTilesWidth/Height, ver EnemyBase), voa até
// ele; ao perder de vista, volta pra origem.
//
// Ao ser atingido por um bullet, além do knockback genérico (EnemyBase),
// o hook onHit inverte a direção de patrulha — o efeito de "espantar" o
// inimigo, fazendo ele fugir pro lado oposto ao tiro assim que o
// knockback termina.

const FLY_RETURN_EPSILON = 2;

export const patrolFlyBehavior = {
  init(scene, enemy) {
    // Redundante de propósito: mesmo que EnemyBase já desative a
    // gravidade via config.noGravity, reforçamos aqui — assim essa
    // behavior nunca depende só de o MOBS_CONFIG estar com noGravity
    // certo. body.gravity.y também zerado (gravity LOCAL do body, além
    // do allowGravity que só liga/desliga a gravidade do WORLD).
    enemy.body.setAllowGravity(false);
    enemy.body.setGravityY(0);

    enemy.flyOriginX = enemy.x;
    enemy.flyOriginY = enemy.y;
    enemy.flyPatrolDirection = enemy.facingDirection || 1;
    enemy.flyState = enemy.patrol ? 'patrol' : 'idle';
    enemy.setVelocity(enemy.patrol ? enemy.flyPatrolDirection * enemy.status.speed : 0, 0);
    enemy.setFlipX(enemy.flyPatrolDirection < 0);
  },

  update(scene, enemy) {
    if (!enemy.body) return;

    // Enquanto o knockback do hit estiver ativo, deixa a velocidade
    // aplicada pelo EnemyBase em paz (senão o "espantar" nunca aparece,
    // já que este update roda todo frame).
    if (isKnockedBack(scene, enemy)) {
      updatePlayAnimation(enemy);
      return;
    }

    // Qualquer type que não seja patrol_and_shoot persegue ao ver o
    // player (ver contrato em EnemyBase.isPlayerInVision).
    const canSeePlayer = isPlayerInVision(scene, enemy);
    updateVisionDebug(scene, enemy, canSeePlayer);

    const player = scene.player;
    const playerX = player?.body?.center.x ?? player?.x;
    const playerY = player?.body?.center.y ?? player?.y;

    if (canSeePlayer) {
      enemy.flyState = 'chase';
      moveFlyTowards(enemy, playerX, playerY, getFlyChaseSpeed(enemy));
    } else if (enemy.flyState === 'chase' || enemy.flyState === 'returning') {
      enemy.flyState = 'returning';
      const originDx = enemy.flyOriginX - enemy.x;
      const originDy = enemy.flyOriginY - enemy.y;
      if (Math.abs(originDx) <= FLY_RETURN_EPSILON && Math.abs(originDy) <= FLY_RETURN_EPSILON) {
        enemy.setPosition(enemy.flyOriginX, enemy.flyOriginY);
        settleAtOrigin(enemy);
      } else {
        moveFlyTowards(enemy, enemy.flyOriginX, enemy.flyOriginY, enemy.status.speed);
      }
    } else if (enemy.patrol) {
      enemy.flyState = 'patrol';
      enemy.setVelocityX(enemy.flyPatrolDirection * enemy.status.speed);
      enemy.setVelocityY(0);
      if (enemy.body.blocked.left || enemy.body.touching.left) {
        setFlyPatrolDirection(enemy, 1);
      } else if (enemy.body.blocked.right || enemy.body.touching.right) {
        setFlyPatrolDirection(enemy, -1);
      }
      enemy.setY(enemy.flyOriginY);
    } else {
      // idle: patrol=false, sem player à vista. Trava a posição na origem
      // igual o ramo "patrol" faz — sem isso, qualquer resíduo de
      // gravidade/física faz o inimigo "escorregar" devagar sem que nada
      // corrija, já que velocity(0,0) por si só não recoloca a posição.
      enemy.flyState = 'idle';
      enemy.setVelocity(0, 0);
      enemy.setPosition(enemy.flyOriginX, enemy.flyOriginY);
    }

    updatePlayAnimation(enemy);
  },

  // Hook chamado pelo EnemyBase (applyDamage) sempre que esse inimigo leva
  // um hit de bullet. Vira a direção de patrulha pra "fugir" assim que o
  // knockback (velocidade instantânea) terminar.
  onHit(scene, enemy) {
    setFlyPatrolDirection(enemy, -enemy.flyPatrolDirection);
    if (enemy.flyState === 'idle') enemy.flyState = enemy.patrol ? 'patrol' : 'idle';
  },
};

function settleAtOrigin(enemy) {
  if (enemy.patrol) {
    enemy.flyState = 'patrol';
    enemy.setVelocityX(enemy.flyPatrolDirection * enemy.status.speed);
    enemy.setVelocityY(0);
  } else {
    enemy.flyState = 'idle';
    enemy.setVelocity(0, 0);
  }
}

function setFlyPatrolDirection(enemy, direction) {
  enemy.flyPatrolDirection = direction;
  enemy.facingDirection = direction;
  enemy.setVelocityX(direction * enemy.status.speed);
  enemy.setFlipX(direction < 0);
}

function getFlyChaseSpeed(enemy) {
  const configured = Number(enemy.entityConfig?.stats?.chaseSpeed);
  return Math.min(Number.isFinite(configured) && configured > 0 ? configured : 80, 100);
}

function moveFlyTowards(enemy, targetX, targetY, speed) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= FLY_RETURN_EPSILON) {
    enemy.setVelocity(0, 0);
    return;
  }
  enemy.setVelocity((dx / distance) * speed, (dy / distance) * speed);
  if (Math.abs(dx) > 0.5) {
    enemy.facingDirection = dx < 0 ? -1 : 1;
    enemy.setFlipX(dx < 0);
  }
}

function updatePlayAnimation(enemy) {
  if (!enemy.isStomped && !enemy.isAttacking) {
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  }
}
