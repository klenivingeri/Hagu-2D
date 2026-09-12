import { getEntityAnimationKey } from '../../config/entities.js';
import { emitDustTrail } from '../../commons/dustTrail.js';
import { updateJetpackFuelBar } from '../../commons/jetpackBar.js';
import { killPlayer } from '../create/createPlayer.js';
import { getTiledProperty } from '../../commons/tiledUtils.js';

// Folga (px/s) em torno de velocity.y=0 considerada "ápice" do pulo.
const JUMP_APEX_THRESHOLD = 20;
// Ganho/perda de velocidade horizontal (px/s²) enquanto o player está sobre
// um tile de gelo. Quanto menor, mais ele escorrega antes de parar ou
// atingir a velocidade máxima.
const ICE_ACCELERATION = 250;

// Orquestra um frame de movimento do player: cada regra (queda/morte,
// parede, pulo, gelo, paraquedas, jetpack, animação) vive na sua própria
// função abaixo, na MESMA ordem em que era decidida quando isso tudo era
// uma função só — mexer nessa ordem muda o comportamento (ex: startedJump
// precisa refletir só o pulo de parede antes do movimento horizontal, mas
// já o resultado final antes da animação).
export const updatePlayerMovement = (scene) => {
  const player = scene.player;

  // Enquanto o player está nascendo (animação "spawn"), ele fica travado:
  // sem correr, pular ou ter o frame trocado por baixo da animação.
  if (!player || player.isDead || player.isSpawning) return;

  const input = readMovementInput(scene);
  const wasGrounded = player.body.blocked.down || player.body.touching.down;
  const wasWallSliding = player.isWallSliding;
  // Guardado antes da lógica do paraquedas reatribuir isParachuteActive:
  // usado só pra detectar a borda de subida (abriu agora) na animação, sem
  // isso o repeat:0 da animação seria ignorado (ver updateAnimation).
  const wasParachuteActive = player.isParachuteActive;

  syncFallStartWhileAirborneAbility(player);

  const wallSide = consumeWallContact(player);
  const isHoldingTowardWall = wallSide === -1 ? input.right : wallSide === 1 ? input.left : false;
  const canStickToWall = player.status.isStick
    && !wasGrounded
    && wallSide !== 0
    && isHoldingTowardWall
    && (player.isWallSliding || player.lastWallSide !== wallSide);
  const wallSlidingThisFrame = canStickToWall && !wasGrounded;

  const died = updateFallTracking(scene, player, { wasGrounded, wasWallSliding, wallSlidingThisFrame, input });
  if (died) return;

  if (wasGrounded) {
    // O próximo período no ar ganha novamente um pulo extra. Pousar também
    // reinicia a tentativa de parede: pode tentar a mesma parede de novo.
    player.lastGroundedAt = scene.time.now;
    player.hasUsedDoubleJump = false;
    player.lastWallSide = 0;
  }
  const canUseCoyoteJump = !wasGrounded
    && scene.time.now - player.lastGroundedAt <= player.status.coyoteTimeMs;

  let startedJump = tryWallJump(scene, player, { canStickToWall, wallSide });

  const isOnIce = isPlayerOnIce(scene, player, wasGrounded);
  if (!startedJump) {
    applyHorizontalMovement(scene, player, { input, isOnIce });
  }

  applyWallSlide(scene, player, { canStickToWall, startedJump, wallSide });

  startedJump = tryGroundOrCoyoteJump(scene, player, { wasGrounded, canUseCoyoteJump, startedJump });
  startedJump = tryDoubleJump(scene, player, { wasGrounded, startedJump });

  const jumpHeld = isJumpHeld(scene);
  updateParachute(scene, player, { wasGrounded, wallSide, jumpHeld });
  updateJetpack(scene, player, { wasGrounded, startedJump, jumpHeld });
  updateJetpackFuelBar(player);

  updateAnimation(scene, player, { startedJump, wasGrounded, wasParachuteActive, input });

  // IMPORTANTE: Consome o comando imediatamente. Isso garante que mesmo
  // segurando o botão ou a tecla, a flag é apagada no mesmo frame, exigindo
  // soltar e apertar novamente para um novo pulo.
  scene.controlState.jump = false;
};

