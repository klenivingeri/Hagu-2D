import { describe, it, expect, vi } from 'vitest';
import { patrolAndShootBehavior } from './patrolAndShootBehavior.js';

// Este teste existe por causa de um bug real: com patrol=true e
// bidirectional=true, o enemy patrulhava pra direita, avistava o player
// atrás dele, virava visualmente pra esquerda (faceTowardsPlayer), mas a
// flecha saía pra direita — porque fireAtPlayer() lia enemy.facingDirection
// ANTES do turn acontecer. Ver comentário em fireAtPlayer().

function makeEnemy(overrides = {}) {
  return {
    entityKey: 'bat',
    patrol: true,
    bidirectional: true,
    facingDirection: 1,
    isAttacking: false,
    isStomped: false,
    isDead: false,
    nextAttackAt: 0,
    status: { speed: 50 },
    body: {
      velocity: { x: 50 },
      blocked: { left: false, right: false },
      center: { x: 100, y: 100 },
    },
    setVelocityX: vi.fn(),
    setFlipX: vi.fn(),
    anims: { play: vi.fn() },
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    ...overrides,
  };
}

function makeScene({ playerX }) {
  return {
    time: { now: 1000 },
    map: { tileWidth: 16 },
    player: { body: { center: { x: playerX, y: 100 } } },
    bulletSystem: { fireEnemy: vi.fn() },
    platforms: [],
    anims: { exists: () => true },
  };
}

describe('patrolAndShootBehavior fireAtPlayer direction', () => {
  it('player atrás do enemy (bidirectional) -> vira e a flecha sai pro lado NOVO, não o antigo', () => {
    // Enemy patrulhando pra direita (facingDirection=1), player aparece à
    // esquerda dele -> deve virar pra -1 e atirar pra -1, não pra 1.
    const enemy = makeEnemy({ facingDirection: 1, body: { velocity: { x: 50 }, blocked: {}, center: { x: 100, y: 100 } } });
    const scene = makeScene({ playerX: 50 });

    // Força "player em visão" simulando uma cena onde isPlayerInVision
    // (chamado internamente) retorna true: usamos visionRangeTilesWidth
    // grande o bastante pra cobrir a distância de 50px no fake scene.
    enemy.visionRangeTilesWidth = 10;
    enemy.visionRangeTilesHeight = 0;
    enemy.body.width = 16;
    enemy.body.height = 16;

    patrolAndShootBehavior.update(scene, enemy);

    expect(enemy.facingDirection).toBe(-1);
    expect(enemy.anims.play).toHaveBeenCalledWith('bat_bow', true);

    // Simula o frame de disparo do bow (animationupdate) que efetivamente
    // chama bulletSystem.fireEnemy com a direção capturada.
    const onCall = enemy.on.mock.calls.find(([event]) => event === 'animationupdate');
    expect(onCall).toBeTruthy();
    const bowFrameHandler = onCall[1];
    bowFrameHandler({ key: 'bat_bow' }, { textureFrame: 3, textureKey: 'bat_bow_3' });

    expect(scene.bulletSystem.fireEnemy).toHaveBeenCalledWith(enemy, -1);
  });

  it('player à frente do enemy -> continua virado pra frente e atira na mesma direção', () => {
    const enemy = makeEnemy({ facingDirection: 1, body: { velocity: { x: 50 }, blocked: {}, center: { x: 100, y: 100 } } });
    const scene = makeScene({ playerX: 150 });
    enemy.visionRangeTilesWidth = 10;
    enemy.visionRangeTilesHeight = 0;
    enemy.body.width = 16;
    enemy.body.height = 16;

    patrolAndShootBehavior.update(scene, enemy);

    expect(enemy.facingDirection).toBe(1);
    const onCall = enemy.on.mock.calls.find(([event]) => event === 'animationupdate');
    const bowFrameHandler = onCall[1];
    bowFrameHandler({ key: 'bat_bow' }, { textureFrame: 3, textureKey: 'bat_bow_3' });

    expect(scene.bulletSystem.fireEnemy).toHaveBeenCalledWith(enemy, 1);
  });
});
