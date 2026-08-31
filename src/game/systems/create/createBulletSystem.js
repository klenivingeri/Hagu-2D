export function createBulletSystem(scene) {
  // Cria de fato o projétil e o lança na direção que o player está olhando.
  const spawnBullet = () => {
    const bullet = scene.bullets.get(scene.player.x, scene.player.y + 5, 'bullet');

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX(450 * scene.lastDirection);
      bullet.angle = 90;
      bullet.setDepth(5);
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

    // Garante que não fiquem múltiplos listeners acumulados de disparos anteriores.
    // (Guardamos a referência no próprio player pois a função é recriada a cada fire().)
    if (player._onBowFrame) {
      player.off('animationupdate', player._onBowFrame);
    }
    player.off('animationcomplete-bow');

    // Só lança o bullet quando a animação "bow" chegar no quadro 3 (bow_3).
    // OBS: o Phaser não tem um evento "animationupdate-bow" por chave (só o
    // "animationcomplete-<key>" tem essa variante); por isso escutamos o
    // evento genérico "animationupdate" e filtramos pela animação atual.
    player._onBowFrame = (anim, frame) => {
      if (anim.key === 'bow' && frame.textureKey === 'bow_3') {
        spawnBullet();
        player.off('animationupdate', player._onBowFrame); // um disparo por animação
      }
    };
    player.on('animationupdate', player._onBowFrame);

    player.once('animationcomplete-bow', () => {
      player.isShooting = false;
    });

    // Toca a animação do zero. Como agora só entramos aqui quando não há
    // nenhum tiro em andamento (guard acima), não precisamos do ignoreIfPlaying.
    player.anims.play('bow');
  };

  scene.input.on('pointerdown', fire);

  return {
    fire,
    update() {
      // Usando getChildren() para retornar um array padrão do JS
      scene.bullets.getChildren().forEach((bullet) => {
        if (!bullet || !bullet.active) return;
        
        // Se o tiro passar da borda direita da tela, esconde e desativa o corpo
        if (bullet.x > scene.scale.width) {
          bullet.setActive(false);
          bullet.setVisible(false);
          bullet.body.enable = false;
        }
      });
    },
  };
}