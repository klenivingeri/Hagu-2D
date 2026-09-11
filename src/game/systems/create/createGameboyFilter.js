// Filtro "tela verde" do Game Boy clássico (DMG-01, ver Configurações >
// Geral > "Filtro Game Boy"): recolore a câmera inteira pra só 4 tons de
// verde, usando o filtro GradientMap do Phaser 4 (Phaser.Display.ColorRamp)
// — ele converte a luminância de cada pixel num valor de 0 a 1 e mapeia
// esse valor pra uma cor ao longo da rampa. Cada faixa da rampa cobre 1/4
// do intervalo com colorStart === colorEnd (sem gradiente dentro da faixa),
// o que "achata" a transição num tom sólido em vez de um degradê suave —
// é assim que se consegue o visual posterizado autêntico da tela do
// console, não um simples tingimento verde.
//
// Só entra na câmera (this.cameras.main.filters), nunca em objetos
// individuais — afeta tudo que o Phaser desenha (mapa, player, inimigos,
// efeitos), mas nunca o HUD/telas em HTML, que vivem fora do canvas
// (CLAUDE.md regra 1).
import Phaser from 'phaser';

// Do mais escuro pro mais claro — cores reais da tela LCD do DMG-01.
const GAMEBOY_PALETTE = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f];

// Chamado em create() e de novo sempre que o player liga/desliga o filtro
// em Configurações com a Run em andamento (ver GameScene.applyGameboyFilter
// / main.js onGameboyFilterChange). Sempre limpa os filtros internos da
// câmera antes de decidir o que fazer — mais simples e à prova de duplicar
// filtro empilhado do que guardar/reaproveitar uma referência de controller
// entre chamadas (scene.restart() no respawn, troca ao vivo pelas
// Configurações etc.).
export function applyGameboyFilter(scene, enabled) {
  const camera = scene.cameras.main;
  camera.filters.internal.clear();
  if (!enabled) return;

  const bandCount = GAMEBOY_PALETTE.length;
  const ramp = new Phaser.Display.ColorRamp(scene, GAMEBOY_PALETTE.map((color, index) => ({
    start: index / bandCount,
    end: (index + 1) / bandCount,
    colorStart: color,
    colorEnd: color,
  })));

  camera.filters.internal.addGradientMap({ ramp });
}
