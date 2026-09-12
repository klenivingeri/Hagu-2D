import { describe, it, expect, vi } from 'vitest';
import { createBulletSystem, cleanupProjectile, destroyProjectile } from './createBulletSystem.js';

// Estes testes existem por causa de um bug real (commit "fix: bullet
// enemy"): tiros de inimigo somem/travam o pool porque (1) um bullet
// reciclado do player carregava spawnX/maxRangePx antigos e (2) a limpeza
// de "saiu da tela" só checava a borda direita. Ver os comentários em
// fireEnemy() e cleanupProjectile() em createBulletSystem.js.

function makeProjectile(overrides = {}) {
  return {
    active: true,
    x: 100,
    spawnX: 100,
    maxRangePx: 0,
    body: {
      stop: vi.fn(),
      enable: true,
      setVelocityX: vi.fn(function setVelocityX(vx) { this.velocity = { ...this.velocity, x: vx }; }),
    },
    setActive: vi.fn(function setActive(v) { this.active = v; return this; }),
    setVisible: vi.fn(),
    setPosition: vi.fn(),
    setDepth: vi.fn(),
    ...overrides,
  };
}

function makeSceneForCleanup(overrides = {}) {
  return { scale: { width: 800, height: 600 }, ...overrides };
}

describe('destroyProjectile', () => {
  it('desativa, esconde, para o corpo físico e some da tela', () => {
    const projectile = makeProjectile();
    destroyProjectile(projectile);

    expect(projectile.setActive).toHaveBeenCalledWith(false);
    expect(projectile.setVisible).toHaveBeenCalledWith(false);
    expect(projectile.body.stop).toHaveBeenCalled();
    expect(projectile.body.enable).toBe(false);
    expect(projectile.setPosition).toHaveBeenCalledWith(-1000, -1000);
  });
});

