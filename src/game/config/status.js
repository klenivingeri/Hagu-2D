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

export function createPlayerStatus(overrides = {}) {
  return {
    life: 3,                  // vidas/corações
    speed: 110,                // velocidade horizontal (px/s) - já usado em updatePlayerMovement
    jumpHeight: 200,            // força do pulo (velocidade vertical, px/s) - já usado em updatePlayerMovement
    bulletDamage: 1,             // dano de cada tiro - já usado em createBulletSystem/createEnemy (overlap bullet x enemy)

    // Campos abaixo ainda não têm mecânica implementada no jogo.
    // Só existem no objeto pra já ter onde guardar quando forem implementados.
    doubleJumpEnabled: false,    // pulo duplo
    jumpDamage: 1,                 // dano ao pisar em cima do inimigo (stomp)
    currentWeapon: 'bow',           // arma equipada (hoje só existe o arco)
    totalGold: 0,
    exp: 0,

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
