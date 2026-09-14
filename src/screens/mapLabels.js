// Nome amigável por bioma pra exibir nas telas de HTML (Welcome e resumo de
// run) — a "key" crua tipo "map_forest_2" não é o que o jogador deve ler.
// Compartilhado entre WelcomeScreen.js e RunSummaryScreen.js.
const BIOME_LABELS = {
  map_0: 'Início',
  forest: 'Floresta',
  desert: 'Deserto',
  ice: 'Gelo',
  fire: 'Fogo',
  dungeon: 'Masmorra',
};

export function getStageLabel(mapKey) {
  if (BIOME_LABELS[mapKey]) return BIOME_LABELS[mapKey];
  const [, biome, stage] = mapKey?.match(/^map_([a-z]+)_(\d+)$/) || [];
  return biome ? `${BIOME_LABELS[biome] || biome} ${stage}` : mapKey;
}
