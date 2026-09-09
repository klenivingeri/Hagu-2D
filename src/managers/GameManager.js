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
import { EXP_PER_LEVEL } from '../constants.js';
import { save, load, clearAll } from '../services/StorageService.js';
import { DEFAULT_MAP_KEY } from '../game/config/maps.js';

const DEFAULT_SETTINGS = {
  vibrationEnabled: true,
  soundEnabled: true,
  colorblindMode: false,
  // Quantas fatias (NxN) a fase é dividida pra câmera da Run seguir o
  // player (ver GameScene.js) — 1 = mapa inteiro visível, sem zoom nem
  // follow, é o comportamento original.
  cameraZoom: 1,
};

// O mapa inicial já nasce liberado; todo o resto do grid (ver
// game/config/maps.js) precisa ser desbloqueado passando pela "gate"
// correspondente dentro do jogo.
const DEFAULT_UNLOCKED_MAPS = [DEFAULT_MAP_KEY];

export const gameState = {
  playerName: 'Jogador',
  maxlife: 3,
  // Quantidade de tiles que o player pode cair sem morrer.
  maxSafeFallTiles: 5,
  gold: 0,
  coins: 0,
  diamant: 0,
  playerSpritePath: '',
  // Preferências do usuário (persistidas via StorageService — nunca
  // localStorage direto, ver CLAUDE.md regra 3). Populado de verdade por
  // loadPersistedState(), chamado na tela de loading inicial (main.js)
  // antes da Welcome aparecer.
  settings: { ...DEFAULT_SETTINGS },
  // Keys de MAPS (ver game/config/maps.js) que o player já desbloqueou
  // passando pela gate correspondente. Populado de verdade por
  // loadPersistedState().
  unlockedMaps: [...DEFAULT_UNLOCKED_MAPS],

  // Atributos de upgrade. Alguns ainda não possuem mecânica e são somente
  // dados disponíveis para os sistemas futuros.
  isStick: true,
  isDoubleJump: true,
  isJetpack: false,
  bulluetDistance: 450,
  BulletSequence: 1,
  AljavaBullet: 4,
  LoadingBullet: 2000,
  exp: 0,
  dropDiamant: 5,
  upgrade: {},
};

// Carrega o estado persistido (StorageService) por cima dos defaults.
// `await`-ável mesmo hoje sendo síncrono (localStorage), para já ficar
// pronto pra troca futura por IndexedDB/storage nativo (CLAUDE.md regra 3)
// sem mudar quem chama. Deve ser chamado uma única vez, na tela de loading
// inicial (ver main.js), antes de qualquer tela HTML ler gameState.
export async function loadPersistedState() {
  Object.assign(gameState.settings, await load('settings', DEFAULT_SETTINGS));
  const unlockedMaps = await load('unlockedMaps', DEFAULT_UNLOCKED_MAPS);
  gameState.unlockedMaps = Array.from(new Set([...unlockedMaps, DEFAULT_MAP_KEY]));
  return gameState;
}

// Chamado quando o player passa pela "gate" (camada de objetos "gate" no
// Tiled, ver game/config/maps.js) que libera `mapKey`. Idempotente e
// persistido via StorageService (CLAUDE.md regra 3).
export function unlockMap(mapKey) {
  if (!mapKey || gameState.unlockedMaps.includes(mapKey)) return;
  gameState.unlockedMaps.push(mapKey);
  save('unlockedMaps', gameState.unlockedMaps);
}

export function isMapUnlocked(mapKey) {
  return gameState.unlockedMaps.includes(mapKey);
}

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

export function setPlayerName(name) {
  gameState.playerName = String(name || '').trim() || gameState.playerName;
}

// Nível e progresso são derivados do XP total, nunca guardados à parte, pra
// não correrem o risco de dessincronizar (ver EXP_PER_LEVEL em constants.js).
export function getLevelInfo(exp = gameState.exp) {
  const level = Math.floor(exp / EXP_PER_LEVEL) + 1;
  const current = exp % EXP_PER_LEVEL;
  return { level, current, required: EXP_PER_LEVEL, percent: (current / EXP_PER_LEVEL) * 100 };
}

export function updateSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return;
  gameState.settings[key] = value;
  save('settings', gameState.settings);
}

// Apaga tudo que foi persistido (StorageService) e devolve o gameState em
// memória pros defaults — usado pelo botão "Resetar dados" em
// Configurações (ver WelcomeScreen.js). É destrutivo e não tem undo, quem
// chama é responsável por confirmar com o player antes.
export function resetProgress() {
  clearAll();
  gameState.coins = 0;
  gameState.diamant = 0;
  gameState.gold = 0;
  gameState.exp = 0;
  gameState.unlockedMaps = [...DEFAULT_UNLOCKED_MAPS];
  gameState.settings = { ...DEFAULT_SETTINGS };
}
