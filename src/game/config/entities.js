export const PLAYERS_CONFIG = {
  player: {
    path: 'assets/player/',
    animations: [
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: 0 },
      { key: 'jump', url: 'jump/sprite_jump_hop_', frames: 2, frameRate: 10, repeat: 0 },
      { key: 'spawn', url: 'spawn/sprite_re_warp_', frames: 5, frameRate: 10, repeat: 0 },
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_slow_', frames: 5, frameRate: 20, repeat: 0 },
      // Animação do acessório "Arco" (ver ACCESSORY_UPGRADE_IDS em
      // game/config/upgrades.js) — reaproveita os frames de bow/ como
      // placeholder até existir arte própria; já é uma chave separada da
      // "bow" acima (usada pela arma padrão) pra poder trocar só o asset
      // depois sem mexer no resto do sistema de tiro (ver createBulletSystem.js).
      { key: 'arrow', url: 'arrow/sprite_weapon_bow_tall_fire_fast_', frames: 4, frameRate: 20, repeat: 0 },
      // Pose usada enquanto o player está encostado lateralmente em uma parede.
      { key: 'stick', url: 'stick/sprite_stick_two_', frames: 0, frameRate: 1, repeat: -1 },
      { key: 'dead', url: 'dead/sprite_z_die_skull_', frames: 7, frameRate: 10, repeat: 0 },
      { key: 'dead_jump', url: 'dead_jump/sprite_z_die_one_', frames: 10, frameRate: 10, repeat: 0 },
      { key: 'jump_down', url: 'jump_down/sprite_knock_down_one_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'attack', url: 'attack/sprite_weapon_sword_atk_melee_', frames: 5, frameRate: 20, repeat: 0 },
      { key: 'parachute', url: 'parachute/sprite_parachute_', frames: 5, frameRate: 20, repeat: 0 }
    ],
    stats: {},
  },
};

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
export const MOB_SPRITE_SETS = {
  mob_1: {
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
      { key: 'attack', url: 'attack/sprite_weapon_sword_atk_melee_', frames: 5, frameRate: 20, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast_', frames: 4, frameRate: 20, repeat: 0 },
    ],
  },
  // "run" usa a pasta run_bow/ (o dino corre já com o arco em punho) — é o
  // único jeito de "correr" que esse mob usa hoje (ver dino_shoot nos
  // mapas do Tiled); run/ (sem arco) existe na pasta mas ainda não tem
  // nenhum mob cadastrado que precise dela.
  dino: {
    animations: [
      { key: 'run', url: 'run_bow/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast_bag_', frames: 4, frameRate: 20, repeat: 0 },
    ],
  },
  bat: {
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 5, repeat: -1 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 5, frameRate: 20, repeat: 0 },
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
  if (bow && !attack) return [...animations, { ...bow, key: 'attack' }];
  if (attack && !bow) return [...animations, { ...attack, key: 'bow' }];
  return animations;
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

  const spriteSet = MOB_SPRITE_SETS[mobFolder];
  if (!spriteSet) {
    console.warn(`Pasta de sprite "${mobFolder}" não existe em MOB_SPRITE_SETS. Usando "${DEFAULT_MOB_KEY}".`);
  }
  const animations = withMeleeRangedFallback((spriteSet || MOB_SPRITE_SETS[DEFAULT_MOB_KEY]).animations);

  return { ...behaviorConfig, animations };
}

export function getEntityAnimationKey(entityKey, animationKey) {
  return `${entityKey}_${animationKey}`;
}
