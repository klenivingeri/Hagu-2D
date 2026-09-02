import { getEntityAnimationKey } from '../../config/entities.js';
import { emitDustTrail } from '../../commons/dustTrail.js';

export const updatePlayerMovement = (scene) => {
    // Enquanto o player está nascendo (animação "spawn"), ele fica travado:
    // sem correr, pular ou ter o frame trocado por baixo da animação.
    if (scene.player.isSpawning) return;

    const player = scene.player;
    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const wasGrounded = player.body.blocked.down || player.body.touching.down;
    // Ao pousar no topo de um chão/plataforma, a tentativa da parede é
    // reiniciada. Assim, depois de falhar e cair, pode tentar a mesma parede.
    if (wasGrounded) {
        player.lastWallSide = 0;
    }
    const touchingLeftWall = player.body.blocked.left || player.body.touching.left;
    const touchingRightWall = player.body.blocked.right || player.body.touching.right;
    const wallSide = touchingLeftWall ? -1 : touchingRightWall ? 1 : 0;
    const canStickToWall = player.status.isStick
        && !wasGrounded
        && wallSide !== 0
        // Durante o slide atual, continua preso na mesma parede. Depois de
        // sair dela, só pode iniciar outro slide no lado oposto.
        && (player.isWallSliding || player.lastWallSide !== wallSide);
    let startedJump = false;

    // Ao apertar pulo na parede, lança o player para o lado oposto ao contato.
    // O comando é consumido mais abaixo, então continua sendo um pulo por toque.
    if (scene.controlState.jump && canStickToWall) {
        player.setVelocity(
            wallSide === -1 ? player.status.wallJumpHorizontalSpeed : -player.status.wallJumpHorizontalSpeed,
            -player.status.jumpHeight
        );
        player.isWallSliding = false;
        player.isShooting = false;
        player.setFlipX(wallSide === 1);
        scene.lastDirection = wallSide === -1 ? 1 : -1;
        startedJump = true;
    }
    
    // --- Movimento Horizontal ---
    if (!startedJump && left) {
      player.setVelocityX(-player.status.speed);
      player.setFlipX(true); // Vira a imagem para a esquerda
      scene.lastDirection = -1;
    } else if (!startedJump && right) {
      player.setVelocityX(player.status.speed);
      player.setFlipX(false); // Mantém a imagem normal para a direita
      scene.lastDirection = 1;
    } else if (!startedJump) {
      player.setVelocityX(0);
    }

    // Enquanto houver contato lateral e o player estiver no ar, limita a queda.
    // O velocity.y normal continua sendo usado para o salto; apenas a descida
    // fica lenta, permitindo a troca de uma parede para a outra.
    if (canStickToWall && !startedJump) {
        if (!player.isWallSliding) {
            player.lastWallSide = wallSide;
        }
        player.isWallSliding = true;
        if (player.body.velocity.y > player.status.wallSlideSpeed) {
            player.setVelocityY(player.status.wallSlideSpeed);
        }
        if (player.body.velocity.y >= 0) {
          emitDustTrail(scene, player, 'vertical');
        }
    } else if (!canStickToWall) {
        player.isWallSliding = false;
    }

    // --- Movimento de Pulo (Disparo Único Blindado) ---
    // Verificamos se scene.controlState.jump é true (ele é ativado apenas 1 vez por toque ou por clique de tecla)
    if (scene.controlState.jump && wasGrounded) {
      player.setVelocityY(-player.status.jumpHeight);
      player.isShooting = false; // Pulo interrompe o disparo de arco em andamento
      startedJump = true;
      //scene.player.setTexture('run_0'); // Define um frame estático de parado
    }

    // No ar, jump tem prioridade sobre run e idle.
    if (!player.isShooting) {
      const isAirborne = startedJump || !player.body.blocked.down;

      if (player.isWallSliding) {
        const stickAnimation = getEntityAnimationKey(player.entityKey, 'stick');
        if (player.anims.currentAnim?.key !== stickAnimation) {
          player.anims.play(stickAnimation, true);
        }
      } else if (isAirborne) {
        // Evita reiniciar jump a cada frame depois que a animação terminar.
        const jumpAnimation = getEntityAnimationKey(player.entityKey, 'jump');
        if (player.anims.currentAnim?.key !== jumpAnimation) {
          player.anims.play(jumpAnimation, true);
        }
      } else if (left || right) {
        if (wasGrounded) {
          emitDustTrail(scene, player, 'horizontal');
        }
        player.anims.play(getEntityAnimationKey(player.entityKey, 'run'), true);
      } else {
        player.anims.play(getEntityAnimationKey(player.entityKey, 'idle'), true);
      }
    }

    // IMPORTANTE: Consome o comando imediatamente. 
    // Isso garante que mesmo segurando o botão ou a tecla, a flag é apagada no mesmo frame, 
    // exigindo soltar e apertar novamente para um novo pulo.
    scene.controlState.jump = false;
}
