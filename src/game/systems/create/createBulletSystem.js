import { getEntityAnimationKey } from '../../config/entities.js';
import { getWeaponConfig } from '../../config/weapons.js';
import { emitBulletImpactDust, emitDryFireBurst, emitSwordWaveTrail, emitFireballTrail } from '../../commons/dustTrail.js';
import { MAP_DEPTHS, HUD_EVENTS } from '../../../constants.js';

// Intervalo entre cada flecha de uma mesma "sequência de disparo" (upgrade
// 'sequence' da loja, ver game/config/upgrades.js). Curto o bastante pra
// parecer uma rajada, não disparos separados.
const SEQUENCE_SHOT_DELAY_MS = 70;

// Animação/som/dano/alcance de cada acessório equipável (arma, arco,
// espada, cajado) vêm de WEAPONS_CONFIG (ver game/config/weapons.js) —
// nada disso é hardcoded aqui.
const SWORD_WAVE_SPEED = 300;
const SWORD_TRIGGER_FRAME = 3;
// player.y é o pé do sprite (origin 0.5,1 — ver createPlayer.js), não o
// centro. Um offset positivo (como o +5 do bullet do arco) nasce a onda
// abaixo dos pés — na beirada de uma plataforma isso cai fora do tile atual
// e ela colide com o chão no mesmo frame em que nasce. Negativo o bastante
// pra ficar na altura do tronco, longe do chão mesmo na borda.
const SWORD_WAVE_OFFSET_Y = 2;

// Custo de energia de qualquer ataque (arma/arco/espada/cajado — ver
// ACCESSORY_UPGRADE_IDS em game/config/upgrades.js). Todas as armas gastam
// do mesmo pool (player.status.currentEnergy), que recarrega sozinho com o
// tempo na velocidade do upgrade 'reloadSpeed' — sem energia suficiente, o
// ataque "falha a seco" igual à aljava vazia de antes.
const ENERGY_COST_PER_ATTACK = 1;

// Bola de fogo do Cajado (WEAPONS_CONFIG.staff, spawnType 'fireball'): quica
// no chão feito o "foguinho" do Mario. FIREBALL_BOUNCE_VELOCITY é o impulso
// vertical aplicado a cada repique (ver o collider com scene.platforms mais
// abaixo); FIREBALL_SPEED é a velocidade horizontal constante.
const FIREBALL_SPEED = 180;
const FIREBALL_BOUNCE_VELOCITY = 130;
// Se ela sair de uma borda/plataforma e cair mais que 1 tile (16px) sem
// repicar num chão, é destruída em vez de cair pra sempre (ver update()).
const FIREBALL_FALL_DESTROY_PX = 16;

