import { describe, it, expect, vi, beforeEach } from 'vitest';

// killPlayer/emitDustTrail/updateJetpackFuelBar são efeitos colaterais de
// cena (som, partículas, animação de morte) fora do escopo deste arquivo —
// updatePlayerMovement.js só decide QUANDO chamá-los, não COMO eles
// funcionam por dentro (isso já tem dono: createPlayer.js/dustTrail.js).
vi.mock('../create/createPlayer.js', () => ({ killPlayer: vi.fn() }));
vi.mock('../../commons/dustTrail.js', () => ({ emitDustTrail: vi.fn() }));
vi.mock('../../commons/jetpackBar.js', () => ({ updateJetpackFuelBar: vi.fn() }));

import { killPlayer } from '../create/createPlayer.js';
import { emitDustTrail } from '../../commons/dustTrail.js';
import {
  readMovementInput,
  syncFallStartWhileAirborneAbility,
  consumeWallContact,
  didFallTooFar,
  updateFallTracking,
  tryWallJump,
  isPlayerOnIce,
  applyHorizontalMovement,
  applyWallSlide,
  tryGroundOrCoyoteJump,
  tryDoubleJump,
  isJumpHeld,
  updateParachute,
  updateJetpack,
  updateAnimation,
  playJumpFrame,
} from './updatePlayerMovement.js';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeScene(overrides = {}) {
  return {
    time: { now: 1000 },
    map: { tileHeight: 16 },
    controlState: { left: false, right: false, jump: false, jumpHeld: false },
    cursors: { left: { isDown: false }, right: { isDown: false }, up: { isDown: false } },
    keys: { A: { isDown: false }, D: { isDown: false }, W: { isDown: false } },
    spaceKey: { isDown: false },
    sound: { play: vi.fn() },
    lastDirection: 1,
    game: { loop: { delta: 16 } },
    groundLayer: null,
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    entityKey: 'knight',
    status: {
      speed: 100,
      jumpHeight: 210,
      coyoteTimeMs: 65,
      maxSafeFallTiles: 5,
      wallSlideSpeed: 45,
      wallJumpHorizontalSpeed: 180,
      parachuteFloatSpeed: 40,
      isParachute: false,
      isJetpack: false,
      isDoubleJump: false,
      jetpackLiftSpeed: -70,
      jetpackFuelMs: 500,
    },
    body: {
      bottom: 100,
      center: { x: 50, y: 90 },
      velocity: { x: 0, y: 0 },
      blocked: { down: true },
    },
    isParachuteActive: false,
    isJetpackActive: false,
    isWallSliding: false,
    isShooting: false,
    stickableWallSide: 0,
    lastWallSide: 0,
    hasUsedDoubleJump: false,
    hasUsedParachute: false,
    jetpackArmed: false,
    jetpackFuel: 500,
    invulnerable: false,
    fallStartY: null,
    lastGroundedBottom: 100,
    anims: { currentAnim: null, play: vi.fn(), isPlaying: false },
    texture: { key: '' },
    frame: { name: 0 },
    setVelocity: vi.fn(),
    setVelocityX: vi.fn(function setVelocityX(v) { this.body.velocity.x = v; }),
    setVelocityY: vi.fn(function setVelocityY(v) { this.body.velocity.y = v; }),
    setFlipX: vi.fn(),
    setTexture: vi.fn(),
    ...overrides,
  };
}

describe('readMovementInput', () => {
  it('combina cursors/teclas WASD/controle virtual com OR', () => {
    const scene = makeScene({ controlState: { left: false, right: true } });
    scene.keys.A.isDown = true;
    expect(readMovementInput(scene)).toEqual({ left: true, right: true });
  });

  it('nenhuma fonte pressionada -> ambos false', () => {
    expect(readMovementInput(makeScene())).toEqual({ left: false, right: false });
  });
});

describe('syncFallStartWhileAirborneAbility', () => {
  it('trava fallStartY na posição atual enquanto paraquedas/jetpack está ativo', () => {
    const player = makePlayer({ isParachuteActive: true, fallStartY: 10 });
    player.body.bottom = 250;
    syncFallStartWhileAirborneAbility(player);
    expect(player.fallStartY).toBe(250);
  });

  it('não mexe em fallStartY quando nenhuma das duas habilidades está ativa', () => {
    const player = makePlayer({ fallStartY: 10 });
    syncFallStartWhileAirborneAbility(player);
    expect(player.fallStartY).toBe(10);
  });
});

