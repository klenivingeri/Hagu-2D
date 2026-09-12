// Tamanho fixo de cada frame dentro da spritesheet do player (16x24) — todas
// as pastas de assets/player/ hoje são uma ÚNICA imagem com os frames lado a
// lado nesse grid (ver PLAYER_SKINS abaixo), diferente dos mobs (ainda uma
// imagem por frame, ver MOB_SPRITE_SETS/preloadAnimations).
export const PLAYER_FRAME_WIDTH = 16;
export const PLAYER_FRAME_HEIGHT = 24;

// frameRate/repeat de cada animação do player — são timings de gameplay, não
// mudam por skin (todo skin tem os mesmos 12 estados, só troca o desenho).
const PLAYER_ANIMATION_SETTINGS = {
  idle: { frameRate: 4, repeat: 0 },
  jump: { frameRate: 10, repeat: 0 },
  spawn: { frameRate: 10, repeat: 0 },
  run: { frameRate: 10, repeat: -1 },
  bow: { frameRate: 20, repeat: 0 },
  // Animação do acessório "Arco" (ver ACCESSORY_UPGRADE_IDS em
  // game/config/upgrades.js) — já é uma chave separada da "bow" acima (usada
  // pela arma padrão) pra poder trocar só o asset depois sem mexer no resto
  // do sistema de tiro (ver createBulletSystem.js).
  arrow: { frameRate: 20, repeat: 0 },
  // Pose usada enquanto o player está encostado lateralmente em uma parede.
  stick: { frameRate: 1, repeat: -1 },
  dead: { frameRate: 10, repeat: 0 },
  dead_jump: { frameRate: 10, repeat: 0 },
  // Antes "jump_down": pose de queda livre (sem paraquedas/jetpack).
  free_fall: { frameRate: 10, repeat: -1 },
  attack: { frameRate: 20, repeat: 0 },
  parachute: { frameRate: 20, repeat: 0 },
};

// Cada skin descreve, por animação, o nome do arquivo (pasta assets/player/
// <animação>/<url>.png) e o ÚLTIMO índice de frame da spritesheet (o
// primeiro frame sempre começa em 0 — ex: "frame: 3" = 4 frames, 0..3).
// Pra criar uma skin nova: cadastre as mesmas 12 chaves aqui com os assets
// dela e aponte PLAYERS_CONFIG.<key>.skin pro nome escolhido.
export const PLAYER_SKINS = {
  default: {
    arrow: { url: 'sprite_weapon_bow_tall_fire_fast', frame: 6 },
    attack: { url: 'sprite_weapon_sword_atk_melee', frame: 5 },
    bow: { url: 'sprite_weapon_bow_short_fire_slow', frame: 5 },
    dead: { url: 'sprite_z_die_skull', frame: 5 },
    dead_jump: { url: 'sprite_z_die_one', frame: 10 },
    free_fall: { url: 'sprite_knock_down_one', frame: 3 },
    idle: { url: 'sprite_base_idle', frame: 3 },
    jump: { url: 'sprite_jump_hop', frame: 7 },
    parachute: { url: 'sprite_parachute', frame: 5 },
    run: { url: 'sprite_run_two', frame: 5 },
    spawn: { url: 'sprite_re_warp', frame: 10 },
    stick: { url: 'sprite_stick_two', frame: 0 },
  },
};

export const PLAYERS_CONFIG = {
  player: {
    path: 'assets/player/',
    skin: 'default',
    stats: {},
  },
};

// Resolve os dados de UMA animação do player (skin + timing) num formato
// pronto pro Phaser (preloadSpriteSheetAnimations/createSpriteSheetAnimations
// em animationUtils.js) ou pra qualquer tela HTML que precise da mesma arte
// fora do Phaser (ver PLAYER_IDLE_SPRITE/PLAYER_RUN_SPRITE em
// screens/WelcomeScreen.js).
export function getPlayerAnimationAsset(entityKey, animationKey) {
  const config = PLAYERS_CONFIG[entityKey];
  if (!config) return null;

  const skin = PLAYER_SKINS[config.skin] || PLAYER_SKINS.default;
  const animation = skin[animationKey];
  if (!animation) return null;

  const { frameRate, repeat } = PLAYER_ANIMATION_SETTINGS[animationKey] || {};
  return {
    key: animationKey,
    url: `${config.path}${animationKey}/${animation.url}.png`,
    lastFrame: animation.frame,
    totalFrames: animation.frame + 1,
    frameRate,
    repeat,
  };
}

