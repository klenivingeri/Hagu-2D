// Automatiza a criação de animações a partir de uma lista de configs
// (ver game/config/animations.js). Duas funções porque o Phaser separa
// carregamento de asset (preload) de criação de animação (create): as
// imagens precisam estar 100% carregadas antes de anims.create() usar
// os frames, senão a animação fica quebrada/incompleta.
//
// Uso típico:
//   preload() { preloadAnimations(this, ANIME_PLAYER); }
//   create()  { createAnimations(this, ANIME_PLAYER); }

// Enfileira o load.image de cada frame de cada animação da lista.
// Chame dentro de preload().
export function preloadAnimations(scene, animeList) {
  animeList.forEach((props) => {
    for (let i = 0; i <= props.frames; i++) {
      scene.load.image(`${props.key}_${i}`, `${props.url}${i}.png`);
    }
  });
}

// Registra (scene.anims.create) cada animação da lista, montando o array
// de frames a partir do mesmo prefixo usado no preload. Chame dentro de
// create(), depois que os assets já foram carregados.
export function createAnimations(scene, animeList) {
  animeList.forEach((props) => {
    const frames = [];

    for (let i = 0; i <= props.frames; i++) {
      frames.push({ key: `${props.key}_${i}` });
    }

    scene.anims.create({
      key: props.key,
      frames,
      frameRate: props.frameRate,
      repeat: props.repeat,
    });
  });
}