describe('consumeWallContact', () => {
  it('devolve o lado da parede e reseta pra 0 (consumo de 1 frame)', () => {
    const player = makePlayer({ stickableWallSide: -1 });
    expect(consumeWallContact(player)).toBe(-1);
    expect(player.stickableWallSide).toBe(0);
  });
});

describe('didFallTooFar', () => {
  it('false quando a distância de queda está dentro do limite seguro', () => {
    const player = makePlayer({ fallStartY: 100 });
    player.body.bottom = 100 + player.status.maxSafeFallTiles * 16 - 1;
    expect(didFallTooFar(makeScene(), player)).toBe(false);
  });

  it('true quando a queda ultrapassa maxSafeFallTiles * tileHeight', () => {
    const player = makePlayer({ fallStartY: 100 });
    player.body.bottom = 100 + player.status.maxSafeFallTiles * 16 + 1;
    expect(didFallTooFar(makeScene(), player)).toBe(true);
  });

  it('usa tileHeight=16 como fallback quando a cena não tem scene.map', () => {
    const player = makePlayer({ fallStartY: 100 });
    player.body.bottom = 100 + player.status.maxSafeFallTiles * 16 + 1;
    expect(didFallTooFar(makeScene({ map: null }), player)).toBe(true);
  });
});

describe('updateFallTracking', () => {
  it('pousou sem cair demais -> reseta fallStartY e grava lastGroundedBottom', () => {
    const player = makePlayer({ fallStartY: 90 });
    player.body.bottom = 100;
    const died = updateFallTracking(makeScene(), player, {
      wasGrounded: true, wasWallSliding: false, wallSlidingThisFrame: false, input: { left: false, right: false },
    });
    expect(died).toBe(false);
    expect(player.fallStartY).toBeNull();
    expect(player.lastGroundedBottom).toBe(100);
  });

  it('pousou depois de cair demais -> mata o player e sinaliza pra parar o frame', () => {
    const player = makePlayer({ fallStartY: 0 });
    player.body.bottom = 1000;
    const scene = makeScene();

    const died = updateFallTracking(scene, player, {
      wasGrounded: true, wasWallSliding: false, wallSlidingThisFrame: false, input: { left: false, right: true },
    });

    expect(died).toBe(true);
    expect(killPlayer).toHaveBeenCalledWith(scene, player, 'dead_jump', 1);
    expect(emitDustTrail).toHaveBeenCalled();
  });

  it('desgrudou da parede -> começa a medir a queda a partir da posição atual', () => {
    const player = makePlayer({ fallStartY: null });
    player.body.bottom = 42;
    updateFallTracking(makeScene(), player, {
      wasGrounded: false, wasWallSliding: true, wallSlidingThisFrame: false, input: { left: false, right: false },
    });
    expect(player.fallStartY).toBe(42);
  });

  it('grudando na parede agora -> fallStartY fica null (protegido)', () => {
    const player = makePlayer({ fallStartY: 42 });
    updateFallTracking(makeScene(), player, {
      wasGrounded: false, wasWallSliding: false, wallSlidingThisFrame: true, input: { left: false, right: false },
    });
    expect(player.fallStartY).toBeNull();
  });

  it('saiu da beirada (fallStartY ainda null, sem parede) -> começa do último chão conhecido', () => {
    const player = makePlayer({ fallStartY: null, lastGroundedBottom: 77 });
    updateFallTracking(makeScene(), player, {
      wasGrounded: false, wasWallSliding: false, wallSlidingThisFrame: false, input: { left: false, right: false },
    });
    expect(player.fallStartY).toBe(77);
  });
});

describe('tryWallJump', () => {
  it('sem apertar pulo, não faz nada e retorna false', () => {
    const player = makePlayer();
    expect(tryWallJump(makeScene(), player, { canStickToWall: true, wallSide: -1 })).toBe(false);
    expect(player.setVelocity).not.toHaveBeenCalled();
  });

  it('lança pro lado OPOSTO ao contato: parede à esquerda -> impulso pra direita', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer();
    const started = tryWallJump(scene, player, { canStickToWall: true, wallSide: -1 });

    expect(started).toBe(true);
    expect(player.setVelocity).toHaveBeenCalledWith(player.status.wallJumpHorizontalSpeed, -player.status.jumpHeight);
    expect(player.isWallSliding).toBe(false);
    expect(scene.lastDirection).toBe(1);
  });

  it('parede à direita -> impulso pra esquerda', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer();
    tryWallJump(scene, player, { canStickToWall: true, wallSide: 1 });
    expect(player.setVelocity).toHaveBeenCalledWith(-player.status.wallJumpHorizontalSpeed, -player.status.jumpHeight);
  });
});

