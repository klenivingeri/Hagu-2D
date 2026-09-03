import { getEntityAnimationKey } from '../../config/entities.js';
import { emitBulletImpactDust } from '../../commons/dustTrail.js';
import { MAP_DEPTHS } from '../../../constants.js';

export function createBulletSystem(scene) {
  // O tiro colide fisicamente com o cenário. Cada layer colidível usa um
  // callback próprio para garantir que o efeito aconteça somente em tiles,
  // nunca no overlap com inimigos.
  scene.platforms.forEach((colliderLayer) => {
    scene.physics.add.collider(scene.bullets, colliderLayer, (bullet) => {
      if (!bullet?.active) return;

      emitBulletImpactDust(scene, bullet, Math.sign(bullet.body?.velocity.x || scene.lastDirection));
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
    const bullet = scene.bullets.get(scene.player.x, scene.player.y + 5, 'bullet');

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX(450 * scene.lastDirection);
      bullet.owner = 'player';
      bullet.angle = 90;
      // O projétil usa a mesma camada visual do player: fica na frente do
      // que o player vê à frente e atrás do que cobre o player.
      bullet.setDepth(scene.player.depth ?? MAP_DEPTHS.PLAYER);
      bullet.damage = scene.player.status.bulletDamage; // dano que esse tiro carrega
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

    player.setFlipX(scene.lastDirection === -1);
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

function destroyBullet(bullet) {
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.body.enable = false;
  bullet.setPosition(-1000, -1000);
}
