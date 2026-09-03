import Phaser from 'phaser';

const DUST_COLOR = 0x9a9a9a;
const DUST_PARTICLES_PER_EMISSION = 4;
const DUST_EMISSION_INTERVAL = 90;

/**
 * Gera a textura de 2x2px usada pela poeira, uma única vez por jogo.
 * Precisa ser chamada ANTES do primeiro emitDustTrail/emitBulletImpactDust
 * (ex: no create() da GameScene).
 */
export function preloadDustTexture(scene) {
  if (scene.textures.exists('dust_pixel')) return;

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(0, 0, 2, 2);
  graphics.generateTexture('dust_pixel', 2, 2);
  graphics.destroy();
}

/**
 * Um único ParticleEmitter reaproveitado para toda a poeira do jogo.
 * Diferente do Rectangle + Tween manual de antes, isso:
 * - é baseado em textura, então respeita `roundPixels` (sem sub-pixel);
 * - é batchado num único draw call pelo WebGL;
 * - já tem pooling interno do Phaser: nunca criamos/destruímos GameObjects
 *   por partícula, só pedimos emissões a um emissor que já existe.
 */
function getDustEmitter(scene) {
  if (!scene._dustEmitter) {
    scene._dustEmitter = scene.add.particles(0, 0, 'dust_pixel', {
      tint: DUST_COLOR,
      lifespan: { min: 180, max: 280 },
      speed: 0,
      alpha: { start: 0.75, end: 0 },
      scale: { start: 1, end: 0.65 },
      quantity: 0,
      emitting: false,
    });
    scene._dustEmitter.setDepth(9999);

    // Limpa o emissor junto com a cena, evitando referência presa.
    scene.events.once('shutdown', () => {
      scene._dustEmitter?.destroy();
      scene._dustEmitter = null;
    });
  }
  return scene._dustEmitter;
}

/**
 * Rastro de poeira pixelado.
 *
 * orientation:
 * - 'vertical': poeira saindo da lateral durante o wall slide
 * - 'horizontal': poeira ficando para trás enquanto o player anda
 */
export function emitDustTrail(scene, player, orientation = 'horizontal') {
  const now = scene.time.now;
  const lastEmission = player._lastDustEmission ?? -Infinity;

  if (now - lastEmission < DUST_EMISSION_INTERVAL) return;
  player._lastDustEmission = now;

  const emitter = getDustEmitter(scene);
  const body = player.body;
  const direction = player.body.velocity.x < 0 ? -1 : player.body.velocity.x > 0 ? 1 : player.flipX ? -1 : 1;
  const wallSide = player.body.blocked.left || player.body.touching.left ? -1 : 1;

  for (let index = 0; index < DUST_PARTICLES_PER_EMISSION; index += 1) {
    let x;
    let y;
    let vx;
    let vy;

    if (orientation === 'vertical') {
      // Nasce na lateral do corpo e sobe/espalha um pouco, simulando o
      // atrito da parede durante a descida.
      x = wallSide === -1 ? body.left - 2 : body.right + 2;
      y = Phaser.Math.Between(body.top + 3, body.bottom - 3);
      vx = wallSide * Phaser.Math.Between(40, 120);
      vy = Phaser.Math.Between(-70, 70);
    } else {
      // Nasce perto dos pés e fica para trás em relação ao movimento.
      x = body.center.x - direction * Phaser.Math.Between(3, 9);
      y = body.bottom - Phaser.Math.Between(0, 3);
      vx = -direction * Phaser.Math.Between(80, 180);
      vy = Phaser.Math.Between(-50, -10);
    }

    emitParticle(emitter, x, y, vx, vy);
  }
}

/**
 * Poeira específica do impacto do tiro.
 * A rajada fica para trás do disparo: tiro para a direita espalha para a
 * esquerda e tiro para a esquerda espalha para a direita.
 */
export function emitBulletImpactDust(scene, bullet, bulletDirection) {
  const direction = bulletDirection < 0 ? -1 : 1;
  const body = bullet.body;
  const now = scene.time.now;
  const lastEmission = bullet._lastBulletDustEmission ?? -Infinity;

  if (now - lastEmission < DUST_EMISSION_INTERVAL) return;
  bullet._lastBulletDustEmission = now;

  const emitter = getDustEmitter(scene);

  for (let index = 0; index < DUST_PARTICLES_PER_EMISSION; index += 1) {
    const x = body.center.x;
    const y = body.center.y + Phaser.Math.Between(-3, 3);
    const vx = -direction * Phaser.Math.Between(80, 200);
    const vy = Phaser.Math.Between(-100, 100);

    emitParticle(emitter, x, y, vx, vy);
  }
}

function emitParticle(emitter, x, y, vx, vy) {
  emitter.emitParticleAt(x, y, 1);
  const particle = emitter.alive[emitter.alive.length - 1];
  if (particle) {
    particle.velocityX = vx;
    particle.velocityY = vy;
  }
}
