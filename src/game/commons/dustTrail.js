import Phaser from 'phaser';

const DUST_COLOR = 0x9a9a9a;
const DUST_PARTICLES_PER_EMISSION = 4;
const DUST_EMISSION_INTERVAL = 90;

/**
 * Cria um pequeno rastro de poeira pixelado.
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

  const body = player.body;
  const direction = player.body.velocity.x < 0 ? -1 : player.body.velocity.x > 0 ? 1 : player.flipX ? -1 : 1;
  const wallSide = player.body.blocked.left || player.body.touching.left ? -1 : 1;

  for (let index = 0; index < DUST_PARTICLES_PER_EMISSION; index += 1) {
    const size = Phaser.Math.Between(1, 2);
    let x;
    let y;
    let driftX;
    let driftY;

    if (orientation === 'vertical') {
      // Nasce na lateral do corpo e sobe/espalha um pouco, simulando o
      // atrito da parede durante a descida.
      x = wallSide === -1 ? body.left - 2 : body.right + 2;
      y = Phaser.Math.Between(body.top + 3, body.bottom - 3);
      driftX = wallSide * Phaser.Math.Between(4, 12);
      driftY = Phaser.Math.Between(-7, 7);
    } else {
      // Nasce perto dos pés e fica para trás em relação ao movimento.
      x = body.center.x - direction * Phaser.Math.Between(3, 9);
      y = body.bottom - Phaser.Math.Between(0, 3);
      driftX = -direction * Phaser.Math.Between(8, 18);
      driftY = Phaser.Math.Between(-5, -1);
    }

    const dust = scene.add.rectangle(x, y, size, size, DUST_COLOR, 0.75);
    // Fica acima do player e dos tiles comuns (que usam depth 0), mas ainda
    // abaixo da camada over-player, que usa depth 10.
    dust.setDepth((player.depth ?? 0) + 1);

    scene.tweens.add({
      targets: dust,
      x: x + driftX,
      y: y + driftY,
      alpha: 0,
      scaleX: 0.65,
      scaleY: 0.65,
      duration: Phaser.Math.Between(180, 280),
      ease: 'Quad.easeOut',
      onComplete: () => dust.destroy(),
    });
  }
}

/**
 * Faz o tile atingido dar uma pequena "esticada" de impacto, sem alterar o
 * tile original do mapa nem a sua colisão.
 */
export function playTileImpactEffect(scene, tile) {
  const tileset = tile?.tileset;
  const texture = tileset?.image;

  if (!tile || tile.index < 0 || !texture) return;

  const tileImpact = scene.add.image(
    tile.getCenterX(),
    tile.getCenterY(),
    texture.key,
    tile.index - tileset.firstgid
  );

  tileImpact
    .setDisplaySize(tile.width, tile.height)
    .setDepth((tile.tilemapLayer?.depth ?? 0) + 1);

  const originalScaleX = tileImpact.scaleX;
  const originalScaleY = tileImpact.scaleY;

  scene.tweens.add({
    targets: tileImpact,
    scaleX: originalScaleX * 1.18,
    scaleY: originalScaleY * 1.18,
    duration: 70,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
    onComplete: () => tileImpact.destroy(),
  });
}