// Todas as animações da skin de um player (ver preloadPlayerAssets/
// createPlayerAnimations em systems/create/createPlayer.js).
export function getPlayerAnimationAssets(entityKey) {
  const config = PLAYERS_CONFIG[entityKey];
  if (!config) return [];

  const skin = PLAYER_SKINS[config.skin] || PLAYER_SKINS.default;
  return Object.keys(skin).map((animationKey) => getPlayerAnimationAsset(entityKey, animationKey));
}

// ==========================================
// SPRITES DOS MOBS (uma entrada por PASTA de assets/mobs/)
// ==========================================
// Cada mob tem sua PRÓPRIA quantidade de frames e seus próprios nomes de
// arquivo por animação (ex: mob_1/run tem 4 frames "sprite_run_two_",
// tank/run tem 4 frames "sprite_weapon_shield_run_") — por isso as
// animações NUNCA ficam dentro de MOBS_CONFIG (que só descreve
// comportamento/IA). Aqui embaixo, cada chave é o nome da pasta dentro de
// assets/mobs/ (a mesma coisa que a prop "path" do Tiled, ou "key" quando
// "path" não é definido — ver EnemyFactory.readCoreTiledProps) e o valor é
// a lista de animações QUE AQUELA PASTA REALMENTE TEM.
//
// As chaves de animação (run/idle/stomp/spark/attack/bow) são um contrato
// fixo com as behaviors (ver entities/behaviors/*.js e EnemyBase.js) — é
// assim que qualquer behavior encontra a animação certa pra qualquer mob,
// sem precisar saber nada sobre a pasta/arquivo por trás. "run" e "spark"
// são obrigatórias (spawnEnemyBase usa "run" como textura inicial,
// killEnemy sempre toca "spark" na morte); as demais são opcionais — a
// behavior que não achar a animação (scene.anims.exists) simplesmente não
// usa aquele recurso (ex: patrol sem "attack" nunca ataca corpo-a-corpo).
//
// Pra cadastrar um mob novo:
//   1. Exporte os sprites em assets/mobs/<nova_pasta>/<animação>/
//   2. Adicione a entrada aqui com os frames/frameRate reais daquela pasta
//   3. No Tiled, use essa pasta em "path" (ou "key") e escolha QUALQUER
//      "type" de MOBS_CONFIG (patrol/patrol_and_shoot/patrol_fly) — nada
//      mais precisa mudar.
//
// Duas convenções de animação coexistem aqui (ver isSpriteSheetAnimation em
// systems/create/createEnemy.js, que decide qual usar por entrada):
//   - "frame" (singular): NOVA, uma única spritesheet por animação, grid
//     PLAYER_FRAME_WIDTH/HEIGHT por padrão ou frameWidth/frameHeight do
//     próprio mob (ver bat abaixo) — igual ao player, ver PLAYER_SKINS.
//   - "frames" (plural): sistema ANTIGO, uma imagem por frame (ainda usado
//     só por shadow/tank, que não foram convertidos).
// Dois jeitos de uma animação ("frame") reaproveitar uma textura já
// carregada em vez de baixar o arquivo de novo:
//   - "asset": reaproveita a textura de OUTRA key do MESMO mob (só entre
//     entradas "frame" desta mesma entrada de MOB_SPRITE_SETS).
//   - "shared": reaproveita um asset de assets/commons/ (fora da pasta do
//     mob) — carregado UMA VEZ só, não importa quantos mobs referenciem
//     (ver "spark" abaixo: mob_1/dino/bat morrem todos com o mesmo efeito).
//     Sempre no grid padrão PLAYER_FRAME_WIDTH/HEIGHT, mesmo que o mob em
//     si use outro grid (ver bat, 16x16).
export const MOB_SPRITE_SETS = {
  mob_1: {
    frameWidth: PLAYER_FRAME_WIDTH,
    frameHeight: PLAYER_FRAME_HEIGHT,
    animations: [
      { key: 'run', url: 'run/sprite_run_two', frame: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle', frame: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash', frame: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', shared: true, url: 'commons/spark/sprite_z_die_spark', frame: 5, frameRate: 20, repeat: 0 },
      { key: 'attack', url: 'attack/sprite_weapon_sword_atk_melee', frame: 5, frameRate: 20, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast', frame: 4, frameRate: 20, repeat: 0 },
    ],
  },
  // "run" usa a pasta run_bow/ (o dino corre já com o arco em punho) — é o
  // único jeito de "correr" que esse mob usa hoje (ver dino_shoot nos
  // mapas do Tiled); run/ (sem arco) existe na pasta mas ainda não tem
  // nenhum mob cadastrado que precise dela.
  dino: {
    frameWidth: PLAYER_FRAME_WIDTH,
    frameHeight: PLAYER_FRAME_HEIGHT,
    animations: [
      { key: 'run', url: 'run_bow/sprite_run_two', frame: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle', frame: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash', frame: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', shared: true, url: 'commons/spark/sprite_z_die_spark', frame: 5, frameRate: 20, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast_bag', frame: 4, frameRate: 20, repeat: 0 },
    ],
  },
  bat: {
    // Único mob com frame nativo 16x16 (sem "pernas" abaixo da linha do
    // corpo como os demais, que são 16x24) — por isso sobrescreve o
    // default aqui em vez de herdar PLAYER_FRAME_HEIGHT.
    frameWidth: 16,
    frameHeight: 16,
    animations: [
      { key: 'run', url: 'run/sprite_run_two', frame: 3, frameRate: 5, repeat: -1 },
      { key: 'spark', shared: true, url: 'commons/spark/sprite_z_die_spark', frame: 5, frameRate: 20, repeat: 0 },
    ],
  },
  shadow: {
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 0, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 5, frameRate: 20, repeat: 0 },
    ],
  },
  tank: {
    animations: [
      { key: 'run', url: 'run/sprite_weapon_shield_run_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
      { key: 'attack', url: 'attack/sprite_weapon_shield_atk_melee_', frames: 7, frameRate: 20, repeat: 0 },
    ],
  },
};

// Cada mob define, além de assets/stats, uma "behavior": a chave que diz
// QUAL padrão de movimento/IA ele usa (ver game/entities/EnemyBehaviorFactory.js
// e game/entities/behaviors/*.js). Pra criar um inimigo novo com um jeito
// de agir diferente (ex: parado atirando, voador, perseguindo o player):
//   1. Exporte os sprites em assets/mobs/<nova_key>/ e cadastre em
//      MOB_SPRITE_SETS (ver acima)
//   2. Cadastre a entrada aqui embaixo com uma "key" única e a "behavior" desejada
//   3. Se a behavior ainda não existe, implemente-a em
//      game/entities/behaviors/<novaBehavior>.js e registre no
//      BEHAVIOR_REGISTRY de EnemyBehaviorFactory.js
// Nada mais precisa mudar: createEnemy.js e updateEnemyMovement.js já leem
// tudo dinamicamente a partir daqui.
//
// IMPORTANTE: isso aqui NUNCA descreve sprite/animação (ver MOB_SPRITE_SETS
// acima) — só a "personalidade"/IA. É por isso que QUALQUER mob (qualquer
// pasta de MOB_SPRITE_SETS) pode usar QUALQUER behavior daqui: o Tiled
// escolhe a pasta (key/path) e o comportamento (type) de forma
// independente.
//
// Campos "patrol" / "direction" / "ai.visionRangeTilesWidth" /
// "ai.visionRangeTilesHeight" / "ai.bidirectional" são os DEFAULTS de cada
// tipo — o Object Layer "enemy" do Tiled pode sobrescrever qualquer um
// deles por instância (ver EnemyBase.resolveEnemyOverrides).
export const MOBS_CONFIG = {
  default_mob: {
    path: 'assets/mobs/',
    stats: { life: 3, speed: 50, chaseSpeed: 100 },
    patrol: true,
    direction: 'right',
    ai: { visionRangeTilesWidth: 0, visionRangeTilesHeight: 0, bidirectional: false },
    attack: { damage: 1, cooldown: 900 },
    projectile: { key: 'energy_bullet', speed: 300 },
    behavior: 'patrol',
  },
  patrol: {
    path: 'assets/mobs/',
    behavior: 'patrol',
    stats: { life: 3, type: 'commun', className: 'melee', speed: 50, chaseSpeed: 100 },
    attack: { damage: 1, rangePx: 6, cooldown: 90 },
  },

  patrol_and_shoot: {
    path: 'assets/mobs/',
    stats: { life: 2, type: 'ranger', className: 'ranged', speed: 45 },
    ai: { visionRangeTilesWidth: 3, visionRangeTilesHeight: 1, bidirectional: false },
    debug: false,
    attack: { damage: 1, cooldown: 1500 },
    projectile: { key: 'arrow', speed: 130 },
    behavior: 'patrol_and_shoot',
  },
  // Substitui o antigo "aggro_fly": mesma mecânica de voo, agora dentro
  // do padrão patrol_* (patrol/direction/vision configuráveis via Tiled).
  patrol_fly: {
    path: 'assets/mobs/',
    stats: { life: 5, type: 'brute', className: 'melee', speed: 50, chaseSpeed: 50 },
    ai: { visionRangeTilesWidth: 7, visionRangeTilesHeight: 7, bidirectional: true },
    noGravity: true,
    behavior: 'patrol_fly',
    debug: false,
  },
};

// A key do Tiled identifica os assets; o type identifica o comportamento/configuração.
export const DEFAULT_MOB_TYPE = 'default_mob';
export const DEFAULT_MOB_KEY = 'mob_1';

function mergeMobConfig(base, overrides) {
  const result = { ...base };
  Object.entries(overrides || {}).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeMobConfig(result[key] || {}, value)
      : value;
  });
  return result;
}

