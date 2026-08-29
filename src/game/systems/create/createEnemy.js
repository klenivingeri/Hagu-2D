export function createEnemy(scene) {
  const enemy = scene.physics.add.sprite(scene.scale.width - 200, scene.scale.height - 200, 'enemy_run_0');

  enemy.setCollideWorldBounds(true);
  enemy.body.velocity.x = -150;

  // --- ADICIONE ESTAS DUAS LINHAS AQUI ---
  enemy.setFlipX(true);                // Inicia virado para a esquerda (já que vai para a esquerda)
  enemy.anims.play('enemy_run', true); // Já começa animando desde o nascimento

  scene.physics.add.collider(enemy, scene.limits);
  scene.physics.add.collider(enemy, scene.platforms);

  if (scene.inimigoOverlap) {
    scene.inimigoOverlap.destroy(); // Remove o overlap antigo do inimigo morto
  }
  scene.inimigoOverlap = scene.physics.add.overlap(
    scene.bullets,
    enemy,
    (bullet, inimigo) => {
      bulletDestroy(bullet)
      enemyDestroy(inimigo)
    },
    null,
    scene
  );

  return enemy;
}

function bulletDestroy(bullet) {
  // Desativa o tiro
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.setPosition(-1000, -1000);
}

function enemyDestroy (enemy) {
  
  enemy.setActive(false);
  enemy.setVisible(false);
  enemy.body.enable = false; // Desliga a física para ele não colidir mais
  enemy.destroy();
}


export function preloadEnemyAssets(scene) {
  // Carregando os frames de pulo (0 a 5)
  for (let i = 0; i <= 5; i++) {
    scene.load.image(`enemy_jump_${i}`, `assets/mobs/sprite_jump_${i}.png`);
  }

  // Carregando os frames de corrida (0 a 3)
  for (let i = 0; i <= 3; i++) {
    scene.load.image(`enemy_run_${i}`, `assets/mobs/sprite_run_two_${i}.png`);
  }
}

export function createEnemyAnimations(scene) {
  // Animação de Corrida
  scene.anims.create({
    key: 'enemy_run',
    frames: [
      { key: 'enemy_run_0' },
      { key: 'enemy_run_1' },
      { key: 'enemy_run_2' },
      { key: 'enemy_run_3' }
    ],
    frameRate: 10, // Velocidade da animação (quadros por segundo)
    repeat: -1     // -1 significa loop infinito
  });

  // Animação de Pulo
  scene.anims.create({
    key: 'enemy_jump',
    frames: [
      { key: 'enemy_jump_0' },
      { key: 'enemy_jump_1' },
      { key: 'enemy_jump_2' },
      { key: 'enemy_jump_3' },
      { key: 'enemy_jump_4' },
      { key: 'enemy_jump_5' }
    ],
    frameRate: 10,
    repeat: 0 // Roda apenas uma vez quando pula
  });
}