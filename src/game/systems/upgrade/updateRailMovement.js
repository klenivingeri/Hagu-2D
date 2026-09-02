// systems/upgrade/updateRails.js
export const updateRailMovement = (scene, rail) => {
  if (rail && rail.active) {
    // 1. Inverte apenas ao atingir os limites do mundo Phaser.
    // `touching.left/right` também fica ativo ao encostar no player, então
    // não deve ser usado para decidir a direção do rail.
    if (rail.body.blocked.left) {
      rail.body.setVelocityX(40);  // Bateu na esquerda, vai para a direita
    } 
    else if (rail.body.blocked.right) {
      rail.body.setVelocityX(-40); // Bateu na direita, vai para a esquerda
    }

    // 2. Lógica para arrastar o player junto se ele estiver em cima
    if (scene.player && scene.player.body.touching.down && rail.body.touching.up) {
      const deltaX = rail.body.x - rail.body.prev.x;
      const deltaY = rail.body.y - rail.body.prev.y;

      scene.player.x += deltaX;
      scene.player.y += deltaY;
    }
  }
};
