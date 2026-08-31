import { resizeCollider } from "./common";
import { updateHUD } from "./createhud";
import { ANIME_PLAYER } from "../../config/animations.js";
import { preloadAnimations, createAnimations } from "../../commons/animationUtils.js";
import { createPlayerStatus } from "../../config/status.js";
import { stompDamageEnemy } from "./createEnemy.js";

const DAMAGE_COOLDOWN_MS = 1000; // tempo sem poder tomar dano de novo
const STOMP_TOLERANCE_RATIO = 0.5; // "pisou" se os pés estiverem na metade de cima do inimigo

export function createPlayer(scene) {
  let player
  scene.playerLayer.objects.forEach((objectData) => {
    player = scene.physics.add.sprite(
      objectData.x,
      objectData.y - 10,
      'run_0'
    );
    player.setCollideWorldBounds(true);
    scene.physics.add.collider(player, scene.platforms);

  })

  const {
    newWidth,
    newHeight,
    offsetX,
    offsetY
  } = resizeCollider(player)  

  player.body.setSize(newWidth, newHeight);
  player.body.setOffset(offsetX, offsetY);

  player.status = createPlayerStatus();

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

  player.anims.play('spawn');
  player.once('animationcomplete-spawn', () => {
    player.isSpawning = false;
    player.invulnerable = false;
    player.setTexture('run_0'); // volta pro frame parado assim que termina
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
  // sem o player levar dano.
  if (isStomp(player, enemy)) {
    stompEnemy(scene, player, enemy);
    return;
  }

  const damage = enemy?.status?.contactDamage ?? 1;
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
  preloadAnimations(scene, ANIME_PLAYER);
}

export function createPlayerAnimations(scene) {
  createAnimations(scene, ANIME_PLAYER);
}