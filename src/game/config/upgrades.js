// ==========================================
// CATÁLOGO DE UPGRADES DA LOJA
// ==========================================
// Fonte única de verdade dos upgrades compráveis (ver "Loja" em
// welcomeScreen.html/WelcomeScreen.js). O nível comprado de cada upgrade
// fica em gameState.upgrade[id] (0 = ainda não comprado) — o VALOR de
// status sempre é derivado daqui (base + perLevel * nível), nunca guardado
// solto em outro campo, pra loja e gameplay nunca dessincronizarem (ver
// createPlayerStatus em game/config/status.js).
//
// Cada upgrade custa moedas (🪙, `currency` omitido) OU diamantes (💎,
// `currency: 'diamant'`) — pulo duplo, paraquedas, jetpack e chance de drop
// de diamante são os únicos pagos em diamante, por serem desbloqueios/poder
// mais raros que o resto (ver GameManager.purchaseUpgrade).
//
// ECONOMIA: baseCost/costGrowth foram calibrados por "tier" de quanto o
// upgrade facilita o jogo quando comprado — S (transformador: vida/dano/
// pulo duplo/paraquedas/jetpack), A (forte: queda/multi-tiro/economia), B
// (utilidade: alcance/energia) e C (QoL: recarga).
//
// Calibrado para a escala planejada de 4 biomas x 10 fases (40 fases, o
// hub/map_0 vira só seletor de bioma, sem moeda/diamante):
// - Moedas: ~26/fase em média (mesma densidade dos mapas atuais) x 40
//   fases ≈ 1040 moedas num clear completo. Platinar TODOS os upgrades de
//   moeda custa ~965 — o jogador termina de montar o build perto do fim
//   do jogo, não no meio do 1º bioma.
// - Diamantes: ~2/fase (tile + drop de inimigo) x 40 fases ≈ 80 num clear
//   completo. Pulo duplo/paraquedas/jetpack ficam baratos DE PROPÓSITO (mecânica
//   nova — quanto antes o player desbloquear e usar, melhor a run
//   inteira). 'dropChance' é o upgrade que precisa acompanhar as 40
//   fases: platinar os 3 upgrades de diamante custa ~74, então também
//   termina perto do fim do jogo, não já no fim do bioma 1.
// Se a densidade real de moeda/diamante por fase nos biomas novos for
// bem diferente de ~26/~2, refaça essa conta (ver mensagem sobre a
// expansão de mapas) antes de lançar — senão a loja platina cedo demais
// ou fica inalcançável.
export const UPGRADES_CATALOG = [
  {
    id: 'bulletRange',
    label: 'Distância do tiro',
    icon: '🎯',
    tier: 'B', // utilidade: só importa em mapas abertos, dano já mata perto
    maxLevel: 10,
    baseCost: 4,
    costGrowth: 1.15,
    base: 4,       // tiles de alcance
    perLevel: 1,
    unit: 'tiles',
  },
  {
    id: 'energy',
    label: 'Energia do jetpack',
    icon: '⚡',
    tier: 'B', // utilidade: só relevante depois de comprar o jetpack (💎)
    maxLevel: 10,
    baseCost: 3,
    costGrowth: 1.15,
    base: 500,      // ms de combustível — calibrado pra subir só uns tiles, não o mapa inteiro
    perLevel: 60,
    unit: 'ms',
  },
  {
    id: 'fallResistance',
    label: 'Resistência à queda',
    icon: '🛡️',
    tier: 'A', // forte: evita mortes "bobas" de queda em qualquer fase
    maxLevel: 8,
    baseCost: 6,
    costGrowth: 1.25,
    base: 5,        // tiles de queda seguros antes de morrer (ver updatePlayerMovement)
    perLevel: 1,
    unit: 'tiles',
  },
  {
    id: 'life',
    label: 'Vida máxima',
    icon: '❤️',
    tier: 'S', // transformador: mais tentativas por fase, o upgrade mais impactante
    maxLevel: 8,
    baseCost: 11,
    costGrowth: 1.25,
    base: 3,        // corações
    perLevel: 1,
    unit: 'coração',
  },
  {
    id: 'damage',
    label: 'Dano do tiro',
    icon: '💥',
    tier: 'S', // transformador: mata mais rápido, reduz exposição a dano
    maxLevel: 10,
    baseCost: 8,
    costGrowth: 1.2,
    base: 1,
    perLevel: 1,
    unit: 'dano',
  },
  {
    id: 'doubleJump',
    label: 'Pulo duplo',
    icon: '🦘',
    tier: 'S', // transformador: nova opção de traversal/escape, salva runs inteiras
    maxLevel: 1,
    baseCost: 8,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'parachute',
    label: 'Paraquedas',
    icon: '🪂',
    tier: 'S', // transformador: mobilidade vertical nova, mesma categoria do pulo duplo
    maxLevel: 1,
    baseCost: 12,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'jetpack',
    label: 'Jetpack',
    icon: '🚀',
    tier: 'S', // transformador: mobilidade vertical nova, mesma categoria do pulo duplo/paraquedas
    maxLevel: 1,
    baseCost: 12,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'isStick',
    label: 'Grudar na parede',
    icon: '🧗',
    tier: 'S', // transformador: mesma categoria do pulo duplo/paraquedas/jetpack (habilidade equipável)
    maxLevel: 1,
    baseCost: 8,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  // Armas (ver ACCESSORY_UPGRADE_IDS): equipáveis na aba "Equip. >
  // Acessório", mesmo esquema de "compra depois equipa" das habilidades
  // acima — só uma arma fica ativa por vez. Ainda sem mecânica de gameplay
  // ligada (nenhuma muda dano/alcance/comportamento de verdade ainda), só
  // o catálogo + a equipagem em si.
  {
    id: 'defaultWeapon',
    label: 'Arma',
    icon: '🔫',
    description: 'Arma atual do player (arco).',
    tier: 'S',
    maxLevel: 1,
    baseCost: 0,
    costGrowth: 1,
    boolean: true,
  },
  {
    id: 'sword',
    label: 'Espada',
    icon: '🗡️',
    description: 'Alcance de 2 tiles, causa dano crítico.',
    tier: 'S',
    maxLevel: 1,
    baseCost: 10,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'bowWeapon',
    label: 'Arco',
    icon: '🏹',
    description: 'Metade do dano, mas atravessa o inimigo.',
    tier: 'S',
    maxLevel: 1,
    baseCost: 10,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'staff',
    label: 'Cajado',
    icon: '🪄',
    description: 'Bola de fogo que quica pelo chão e queima o inimigo ao acertar.',
    tier: 'S',
    maxLevel: 1,
    baseCost: 14,
    costGrowth: 1,
    currency: 'diamant',
    boolean: true,
  },
  {
    id: 'sequence',
    label: 'Sequência de disparo',
    icon: '🏹',
    tier: 'A', // forte: multiplica o DPS direto (N flechas por disparo)
    maxLevel: 6,
    baseCost: 10,
    costGrowth: 1.3,
    base: 1,        // flechas por disparo
    perLevel: 1,
    unit: 'flecha(s)',
  },
  {
    id: 'dropChance',
    label: 'Chance de dropar diamante',
    icon: '💎',
    tier: 'A', // forte: efeito "bola de neve" do diamante, acelera pulo duplo/paraquedas/jetpack
    maxLevel: 5,
    baseCost: 6,
    costGrowth: 1.3,
    currency: 'diamant',
    base: 5,        // %
    perLevel: 10,
    unit: '%',
  },
  {
    id: 'coinValue',
    label: 'Valor da moeda coletada',
    icon: '🪙',
    tier: 'A', // forte: efeito "bola de neve" — acelera todas as outras compras
    maxLevel: 8,
    baseCost: 6,
    costGrowth: 1.25,
    base: 1,
    perLevel: 1,
    unit: 'moeda(s)',
  },
  {
    id: 'burnTicks',
    label: 'Queimadura do Cajado',
    icon: '🔥',
    tier: 'B', // utilidade: só relevante pra quem tem o Cajado equipado
    maxLevel: 4,
    baseCost: 6,
    costGrowth: 1.2,
    base: 1,        // hits de queimadura aplicados após o acerto da bola de fogo
    perLevel: 1,
    unit: 'hit(s)',
  },
  {
    id: 'reloadSpeed',
    label: 'Velocidade de recarga de energia',
    icon: '🔄',
    tier: 'C', // QoL: só encurta o intervalo entre ataques, não muda o resultado
    maxLevel: 5,
    baseCost: 4,
    costGrowth: 1.2,
    base: 2000,     // ms pra recarregar 1 unidade de energia
    perLevel: -250,
    min: 750,
    unit: 'ms',
  },
];

// Upgrades comprados na Loja mas equipados na aba "Equip. > Habilidade" (ver
// WelcomeScreen.js) em vez de aparecerem na Loja normal — só uma habilidade
// fica ativa por vez (ver GameManager.equipAbility).
export const ABILITY_UPGRADE_IDS = ['doubleJump', 'parachute', 'jetpack', 'isStick'];

// Mesmo esquema acima, só que pra aba "Equip. > Acessório" — só uma arma
// fica equipada por vez (ver GameManager.equipAccessory). 'defaultWeapon' é
// a única que já nasce comprada e equipada (ver DEFAULT_EQUIPPED_ACCESSORY),
// já que é a arma atual do player.
export const ACCESSORY_UPGRADE_IDS = ['defaultWeapon', 'sword', 'bowWeapon', 'staff'];
export const DEFAULT_EQUIPPED_ACCESSORY = 'defaultWeapon';

export function findUpgradeDef(id) {
  return UPGRADES_CATALOG.find((def) => def.id === id) || null;
}

export function getUpgradeValue(def, level) {
  if (!def) return undefined;
  if (def.boolean) return level >= 1;
  const raw = def.base + def.perLevel * level;
  return def.min !== undefined ? Math.max(def.min, raw) : raw;
}

export function getUpgradeCost(def, level) {
  if (!def) return Infinity;
  return Math.round(def.baseCost * (def.costGrowth ** level));
}

export function isUpgradeMaxed(def, level) {
  if (!def) return true;
  return level >= def.maxLevel;
}

// 'coins' (🪙) é o padrão — só os upgrades com `currency: 'diamant'`
// explícito no catálogo custam diamante (💎).
export function getUpgradeCurrency(def) {
  return def?.currency === 'diamant' ? 'diamant' : 'coins';
}