describe('isPlayerOnIce', () => {
  it('false quando o player não está no chão', () => {
    const scene = makeScene({ groundLayer: { getTileAtWorldXY: () => ({ properties: [{ name: 'ice', value: true }] }) } });
    expect(isPlayerOnIce(scene, makePlayer(), false)).toBe(false);
  });

  it('true quando o tile do chão tem a propriedade "ice"', () => {
    const scene = makeScene({
      groundLayer: { getTileAtWorldXY: () => ({ properties: [{ name: 'ice', value: true }] }) },
    });
    expect(isPlayerOnIce(scene, makePlayer(), true)).toBe(true);
  });

  it('false quando o tile do chão não tem a propriedade "ice"', () => {
    const scene = makeScene({ groundLayer: { getTileAtWorldXY: () => ({ properties: [] }) } });
    expect(isPlayerOnIce(scene, makePlayer(), true)).toBe(false);
  });
});

describe('applyHorizontalMovement', () => {
  it('fora do gelo, aplica a velocidade alvo instantaneamente', () => {
    const player = makePlayer();
    applyHorizontalMovement(makeScene(), player, { input: { left: false, right: true }, isOnIce: false });
    expect(player.body.velocity.x).toBe(player.status.speed);
    expect(player.setFlipX).toHaveBeenCalledWith(false);
  });

  it('no gelo, a velocidade muda gradualmente (nunca pula direto pro alvo)', () => {
    const scene = makeScene({ game: { loop: { delta: 16 } } });
    const player = makePlayer();
    player.body.velocity.x = 0;

    applyHorizontalMovement(scene, player, { input: { left: false, right: true }, isOnIce: true });

    expect(player.body.velocity.x).toBeGreaterThan(0);
    expect(player.body.velocity.x).toBeLessThan(player.status.speed);
  });

  it('nem esquerda nem direita -> velocidade alvo é 0', () => {
    const player = makePlayer();
    player.body.velocity.x = 50;
    applyHorizontalMovement(makeScene(), player, { input: { left: false, right: false }, isOnIce: false });
    expect(player.body.velocity.x).toBe(0);
  });
});

describe('applyWallSlide', () => {
  it('sem grudar na parede -> isWallSliding sempre false', () => {
    const player = makePlayer({ isWallSliding: true });
    applyWallSlide(makeScene(), player, { canStickToWall: false, startedJump: false, wallSide: -1 });
    expect(player.isWallSliding).toBe(false);
  });

  it('acabou de pular da parede neste frame -> não reativa o slide', () => {
    const player = makePlayer({ isWallSliding: false });
    applyWallSlide(makeScene(), player, { canStickToWall: true, startedJump: true, wallSide: -1 });
    expect(player.isWallSliding).toBe(false);
  });

  it('gruda na parede e limita a velocidade de queda a wallSlideSpeed', () => {
    const player = makePlayer();
    player.body.velocity.y = 999;
    applyWallSlide(makeScene(), player, { canStickToWall: true, startedJump: false, wallSide: 1 });

    expect(player.isWallSliding).toBe(true);
    expect(player.lastWallSide).toBe(1);
    expect(player.body.velocity.y).toBe(player.status.wallSlideSpeed);
  });
});

describe('tryGroundOrCoyoteJump', () => {
  it('sem apertar pulo, devolve o startedJump recebido sem mudar nada', () => {
    const player = makePlayer();
    const result = tryGroundOrCoyoteJump(makeScene(), player, { wasGrounded: true, canUseCoyoteJump: false, startedJump: false });
    expect(result).toBe(false);
    expect(player.setVelocityY).not.toHaveBeenCalled();
  });

  it('no chão + pulo apertado -> pula e retorna true', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer();
    const result = tryGroundOrCoyoteJump(scene, player, { wasGrounded: true, canUseCoyoteJump: false, startedJump: false });
    expect(result).toBe(true);
    expect(player.body.velocity.y).toBe(-player.status.jumpHeight);
  });

  it('fora do chão mas dentro da janela de coyote time -> ainda pula', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer();
    const result = tryGroundOrCoyoteJump(scene, player, { wasGrounded: false, canUseCoyoteJump: true, startedJump: false });
    expect(result).toBe(true);
  });

  it('fora do chão e fora do coyote time -> não pula', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer();
    const result = tryGroundOrCoyoteJump(scene, player, { wasGrounded: false, canUseCoyoteJump: false, startedJump: false });
    expect(result).toBe(false);
  });
});

