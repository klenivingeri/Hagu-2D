import { EnemyBehaviorFactory } from '../../entities/EnemyBehaviorFactory.js';

// Só descobre qual behavior esse inimigo usa e delega pra ela. Toda a
// lógica de movimento/IA fica em game/entities/behaviors/*.js — ver
// EnemyBehaviorFactory.js pra entender ou registrar um comportamento novo.
export const updateEnemyMovement = (scene, enemy) => {
  if (!enemy || !enemy.active) return;

  const behavior = enemy.behaviorInstance || EnemyBehaviorFactory.create(enemy.entityConfig?.behavior);
  behavior.update(scene, enemy);
};
