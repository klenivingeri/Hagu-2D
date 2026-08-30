export const updatePlayerMovement = (scene) => {
    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    
    // Captura o pulo por teclado ou controle virtual
    const jumpPressed = scene.cursors.up.isDown || scene.keys.W.isDown || scene.spaceKey.isDown || scene.controlState.jump;

    // --- Movimento Horizontal ---
    if (left) {
      scene.player.setVelocityX(-110);
      scene.player.setFlipX(true); // Vira a imagem para a esquerda
      scene.player.anims.play('run', true); // Toca a animação de correr
      scene.lastDirection = -1;
    } else if (right) {
      scene.player.setVelocityX(110);
      scene.player.setFlipX(false); // Mantém a imagem normal para a direita
      scene.player.anims.play('run', true); // Toca a animação de correr
      scene.lastDirection = 1;
    } else {
      scene.player.setVelocityX(0);
      scene.player.setTexture('run_0');
    }

    // --- Movimento de Pulo (Com Consumo de Estado) ---
    if (jumpPressed && scene.player.body.blocked.down) {
      scene.player.setVelocityY(-200);
      scene.player.anims.stop(); 
      scene.player.setTexture('run_0'); // Define um frame estático de parado
    }

    // IMPORTANTE: Limpa o estado do pulo do controle virtual imediatamente 
    // para evitar que o personagem pule sozinho novamente ao tocar o chão.
    scene.controlState.jump = false;
}