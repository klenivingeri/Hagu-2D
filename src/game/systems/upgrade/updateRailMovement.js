// systems/upgrade/updateRails.js
export const updateRailMovement = (scene, rail) => {
  if (rail && rail.active) {
    // 1. Inverte apenas ao atingir os limites do mundo Phaser.
    // `touching.left/right` também fica ativo ao encostar no player, então
    // não deve ser usado para decidir a direção do rail.
    if (rail.direction === 'up-down') {
      if (rail.body.blocked.up) {
        rail.body.setVelocity(0, 40);  // Bateu em cima, desce
      } else if (rail.body.blocked.down) {
        rail.body.setVelocity(0, -40); // Bateu embaixo, sobe
      }
    } else if (rail.body.blocked.left) {
      rail.body.setVelocity(40, 0);  // Bateu na esquerda, vai para a direita
    } else if (rail.body.blocked.right) {
      rail.body.setVelocity(-40, 0); // Bateu na direita, vai para a esquerda
    }

    // 2. Lógica para arrastar o player junto se ele estiver em cima
    const playerIsOnTop = scene.player
      && scene.player.body.touching.down
      && rail.body.touching.up;

    if (playerIsOnTop) {
      const deltaX = rail.body.x - rail.body.prev.x;

      if (rail.direction === 'up-down') {
        // O Arcade Physics já resolve a colisão vertical. Sincronizar a
        // velocidade evita a disputa entre gravidade, collider e deltaY.
        if (scene.player.body.velocity.y >= 0) {
          scene.player.body.setVelocityY(rail.body.velocity.y);
        }
      } else {
        // No rail horizontal, carregamos o player junto no eixo X.
        scene.player.x += deltaX;
      }
    }
  }
};
