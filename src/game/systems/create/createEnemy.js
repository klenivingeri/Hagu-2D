import { resizeCollider } from "./common";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";
import { createEnemyStatus } from "../../config/status.js";
import { DEFAULT_MOB_KEY, DEFAULT_MOB_TYPE, getEntityAnimationKey, getMobConfig } from "../../config/entities.js";
import { getTiledProperty } from "../../commons/tiledUtils.js";
import { getEnemyBehavior } from "../upgrade/enemyBehaviors.js";
import { MAP_DEPTHS } from "../../../constants.js";
import { showFloatingDamage } from "../../commons/floatingTextPool.js";
import { emitEnemyHitBurst } from "../../commons/dustTrail.js";

const ENEMY_HIT_FLASH_MS = 100;
const ENEMY_KNOCKBACK_SPEED = 80;
const ENEMY_KNOCKBACK_MS = 100;
const FLY_BEHAVIOR = 'aggro_fly';

const ENEMY_DAMAGE_COOLDOWN_MS = 300; // tempo sem poder levar outro dano (bullet ou stomp), evita múltiplos hits de uma vez

// ==========================================
// CRIAÇÃO DOS INIMIGOS
// ==========================================
// spawnEnemy() é o ÚNICO lugar que monta um inimigo do zero (sprite, física,
// status, behavior inicial). createEnemys() só lê a camada "enemy" do Tiled
// e chama spawnEnemy() pra cada ponto encontrado. Se um dia precisar spawnar
// um inimigo fora do Tiled (ex: onda de inimigos, respawn), chame spawnEnemy
// diretamente em vez de duplicar essa lógica.

export function createEnemys(scene) {
  const enemies = scene.physics.add.group();

  if (!scene.enemyLayer || !scene.enemyLayer.objects) return enemies;

  scene.enemyLayer.objects.forEach((objectData) => {
    const key = getTiledProperty(objectData.properties, 'key') || DEFAULT_MOB_KEY;
    const type = getTiledProperty(objectData.properties, 'type') || DEFAULT_MOB_TYPE;
    const path = getTiledProperty(objectData.properties, 'path') || '';
    const chaser = getTiledProperty(objectData.properties, 'chaser');

    const enemy = spawnEnemy(scene, objectData.x, objectData.y - 10, key, type, path, chaser);
    if (enemy) enemies.add(enemy);
  });

  // Um único overlap bullet x grupo cobre TODOS os inimigos (mortos ou
  // recém-criados são adicionados/removidos do mesmo grupo automaticamente).
  scene.physics.add.overlap(
    scene.bullets,
    enemies,
    (bullet, enemy) => {
      const bulletDirection = Math.sign(bullet.body?.velocity.x || 0);
      bulletDestroy(bullet);
      if (bullet.owner !== 'enemy') damageEnemy(enemy, bullet.damage, bulletDirection);
    },
    null,
    scene
  );

  return enemies;
}

// Cria um inimigo em (x, y) a partir de uma key do MOBS_CONFIG. Retorna
// `null` (e loga um aviso) se a key não existir — assim um mob mal
// configurado no Tiled não quebra a criação dos outros.
function spawnEnemy(scene, x, y, key, type = DEFAULT_MOB_TYPE, path = '', chaser) {
  const config = getMobConfig(type);

  const enemy = scene.physics.add.sprite(x, y, `${getEntityAnimationKey(key, 'run')}_0`);
  enemy.setDepth(MAP_DEPTHS.PLAYER);
  enemy.entityKey = key;
  enemy.entityPath = path;
  enemy.entityType = type;
  enemy.entityConfig = config;
  enemy.chaser = chaser === undefined
    ? config.chaser === true
    : chaser === true || chaser === 'true' || chaser === 1;
  enemy.status = createEnemyStatus(config.stats);
  initEnemyState(enemy);
  enemy.setCollideWorldBounds(true);
  if (config.behavior === FLY_BEHAVIOR) enemy.body.setAllowGravity(false);

  const { newWidth, newHeight, offsetX, offsetY } = resizeCollider(enemy);
  enemy.body.setSize(newWidth * 0.7, newHeight);
  enemy.body.setOffset(offsetX+2, offsetY);

  scene.physics.add.collider(enemy, scene.limits);
  scene.physics.add.collider(enemy, scene.platforms);

  // O corpo físico só fica com posição/tamanho definitivos depois que o
  // Phaser processa esse frame (colliders acima ainda estão "assentando").
  // Por isso a velocidade/animação inicial (definida pela behavior do
  // inimigo, ver enemyBehaviors.js) só é aplicada 10ms depois, e não na
  // hora da criação.
  scene.time.delayedCall(10, () => {
    if (!enemy.active) return;
    getEnemyBehavior(enemy).init(scene, enemy);
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  });

  return enemy;
}

