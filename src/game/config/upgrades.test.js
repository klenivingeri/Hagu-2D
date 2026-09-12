import { describe, it, expect } from 'vitest';
import {
  UPGRADES_CATALOG,
  findUpgradeDef,
  getUpgradeValue,
  getUpgradeCost,
  isUpgradeMaxed,
  getUpgradeCurrency,
} from './upgrades.js';

describe('findUpgradeDef', () => {
  it('encontra um upgrade existente pelo id', () => {
    expect(findUpgradeDef('damage')?.id).toBe('damage');
  });

  it('retorna null para um id que não existe no catálogo', () => {
    expect(findUpgradeDef('upgrade-inexistente')).toBeNull();
  });
});

describe('getUpgradeValue', () => {
  it('retorna undefined quando o def não existe', () => {
    expect(getUpgradeValue(null, 3)).toBeUndefined();
  });

  it('upgrade booleano vira true a partir do nível 1, mesmo antes disso false', () => {
    const def = findUpgradeDef('doubleJump');
    expect(getUpgradeValue(def, 0)).toBe(false);
    expect(getUpgradeValue(def, 1)).toBe(true);
  });

  it('upgrade numérico soma base + perLevel * nível', () => {
    const def = findUpgradeDef('damage');
    expect(getUpgradeValue(def, 0)).toBe(def.base);
    expect(getUpgradeValue(def, 3)).toBe(def.base + def.perLevel * 3);
  });

  it('respeita o piso `min` quando o cálculo bruto cairia abaixo dele', () => {
    // Def sintética (não depende do balanceamento atual do catálogo): em
    // nível 10, base + perLevel*nível = 100 - 500 = -400, bem abaixo de
    // min — a regra de negócio é nunca deixar o valor passar do piso.
    const def = { base: 100, perLevel: -50, min: 20 };
    expect(getUpgradeValue(def, 10)).toBe(20);
  });

  it('sem `min` definido, o valor pode cair livremente com perLevel negativo', () => {
    const def = { base: 100, perLevel: -50 };
    expect(getUpgradeValue(def, 3)).toBe(-50);
  });
});

describe('getUpgradeCost', () => {
  it('retorna Infinity quando o def não existe (nunca compra de graça por engano)', () => {
    expect(getUpgradeCost(null, 0)).toBe(Infinity);
  });

  it('nível 0 custa exatamente o baseCost', () => {
    const def = findUpgradeDef('damage');
    expect(getUpgradeCost(def, 0)).toBe(def.baseCost);
  });

  it('custo cresce geometricamente com costGrowth', () => {
    const def = findUpgradeDef('damage');
    expect(getUpgradeCost(def, 2)).toBe(Math.round(def.baseCost * def.costGrowth ** 2));
  });
});

describe('isUpgradeMaxed', () => {
  it('def inexistente conta como maxed (bloqueia compra por segurança)', () => {
    expect(isUpgradeMaxed(null, 0)).toBe(true);
  });

  it('não maxed abaixo do maxLevel, maxed a partir dele', () => {
    const def = findUpgradeDef('damage');
    expect(isUpgradeMaxed(def, def.maxLevel - 1)).toBe(false);
    expect(isUpgradeMaxed(def, def.maxLevel)).toBe(true);
  });
});

describe('getUpgradeCurrency', () => {
  it('usa coins por padrão quando o catálogo não define currency', () => {
    expect(getUpgradeCurrency(findUpgradeDef('damage'))).toBe('coins');
  });

  it('usa diamant só para upgrades marcados explicitamente', () => {
    expect(getUpgradeCurrency(findUpgradeDef('doubleJump'))).toBe('diamant');
  });

  it('def undefined cai no padrão coins', () => {
    expect(getUpgradeCurrency(undefined)).toBe('coins');
  });
});

describe('UPGRADES_CATALOG (integridade dos dados)', () => {
  it('todo id do catálogo é único', () => {
    const ids = UPGRADES_CATALOG.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo upgrade não-booleano tem base/perLevel/maxLevel numéricos', () => {
    UPGRADES_CATALOG.filter((def) => !def.boolean).forEach((def) => {
      expect(typeof def.base).toBe('number');
      expect(typeof def.perLevel).toBe('number');
      expect(typeof def.maxLevel).toBe('number');
    });
  });
});
