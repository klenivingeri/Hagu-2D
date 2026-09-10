// ==========================================
// CONFIG POR ACESSÓRIO (ARMA) EQUIPADO
// ==========================================
// Um objeto por item de ACCESSORY_UPGRADE_IDS (ver game/config/upgrades.js).
// createBulletSystem.js lê essa config em vez de ter um `if` hardcoded por
// arma — pra adicionar uma arma nova (bullet/animação/som de tiro/som de
// colisão próprios) basta cadastrar a entrada aqui, sem tocar no resto do
// sistema de tiro.
//
// Campos:
// - animationKey: chave da animação do player (ver PLAYERS_CONFIG.animations
//   em game/config/entities.js) tocada ao disparar.
// - spawnType: 'bullet' (usa o pool scene.bullets) ou 'sword' (usa o pool
//   próprio scene.swordWaves, sem alcance de aljava).
// - shootSoundKey: som tocado no instante do disparo (ver GameScene.preload).
// - impactSoundKey: som tocado quando o projétil desse acessório colide
//   (tile ou alcance máximo). Cada arma pode ter o seu — ex: o Arco explode
//   com 'bow_arrow_explosion' em vez do 'tap' genérico das outras.
// - pierce: se o bullet atravessa o inimigo em vez de ser destruído no 1º hit.
// - damageMultiplier: aplicado sobre player.status.bulletDamage.
export const WEAPONS_CONFIG = {
  defaultWeapon: {
    animationKey: 'bow',
    spawnType: 'bullet',
    shootSoundKey: 'bullet_effect_1',
    impactSoundKey: 'tap',
    pierce: false,
    damageMultiplier: 1,
  },
  // Arco: metade do dano da arma padrão, mas atravessa o inimigo (ver
  // overlap com bullet.pierce em createEnemy.js). A flecha explode ao
  // colidir em vez do "tap" genérico.
  bowWeapon: {
    animationKey: 'arrow',
    spawnType: 'bullet',
    shootSoundKey: 'bullet_effect_bow',
    impactSoundKey: 'bow_arrow_explosion',
    pierce: true,
    damageMultiplier: 0.5,
  },
  // Espada: sem bullet — solta uma "meia lua" (spawnSwordWave em
  // createBulletSystem.js) com dano crítico e alcance curto.
  sword: {
    animationKey: 'attack',
    spawnType: 'sword',
    shootSoundKey: 'sword_swing',
    impactSoundKey: 'tap',
    critMultiplier: 2,
    rangeTiles: 2,
  },
  // Cajado: dispara uma bola de fogo (spawnType 'fireball', ver
  // spawnFireball em createBulletSystem.js) que quica no chão feito o
  // foguinho do Mario. Some no primeiro tile/parede lateral ou ao cair mais
  // de 1 tile sem repicar; ao acertar um inimigo, some e aplica queimadura
  // (burnDamage a cada burnTickIntervalMs) em vez de transformar em moeda.
  // O Nº DE HITS de queimadura não fica aqui: vem de player.status.burnTicks
  // (upgrade 'burnTicks' da loja, base 1 — ver game/config/status.js), pra
  // precisar comprar na loja pra queimar por mais tempo.
  staff: {
    animationKey: 'bow',
    spawnType: 'fireball',
    shootSoundKey: 'bullet_effect_1',
    impactSoundKey: 'tap',
    pierce: false,
    damageMultiplier: 0.5,
    burnDamage: 1,
    burnTickIntervalMs: 500,
  },
};

export function getWeaponConfig(weaponId) {
  return WEAPONS_CONFIG[weaponId] || WEAPONS_CONFIG.defaultWeapon;
}
