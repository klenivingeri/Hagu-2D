// Metadados de "lore" da Coleção (nome/descrição por espécie de inimigo) —
// puramente texto/UI, nunca lido pelo Phaser (CLAUDE.md regra 1). A espécie
// é identificada pela mesma `key` do Object Layer "enemy" do Tiled usada em
// EnemyBase.js/GameScene.enemyKills (ver registerEnemyKill), não pela
// `type`/behavior (que só decide IA/stats, várias keys podem compartilhar).
export const BESTIARY = {
  mob_1: {
    name: 'Rastreador',
    description: 'Patrulha o chão de um lado a outro, atacando qualquer um que cruzar seu caminho.',
  },
  dino: {
    name: 'Dino Selvagem',
    description: 'Um réptil arisco que avança em linha reta contra quem se aproxima demais.',
  },
  dino_shoot: {
    name: 'Dino Arqueiro',
    description: 'Versão treinada do dino selvagem: mantém distância e dispara flechas.',
  },
  bat: {
    name: 'Morcego Sombrio',
    description: 'Voa livremente pelo cenário e parte pra cima assim que avista o herói.',
  },
  bee: {
    name: 'Abelha Furiosa',
    description: 'Enxame veloz que persegue voando por qualquer fresta do mapa.',
  },
  tank: {
    name: 'Tanque Blindado',
    description: 'Lento, porém muito resistente — avança como uma muralha.',
  },
};

// Espécie derrotada mas ainda sem entrada cadastrada acima (mob novo sem
// lore escrita ainda) cai aqui, em vez de a Coleção quebrar.
export function getBestiaryEntry(speciesKey) {
  return BESTIARY[speciesKey] || {
    name: speciesKey,
    description: 'Um inimigo ainda não catalogado.',
  };
}

// Rótulo exibido no card/modal a partir da `behavior` do mob (ver
// MOBS_CONFIG em game/config/entities.js) — mesma classificação que já
// existe pra IA, só traduzida pra texto de jogador.
const BEHAVIOR_TRAIT_LABELS = {
  patrol: 'Patrulheiro',
  patrol_and_shoot: 'Atirador',
  patrol_fly: 'Voador',
};

export function getBehaviorTraitLabel(behavior) {
  return BEHAVIOR_TRAIT_LABELS[behavior] || 'Desconhecido';
}