export function createBulletSystem(scene) {
  // O tiro colide fisicamente com o cenário. Cada layer colidível usa um
  // callback próprio para garantir que o efeito aconteça somente em tiles,
  // nunca no overlap com inimigos.
  scene.platforms.forEach((colliderLayer) => {
    scene.physics.add.collider(scene.bullets, colliderLayer, (bullet) => {
      if (!bullet?.active) return;

      emitBulletImpactDust(scene, bullet, Math.sign(bullet.body?.velocity.x || scene.lastDirection));
      scene.sound.play(bullet.impactSoundKey || 'tap');
      destroyProjectile(bullet);
    });
    scene.physics.add.collider(scene.swordWaves, colliderLayer, (wave) => {
      if (!wave?.active) return;

      emitBulletImpactDust(scene, wave, Math.sign(wave.body?.velocity.x || scene.lastDirection));
      scene.sound.play(wave.impactSoundKey || 'tap');
      destroyProjectile(wave);
    });
    // Bola de fogo do Cajado: bater em cima do tile (touching.down) é o
    // repique normal (quica). Qualquer outro lado (parede lateral ou teto)
    // destrói, igual ao foguinho do Mario explodindo na parede — e mesmo
    // batendo em cima, se ela caiu mais de 1 tile (FIREBALL_FALL_DESTROY_PX)
    // desde o último chão tocado (ex: caiu de uma borda/plataforma alta),
    // esse próprio impacto no chão já destrói em vez de repicar de novo.
    scene.physics.add.collider(scene.fireballs, colliderLayer, (fireball) => {
      if (!fireball?.active) return;

      const touchedDown = fireball.body.touching.down || fireball.body.blocked.down;
      const fellTooFar = fireball.y - fireball.lastGroundY > FIREBALL_FALL_DESTROY_PX;

      if (touchedDown && !fellTooFar) {
        fireball.body.setVelocityY(-FIREBALL_BOUNCE_VELOCITY);
        fireball.lastGroundY = fireball.y;
        return;
      }

      emitBulletImpactDust(scene, fireball, Math.sign(fireball.body?.velocity.x || scene.lastDirection));
      scene.sound.play(fireball.impactSoundKey || 'tap');
      destroyProjectile(fireball);
    });
  });

  scene.physics.add.overlap(scene.bullets, scene.player, (player, bullet) => {
    if (!bullet?.active || bullet.owner !== 'enemy') return;
    destroyProjectile(bullet);
    scene.damagePlayer?.(bullet.damage || 1);
  });

  // Espada "para" qualquer bullet inimigo que cruzar a meia lua — a própria
  // onda nunca é destruída aqui (só ao sair do alcance ou bater em tile).
  scene.physics.add.overlap(scene.swordWaves, scene.bullets, (wave, bullet) => {
    if (!wave?.active || !bullet?.active || bullet.owner !== 'enemy') return;
    destroyProjectile(bullet);
  });

  // Cria de fato o projétil e o lança na direção que o player está olhando.
  const spawnBullet = () => {
    const player = scene.player;
    if (!hasEnoughEnergy(player)) {
      dryFire(scene, player);
      return;
    }
    const bullet = scene.bullets.get(scene.player.x, scene.player.y + 5, 'bullet');

    if (bullet) {
      const weaponConfig = getWeaponConfig(player.status.currentWeapon);

      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX(450 * player._shootDirection);
      bullet.owner = 'player';
      bullet.angle = 90;
      // O projétil usa a mesma camada visual do player: fica na frente do
      // que o player vê à frente e atrás do que cobre o player.
      bullet.setDepth(scene.player.depth ?? MAP_DEPTHS.PLAYER);
      bullet.damage = Math.max(1, Math.round(scene.player.status.bulletDamage * weaponConfig.damageMultiplier));
      bullet.pierce = weaponConfig.pierce;
      // Som tocado ao colidir (tile ou fim de alcance) — cada arma pode ter
      // o seu, ver WEAPONS_CONFIG.impactSoundKey em game/config/weapons.js.
      bullet.impactSoundKey = weaponConfig.impactSoundKey;
      // Alcance máximo (upgrade 'bulletRange' da loja): guarda o ponto de
      // origem pra medir a distância percorrida a cada frame em update().
      bullet.spawnX = bullet.x;
      const tileWidth = scene.map?.tileWidth || 16;
      bullet.maxRangePx = tileWidth * (player.status.bulletRangeTiles || 4);
      spendEnergy(player, scene);
      // Emite de imediato pra barra cair na hora do disparo; a partir daqui
      // update() assume e faz ela subir suavemente até a próxima unidade.
      emitEnergyHud(scene, player);
      scene.sound.play(weaponConfig.shootSoundKey);
    }
  };

  // Cajado: cria a bola de fogo e lança na direção que o player está
  // olhando, com gravidade normal (o repique é resolvido pelo collider com
  // scene.platforms acima). Sem sequência/aljava — um tiro por gasto de
  // energia, igual à espada.
  const spawnFireball = () => {
    const player = scene.player;
    if (!hasEnoughEnergy(player)) {
      dryFire(scene, player);
      return;
    }
    const weaponConfig = getWeaponConfig(player.status.currentWeapon);
    const fireball = scene.fireballs.get(player.x, player.y + 5, 'fireball');
    if (!fireball) return;

    fireball.setActive(true);
    fireball.setVisible(true);
    fireball.body.enable = true;
    fireball.body.allowGravity = true;
    fireball.body.setVelocity(FIREBALL_SPEED * player._shootDirection, 0);
    fireball.owner = 'player';
    fireball.setDepth(scene.player.depth ?? MAP_DEPTHS.PLAYER);
    fireball.damage = Math.max(1, Math.round(player.status.bulletDamage * weaponConfig.damageMultiplier));
    fireball.burnDamage = weaponConfig.burnDamage || 0;
    // Quantos hits de queimadura ela aplica ao acertar um inimigo — vem do
    // upgrade 'burnTicks' da loja (player.status, ver game/config/status.js),
    // não da arma: base 1 hit, precisa comprar pra queimar por mais tempo.
    fireball.burnTicks = player.status.burnTicks || 1;
    fireball.burnTickIntervalMs = weaponConfig.burnTickIntervalMs || 500;
    fireball.impactSoundKey = weaponConfig.impactSoundKey;
    // Referência de "último chão tocado", usada em update() pra destruir a
    // bola de fogo se ela cair mais de 1 tile sem repicar (saiu de uma
    // borda/plataforma) — ver FIREBALL_FALL_DESTROY_PX.
    fireball.lastGroundY = fireball.y;

    spendEnergy(player, scene);
    emitEnergyHud(scene, player);
    scene.sound.play(weaponConfig.shootSoundKey);
  };

  // Dispara `player.status.BulletSequence` flechas em rajada (upgrade
  // 'sequence' da loja) — cada uma reusa spawnBullet(), então gasta energia
  // normalmente e para cedo se a energia acabar no meio da rajada.
  const spawnBulletSequence = () => {
    const player = scene.player;
    const shotCount = Math.max(1, player.status.BulletSequence || 1);
    for (let i = 0; i < shotCount; i += 1) {
      scene.time.delayedCall(i * SEQUENCE_SHOT_DELAY_MS, () => {
        if (!player.active || player.isDead) return;
        spawnBullet();
      });
    }
  };

  // Espada: uma única "meia lua" por golpe (sem sequência), gastando energia
  // igual às outras armas. Usa a textura 'sword_wave' (um ")" desenhado via
  // Graphics, ver preloadSwordWaveTexture em commons/dustTrail.js) — nenhum
  // sprite novo precisa ser carregado.
  const spawnSwordWave = () => {
    const player = scene.player;
    if (!hasEnoughEnergy(player)) {
      dryFire(scene, player);
      return;
    }
    const weaponConfig = getWeaponConfig(player.status.currentWeapon);
    const wave = scene.swordWaves.get(player.x, player.y + SWORD_WAVE_OFFSET_Y, 'sword_wave');
    if (!wave) return;

    wave.setActive(true);
    wave.setVisible(true);
    wave.body.enable = true;
    wave.body.allowGravity = false;
    wave.body.setVelocityX(SWORD_WAVE_SPEED * player._shootDirection);
    wave.setFlipX(player._shootDirection === -1);
    wave.owner = 'player';
    wave.setDepth(player.depth ?? MAP_DEPTHS.PLAYER);
    wave.damage = Math.round(player.status.bulletDamage * weaponConfig.critMultiplier);
    wave.impactSoundKey = weaponConfig.impactSoundKey;
    wave.spawnX = wave.x;
    const tileWidth = scene.map?.tileWidth || 16;
    wave.maxRangePx = tileWidth * weaponConfig.rangeTiles;

    spendEnergy(player, scene);
    emitEnergyHud(scene, player);
    scene.sound.play(weaponConfig.shootSoundKey);
  };

  // Toca a animação `animationKey` do zero e chama `onTriggerFrame` uma
  // única vez, quando ela chegar no quadro `SWORD_TRIGGER_FRAME`/equivalente
  // (mesmo índice usado pelo tiro do arco) — é o instante em que o bullet ou
  // a meia lua deve sair, sincronizado com o gesto visual da animação.
  // Compartilhado entre arco/arma (spawnBulletSequence) e espada
  // (spawnSwordWave) pra não duplicar a fiação de eventos do Phaser.
  const playWeaponAnimation = (player, animationKey, onTriggerFrame) => {
    const fullAnimationKey = getEntityAnimationKey(player.entityKey, animationKey);
    const triggerTexture = `${fullAnimationKey}_${SWORD_TRIGGER_FRAME}`;

    // Garante que não fiquem múltiplos listeners acumulados de disparos
    // anteriores (guardamos a referência no próprio player pois a função é
    // recriada a cada fire()).
    if (player._onWeaponFrame) {
      player.off('animationupdate', player._onWeaponFrame);
    }
    player.off(`animationcomplete-${fullAnimationKey}`);

    // OBS: o Phaser não tem um evento "animationupdate-<key>" por chave (só
    // o "animationcomplete-<key>" tem essa variante); por isso escutamos o
    // evento genérico "animationupdate" e filtramos pela animação atual.
    player._onWeaponFrame = (anim, frame) => {
      if (anim.key === fullAnimationKey && frame.textureKey === triggerTexture) {
        onTriggerFrame();
        player.off('animationupdate', player._onWeaponFrame); // um disparo por animação
      }
    };
    player.on('animationupdate', player._onWeaponFrame);

    player.once(`animationcomplete-${fullAnimationKey}`, () => {
      player.isShooting = false;
    });

    // Toca a animação do zero. Como só entramos aqui quando não há nenhum
    // tiro em andamento (guard em fire()), não precisamos do ignoreIfPlaying.
    player.anims.play(fullAnimationKey);
  };

  const fire = () => {
    const player = scene.player;
    if (!player || player.isDead) return;

    // Ainda nascendo: não deixa atirar por cima da animação de spawn.
    if (player.isSpawning) return;

    // Já está no meio de uma animação de disparo: ignora o clique
    // até a animação atual terminar (evita reiniciar e perder o bullet).
    if (player.isShooting) return;

    // Enquanto estiver grudado, o tiro sai para o lado oposto da parede.
    // `lastWallSide` indica o lado para o qual o player deve se afastar:
    // -1 = parede à direita, +1 = parede à esquerda.
    const isGrounded = player.body.blocked.down || player.body.touching.down;
    const attachedWallSide = player.isWallSliding
      ? player.lastWallSide
      : (!isGrounded ? player.stickableWallSide : 0);
    const holdingLeft = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const holdingRight = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const heldDirection = holdingLeft ? -1 : holdingRight ? 1 : 0;
    player._shootDirection = attachedWallSide
      ? (heldDirection ? -heldDirection : -attachedWallSide)
      : scene.lastDirection;
    player.setFlipX(player._shootDirection === -1);
    player.isShooting = true;

    const weaponConfig = getWeaponConfig(player.status.currentWeapon);
    if (weaponConfig.spawnType === 'sword') {
      playWeaponAnimation(player, weaponConfig.animationKey, spawnSwordWave);
      return;
    }
    if (weaponConfig.spawnType === 'fireball') {
      playWeaponAnimation(player, weaponConfig.animationKey, spawnFireball);
      return;
    }

    playWeaponAnimation(player, weaponConfig.animationKey, spawnBulletSequence);
  };

  scene.input.on('pointerdown', fire);

  return {
    fire,
    fireEnemy(enemy, direction) {
      const bullet = scene.bullets.get(enemy.body.center.x + direction * 8, enemy.body.center.y, 'bullet');
      if (!bullet) return;
      const config = enemy.entityConfig?.projectile || {};
      bullet.setActive(true).setVisible(true);
      bullet.body.enable = true;
      bullet.body.allowGravity = false;
      bullet.body.setVelocityX((Number(config.speed) || 300) * direction);
      bullet.owner = 'enemy';
      bullet.damage = Number(enemy.entityConfig?.attack?.damage ?? config.damage) || 1;
      bullet.angle = direction < 0 ? 270 : 90;
      bullet.setDepth(enemy.depth ?? MAP_DEPTHS.PLAYER);
    },
    update() {
      const player = scene.player;
      if (player) {
        if (player.status.currentEnergy < player.status.maxEnergy
          && scene.time.now >= (player._nextEnergyRegenAt || Infinity)) {
          player.status.currentEnergy += 1;
          player._nextEnergyRegenAt = player.status.currentEnergy < player.status.maxEnergy
            ? scene.time.now + player.status.energyRegenMs
            : 0;
        }
        // A cada frame reemite a energia somando a fração já carregada da
        // próxima unidade, pra barra encher continuamente em vez de saltar
        // só quando a unidade inteira termina de carregar.
        emitEnergyHud(scene, player);
      }

      // Usando getChildren() para retornar um array padrão do JS. Mesma
      // checagem de alcance/borda vale pra bullet (arco/arma) e sword wave
      // (espada) — só bullets de player e a wave têm maxRangePx setado.
      [...scene.bullets.getChildren(), ...scene.swordWaves.getChildren()].forEach((projectile) => {
        if (!projectile || !projectile.active) return;

        // Se o tiro passar da borda direita da tela, esconde e desativa o corpo
        if (projectile.x > scene.scale.width) {
          destroyProjectile(projectile);
          return;
        }

        // Alcance máximo (upgrade 'bulletRange' da loja pro bullet,
        // WEAPONS_CONFIG.sword.rangeTiles pra wave). Tiros de inimigo não têm limite.
        if (projectile.maxRangePx
          && Math.abs(projectile.x - projectile.spawnX) >= projectile.maxRangePx) {
          emitBulletImpactDust(scene, projectile, Math.sign(projectile.body?.velocity.x || 1));
          destroyProjectile(projectile);
        }
      });

      // Rastro de partículas atrás da meia lua enquanto ela avança.
      scene.swordWaves.getChildren().forEach((wave) => {
        if (wave?.active) emitSwordWaveTrail(scene, wave);
      });

      // Bola de fogo do Cajado: não usa maxRangePx (o collider com
      // scene.platforms acima já cuida do repique/destruição em paredes,
      // teto e quedas de mais de 1 tile) — aqui só cobre o caso que o
      // collider não vê: sair da tela sem nunca ter colidido com nada.
      scene.fireballs.getChildren().forEach((fireball) => {
        if (!fireball?.active) return;
        emitFireballTrail(scene, fireball);

        if (fireball.x > scene.scale.width || fireball.x < 0) {
          destroyProjectile(fireball);
        }
      });
    },
  };
}

