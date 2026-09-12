import { getEntityAnimationKey } from '../../config/entities.js';
import { turnEnemy, isKnockedBack, patrolGroundTurn, getAttackCooldownMs } from '../EnemyBase.js';

// ==========================================
// patrol
// ==========================================
// Patrulha normal de chão: anda pra frente e vira ao bater em parede ou
// chegar na beira de uma plataforma. Se `enemy.patrol` for false (Object
// Layer: "patrol": false), fica parado no lugar, só olhando pra
// `enemy.direction`.
// Ataque corpo-a-corpo: dispara a animação de ataque quando o player
// chega a `attack.rangePx` (default 6px) de colidir.

const DEFAULT_MELEE_ATTACK_DISTANCE = 6;
const DEFAULT_MELEE_ATTACK_COOLDOWN = 900;

export const patrolBehavior = {
  init(scene, enemy) {
    if (enemy.patrol) {
      turnEnemy(enemy, enemy.facingDirection * enemy.status.speed, enemy.facingDirection);
    } else {
      enemy.setVelocityX(0);
      // Esse type não tem animação de idle própria — mantém o mesmo
      // visual parado/andando de sempre (só a velocidade muda).
      enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
    }
  },

  update(scene, enemy) {
    // IMPORTANTE: não colocar um "if (enemy.isStomped) return;" aqui em
    // cima. A colisão física com paredes/plataformas (physics.add.collider)
    // continua acontecendo sozinha o tempo todo — se a gente parar de virar
    // direção enquanto o stomp toca, o inimigo fica "martelando" contra a
    // parede na mesma direção até a animação acabar. Só a ANIMAÇÃO fica
    // travada (ver turnEnemy em EnemyBase.js).
    if (enemy.patrol && !isKnockedBack(scene, enemy)) {
      patrolGroundTurn(scene, enemy);
    }

    tryMeleeAttack(scene, enemy);
  },
};

function tryMeleeAttack(scene, enemy) {
  if (enemy.isStomped || enemy.isDead || enemy.isAttacking) return;
  if (enemy.entityConfig?.stats?.className !== 'melee') return;

  const attack = enemy.entityConfig?.attack || {};
  const attackDistance = Number.isFinite(Number(attack.rangePx))
    ? Math.max(0, Number(attack.rangePx))
    : DEFAULT_MELEE_ATTACK_DISTANCE;
  const attackCooldown = getAttackCooldownMs(enemy, DEFAULT_MELEE_ATTACK_COOLDOWN);
  if (scene.time.now < (enemy.nextMeleeAttackAt || 0)) return;

  const player = scene.player;
  if (!player || player.isDead || !player.body || !enemy.body) return;

  const sameHeight = enemy.body.bottom > player.body.top && enemy.body.top < player.body.bottom;
  if (!sameHeight) return;

  const playerCenterX = player.body.center.x;
  const enemyCenterX = enemy.body.center.x;
  const direction = playerCenterX < enemyCenterX ? -1 : 1;
  const gap = direction < 0
    ? enemy.body.left - player.body.right
    : player.body.left - enemy.body.right;
  const movingTowardPlayer = Math.sign(enemy.body.velocity.x) === direction || enemy.body.velocity.x === 0;

  if (!movingTowardPlayer || gap > attackDistance) return;

  const animation = getEntityAnimationKey(enemy.entityKey, 'attack');
  if (!scene.anims.exists(animation)) return;

  enemy.isAttacking = true;
  enemy.nextMeleeAttackAt = scene.time.now + attackCooldown;
  enemy.facingDirection = direction;
  enemy.setFlipX(direction < 0);
  enemy.anims.play(animation, true);
  enemy.once(`animationcomplete-${animation}`, () => {
    enemy.isAttacking = false;
    if (enemy.active && !enemy.isStomped && !enemy.isDead) {
      enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
    }
  });
}
