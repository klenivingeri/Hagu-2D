import { resizeCollider } from "../systems/create/common.js";
import { createEnemyStatus } from "../config/status.js";
import { getEntityAnimationKey, getMobConfig } from "../config/entities.js";
import { getTiledProperty } from "../commons/tiledUtils.js";
import { MAP_DEPTHS } from "../../constants.js";
import { showFloatingDamage } from "../commons/floatingTextPool.js";
import { emitEnemyHitBurst } from "../commons/dustTrail.js";

// ==========================================
// ENEMY BASE
// ==========================================
// Tudo que É IGUAL para qualquer inimigo, independente da behavior
// (patrol / patrol_and_shoot / patrol_fly / etc), vive aqui:
//   - criação do sprite físico + status + colisão com limites/plataformas
//   - leitura/override das props do Object Layer do Tiled (Tiled sempre
//     vence o default do MOBS_CONFIG quando o valor vier definido)
//   - pipeline único de dano (bullet OU stomp caem na mesma função)
//   - knockback/"espantar" ao levar tiro (genérico; behaviors que voam
//     podem reagir também via o hook opcional `onHit`)
//   - detecção de visão (campo de percepção em tiles), usada por
//     patrol_and_shoot e patrol_fly
//
// As behaviors (ver entities/behaviors/*.js) NUNCA duplicam essa lógica —
// elas só implementam o "como se move"/"quando ataca". Ver EnemyFactory.js
// pra ver como tudo isso é amarrado na hora de criar um inimigo.

export const ENEMY_HIT_FLASH_MS = 100;
export const ENEMY_KNOCKBACK_SPEED = 80;
export const ENEMY_KNOCKBACK_MS = 100;
export const ENEMY_DAMAGE_COOLDOWN_MS = 300; // tempo sem poder levar outro dano (bullet ou stomp), evita múltiplos hits de uma vez

