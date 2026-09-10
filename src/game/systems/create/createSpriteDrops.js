import { MAP_DEPTHS } from '../../../constants.js';
import { getEntityAnimationKey } from '../../config/entities.js';

// Item colecionável que um inimigo pode soltar ao morrer (ver
// EnemyBase.killEnemy()/SPRITE_DROP_CHANCE_PERCENT em GameManager.js) — o
// player precisa encostar nele em campo pra revelar a arte colorida daquela
// espécie na Coleção (ver aba "Coleção" da Welcome). Mesmo padrão de grupo
// físico + overlap dos diamantes (ver createDiamants.js); o visual é a
// MESMA textura já carregada pro `run` do próprio inimigo (ver
// preloadEnemyAssets em createEnemy.js), sem moldura nem asset novo — só
// gira/flutua e solta faíscas pra deixar claro que é um item, não o inimigo
// voltando.
//
// Encostar aqui só marca a espécie em scene.collectedSprites (sessão da run
// atual) — NÃO persiste em GameManager ainda. O commit de verdade
// (unlockEnemySprite) só acontece em GameScene.completeRun(), então morrer
// ou sair antes do portal não desbloqueia a sprite na Coleção mesmo já
// tendo encostado no item em campo.

const DROP_MAX_SIZE = 16; // cap de altura — sprite menor que isso fica no tamanho natural, nunca é esticado
const SPIN_MS = 900; // duração de um giro completo (encolhe no X até sumir de perfil e volta)
const SPARKLE_TINT = 0xffd76a;

export function createSpriteDropGroup(scene) {
  const drops = scene.physics.add.group({ allowGravity: false, immovable: true });

  scene.physics.add.overlap(scene.player, drops, (_player, drop) => {
    if (!drop.active || drop.isCollecting) return;
    drop.isCollecting = true;
    drop.body.enable = false;
    // Mata o giro/flutuação em loop antes de tocar a animação de coleta,
    // senão os dois ficam brigando pelas mesmas propriedades (scale/y).
    scene.tweens.killTweensOf(drop);
    drop.sparkleEmitter?.stop();

    const { speciesKey, speciesPath, speciesBehavior } = drop;
    if (!scene.collectedSprites.has(speciesKey)) {
      scene.collectedSprites.set(speciesKey, { key: speciesKey, path: speciesPath, behavior: speciesBehavior });
    }

    scene.sound.play('coin');
    scene.tweens.add({
      targets: drop,
      y: drop.y - 24,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 360,
      onComplete: () => {
        drop.sparkleEmitter?.destroy();
        drop.destroy();
      },
    });
  });

  scene.spriteDrops = drops;
  return drops;
}

export function spawnSpriteDrop(scene, x, y, { key, path = '', behavior } = {}) {
  if (!scene.spriteDrops) return;

  const textureKey = `${getEntityAnimationKey(key, 'run')}_0`;
  const drop = scene.spriteDrops.create(x, y, textureKey);
  drop.setDepth(MAP_DEPTHS.SPRITE_DROP);
  drop.body.setAllowGravity(false);

  // Cap de 16px de altura: sprite grande (ex: tank/dino) encolhe pra caber;
  // sprite já pequeno (ex: 16x16) fica no tamanho normal — nunca esticamos
  // pra cima.
  if (drop.height > DROP_MAX_SIZE) {
    drop.setScale(DROP_MAX_SIZE / drop.height);
  }
  drop.speciesKey = key;
  drop.speciesPath = path;
  drop.speciesBehavior = behavior;

  // Faíscas douradas saindo do item (reaproveita a textura de 2x2px da
  // poeira, já gerada em preloadDustTexture/GameScene.create()) — segue o
  // drop automaticamente (`follow`), então acompanha o giro/flutuação sem
  // precisar recalcular posição a cada frame.
  if (scene.textures.exists('dust_pixel')) {
    const sparkles = scene.add.particles(0, 0, 'dust_pixel', {
      follow: drop,
      quantity: 1,
      frequency: 90,
      lifespan: { min: 220, max: 380 },
      speed: { min: 6, max: 18 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: SPARKLE_TINT,
    });
    sparkles.setDepth(MAP_DEPTHS.SPRITE_DROP - 1);
    drop.sparkleEmitter = sparkles;
  }

  // Flutua suave pra cima/baixo, igual ao diamante...
  scene.tweens.add({
    targets: drop,
    y: y - 4,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  // ...e "gira": encolhe no eixo X até sumir de perfil e expande de novo.
  // Truque clássico 2D pra simular rotação no eixo Y sem precisar de um
  // sprite 3D de verdade.
  scene.tweens.add({
    targets: drop,
    scaleX: 0,
    duration: SPIN_MS / 2,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
