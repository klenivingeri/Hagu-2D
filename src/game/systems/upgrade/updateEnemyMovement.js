import { getEnemyBehavior } from './enemyBehaviors.js';

// Só descobre qual behavior esse inimigo usa e delega pra ela. Toda a
// lógica de movimento/IA fica em enemyBehaviors.js — ver esse arquivo pra
// entender ou adicionar um comportamento novo.
export const updateEnemyMovement = (scene, enemy) => {
  if (!enemy || !enemy.active) return;

  getEnemyBehavior(enemy).update(scene, enemy);
};