// --------------------------------------------------------------
// Leitura das props do Object Layer (Tiled) com fallback pro default
// --------------------------------------------------------------
// IMPORTANTE: `key` (asset da animação), `path` (pasta do sprite) e `type`
// (qual mecânica/MOBS_CONFIG usar) já são lidas separadamente em
// EnemyFactory.js — não duplicar a leitura delas aqui.
function readBoolProp(properties, name, fallback) {
  const value = getTiledProperty(properties, name);
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function readNumberProp(properties, name, fallback) {
  const value = getTiledProperty(properties, name);
  const parsed = Number(value);
  return value === undefined || value === null || value === '' || Number.isNaN(parsed) ? fallback : parsed;
}

function readStringProp(properties, name, fallback) {
  const value = getTiledProperty(properties, name);
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

// Junta o default do MOBS_CONFIG (config.ai / config.patrol / etc) com o
// que vier sobrescrito no Object Layer do Tiled. Tiled sempre tem
// prioridade quando o valor está presente.
export function resolveEnemyOverrides(properties, config) {
  const defaultPatrol = config.patrol !== undefined ? config.patrol : true;
  const defaultDirection = config.direction || 'right';
  const defaultVisionWidth = Number(config.ai?.visionRangeTilesWidth) || 0;
  const defaultVisionHeight = Number(config.ai?.visionRangeTilesHeight) || 0;
  const defaultBidirectional = config.ai?.bidirectional === true;

  const direction = readStringProp(properties, 'direction', defaultDirection) === 'left' ? 'left' : 'right';

  return {
    patrol: readBoolProp(properties, 'patrol', defaultPatrol),
    direction,
    visionRangeTilesWidth: readNumberProp(properties, 'visionRangeTilesWidth', defaultVisionWidth),
    visionRangeTilesHeight: readNumberProp(properties, 'visionRangeTilesHeight', defaultVisionHeight),
    bidirectional: readBoolProp(properties, 'bidirectional', defaultBidirectional),
  };
}

// --------------------------------------------------------------
// Criação (sprite físico + status + colisão)
// --------------------------------------------------------------
// Monta o inimigo "cru": sprite, física, status, colisão com o cenário e os
// overrides vindos do Tiled. NÃO decide velocidade/IA inicial — isso é
// responsabilidade da behavior (behavior.init), chamada pela EnemyFactory
// logo em seguida.
export function spawnEnemyBase(scene, x, y, { key, path = '', type, properties } = {}) {
  const config = getMobConfig(type);
  const overrides = resolveEnemyOverrides(properties, config);

  const enemy = scene.physics.add.sprite(x, y, `${getEntityAnimationKey(key, 'run')}_0`);
  enemy.setDepth(MAP_DEPTHS.PLAYER);
  enemy.entityKey = key;
  enemy.entityPath = path;
  enemy.entityType = type;
  enemy.entityConfig = config;

  // Props do Object Layer (com default do MOBS_CONFIG quando não vierem
  // sobrescritas no Tiled).
  enemy.patrol = overrides.patrol;
  enemy.direction = overrides.direction;
  enemy.visionRangeTilesWidth = overrides.visionRangeTilesWidth;
  enemy.visionRangeTilesHeight = overrides.visionRangeTilesHeight;
  enemy.bidirectional = overrides.bidirectional;
  // facingDirection: 1 = olhando/andando pra direita, -1 = pra esquerda.
  // As behaviors atualizam isso sempre que viram o inimigo.
  enemy.facingDirection = overrides.direction === 'left' ? -1 : 1;

  enemy.status = createEnemyStatus(config.stats);
  initEnemyState(enemy);
  enemy.setFlipX(enemy.facingDirection < 0);
  enemy.setCollideWorldBounds(true);
  if (config.noGravity) enemy.body.setAllowGravity(false);

  const { newWidth, newHeight, offsetX, offsetY } = resizeCollider(enemy);
  enemy.body.setSize(newWidth * 0.7, newHeight);
  enemy.body.setOffset(offsetX + 2, offsetY);

  // Colisão com o cenário: SEMPRE as mesmas duas camadas, pra qualquer
  // inimigo (limite da plataforma/mapa + colisões do chão/obstáculos).
  scene.physics.add.collider(enemy, scene.limits);
  scene.physics.add.collider(enemy, scene.platforms);

  return enemy;
}

function initEnemyState(enemy) {
  enemy.isStomped = false;
  enemy.invulnerable = false;
  enemy.isDead = false;
  enemy.isAttacking = false;
}

// --------------------------------------------------------------
// Dano (pipeline único: bullet e stomp caem aqui)
// --------------------------------------------------------------
export function damageEnemy(enemy, damage = 1, bulletDirection = 0) {
  applyDamage(enemy, damage, 'bullet', bulletDirection);
}

export function stompDamageEnemy(enemy, damage = 1) {
  applyDamage(enemy, damage, 'stomp');
}

function applyDamage(enemy, damage, source, bulletDirection = 0) {
  if (!enemy || !enemy.active) return;
  if (enemy.isDead) return;        // já morrendo/morto: nunca mais recebe dano
  if (enemy.invulnerable) return;  // ainda no cooldown do último hit

  enemy.status.life -= damage;
  playHitFeedback(enemy, damage, source, bulletDirection);

  enemy.invulnerable = true;
  enemy.scene.time.delayedCall(ENEMY_DAMAGE_COOLDOWN_MS, () => {
    if (enemy && enemy.active) enemy.invulnerable = false;
  });

  if (enemy.status.life <= 0) {
    killEnemy(enemy);
    return;
  }

  if (source === 'stomp') {
    playStompAnimation(enemy);
  }

  // Hook opcional: behaviors que precisam reagir ao hit além do knockback
  // padrão (ex: patrol_fly virando de direção pra "fugir" do tiro).
  const behavior = enemy.behaviorInstance;
  if (behavior && typeof behavior.onHit === 'function') {
    behavior.onHit(enemy.scene, enemy, source, bulletDirection);
  }
}

function playHitFeedback(enemy, damage, source, bulletDirection) {
  if (source === 'bullet') {
    emitEnemyHitBurst(enemy.scene, enemy);
  }

  enemy.clearTint();
  enemy.setTint(0xff3b30);
  enemy.scene.time.delayedCall(ENEMY_HIT_FLASH_MS, () => {
    if (enemy.active) enemy.clearTint();
  });

  showFloatingDamage(enemy.scene, enemy.x, enemy.y - enemy.height / 2, damage);

  // Knockback genérico: "espanta" o inimigo na direção oposta ao tiro por
  // ENEMY_KNOCKBACK_MS. Enquanto isso, isKnockedBack(scene, enemy) fica
  // true — as behaviors devem checar isso antes de sobrescrever a
  // velocidade (senão o knockback nunca aparece, já que o update roda
  // todo frame). Ver behaviors/patrolFlyBehavior.js e
  // behaviors/patrolBehavior.js.
  if (source === 'bullet' && bulletDirection !== 0 && enemy.body?.enable) {
    enemy.knockbackUntil = enemy.scene.time.now + ENEMY_KNOCKBACK_MS;
    enemy.setVelocityX(bulletDirection * ENEMY_KNOCKBACK_SPEED);
    enemy.scene.time.delayedCall(ENEMY_KNOCKBACK_MS, () => {
      if (enemy.active && !enemy.isDead) {
        enemy.setVelocityX(enemy.flipX ? -enemy.status.speed : enemy.status.speed);
      }
    });
  }
}

// Behaviors chamam isso antes de escrever velocidade no update(), pra não
// "roubar" o knockback que acabou de ser aplicado pelo hit.
export function isKnockedBack(scene, enemy) {
  return Boolean(enemy.knockbackUntil && scene.time.now < enemy.knockbackUntil);
}

function playStompAnimation(enemy) {
  enemy.isStomped = true;
  enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'stomp'), true);

  enemy.once(`animationcomplete-${getEntityAnimationKey(enemy.entityKey, 'stomp')}`, () => {
    if (!enemy.active || enemy.isDead) return;
    enemy.isStomped = false;
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  });
}

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
  enemy.body.enable = false;
  enemy.destroy();
}

