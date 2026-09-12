import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // A lib real dispara feature-detection de <canvas> ao ser importada
      // (ver test/mocks/phaser-stub.js) — inofensivo no browser de verdade,
      // mas quebra em jsdom sem o pacote nativo `canvas`. Nossos testes só
      // exercitam lógica pura, nunca um Phaser.Game de verdade.
      phaser: fileURLToPath(new URL('./test/mocks/phaser-stub.js', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
