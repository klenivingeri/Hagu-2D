// Camada de fullscreen desacoplada (CLAUDE.md regra 3, mesmo esquema de
// StorageService.js/HapticsService.js). A Fullscreen API não existe/funciona
// igual em todo navegador (ex: Safari iOS não suporta), então tudo aqui
// tolera a API ausente sem quebrar o jogo. Não persiste nada via
// StorageService: navegadores só entram em fullscreen a partir de um gesto
// do usuário, então não dá pra restaurar esse estado sozinho num reload.
export function isFullscreenSupported() {
  return typeof document !== 'undefined' && Boolean(
    document.fullscreenEnabled
    || document.webkitFullscreenEnabled
    || document.msFullscreenEnabled
  );
}

export function isFullscreenActive() {
  return Boolean(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement
  );
}

export async function enterFullscreen(target = document.documentElement) {
  if (!isFullscreenSupported() || isFullscreenActive()) return;

  try {
    const request = target.requestFullscreen
      || target.webkitRequestFullscreen
      || target.msRequestFullscreen;
    await request?.call(target);
  } catch (error) {
    console.warn('[FullscreenService] Falha ao entrar em fullscreen:', error);
  }
}

export async function exitFullscreen() {
  if (!isFullscreenActive()) return;

  try {
    const exit = document.exitFullscreen
      || document.webkitExitFullscreen
      || document.msExitFullscreen;
    await exit?.call(document);
  } catch (error) {
    console.warn('[FullscreenService] Falha ao sair de fullscreen:', error);
  }
}

export async function toggleFullscreen(target) {
  if (isFullscreenActive()) {
    await exitFullscreen();
  } else {
    await enterFullscreen(target);
  }
}

// O jogador pode sair do fullscreen sem passar pelo toggle (tecla Esc,
// gesto do navegador) — `callback` deve resincronizar a UI (checkbox) nesses
// casos.
export function onFullscreenChange(callback) {
  document.addEventListener('fullscreenchange', callback);
  document.addEventListener('webkitfullscreenchange', callback);
  document.addEventListener('msfullscreenchange', callback);
}

// Contraparte de onFullscreenChange — chame ao desmontar a tela que
// registrou o listener, senão ele vaza (document nunca é destruído junto
// com a tela) toda vez que a tela reabre.
export function offFullscreenChange(callback) {
  document.removeEventListener('fullscreenchange', callback);
  document.removeEventListener('webkitfullscreenchange', callback);
  document.removeEventListener('msfullscreenchange', callback);
}
