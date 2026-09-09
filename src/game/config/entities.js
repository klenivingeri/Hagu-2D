export const PLAYERS_CONFIG = {
  player: {
    path: 'assets/player/',
    animations: [
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: 0 },
      { key: 'jump', url: 'jump/sprite_jump_hop_', frames: 2, frameRate: 10, repeat: 0 },
      { key: 'spawn', url: 'spawn/sprite_re_warp_', frames: 5, frameRate: 10, repeat: 0 },
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_slow_', frames: 5, frameRate: 20, repeat: 0 },
      // Pose usada enquanto o player está encostado lateralmente em uma parede.
      { key: 'stick', url: 'stick/sprite_stick_two_', frames: 0, frameRate: 1, repeat: -1 },
      { key: 'dead', url: 'dead/sprite_z_die_skull_', frames: 7, frameRate: 10, repeat: 0 },
      { key: 'dead_jump', url: 'dead_jump/sprite_z_die_one_', frames: 10, frameRate: 10, repeat: 0 },
      { key: 'jump_down', url: 'jump_down/sprite_knock_down_one_', frames: 3, frameRate: 10, repeat: -1 },
    ],
    stats: {},
  },
};

// Cada mob define, além de assets/stats, uma "behavior": a chave que diz
// QUAL padrão de movimento/IA ele usa (ver game/entities/EnemyBehaviorFactory.js
// e game/entities/behaviors/*.js). Pra criar um inimigo novo com um jeito
// de agir diferente (ex: parado atirando, voador, perseguindo o player):
//   1. Exporte os sprites em assets/mobs/<nova_key>/ (mesma estrutura do mob_1)
//   2. Cadastre a entrada aqui embaixo com uma "key" única e a "behavior" desejada
//   3. Se a behavior ainda não existe, implemente-a em
//      game/entities/behaviors/<novaBehavior>.js e registre no
//      BEHAVIOR_REGISTRY de EnemyBehaviorFactory.js
// Nada mais precisa mudar: createEnemy.js e updateEnemyMovement.js já leem
// tudo dinamicamente a partir daqui.
//
// Campos "patrol" / "direction" / "ai.visionRangeTilesWidth" /
// "ai.visionRangeTilesHeight" / "ai.bidirectional" são os DEFAULTS de cada
// tipo — o Object Layer "enemy" do Tiled pode sobrescrever qualquer um
// deles por instância (ver EnemyBase.resolveEnemyOverrides).
export const MOBS_CONFIG = {
  default_mob: {
    path: 'assets/mobs/',
    animations: [],
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
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
      { key: 'attack', url: 'attack/sprite_weapon_sword_atk_melee_', frames: 5, frameRate: 20, repeat: 0 },
    ],
  },

  patrol_and_shoot: {
    path: 'assets/mobs/',
    stats: { life: 2, type: 'ranger', className: 'ranged', speed: 45 },
    ai: { visionRangeTilesWidth: 3, visionRangeTilesHeight: 1, bidirectional: false },
    debug: false,
    attack: { damage: 1, cooldown: 1500 },
    projectile: { key: 'arrow', speed: 130 },
    behavior: 'patrol_and_shoot',
    animations: [
      { key: 'run', url: 'run_bow/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast_bag_', frames: 4, frameRate: 20, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
    ],
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
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 5, repeat: -1 },
      { key: 'stomp', url: 'run/sprite_run_two_', frames: 3, frameRate: 5, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 5, frameRate: 20, repeat: 0 },
      { key: 'attack', url: 'run/sprite_run_two_', frames: 3, frameRate: 5, repeat: 0 },
    ],
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

export function getMobConfig(type = DEFAULT_MOB_TYPE) {

  const typeConfig = MOBS_CONFIG[type];
  if (!typeConfig) {
    console.warn(`Tipo de mob "${type}" não existe. Usando "${DEFAULT_MOB_TYPE}".`);
  }
  return mergeMobConfig(MOBS_CONFIG.default_mob, typeConfig || {});
}

export function getEntityAnimationKey(entityKey, animationKey) {
  return `${entityKey}_${animationKey}`;
}
