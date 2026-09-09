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
import {
  UPGRADES_CATALOG,
  findUpgradeDef,
  getUpgradeCost,
  getUpgradeCurrency,
  getUpgradeValue,
  isUpgradeMaxed,
} from '../game/config/upgrades.js';

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

// Valor "base" (nível 0) de vida e chance de drop, usado tanto no gameState
// inicial quanto no reset — precisa bater com os defs 'life'/'dropChance'
// do catálogo (ver game/config/upgrades.js) pra loja e HUD começarem iguais.
const DEFAULT_MAX_LIFE = getUpgradeValue(findUpgradeDef('life'), 0);
const DEFAULT_DROP_DIAMANT = getUpgradeValue(findUpgradeDef('dropChance'), 0);

// Nível 0 (ainda não comprado) pra cada upgrade do catálogo. Sempre uma
// cópia nova (buildDefaultUpgradeLevels()) — nunca reutilize este objeto
// como referência direta, senão resetProgress() e o gameState inicial
// passariam a compartilhar o mesmo objeto mutável.
function buildDefaultUpgradeLevels() {
  return Object.fromEntries(UPGRADES_CATALOG.map((def) => [def.id, 0]));
}

export const gameState = {
  playerName: 'Jogador',
  maxlife: DEFAULT_MAX_LIFE,
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

  isStick: true,
  // Capacidade da aljava (munição máxima). A velocidade de recarga de cada
  // flecha é o upgrade 'reloadSpeed' (ver createPlayerStatus).
  AljavaBullet: 4,
  exp: 0,
  // Espelha o nível do upgrade 'dropChance' — EnemyBase.js lê direto daqui
  // (fora do player.status) na hora de decidir se o inimigo solta diamante.
  dropDiamant: DEFAULT_DROP_DIAMANT,
  // Nível comprado de cada upgrade da loja (ver game/config/upgrades.js).
  // createPlayerStatus() deriva todos os stats de upgrade a partir daqui;
  // as únicas exceções são vida máxima e chance de drop acima, que também
  // são lidas fora do player (HUD/EnemyBase) e por isso ficam espelhadas.
  upgrade: buildDefaultUpgradeLevels(),
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

  // Moedas/diamantes/upgrades precisam sobreviver ao reload da página pra
  // uma compra na loja valer a pena (senão o player perderia as moedas
  // gastas E o upgrade comprado no próximo F5).
  gameState.coins = await load('coins', gameState.coins);
  gameState.diamant = await load('diamant', gameState.diamant);
  gameState.upgrade = { ...gameState.upgrade, ...(await load('upgrade', gameState.upgrade)) };
  gameState.maxlife = await load('maxlife', gameState.maxlife);
  gameState.dropDiamant = await load('dropDiamant', gameState.dropDiamant);
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
  save('coins', gameState.coins);
}

export function addGlobalDiamant(amount = 1) {
  gameState.diamant += amount;
  save('diamant', gameState.diamant);
}

// ==========================================
// LOJA (UPGRADES)
// ==========================================
export function getUpgradeLevel(id) {
  return gameState.upgrade[id] || 0;
}

export function getUpgradeState(id) {
  const def = findUpgradeDef(id);
  if (!def) return null;
  const level = getUpgradeLevel(id);
  const currency = getUpgradeCurrency(def);
  return {
    def,
    level,
    currency,
    value: getUpgradeValue(def, level),
    nextValue: isUpgradeMaxed(def, level) ? null : getUpgradeValue(def, level + 1),
    cost: isUpgradeMaxed(def, level) ? null : getUpgradeCost(def, level),
    isMaxed: isUpgradeMaxed(def, level),
  };
}

// Compra 1 nível do upgrade `id`, descontando moedas ou diamantes globais
// conforme a `currency` do upgrade (ver game/config/upgrades.js). Retorna
// false (sem cobrar nada) se o upgrade não existir, já estiver no nível
// máximo ou não houver saldo suficiente.
export function purchaseUpgrade(id) {
  const def = findUpgradeDef(id);
  if (!def) return false;

  const level = getUpgradeLevel(id);
  if (isUpgradeMaxed(def, level)) return false;

  const cost = getUpgradeCost(def, level);
  const currency = getUpgradeCurrency(def);
  if (gameState[currency] < cost) return false;

  gameState[currency] -= cost;
  gameState.upgrade[id] = level + 1;
  save(currency, gameState[currency]);
  save('upgrade', gameState.upgrade);

  // 'life' e 'dropChance' também são lidos fora de createPlayerStatus()
  // (HUD e EnemyBase.js respectivamente) — por isso precisam ficar
  // espelhados direto no gameState, não só no nível do upgrade.
  if (id === 'life') {
    gameState.maxlife = getUpgradeValue(def, gameState.upgrade[id]);
    save('maxlife', gameState.maxlife);
  }
  if (id === 'dropChance') {
    gameState.dropDiamant = getUpgradeValue(def, gameState.upgrade[id]);
    save('dropDiamant', gameState.dropDiamant);
  }

  return true;
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
  gameState.upgrade = buildDefaultUpgradeLevels();
  gameState.maxlife = DEFAULT_MAX_LIFE;
  gameState.dropDiamant = DEFAULT_DROP_DIAMANT;
}