describe('tryDoubleJump', () => {
  it('sem a habilidade comprada/equipada, nunca pula', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer({ status: { ...makePlayer().status, isDoubleJump: false } });
    expect(tryDoubleJump(scene, player, { wasGrounded: false, startedJump: false })).toBe(false);
  });

  it('já pulou de novo uma vez no ar -> não deixa usar de novo até tocar o chão', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer({ hasUsedDoubleJump: true, status: { ...makePlayer().status, isDoubleJump: true } });
    expect(tryDoubleJump(scene, player, { wasGrounded: false, startedJump: false })).toBe(false);
  });

  it('no ar, com a habilidade e ainda não usado -> pula e marca hasUsedDoubleJump', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer({ status: { ...makePlayer().status, isDoubleJump: true } });

    const result = tryDoubleJump(scene, player, { wasGrounded: false, startedJump: false });

    expect(result).toBe(true);
    expect(player.hasUsedDoubleJump).toBe(true);
    expect(player.body.velocity.y).toBe(-player.status.jumpHeight);
  });

  it('já pulou nesse frame por outro meio (startedJump=true) -> não empilha um segundo pulo', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer({ status: { ...makePlayer().status, isDoubleJump: true } });
    expect(tryDoubleJump(scene, player, { wasGrounded: false, startedJump: true })).toBe(true);
    expect(player.setVelocityY).not.toHaveBeenCalled();
  });
});

describe('isJumpHeld', () => {
  it('true se qualquer uma das fontes de "segurar pulo" estiver ativa', () => {
    expect(isJumpHeld(makeScene({ controlState: { jumpHeld: true } }))).toBe(true);
  });

  it('false quando nenhuma fonte está ativa', () => {
    expect(isJumpHeld(makeScene())).toBe(false);
  });
});

describe('updateParachute', () => {
  it('no chão -> desativa e libera reabrir o paraquedas', () => {
    const player = makePlayer({ isParachuteActive: true, hasUsedParachute: true });
    updateParachute(makeScene(), player, { wasGrounded: true, wallSide: 0, jumpHeld: false });
    expect(player.isParachuteActive).toBe(false);
    expect(player.hasUsedParachute).toBe(false);
  });

  it('caindo, segurando o botão, com a habilidade -> abre o paraquedas', () => {
    const player = makePlayer({ status: { ...makePlayer().status, isParachute: true } });
    player.body.velocity.y = 999;
    updateParachute(makeScene(), player, { wasGrounded: false, wallSide: 0, jumpHeld: true });
    expect(player.isParachuteActive).toBe(true);
    expect(player.body.velocity.y).toBe(player.status.parachuteFloatSpeed);
  });

  it('já usou e soltou o botão -> não reabre no mesmo período no ar', () => {
    const player = makePlayer({ status: { ...makePlayer().status, isParachute: true }, hasUsedParachute: true, isParachuteActive: false });
    player.body.velocity.y = 999;
    updateParachute(makeScene(), player, { wasGrounded: false, wallSide: 0, jumpHeld: true });
    expect(player.isParachuteActive).toBe(false);
  });

  it('invulnerável (tomou dano) -> paraquedas não funciona', () => {
    const player = makePlayer({ status: { ...makePlayer().status, isParachute: true }, invulnerable: true });
    player.body.velocity.y = 999;
    updateParachute(makeScene(), player, { wasGrounded: false, wallSide: 0, jumpHeld: true });
    expect(player.isParachuteActive).toBe(false);
  });
});

