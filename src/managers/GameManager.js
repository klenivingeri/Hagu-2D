// Estado global compartilhado entre as telas HTML (fora do Phaser) e a
// "Run" do jogo (CLAUDE.md / GUIDELINES.md). Toda leitura/escrita de dado
// persistente (moedas, vidas, progresso, atributos de upgrade) deve passar
// por este módulo — nunca acesse esses valores direto de dentro de uma cena
// ou de uma tela.
//
// Como este módulo é importado uma única vez pelo bundle, os valores
// sobrevivem a scene.restart(). Persistência entre sessões (reload da
// página) ainda não está ligada (ver item 8 de IMPLEMENTATION_PLAN.md);
// quando for implementada, deve usar exclusivamente StorageService
// (/src/services/StorageService.js), nunca localStorage direto.
export const gameState = {
  maxlife: 3,
  // Quantidade de tiles que o player pode cair sem morrer.
  maxSafeFallTiles: 5,
  gold: 0,
  coins: 0,
  diamant: 0,
  playerSpritePath: '',

  // Atributos de upgrade. Alguns ainda não possuem mecânica e são somente
  // dados disponíveis para os sistemas futuros.
  isStick: true,
  isDoubleJump: true,
  isJetpack: true,
  bulluetDistance: 450,
  BulletSequence: 1,
  AljavaBullet: 4,
  LoadingBullet: 2000,
  exp: 0,
  dropDiamant: 5,
  upgrade: {},
};

export function addGlobalCoins(amount = 1) {
  gameState.coins += amount;
}

export function addGlobalDiamant(amount = 1) {
  gameState.diamant += amount;
}

export function addGlobalMaxLife(amount = 1) {
  gameState.maxlife = Math.max(0, gameState.maxlife + amount);
}

export function addGlobalExp(amount = 1) {
  gameState.exp += amount;
}
