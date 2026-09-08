import Phaser from 'phaser';

const DUST_COLOR = 0x9a9a9a;
const DUST_PARTICLES_PER_EMISSION = 4;
const DUST_EMISSION_INTERVAL = 90;
const BULLET_IMPACT_PARTICLES = 8;
const ENEMY_HIT_PARTICLES = 6;
const DRY_FIRE_PARTICLES = 4;

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
export function emitDustTrail(scene, player, orientation = 'horizontal', force = false, position = null, directionOverride = null) {
  const now = scene.time.now;
  const lastEmission = player._lastDustEmission ?? -Infinity;

  if (!force && now - lastEmission < DUST_EMISSION_INTERVAL) return;
  player._lastDustEmission = now;

  const emitter = getDustEmitter(scene);
  const body = player.body;
  const dustPosition = position || {
    x: body.center.x,
    y: body.bottom,
  };
  const direction = directionOverride
    ?? (player.body.velocity.x < 0 ? -1 : player.body.velocity.x > 0 ? 1 : player.flipX ? -1 : 1);
  const wallSide = player.body.blocked.left || player.body.touching.left ? -1 : 1;

  for (let index = 0; index < DUST_PARTICLES_PER_EMISSION; index += 1) {
    let x;
    let y;
    let vx;
    let vy;

    if (orientation === 'vertical') {
      // Nasce na lateral do corpo e sobe/espalha um pouco, simulando o
      // atrito da parede durante a descida.
    x = wallSide === -1 ? body.left - 1 : body.right + 1;
    y = Phaser.Math.Between(body.top, body.bottom + 1);
    vx = wallSide * Phaser.Math.Between(1, 5);
    vy = Phaser.Math.Between(0, 30);
    } else {
      // Nasce perto dos pés e fica para trás em relação ao movimento.
      x = dustPosition.x - direction * Phaser.Math.Between(0, 2);
      y = dustPosition.y - Phaser.Math.Between(0, 1);
    vx = -direction * Phaser.Math.Between(5, 20);
    vy = Phaser.Math.Between(-15, -5);
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

  const x = body.center.x;
  const y = body.center.y;

  // Clarão curto para deixar o instante da colisão mais legível.
  const flash = scene.add.circle(x, y, 3, 0xffffff, 0.9);
  flash.setDepth(10000);
  scene.tweens.add({
    targets: flash,
    scale: 2.5,
    alpha: 0,
    duration: 90,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });

  // Fragmentos saem em leque, dando a sensação de que o projétil se partiu
  // no impacto, em vez de apenas deixar um rastro para trás.
  for (let index = 0; index < BULLET_IMPACT_PARTICLES; index += 1) {
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 359));
    const speed = Phaser.Math.Between(70, 170);
    const vx = Math.cos(angle) * speed - direction * 30;
    const vy = Math.sin(angle) * speed;

    emitParticle(emitter, x, y + Phaser.Math.Between(-2, 2), vx, vy, {
      scale: Phaser.Math.FloatBetween(0.8, 1.6),
      lifespan: Phaser.Math.Between(160, 260),
    });
  }
}

/**
 * Faíscas menores para indicar que o bullet acertou um inimigo.
 * É diferente do impacto em layer: não simula poeira, e sim um hit rápido.
 */
export function emitEnemyHitBurst(scene, enemy) {
  const body = enemy.body;
  const x = body?.center.x ?? enemy.x;
  const y = body?.center.y ?? enemy.y;
  const emitter = getDustEmitter(scene);

  const flash = scene.add.circle(x, y, 2.5, 0xfff3a3, 0.95);
  flash.setDepth(10000);
  scene.tweens.add({
    targets: flash,
    scale: 1.8,
    alpha: 0,
    duration: 70,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });

  for (let index = 0; index < ENEMY_HIT_PARTICLES; index += 1) {
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 359));
    const speed = Phaser.Math.Between(45, 110);

    emitParticle(
      emitter,
      x,
      y + Phaser.Math.Between(-2, 2),
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      {
        scale: Phaser.Math.FloatBetween(0.7, 1.2),
        lifespan: Phaser.Math.Between(120, 200),
        tint: 0xffd166,
      }
    );
  }
}

/**
 * Pequena faísca/poeira para indicar uma tentativa de disparo sem munição.
 */
export function emitDryFireBurst(scene, player) {
  const body = player.body;
  const direction = player.flipX ? -1 : 1;
  const x = body?.center.x ?? player.x;
  const y = body?.center.y ?? player.y;
  const emitter = getDustEmitter(scene);

  const flash = scene.add.circle(x + direction * 9, y - 2, 1.8, 0xfff3a3, 0.95);
  flash.setDepth(10000);
  scene.tweens.add({
    targets: flash,
    scale: 1.45,
    alpha: 0,
    duration: 75,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy(),
  });

  for (let index = 0; index < DRY_FIRE_PARTICLES; index += 1) {
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-65, 65));
    const speed = Phaser.Math.Between(25, 60);

    emitParticle(
      emitter,
      x + direction * Phaser.Math.Between(7, 10),
      y + Phaser.Math.Between(-5, 4),
      direction * Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      {
        scale: Phaser.Math.FloatBetween(0.45, 0.8),
        lifespan: Phaser.Math.Between(90, 150),
        tint: index % 2 === 0 ? 0xffd166 : 0xffffff,
      }
    );
  }
}

function emitParticle(emitter, x, y, vx, vy, options = {}) {
  emitter.emitParticleAt(x, y, 1);
  const particle = emitter.alive[emitter.alive.length - 1];
  if (particle) {
    particle.velocityX = vx;
    particle.velocityY = vy;
    if (options.scale !== undefined) {
      particle.scaleX = options.scale;
      particle.scaleY = options.scale;
    }
    if (options.lifespan !== undefined) particle.life = options.lifespan;
    if (options.tint !== undefined) particle.tint = options.tint;
  }
}
