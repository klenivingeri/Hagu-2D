import { describe, it, expect, vi } from 'vitest';
import {
  resolveEnemyOverrides,
  getAttackCooldownMs,
  isKnockedBack,
  turnEnemy,
  playRunAnimationIfFree,
  patrolGroundTurn,
  isAboutToFall,
  isPlayerInVision,
} from './EnemyBase.js';

// Fábrica de um "enemy" falso o bastante pra exercitar as funções puras de
// EnemyBase.js sem precisar de uma cena Phaser de verdade — só os métodos
// realmente chamados por cada função testada.
function makeFakeEnemy(overrides = {}) {
  return {
    entityKey: 'bat',
    isStomped: false,
    isAttacking: false,
    isDead: false,
    facingDirection: 1,
    status: { speed: 50 },
    body: {
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      velocity: { x: 0 },
      blocked: { left: false, right: false },
      center: { x: 0, y: 0 },
    },
    setVelocityX: vi.fn(),
    setFlipX: vi.fn(),
    anims: { play: vi.fn() },
    ...overrides,
  };
}

describe('resolveEnemyOverrides', () => {
  const config = {
    patrol: true,
    direction: 'right',
    ai: { visionRangeTilesWidth: 3, visionRangeTilesHeight: 1, bidirectional: false },
  };

  it('sem props do Tiled, usa os defaults do MOBS_CONFIG', () => {
    const overrides = resolveEnemyOverrides([], config);
    expect(overrides).toEqual({
      patrol: true,
      direction: 'right',
      visionRangeTilesWidth: 3,
      visionRangeTilesHeight: 1,
      bidirectional: false,
    });
  });

  it('o Tiled sempre vence o default quando o valor vem definido', () => {
    const properties = [
      { name: 'patrol', value: false },
      { name: 'direction', value: 'left' },
      { name: 'visionRangeTilesWidth', value: 5 },
      { name: 'bidirectional', value: 'true' },
    ];

    const overrides = resolveEnemyOverrides(properties, config);

    expect(overrides.patrol).toBe(false);
    expect(overrides.direction).toBe('left');
    expect(overrides.visionRangeTilesWidth).toBe(5);
    expect(overrides.bidirectional).toBe(true);
    // Não sobrescrito -> continua vindo do config.
    expect(overrides.visionRangeTilesHeight).toBe(1);
  });

  it('qualquer direction diferente de "left" resolve pra "right"', () => {
    const properties = [{ name: 'direction', value: 'cima' }];
    expect(resolveEnemyOverrides(properties, config).direction).toBe('right');
  });

  it('aceita as formas alternativas de boolean do Tiled (1, "1", "true")', () => {
    expect(resolveEnemyOverrides([{ name: 'patrol', value: 1 }], config).patrol).toBe(true);
    expect(resolveEnemyOverrides([{ name: 'patrol', value: '1' }], config).patrol).toBe(true);
    expect(resolveEnemyOverrides([{ name: 'patrol', value: 'false' }], config).patrol).toBe(false);
  });
});

describe('getAttackCooldownMs', () => {
  it('usa o cooldown do entityConfig quando é um número válido', () => {
    const enemy = { entityConfig: { attack: { cooldown: 1200 } } };
    expect(getAttackCooldownMs(enemy, 900)).toBe(1200);
  });

  it('cai pro default quando não há attack.cooldown configurado', () => {
    const enemy = { entityConfig: {} };
    expect(getAttackCooldownMs(enemy, 900)).toBe(900);
  });

  it('cai pro default quando o valor configurado não é um número', () => {
    const enemy = { entityConfig: { attack: { cooldown: 'rapido' } } };
    expect(getAttackCooldownMs(enemy, 900)).toBe(900);
  });

  it('nunca deixa o cooldown ser negativo', () => {
    const enemy = { entityConfig: { attack: { cooldown: -500 } } };
    expect(getAttackCooldownMs(enemy, 900)).toBe(0);
  });
});

describe('isKnockedBack', () => {
  it('true enquanto scene.time.now não passou de enemy.knockbackUntil', () => {
    const scene = { time: { now: 100 } };
    const enemy = { knockbackUntil: 150 };
    expect(isKnockedBack(scene, enemy)).toBe(true);
  });

  it('false depois que o tempo do knockback passou', () => {
    const scene = { time: { now: 200 } };
    const enemy = { knockbackUntil: 150 };
    expect(isKnockedBack(scene, enemy)).toBe(false);
  });

  it('false quando o inimigo nunca levou knockback', () => {
    const scene = { time: { now: 200 } };
    expect(isKnockedBack(scene, {})).toBe(false);
  });
});

describe('turnEnemy / playRunAnimationIfFree', () => {
  it('aplica velocidade, direção e vira o sprite', () => {
    const enemy = makeFakeEnemy();
    turnEnemy(enemy, -50, -1);

    expect(enemy.setVelocityX).toHaveBeenCalledWith(-50);
    expect(enemy.facingDirection).toBe(-1);
    expect(enemy.setFlipX).toHaveBeenCalledWith(true);
  });

  it('toca a animação "run" quando o inimigo está livre (não tombado/atacando)', () => {
    const enemy = makeFakeEnemy();
    turnEnemy(enemy, 50, 1);
    expect(enemy.anims.play).toHaveBeenCalledWith('bat_run', true);
  });

  it('não mexe na animação enquanto tombado (stomp) ou atacando', () => {
    const stomped = makeFakeEnemy({ isStomped: true });
    turnEnemy(stomped, 50, 1);
    expect(stomped.anims.play).not.toHaveBeenCalled();

    const attacking = makeFakeEnemy({ isAttacking: true });
    playRunAnimationIfFree(attacking);
    expect(attacking.anims.play).not.toHaveBeenCalled();
  });
});

