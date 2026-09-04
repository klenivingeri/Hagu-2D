import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene.js';

// Configuração central do Phaser.
// O jogo usa uma resolução lógica quadrada de 480x480 e o CSS decide o tamanho visual.
export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-content',
  width: 448,
  height: 448,
  backgroundColor: '#0f172a',
  pixelArt: true, // já cobre antialias:false + roundPixels:true para tudo que usa textura
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Arredonda o tamanho CSS do canvas para pixels inteiros. Evita blur
    // sutil em telas com devicePixelRatio fracionário (comum em Android).
    autoRound: true,
  },
  render: {
    // Redundante com pixelArt, mas explícito documenta a intenção e blinda
    // contra qualquer mudança futura de default do Phaser.
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
    // Pede a GPU discreta quando o aparelho tiver mais de uma (a maioria
    // dos celulares antigos só tem uma GPU integrada, então isso não
    // atrapalha nesses casos e ajuda em notebooks/desktops híbridos).
    powerPreference: 'high-performance',
    batchSize: 4096,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: true, // <-- Isso faz a borda de colisão aparecer em volta de todos os sprites
    },
  },
  scene: [GameScene],
};