// Flags de estado do inimigo. Três coisas independentes, cada uma com uma
// única responsabilidade (é essa mistura que causava o bug de ficar
// "travado" e não virar mais de direção):
//   isStomped    -> só controla ANIMAÇÃO: enquanto true, as behaviors de
//                   movimento (enemyBehaviors.js) não sobrescrevem os
//                   frames de enemy_stomp/enemy_spark. Não mexe em
//                   velocidade/direção.
//   invulnerable -> só controla DANO: enquanto true (300ms depois do
//                   último hit), bullet e stomp são ignorados. Evita que
//                   vários overlaps no mesmo instante contem como vários
//                   hits de uma vez só.
//   isDead       -> trava PERMANENTE assim que a vida chega a zero: nunca
//                   mais recebe dano (bullet ou stomp), mesmo se por algum
//                   motivo o body ainda estiver habilitado por um frame.
function initEnemyState(enemy) {
  enemy.isStomped = false;
  enemy.invulnerable = false;
  enemy.isDead = false;
}

function bulletDestroy(bullet) {
  // Desativa o tiro
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.setPosition(-1000, -1000);
}

// Dano de tiro (bullet). Só decide a origem do dano — quem realmente
// aplica é applyDamage (evita ter a mesma lógica de cooldown/morte
// duplicada aqui e em stompDamageEnemy).
export function damageEnemy(enemy, damage = 1, bulletDirection = 0) {
  applyDamage(enemy, damage, 'bullet', bulletDirection);
}

// Dano por "pisão" (stomp - pular em cima do inimigo). Mesma regra de
// cooldown/morte do bullet; a única diferença é que, se o inimigo
// sobreviver, toca a animação "enemy_stomp".
// Usada por createPlayer.js na mecânica de stomp.
export function stompDamageEnemy(enemy, damage = 1) {
  applyDamage(enemy, damage, 'stomp');
}

// Núcleo único de aplicação de dano, usado tanto pelo bullet quanto pelo
// stomp. Centralizar aqui evita que os dois caminhos fiquem com regras
// (cooldown, morte, etc) divergentes/duplicadas.
function applyDamage(enemy, damage, source, bulletDirection = 0) {
  if (!enemy || !enemy.active) return;
  if (enemy.isDead) return;        // já morrendo/morto: nunca mais recebe dano
  if (enemy.invulnerable) return;  // ainda no cooldown do último hit

  enemy.status.life -= damage;
  playHitFeedback(enemy, damage, source, bulletDirection);

  // Cooldown de dano: por ENEMY_DAMAGE_COOLDOWN_MS esse inimigo não pode
  // levar outro hit. Sem isso, o overlap (bullet ou player-em-cima)
  // dispara em vários frames seguidos e contava como vários hits de uma
  // vez só (era a causa do "morre rápido demais"/"trava" antes).
  enemy.invulnerable = true;
  enemy.scene.time.delayedCall(ENEMY_DAMAGE_COOLDOWN_MS, () => {
    if (enemy && enemy.active) {
      enemy.invulnerable = false;
    }
  });

  if (enemy.status.life <= 0) {
    killEnemy(enemy);
    return;
  }

  if (source === 'stomp') {
    playStompAnimation(enemy);
  }
}

