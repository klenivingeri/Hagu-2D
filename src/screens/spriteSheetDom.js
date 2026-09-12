// Toca uma spritesheet (grid frameWidth x frameHeight) como background de um
// elemento HTML puro, fora do Phaser (CLAUDE.md regra 1: telas fora do
// canvas não podem depender de uma cena Phaser rodando anims.create()).
// Usado pelo ícone do player na topbar/boneco do grid (WelcomeScreen) e
// pelos ícones de mob na Coleção/Resumo da Run (WelcomeScreen/
// RunSummaryScreen) sempre que a animação "run" daquela entidade já é uma
// spritesheet única (ver isSpriteSheetAnimation em game/config/entities.js)
// — mobs ainda no sistema antigo (uma imagem por frame) continuam usando
// <img> comum trocando `src`, não isto aqui.

// Escala o frame nativo (frameWidth x frameHeight) pra caber em
// `renderHeightPx` de altura — a largura sai proporcional, igual um <img>
// só com a altura fixada teria feito antes de virar spritesheet.
export function applySpriteSheet(el, { url, totalFrames, frameWidth = 16, frameHeight = 24 }, renderHeightPx) {
  const scale = renderHeightPx / frameHeight;
  const frameWidthPx = frameWidth * scale;
  el.style.backgroundImage = `url(${url})`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = `${frameWidthPx * totalFrames}px ${renderHeightPx}px`;
  el.style.width = `${frameWidthPx}px`;
  el.style.height = `${renderHeightPx}px`;
  el.dataset.frameWidthPx = frameWidthPx;
  setSpriteSheetFrame(el, 0);
}

export function setSpriteSheetFrame(el, frameIndex) {
  el.style.backgroundPositionX = `${-frameIndex * Number(el.dataset.frameWidthPx)}px`;
}

// Constrói o elemento que mostra um asset resolvido por
// resolveMobFrameAsset (game/config/entities.js) ou getPlayerAnimationAsset
// — <img> trocando `src` pro sistema antigo (uma imagem por frame) ou <div>
// com background-position pra spritesheet única. Devolve um `setFrame(i)`
// genérico: quem chamar decide se cicla (setInterval) ou deixa parado no
// frame 0 (ver buildCollectionCard/getGalleryPoses em WelcomeScreen.js e
// getMonsterIconSrc em RunSummaryScreen.js).
export function buildSpriteIconElement(asset, renderHeightPx, className) {
  if (!asset) {
    const img = document.createElement('img');
    img.className = className;
    return { element: img, totalFrames: 1, frameRate: 1, setFrame: () => {} };
  }

  if (!asset.sheet) {
    const img = document.createElement('img');
    img.src = asset.frames[0];
    img.className = className;
    // Sem asset real pra essa pose/mob (frames[0] undefined) não deve
    // deixar o ícone quebrado visível — some com ele.
    img.onerror = () => { img.style.visibility = 'hidden'; };
    return {
      element: img,
      totalFrames: asset.frames.length,
      frameRate: asset.frameRate,
      setFrame: (i) => { img.src = asset.frames[i]; },
    };
  }

  const el = document.createElement('div');
  el.className = className;
  applySpriteSheet(el, asset, renderHeightPx);
  return {
    element: el,
    totalFrames: asset.totalFrames,
    frameRate: asset.frameRate,
    setFrame: (i) => setSpriteSheetFrame(el, i),
  };
}
