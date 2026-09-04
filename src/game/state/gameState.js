// Estado persistente da sessão do jogo. Como este módulo é importado uma
// única vez pelo bundle, seus valores sobrevivem a scene.restart().
export const gameState = {
  gold: 0,
  coins: 0,
  diamant: 0,
  playerSpritePath: '',

  // Atributos de upgrade. Alguns ainda não possuem mecânica e são somente
  // dados disponíveis para os sistemas futuros.
  isStick: true,
  isDoubleJump: false,
  isJetpack: false,
  bulluetDistance: 450,
  BulletSequence: 1,
  AljavaBullet: 1,
  LoadingBullet: 0,
  exp: 0,
  dropDiamant: 0,
  upgrade: {},
};

export function addGlobalCoins(amount = 1) {
  gameState.coins += amount;
}

export function addGlobalDiamant(amount = 1) {
  gameState.diamant += amount;
}

export function addGlobalExp(amount = 1) {
  gameState.exp += amount;
}
