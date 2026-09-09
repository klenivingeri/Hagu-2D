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
    speed: 110,                // velocidade horizontal (px/s) - já usado em updatePlayerMovement
    jumpHeight: 200,            // força do pulo (velocidade vertical, px/s) - já usado em updatePlayerMovement
    maxSafeFallTiles: upgradeValue('fallResistance'), // tiles de queda seguros antes de morrer
    isStick: gameState.isStick, // habilidade já usada pela mecânica de parede
    wallSlideSpeed: 45,         // velocidade máxima de descida ao grudar na parede
    wallJumpHorizontalSpeed: 180, // impulso horizontal do pulo de parede
    bulletDamage: upgradeValue('damage'),     // dano de cada tiro - já usado em createBulletSystem/createEnemy (overlap bullet x enemy)
    bulletRangeTiles: upgradeValue('bulletRange'), // alcance do tiro do player, em tiles (ver createBulletSystem)

    isDoubleJump: upgradeValue('doubleJump'),
    isJetpack: upgradeValue('jetpack'),
    jetpackFuelMs: upgradeValue('energy'),   // duração total de uso do jetpack, em ms
    jetpackFloatSpeed: 40,         // velocidade máxima de queda enquanto o jetpack está freando
    doubleJumpEnabled: upgradeValue('doubleJump'), // compatibilidade com o nome antigo
    jumpDamage: 1,                 // dano ao pisar em cima do inimigo (stomp)
    currentWeapon: 'bow',           // arma equipada (hoje só existe o arco)
    totalGold: gameState.gold,
    totalCoins: gameState.coins,
    diamant: gameState.diamant,
    exp: gameState.exp,
    playerSpritePath: gameState.playerSpritePath,
    BulletSequence: upgradeValue('sequence'),   // quantas flechas saem por disparo
    AljavaBullet: gameState.AljavaBullet,
    LoadingBullet: upgradeValue('reloadSpeed'), // ms pra recarregar 1 flecha da aljava
    currentAljavaBullet: gameState.AljavaBullet,
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