// --------------------------------------------------------------
// Virar de direção (usado por qualquer behavior que precise virar o
// inimigo e trocar a animação de volta pra "run" quando possível).
// --------------------------------------------------------------
export function turnEnemy(enemy, velocityX, facingDirection) {
  enemy.setVelocityX(velocityX);
  enemy.facingDirection = facingDirection;
  enemy.setFlipX(facingDirection < 0);

  if (!enemy.isStomped && !enemy.isAttacking) {
    enemy.anims.play(getEntityAnimationKey(enemy.entityKey, 'run'), true);
  }
}

// --------------------------------------------------------------
// Campo de visão (usado por patrol_and_shoot e patrol_fly)
// --------------------------------------------------------------
// visionRangeTilesWidth/Height em 0 NÃO desativa a visão — nesse caso a
// caixa fica do tamanho do próprio collider do inimigo (ver getVisionBox
// mais abaixo pra geometria completa). bidirectional=true -> extensão
// simétrica (frente+trás, cima+baixo); bidirectional=false -> extensão só
// na frente (direção que o inimigo está olhando) e só pra cima.
//
// IMPORTANTE — contrato entre behaviors: isPlayerInVision() só responde
// "o player está dentro da caixa de percepção?" (não existe mais um flag
// "chaser" separado gatekeepando isso). O que cada behavior FAZ com essa
// resposta é decisão exclusiva dela, com uma regra fixa:
//   - patrol_and_shoot -> ao ver o player, ATIRA (fireAtPlayer). Nunca
//     persegue: continua só patrulhando (ou parado, se patrol=false).
//   - QUALQUER outro type que use visão (hoje: patrol_fly) -> ao ver o
//     player, PERSEGUE (muda velocidade/posição na direção dele).
// Ou seja: type === 'patrol_and_shoot' => dispara; type !== 'patrol_and_shoot'
// => persegue. Um patrol_and_shoot NUNCA deve perseguir o player.
//
// Geometria da caixa (BASE + extensões):
//   BASE = o próprio collider do inimigo (largura/altura do enemy.body).
//   width/height NÃO desativam a visão quando são 0 — nesse caso a caixa
//   é simplesmente do tamanho da BASE (o inimigo só "sente" o que encosta
//   nele). visionRangeTilesWidth/Height são extensões EM TILES:
//
//   bidirectional=true  -> UM retângulo só, simétrico: BASE + width pra
//     cada lado (frente e trás) + height pra cima e pra baixo. Cobre a
//     coluna do próprio inimigo também.
//
//   bidirectional=false -> formato em "L", DOIS retângulos:
//     1) "linha da frente": BASE (collider) + width tiles na direção que
//        o inimigo olha, na MESMA altura do inimigo (sem extensão vertical).
//     2) "topo": só aparece se height>0. Fica em cima da linha da frente,
//        mas SÓ sobre a parte da frente — não cobre a coluna do próprio
//        inimigo. Largura = os mesmos width tiles da linha da frente;
//        altura = height tiles.
//     Exemplo (width=2, height=1, direção=frente/direita):
//       topo:   ....[][]        (2 tiles, começa depois da coluna do "e")
//       frente: [e][][]         (e + 2 tiles)
//
// Ative `debug: true` no MOBS_CONFIG (ou `scene.debug = true`) pra ver a
// caixa desenhada em tempo real (updateVisionDebug) e ajustar visualmente.
export function isPlayerInVision(scene, enemy) {
  const player = scene.player;
  if (!player || player.isDead || !enemy.body) return false;

  const playerX = player.body?.center.x ?? player.x;
  const playerY = player.body?.center.y ?? player.y;

  return getVisionShapes(scene, enemy).some(
    ({ left, right, top, bottom }) => playerX >= left && playerX <= right && playerY >= top && playerY <= bottom
  );
}

