// Camada de viewport desacoplada (CLAUDE.md regra 3, mesmo esquema de
// StorageService.js/FullscreenService.js). `dvh`/`vw` puro dependem do
// documento recalcular o viewport, e em WebViews/navegadores mobile esse
// recálculo atrasa (ou nem acontece) no exato momento da rotação de tela,
// deixando uma faixa sem preencher até o próximo reflow. Como o app sempre
// roda em tela cheia (Web hoje, WebView/Capacitor no futuro — CLAUDE.md
// seção multiplataforma), é mais confiável ler o tamanho real da janela
// (`window.innerWidth/innerHeight`) e publicar como variáveis CSS,
// recalculadas a cada resize/orientationchange, em vez de confiar nas
// unidades de viewport do CSS.
function applyViewportSize() {
  const vw = window.innerWidth * 0.01;
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-vw', `${vw}px`);
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
}

export function startViewportSync() {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);
  // orientationchange dispara ANTES do navegador atualizar
  // innerWidth/innerHeight em alguns aparelhos Android — o timeout garante
  // que a leitura já reflita o novo formato da tela.
  window.addEventListener('orientationchange', () => {
    setTimeout(applyViewportSize, 100);
  });
  window.visualViewport?.addEventListener('resize', applyViewportSize);
}
