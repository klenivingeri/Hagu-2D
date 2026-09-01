import { getEntityAnimationKey } from '../../config/entities.js';

export const updatePlayerMovement = (scene) => {
    // Enquanto o player está nascendo (animação "spawn"), ele fica travado:
    // sem correr, pular ou ter o frame trocado por baixo da animação.
    if (scene.player.isSpawning) return;

    const player = scene.player;
    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const wasGrounded = player.body.blocked.down;
    let startedJump = false;
    
    // --- Movimento Horizontal ---
    if (left) {
      player.setVelocityX(-player.status.speed);
      player.setFlipX(true); // Vira a imagem para a esquerda
      scene.lastDirection = -1;
    } else if (right) {
      player.setVelocityX(player.status.speed);
      player.setFlipX(false); // Mantém a imagem normal para a direita
      scene.lastDirection = 1;
    } else {
      player.setVelocityX(0);
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

      if (isAirborne) {
        // Evita reiniciar jump a cada frame depois que a animação terminar.
        const jumpAnimation = getEntityAnimationKey(player.entityKey, 'jump');
        if (player.anims.currentAnim?.key !== jumpAnimation) {
          player.anims.play(jumpAnimation, true);
        }
      } else if (left || right) {
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