// "attack" (corpo-a-corpo: sword/shield) e "bow" (à distância) são os dois
// jeitos de "atacar" que os mobs têm hoje (nenhuma pasta de MOB_SPRITE_SETS
// tem uma versão "staff" — esse cajado é exclusivo do player, ver
// WEAPONS_CONFIG.staff em game/config/weapons.js). Nem todo mob tem as
// duas: mob_1 tem attack+bow, tank só tem attack, dino só tem bow, bat e
// shadow não têm nenhuma. Pra behavior nenhuma ficar "manca" só por causa
// da pasta escolhida no Tiled, quem tem só uma das duas empresta a mesma
// animação pra outra chave (ex: dino, sem "attack", ataca corpo-a-corpo
// com a pose de "bow"; tank, sem "bow", atira com a pose de "attack").
// Bat/shadow (sem nenhuma das duas) continuam sem — não tem de onde copiar.
function withMeleeRangedFallback(animations) {
  const attack = animations.find((animation) => animation.key === 'attack');
  const bow = animations.find((animation) => animation.key === 'bow');
  if (bow && !attack) return [...animations, cloneAsFallback(bow, 'attack')];
  if (attack && !bow) return [...animations, cloneAsFallback(attack, 'bow')];
  return animations;
}

// Clona uma animação pra "emprestar" a arte dela pra outra key (ver
// withMeleeRangedFallback acima). Se a original já é uma spritesheet
// própria (tem "frame"), a cópia reaproveita a MESMA textura via `asset`
// em vez de carregar o arquivo de novo (ex: dino ganha "attack" sem baixar
// bow/sprite_weapon_bow_short_fire_fast_bag.png outra vez); no sistema
// antigo ("frames", ainda usado por tank) segue duplicando a url como
// sempre — não tem `asset`/dedup por lá.
function cloneAsFallback(source, key) {
  if (!Object.prototype.hasOwnProperty.call(source, 'frame')) {
    return { ...source, key };
  }
  return { key, asset: source.asset || source.key, frame: source.frame, frameRate: source.frameRate, repeat: source.repeat };
}

