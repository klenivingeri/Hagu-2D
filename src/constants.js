export const MAP_LAYERS = {
    HORIZON: 'horizon',
    SKY: 'sky',
    FAR_BACKGROUND: 'far-background',
    NEAR_BECKGROUND: 'near-beckground',
    GROUND: 'ground',
    GROUND_FAKE: 'groundfake',
    FOREGROUND: 'foreground',
    OBSTACLES: 'obstacles',
    COLLISIONS: 'collisions',
    OVER_PLAYER: 'over-player',
    DEAD_ZONE: 'dead-zone',
    LIMITS: 'limits',
    PLAYER: 'player',
    ENEMY: 'enemy',
    RAIL: 'rail',
    PORTAL: 'portal',
    GATE: 'gate'
};

// Depths explícitos: no Phaser, layers e sprites criados depois podem ficar
// misturados quando usam o mesmo depth padrão (0).
export const MAP_DEPTHS = {
    HORIZON: 0,
    SKY: 10,
    FAR_BACKGROUND: 20,
    NEAR_BECKGROUND: 30,
    GROUND: 40,
    PLAYER: 45,
    COINS: 50,
    DIAMANTS: 51,
    LIFE: 52,
    SPRITE_DROP: 53,
    GOLD_BAG: 54,
    GROUND_FAKE: 60,
    FOREGROUND: 70,
    OBSTACLES: 80,
    COLLISIONS: 90,
    OVER_PLAYER: 100,
    DEAD_ZONE: 110,
    LIMITS: 120,
    PORTAL: 35,
};

// Contrato de eventos entre o Phaser e o HUD em HTML (ver
// /src/components/ui/Hud.js). O Phaser só emite (scene.game.events.emit),
// o HUD só escuta — nenhum dos dois lados importa código do outro.
export const HUD_EVENTS = {
    RESET: 'hud:reset',
    HEALTH_CHANGED: 'hud:health-changed',
    ENERGY_CHANGED: 'hud:energy-changed',
    ENERGY_EMPTY: 'hud:energy-empty',
    COINS_CHANGED: 'hud:coins-changed',
    DIAMONDS_CHANGED: 'hud:diamonds-changed',
    ATTEMPTS_CHANGED: 'hud:attempts-changed',
};

// Quantidade de tentativas (respawns) por fase antes do Game Over (ver
// GameScene.attemptsLeft / createPlayer.killPlayer()). Fica fixa aqui, não
// em GameManager, porque não é progresso persistido — reseta sozinha a cada
// Phaser.Game novo (ver main.js/startMatch), nunca é salva em storage.
export const MAX_RUN_ATTEMPTS = 3;

// XP necessário para passar de um nível pro próximo (ver
// GameManager.getLevelInfo). Fixo por enquanto — se a progressão precisar
// de curva, ajustar aqui.
export const EXP_PER_LEVEL = 100;

// Contrato de eventos entre o Phaser e a tela de loading em HTML (ver
// /src/screens/LoadingScreen.js). Mesma regra do HUD: o Phaser só emite, a
// tela de loading só escuta.
export const LOADING_EVENTS = {
    PROGRESS: 'loading:progress',
    COMPLETE: 'loading:complete',
};

// Contrato de eventos entre o Phaser e a tela de resumo da run em HTML (ver
// /src/screens/RunSummaryScreen.js). Disparado quando o player colide com um
// portal (ver game/systems/create/createPortals.js) que encerra a fase.
export const RUN_EVENTS = {
    COMPLETE: 'run:complete',
};

// Contrato de eventos entre o Phaser e o modal de pausa em HTML (ver
// /src/screens/PauseScreen.js). Disparado quando o player aperta START ou
// SELECT (ver game/systems/create/createControls.js) durante a run.
export const PAUSE_EVENTS = {
    OPEN: 'pause:open',
};

// Contrato de eventos entre o Phaser e o modal de configurações em HTML (ver
// /src/screens/SettingsScreen.js). Disparado quando o player aperta SELECT
// (ver game/systems/create/createControls.js) durante a run.
export const SETTINGS_EVENTS = {
    OPEN: 'settings:open',
};

// Contrato de eventos entre o Phaser e o modal de Game Over em HTML (ver
// /src/screens/GameOverScreen.js). Disparado por createPlayer.killPlayer()
// quando attemptsLeft chega a 0 (ver MAX_RUN_ATTEMPTS acima).
export const GAME_OVER_EVENTS = {
    OPEN: 'game-over:open',
};
