// Camada de integração com a status bar nativa via Capacitor
// (@capacitor/status-bar) — CLAUDE.md regra 3, mesmo esquema de
// AdMobService.js: só funciona dentro do app nativo empacotado (Capacitor),
// nunca no navegador (web/CrazyGames), onde o plugin nativo nem existe. Fora
// do app nativo, vira um no-op silencioso.
//
// O modo imersivo "tela cheia igual jogo nativo" (barra de navegação/status
// escondidas, conteúdo desenhado atrás do notch/câmera) é configurado no
// lado nativo Android (MainActivity.java, com WindowInsetsControllerCompat).
// Este service só cobre o que o Android não garante sozinho: esconder a
// status bar assim que a WebView carrega e voltar a escondê-la sempre que o
// app volta de segundo plano (Android some com o hide() do WindowInsets
// quando o app é minimizado/restaurado).
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

function isSupported() {
  return Capacitor.isNativePlatform();
}

async function hideStatusBar() {
  if (!isSupported()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.hide();
  } catch (error) {
    console.warn('[StatusBarService] Falha ao esconder a status bar:', error);
  }
}

export function initStatusBar() {
  if (!isSupported()) return;
  hideStatusBar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') hideStatusBar();
  });
}
