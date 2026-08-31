export const updatePlayerMovement = (scene) => {
    // Enquanto o player está nascendo (animação "spawn"), ele fica travado:
    // sem correr, pular ou ter o frame trocado por baixo da animação.
    if (scene.player.isSpawning) return;

    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    
    // --- Movimento Horizontal ---
    if (left) {
      scene.player.setVelocityX(-scene.player.status.speed);
      scene.player.setFlipX(true); // Vira a imagem para a esquerda
      if (!scene.player.isShooting) {
        scene.player.anims.play('run', true); // Toca a animação de correr
      }
      scene.lastDirection = -1;
    } else if (right) {
      scene.player.setVelocityX(scene.player.status.speed);
      scene.player.setFlipX(false); // Mantém a imagem normal para a direita
      if (!scene.player.isShooting) {
        scene.player.anims.play('run', true); // Toca a animação de correr
      }
      scene.lastDirection = 1;
    } else {
      scene.player.setVelocityX(0);
      if (!scene.player.isShooting) {
        scene.player.setTexture('run_0');
      }
    }

    // --- Movimento de Pulo (Disparo Único Blindado) ---
    // Verificamos se scene.controlState.jump é true (ele é ativado apenas 1 vez por toque ou por clique de tecla)
    if (scene.controlState.jump && scene.player.body.blocked.down) {
      scene.player.setVelocityY(-scene.player.status.jumpHeight);
      scene.player.isShooting = false; // Pulo interrompe o disparo de arco em andamento
      scene.player.anims.stop(); 
      scene.player.setTexture('run_0'); // Define um frame estático de parado
    }

    // IMPORTANTE: Consome o comando imediatamente. 
    // Isso garante que mesmo segurando o botão ou a tecla, a flag é apagada no mesmo frame, 
    // exigindo soltar e apertar novamente para um novo pulo.
    scene.controlState.jump = false;
}