import { registerSW } from 'virtual:pwa-register';

// Registra o service worker gerado pelo vite-plugin-pwa no build (precache
// dos assets do jogo) para permitir jogar offline após o primeiro carregamento.
// Em dev (`npm run dev`) o plugin não gera SW, então isso vira um no-op.
export function RegisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  registerSW({ immediate: true });
}
