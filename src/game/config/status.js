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

export function createPlayerStatus(overrides = {}) {
  return {
    life: gameState.maxlife,  // vidas/corações
    coyoteTimeMs: 65,
    speed: 110,                // velocidade horizontal (px/s) - já usado em updatePlayerMovement
    jumpHeight: 200,            // força do pulo (velocidade vertical, px/s) - já usado em updatePlayerMovement
    maxSafeFallTiles: gameState.maxSafeFallTiles,
    isStick: gameState.isStick, // habilidade já usada pela mecânica de parede
    wallSlideSpeed: 45,         // velocidade máxima de descida ao grudar na parede
    wallJumpHorizontalSpeed: 180, // impulso horizontal do pulo de parede
    bulletDamage: 1,             // dano de cada tiro - já usado em createBulletSystem/createEnemy (overlap bullet x enemy)

    // Campos abaixo ainda não têm mecânica implementada no jogo.
    // Só existem no objeto pra já ter onde guardar quando forem implementados.
    isDoubleJump: gameState.isDoubleJump,
    isJetpack: gameState.isJetpack,
    doubleJumpEnabled: gameState.isDoubleJump, // compatibilidade com o nome antigo
    jumpDamage: 1,                 // dano ao pisar em cima do inimigo (stomp)
    currentWeapon: 'bow',           // arma equipada (hoje só existe o arco)
    totalGold: gameState.gold,
    totalCoins: gameState.coins,
    diamant: gameState.diamant,
    exp: gameState.exp,
    playerSpritePath: gameState.playerSpritePath,
    bulluetDistance: gameState.bulluetDistance,
    BulletSequence: gameState.BulletSequence,
    AljavaBullet: gameState.AljavaBullet,
    LoadingBullet: gameState.LoadingBullet,
    currentAljavaBullet: gameState.AljavaBullet,
    dropDiamant: gameState.dropDiamant,
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