export function readMovementInput(scene) {
  return {
    left: scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left,
    right: scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right,
  };
}

// Enquanto paraquedas/jetpack está ativo, a distância de queda não conta pra
// morte: o ponto de referência anda junto com o player a cada frame.
export function syncFallStartWhileAirborneAbility(player) {
  if (player.isParachuteActive || player.isJetpackActive) {
    player.fallStartY = player.body.bottom;
  }
}

// O lado precisa vir do contato real com o tile neste frame (setado pelo
// collider da layer obstacles em createPlayer.js) — assim que a parede
// termina, o player perde a aderência imediatamente.
export function consumeWallContact(player) {
  const wallSide = player.stickableWallSide;
  player.stickableWallSide = 0;
  return wallSide;
}

// Guarda a altura do último piso; ao voltar a tocar o chão, a diferença
// decide se a queda foi fatal. Retorna true se o player morreu aqui (e o
// update deve parar imediatamente).
export function updateFallTracking(scene, player, { wasGrounded, wasWallSliding, wallSlidingThisFrame, input }) {
  if (wasGrounded) {
    if (!wasWallSliding && player.fallStartY !== null && didFallTooFar(scene, player)) {
      const deathDirection = input.right ? 1 : input.left ? -1 : 0;
      // Força uma nova emissão mesmo que o último rastro tenha acabado de
      // sair, para marcar visualmente o ponto do impacto.
      emitDustTrail(scene, player, 'horizontal', true, null, deathDirection);
      killPlayer(scene, player, 'dead_jump', deathDirection);
      return true;
    }
    player.fallStartY = null;
    player.lastGroundedBottom = player.body.bottom;
  } else if (wasWallSliding && !wallSlidingThisFrame) {
    // A queda só começa a ser medida depois que o player desgruda da
    // parede. O ponto de partida é a posição atual, e não o último chão
    // tocado.
    player.fallStartY = player.body.bottom;
  } else if (wallSlidingThisFrame) {
    player.fallStartY = null;
  } else if (player.fallStartY === null) {
    // Também cobre o caso em que o player simplesmente saiu da beirada.
    player.fallStartY = player.lastGroundedBottom ?? player.body.bottom;
  }
  return false;
}

export function didFallTooFar(scene, player) {
  const fallDistance = player.body.bottom - player.fallStartY;
  const tileHeight = scene.map?.tileHeight || 16;
  const maxSafeFallDistance = player.status.maxSafeFallTiles * tileHeight;
  return fallDistance > maxSafeFallDistance;
}

// Ao apertar pulo na parede, lança o player para o lado oposto ao contato.
// O comando é consumido no fim do frame, então continua sendo um pulo por
// toque.
export function tryWallJump(scene, player, { canStickToWall, wallSide }) {
  if (!scene.controlState.jump || !canStickToWall) return false;

  player.setVelocity(
    wallSide === -1 ? player.status.wallJumpHorizontalSpeed : -player.status.wallJumpHorizontalSpeed,
    -player.status.jumpHeight
  );
  // O pulo de parede já é o momento em que a queda deixa de ser protegida
  // pela parede; a partir daqui a distância passa a contar.
  player.fallStartY = player.body.bottom;
  player.isWallSliding = false;
  player.isShooting = false;
  player.setFlipX(wallSide === 1);
  scene.lastDirection = wallSide === -1 ? 1 : -1;
  scene.sound.play('jump');
  emitDustTrail(scene, player, 'horizontal', true);
  return true;
}

// No chão, olha o tile de GROUND embaixo dos pés: com a propriedade "ice",
// o ganho/perda de velocidade vira gradual (escorrega) em vez de
// instantâneo.
export function isPlayerOnIce(scene, player, wasGrounded) {
  const groundTile = wasGrounded && scene.groundLayer
    ? scene.groundLayer.getTileAtWorldXY(player.body.center.x, player.body.bottom + 1)
    : null;
  return !!getTiledProperty(groundTile?.properties, 'ice');
}

