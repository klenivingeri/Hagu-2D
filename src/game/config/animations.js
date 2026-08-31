// ==========================================
// CONFIG DE ANIMAÇÕES
// ==========================================
// Cada entrada aqui vira, automaticamente, um preload de imagens + uma
// animação registrada no Phaser (veja game/commons/animationUtils.js).
//
// Para adicionar uma animação nova:
//   1. Coloque os sprites em assets/<algum-lugar>/<prefixo>_0.png, _1.png, ...
//   2. Adicione uma entrada no array (ANIME_PLAYER ou ANIME_ENEMY)
//   3. Nada mais precisa mudar no código: preloadPlayerAssets/createPlayerAnimations
//      (ou o equivalente de enemy) já leem essa lista dinamicamente.
//
// Campos:
//   key        -> nome da animação (usado em anims.play(key)) e também o
//                 prefixo da texture key gerada (ex: key: 'jump' -> jump_0, jump_1, ...)
//   url        -> prefixo do caminho do arquivo (sem o número e sem ".png")
//   frames     -> índice do último frame (ex: 5 => carrega/usa de 0 até 5, 6 frames)
//   frameRate  -> velocidade da animação, em quadros por segundo
//   repeat     -> 0 = toca uma vez, -1 = loop infinito

export const ANIME_PLAYER = [
    {
    key: 'idle',
    url: 'assets/player/idle/sprite_base_idle_',
    frames: 4, // 0 a 5
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'jump',
    url: 'assets/player/jump/sprite_jump_',
    frames: 5, // 0 a 5
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'spawn',
    url: 'assets/player/spawn/sprite_re_warp_',
    frames: 5, // 0 a 5
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'run',
    url: 'assets/player/run/sprite_run_two_',
    frames: 3, // 0 a 3
    frameRate: 10,
    repeat: -1,
  },
  {
    key: 'bow',
    url: 'assets/player/bow/sprite_weapon_bow_short_fire_slow_',
    frames: 5, // 0 a 5
    frameRate: 10,
    repeat: 0,
  },
];

export const ANIME_ENEMY = [
  {
    key: 'enemy_run',
    url: 'assets/mobs/mob_1/run/sprite_run_two_',
    frames: 3, // 0 a 3
    frameRate: 10,
    repeat: -1,
  },
  {
    key: 'enemy_stomp',
    url: 'assets/mobs/mob_1/stomp/sprite_re_land_squash_',
    frames: 4, // 0 a 3
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'enemy_bow',
    url: 'assets/mobs/mob_1/bow/sprite_weapon_bow_short_fire_fast_',
    frames: 4, // 0 a 3
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'enemy_spark',
    url: 'assets/mobs/mob_1/spark/sprite_z_die_spark_',
    frames: 7, // 0 a 3
    frameRate: 10,
    repeat: 0,
  },
];
