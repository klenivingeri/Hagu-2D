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
import { DEFAULT_MAP_KEY, FIRST_STAGE_MAP_KEY, MAPS } from '../game/config/maps.js';
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
  // Quantas fatias (NxN) a fase é dividida pra câmera da Run seguir o
  // player (ver GameScene.js) — 1 = mapa inteiro visível, sem zoom nem
  // follow, é o comportamento original.
  // Precisa bater com PLATFORM_DEFAULT_ZOOM[platformMode] abaixo — GameScene
  // (ver create()) só lê cameraZoom, nunca platformMode diretamente.
  cameraZoom: 3,
  // 'gameboy' = zoom fixo em 2x (aba "Layout" em SettingsScreen.js).
  // 'mobile' = zoom fixo em 3x (RESIZE, tela cheia real) — ver
  // setPlatformMode() abaixo.
  platformMode: 'mobile',
  // Skin visual do D-pad/botões de ação/SELECT-START (aba "Botões" em
  // Configurações, ver SettingsScreen.js). Puramente estético — aplicado
  // via atributo data-controls-theme em #app (ver main.css), nunca muda
  // hitbox/posição dos controles. 'default' é o visual original, sem
  // nenhuma regra extra em main.css pra ele.
  controlsTheme: 'default',
  // Filtro visual aplicado na câmera da Run (ver createVisualFilters.js/
  // setVisualFilter() abaixo) — mutuamente exclusivo por natureza (um valor
  // só, nunca dois ao mesmo tempo):
  // - 'none': sem filtro, visual original.
  // - 'colorblind': correção "Daltonize" pra deuteranopia (a forma mais
  //   comum de daltonismo) — não simula, compensa: redistribui a diferença
  //   de cor no eixo vermelho-verde pro canal azul.
  // - 'gameboy': recolore o jogo inteiro pra 4 tons de verde, estilo tela
  //   LCD do DMG-01 clássico.
  // Só afeta o canvas do Phaser, nunca o HUD/telas em HTML (CLAUDE.md
  // regra 1).
  visualFilter: 'none',
};

// Zoom aplicado automaticamente ao trocar de plataforma — 'mobile' sempre
// força 3x (fullscreen real, ver GameScene.applyScaleModeForZoom), 'gameboy'
// é sempre 2x (não há mais escolha manual de zoom, ver aba "Layout" em
// SettingsScreen.js) — nenhum dos dois deve ficar preso no valor do outro.
const PLATFORM_DEFAULT_ZOOM = { gameboy: 2, mobile: 3 };

// O tutorial (map_0) e a primeira fase da galeria (world.id 0, fase 0) já
// nascem liberados; toda fase seguinte (ver game/config/maps.js) precisa ser
// desbloqueada terminando a fase anterior dentro do jogo.
const DEFAULT_UNLOCKED_MAPS = [DEFAULT_MAP_KEY, FIRST_STAGE_MAP_KEY];

// Valor "base" (nível 0) de vida e chance de drop, usado tanto no gameState
// inicial quanto no reset — precisa bater com os defs 'life'/'dropChance'
// do catálogo (ver game/config/upgrades.js) pra loja e HUD começarem iguais.
const DEFAULT_MAX_LIFE = getUpgradeValue(findUpgradeDef('life'), 0);
const DEFAULT_DROP_DIAMANT = getUpgradeValue(findUpgradeDef('dropChance'), 0);
// Mesmo esquema de DEFAULT_MAX_LIFE, mas pro upgrade 'maxEnergy' — precisa
// bater com o nível 0 do catálogo pra loja e gameState iniciarem iguais.
const DEFAULT_MAX_ENERGY = getUpgradeValue(findUpgradeDef('maxEnergy'), 0);
// Diamante inicial do player, usado tanto no gameState quanto no reset (ver
// resetProgress()). Zerado pra produção — o player começa sem nada e
// progride jogando/assistindo anúncio (ver grantTicketFromAd).
const DEFAULT_DIAMANT = 0;
// Moedas (🪙, "ouro") iniciais do player, mesmo esquema do diamante acima.
const DEFAULT_COINS = 0;

// Fichas (ver welcomeScreen.html play-btn) consumidas ao iniciar uma fase.
// Começa com 3 e volta pra 3 todo dia (ver resetDailyTicketsIfNeeded), mas só
// se o player estiver ZERADO — nunca reduz quem ainda tem fichas sobrando
// (inclusive acima de 3, compradas com ouro/diamante/anúncio).
const DEFAULT_TICKETS = 3;

