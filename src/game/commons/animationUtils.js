import { PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT } from '../config/entities.js';

// Automatiza a criação de animações a partir de uma lista de configs
// (ver game/config/animations.js). Duas funções porque o Phaser separa
// carregamento de asset (preload) de criação de animação (create): as
// imagens precisam estar 100% carregadas antes de anims.create() usar
// os frames, senão a animação fica quebrada/incompleta.
//
// Uso típico (mobs — uma imagem por frame, ver MOB_SPRITE_SETS):
//   preload() { preloadAnimations(this, ANIME_PLAYER); }
//   create()  { createAnimations(this, ANIME_PLAYER); }
//
// Player usa preloadSpriteSheetAnimations/createSpriteSheetAnimations logo
// abaixo (uma ÚNICA imagem em grid 16x24 por animação, ver PLAYER_SKINS em
// game/config/entities.js).

// Enfileira o load.image de cada frame de cada animação da lista.
// Chame dentro de preload().
export function preloadAnimations(scene, animeList, entityKey = '') {
  animeList.forEach((props) => {
    for (let i = 0; i <= props.frames; i++) {
      const textureKey = entityKey ? `${entityKey}_${props.key}_${i}` : `${props.key}_${i}`;
      scene.load.image(textureKey, `${props.url}${i}.png`);
    }
  });
}

// Registra (scene.anims.create) cada animação da lista, montando o array
// de frames a partir do mesmo prefixo usado no preload. Chame dentro de
// create(), depois que os assets já foram carregados.
export function createAnimations(scene, animeList, entityKey = '') {
  animeList.forEach((props) => {
    const frames = [];
    const animationKey = entityKey ? `${entityKey}_${props.key}` : props.key;

    for (let i = 0; i <= props.frames; i++) {
      const frameKey = entityKey ? `${entityKey}_${props.key}_${i}` : `${props.key}_${i}`;
      if (scene.textures.exists(frameKey)) frames.push({ key: frameKey });
    }

    if (!frames.length) return;
    scene.anims.create({
      key: animationKey,
      frames,
      frameRate: props.frameRate,
      repeat: props.repeat,
    });
  });
}

// Resolve a texture key REAL de uma animação — normalmente própria
// (`${entityKey}_${key}`), mas pode apontar pra outra textura já
// carregada em vez de baixar o arquivo de novo:
//   - `sourceKey`: reaproveita a textura de OUTRA key do MESMO entityKey
//     (ver `asset` em MOB_SPRITE_SETS/PLAYER_SKINS — ex: bat_spark usa a
//     textura de bat_run).
//   - `shared`: reaproveita um asset de assets/commons/, numa textura
//     GLOBAL (sem prefixo de entityKey) — carregada uma única vez não
//     importa quantos entityKeys a referenciem (ver `shared` em
//     MOB_SPRITE_SETS — ex: mob_1/dino/bat compartilham o mesmo "spark").
function resolveSpriteSheetTextureKey(entityKey, { key, sourceKey, shared }) {
  if (shared) return `shared_${sourceKey || key}`;
  return entityKey ? `${entityKey}_${sourceKey || key}` : (sourceKey || key);
}

// Enfileira o load.spritesheet de CADA animação que tem arquivo próprio
// (uma imagem por animação, ver PLAYER_SKINS/MOB_SPRITE_SETS em
// game/config/entities.js) — animações com `sourceKey` não carregam nada,
// só reaproveitam a textura de outra entrada já enfileirada aqui. Chame
// dentro de preload().
export function preloadSpriteSheetAnimations(scene, animeList, entityKey = '', frameWidth = PLAYER_FRAME_WIDTH, frameHeight = PLAYER_FRAME_HEIGHT) {
  animeList.forEach((animation) => {
    if (animation.sourceKey) return;
    const textureKey = resolveSpriteSheetTextureKey(entityKey, animation);
    // Assets "shared" (assets/commons/) sempre usam o grid padrão, mesmo
    // que este entityKey use outro grid pras próprias animações (ver bat,
    // 16x16, em MOB_SPRITE_SETS).
    const size = animation.shared
      ? { frameWidth: PLAYER_FRAME_WIDTH, frameHeight: PLAYER_FRAME_HEIGHT }
      : { frameWidth, frameHeight };
    scene.load.spritesheet(textureKey, animation.url, size);
  });
}

// Registra (scene.anims.create) cada animação da lista a partir dos frames
// 0..lastFrame da textura resolvida (própria, ou reaproveitada via
// `sourceKey`/`shared` — ver resolveSpriteSheetTextureKey acima). A
// ANIMAÇÃO continua identificada por `${entityKey}_${key}` mesmo quando a
// textura é compartilhada, senão duas entidades bateriam a mesma
// animationcomplete-<key>. Chame dentro de create().
export function createSpriteSheetAnimations(scene, animeList, entityKey = '') {
  animeList.forEach((animation) => {
    const { key, lastFrame, frameRate, repeat } = animation;
    const textureKey = resolveSpriteSheetTextureKey(entityKey, animation);
    if (!scene.textures.exists(textureKey)) return;

    scene.anims.create({
      key: entityKey ? `${entityKey}_${key}` : key,
      frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: lastFrame }),
      frameRate,
      repeat,
    });
  });
}
