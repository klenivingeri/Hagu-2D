import { resizeCollider } from "./common";
import { updateHUD } from "./createhud";

const DAMAGE_COOLDOWN_MS = 1000; // tempo sem poder tomar dano de novo

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

  player.status = {
    life: 3
  }

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
    (playerObj) => hitByEnemy(scene, playerObj),
    null,
    scene
  );
}

function hitByEnemy(scene, player) {
  if (player.invulnerable || player.isDead) return; // ainda no cooldown, ignora o toque

  player.status.life -= 1;
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
  // Carregando os frames de pulo (0 a 5)
  for (let i = 0; i <= 5; i++) {
    scene.load.image(`jump_${i}`, `assets/player/jump/sprite_jump_${i}.png`);
  }

  for (let i = 0; i <= 10; i++) {
    scene.load.image(`spawn_${i}`, `assets/player/spawn/sprite_re_warp_${i}.png`);
  }

  // Carregando os frames de corrida (0 a 3)
  for (let i = 0; i <= 3; i++) {
    scene.load.image(`run_${i}`, `assets/player/run/sprite_run_two_${i}.png`);
  }

  for (let i = 0; i <= 5; i++) {
    scene.load.image(`bow_${i}`, `assets/player/bow/sprite_weapon_bow_short_fire_slow_${i}.png`);
  }
}

export function createPlayerAnimations(scene) {
  // Animação de Corrida
  scene.anims.create({
    key: 'run',
    frames: [
      { key: 'run_0' },
      { key: 'run_1' },
      { key: 'run_2' },
      { key: 'run_3' }
    ],
    frameRate: 10, // Velocidade da animação (quadros por segundo)
    repeat: -1     // -1 significa loop infinito
  });

  // Animação de Pulo
  scene.anims.create({
    key: 'jump',
    frames: [
      { key: 'jump_0' },
      { key: 'jump_1' },
      { key: 'jump_2' },
      { key: 'jump_3' },
      { key: 'jump_4' },
      { key: 'jump_5' }
    ],
    frameRate: 10,
    repeat: 0 // Roda apenas uma vez quando pula
  });

  scene.anims.create({
    key: 'bow',
    frames: [
      { key: 'bow_0' },
      { key: 'bow_1' },
      { key: 'bow_2' },
      { key: 'bow_3' },
      { key: 'bow_4' },
      { key: 'bow_5' }
    ],
    frameRate: 10,
    repeat: 0 // Roda apenas uma vez quando pula
  });

  scene.anims.create({
    key: 'spawn',
    frames: [
      { key: 'spawn_0' },
      { key: 'spawn_1' },
      { key: 'spawn_2' },
      { key: 'spawn_3' },
      { key: 'spawn_4' },
      { key: 'spawn_5' },
      { key: 'spawn_6' },
      { key: 'spawn_7' },
      { key: 'spawn_8' },
      { key: 'spawn_9' },
      { key: 'spawn_10' }
    ],
    frameRate: 10,
    repeat: 0 // Roda apenas uma vez quando pula
  });
}