import { resizeCollider } from "./common";
import { updateHUD } from "./createhud";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";
import { createPlayerStatus } from "../../config/status.js";
import { PLAYERS_CONFIG, getEntityAnimationKey } from "../../config/entities.js";
import { getTiledProperty } from "../../commons/tiledUtils.js";
import { stompDamageEnemy } from "./createEnemy.js";
import { MAP_DEPTHS } from "../../../constants.js";
import { emitEnemyHitBurst } from "../../commons/dustTrail.js";
import { gameState } from '../../state/gameState.js';

const DAMAGE_COOLDOWN_MS = 1000; // tempo sem poder tomar dano de novo
const STOMP_TOLERANCE_RATIO = 0.5; // "pisou" se os pés estiverem na metade de cima do inimigo

export function createPlayer(scene) {
  const objectData = scene.playerLayer?.objects?.[0];
  if (!objectData) return null;

  const key = getTiledProperty(objectData.properties, 'key')
    || scene.playerLayer.key || 'player';
  const config = PLAYERS_CONFIG[key];
  if (!config) throw new Error(`Configuração de player não encontrada para a key "${key}".`);

  const player = scene.physics.add.sprite(
      objectData.x,
      objectData.y - 10,
      `${getEntityAnimationKey(key, 'run')}_0`
    );
  player.setDepth(MAP_DEPTHS.PLAYER);
  player.entityKey = key;
  player.entityConfig = config;
  gameState.playerSpritePath = config.path;
  player.isWallSliding = false;
  player.lastGroundedAt = -Infinity;
  // Atualizado exclusivamente pelo collider da layer obstacles.
  player.stickableWallSide = 0;
  // -1 = última parede foi a esquerda, 1 = direita, 0 = nenhuma ainda.
  // Impede reaprender na mesma parede sem antes trocar para a oposta.
  player.lastWallSide = 0;
  player.setCollideWorldBounds(true);
  // obstacles precisa ficar fora deste collider geral. Caso contrário, ele
  // é separado primeiro e o collider específico abaixo não recebe o tile.
  const playerPlatforms = scene.platforms.filter((layer) => layer !== scene.obstacles);
  scene.physics.add.collider(player, playerPlatforms);
  if (scene.obstacles) {
    scene.physics.add.collider(player, scene.obstacles, (playerObj, tile) => {
      // O callback do collider recebe o Tile. Não usamos blocked.left/right
      // porque o player também colide com scene.platforms, que inclui a
      // própria obstacles e pode sobrescrever esses flags.
      const body = playerObj.body;
      const tileTop = tile.getTop();
      const tileBottom = tile.getBottom();
      const hasVerticalContact = body.bottom > tileTop && body.top < tileBottom;

      if (hasVerticalContact) {
        player.stickableWallSide = body.center.x < tile.getCenterX() ? -1 : 1;
      }
    });
  }

  const {
    newWidth,
    newHeight,
    offsetX,
    offsetY
  } = resizeCollider(player)  

  player.body.setSize(newWidth * 0.7, newHeight);
  player.body.setOffset(offsetX+2, offsetY);

  player.status = createPlayerStatus(config.stats);
  player.levelCoins = 0;
  player.levelDiamants = 0;

  player.invulnerable = false;
  player.isDead = false;
  player.isShooting = false;

  playSpawnAnimation(scene, player);

  return player;
}

// Toca a animação de "spawn" assim que o player é criado. Enquanto ela
// roda, o player fica invulnerável (não pode tomar dano nascendo) e o
// updatePlayerMovement fica pausado (veja o guard isSpawning lá), então a
// animação não é interrompida por um "run_0"/"run" no meio do caminho.
function playSpawnAnimation(scene, player) {
  player.isSpawning = true;
  player.invulnerable = true;

  const spawnAnimation = getEntityAnimationKey(player.entityKey, 'spawn');
  player.anims.play(spawnAnimation);
  player.once(`animationcomplete-${spawnAnimation}`, () => {
    player.isSpawning = false;
    player.invulnerable = false;
    player.setTexture(`${getEntityAnimationKey(player.entityKey, 'run')}_0`);
  });
}

