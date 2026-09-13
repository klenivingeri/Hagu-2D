import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

// Registra o service worker gerado pelo vite-plugin-pwa no build (precache
// dos assets do jogo) para permitir jogar offline após o primeiro carregamento.
// Em dev (`npm run dev`) o plugin não gera SW, então isso vira um no-op.
//
// Dentro do app nativo (Capacitor) isso é DESLIGADO de propósito: o app já
// carrega tudo localmente (não precisa de cache offline via SW), e pior —
// ao atualizar o APK por cima do anterior (sem desinstalar), o WebView
// mantém o Service Worker/Cache Storage da instalação ANTIGA, que passa a
// interceptar os arquivos NOVOS do bundle (hashes diferentes a cada build)
// e trava o app na tela de loading. unregisterServiceWorker() abaixo limpa
// qualquer resquício disso em quem já instalou uma versão afetada.
export function RegisterServiceWorker() {
  if (Capacitor.isNativePlatform()) {
    unregisterServiceWorker();
    return;
  }
  if (!('serviceWorker' in navigator)) return;

  registerSW({ immediate: true });
}

async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('[registerServiceWorker] Falha ao limpar service worker antigo:', error);
  }
}
