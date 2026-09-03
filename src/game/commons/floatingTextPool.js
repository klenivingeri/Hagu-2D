// Pool de textos "-N" de dano flutuante.
// Antes: cada hit criava um Text novo (regenera textura de canvas — caro em
// GPU antiga) e o destruía no fim do tween. Agora reaproveitamos um punhado
// fixo de objetos: nunca criamos/destruímos GameObject em tempo de jogo.

const POOL_SIZE = 8;

const TEXT_STYLE = {
  color: '#ff5a52',
  fontSize: '8px',
  fontStyle: 'bold',
  stroke: '#000000',
  strokeThickness: 2,
};

function ensurePool(scene) {
  if (scene._floatingTextPool) return scene._floatingTextPool;

  const pool = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const text = scene.add.text(0, 0, '', TEXT_STYLE)
      .setOrigin(0.5)
      .setDepth(20)
      .setActive(false)
      .setVisible(false);
    pool.push(text);
  }

  scene._floatingTextPool = pool;
  scene._floatingTextCursor = 0;

  scene.events.once('shutdown', () => {
    scene._floatingTextPool?.forEach((text) => text.destroy());
    scene._floatingTextPool = null;
  });

  return pool;
}

// Pega o primeiro texto livre do pool. Se todos estiverem em uso (jogo com
// dano em rajada demais), reaproveita o próximo da fila circular em vez de
// criar um objeto extra — na pior das hipóteses um texto é interrompido no
// meio da animação, o que é imperceptível visualmente.
function acquire(scene) {
  const pool = ensurePool(scene);
  const free = pool.find((text) => !text.active);
  if (free) return free;

  const text = pool[scene._floatingTextCursor % pool.length];
  scene._floatingTextCursor += 1;
  return text;
}

export function showFloatingDamage(scene, x, y, amount) {
  const text = acquire(scene);

  scene.tweens.killTweensOf(text);
  text.setActive(true).setVisible(true).setAlpha(1).setScale(1);
  text.setPosition(x, y);
  text.setText(`-${amount}`);

  scene.tweens.add({
    targets: text,
    y: y - 4,
    duration: 180,
    hold: 70,
    yoyo: true,
    ease: 'Cubic.easeOut',
  });

  scene.tweens.add({
    targets: text,
    alpha: 0,
    scale: 0.85,
    duration: 430,
    delay: 70,
    ease: 'Linear',
    onComplete: () => text.setActive(false).setVisible(false),
  });
}
