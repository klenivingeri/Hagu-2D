export function createBulletSystem(scene) {
  const fire = () => {
    // Pega um tiro disponível no pool ou cria um novo
    const bullet = scene.bullets.get(scene.player.x, scene.player.y+5, 'bullet');

    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.enable = true; 
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX(450 * scene.lastDirection);
      bullet.angle = 90;
      bullet.setDepth(5);
    }

    // Troca a animação do player para "bow" ao atirar.
    const player = scene.player;
    if (player && !player.isDead) {
      player.setFlipX(scene.lastDirection === -1);
      player.isShooting = true;

      // Garante que não fiquem múltiplos listeners acumulados de disparos anteriores.
      player.off('animationcomplete-bow');
      player.once('animationcomplete-bow', () => {
        player.isShooting = false;
      });

      player.anims.play('bow', true);
    }
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