// Liga o dano por colisão com inimigo (com invencibilidade + piscada de 1s).
// Chame no create() da GameScene, depois de criar player e enemies:
//   setupPlayerDamage(scene, scene.player, scene.enemies);
export function setupPlayerDamage(scene, player, enemies) {
  if (!enemies) return;

  scene.physics.add.overlap(
    player,
    enemies,
    (playerObj, enemyObj) => hitByEnemy(scene, playerObj, enemyObj),
    null,
    scene
  );
}

function hitByEnemy(scene, player, enemy) {
  if (player.invulnerable || player.isDead) return; // ainda no cooldown, ignora o toque
  if (!enemy || !enemy.active) return;

  // Estilo Mario: caiu de cima em cima do inimigo -> quica e dá dano nele,
  // sem o player levar dano. O overlap dispara TODO FRAME enquanto as
  // caixas de colisão ainda estão sobrepostas (physics.add.overlap não
  // separa os corpos), mas quem decide se o dano realmente conta é o
  // cooldown de invulnerabilidade do PRÓPRIO inimigo (300ms, ver
  // applyDamage em createEnemy.js) — aqui só detectamos a geometria e
  // despachamos, sem duplicar essa regra.
  if (isStomp(player, enemy)) {
    stompEnemy(scene, player, enemy);
    return;
  }

  const damage = enemy?.entityConfig?.attack?.damage
    ?? enemy?.status?.contactDamage
    ?? 1;
  damagePlayer(scene, damage);
}

export function damagePlayer(scene, damage = 1) {
  const player = scene.player;
  if (!player || player.invulnerable || player.isDead) return;

  emitEnemyHitBurst(scene, player);
  player.status.life -= damage;
  updateHUD(scene, player.status.life);

  if (scene.hud) {
    const lostHeart = scene.hud.hearts[player.status.life];
    if (lostHeart) {
      lostHeart.classList.add('losing');
      lostHeart.addEventListener('animationend', () => lostHeart.classList.remove('losing'), { once: true });
    }
  }

  if (player.status.life <= 0) {
    killPlayer(scene, player);
    return;
  }

  makePlayerInvulnerable(scene, player);
}

// Estava caindo (velocity.y > 0) com os pés na metade de cima do inimigo?
// Como o overlap player x enemy não separa os corpos fisicamente (só
// dispara o dano), não dá pra usar body.blocked/touching aqui — por isso
// a checagem é por posição + direção do movimento.
function isStomp(player, enemy) {
  const isFalling = player.body.velocity.y > 0;
  const stompLine = enemy.body.top + enemy.body.height * STOMP_TOLERANCE_RATIO;
  return isFalling && player.body.bottom <= stompLine;
}

function stompEnemy(scene, player, enemy) {
  // Quica pra cima, igual se tivesse apertado o botão de pulo.
  player.setVelocityY(-player.status.jumpHeight);

  // stompDamageEnemy decide sozinha a animação certa: "enemy_stomp" se o
  // inimigo sobreviver, "enemy_spark" (morte) se esse dano for fatal.
  stompDamageEnemy(enemy, player.status.jumpDamage);
}

function makePlayerInvulnerable(scene, player) {
  player.invulnerable = true;

  const blinkTween = scene.tweens.add({
    targets: player,
    alpha: 0.2,
    duration: 100,
    ease: 'Linear',
    yoyo: true,
    repeat: Math.round(DAMAGE_COOLDOWN_MS / 200) - 1, // preenche ~1s piscando
  });

  scene.time.delayedCall(DAMAGE_COOLDOWN_MS, () => {
    player.invulnerable = false;
    blinkTween.stop();
    player.setAlpha(1);
  });
}

function killPlayer(scene, player) {
  if (player.isDead) return;

  player.isDead = true;
  player.status.life = 0;

  player.setVelocity(0, 0);
  player.body.enable = false;
  player.setTint(0xff0000);

  // TODO: troque por sua tela de game over / respawn de verdade.
  scene.time.delayedCall(500, () => {
    scene.scene.restart();
  });
}

export function preloadPlayerAssets(scene) {
  Object.entries(PLAYERS_CONFIG).forEach(([key, config]) => {
    preloadAnimations(scene, config.animations.map((animation) => ({
      ...animation, url: `${config.path}${animation.url}`,
    })), key);
  });
}

export function createPlayerAnimations(scene) {
  Object.entries(PLAYERS_CONFIG).forEach(([key, config]) => {
    createAnimations(scene, config.animations, key);
  });
}
