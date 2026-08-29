import { resizeCollider } from "./common";

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
  return player;
}

export function preloadPlayerAssets(scene) {
  // Carregando os frames de pulo (0 a 5)
  for (let i = 0; i <= 5; i++) {
    scene.load.image(`jump_${i}`, `assets/player/sprite_jump_${i}.png`);
  }

  // Carregando os frames de corrida (0 a 3)
  for (let i = 0; i <= 3; i++) {
    scene.load.image(`run_${i}`, `assets/player/sprite_run_two_${i}.png`);
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
}