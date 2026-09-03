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
    RAIL: 'rail'
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
    GROUND_FAKE: 60,
    FOREGROUND: 70,
    OBSTACLES: 80,
    COLLISIONS: 90,
    OVER_PLAYER: 100,
    DEAD_ZONE: 110,
    LIMITS: 120,
};
