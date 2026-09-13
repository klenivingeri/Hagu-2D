// ==========================================
// STATUS (ATRIBUTOS) DE PLAYER E ENEMY
// ==========================================
// Centraliza os números de gameplay que hoje ficavam espalhados/hardcoded
// pelo código (velocidade, altura do pulo, vida, dano...). Assim dá pra
// balancear tudo num lugar só.
//
// IMPORTANTE: use as funções createPlayerStatus()/createEnemyStatus() (não
// importe um objeto pronto e reaproveite ele). Cada player/enemy precisa
// da SUA PRÓPRIA cópia do status — se todo mundo apontasse pro mesmo
// objeto, um inimigo perdendo vida afetaria a vida de todos os outros.
import { gameState } from '../../managers/GameManager.js';
import { findUpgradeDef, getUpgradeValue } from './upgrades.js';

// Valor atual (base + perLevel * nível comprado) de um upgrade da loja —
// ver game/config/upgrades.js. Única fonte de verdade dos stats compráveis,
// pra loja e gameplay nunca dessincronizarem.
function upgradeValue(id) {
  return getUpgradeValue(findUpgradeDef(id), gameState.upgrade[id] || 0);
}

export function createPlayerStatus(overrides = {}) {
  return {
    life: gameState.maxlife,  // vidas/corações
    coyoteTimeMs: 65,
    speed: 100,                // velocidade horizontal (px/s) - já usado em updatePlayerMovement
    jumpHeight: 210,            // força do pulo (velocidade vertical, px/s) - já usado em updatePlayerMovement
    maxSafeFallTiles: upgradeValue('fallResistance'), // tiles de queda seguros antes de morrer
    // Pulo duplo/paraquedas/jetpack/parede são comprados na Loja mas só um fica ATIVO
    // por vez (ver GameManager.equipAbility) — por isso checam
    // gameState.equippedAbility, nunca o nível do upgrade direto.
    isStick: gameState.equippedAbility === 'isStick', // habilidade equipada de grudar na parede
    isPump: gameState.equippedAbility === 'isPump', // habilidade equipada de bomba (segurar/soltar o disparo)
    wallSlideSpeed: 45,         // velocidade máxima de descida ao grudar na parede
    wallJumpHorizontalSpeed: 180, // impulso horizontal do pulo de parede
    bulletDamage: upgradeValue('damage'),     // dano de cada tiro - já usado em createBulletSystem/createEnemy (overlap bullet x enemy)
    bombDamage: upgradeValue('bombDamage'),   // dano da explosão em área da habilidade "isPump" (ver explodeBomb em createBulletSystem.js)
    bulletRangeTiles: upgradeValue('bulletRange'), // alcance do tiro do player, em tiles (ver createBulletSystem)

    isDoubleJump: gameState.equippedAbility === 'doubleJump',
    isParachute: gameState.equippedAbility === 'parachute',
    parachuteFloatSpeed: 40,         // velocidade máxima de queda enquanto o paraquedas está freando
    isJetpack: gameState.equippedAbility === 'jetpack',
    jetpackFuelMs: upgradeValue('energy'),   // duração total de uso do jetpack, em ms
    jetpackLiftSpeed: -70,          // velocidade vertical (px/s) aplicada enquanto o jetpack sobe
    doubleJumpEnabled: gameState.equippedAbility === 'doubleJump', // compatibilidade com o nome antigo
    jumpDamage: 1,                 // dano ao pisar em cima do inimigo (stomp)
    // Arma equipada na aba "Equip. > Acessório" (ver ACCESSORY_UPGRADE_IDS
    // em game/config/upgrades.js) — createBulletSystem.js lê daqui pra
    // escolher animação/dano/perfuração do tiro.
    currentWeapon: gameState.equippedAccessory,
    totalGold: gameState.gold,
    totalCoins: gameState.coins,
    diamant: gameState.diamant,
    exp: gameState.exp,
    playerSpritePath: gameState.playerSpritePath,
    BulletSequence: upgradeValue('sequence'),   // quantas flechas saem por disparo
    // Nº de hits de queimadura aplicados por acerto da bola de fogo do
    // Cajado (upgrade 'burnTicks' — ver WEAPONS_CONFIG.staff em
    // game/config/weapons.js e spawnFireball em createBulletSystem.js). Não
    // acumula entre acertos: cada novo hit apenas reinicia a contagem
    // (ver applyBurn em entities/EnemyBase.js), nunca soma.
    burnTicks: upgradeValue('burnTicks'),
    // Energia: todas as armas (ver ACCESSORY_UPGRADE_IDS em
    // game/config/upgrades.js) gastam energia pra atacar — não é mais só
    // munição do arco/arma (ver createBulletSystem.js). Exibida como blocos
    // no HUD (a "aljava"); sistema de carregador — só recarrega (todos os
    // blocos de uma vez) depois de esvaziar, na velocidade do upgrade
    // 'reloadSpeed'.
    maxEnergy: gameState.maxEnergy,
    energyRegenMs: upgradeValue('reloadSpeed'), // ms pra recarregar a aljava inteira depois de esvaziar
    currentEnergy: gameState.maxEnergy,
    dropDiamant: gameState.dropDiamant,
    coinValue: upgradeValue('coinValue'),       // moedas globais ganhas por coleta (ver createCoins)
    upgrade: gameState.upgrade,

    ...overrides,
  };
}

export function createEnemyStatus(overrides = {}) {
  return {
    life: 3,              // +2 em relação ao original, pra dar pra ver a animação de stomp antes de morrer
    speed: 50,           // velocidade de patrulha - já usado em createEnemy(s)
    contactDamage: 1,      // dano que causa ao encostar no player (hoje hitByEnemy tira 1 vida fixo)

    ...overrides,
  };
}
