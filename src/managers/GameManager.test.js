import { describe, it, expect, beforeEach } from 'vitest';
import {
  gameState,
  resetProgress,
  purchaseUpgrade,
  getUpgradeLevel,
  getUpgradeState,
  equipAbility,
  isAbilityEquipped,
  equipAccessory,
  isAccessoryEquipped,
  unlockMap,
  isMapUnlocked,
  recordMapStars,
  getMapStars,
  addGlobalCoins,
  addGlobalDiamant,
  addGlobalExp,
  getLevelInfo,
  updateSetting,
  setVisualFilter,
  setPlatformMode,
  recordEnemyDefeat,
  unlockEnemySprite,
  hasCollectedSprite,
  getCollectionEntry,
} from './GameManager.js';
import { EXP_PER_LEVEL } from '../constants.js';
import { DEFAULT_MAP_KEY } from '../game/config/maps.js';

// gameState é um singleton mutável de propósito (ver comentário no topo do
// próprio GameManager.js) — cada teste precisa partir de um estado limpo,
// senão um teste contamina o próximo.
beforeEach(() => {
  window.localStorage.clear();
  resetProgress();
});

describe('purchaseUpgrade', () => {
  it('desconta a moeda certa e sobe o nível do upgrade', () => {
    gameState.coins = 999999;
    const before = gameState.coins;
    const cost = getUpgradeState('damage').cost;

    const bought = purchaseUpgrade('damage');

    expect(bought).toBe(true);
    expect(getUpgradeLevel('damage')).toBe(1);
    expect(gameState.coins).toBe(before - cost);
  });

  it('não compra (nem cobra) sem saldo suficiente', () => {
    gameState.coins = 0;
    const before = gameState.coins;

    const bought = purchaseUpgrade('damage');

    expect(bought).toBe(false);
    expect(getUpgradeLevel('damage')).toBe(0);
    expect(gameState.coins).toBe(before);
  });

  it('não compra além do nível máximo do upgrade', () => {
    gameState.coins = 999999;
    const def = getUpgradeState('doubleJump').def;
    // doubleJump usa diamant, não coins.
    gameState.diamant = 999999;

    for (let i = 0; i < def.maxLevel + 5; i += 1) purchaseUpgrade('doubleJump');

    expect(getUpgradeLevel('doubleJump')).toBe(def.maxLevel);
  });

  it('id inexistente não compra nada', () => {
    expect(purchaseUpgrade('upgrade-que-nao-existe')).toBe(false);
  });

  it('comprar "life" espelha o novo total em gameState.maxlife (lido fora do status)', () => {
    gameState.coins = 999999;
    const before = gameState.maxlife;

    purchaseUpgrade('life');

    expect(gameState.maxlife).toBeGreaterThan(before);
  });
});

describe('equipAbility', () => {
  it('não equipa uma habilidade que ainda não foi comprada', () => {
    expect(equipAbility('doubleJump')).toBe(false);
    expect(isAbilityEquipped('doubleJump')).toBe(false);
  });

  it('equipa uma habilidade já comprada, e clicar de novo desequipa', () => {
    gameState.upgrade.doubleJump = 1;

    expect(equipAbility('doubleJump')).toBe(true);
    expect(isAbilityEquipped('doubleJump')).toBe(true);

    expect(equipAbility('doubleJump')).toBe(true);
    expect(isAbilityEquipped('doubleJump')).toBe(false);
  });

  it('só uma habilidade fica equipada por vez', () => {
    gameState.upgrade.doubleJump = 1;
    gameState.upgrade.parachute = 1;

    equipAbility('doubleJump');
    equipAbility('parachute');

    expect(isAbilityEquipped('doubleJump')).toBe(false);
    expect(isAbilityEquipped('parachute')).toBe(true);
  });

  it('id que não é uma habilidade equipável nunca equipa', () => {
    gameState.upgrade.damage = 5;
    expect(equipAbility('damage')).toBe(false);
  });
});

describe('equipAccessory', () => {
  it('não troca para uma arma que ainda não foi comprada', () => {
    expect(equipAccessory('sword')).toBe(false);
  });

  it('troca de arma sem nunca ficar "sem nenhuma" equipada', () => {
    gameState.upgrade.sword = 1;

    expect(equipAccessory('sword')).toBe(true);
    expect(isAccessoryEquipped('sword')).toBe(true);
    expect(gameState.equippedAccessory).toBe('sword');

    // Diferente de equipAbility, clicar na já equipada não desequipa.
    expect(equipAccessory('sword')).toBe(true);
    expect(isAccessoryEquipped('sword')).toBe(true);
  });
});

