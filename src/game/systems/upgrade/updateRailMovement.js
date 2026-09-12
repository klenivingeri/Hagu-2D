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
      if (rail.direction === 'up-down') {
        // O Arcade Physics já resolve a colisão vertical. Sincronizar a
        // velocidade evita a disputa entre gravidade, collider e deltaY.
        if (scene.player.body.velocity.y >= 0) {
          scene.player.body.setVelocityY(rail.body.velocity.y);
        }
      } else {
        // IMPORTANTE: usar setVelocityX (não `player.x += deltaX`).
        // O Arcade Physics só resolve colisão de tile no eixo X usando
        // body.deltaX(), que é calculado a partir da integração de
        // velocidade daquele step. Um deslocamento manual de x é
        // re-sincronizado para o body no preUpdate do frame seguinte
        // ANTES do cálculo de prev.x/deltaX, então o Phaser nunca "vê"
        // esse movimento — quando o player está parado (velocity.x = 0)
        // o resultado é atravessar tiles de colisão (ground) como um
        // fantasma. Somando a velocidade do rail à velocidade atual do
        // player (já setada por updatePlayerMovement neste frame),
        // garantimos um deltaX real e a colisão volta a funcionar,
        // igual já acontece no eixo Y.
        scene.player.body.setVelocityX(
          scene.player.body.velocity.x + rail.body.velocity.x
        );
      }
    }
  }
};