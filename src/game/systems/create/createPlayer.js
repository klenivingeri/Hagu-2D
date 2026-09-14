import { resizeCollider } from "./common";
import { preloadSpriteSheetAnimations, createSpriteSheetAnimations } from "../../commons/animationUtils.js";
import { createPlayerStatus } from "../../config/status.js";
import { PLAYERS_CONFIG, getEntityAnimationKey, getPlayerAnimationAssets } from "../../config/entities.js";
import { getTiledProperty } from "../../commons/tiledUtils.js";
import { stompDamageEnemy } from "./createEnemy.js";
import { MAP_DEPTHS, HUD_EVENTS, GAME_OVER_EVENTS, MAX_RUN_ATTEMPTS } from "../../../constants.js";
import { emitEnemyHitBurst } from "../../commons/dustTrail.js";
import { createJetpackFuelBar } from "../../commons/jetpackBar.js";
import { createReloadBar } from "../../commons/reloadBar.js";
import { createWaveText } from "../../commons/waveText.js";
import { gameState } from '../../../managers/GameManager.js';
import { vibrateDamage, vibrateDeath } from '../../../services/HapticsService.js';

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
      getEntityAnimationKey(key, 'run'),
      0
    );
  player.setDepth(MAP_DEPTHS.PLAYER);
  player.entityKey = key;
  player.entityConfig = config;
  gameState.playerSpritePath = config.path;
  player.isWallSliding = false;
  // Permite exatamente um pulo extra por período no ar.
  player.hasUsedDoubleJump = false;
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
  player.levelExp = 0;

  // Estado do paraquedas: reseta sempre que o player toca o chão
  // (ver updatePlayerMovement.js).
  player.isParachuteActive = false;
  // Só pode abrir uma vez por período no ar. Reseta ao tocar o chão ou
  // colidir com uma parede (ver updatePlayerMovement.js).
  player.hasUsedParachute = false;

  // Estado do jetpack: recarrega e desarma sempre que o player toca o chão
  // (ver updatePlayerMovement.js). "Armado" = já apertou pulo de novo no ar,
  // então segurar o botão mantém o jetpack ativo.
  player.isJetpackActive = false;
  player.jetpackArmed = false;
  player.jetpackFuel = player.status.jetpackFuelMs;
  player.jetpackFuelBar = createJetpackFuelBar(scene);
  player.reloadBar = createReloadBar(scene);

  player.invulnerable = false;
  player.isDead = false;
  player.isShooting = false;
  // Usados para medir a distância vertical entre o último piso e o próximo pouso.
  player.fallStartY = null;
  player.lastGroundedBottom = player.body.bottom;

  setupWorldBoundsDeath(scene, player);

  playSpawnAnimation(scene, player);

  return player;
}

