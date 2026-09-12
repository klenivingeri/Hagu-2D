import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relativo, não '/': a CrazyGames (e qualquer preview local via file://)
  // serve o build de dentro de uma subpasta própria, nunca na raiz do
  // domínio — com base absoluta os <script>/<link> gerados apontariam pra
  // "/assets/..." da raiz DELES (404 em tudo, tela branca). Com './' os
  // caminhos ficam relativos ao próprio index.html, funcionando em
  // qualquer profundidade de pasta.
  base: './',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico,mp3,wav,ttf,tmj,json}'],
        globIgnores: ['manifest.json'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-assets',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
