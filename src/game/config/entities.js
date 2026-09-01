export const PLAYERS_CONFIG = {
  player: {
    path: 'assets/player/',
    animations: [
      { key: 'idle', url: 'idle/sprite_base_idle_', frames: 3, frameRate: 4, repeat: 0 },
      { key: 'jump', url: 'jump/sprite_jump_hop_', frames: 5, frameRate: 10, repeat: 0 },
      { key: 'spawn', url: 'spawn/sprite_re_warp_', frames: 5, frameRate: 10, repeat: 0 },
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_slow_', frames: 5, frameRate: 20, repeat: 0 },
    ],
    stats: {},
  },
};

export const MOBS_CONFIG = {
  mob_1: {
    path: 'assets/mobs/mob_1/',
    animations: [
      { key: 'run', url: 'run/sprite_run_two_', frames: 3, frameRate: 10, repeat: -1 },
      { key: 'stomp', url: 'stomp/sprite_re_land_squash_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'bow', url: 'bow/sprite_weapon_bow_short_fire_fast_', frames: 4, frameRate: 10, repeat: 0 },
      { key: 'spark', url: 'spark/sprite_z_die_spark_', frames: 7, frameRate: 20, repeat: 0 },
    ],
    stats: { life: 3, type: 'warrior', className: 'melee' },
  },
};

export function getEntityAnimationKey(entityKey, animationKey) {
  return `${entityKey}_${animationKey}`;
}
