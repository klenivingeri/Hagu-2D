import { getEntityAnimationKey } from '../../config/entities.js';
import { emitBulletImpactDust, emitDryFireBurst } from '../../commons/dustTrail.js';
import { MAP_DEPTHS, HUD_EVENTS } from '../../../constants.js';

export function createBulletSystem(scene) {
  // O tiro colide fisicamente com o cenário. Cada layer colidível usa um
  // callback próprio para garantir que o efeito aconteça somente em tiles,
  // nunca no overlap com inimigos.
  scene.platforms.forEach((colliderLayer) => {
    scene.physics.add.collider(scene.bullets, colliderLayer, (bullet) => {
      if (!bullet?.active) return;

      emitBulletImpactDust(scene, bullet, Math.sign(bullet.body?.velocity.x || scene.lastDirection));
      scene.sound.play('tap');
      destroyBullet(bullet);
    });
  });

  scene.physics.add.overlap(scene.bullets, scene.player, (player, bullet) => {
    if (!bullet?.active || bullet.owner !== 'enemy') return;
    destroyBullet(bullet);
    scene.damagePlayer?.(bullet.damage || 1);
  });

  // Cria de fato o projétil e o lança na direção que o player está olhando.
  const spawnBullet = () => {
    const player = scene.player;
    if (player.status.currentAljavaBullet <= 0) {
      emitDryFireBurst(scene, player);
      scene.sound.play('dry_fire_1');
      scene.game.events.emit(HUD_EVENTS.AMMO_EMPTY);
      return;
    }
    const bullet = scene.bullets.get(scene.player.x, scene.player.y + 5, 'bullet');

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX(450 * player._shootDirection);
      bullet.owner = 'player';
      bullet.angle = 90;
      // O projétil usa a mesma camada visual do player: fica na frente do
      // que o player vê à frente e atrás do que cobre o player.
      bullet.setDepth(scene.player.depth ?? MAP_DEPTHS.PLAYER);
      bullet.damage = scene.player.status.bulletDamage; // dano que esse tiro carrega
      // Carrega o progresso que já tinha sido acumulado pra próxima flecha
      // (ex: barra em 3/4 quase completando a 4ª) pro slot que acabou de
      // esvaziar, em vez de descartar e recomeçar o carregamento do zero —
      // senão o disparo parece "gastar 2 flechas" na barra.
      const carriedProgress = reloadProgressOf(player, scene);
      player.status.currentAljavaBullet -= 1;
      player._nextBulletReloadAt = scene.time.now + player.status.LoadingBullet * (1 - carriedProgress);
      // Emite de imediato pra barra cair na hora do disparo; a partir daqui
      // update() assume e faz ela subir suavemente até a próxima flecha.
      emitAmmoHud(scene, player);
      scene.sound.play('bullet_effect_1');
    }
  };

  const fire = () => {
    const player = scene.player;
    if (!player || player.isDead) return;

    // Ainda nascendo: não deixa atirar por cima da animação de spawn.
    if (player.isSpawning) return;

    // Já está no meio de uma animação de disparo: ignora o clique
    // até a animação atual terminar (evita reiniciar e perder o bullet).
    if (player.isShooting) return;

    // Enquanto estiver grudado, o tiro sai para o lado oposto da parede.
    // `lastWallSide` indica o lado para o qual o player deve se afastar:
    // -1 = parede à direita, +1 = parede à esquerda.
    const isGrounded = player.body.blocked.down || player.body.touching.down;
    const attachedWallSide = player.isWallSliding
      ? player.lastWallSide
      : (!isGrounded ? player.stickableWallSide : 0);
    const holdingLeft = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const holdingRight = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const heldDirection = holdingLeft ? -1 : holdingRight ? 1 : 0;
    player._shootDirection = attachedWallSide
      ? (heldDirection ? -heldDirection : -attachedWallSide)
      : scene.lastDirection;
    player.setFlipX(player._shootDirection === -1);
    player.isShooting = true;
    const bowAnimation = getEntityAnimationKey(player.entityKey, 'bow');
    const bowFrame = `${bowAnimation}_3`;

    // Garante que não fiquem múltiplos listeners acumulados de disparos anteriores.
    // (Guardamos a referência no próprio player pois a função é recriada a cada fire().)
    if (player._onBowFrame) {
      player.off('animationupdate', player._onBowFrame);
    }
    player.off(`animationcomplete-${bowAnimation}`);

    // Só lança o bullet quando a animação "bow" chegar no quadro 3 (bow_3).
    // OBS: o Phaser não tem um evento "animationupdate-bow" por chave (só o
    // "animationcomplete-<key>" tem essa variante); por isso escutamos o
    // evento genérico "animationupdate" e filtramos pela animação atual.
    player._onBowFrame = (anim, frame) => {
      if (anim.key === bowAnimation && frame.textureKey === bowFrame) {
        spawnBullet();
        player.off('animationupdate', player._onBowFrame); // um disparo por animação
      }
    };
    player.on('animationupdate', player._onBowFrame);

    player.once(`animationcomplete-${bowAnimation}`, () => {
      player.isShooting = false;
    });

    // Toca a animação do zero. Como agora só entramos aqui quando não há
    // nenhum tiro em andamento (guard acima), não precisamos do ignoreIfPlaying.
    player.anims.play(bowAnimation);
  };

  scene.input.on('pointerdown', fire);

  return {
    fire,
    fireEnemy(enemy, direction) {
      const bullet = scene.bullets.get(enemy.body.center.x + direction * 8, enemy.body.center.y, 'bullet');
      if (!bullet) return;
      const config = enemy.entityConfig?.projectile || {};
      bullet.setActive(true).setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX((Number(config.speed) || 300) * direction);
      bullet.owner = 'enemy';
      bullet.damage = Number(enemy.entityConfig?.attack?.damage ?? config.damage) || 1;
      bullet.angle = direction < 0 ? 270 : 90;
      bullet.setDepth(enemy.depth ?? MAP_DEPTHS.PLAYER);
    },
    update() {
      const player = scene.player;
      if (player) {
        if (player.status.currentAljavaBullet < player.status.AljavaBullet
          && scene.time.now >= (player._nextBulletReloadAt || Infinity)) {
          player.status.currentAljavaBullet += 1;
          player._nextBulletReloadAt = player.status.currentAljavaBullet < player.status.AljavaBullet
            ? scene.time.now + player.status.LoadingBullet
            : 0;
        }
        // A cada frame reemite a munição somando a fração já carregada da
        // próxima flecha, pra barra encher continuamente em vez de saltar
        // só quando a flecha inteira termina de carregar.
        emitAmmoHud(scene, player);
      }

      // Usando getChildren() para retornar um array padrão do JS
      scene.bullets.getChildren().forEach((bullet) => {
        if (!bullet || !bullet.active) return;
        
        // Se o tiro passar da borda direita da tela, esconde e desativa o corpo
        if (bullet.x > scene.scale.width) {
          destroyBullet(bullet);
        }
      });
    },
  };
}

