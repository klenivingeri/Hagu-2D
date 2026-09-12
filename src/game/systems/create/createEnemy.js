import { preloadAnimations, createAnimations, preloadSpriteSheetAnimations, createSpriteSheetAnimations } from "../../commons/animationUtils.js";
import { DEFAULT_MOB_TYPE, getMobConfig, isSpriteSheetAnimation } from "../../config/entities.js";
import { EnemyFactory } from "../../entities/EnemyFactory.js";
import { damageEnemy, stompDamageEnemy, applyBurn } from "../../entities/EnemyBase.js";

// ==========================================
// CRIAÇÃO DOS INIMIGOS
// ==========================================
// createEnemys() só lê a camada "enemy" do Tiled e delega a montagem de
// cada inimigo pra EnemyFactory (game/entities/EnemyFactory.js) — que por
// sua vez usa EnemyBase (sprite/física/status/dano/colisão, compartilhado
// por qualquer tipo de inimigo) + EnemyBehaviorFactory (a "habilidade"/IA
// de cada tipo: patrol, patrol_and_shoot, patrol_fly...).
//
// Se um dia precisar spawnar um inimigo fora do Tiled (ex: onda de
// inimigos, respawn), chame EnemyFactory.create() diretamente em vez de
// duplicar essa lógica aqui.
export function createEnemys(scene) {
  const enemies = scene.physics.add.group();

  if (!scene.enemyLayer || !scene.enemyLayer.objects) return enemies;

  scene.enemyLayer.objects.forEach((objectData) => {
    const enemy = EnemyFactory.createFromTiledObject(scene, objectData);
    if (enemy) enemies.add(enemy);
  });

  // Um único overlap bullet x grupo cobre TODOS os inimigos (mortos ou
  // recém-criados são adicionados/removidos do mesmo grupo automaticamente).
  scene.physics.add.overlap(
    scene.bullets,
    enemies,
    (bullet, enemy) => {
      const bulletDirection = Math.sign(bullet.body?.velocity.x || 0);
      // Arco (bullet.pierce, ver createBulletSystem.js): atravessa o
      // inimigo em vez de ser destruído no primeiro hit. O cooldown de
      // invulnerabilidade do inimigo (ver EnemyBase.applyDamage) já evita
      // dano repetido enquanto a flecha ainda está sobreposta a ele.
      if (!bullet.pierce) bulletDestroy(bullet);
      if (bullet.owner !== 'enemy') damageEnemy(enemy, bullet.damage, bulletDirection);
    },
    null,
    scene
  );

  // Meia lua da Espada (ver createBulletSystem.js/SWORD_WEAPON_ID) — é
  // destruída no primeiro inimigo que acertar, não atravessa como o Arco.
  scene.physics.add.overlap(
    scene.swordWaves,
    enemies,
    (wave, enemy) => {
      if (!wave?.active) return;
      const waveDirection = Math.sign(wave.body?.velocity.x || 0);
      bulletDestroy(wave);
      damageEnemy(enemy, wave.damage, waveDirection);
    },
    null,
    scene
  );

  // Bola de fogo do Cajado (ver WEAPONS_CONFIG.staff em game/config/weapons.js
  // e spawnFireball em createBulletSystem.js): some no primeiro inimigo que
  // acertar (nunca atravessa) e, em vez de dano único, aplica dano de
  // impacto + queimadura (dano ao longo do tempo, ver applyBurn em
  // entities/EnemyBase.js).
  scene.physics.add.overlap(
    scene.fireballs,
    enemies,
    (fireball, enemy) => {
      if (!fireball?.active) return;
      const fireballDirection = Math.sign(fireball.body?.velocity.x || 0);
      bulletDestroy(fireball);
      damageEnemy(enemy, fireball.damage, fireballDirection);
      applyBurn(enemy, fireball.burnDamage, fireball.burnTicks, fireball.burnTickIntervalMs);
    },
    null,
    scene
  );

  return enemies;
}

function bulletDestroy(bullet) {
  bullet.setActive(false);
  bullet.setVisible(false);
  bullet.body.stop();
  bullet.setPosition(-1000, -1000);
}

// Reexportados por compatibilidade: createPlayer.js e outros módulos
// importam damageEnemy/stompDamageEnemy diretamente daqui. A implementação
// real (dano unificado bullet/stomp, cooldown, morte, knockback) vive em
// EnemyBase.js.
export { damageEnemy, stompDamageEnemy };

export function preloadEnemyAssets(scene, assetKeys = []) {
  const definitions = assetKeys.map((item) => typeof item === 'string'
    ? { key: item, type: DEFAULT_MOB_TYPE } : item);
  const loaded = new Set();
  definitions.forEach(({ key, path = '', type = DEFAULT_MOB_TYPE }) => {
    const config = getMobConfig(type, path || key);
    // Dedup por key+path (ver mesmo raciocínio em createEnemyAnimations
    // logo abaixo): os arquivos carregados vêm da pasta de sprite, não do type.
    const id = `${key}:${path}`;
    if (loaded.has(id)) return;
    loaded.add(id);

    const legacyAnimations = config.animations.filter((animation) => !isSpriteSheetAnimation(animation));
    const spriteSheetAnimations = config.animations.filter(isSpriteSheetAnimation);

    preloadAnimations(scene, legacyAnimations.map((animation) => ({
      ...animation, url: `${config.path}${path || key}/${animation.url}`,
    })), key);

    preloadSpriteSheetAnimations(scene, spriteSheetAnimations.map((animation) => ({
      key: animation.key,
      sourceKey: animation.asset,
      shared: animation.shared,
      // "shared" mora fora da pasta do mob (assets/commons/), o resto
      // segue a convenção normal assets/mobs/<mobFolder>/<subpasta>/<arquivo>.
      url: animation.shared
        ? `assets/${animation.url}.png`
        : `${config.path}${path || key}/${animation.url}.png`,
      lastFrame: animation.frame,
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    })), key, config.frameWidth, config.frameHeight);
  });
}

export function createEnemyAnimations(scene) {
  const definitions = scene.enemyDefinitions || (scene.enemyAssetKeys || [])
    .map((key) => ({ key, type: DEFAULT_MOB_TYPE }));
  const created = new Set();
  definitions.forEach(({ key, path = '', type = DEFAULT_MOB_TYPE }) => {
    const config = getMobConfig(type, path || key);
    // Dedup por key+path (não por type): as animações são registradas sob
    // o prefixo `key` e vêm da pasta de sprite (path||key) — o `type`
    // (comportamento) não influencia mais quais frames existem.
    const id = `${key}:${path}`;
    if (created.has(id)) return;
    created.add(id);

    const legacyAnimations = config.animations.filter((animation) => !isSpriteSheetAnimation(animation));
    const spriteSheetAnimations = config.animations.filter(isSpriteSheetAnimation);

    createAnimations(scene, legacyAnimations, key);
    createSpriteSheetAnimations(scene, spriteSheetAnimations.map((animation) => ({
      key: animation.key,
      sourceKey: animation.asset,
      shared: animation.shared,
      lastFrame: animation.frame,
      frameRate: animation.frameRate,
      repeat: animation.repeat,
    })), key);
  });
}