describe('mapas', () => {
  it('o mapa inicial já nasce desbloqueado', () => {
    expect(isMapUnlocked(DEFAULT_MAP_KEY)).toBe(true);
  });

  it('unlockMap é idempotente e libera um novo mapKey', () => {
    unlockMap('floresta_2');
    unlockMap('floresta_2');

    expect(isMapUnlocked('floresta_2')).toBe(true);
    expect(gameState.unlockedMaps.filter((m) => m === 'floresta_2')).toHaveLength(1);
  });

  it('recordMapStars só sobrescreve quando o resultado novo é melhor', () => {
    recordMapStars('floresta_1', 2);
    expect(getMapStars('floresta_1')).toBe(2);

    recordMapStars('floresta_1', 1);
    expect(getMapStars('floresta_1')).toBe(2);

    recordMapStars('floresta_1', 3);
    expect(getMapStars('floresta_1')).toBe(3);
  });
});

describe('moedas/diamantes/exp globais', () => {
  it('addGlobalCoins soma ao total existente', () => {
    const before = gameState.coins;
    addGlobalCoins(10);
    expect(gameState.coins).toBe(before + 10);
  });

  it('addGlobalDiamant soma ao total existente', () => {
    const before = gameState.diamant;
    addGlobalDiamant(5);
    expect(gameState.diamant).toBe(before + 5);
  });

  it('getLevelInfo deriva nível/progresso do exp total, nunca guarda à parte', () => {
    addGlobalExp(EXP_PER_LEVEL + 10);
    const info = getLevelInfo();
    expect(info.level).toBe(2);
    expect(info.current).toBe(10);
  });
});

describe('configurações', () => {
  it('updateSetting ignora chaves desconhecidas', () => {
    const before = { ...gameState.settings };
    updateSetting('chave-que-nao-existe', true);
    expect(gameState.settings).toEqual(before);
  });

  it('updateSetting grava uma chave válida', () => {
    updateSetting('vibrationEnabled', false);
    expect(gameState.settings.vibrationEnabled).toBe(false);
  });

  it('setVisualFilter só aceita os valores conhecidos', () => {
    setVisualFilter('gameboy');
    expect(gameState.settings.visualFilter).toBe('gameboy');

    setVisualFilter('valor-invalido');
    expect(gameState.settings.visualFilter).toBe('gameboy');
  });

  it('setPlatformMode também reajusta o cameraZoom pro default do modo', () => {
    setPlatformMode('mobile');
    expect(gameState.settings.platformMode).toBe('mobile');
    expect(gameState.settings.cameraZoom).toBe(3);

    setPlatformMode('gameboy');
    expect(gameState.settings.cameraZoom).toBe(2);
  });
});

describe('coleção (bestiário)', () => {
  it('recordEnemyDefeat cria a entrada e soma kills entre chamadas', () => {
    recordEnemyDefeat({ key: 'bat', path: 'bat', behavior: 'patrol_fly', count: 3 });
    recordEnemyDefeat({ key: 'bat', path: 'bat', behavior: 'patrol_fly', count: 2 });

    expect(getCollectionEntry('bat').kills).toBe(5);
  });

  it('sprite só fica desbloqueado depois de unlockEnemySprite', () => {
    recordEnemyDefeat({ key: 'bat' });
    expect(hasCollectedSprite('bat')).toBe(false);

    unlockEnemySprite({ key: 'bat' });
    expect(hasCollectedSprite('bat')).toBe(true);
  });
});

describe('resetProgress', () => {
  it('devolve moedas, upgrades e equipamentos para o estado inicial', () => {
    gameState.coins = 500;
    gameState.upgrade.damage = 5;
    gameState.equippedAccessory = 'sword';
    gameState.mapStars = { floresta_1: 3 };

    resetProgress();

    expect(gameState.coins).toBe(0);
    expect(getUpgradeLevel('damage')).toBe(0);
    expect(gameState.equippedAccessory).toBe('defaultWeapon');
    expect(gameState.mapStars).toEqual({});
  });
});