describe('updateJetpack', () => {
  it('no chão -> recarrega o combustível e desarma', () => {
    const player = makePlayer({ jetpackFuel: 0, jetpackArmed: true, isJetpackActive: true });
    updateJetpack(makeScene(), player, { wasGrounded: true, startedJump: false, jumpHeld: false });
    expect(player.jetpackFuel).toBe(player.status.jetpackFuelMs);
    expect(player.jetpackArmed).toBe(false);
    expect(player.isJetpackActive).toBe(false);
  });

  it('precisa apertar pulo DE NOVO no ar pra armar (não ativa sozinho)', () => {
    const scene = makeScene({ controlState: { jump: true } });
    const player = makePlayer({ status: { ...makePlayer().status, isJetpack: true } });
    updateJetpack(scene, player, { wasGrounded: false, startedJump: false, jumpHeld: false });
    expect(player.jetpackArmed).toBe(true);
  });

  it('armado + segurando + com combustível -> sobe e consome combustível', () => {
    const player = makePlayer({ jetpackArmed: true, status: { ...makePlayer().status, isJetpack: true } });
    const scene = makeScene({ game: { loop: { delta: 16 } } });

    updateJetpack(scene, player, { wasGrounded: false, startedJump: false, jumpHeld: true });

    expect(player.isJetpackActive).toBe(true);
    expect(player.jetpackFuel).toBe(500 - 16);
    expect(player.body.velocity.y).toBe(player.status.jetpackLiftSpeed);
  });

  it('sem combustível -> não sobe mesmo armado e segurando', () => {
    const player = makePlayer({ jetpackArmed: true, jetpackFuel: 0, status: { ...makePlayer().status, isJetpack: true } });
    updateJetpack(makeScene(), player, { wasGrounded: false, startedJump: false, jumpHeld: true });
    expect(player.isJetpackActive).toBe(false);
  });
});

describe('updateAnimation', () => {
  const baseArgs = { startedJump: false, wasGrounded: true, wasParachuteActive: false, input: { left: false, right: false } };

  it('disparando (isShooting) -> nunca troca a animação', () => {
    const player = makePlayer({ isShooting: true });
    updateAnimation(makeScene(), player, baseArgs);
    expect(player.anims.play).not.toHaveBeenCalled();
    expect(player.setTexture).not.toHaveBeenCalled();
  });

  it('grudado na parede -> toca "stick" sem reiniciar se já está tocando', () => {
    const player = makePlayer({ isWallSliding: true });
    player.anims.currentAnim = { key: 'knight_stick' };
    updateAnimation(makeScene(), player, baseArgs);
    expect(player.anims.play).not.toHaveBeenCalled();
  });

  it('parachute recém-aberto -> toca a animação; já estava aberto -> não reinicia', () => {
    const player = makePlayer({ isParachuteActive: true });
    updateAnimation(makeScene(), player, { ...baseArgs, wasParachuteActive: false });
    expect(player.anims.play).toHaveBeenCalledWith('knight_parachute', true);

    player.anims.play.mockClear();
    updateAnimation(makeScene(), player, { ...baseArgs, wasParachuteActive: true });
    expect(player.anims.play).not.toHaveBeenCalled();
  });

  it('no ar -> escolhe o frame do pulo em vez de tocar uma animação', () => {
    const player = makePlayer();
    player.body.blocked.down = false;
    updateAnimation(makeScene(), player, baseArgs);
    expect(player.setTexture).toHaveBeenCalled();
  });

  it('no chão andando -> toca "run"; parado -> toca "idle"', () => {
    const walking = makePlayer();
    updateAnimation(makeScene(), walking, { ...baseArgs, input: { left: false, right: true } });
    expect(walking.anims.play).toHaveBeenCalledWith('knight_run', true);

    const idle = makePlayer();
    updateAnimation(makeScene(), idle, baseArgs);
    expect(idle.anims.play).toHaveBeenCalledWith('knight_idle', true);
  });
});

describe('playJumpFrame', () => {
  it('subindo rápido -> frame 0', () => {
    const player = makePlayer();
    player.body.velocity.y = -100;
    playJumpFrame(player);
    expect(player.setTexture).toHaveBeenCalledWith('knight_jump', 0);
  });

  it('perto do ápice (velocidade perto de 0) -> frame 1', () => {
    const player = makePlayer();
    player.body.velocity.y = 0;
    playJumpFrame(player);
    expect(player.setTexture).toHaveBeenCalledWith('knight_jump', 1);
  });

  it('caindo rápido -> frame 2', () => {
    const player = makePlayer();
    player.body.velocity.y = 100;
    playJumpFrame(player);
    expect(player.setTexture).toHaveBeenCalledWith('knight_jump', 2);
  });
});
