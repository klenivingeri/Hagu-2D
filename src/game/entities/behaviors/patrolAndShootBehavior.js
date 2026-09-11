import { getEntityAnimationKey } from '../../config/entities.js';
import { turnEnemy, isAboutToFall, isKnockedBack, isPlayerInVision, updateVisionDebug } from '../EnemyBase.js';

// ==========================================
// patrol_and_shoot
// ==========================================
// patrol_and_shoot NUNCA persegue — só decide COMO fica parado/se move
// enquanto atira, de acordo com `patrol` x `bidirectional`:
//
//   patrol=true,  bidirectional=false -> patrulha normal (anda, vira em
//     parede/beira de plataforma). A visão só existe na frente de quem
//     ele já está olhando, então atira sem parar de patrulhar.
//   patrol=false, bidirectional=false -> fica PARADO (não anda), olhando
//     pra `direction`. Só atira se o player entrar no campo de visão da
//     frente. Toca animação "idle" enquanto não está atirando.
//   patrol=true,  bidirectional=true  -> patrulha normal até o player
//     entrar no campo de visão (frente+trás, já que é bidirectional); aí
//     PARA de andar, VIRA de frente pro player, e atira. Volta a
//     patrulhar quando o player sai da visão.
//   patrol=false, bidirectional=true  -> fica PARADO; ao ver o player
//     (qualquer lado), só VIRA de frente pra ele e atira.
//
// Animação: "idle" enquanto parado (velocidade X = 0), "run" enquanto
// andando — decidido pela velocidade atual, não por um estado separado
// (ver updatePatrolAnimation). "bow" assume que dispara e destrava sozinha
// no fim (isAttacking trava a idle/run enquanto isso).

export const patrolAndShootBehavior = {
  init(scene, enemy) {
    if (enemy.patrol) {
      turnEnemy(enemy, enemy.facingDirection * enemy.status.speed, enemy.facingDirection);
    } else {
      enemy.setVelocityX(0);
      enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'idle'), true);
    }
    enemy.nextAttackAt = 0;
  },

  update(scene, enemy) {
    const canSeePlayer = isPlayerInVision(scene, enemy);
    updateVisionDebug(scene, enemy, canSeePlayer);

    // bidirectional=true + player à vista -> para de patrulhar e vira de
    // frente pro player antes de atirar (funciona tanto patrolando quanto
    // parado; ver cabeçalho do arquivo).
    const mustFacePlayer = enemy.bidirectional && canSeePlayer;

    if (mustFacePlayer) {
      if (enemy.isAttacking || !enemy.patrol) {
        enemy.setVelocityX(0);
      } else if (!isKnockedBack(scene, enemy)) {
        turnEnemy(enemy, enemy.facingDirection * enemy.status.speed, enemy.facingDirection);
      }
    } else if (enemy.patrol && !isKnockedBack(scene, enemy)) {
      if (enemy.body.blocked.left) {
        turnEnemy(enemy, enemy.status.speed, 1);
      } else if (enemy.body.blocked.right) {
        turnEnemy(enemy, -enemy.status.speed, -1);
      } else if (isAboutToFall(scene, enemy)) {
        const goingLeft = enemy.body.velocity.x < 0;
        turnEnemy(enemy, goingLeft ? enemy.status.speed : -enemy.status.speed, goingLeft ? 1 : -1);
      }
    } else if (!enemy.patrol) {
      enemy.setVelocityX(0);
    }

    updatePatrolAnimation(enemy);

    if (canSeePlayer && scene.bulletSystem && scene.time.now >= (enemy.nextAttackAt || 0)) {
      fireAtPlayer(scene, enemy);
    }
  },
};

// Vira o inimigo (sem se mover) na direção de onde o player está — usado
// quando bidirectional=true detecta o player atrás ou na frente.
function faceTowardsPlayer(scene, enemy) {
  const player = scene.player;
  if (!player || !player.body || !enemy.body) return;

  const direction = player.body.center.x < enemy.body.center.x ? -1 : 1;
  enemy.facingDirection = direction;
  enemy.setFlipX(direction < 0);
}

// "idle" parado (velocidade X = 0), "run" andando — nunca mexe na
// animação enquanto está atacando (bow), tombado (stomp) ou morto.
function updatePatrolAnimation(enemy) {
  if (enemy.isStomped || enemy.isAttacking || enemy.isDead) return;
  const animation = enemy.body.velocity.x !== 0 ? 'run' : 'idle';
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, animation), true);
}

function fireAtPlayer(scene, enemy) {
  enemy.nextAttackAt = scene.time.now + getAttackCooldown(enemy);
  if (enemy.isStomped) return;

  const direction = enemy.facingDirection || 1;
  const bowAnimation = getEntityAnimationKey(enemy.entityKey, 'bow');
  // Mob sem animação "bow" (ver MOB_SPRITE_SETS) não pode atirar: sem essa
  // checagem, anims.play() nunca dispara o 'animationcomplete-<key>' que
  // zera isAttacking, e o inimigo fica travado pra sempre no primeiro
  // avistamento do player.
  if (!scene.anims.exists(bowAnimation)) return;

  if (enemy.bidirectional) faceTowardsPlayer(scene, enemy);
  enemy.setVelocityX(0);
  enemy.isAttacking = true;
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
    enemy.isAttacking = false;
    if (enemy.active && !enemy.isStomped) {
      if (enemy.patrol && !isKnockedBack(scene, enemy)) {
        turnEnemy(enemy, enemy.facingDirection * enemy.status.speed, enemy.facingDirection);
      } else {
        updatePatrolAnimation(enemy);
      }
    }
  });
}

function getAttackCooldown(enemy) {
  const cooldown = enemy.entityConfig?.attack?.cooldown;
  return Number.isFinite(Number(cooldown)) ? Math.max(0, Number(cooldown)) : 1500;
}