// Custo de 1 ficha extra fora do reset diário (ver modal "Sem fichas" em
// welcomeScreen.html) — comprável com moeda, diamante, ou de graça assistindo
// um anúncio (ver purchaseTicketWithCoins/purchaseTicketWithDiamant/
// grantTicketFromAd abaixo). Calibrado barato de propósito: é só um "desafogo"
// pra quem zerou as 3 fichas do dia, não uma fonte de progressão paralela.
export const TICKET_COST_COINS = 20;
export const TICKET_COST_DIAMANT = 5;

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
  coins: DEFAULT_COINS,
  diamant: DEFAULT_DIAMANT,
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

  // Habilidade ativa entre pulo duplo/paraquedas/jetpack/grudar na parede (ver
  // ABILITY_UPGRADE_IDS) — null = nenhuma equipada ainda. Só uma fica ativa
  // por vez, mesmo com mais de uma comprada (ver equipAbility()).
  equippedAbility: null,
  // Arma ativa entre espada/arco/arma atual/cajado (ver ACCESSORY_UPGRADE_IDS)
  // — mesmo esquema de equippedAbility, só uma por vez (ver equipAccessory()).
  equippedAccessory: DEFAULT_EQUIPPED_ACCESSORY,
  // Capacidade máxima de energia — todas as armas (ver ACCESSORY_UPGRADE_IDS)
  // gastam energia pra atacar, não só o arco/arma como antes. A velocidade
  // de recarga é o upgrade 'reloadSpeed' (ver createPlayerStatus). Aumenta
  // com o upgrade 'maxEnergy' da loja — espelhado aqui (mesmo esquema de
  // maxlife/dropDiamant) pra createPlayerStatus() só precisar ler o campo.
  maxEnergy: DEFAULT_MAX_ENERGY,
  exp: 0,
  // Espelha o nível do upgrade 'dropChance' — EnemyBase.js lê direto daqui
  // (fora do player.status) na hora de decidir se o inimigo solta diamante.
  dropDiamant: DEFAULT_DROP_DIAMANT,
  // Nível comprado de cada upgrade da loja (ver game/config/upgrades.js).
  // createPlayerStatus() deriva todos os stats de upgrade a partir daqui;
  // as únicas exceções são vida máxima e chance de drop acima, que também
  // são lidas fora do player (HUD/EnemyBase) e por isso ficam espelhadas.
  upgrade: buildDefaultUpgradeLevels(),

  // Coleção (Pokédex de inimigos, ver aba "Coleção" da Welcome). Uma entrada
  // por espécie derrotada pelo menos uma vez, indexada pela MESMA `key` do
  // Object Layer "enemy" do Tiled usada em EnemyBase.js/scene.enemyKills —
  // ver recordEnemyDefeat()/unlockEnemySprite() abaixo. Populado de verdade
  // por loadPersistedState().
  collection: {},

  // Fichas disponíveis pra iniciar uma fase (ver consumeTicket() abaixo).
  // Populado de verdade por loadPersistedState().
  tickets: DEFAULT_TICKETS,
  // Data (YYYY-MM-DD, fuso local) da última vez que as fichas foram
  // resetadas — usada por resetDailyTicketsIfNeeded() pra só resetar uma vez
  // por dia. Populado de verdade por loadPersistedState().
  ticketsLastReset: null,
};

// YYYY-MM-DD no fuso local (não UTC) — evita resetar as fichas antes/depois
// da meia-noite local por causa do fuso do toISOString().
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  gameState.maxEnergy = await load('maxEnergy', gameState.maxEnergy);
  gameState.dropDiamant = await load('dropDiamant', gameState.dropDiamant);
  gameState.equippedAbility = await load('equippedAbility', gameState.equippedAbility);
  gameState.equippedAccessory = await load('equippedAccessory', gameState.equippedAccessory);
  gameState.collection = await load('collection', gameState.collection);
  gameState.tickets = await load('tickets', gameState.tickets);
  gameState.ticketsLastReset = await load('ticketsLastReset', gameState.ticketsLastReset);
  resetDailyTicketsIfNeeded();
  return gameState;
}

// ==========================================
// FICHAS (INICIAR FASE)
// ==========================================
// Reseta as fichas pra DEFAULT_TICKETS uma vez por dia (fuso local), mas só
// se o player estiver ZERADO — nunca mexe em quem ainda tem 1+ ficha sobrando,
// nem "desconta" quem acumulou mais que DEFAULT_TICKETS comprando fichas
// extra (ver purchaseTicketWithCoins/purchaseTicketWithDiamant/
// grantTicketFromAd). Chamado no load inicial (loadPersistedState) e de novo
// sempre que a Welcome é mostrada (ShowWelcomeScreen), pra pegar a virada do
// dia mesmo se a aba ficar aberta madrugada adentro.
export function resetDailyTicketsIfNeeded() {
  const today = getLocalDateString();
  if (gameState.ticketsLastReset === today) return;

  if (gameState.tickets <= 0) {
    gameState.tickets = DEFAULT_TICKETS;
    save('tickets', gameState.tickets);
  }
  gameState.ticketsLastReset = today;
  save('ticketsLastReset', gameState.ticketsLastReset);
}

