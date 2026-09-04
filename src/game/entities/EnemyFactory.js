import { spawnEnemyBase } from './EnemyBase.js';
import { EnemyBehaviorFactory } from './EnemyBehaviorFactory.js';
import { getTiledProperty } from '../commons/tiledUtils.js';
import { DEFAULT_MOB_KEY, DEFAULT_MOB_TYPE } from '../config/entities.js';

// ==========================================
// ENEMY FACTORY
// ==========================================
// Ponto ÚNICO de criação de um inimigo "pronto pra jogar" (sprite + física
// + status + behavior). Decoupla "de onde vêm os dados" (hoje: Object
// Layer "enemy" do Tiled) de "como o inimigo é montado" (EnemyBase) e
// "como ele se comporta" (EnemyBehaviorFactory).
//
// createEnemy.js (createEnemys) só lê a camada do Tiled e chama
// EnemyFactory.createFromTiledObject() pra cada objeto encontrado. Se um
// dia precisar spawnar um inimigo fora do Tiled (onda de inimigos,
// respawn, etc), chame EnemyFactory.create() diretamente.

// Props que JÁ tinham um significado antes desse refactor — não confundir
// com os overrides novos (patrol/direction/visionRangeTiles*/bidirectional)
// que são lidos dentro de EnemyBase.resolveEnemyOverrides.
function readCoreTiledProps(objectData) {
  const properties = objectData.properties;
  return {
    key: getTiledProperty(properties, 'key') || DEFAULT_MOB_KEY,
    type: getTiledProperty(properties, 'type') || DEFAULT_MOB_TYPE,
    path: getTiledProperty(properties, 'path') || '',
    properties,
  };
}

export const EnemyFactory = {
  // Cria um inimigo a partir de um objeto bruto do Object Layer "enemy".
  createFromTiledObject(scene, objectData) {
    const { key, type, path, properties } = readCoreTiledProps(objectData);
    return EnemyFactory.create(scene, objectData.x, objectData.y - 10, { key, type, path, properties });
  },

  // Cria um inimigo "na mão", sem depender do Tiled (ex: spawn dinâmico).
  create(scene, x, y, { key = DEFAULT_MOB_KEY, type = DEFAULT_MOB_TYPE, path = '', properties } = {}) {
    const enemy = spawnEnemyBase(scene, x, y, { key, path, type, properties });

    const behavior = EnemyBehaviorFactory.create(enemy.entityConfig?.behavior);
    enemy.behaviorInstance = behavior;

    // O corpo físico só fica com posição/tamanho definitivos depois que o
    // Phaser processa esse frame (colliders ainda estão "assentando").
    // Por isso a velocidade/animação inicial (behavior.init) só é aplicada
    // 10ms depois, e não na hora da criação. A animação inicial é
    // responsabilidade da PRÓPRIA behavior (cada uma decide se começa
    // parada/idle ou andando/run) — não force nada genérico aqui, senão
    // sobrescreve o que o behavior.init acabou de decidir.
    scene.time.delayedCall(10, () => {
      if (!enemy.active) return;
      behavior.init(scene, enemy);
    });

    return enemy;
  },
};
