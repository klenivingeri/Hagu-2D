// Filtros visuais aplicados na câmera principal da Run (ver Configurações >
// SELECT > "Filtro de tela": Normal/Daltônico/Game Boy). Só entram em
// scene.cameras.main.filters, nunca em objetos individuais — afetam tudo
// que o Phaser desenha (mapa, player, inimigos, efeitos), mas nunca o
// HUD/telas em HTML, que vivem fora do canvas (CLAUDE.md regra 1).
//
// settings.visualFilter é um valor só ('none'/'colorblind'/'gameboy' — ver
// GameManager.js), então nunca há ambiguidade sobre qual filtro deveria
// estar ativo. applyVisualFilters() sempre reconstrói a lista de filtros do
// zero a partir dele, em vez de mexer incrementalmente na lista da câmera.
import Phaser from 'phaser';

// Do mais escuro pro mais claro — cores reais da tela LCD do DMG-01.
const GAMEBOY_PALETTE = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f];

// Correção "Daltonize" pra deuteranopia (a forma mais comum de daltonismo).
// Importante: isso não SIMULA daltonismo, isso COMPENSA — redistribui a
// diferença de cor que uma pessoa com deuteranopia não enxerga bem no eixo
// vermelho-verde pro canal azul, onde a percepção dela continua normal. A
// mesma correção ajuda bastante quem tem protanopia também (mesmo eixo
// vermelho-verde); tritanopia (eixo azul-amarelo, bem mais rara) não é
// coberta por essa matriz única — decisão consciente de escopo, ver
// conversa: um seletor de 3 tipos ajudaria mais gente com precisão, mas
// dobra a complexidade da UI por um caso bem mais raro.
//
// Matriz calculada fora do jogo a partir do algoritmo Daltonize clássico
// (Fidaner/Walraven/Machado): RGB -> LMS -> zera a resposta do cone M
// (deficiente na deuteranopia) -> volta pra RGB -> erro = original -
// simulado -> redistribui esse erro nos canais G/B -> soma de volta no
// original. Cada etapa é uma transformação linear, então a cadeia inteira
// colapsa numa única matriz 3x3 fixa (por isso não recalculamos nada em
// runtime). Formato 5x4 do Phaser.Display.ColorMatrix: cada LINHA é um
// canal de SAÍDA (R,G,B,A), cada COLUNA um canal de ENTRADA
// (R,G,B,A,offset) — ver reset() em display/ColorMatrix.js do Phaser.
const DEUTERANOPIA_CORRECTION = [
  1, 0, 0, 0, 0,
  0.202325, 0.797674, 0, 0, 0,
  0.517411, -0.517413, 1, 0, 0,
  0, 0, 0, 1, 0,
];

function addGameboyFilter(scene) {
  const bandCount = GAMEBOY_PALETTE.length;
  const ramp = new Phaser.Display.ColorRamp(scene, GAMEBOY_PALETTE.map((color, index) => ({
    start: index / bandCount,
    end: (index + 1) / bandCount,
    colorStart: color,
    colorEnd: color,
  })));

  scene.cameras.main.filters.internal.addGradientMap({ ramp });
}

function addColorblindFilter(scene) {
  scene.cameras.main.filters.internal.addColorMatrix().colorMatrix.set(DEUTERANOPIA_CORRECTION);
}

// Chamado em create() e de novo sempre que o player troca o filtro com a
// Run em andamento (ver GameScene.refreshVisualFilters() / main.js
// onVisualFilterChange).
export function applyVisualFilters(scene, settings) {
  const camera = scene.cameras.main;
  camera.filters.internal.clear();

  if (settings.visualFilter === 'gameboy') addGameboyFilter(scene);
  else if (settings.visualFilter === 'colorblind') addColorblindFilter(scene);
}
