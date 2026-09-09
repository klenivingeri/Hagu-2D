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
  ABILITY_UPGRADE_IDS,
  ACCESSORY_UPGRADE_IDS,
  DEFAULT_EQUIPPED_ACCESSORY,
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
  // 'defaultWeapon' já nasce comprado (nível 1) — é a arma atual do player,
  // não algo que precise ser adquirido na loja (ver DEFAULT_EQUIPPED_ACCESSORY).
  return Object.fromEntries(
    UPGRADES_CATALOG.map((def) => [def.id, def.id === DEFAULT_EQUIPPED_ACCESSORY ? 1 : 0])
  );
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
  // Melhor resultado (1-3, ver GameScene.completeRun()) já alcançado em cada
  // mapKey — usado pelo grid de fases da Welcome (renderStages) pra desenhar
  // as estrelas preenchidas. Populado de verdade por loadPersistedState().
  mapStars: {},

  // Habilidade ativa entre pulo duplo/jetpack/grudar na parede (ver
  // ABILITY_UPGRADE_IDS) — null = nenhuma equipada ainda. Só uma fica ativa
  // por vez, mesmo com mais de uma comprada (ver equipAbility()).
  equippedAbility: null,
  // Arma ativa entre espada/arco/arma atual/cajado (ver ACCESSORY_UPGRADE_IDS)
  // — mesmo esquema de equippedAbility, só uma por vez (ver equipAccessory()).
  equippedAccessory: DEFAULT_EQUIPPED_ACCESSORY,
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
  gameState.exp = await load('exp', gameState.exp);
  gameState.mapStars = await load('mapStars', gameState.mapStars);
  gameState.upgrade = { ...gameState.upgrade, ...(await load('upgrade', gameState.upgrade)) };
  gameState.maxlife = await load('maxlife', gameState.maxlife);
  gameState.dropDiamant = await load('dropDiamant', gameState.dropDiamant);
  gameState.equippedAbility = await load('equippedAbility', gameState.equippedAbility);
  gameState.equippedAccessory = await load('equippedAccessory', gameState.equippedAccessory);
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

export function getMapStars(mapKey) {
  return gameState.mapStars[mapKey] || 0;
}

// Chamado por GameScene.completeRun() ao fim de toda run. Só sobrescreve o
// resultado salvo se a nova run foi melhor — nunca deve ser possível "piorar"
// uma fase já feita com 3 estrelas jogando de novo mais devagar/com dano.
export function recordMapStars(mapKey, stars) {
  if (!mapKey || stars <= getMapStars(mapKey)) return;
  gameState.mapStars = { ...gameState.mapStars, [mapKey]: stars };
  save('mapStars', gameState.mapStars);
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

// ==========================================
// EQUIPAMENTO (HABILIDADES)
// ==========================================
// Pulo duplo/jetpack/grudar na parede (ver ABILITY_UPGRADE_IDS) são
// comprados como upgrade normal, mas só um fica ATIVO por vez — equipar um
// desequipa automaticamente o anterior (ver aba "Equip. > Habilidade" em
// WelcomeScreen.js). createPlayerStatus() lê gameState.equippedAbility
// direto, nunca o nível do upgrade, pra decidir o que o player pode usar.
export function getEquippedAbility() {
  return gameState.equippedAbility;
}

export function isAbilityEquipped(id) {
  return gameState.equippedAbility === id;
}

// Alterna a habilidade `id`: precisa já ter sido comprada (nível > 0).
// Clicar na habilidade já equipada desequipa (fica sem nenhuma ativa);
// clicar em outra comprada troca, sem nunca deixar duas ativas ao mesmo
// tempo. Retorna false se `id` não for uma habilidade equipável ou ainda
// não tiver sido comprada.
export function equipAbility(id) {
  if (!ABILITY_UPGRADE_IDS.includes(id) || getUpgradeLevel(id) <= 0) return false;

  gameState.equippedAbility = isAbilityEquipped(id) ? null : id;
  save('equippedAbility', gameState.equippedAbility);
  return true;
}

// ==========================================
// EQUIPAMENTO (ACESSÓRIOS / ARMAS)
// ==========================================
// Espada/arco/arma atual/cajado (ver ACCESSORY_UPGRADE_IDS) — mesmo esquema
// das habilidades acima, só que sempre com uma arma equipada (nunca fica
// "sem nenhuma", já que 'defaultWeapon' nasce comprada e equipada).
export function getEquippedAccessory() {
  return gameState.equippedAccessory;
}

export function isAccessoryEquipped(id) {
  return gameState.equippedAccessory === id;
}

// Troca a arma equipada pra `id`: precisa já ter sido comprada (nível > 0).
// Diferente de equipAbility(), clicar na arma já equipada não desequipa
// (sempre fica com uma arma ativa). Retorna false se `id` não for uma arma
// equipável ou ainda não tiver sido comprada.
export function equipAccessory(id) {
  if (!ACCESSORY_UPGRADE_IDS.includes(id) || getUpgradeLevel(id) <= 0) return false;

  gameState.equippedAccessory = id;
  save('equippedAccessory', gameState.equippedAccessory);
  return true;
}

export function addGlobalMaxLife(amount = 1) {
  gameState.maxlife = Math.max(0, gameState.maxlife + amount);
}

export function addGlobalExp(amount = 1) {
  gameState.exp += amount;
  save('exp', gameState.exp);
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
  gameState.mapStars = {};
  gameState.settings = { ...DEFAULT_SETTINGS };
  gameState.upgrade = buildDefaultUpgradeLevels();
  gameState.maxlife = DEFAULT_MAX_LIFE;
  gameState.dropDiamant = DEFAULT_DROP_DIAMANT;
  gameState.equippedAbility = null;
  gameState.equippedAccessory = DEFAULT_EQUIPPED_ACCESSORY;
}