export function applyHorizontalMovement(scene, player, { input, isOnIce }) {
  const { left, right } = input;
  const targetVelocityX = left ? -player.status.speed : right ? player.status.speed : 0;

  if (isOnIce) {
    const maxDelta = ICE_ACCELERATION * (scene.game.loop.delta / 1000);
    const diff = targetVelocityX - player.body.velocity.x;
    const change = Math.sign(diff) * Math.min(Math.abs(diff), maxDelta);
    player.setVelocityX(player.body.velocity.x + change);
  } else {
    player.setVelocityX(targetVelocityX);
  }

  if (left) {
    player.setFlipX(true);
    scene.lastDirection = -1;
  } else if (right) {
    player.setFlipX(false);
    scene.lastDirection = 1;
  }
}

// Enquanto houver contato lateral e o player estiver no ar, limita a queda.
// O velocity.y normal continua sendo usado para o salto; apenas a descida
// fica lenta, permitindo a troca de uma parede para a outra.
export function applyWallSlide(scene, player, { canStickToWall, startedJump, wallSide }) {
  if (!canStickToWall) {
    player.isWallSliding = false;
    return;
  }
  if (startedJump) return;

  if (!player.isWallSliding) {
    player.lastWallSide = wallSide;
  }
  player.isWallSliding = true;
  if (player.body.velocity.y > player.status.wallSlideSpeed) {
    player.setVelocityY(player.status.wallSlideSpeed);
  }
  if (player.body.velocity.y >= 0) {
    emitDustTrail(scene, player, 'vertical');
  }
}

// --- Movimento de Pulo (Disparo Único Blindado) ---
export function tryGroundOrCoyoteJump(scene, player, { wasGrounded, canUseCoyoteJump, startedJump }) {
  if (!scene.controlState.jump || !(wasGrounded || canUseCoyoteJump)) return startedJump;

  player.setVelocityY(-player.status.jumpHeight);
  player.isShooting = false; // Pulo interrompe o disparo de arco em andamento
  scene.sound.play('jump');
  emitDustTrail(scene, player, 'horizontal', true);
  return true;
}

// Um pulo extra fica disponível durante todo o período no ar: tanto faz se
// o player saiu do chão pulando ou simplesmente caiu de uma borda.
// Independente do paraquedas — as duas mecânicas não competem entre si.
export function tryDoubleJump(scene, player, { wasGrounded, startedJump }) {
  if (startedJump
    || !scene.controlState.jump
    || wasGrounded
    || !player.status.isDoubleJump
    || player.hasUsedDoubleJump) return startedJump;

  player.setVelocityY(-player.status.jumpHeight);
  player.hasUsedDoubleJump = true;
  player.isShooting = false;
  scene.sound.play('jump');
  emitDustTrail(scene, player, 'horizontal', true);
  return true;
}

export function isJumpHeld(scene) {
  return scene.cursors.up?.isDown
    || scene.keys.W.isDown
    || scene.spaceKey.isDown
    || scene.controlState.jumpHeld;
}

// --- Paraquedas: só freia a queda, não impulsiona pra cima ---
// Segurando o pulo enquanto está caindo no ar, a queda fica mais lenta. Só
// pode ser aberto uma vez por período no ar: soltar o botão no meio da
// queda e apertar de novo NÃO reabre. Só volta a ficar disponível depois de
// colidir com uma layer (chão ou parede), que é justamente quando o player
// consegue pular de novo.
export function updateParachute(scene, player, { wasGrounded, wallSide, jumpHeld }) {
  if (wasGrounded || wallSide !== 0) {
    player.isParachuteActive = false;
    player.hasUsedParachute = false;
    return;
  }

  const isFalling = player.body.velocity.y > player.status.parachuteFloatSpeed;
  // hasUsedParachute só bloqueia REABRIR depois de soltar. Tomar dano
  // desliga o paraquedas enquanto durar a invulnerabilidade (mesma janela
  // do piscar) — a queda volta a ser normal.
  const canUseParachute = player.status.isParachute
    && jumpHeld
    && isFalling
    && (player.isParachuteActive || !player.hasUsedParachute)
    && !player.invulnerable;

  if (canUseParachute) {
    player.isParachuteActive = true;
    player.hasUsedParachute = true;
    player.setVelocityY(player.status.parachuteFloatSpeed);
  } else {
    player.isParachuteActive = false;
  }
}

