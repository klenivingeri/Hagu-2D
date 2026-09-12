import { describe, it, expect, vi, beforeEach } from 'vitest';

// A decisão de "pisou em cima (bounce, dá dano no inimigo) x tomou dano" é a
// lógica de colisão mais sensível do jogo (estilo Mario). O dano de verdade
// no inimigo (stompDamageEnemy) e os efeitos visuais (dustTrail) são de
// outros módulos, já cobertos à parte — aqui isolamos só a DECISÃO.
vi.mock('./createEnemy.js', () => ({ stompDamageEnemy: vi.fn() }));
vi.mock('../../commons/dustTrail.js', () => ({ emitEnemyHitBurst: vi.fn(), emitDustTrail: vi.fn() }));

import { stompDamageEnemy } from './createEnemy.js';
import { isStomp, hitByEnemy } from './createPlayer.js';

beforeEach(() => {
  vi.clearAllMocks();
});

function makePlayer(overrides = {}) {
  return {
    isDead: false,
    invulnerable: false,
    status: { life: 5, jumpHeight: 210, jumpDamage: 1 },
    body: { velocity: { y: 0 }, bottom: 100, blocked: {}, touching: {} },
    setVelocityY: vi.fn(),
    setAlpha: vi.fn(),
    ...overrides,
  };
}

function makeEnemy(overrides = {}) {
  return {
    active: true,
    entityConfig: {},
    status: { contactDamage: 1 },
    body: { top: 90, height: 20 },
    ...overrides,
  };
}

function makeScene(overrides = {}) {
  return {
    sound: { play: vi.fn() },
    game: { events: { emit: vi.fn() } },
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
    time: { delayedCall: vi.fn(() => ({ remove: vi.fn() })), now: 0 },
    runDamageTaken: false,
    ...overrides,
  };
}

describe('isStomp', () => {
  it('caindo com os pés na metade de cima do inimigo -> true', () => {
    const player = makePlayer({ body: { velocity: { y: 50 }, bottom: 95 } });
    const enemy = makeEnemy({ body: { top: 90, height: 20 } }); // stompLine = 90 + 10 = 100
    expect(isStomp(player, enemy)).toBe(true);
  });

  it('caindo mas já passou da metade de cima (encostou de lado) -> false', () => {
    const player = makePlayer({ body: { velocity: { y: 50 }, bottom: 105 } });
    const enemy = makeEnemy({ body: { top: 90, height: 20 } }); // stompLine = 100
    expect(isStomp(player, enemy)).toBe(false);
  });

  it('parado ou subindo (velocity.y <= 0) nunca conta como stomp, mesmo na posição certa', () => {
    const player = makePlayer({ body: { velocity: { y: 0 }, bottom: 95 } });
    const enemy = makeEnemy({ body: { top: 90, height: 20 } });
    expect(isStomp(player, enemy)).toBe(false);
  });
});

describe('hitByEnemy', () => {
  it('player morto -> ignora completamente (sem stomp, sem dano)', () => {
    const player = makePlayer({ isDead: true });
    const enemy = makeEnemy();
    hitByEnemy(makeScene(), player, enemy);

    expect(stompDamageEnemy).not.toHaveBeenCalled();
    expect(player.status.life).toBe(5);
  });

  it('inimigo inativo/nulo -> ignora completamente', () => {
    const player = makePlayer();
    hitByEnemy(makeScene(), player, makeEnemy({ active: false }));
    expect(stompDamageEnemy).not.toHaveBeenCalled();
    expect(player.status.life).toBe(5);
  });

  it('geometria de stomp -> quica o player e dá dano no inimigo, sem tirar vida do player', () => {
    const player = makePlayer({ body: { velocity: { y: 50 }, bottom: 95 } });
    const enemy = makeEnemy({ body: { top: 90, height: 20 } });

    hitByEnemy(makeScene(), player, enemy);

    expect(player.setVelocityY).toHaveBeenCalledWith(-player.status.jumpHeight);
    expect(stompDamageEnemy).toHaveBeenCalledWith(enemy, player.status.jumpDamage);
    expect(player.status.life).toBe(5);
  });

  it('stomp acontece mesmo com o player invulnerável (i-frame só protege dano de ENTRADA)', () => {
    const player = makePlayer({ body: { velocity: { y: 50 }, bottom: 95 }, invulnerable: true });
    const enemy = makeEnemy({ body: { top: 90, height: 20 } });

    hitByEnemy(makeScene(), player, enemy);

    expect(stompDamageEnemy).toHaveBeenCalled();
    expect(player.setVelocityY).toHaveBeenCalled();
  });

  it('inimigo "noStomp" (ex: serra) nunca faz bounce, mesmo caindo em cima -> vira dano normal', () => {
    const player = makePlayer({ body: { velocity: { y: 50 }, bottom: 95 } });
    const enemy = makeEnemy({ body: { top: 90, height: 20 }, entityConfig: { noStomp: true } });

    // damagePlayer() lê scene.player (não o parâmetro `player` do próprio
    // hitByEnemy) — precisa ser o mesmo objeto pra vida cair de verdade.
    hitByEnemy(makeScene({ player }), player, enemy);

    expect(stompDamageEnemy).not.toHaveBeenCalled();
    expect(player.setVelocityY).not.toHaveBeenCalled();
    expect(player.status.life).toBeLessThan(5);
  });

  it('sem geometria de stomp e sem invulnerabilidade -> toma dano do inimigo', () => {
    const player = makePlayer({ body: { velocity: { y: 0 }, bottom: 200 } });
    const enemy = makeEnemy({ status: { contactDamage: 2 } });

    hitByEnemy(makeScene({ player }), player, enemy);

    expect(stompDamageEnemy).not.toHaveBeenCalled();
    expect(player.status.life).toBe(3);
  });

  it('sem geometria de stomp mas invulnerável -> ignora o toque (ainda no cooldown)', () => {
    const player = makePlayer({ body: { velocity: { y: 0 }, bottom: 200 }, invulnerable: true });
    const enemy = makeEnemy();

    hitByEnemy(makeScene(), player, enemy);

    expect(player.status.life).toBe(5);
  });

  it('dano usa entityConfig.attack.damage quando presente, senão status.contactDamage, senão 1', () => {
    const withAttack = makePlayer({ body: { velocity: { y: 0 }, bottom: 200 } });
    hitByEnemy(makeScene({ player: withAttack }), withAttack, makeEnemy({ entityConfig: { attack: { damage: 3 } }, status: { contactDamage: 1 } }));
    expect(withAttack.status.life).toBe(2);

    const withContactOnly = makePlayer({ body: { velocity: { y: 0 }, bottom: 200 } });
    hitByEnemy(makeScene({ player: withContactOnly }), withContactOnly, makeEnemy({ status: { contactDamage: 2 } }));
    expect(withContactOnly.status.life).toBe(3);

    const withNeither = makePlayer({ body: { velocity: { y: 0 }, bottom: 200 } });
    hitByEnemy(makeScene({ player: withNeither }), withNeither, makeEnemy({ status: {} }));
    expect(withNeither.status.life).toBe(4);
  });
});