// Devolve 1 ou 2 retângulos {left, right, top, bottom} que juntos formam
// a caixa de visão. bidirectional=true -> sempre 1 (retângulo simétrico).
// bidirectional=false -> 1 (sem extensão de altura) ou 2 (linha da frente
// + topo, formando o "L").
function getVisionShapes(scene, enemy) {
  const tileSize = scene.map?.tileWidth || 16;
  const baseHalfWidth = (enemy.body.width || tileSize) / 2;
  const baseHalfHeight = (enemy.body.height || tileSize) / 2;
  const widthPx = (enemy.visionRangeTilesWidth || 0) * tileSize;
  const heightPx = (enemy.visionRangeTilesHeight || 0) * tileSize;
  const centerX = enemy.body.center.x;
  const centerY = enemy.body.center.y;
  const direction = enemy.facingDirection || 1;
  const facingRight = direction > 0;

  const baseTop = centerY - baseHalfHeight;
  const baseBottom = centerY + baseHalfHeight;

  if (enemy.bidirectional) {
    // Retângulo único, simétrico nos 4 lados, cobrindo também a coluna
    // do próprio inimigo.
    return [{
      left: centerX - baseHalfWidth - widthPx,
      right: centerX + baseHalfWidth + widthPx,
      top: baseTop - heightPx,
      bottom: baseBottom + heightPx,
    }];
  }

  // "Linha da frente": BASE + width tiles na direção que o inimigo olha,
  // sempre na mesma altura do inimigo (sem extensão vertical aqui).
  const frontRow = facingRight
    ? { left: centerX - baseHalfWidth, right: centerX + baseHalfWidth + widthPx, top: baseTop, bottom: baseBottom }
    : { left: centerX - baseHalfWidth - widthPx, right: centerX + baseHalfWidth, top: baseTop, bottom: baseBottom };

  if (heightPx <= 0) return [frontRow];

  // "Topo": só sobre a área da frente (exclui a coluna do inimigo),
  // encostado no topo da linha da frente e subindo `heightPx`.
  const topRow = facingRight
    ? { left: centerX + baseHalfWidth, right: centerX + baseHalfWidth + widthPx, top: baseTop - heightPx, bottom: baseTop }
    : { left: centerX - baseHalfWidth - widthPx, right: centerX - baseHalfWidth, top: baseTop - heightPx, bottom: baseTop };

  return [frontRow, topRow];
}

// Devolve os retângulos de visão em formato {x, y, width, height} — útil
// só pro debug visual. Pode ser 1 (bidirectional=true, ou height=0) ou 2
// (bidirectional=false com height>0: linha da frente + topo).
export function getVisionRects(scene, enemy) {
  return getVisionShapes(scene, enemy).map(({ left, right, top, bottom }) => ({
    x: left, y: top, width: right - left, height: bottom - top,
  }));
}

export function updateVisionDebug(scene, enemy, canSeePlayer) {
  const debug = scene.debug === true || enemy.entityConfig?.debug === true || enemy.entityConfig?.ai?.debug === true;
  if (!debug) {
    enemy.visionDebugGraphics?.clear();
    return;
  }
  if (!enemy.visionDebugGraphics) enemy.visionDebugGraphics = scene.add.graphics().setDepth(119);
  const graphics = enemy.visionDebugGraphics;
  graphics.clear();
  graphics.lineStyle(1, canSeePlayer ? 0xff4d4d : 0xffd166, 0.95);
  graphics.fillStyle(canSeePlayer ? 0xff4d4d : 0xffd166, 0.12);
  getVisionRects(scene, enemy).forEach(({ x, y, width, height }) => {
    graphics.fillRect(x, y, width, height);
    graphics.strokeRect(x, y, width, height);
  });
}

// Olha um pouco à frente, na direção do movimento: se não tem chão ali, é
// beira de plataforma. Usado por qualquer behavior "de chão" (patrol,
// patrol_and_shoot) — não se aplica a quem voa.
const LOOK_AHEAD_MARGIN = 1;
export function isAboutToFall(scene, enemy) {
  const dir = Math.sign(enemy.body.velocity.x);
  if (dir === 0) return false;

  const lookAheadX = enemy.body.x + (dir > 0 ? enemy.body.width + LOOK_AHEAD_MARGIN : -LOOK_AHEAD_MARGIN);
  const feetY = enemy.body.y + enemy.body.height + LOOK_AHEAD_MARGIN;

  for (let i = 0; i < scene.platforms.length; i += 1) {
    const tile = scene.platforms[i].getTileAtWorldXY(lookAheadX, feetY);
    if (tile && tile.index !== -1) return false;
  }
  return true;
}