// --- Jetpack: impulsiona o player pra cima enquanto durar o combustível ---
// O pulo normal continua igual (sobe do chão do jeito de sempre). O jetpack
// só entra em jogo depois: precisa apertar pulo DE NOVO já no ar (armar) —
// segurando depois disso, o jetpack fica ativo. Diferente do paraquedas (só
// freia queda), o jetpack sobe mesmo que o player não esteja caindo, mas só
// recarrega e desarma no chão.
export function updateJetpack(scene, player, { wasGrounded, startedJump, jumpHeld }) {
  if (wasGrounded) {
    player.jetpackFuel = player.status.jetpackFuelMs;
    player.isJetpackActive = false;
    player.jetpackArmed = false;
    return;
  }

  if (!player.jetpackArmed && !startedJump && scene.controlState.jump && player.status.isJetpack) {
    player.jetpackArmed = true;
  }

  // Tomar dano desliga o jetpack: enquanto durar a invulnerabilidade (mesma
  // janela do piscar), o player volta a cair normalmente.
  const canUseJetpack = player.status.isJetpack
    && player.jetpackArmed
    && jumpHeld
    && player.jetpackFuel > 0
    && !player.invulnerable;

  if (canUseJetpack) {
    player.isJetpackActive = true;
    player.jetpackFuel = Math.max(0, player.jetpackFuel - scene.game.loop.delta);
    player.setVelocityY(player.status.jetpackLiftSpeed);
  } else {
    player.isJetpackActive = false;
  }
}

// No ar, jump tem prioridade sobre run e idle.
export function updateAnimation(scene, player, { startedJump, wasGrounded, wasParachuteActive, input }) {
  if (player.isShooting) return;

  const isAirborne = startedJump || !player.body.blocked.down;

  if (player.isWallSliding) {
    const stickAnimation = getEntityAnimationKey(player.entityKey, 'stick');
    if (player.anims.currentAnim?.key !== stickAnimation) {
      player.anims.play(stickAnimation, true);
    }
  } else if (player.isParachuteActive) {
    // Só (re)inicia a animação na borda de subida (acabou de abrir). A
    // animação usa repeat:0 (abre uma vez e congela no último frame
    // enquanto continua caindo) — chamar play() de novo a cada frame,
    // mesmo com a mesma key, reiniciaria o repeat:0 em loop.
    if (!wasParachuteActive) {
      player.anims.play(getEntityAnimationKey(player.entityKey, 'parachute'), true);
    }
  } else if (isAirborne) {
    playJumpFrame(player);
  } else if (input.left || input.right) {
    if (wasGrounded) emitDustTrail(scene, player, 'horizontal');
    player.anims.play(getEntityAnimationKey(player.entityKey, 'run'), true);
  } else {
    player.anims.play(getEntityAnimationKey(player.entityKey, 'idle'), true);
  }
}

// Frame do pulo é escolhido pela velocidade vertical, não por uma animação
// tocando sozinha: hop_0 subindo, hop_1 no ápice (perto de vy=0) e hop_2
// caindo. JUMP_APEX_THRESHOLD é a folga em torno de vy=0 considerada
// "ápice", pra não piscar hop_0/hop_2 num único frame.
export function playJumpFrame(player) {
  const velocityY = player.body.velocity.y;
  const hopFrame = velocityY < -JUMP_APEX_THRESHOLD ? 0 : velocityY > JUMP_APEX_THRESHOLD ? 2 : 1;
  const jumpTextureKey = getEntityAnimationKey(player.entityKey, 'jump');
  if (player.anims.isPlaying) player.anims.stop();
  if (player.texture.key !== jumpTextureKey || player.frame.name !== hopFrame) {
    player.setTexture(jumpTextureKey, hopFrame);
  }
}
