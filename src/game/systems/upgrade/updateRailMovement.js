// systems/upgrade/updateRails.js
export const updateRailMovement = (scene, rail) => {
  if (rail && rail.active) {
    // 1. Lógica de bater e voltar (igualzinho ao enemy)
    if (rail.body.blocked.left || rail.body.touching.left) {
      rail.setVelocityX(40);  // Bateu na esquerda, vai para a direita
    } 
    else if (rail.body.blocked.right || rail.body.touching.right) {
      rail.setVelocityX(-40); // Bateu na direita, vai para a esquerda
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