// Progresso (0..1) já carregado da unidade de energia que está recarregando agora.
function energyRegenProgressOf(player, scene) {
  const isRegenerating = player.status.currentEnergy < player.status.maxEnergy && player._nextEnergyRegenAt;
  if (!isRegenerating) return 0;
  return 1 - Math.min(1, Math.max(0, (player._nextEnergyRegenAt - scene.time.now) / player.status.energyRegenMs));
}

function hasEnoughEnergy(player) {
  return player.status.currentEnergy >= ENERGY_COST_PER_ATTACK;
}

// Desconta ENERGY_COST_PER_ATTACK do player, preservando o progresso de
// recarga já acumulado (ver energyRegenProgressOf) em vez de descartá-lo —
// senão o ataque parece "gastar 2 unidades" na barra.
function spendEnergy(player, scene) {
  const carriedProgress = energyRegenProgressOf(player, scene);
  player.status.currentEnergy -= ENERGY_COST_PER_ATTACK;
  player._nextEnergyRegenAt = scene.time.now + player.status.energyRegenMs * (1 - carriedProgress);
}

// Reação de "ataque falhou" (sem energia suficiente) — mesmo efeito visual e
// sonoro que a aljava vazia tinha antes, agora compartilhado por qualquer
// arma (ver spawnBullet/spawnSwordWave).
function dryFire(scene, player) {
  emitDryFireBurst(scene, player);
  scene.sound.play('dry_fire_1');
  scene.game.events.emit(HUD_EVENTS.ENERGY_EMPTY);
}

// Energia exibida no HUD como fração contínua: unidades inteiras + progresso
// (0..1) da próxima unidade recarregando, pra barra encher aos poucos em vez
// de pular só quando uma unidade inteira termina de recarregar.
function emitEnergyHud(scene, player) {
  const maxEnergy = player.status.maxEnergy;
  const displayEnergy = player.status.currentEnergy + energyRegenProgressOf(player, scene);

  // Evita reemitir (e reescrever o DOM) quando o valor não mudou de forma perceptível.
  if (player._lastHudEnergy !== undefined && Math.abs(player._lastHudEnergy - displayEnergy) < 0.001) return;
  player._lastHudEnergy = displayEnergy;
  scene.game.events.emit(HUD_EVENTS.ENERGY_CHANGED, displayEnergy, maxEnergy);
}

// Nome genérico porque agora serve tanto pra bullet (arco/arma) quanto pra
// sword wave (espada) — mesma forma física pros dois grupos.
function destroyProjectile(projectile) {
  projectile.setActive(false);
  projectile.setVisible(false);
  projectile.body.stop();
  projectile.body.enable = false;
  projectile.setPosition(-1000, -1000);
}