export function getTickets() {
  return gameState.tickets;
}

// Consome 1 ficha ao iniciar uma fase (ver handlePlayClick em
// WelcomeScreen.js). Retorna false sem gastar nada se não houver ficha
// disponível.
export function consumeTicket() {
  if (gameState.tickets <= 0) return false;
  gameState.tickets -= 1;
  save('tickets', gameState.tickets);
  return true;
}

function addTicket() {
  gameState.tickets += 1;
  save('tickets', gameState.tickets);
}

// Compra 1 ficha extra com moeda (ver modal "Sem fichas"). Retorna false sem
// cobrar nada se faltar saldo.
export function purchaseTicketWithCoins() {
  if (gameState.coins < TICKET_COST_COINS) return false;
  gameState.coins -= TICKET_COST_COINS;
  save('coins', gameState.coins);
  addTicket();
  return true;
}

// Mesmo esquema de purchaseTicketWithCoins, pago em diamante.
export function purchaseTicketWithDiamant() {
  if (gameState.diamant < TICKET_COST_DIAMANT) return false;
  gameState.diamant -= TICKET_COST_DIAMANT;
  save('diamant', gameState.diamant);
  addTicket();
  return true;
}

// Concede 1 ficha de graça em troca de assistir um anúncio recompensado até
// o fim — só chamada por WelcomeScreen.handleWatchAdForTicket() DEPOIS de
// CrazyGamesService.requestRewardedAd() confirmar que o anúncio terminou
// (ou que não há SDK, ver comentário lá). Esta função em si só concede,
// nunca decide se o anúncio foi assistido.
export function grantTicketFromAd() {
  addTicket();
  return true;
}

// Chamado quando o player passa pela "gate" (camada de objetos "gate" no
// Tiled, ver game/config/maps.js) que libera `mapKey`. Idempotente e
// persistido via StorageService (CLAUDE.md regra 3).
export function unlockMap(mapKey) {
  if (!mapKey || gameState.unlockedMaps.includes(mapKey)) return;
  gameState.unlockedMaps.push(mapKey);
  save('unlockedMaps', gameState.unlockedMaps);
}

// Masmorras (ver MAPS[key].dungeon em game/config/maps.js) não fazem parte
// da progressão sequencial da campanha — não têm gate/portal que as
// desbloqueie, então ficam sempre disponíveis (livre escolha na aba
// "Masmorra" da Welcome), ao contrário das fases normais.
export function isMapUnlocked(mapKey) {
  if (MAPS[mapKey]?.dungeon) return true;
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
  if (!amount) return;
  gameState.coins += amount;
  save('coins', gameState.coins);
}

export function addGlobalDiamant(amount = 1) {
  if (!amount) return;
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
  if (id === 'maxEnergy') {
    gameState.maxEnergy = getUpgradeValue(def, gameState.upgrade[id]);
    save('maxEnergy', gameState.maxEnergy);
  }

  return true;
}

// ==========================================
// EQUIPAMENTO (HABILIDADES)
// ==========================================
// Pulo duplo/paraquedas/jetpack/grudar na parede (ver ABILITY_UPGRADE_IDS) são
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

// 'none' | 'colorblind' | 'gameboy' — ver createVisualFilters.js. Um valor
// só (em vez de vários booleans) já garante que nunca dois filtros fiquem
// ativos ao mesmo tempo; use isto em vez de updateSetting() pra validar o
// valor contra as opções conhecidas.
const VISUAL_FILTER_VALUES = ['none', 'colorblind', 'gameboy'];

export function setVisualFilter(value) {
  if (!VISUAL_FILTER_VALUES.includes(value)) return;
  gameState.settings.visualFilter = value;
  save('settings', gameState.settings);
}

// Alterna entre os modos "Game Boy" (zoom manual 1x/2x) e "Mobile" (zoom
// fixo 3x/fullscreen real). Trocar de plataforma sempre reajusta o
// cameraZoom pra um valor válido no novo modo, pra nunca deixar o jogador
// preso num 3x escondido (ao voltar pra Game Boy) ou num 1x/2x quando devia
// estar em fullscreen (ao ir pra Mobile).
export function setPlatformMode(mode) {
  if (!(mode in PLATFORM_DEFAULT_ZOOM)) return;
  gameState.settings.platformMode = mode;
  gameState.settings.cameraZoom = PLATFORM_DEFAULT_ZOOM[mode];
  save('settings', gameState.settings);
}

