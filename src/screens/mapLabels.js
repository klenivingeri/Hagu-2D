import { MAPS } from '../game/config/maps.js';

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
  // "name" explícito em MAPS (ver game/config/maps.js) tem prioridade sobre
  // o rótulo derivado — necessário pra keys que não seguem o padrão
  // "map_<bioma>_<numero>", como "phase_forest_0".
  if (MAPS[mapKey]?.name) return MAPS[mapKey].name;
  if (BIOME_LABELS[mapKey]) return BIOME_LABELS[mapKey];
  const [, biome, stage] = mapKey?.match(/^map_([a-z]+)_(\d+)$/) || [];
  return biome ? `${BIOME_LABELS[biome] || biome} ${stage}` : mapKey;
}
