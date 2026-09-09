import Phaser from 'phaser';

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
      debug: false, // <-- Isso faz a borda de colisão aparecer em volta de todos os sprites
    },
  },
  // GameScene não sobe sozinha: ela precisa da mapKey escolhida no grid da
  // Welcome (ver main.js/startMatch), que chama
  // `game.scene.add('GameScene', GameScene, true, { mapKey })` depois de
  // criar o Phaser.Game. Deixar ela aqui faria o Phaser auto-iniciá-la sem
  // dados e, no frame seguinte, o restart com a mapKey certa corromperia o
  // loader (dois preload() concorrentes na mesma cena).
  scene: [],
};