// Progresso (0..1) já carregado da flecha que está recarregando agora.
function reloadProgressOf(player, scene) {
  const isReloading = player.status.currentAljavaBullet < player.status.AljavaBullet && player._nextBulletReloadAt;
  if (!isReloading) return 0;
  return 1 - Math.min(1, Math.max(0, (player._nextBulletReloadAt - scene.time.now) / player.status.LoadingBullet));
}

// Munição exibida no HUD como fração contínua: munição inteira + progresso
// (0..1) da flecha que está carregando no momento, pra barra encher aos
// poucos em vez de pular só quando uma flecha inteira termina de recarregar.
function emitAmmoHud(scene, player) {
  const maxAmmo = player.status.AljavaBullet;
  const displayAmmo = player.status.currentAljavaBullet + reloadProgressOf(player, scene);

  // Evita reemitir (e reescrever o DOM) quando o valor não mudou de forma perceptível.
  if (player._lastHudAmmo !== undefined && Math.abs(player._lastHudAmmo - displayAmmo) < 0.001) return;
  player._lastHudAmmo = displayAmmo;
  scene.game.events.emit(HUD_EVENTS.AMMO_CHANGED, displayAmmo, maxAmmo);
}

function destroyBullet(bullet) {
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.body.enable = false;
  bullet.setPosition(-1000, -1000);
}
