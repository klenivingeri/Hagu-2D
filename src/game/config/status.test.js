import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayerStatus, createEnemyStatus } from './status.js';
import { gameState, resetProgress } from '../../managers/GameManager.js';
import { findUpgradeDef, getUpgradeValue } from './upgrades.js';

beforeEach(() => {
  window.localStorage.clear();
  resetProgress();
});

describe('createPlayerStatus', () => {
  it('life começa igual a gameState.maxlife', () => {
    gameState.maxlife = 7;
    expect(createPlayerStatus().life).toBe(7);
  });

  it('só a habilidade equipada em gameState.equippedAbility fica true', () => {
    gameState.equippedAbility = 'isStick';
    const status = createPlayerStatus();

    expect(status.isStick).toBe(true);
    expect(status.isDoubleJump).toBe(false);
    expect(status.isParachute).toBe(false);
    expect(status.isJetpack).toBe(false);
  });

  it('nenhuma habilidade equipada -> todas as flags de habilidade falsas', () => {
    gameState.equippedAbility = null;
    const status = createPlayerStatus();

    expect(status.isStick).toBe(false);
    expect(status.isDoubleJump).toBe(false);
    expect(status.isParachute).toBe(false);
    expect(status.isJetpack).toBe(false);
    expect(status.isPump).toBe(false);
  });

  it('stats compráveis vêm de getUpgradeValue(upgrade[id]), nunca hardcoded', () => {
    gameState.upgrade.damage = 3;
    const expectedDamage = getUpgradeValue(findUpgradeDef('damage'), 3);

    expect(createPlayerStatus().bulletDamage).toBe(expectedDamage);
  });

  it('overrides explícitos vencem qualquer valor derivado do gameState', () => {
    const status = createPlayerStatus({ speed: 999, life: 1 });
    expect(status.speed).toBe(999);
    expect(status.life).toBe(1);
  });
});

describe('createEnemyStatus', () => {
  it('usa os defaults quando nenhum override é passado', () => {
    const status = createEnemyStatus();
    expect(status).toEqual({ life: 3, speed: 50, contactDamage: 1 });
  });

  it('overrides sobrescrevem só os campos informados', () => {
    const status = createEnemyStatus({ life: 10 });
    expect(status.life).toBe(10);
    expect(status.speed).toBe(50);
  });

  it('duas chamadas retornam objetos distintos (nunca a mesma referência)', () => {
    // Guarda contra o bug documentado no topo de status.js: se dois
    // inimigos compartilhassem o mesmo objeto, um perdendo vida afetaria
    // a vida de todos os outros.
    const a = createEnemyStatus();
    const b = createEnemyStatus();
    a.life = 0;
    expect(b.life).toBe(3);
  });
});