// Sem isso, cair fora de qualquer plataforma faz o player ficar preso
// (empurrado pra dentro) na borda inferior do mundo, vivo, pra sempre.
// Tocar a borda de baixo do mundo mata na hora, igual a um poço sem fundo.
function setupWorldBoundsDeath(scene, player) {
  player.body.onWorldBounds = true;
  scene.physics.world.on('worldbounds', (body, up, down) => {
    if (body.gameObject !== player || !down || player.isDead) return;

    killPlayer(scene, player);
  });
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
    player.setTexture(getEntityAnimationKey(player.entityKey, 'run'), 0);
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

export function hitByEnemy(scene, player, enemy) {
  if (player.isDead) return;
  if (!enemy || !enemy.active) return;

  // Estilo Mario: caiu de cima em cima do inimigo -> quica e dá dano nele,
  // sem o player levar dano. O overlap dispara TODO FRAME enquanto as
  // caixas de colisão ainda estão sobrepostas (physics.add.overlap não
  // separa os corpos), mas quem decide se o dano realmente conta é o
  // cooldown de invulnerabilidade do PRÓPRIO inimigo (300ms, ver
  // applyDamage em createEnemy.js) — aqui só detectamos a geometria e
  // despachamos, sem duplicar essa regra.
  // Checado antes do invulnerable: dano de SAÍDA (o player pisando no
  // inimigo) nunca deve ser bloqueado pelo i-frame, que só protege o
  // player de dano de ENTRADA.
  // Obstáculo tipo "serra" (noStomp, ver hazard_fly em game/config/
  // entities.js): nunca faz o bounce de "pisou em cima" — todo contato,
  // inclusive caindo por cima, cai direto pro dano normal abaixo.
  if (!enemy.entityConfig?.noStomp && isStomp(player, enemy)) {
    stompEnemy(scene, player, enemy);
    return;
  }

  if (player.invulnerable) return; // ainda no cooldown, ignora o toque

  const damage = enemy?.entityConfig?.attack?.damage
    ?? enemy?.status?.contactDamage
    ?? 1;
  damagePlayer(scene, damage);
}

export function damagePlayer(scene, damage = 1) {
  const player = scene.player;
  if (!player || player.invulnerable || player.isDead) return;

  // Critério de 3 estrelas (ver GameScene.completeRun()): qualquer dano real
  // recebido na run zera a chance de "sem levar dano", mesmo que o player
  // sobreviva e recupere vida depois.
  scene.runDamageTaken = true;

  scene.sound.play('tap');
  emitEnemyHitBurst(scene, player);
  vibrateDamage();
  player.status.life -= damage;
  scene.game.events.emit(HUD_EVENTS.HEALTH_CHANGED, player.status.life, gameState.maxlife);

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
export function isStomp(player, enemy) {
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

const BLINK_SLOW_DURATION_MS = 100; // ritmo normal da piscada
const BLINK_FAST_DURATION_MS = 50; // ritmo acelerado no fim, avisando que a invulnerabilidade tá acabando
const BLINK_FAST_WINDOW_MS = 300; // últimos X ms do cooldown com piscada rápida

function makePlayerInvulnerable(scene, player) {
  player.invulnerable = true;

  const fastPhaseStart = DAMAGE_COOLDOWN_MS - BLINK_FAST_WINDOW_MS;

  const slowBlink = scene.tweens.add({
    targets: player,
    alpha: 0.2,
    duration: BLINK_SLOW_DURATION_MS,
    ease: 'Linear',
    yoyo: true,
    repeat: Math.round(fastPhaseStart / (BLINK_SLOW_DURATION_MS * 2)) - 1,
  });

  const fastBlinkTimer = scene.time.delayedCall(fastPhaseStart, () => {
    slowBlink.stop();
    scene.tweens.add({
      targets: player,
      alpha: 0.2,
      duration: BLINK_FAST_DURATION_MS,
      ease: 'Linear',
      yoyo: true,
      repeat: -1,
    });
  });

  scene.time.delayedCall(DAMAGE_COOLDOWN_MS, () => {
    player.invulnerable = false;
    slowBlink.stop();
    fastBlinkTimer.remove();
    scene.tweens.killTweensOf(player);
    player.setAlpha(1);
  });
}

export function killPlayer(scene, player) {
  if (player.isDead) return;

  vibrateDeath();

  const wasFlipped = player.flipX;
  player.isDead = true;
  player.status.life = 0;

  // O corpo físico continua ativo (gravidade + colliders) para que o player
  // caia até encontrar um collider, mesmo tendo morrido no ar (queda ou
  // bullet). Só zeramos a velocidade horizontal: a vertical segue livre.
  player.setVelocityX(0);
  player.clearTint();
  player.isParachuteActive = false;
  player.isJetpackActive = false;
  player.jetpackArmed = false;
  player.jetpackFuelBar?.setVisible(false);
  // A morte não pode inverter o sentido que o player tinha no momento do impacto.
  player.setFlipX(wasFlipped);
  player.anims.play(getEntityAnimationKey(player.entityKey, 'dead'));
  showDeathText(scene, player);

  // Consome uma tentativa da fase (ver GameScene.attemptsLeft/MAX_RUN_ATTEMPTS
  // em constants.js) — some estar sem tentativa nenhuma sobrando decide, lá
  // embaixo no delayedCall, entre respawnar de novo ou abrir o Game Over.
  scene.attemptsLeft = Math.max(0, scene.attemptsLeft - 1);
  scene.game.events.emit(HUD_EVENTS.ATTEMPTS_CHANGED, scene.attemptsLeft, MAX_RUN_ATTEMPTS);

  // Mantém a animação de morte visível por 2 segundos antes do respawn —
  // ou, se essa foi a última tentativa da fase, antes de abrir o Game Over
  // (ver GameOverScreen.js/main.js, que decide "tentar novamente"/"voltar
  // pro mapa"; o Phaser só emite o evento, nunca mexe em DOM — CLAUDE.md
  // regra 1).
  scene.time.delayedCall(2000, () => {
    if (scene.attemptsLeft > 0) {
      scene.scene.restart();
      return;
    }
    scene.scene.pause();
    scene.game.events.emit(GAME_OVER_EVENTS.OPEN, { mapKey: scene.mapKey });
  });
}

// Mantém o texto visível e estável até o player ser revivido. O restart da
// cena limpa este objeto junto com o restante da cena.
function showDeathText(scene, player) {
  createWaveText(scene, 'DEAD', player.x, player.body.top - 5, { color: '#ff3b30' });
}

export function preloadPlayerAssets(scene) {
  Object.keys(PLAYERS_CONFIG).forEach((key) => {
    preloadSpriteSheetAnimations(scene, getPlayerAnimationAssets(key), key);
  });
}

export function createPlayerAnimations(scene) {
  Object.keys(PLAYERS_CONFIG).forEach((key) => {
    createSpriteSheetAnimations(scene, getPlayerAnimationAssets(key), key);
  });
}