// Junta a IA/stats do "type" (MOBS_CONFIG) com as animações REAIS da pasta
// de sprite (MOB_SPRITE_SETS) — são dois eixos independentes: "type" nunca
// sabe de frame/arquivo, "mobFolder" nunca sabe de IA/dano. `mobFolder` é
// sempre a prop "path" do Tiled (ou "key" quando "path" não é definida, ver
// EnemyFactory.readCoreTiledProps).
export function getMobConfig(type = DEFAULT_MOB_TYPE, mobFolder = DEFAULT_MOB_KEY) {
  const typeConfig = MOBS_CONFIG[type];
  if (!typeConfig) {
    console.warn(`Tipo de mob "${type}" não existe. Usando "${DEFAULT_MOB_TYPE}".`);
  }
  const behaviorConfig = mergeMobConfig(MOBS_CONFIG.default_mob, typeConfig || {});

  const resolvedSpriteSet = MOB_SPRITE_SETS[mobFolder] || MOB_SPRITE_SETS[DEFAULT_MOB_KEY];
  if (!MOB_SPRITE_SETS[mobFolder]) {
    console.warn(`Pasta de sprite "${mobFolder}" não existe em MOB_SPRITE_SETS. Usando "${DEFAULT_MOB_KEY}".`);
  }
  const animations = withMeleeRangedFallback(resolvedSpriteSet.animations);
  // Grid das animações "frame" (spritesheet) deste mob — default 16x24
  // (igual ao player), sobrescrito por mob quando necessário (ver bat,
  // 16x16, em MOB_SPRITE_SETS). Irrelevante pras animações "frames"
  // (sistema antigo, shadow/tank) e pras "shared" (sempre 16x24, ver
  // preloadSpriteSheetAnimations em animationUtils.js).
  const frameWidth = resolvedSpriteSet.frameWidth || PLAYER_FRAME_WIDTH;
  const frameHeight = resolvedSpriteSet.frameHeight || PLAYER_FRAME_HEIGHT;

  return { ...behaviorConfig, animations, frameWidth, frameHeight };
}

