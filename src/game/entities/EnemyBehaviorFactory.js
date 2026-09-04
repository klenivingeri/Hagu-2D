import { patrolBehavior } from './behaviors/patrolBehavior.js';
import { patrolAndShootBehavior } from './behaviors/patrolAndShootBehavior.js';
import { patrolFlyBehavior } from './behaviors/patrolFlyBehavior.js';

// ==========================================
// ENEMY BEHAVIOR FACTORY
// ==========================================
// Registro central das "habilidades"/comportamentos de inimigo. Cada
// behavior é um objeto { init, update, onHit? }:
//   init(scene, enemy)               -> roda 1x, logo após o spawn
//   update(scene, enemy)             -> roda todo frame
//   onHit(scene, enemy, source, dir) -> opcional, roda quando o inimigo
//                                        leva dano (ver EnemyBase.applyDamage)
//
// Pra criar uma habilidade nova:
//   1. Escreva um objeto { init, update } em entities/behaviors/<nome>.js
//   2. Registre ele aqui embaixo, em BEHAVIOR_REGISTRY, com uma chave nova
//   3. Aponte pra essa chave no campo "behavior" do mob em
//      game/config/entities.js (MOBS_CONFIG)
// Nenhum outro arquivo (EnemyFactory, EnemyBase, updateEnemyMovement,
// createEnemy) precisa mudar.
// Contrato de visão (visionRangeTilesWidth/Height/bidirectional): a caixa
// de percepção é a MESMA lógica pra todo mundo (ver EnemyBase.isPlayerInVision).
// O que muda é a REAÇÃO de cada behavior ao ver o player:
//   - patrol_and_shoot -> atira, nunca persegue.
//   - patrol_fly       -> persegue.
// Ao registrar uma behavior nova que usa visão, decida explicitamente se
// ela atira ou persegue — não misture os dois dentro da mesma behavior.
const BEHAVIOR_REGISTRY = {
  patrol: patrolBehavior,
  patrol_and_shoot: patrolAndShootBehavior,
  patrol_fly: patrolFlyBehavior,
};

export const DEFAULT_BEHAVIOR_NAME = 'patrol';

export const EnemyBehaviorFactory = {
  // Cria (resolve) a instância de behavior pra uma chave. Usa "patrol" se
  // a chave não existir ou não vier definida — assim um mob mal
  // configurado no Tiled/MOBS_CONFIG não quebra o jogo.
  create(behaviorName) {
    return BEHAVIOR_REGISTRY[behaviorName] || BEHAVIOR_REGISTRY[DEFAULT_BEHAVIOR_NAME];
  },
};

// Mantido por compatibilidade com quem ainda importar a função antiga.
export function getEnemyBehavior(enemy) {
  return EnemyBehaviorFactory.create(enemy.entityConfig?.behavior);
}