// ==========================================
// COLEÇÃO (BESTIÁRIO)
// ==========================================
// Chance (%) de um inimigo morto soltar o item colecionável de sprite (ver
// spawnSpriteDrop em game/systems/create/createSpriteDrops.js) — só rola
// enquanto a espécie ainda não tiver o sprite desbloqueado (hasCollectedSprite).
export const SPRITE_DROP_CHANCE_PERCENT = 35;

// ==========================================
// DROP: SACO DE MOEDAS
// ==========================================
// Chance (%) de um inimigo morto soltar o saco de moedas (ver
// spawnGoldBagDrop em game/systems/create/createGoldBagDrops.js). Ao ser
// coletado, o saco vale uma quantidade aleatória de moedas nesse intervalo.
export const GOLD_BAG_DROP_CHANCE_PERCENT = 12;
export const GOLD_BAG_MIN_COINS = 2;
export const GOLD_BAG_MAX_COINS = 6;

export function getCollectionEntries() {
  return gameState.collection;
}

export function getCollectionEntry(key) {
  return gameState.collection[key] || null;
}

export function hasCollectedSprite(key) {
  return Boolean(gameState.collection[key]?.spriteUnlocked);
}

function touchCollectionEntry(key, path, behavior) {
  const existing = gameState.collection[key] || { key, path: path || '', behavior, kills: 0, spriteUnlocked: false };
  if (path) existing.path = path;
  if (behavior) existing.behavior = behavior;
  return existing;
}

// Chamado por GameScene.completeRun() (nunca durante a run em si — ver
// EnemyBase.killEnemy(), que só acumula em scene.enemyKills) uma vez pra
// cada espécie derrotada, já com a contagem total da run em `count`.
// Registra a espécie como "encontrada" (aparece na Coleção, ainda que só
// com silhueta) e soma a contagem de abates, independente de ter dropado
// sprite ou não. Só chega a persistir se o player alcançar a tela de
// pós-jogo — abandonar/morrer sem terminar a run não conta pra Coleção.
export function recordEnemyDefeat({ key, path = '', behavior, count = 1 } = {}) {
  if (!key) return;
  const entry = touchCollectionEntry(key, path, behavior);
  entry.kills += count;
  gameState.collection = { ...gameState.collection, [key]: entry };
  save('collection', gameState.collection);
}

// Chamado por GameScene.completeRun() pra cada espécie cujo item de sprite
// foi pego em campo NESTA run (ver scene.collectedSprites, populado pelo
// overlap em createSpriteDrops.js) — só a partir da run concluída o card da
// Coleção revela a arte colorida em vez da silhueta; morrer/sair antes do
// portal não desbloqueia, mesmo já tendo encostado no item.
export function unlockEnemySprite({ key, path = '', behavior } = {}) {
  if (!key) return;
  const entry = touchCollectionEntry(key, path, behavior);
  entry.spriteUnlocked = true;
  gameState.collection = { ...gameState.collection, [key]: entry };
  save('collection', gameState.collection);
}

// Apaga tudo que foi persistido (StorageService) e devolve o gameState em
// memória pros defaults — usado pelo botão "Resetar dados" em
// Configurações (ver WelcomeScreen.js). É destrutivo e não tem undo, quem
// chama é responsável por confirmar com o player antes.
export function resetProgress() {
  clearAll();
  gameState.coins = DEFAULT_COINS;
  gameState.diamant = DEFAULT_DIAMANT;
  gameState.gold = 0;
  gameState.exp = 0;
  gameState.unlockedMaps = [...DEFAULT_UNLOCKED_MAPS];
  gameState.mapStars = {};
  gameState.settings = { ...DEFAULT_SETTINGS };
  gameState.upgrade = buildDefaultUpgradeLevels();
  gameState.maxlife = DEFAULT_MAX_LIFE;
  gameState.maxEnergy = DEFAULT_MAX_ENERGY;
  gameState.dropDiamant = DEFAULT_DROP_DIAMANT;
  gameState.equippedAbility = null;
  gameState.equippedAccessory = DEFAULT_EQUIPPED_ACCESSORY;
  gameState.collection = {};
  gameState.tickets = DEFAULT_TICKETS;
  gameState.ticketsLastReset = getLocalDateString();
}