describe('isAboutToFall', () => {
  it('parado (velocity.x = 0) nunca está prestes a cair', () => {
    const enemy = makeFakeEnemy();
    const scene = { platforms: [] };
    expect(isAboutToFall(scene, enemy)).toBe(false);
  });

  it('true quando não há chão nenhum na frente, na direção do movimento', () => {
    const enemy = makeFakeEnemy();
    enemy.body.velocity.x = 50; // andando pra direita
    const scene = { platforms: [{ getTileAtWorldXY: () => null }] };
    expect(isAboutToFall(scene, enemy)).toBe(true);
  });

  it('false quando qualquer layer de platforms tem chão na posição olhada', () => {
    const enemy = makeFakeEnemy();
    enemy.body.velocity.x = -50; // andando pra esquerda
    const scene = { platforms: [{ getTileAtWorldXY: () => ({ index: 3 }) }] };
    expect(isAboutToFall(scene, enemy)).toBe(false);
  });

  it('tile com index -1 (vazio) conta como "sem chão"', () => {
    const enemy = makeFakeEnemy();
    enemy.body.velocity.x = 50;
    const scene = { platforms: [{ getTileAtWorldXY: () => ({ index: -1 }) }] };
    expect(isAboutToFall(scene, enemy)).toBe(true);
  });
});

describe('patrolGroundTurn', () => {
  it('bateu na parede da esquerda -> vira e anda pra direita', () => {
    const enemy = makeFakeEnemy();
    enemy.body.blocked.left = true;
    const scene = { platforms: [] };

    patrolGroundTurn(scene, enemy);

    expect(enemy.setVelocityX).toHaveBeenCalledWith(enemy.status.speed);
    expect(enemy.facingDirection).toBe(1);
  });

  it('bateu na parede da direita -> vira e anda pra esquerda', () => {
    const enemy = makeFakeEnemy();
    enemy.body.blocked.right = true;
    const scene = { platforms: [] };

    patrolGroundTurn(scene, enemy);

    expect(enemy.setVelocityX).toHaveBeenCalledWith(-enemy.status.speed);
    expect(enemy.facingDirection).toBe(-1);
  });

  it('sem parede mas na beira da plataforma -> vira pro lado oposto ao que vinha andando', () => {
    const enemy = makeFakeEnemy();
    enemy.body.velocity.x = 50; // vinha andando pra direita
    const scene = { platforms: [{ getTileAtWorldXY: () => null }] }; // sem chão à frente

    patrolGroundTurn(scene, enemy);

    expect(enemy.setVelocityX).toHaveBeenCalledWith(-enemy.status.speed);
    expect(enemy.facingDirection).toBe(-1);
  });

  it('sem parede e com chão à frente -> não vira, não mexe na velocidade', () => {
    const enemy = makeFakeEnemy();
    enemy.body.velocity.x = 50;
    const scene = { platforms: [{ getTileAtWorldXY: () => ({ index: 2 }) }] };

    patrolGroundTurn(scene, enemy);

    expect(enemy.setVelocityX).not.toHaveBeenCalled();
  });
});

describe('isPlayerInVision', () => {
  function makeVisionEnemy(overrides = {}) {
    return {
      facingDirection: 1,
      bidirectional: false,
      visionRangeTilesWidth: 2,
      visionRangeTilesHeight: 0,
      body: { width: 16, height: 16, center: { x: 100, y: 100 } },
      ...overrides,
    };
  }

  it('player fora de qualquer caixa de visão -> false', () => {
    const enemy = makeVisionEnemy();
    const scene = { map: { tileWidth: 16 }, player: { body: { center: { x: 500, y: 500 } } } };
    expect(isPlayerInVision(scene, enemy)).toBe(false);
  });

  it('player dentro do alcance à frente (facingDirection=1) -> true', () => {
    const enemy = makeVisionEnemy();
    // BASE (metade da largura = 8) + 2 tiles (32px) à direita do centro (100) = até 140.
    const scene = { map: { tileWidth: 16 }, player: { body: { center: { x: 130, y: 100 } } } };
    expect(isPlayerInVision(scene, enemy)).toBe(true);
  });

  it('player atrás do inimigo não conta quando bidirectional=false', () => {
    const enemy = makeVisionEnemy();
    const scene = { map: { tileWidth: 16 }, player: { body: { center: { x: 70, y: 100 } } } };
    expect(isPlayerInVision(scene, enemy)).toBe(false);
  });

  it('bidirectional=true enxerga também atrás do inimigo', () => {
    const enemy = makeVisionEnemy({ bidirectional: true });
    const scene = { map: { tileWidth: 16 }, player: { body: { center: { x: 70, y: 100 } } } };
    expect(isPlayerInVision(scene, enemy)).toBe(true);
  });

  it('player morto nunca é "visto"', () => {
    const enemy = makeVisionEnemy({ bidirectional: true });
    const scene = { map: { tileWidth: 16 }, player: { isDead: true, body: { center: { x: 100, y: 100 } } } };
    expect(isPlayerInVision(scene, enemy)).toBe(false);
  });
});
