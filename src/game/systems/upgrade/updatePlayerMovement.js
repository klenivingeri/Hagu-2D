import { getEntityAnimationKey } from '../../config/entities.js';
import { emitDustTrail } from '../../commons/dustTrail.js';
import { updateJetpackFuelBar } from '../../commons/jetpackBar.js';
import { killPlayer } from '../create/createPlayer.js';

// Folga (px/s) em torno de velocity.y=0 considerada "ápice" do pulo.
const JUMP_APEX_THRESHOLD = 20;

export const updatePlayerMovement = (scene) => {
    const player = scene.player;

    // Enquanto o player está nascendo (animação "spawn"), ele fica travado:
    // sem correr, pular ou ter o frame trocado por baixo da animação.
    if (!player || player.isDead || player.isSpawning) return;

    const left = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const right = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const wasGrounded = player.body.blocked.down || player.body.touching.down;
    const wasWallSliding = player.isWallSliding;
    // Guardado antes da lógica do paraquedas reatribuir isParachuteActive:
    // usado só pra detectar a borda de subida (abriu agora) na animação,
    // sem isso o repeat:0 da animação seria ignorado (ver mais abaixo).
    const wasParachuteActive = player.isParachuteActive;
    const now = scene.time.now;

    // Enquanto o paraquedas/jetpack está ativo (estado decidido no frame
    // anterior), a distância de queda não conta pra morte: o ponto de
    // referência anda junto com o player a cada frame. Quando a habilidade
    // para de ser usada (solta, acaba o combustível ou pousa), o último
    // valor gravado aqui fica congelado e passa a valer como novo início
    // de queda.
    if (player.isParachuteActive || player.isJetpackActive) {
      player.fallStartY = player.body.bottom;
    }

    // Calcula o contato com a parede antes de iniciar o rastreamento da queda.
    // O lado precisa vir do contato real com o tile neste frame. Assim que a
    // layer de parede termina, o player perde a aderência imediatamente.
    const wallSide = player.stickableWallSide;
    player.stickableWallSide = 0;
    const isHoldingTowardWall = wallSide === -1 ? right : wallSide === 1 ? left : false;
    const canStickToWall = player.status.isStick
        && !wasGrounded
        && wallSide !== 0
        && isHoldingTowardWall
        && (player.isWallSliding || player.lastWallSide !== wallSide);
    const wallSlidingThisFrame = canStickToWall && !wasGrounded;

    // Guarda a altura do último piso. Quando o player volta a tocar no chão,
    // a diferença é usada para decidir se a queda foi fatal.
    if (wasGrounded) {
      if (!wasWallSliding && player.fallStartY !== null) {
        const fallDistance = player.body.bottom - player.fallStartY;
        const tileHeight = scene.map?.tileHeight || 16;
        const maxSafeFallDistance = player.status.maxSafeFallTiles * tileHeight;
        if (fallDistance > maxSafeFallDistance) {
          const deathDirection = scene.controlState.right || scene.keys.D.isDown || scene.cursors.right.isDown
            ? 1
            : scene.controlState.left || scene.keys.A.isDown || scene.cursors.left.isDown
              ? -1
              : 0;
          // Força uma nova emissão mesmo que o último rastro tenha acabado
          // de sair, para marcar visualmente o ponto do impacto.
          emitDustTrail(scene, player, 'horizontal', true, null, deathDirection);
          killPlayer(scene, player, 'dead_jump', deathDirection);
          return;
        }
      }
      player.fallStartY = null;
      player.lastGroundedBottom = player.body.bottom;
    } else if (wasWallSliding && !wallSlidingThisFrame) {
      // A queda só começa a ser medida depois que o player desgruda da parede.
      // O ponto de partida é a posição atual, e não o último chão tocado.
      player.fallStartY = player.body.bottom;
    } else if (wallSlidingThisFrame) {
      player.fallStartY = null;
    } else if (player.fallStartY === null) {
      // Também cobre o caso em que o player simplesmente saiu da beirada.
      player.fallStartY = player.lastGroundedBottom ?? player.body.bottom;
    }

    if (wasGrounded) {
      player.lastGroundedAt = now;
      // O próximo período no ar ganha novamente um pulo extra.
      player.hasUsedDoubleJump = false;
    }

    const canUseCoyoteJump = !wasGrounded
      && now - player.lastGroundedAt <= player.status.coyoteTimeMs;
    // Ao pousar no topo de um chão/plataforma, a tentativa da parede é
    // reiniciada. Assim, depois de falhar e cair, pode tentar a mesma parede.
    if (wasGrounded) {
        player.lastWallSide = 0;
    }
    // blocked.left/right sozinho não informa qual layer causou o contato.
    // Este valor só é preenchido pelo collider de obstacles.
    let startedJump = false;

    // Ao apertar pulo na parede, lança o player para o lado oposto ao contato.
    // O comando é consumido mais abaixo, então continua sendo um pulo por toque.
    if (scene.controlState.jump && canStickToWall) {
        player.setVelocity(
            wallSide === -1 ? player.status.wallJumpHorizontalSpeed : -player.status.wallJumpHorizontalSpeed,
            -player.status.jumpHeight
        );
        // O pulo de parede já é o momento em que a queda deixa de ser
        // protegida pela parede; a partir daqui a distância passa a contar.
        player.fallStartY = player.body.bottom;
        player.isWallSliding = false;
        player.isShooting = false;
        player.setFlipX(wallSide === 1);
        scene.lastDirection = wallSide === -1 ? 1 : -1;
        scene.sound.play('jump');
        emitDustTrail(scene, player, 'horizontal', true);
        startedJump = true;
    }
    
    // --- Movimento Horizontal ---
    if (!startedJump && left) {
      player.setVelocityX(-player.status.speed);
      player.setFlipX(true); // Vira a imagem para a esquerda
      scene.lastDirection = -1;
    } else if (!startedJump && right) {
      player.setVelocityX(player.status.speed);
      player.setFlipX(false); // Mantém a imagem normal para a direita
      scene.lastDirection = 1;
    } else if (!startedJump) {
      player.setVelocityX(0);
    }

    // Enquanto houver contato lateral e o player estiver no ar, limita a queda.
    // O velocity.y normal continua sendo usado para o salto; apenas a descida
    // fica lenta, permitindo a troca de uma parede para a outra.
    if (canStickToWall && !startedJump) {
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
    } else if (!canStickToWall) {
        player.isWallSliding = false;
    }

    // --- Movimento de Pulo (Disparo Único Blindado) ---
    // Verificamos se scene.controlState.jump é true (ele é ativado apenas 1 vez por toque ou por clique de tecla)
    if (scene.controlState.jump && (wasGrounded || canUseCoyoteJump)) {
      player.setVelocityY(-player.status.jumpHeight);
      player.isShooting = false; // Pulo interrompe o disparo de arco em andamento
      scene.sound.play('jump');
      emitDustTrail(scene, player, 'horizontal', true);
      startedJump = true;
      //scene.player.setTexture('run_0'); // Define um frame estático de parado
    }

    // Um pulo extra fica disponível durante todo o período no ar: tanto faz
    // se o player saiu do chão pulando ou simplesmente caiu de uma borda.
    // Independente do paraquedas — as duas mecânicas não competem entre si.
    if (scene.controlState.jump
      && !startedJump
      && !wasGrounded
      && player.status.isDoubleJump
      && !player.hasUsedDoubleJump) {
      player.setVelocityY(-player.status.jumpHeight);
      player.hasUsedDoubleJump = true;
      player.isShooting = false;
      scene.sound.play('jump');
      emitDustTrail(scene, player, 'horizontal', true);
      startedJump = true;
    }

    const jumpHeld = scene.cursors.up?.isDown
      || scene.keys.W.isDown
      || scene.spaceKey.isDown
      || scene.controlState.jumpHeld;

    // --- Paraquedas: só freia a queda, não impulsiona pra cima ---
    // Segurando o pulo enquanto está caindo no ar, a queda fica mais lenta.
    // Só pode ser aberto uma vez por período no ar: soltar o botão no meio
    // da queda e apertar de novo NÃO reabre. Só volta a ficar disponível
    // depois de colidir com uma layer (chão ou parede), que é justamente
    // quando o player consegue pular de novo.
    if (wasGrounded || wallSide !== 0) {
      player.isParachuteActive = false;
      player.hasUsedParachute = false;
    } else {
      const isFalling = player.body.velocity.y > player.status.parachuteFloatSpeed;
      // hasUsedParachute só bloqueia REABRIR depois de soltar. Enquanto já
      // está aberto (isParachuteActive), continuar segurando não conta como
      // reabertura, senão o paraquedas fecharia sozinho no primeiro frame.
      // Tomar dano desliga o paraquedas: enquanto durar a invulnerabilidade
      // (mesma janela do piscar), a queda volta a ser normal.
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
    // O pulo normal continua igual (sobe do chão do jeito de sempre). O
    // jetpack só entra em jogo depois: precisa apertar pulo DE NOVO já no
    // ar (armar) — segurando depois disso, o jetpack fica ativo. Diferente
    // do paraquedas (só freia queda), o jetpack sobe mesmo que o player não
    // esteja caindo, mas só recarrega e desarma no chão.
    if (wasGrounded) {
      player.jetpackFuel = player.status.jetpackFuelMs;
      player.isJetpackActive = false;
      player.jetpackArmed = false;
    } else {
      if (!player.jetpackArmed && !startedJump && scene.controlState.jump && player.status.isJetpack) {
        player.jetpackArmed = true;
      }

      // Tomar dano desliga o jetpack: enquanto durar a invulnerabilidade
      // (mesma janela do piscar), o player volta a cair normalmente.
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

    updateJetpackFuelBar(player);

    // No ar, jump tem prioridade sobre run e idle.
    if (!player.isShooting) {
      const isAirborne = startedJump || !player.body.blocked.down;

      if (player.isWallSliding) {
        const stickAnimation = getEntityAnimationKey(player.entityKey, 'stick');
        if (player.anims.currentAnim?.key !== stickAnimation) {
          player.anims.play(stickAnimation, true);
        }
      } else if (player.isParachuteActive) {
        // Só (re)inicia a animação na borda de subida (acabou de abrir).
        // A animação usa repeat:0 (abre uma vez e congela no último frame
        // enquanto continua caindo) — chamar play() de novo a cada frame,
        // mesmo com a mesma key, reiniciaria o repeat:0 em loop.
        if (!wasParachuteActive) {
          const parachuteAnimation = getEntityAnimationKey(player.entityKey, 'parachute');
          player.anims.play(parachuteAnimation, true);
        }
      } else if (isAirborne) {
        // Frame do pulo é escolhido pela velocidade vertical, não por uma
        // animação tocando sozinha: hop_0 subindo, hop_1 no ápice (perto de
        // vy=0) e hop_2 caindo. JUMP_APEX_THRESHOLD é a folga em torno de
        // vy=0 considerada "ápice", pra não piscar hop_0/hop_2 num único frame.
        const velocityY = player.body.velocity.y;
        const hopFrame = velocityY < -JUMP_APEX_THRESHOLD ? 0 : velocityY > JUMP_APEX_THRESHOLD ? 2 : 1;
        const jumpTextureKey = `${getEntityAnimationKey(player.entityKey, 'jump')}_${hopFrame}`;
        if (player.anims.isPlaying) player.anims.stop();
        if (player.texture.key !== jumpTextureKey) {
          player.setTexture(jumpTextureKey);
        }
      } else if (left || right) {
        if (wasGrounded) {
          emitDustTrail(scene, player, 'horizontal');
        }
        player.anims.play(getEntityAnimationKey(player.entityKey, 'run'), true);
      } else {
        player.anims.play(getEntityAnimationKey(player.entityKey, 'idle'), true);
      }
    }

    // IMPORTANTE: Consome o comando imediatamente. 
    // Isso garante que mesmo segurando o botão ou a tecla, a flag é apagada no mesmo frame, 
    // exigindo soltar e apertar novamente para um novo pulo.
    scene.controlState.jump = false;
}