// Toca "enemy_stomp" (esmagado, mas vivo). Trava só a ANIMAÇÃO de "run"
// até ela terminar (isStomped) — a velocidade/direção do inimigo não são
// tocadas aqui, então ele continua se deslocando e vira normalmente nas
// bordas/paredes assim que a behavior for liberada de novo.
function playHitFeedback(enemy, damage, source, bulletDirection) {
  if (source === 'bullet') {
    emitEnemyHitBurst(enemy.scene, enemy);
  }

  enemy.clearTint();
  enemy.setTint(0xff3b30);
  enemy.scene.time.delayedCall(ENEMY_HIT_FLASH_MS, () => {
    if (enemy.active) enemy.clearTint();
  });

  // Antes: criava um Text novo + 2 tweens e destruía tudo no final (GC
  // pressure a cada hit). Agora reaproveita um pool fixo de textos.
  showFloatingDamage(enemy.scene, enemy.x, enemy.y - enemy.height / 2, damage);

  if (source === 'bullet' && bulletDirection !== 0 && enemy.body?.enable) {
    enemy.setVelocityX(bulletDirection * ENEMY_KNOCKBACK_SPEED);
    enemy.scene.time.delayedCall(ENEMY_KNOCKBACK_MS, () => {
      if (enemy.active && !enemy.isDead) {
        enemy.setVelocityX(enemy.flipX ? -enemy.status.speed : enemy.status.speed);
      }
    });
  }
}

function playStompAnimation(enemy) {
  enemy.isStomped = true;
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'stomp'), true);

  enemy.once(`animationcomplete-${getEntityAnimationKey(enemy.entityKey, 'stomp')}`, () => {
    // Se o inimigo morreu enquanto essa animação ainda tocava (ex: mais
    // um hit chegou assim que o cooldown acabou), quem cuida da animação
    // agora é o killEnemy — não mexe em mais nada aqui.
    if (!enemy.active || enemy.isDead) return;

    enemy.isStomped = false;
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  });
}

// Morte do inimigo, seja por bullet ou por um stomp fatal: toca a
// animação "enemy_spark" e só destrói de fato (enemyDestroy) quando ela
// terminar. Desliga a física NA HORA (não só depois da animação) pra
// garantir que nenhum overlap (bullet ou player) consiga mais atingi-lo
// enquanto ele morre.
function killEnemy(enemy) {
  enemy.isDead = true;
  enemy.isStomped = true; // reaproveita a mesma trava de animação durante a morte
  enemy.setVelocityX(0);
  enemy.body.enable = false;
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'spark'), true);

  enemy.once(`animationcomplete-${getEntityAnimationKey(enemy.entityKey, 'spark')}`, () => {
    enemyDestroy(enemy);
  });
}

function enemyDestroy(enemy) {
  enemy.setActive(false);
  enemy.setVisible(false);
  enemy.body.enable = false; // Desliga a física para ele não colidir mais
  enemy.destroy();
}

export function preloadEnemyAssets(scene, assetKeys = []) {
  const definitions = assetKeys.map((item) => typeof item === 'string'
    ? { key: item, type: DEFAULT_MOB_TYPE } : item);
  const loaded = new Set();
  definitions.forEach(({ key, path = '', type = DEFAULT_MOB_TYPE }) => {
    const config = getMobConfig(type);
    const id = `${key}:${type}`;
    if (loaded.has(id)) return;
    loaded.add(id);
    preloadAnimations(scene, config.animations.map((animation) => ({
      ...animation, url: `${config.path}${path || key}/${animation.url}`,
    })), key);
  });
}

export function createEnemyAnimations(scene) {
  const definitions = scene.enemyDefinitions || (scene.enemyAssetKeys || [])
    .map((key) => ({ key, type: DEFAULT_MOB_TYPE }));
  const created = new Set();
  definitions.forEach(({ key, type = DEFAULT_MOB_TYPE }) => {
    const config = getMobConfig(type);
    const id = `${key}:${type}`;
    if (created.has(id)) return;
    created.add(id);
    createAnimations(scene, config.animations, key);
  });
}
