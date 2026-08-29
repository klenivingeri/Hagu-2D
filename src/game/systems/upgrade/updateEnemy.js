import { createEnemy } from "../create/createEnemy";

export const updateEnemyMovement = (scene, enemy) => {
  if (enemy && enemy.active) {
    if (enemy.body.blocked.left) {
      enemy.setVelocityX(100);
      enemy.setFlipX(false); // Olhando para a direita
      enemy.anims.play('enemy_run', true);
    }
    else if (enemy.body.blocked.right) {
      enemy.setVelocityX(-100);
      enemy.setFlipX(true); // Olhando para a esquerda
      enemy.anims.play('enemy_run', true);
    }
  }
  
  // if (!scene.enemy || !scene.enemy.active) {
  //   respawnInimigo(scene);
  // }
}

// const respawnInimigo = (scene) => {
//   // Se já existe um inimigo ativo, não faz nada
//   if (scene.enemy && scene.enemy.active) return;

//   // Se o inimigo antigo ainda existe na memória (mesmo morto), destrói ele de vez primeiro
//   if (scene.enemy) {
//     scene.enemy.destroy();
//   }

//   // Cria o novo
//   scene.enemy = createEnemy(scene);
// }