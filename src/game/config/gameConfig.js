import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene.js';

// Configuração central do Phaser.
// O jogo usa uma resolução lógica quadrada de 480x480 e o CSS decide o tamanho visual.
export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-content',
  width: 480,
  height: 480,
  backgroundColor: '#0f172a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false,
    },
  },
  scene: [GameScene],
};
