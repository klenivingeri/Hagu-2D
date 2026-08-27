import { createEnemy } from "../createEnemy";

export const updateEnemyMovement = (scene) => {
  if (scene.enemy && scene.enemy.active) {
    if (scene.enemy.body.blocked.left) {
      scene.enemy.setVelocityX(150);
      scene.enemy.setFlipX(false); // Olhando para a direita
      scene.enemy.anims.play('enemy_run', true);
    }
    else if (scene.enemy.body.blocked.right) {
      scene.enemy.setVelocityX(-150);
      scene.enemy.setFlipX(true); // Olhando para a esquerda
      scene.enemy.anims.play('enemy_run', true);
    }
  }
  
  if (!scene.enemy || !scene.enemy.active) {
    respawnInimigo(scene);
  }
}

const respawnInimigo = (scene) => {
  // Se já existe um inimigo ativo, não faz nada
  if (scene.enemy && scene.enemy.active) return;

  // Se o inimigo antigo ainda existe na memória (mesmo morto), destrói ele de vez primeiro
  if (scene.enemy) {
    scene.enemy.destroy();
  }

  // Cria o novo
  scene.enemy = createEnemy(scene);
}