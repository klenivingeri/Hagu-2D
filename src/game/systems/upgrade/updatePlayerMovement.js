export const updatePlayerMovement = (scene) => {
    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const jump = scene.cursors.up.isDown || scene.keys.W.isDown || scene.spaceKey.isDown || scene.controlState.jump;

    if (left) {
      scene.player.setVelocityX(-200) 
      scene.player.setFlipX(true); // Invira a imagem para a esquerda
      scene.player.anims.play('run', true); // Toca a animação de correr
      scene.lastDirection = -1
    } else if (right) {
      scene.player.setVelocityX(200);
      scene.player.setFlipX(false); // Mantém a imagem normal para a direita
      scene.player.anims.play('run', true); // Toca a animação de correr
      scene.lastDirection = 1
    } else scene.player.setVelocityX(0);

    if (jump && scene.player.body.blocked.down) {
      scene.player.setVelocityY(-200);
      scene.player.anims.stop(); 
      scene.player.setTexture('run_0'); // Define um frame estático de parado
    }
}