export function getEntityAnimationKey(entityKey, animationKey) {
  return `${entityKey}_${animationKey}`;
}

// Discrimina as duas convenções de animação de MOB_SPRITE_SETS (ver
// comentário lá em cima): "frame" (singular) é a NOVA spritesheet única,
// "frames" (plural) é o sistema ANTIGO de uma imagem por frame (ainda usado
// por shadow/tank). Usado tanto no preload/create (ver createEnemy.js)
// quanto na hora de escolher a textura inicial do sprite (ver
// spawnEnemyBase em entities/EnemyBase.js) — os dois sistemas nomeiam a
// textura de forma diferente (`key_0` vs `key` + frame 0).
export function isSpriteSheetAnimation(animation) {
  return Object.prototype.hasOwnProperty.call(animation, 'frame');
}

// Resolve o asset de UMA animação de mob pra uso FORA do Phaser (telas HTML
// puras — Coleção/Resumo da Run, ver screens/spriteSheetDom.js): não usa
// scene.load nem scene.anims, só lê a própria config, igual
// getPlayerAnimationAsset faz pro player. Retorna null se o mob não tiver
// essa animação (ex: nem todo mob tem "bow").
export function resolveMobFrameAsset(behavior, folder, animationKey) {
  const config = getMobConfig(behavior, folder);
  const animation = config.animations?.find((item) => item.key === animationKey);
  if (!animation) return null;

  if (!isSpriteSheetAnimation(animation)) {
    return {
      sheet: false,
      frames: Array.from(
        { length: animation.frames + 1 },
        (_, i) => `/assets/mobs/${folder}/${animation.url}${i}.png`
      ),
      frameRate: animation.frameRate,
    };
  }

  // "shared" mora fora da pasta do mob (assets/commons/) e sempre no grid
  // padrão — mesma regra de preloadSpriteSheetAnimations em animationUtils.js.
  return {
    sheet: true,
    url: animation.shared ? `/assets/${animation.url}.png` : `/assets/mobs/${folder}/${animation.url}.png`,
    totalFrames: animation.frame + 1,
    frameRate: animation.frameRate,
    frameWidth: animation.shared ? PLAYER_FRAME_WIDTH : config.frameWidth,
    frameHeight: animation.shared ? PLAYER_FRAME_HEIGHT : config.frameHeight,
  };
}