describe('cleanupProjectile', () => {
  it('ignora projéteis já inativos (sem chamar nada)', () => {
    const projectile = makeProjectile({ active: false });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).not.toHaveBeenCalled();
  });

  it('destrói ao sair pela borda DIREITA da tela', () => {
    const projectile = makeProjectile({ x: 900 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).toHaveBeenCalledWith(false);
  });

  it('destrói ao sair pela borda ESQUERDA da tela (regressão do bug)', () => {
    // Bullet de inimigo virado pra esquerda anda com velocity.x negativo e
    // x diminuindo — antes da correção, só x > scale.width era checado, e
    // esse bullet nunca era destruído: vazava um slot do pool
    // scene.bullets (maxSize compartilhado com o player) até travar os
    // disparos de todo mundo.
    const projectile = makeProjectile({ x: -5 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).toHaveBeenCalledWith(false);
  });

  it('dentro da tela e dentro do alcance -> não destrói', () => {
    const projectile = makeProjectile({ x: 150, spawnX: 100, maxRangePx: 100 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).not.toHaveBeenCalled();
  });

  it('dentro da tela mas passou do alcance máximo -> destrói', () => {
    const projectile = makeProjectile({ x: 250, spawnX: 100, maxRangePx: 100 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).toHaveBeenCalledWith(false);
  });

  it('maxRangePx=0 (bullet de inimigo) nunca é limitado por alcance, só pela tela', () => {
    // fireEnemy() zera maxRangePx de propósito — inimigo não tem "alcance
    // máximo", só o corte de tela mais acima.
    const projectile = makeProjectile({ x: 700, spawnX: 0, maxRangePx: 0 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).not.toHaveBeenCalled();
  });

  // Bug real: no modo "mobile" (Phaser.Scale.RESIZE, ver
  // GameScene.applyScaleModeForZoom), scene.scale.width vira o tamanho real
  // da TELA do aparelho (ex: 390px), não o do MAPA (ex: 448px) — diferente
  // do modo "gameboy" (FIT), onde os dois coincidem por acaso. Como
  // projectile.x é coordenada de MUNDO, comparar com scale.width destruía
  // qualquer bullet assim que o player chegava perto da borda direita do
  // mapa, bem antes do fim de verdade — só reproduzia no mobile porque só lá
  // scale.width < largura do mapa.
  it('viewport (scale.width) menor que o mapa não destrói bullet ainda dentro do mundo (regressão modo mobile)', () => {
    const scene = makeSceneForCleanup({ scale: { width: 390, height: 390 }, map: { widthInPixels: 448, heightInPixels: 448 } });
    const projectile = makeProjectile({ x: 420 }); // dentro do mapa (448), fora do viewport (390)
    cleanupProjectile(scene, projectile);
    expect(projectile.setActive).not.toHaveBeenCalled();
  });

  it('destrói ao sair de verdade do mundo, mesmo com viewport menor que o mapa', () => {
    const scene = makeSceneForCleanup({ scale: { width: 390, height: 390 }, map: { widthInPixels: 448, heightInPixels: 448 } });
    const projectile = makeProjectile({ x: 450 }); // além da largura real do mapa
    cleanupProjectile(scene, projectile);
    expect(projectile.setActive).toHaveBeenCalledWith(false);
  });

  it('sem scene.map (cenário de teste antigo), cai de volta pro scale.width', () => {
    const projectile = makeProjectile({ x: 900 });
    cleanupProjectile(makeSceneForCleanup(), projectile);
    expect(projectile.setActive).toHaveBeenCalledWith(false);
  });
});

// createBulletSystem(scene) monta vários colliders/overlaps na criação —
// como platforms fica vazio, nenhum desses colliders é criado de verdade
// (só precisamos de scene.physics.add.{collider,overlap} como espiões pra
// não quebrar o wiring). O que importa aqui é só o objeto devolvido.
function makeSceneForBulletSystem(overrides = {}) {
  return {
    platforms: [],
    physics: { add: { collider: vi.fn(), overlap: vi.fn() } },
    input: { on: vi.fn() },
    bullets: { get: vi.fn() },
    swordWaves: {},
    fireballs: {},
    bombs: {},
    scale: { width: 800, height: 600 },
    sound: { play: vi.fn() },
    map: { tileWidth: 16 },
    lastDirection: 1,
    player: null,
    ...overrides,
  };
}

function makeEnemy(overrides = {}) {
  return {
    body: { center: { x: 200, y: 80 } },
    entityConfig: {},
    depth: 5,
    ...overrides,
  };
}

describe('fireEnemy', () => {
  it('pool esgotado (bullets.get devolve null) -> não lança nem tenta configurar nada', () => {
    const scene = makeSceneForBulletSystem();
    scene.bullets.get.mockReturnValue(null);
    const system = createBulletSystem(scene);

    expect(() => system.fireEnemy(makeEnemy(), 1)).not.toThrow();
  });

  it('zera maxRangePx/spawnX do bullet reciclado (regressão: não pode herdar valores de um tiro antigo do player)', () => {
    const scene = makeSceneForBulletSystem();
    // Simula exatamente o cenário do bug: este objeto já foi um bullet do
    // player antes de voltar pro pool.
    const recycledBullet = makeProjectile({ x: 500, spawnX: 480, maxRangePx: 64 });
    scene.bullets.get.mockReturnValue(recycledBullet);
    const system = createBulletSystem(scene);

    system.fireEnemy(makeEnemy(), 1);

    expect(recycledBullet.maxRangePx).toBe(0);
    expect(recycledBullet.spawnX).toBeUndefined();
  });

  it('marca owner "enemy" e aplica velocidade/ângulo conforme a direção', () => {
    const scene = makeSceneForBulletSystem();
    const bullet = makeProjectile();
    bullet.body.setVelocityX = vi.fn();
    scene.bullets.get.mockReturnValue(bullet);
    const system = createBulletSystem(scene);

    system.fireEnemy(makeEnemy({ entityConfig: { projectile: { speed: 250 } } }), -1);

    expect(bullet.owner).toBe('enemy');
    expect(bullet.body.setVelocityX).toHaveBeenCalledWith(-250);
    expect(bullet.angle).toBe(270);
  });

  it('sem projectile.speed configurado, usa 300 como default', () => {
    const scene = makeSceneForBulletSystem();
    const bullet = makeProjectile();
    bullet.body.setVelocityX = vi.fn();
    scene.bullets.get.mockReturnValue(bullet);
    const system = createBulletSystem(scene);

    system.fireEnemy(makeEnemy(), 1);

    expect(bullet.body.setVelocityX).toHaveBeenCalledWith(300);
    expect(bullet.angle).toBe(90);
  });

  it('dano vem de entityConfig.attack.damage, com fallback pro projectile.damage e depois 1', () => {
    const scene = makeSceneForBulletSystem();
    const bullet1 = makeProjectile();
    bullet1.body.setVelocityX = vi.fn();
    scene.bullets.get.mockReturnValue(bullet1);
    const system = createBulletSystem(scene);

    system.fireEnemy(makeEnemy({ entityConfig: { attack: { damage: 3 }, projectile: { damage: 9 } } }), 1);
    expect(bullet1.damage).toBe(3);

    const bullet2 = makeProjectile();
    bullet2.body.setVelocityX = vi.fn();
    scene.bullets.get.mockReturnValue(bullet2);
    system.fireEnemy(makeEnemy({ entityConfig: { projectile: { damage: 9 } } }), 1);
    expect(bullet2.damage).toBe(9);

    const bullet3 = makeProjectile();
    bullet3.body.setVelocityX = vi.fn();
    scene.bullets.get.mockReturnValue(bullet3);
    system.fireEnemy(makeEnemy({ entityConfig: {} }), 1);
    expect(bullet3.damage).toBe(1);
  });

  it('regressão fim-a-fim: um bullet reciclado do player não é destruído por engano logo após o inimigo atirar', () => {
    // Reproduz o bug de ponta a ponta: um bullet do player, reciclado pelo
    // pool, tinha x/spawnX próximos (dentro do range antigo) — sem o reset
    // em fireEnemy(), o PRÓXIMO cleanupProjectile() o destruiria quase
    // instantaneamente, fazendo o tiro do inimigo "não sair do lugar".
    const scene = makeSceneForBulletSystem();
    const recycledBullet = makeProjectile({ x: 500, spawnX: 480, maxRangePx: 16 });
    recycledBullet.body.setVelocityX = vi.fn((vx) => { recycledBullet.body.velocity = { x: vx }; });
    scene.bullets.get.mockReturnValue(recycledBullet);
    const system = createBulletSystem(scene);

    system.fireEnemy(makeEnemy({ body: { center: { x: 500, y: 80 } } }), 1);
    // Ainda na mesma posição do frame em que nasceu (x=500) — se maxRangePx
    // não tivesse sido zerado, |500 - 480| = 20 >= o antigo range de 16 já
    // destruiria o tiro aqui.
    cleanupProjectile(scene, recycledBullet);

    expect(recycledBullet.active).toBe(true);
    expect(recycledBullet.setActive).not.toHaveBeenCalledWith(false);
  });
});

// update() também limpa fireball/bomba com o mesmo bug de scale.width vs
// mundo (ver cleanupProjectile) — cobrindo os dois aqui em vez de duplicar
// os cenários de cleanupProjectile.
describe('update() — limpeza de fireball/bomba fora do mundo', () => {
  function makeFireball(overrides = {}) {
    return { active: true, x: 0, y: 0, lastGroundY: 0, setActive: vi.fn(), setVisible: vi.fn(), setPosition: vi.fn(), body: { stop: vi.fn(), enable: true }, ...overrides };
  }

  function makeBomb(overrides = {}) {
    return { active: true, _armed: false, x: 0, y: 0, setActive: vi.fn(), setVisible: vi.fn(), setPosition: vi.fn(), body: { stop: vi.fn(), enable: true }, ...overrides };
  }

  // emitFireballTrail/emitBombTrail (dustTrail.js) pedem um emissor de
  // partículas de verdade — pré-populamos scene._dustEmitter pra pular a
  // criação (scene.add.particles), que esta cena de teste não tem.
  const fakeDustEmitter = { emitParticleAt: vi.fn(), alive: [{}] };

  it('fireball dentro do mapa mas fora do viewport (mobile/RESIZE) não é destruída', () => {
    const fireball = makeFireball({ x: 420 });
    const scene = makeSceneForBulletSystem({
      scale: { width: 390, height: 390 },
      map: { tileWidth: 16, widthInPixels: 448, heightInPixels: 448 },
      time: { now: 0 },
      _dustEmitter: fakeDustEmitter,
      bullets: { getChildren: () => [] },
      swordWaves: { getChildren: () => [] },
      fireballs: { getChildren: () => [fireball] },
      bombs: { getChildren: () => [] },
    });
    const system = createBulletSystem(scene);

    system.update();

    expect(fireball.setActive).not.toHaveBeenCalled();
  });

  it('fireball que realmente saiu do mapa é destruída', () => {
    const fireball = makeFireball({ x: 460 });
    const scene = makeSceneForBulletSystem({
      scale: { width: 390, height: 390 },
      map: { tileWidth: 16, widthInPixels: 448, heightInPixels: 448 },
      time: { now: 0 },
      _dustEmitter: fakeDustEmitter,
      bullets: { getChildren: () => [] },
      swordWaves: { getChildren: () => [] },
      fireballs: { getChildren: () => [fireball] },
      bombs: { getChildren: () => [] },
    });
    const system = createBulletSystem(scene);

    system.update();

    expect(fireball.setActive).toHaveBeenCalledWith(false);
  });

  it('bomba dentro do mapa mas fora do viewport (mobile/RESIZE) não é destruída', () => {
    const bomb = makeBomb({ x: 420, y: 420 });
    const scene = makeSceneForBulletSystem({
      scale: { width: 390, height: 390 },
      map: { tileWidth: 16, widthInPixels: 448, heightInPixels: 448 },
      time: { now: 0 },
      _dustEmitter: fakeDustEmitter,
      bullets: { getChildren: () => [] },
      swordWaves: { getChildren: () => [] },
      fireballs: { getChildren: () => [] },
      bombs: { getChildren: () => [bomb] },
    });
    const system = createBulletSystem(scene);

    system.update();

    expect(bomb.setActive).not.toHaveBeenCalled();
  });
});
