import { getEntityAnimationKey } from '../../config/entities.js';
import { getWeaponConfig } from '../../config/weapons.js';
import { emitBulletImpactDust, emitDryFireBurst, emitSwordWaveTrail, emitFireballTrail, emitBombExplosion, emitBombTrail } from '../../commons/dustTrail.js';
import { damageEnemy } from '../../entities/EnemyBase.js';
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

// Bomba da habilidade "isPump" (ver ABILITY_UPGRADE_IDS em
// game/config/upgrades.js): um toque rápido no botão de disparo continua
// disparando a arma equipada normalmente — só SEGURAR além de
// PUMP_HOLD_THRESHOLD_MS entra no modo de carga da bomba (sprites
// bomb_charge_0..3, ver preload em GameScene.js). Soltar depois de carregar
// lança a bomba na direção que o player está olhando: corpo físico real
// (gravidade), sobe BOMB_RISE_PX e cai. Ela só explode BOMB_FUSE_MS depois
// de tocar o cenário pela primeira vez (ver armBomb/collider com
// scene.platforms) — pode voar por cima de vários tiles antes disso — e
// fica tocando a animação de "chiado" (cicla BOMB_CHARGE_FRAMES) enquanto
// aguarda, causando dano em área num círculo de BOMB_EXPLOSION_RADIUS_PX
// ao redor do centro dela quando explode (ver explodeBomb).
const BOMB_CHARGE_FRAMES = ['bomb_charge_0', 'bomb_charge_1', 'bomb_charge_2', 'bomb_charge_3'];
const BOMB_CHARGE_STEP_MS = 200;
const PUMP_HOLD_THRESHOLD_MS = 180;
const BOMB_RISE_PX = 16;
const BOMB_THROW_SPEED = 90;
const BOMB_FUSE_MS = 1000;
const BOMB_TICK_FRAME_MS = 150;
const BOMB_EXPLOSION_RADIUS_PX = 16;
// Ao tocar o chão, quica até BOMB_MAX_BOUNCES vezes (impulso decrescente)
// antes de travar de vez e armar o pavio — ver o collider com
// scene.platforms em createBulletSystem().
const BOMB_MAX_BOUNCES = 2;
const BOMB_BOUNCE_VELOCITY = 70;

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
    // Bomba da habilidade "isPump": tem gravidade real (ver releaseBomb) —
    // bater numa parede/teto no meio do voo só barra aquele lado (Arcade
    // Physics já cuida disso sozinho) e ela continua caindo até encontrar
    // um CHÃO de verdade. Só ao tocar o chão (touchedDown) ela quica até
    // BOMB_MAX_BOUNCES vezes antes de travar de vez e armar o pavio de
    // BOMB_FUSE_MS (ver armBomb).
    scene.physics.add.collider(scene.bombs, colliderLayer, (bomb) => {
      if (!bomb.active || bomb._armed) return;

      const touchedDown = bomb.body.touching.down || bomb.body.blocked.down;
      if (!touchedDown) return;

      if (bomb._bounceCount < BOMB_MAX_BOUNCES) {
        bomb._bounceCount += 1;
        bomb.body.setVelocityY(-BOMB_BOUNCE_VELOCITY / bomb._bounceCount);
        return;
      }

      armBomb(scene, bomb);
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
    // Cada animação hoje é UMA spritesheet só (ver PLAYER_SKINS em
    // game/config/entities.js), então todo frame compartilha o mesmo
    // frame.textureKey — o frame real é frame.textureFrame (índice dentro
    // da spritesheet).
    player._onWeaponFrame = (anim, frame) => {
      if (anim.key === fullAnimationKey && frame.textureFrame === SWORD_TRIGGER_FRAME) {
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

  // Direção do disparo/lançamento: mesma regra pra qualquer arma e pra bomba
  // — enquanto grudado na parede sai pro lado oposto dela, senão segue o
  // último lado que o player olhou (`lastWallSide`: -1 = parede à direita,
  // +1 = parede à esquerda).
  const computeShootDirection = (player) => {
    const isGrounded = player.body.blocked.down || player.body.touching.down;
    const attachedWallSide = player.isWallSliding
      ? player.lastWallSide
      : (!isGrounded ? player.stickableWallSide : 0);
    const holdingLeft = scene.cursors.left.isDown || scene.keys.A.isDown || scene.controlState.left;
    const holdingRight = scene.cursors.right.isDown || scene.keys.D.isDown || scene.controlState.right;
    const heldDirection = holdingLeft ? -1 : holdingRight ? 1 : 0;
    return attachedWallSide
      ? (heldDirection ? -heldDirection : -attachedWallSide)
      : scene.lastDirection;
  };

  // Carrega a bomba (habilidade "isPump"): nasce no menor sprite
  // (BOMB_CHARGE_FRAMES[0]) grudada acima do player e cresce um frame a
  // cada BOMB_CHARGE_STEP_MS enquanto o botão continuar pressionado (ver
  // updateBombCharge, chamado a cada frame em update()), travando no maior
  // frame se ela já tiver "carga máxima" — nunca perde a bomba por ficar
  // segurando além da conta.
  const startBombCharge = (player) => {
    if (player._bombCharging) return;
    if (!hasEnoughEnergy(player)) {
      dryFire(scene, player);
      return;
    }

    player._bombCharging = true;
    player._bombChargeFrame = 0;
    player._shootDirection = computeShootDirection(player);
    player.setFlipX(player._shootDirection === -1);

    const chargeSprite = scene.add.sprite(player.x, player.y - 10, BOMB_CHARGE_FRAMES[0]);
    chargeSprite.setScale(0.9);
    chargeSprite.setDepth((scene.player.depth ?? MAP_DEPTHS.PLAYER) + 1);
    player._bombChargeSprite = chargeSprite;

    player._bombChargeTimer = scene.time.addEvent({
      delay: BOMB_CHARGE_STEP_MS,
      loop: true,
      callback: () => {
        player._bombChargeFrame = Math.min(BOMB_CHARGE_FRAMES.length - 1, player._bombChargeFrame + 1);
        player._bombChargeSprite?.setTexture(BOMB_CHARGE_FRAMES[player._bombChargeFrame]);
      },
    });
  };

  // Cancela a carga em andamento sem lançar nada — usado quando o player
  // morre/sai de cena no meio da carga (ver update()), pra nunca deixar o
  // sprite/timer da bomba vazando por cima do respawn.
  const cancelBombCharge = (player) => {
    player._bombCharging = false;
    player._bombChargeTimer?.remove();
    player._bombChargeTimer = null;
    player._bombChargeSprite?.destroy();
    player._bombChargeSprite = null;
  };

  // Solta o botão após ter carregado: encerra a carga e lança a bomba
  // (tamanho = frame atingido na carga) na direção travada em
  // startBombCharge, com corpo físico real — gravidade normal do mundo, só
  // que com um impulso vertical calibrado (launchVelocityY) pra subir
  // exatamente BOMB_RISE_PX antes da gravidade puxar ela de volta. Não
  // agenda explosão nenhuma aqui: isso só acontece quando ela tocar o
  // cenário pela primeira vez (ver armBomb/collider com scene.platforms).
  const releaseBomb = () => {
    const player = scene.player;
    if (!player || !player._bombCharging) return;

    const chargeFrame = player._bombChargeFrame;
    const direction = player._shootDirection;
    cancelBombCharge(player);

    const bomb = scene.bombs.get(player.x, player.y - 5, BOMB_CHARGE_FRAMES[chargeFrame]);
    if (!bomb) return;

    bomb.setActive(true);
    bomb.setVisible(true);
    bomb.body.enable = true;
    bomb.body.moves = true;
    bomb.body.allowGravity = true;
    bomb.setTexture(BOMB_CHARGE_FRAMES[chargeFrame]);
    // Sprites (18-19x21-23px) são maiores que 1 tile — encolhe um pouco o
    // visual e trava o collider em 16x16 (1 tile), sempre recalculado aqui
    // porque cada frame de carga tem um tamanho de textura diferente.
    bomb.setScale(0.9);
    bomb.body.setSize(16, 16);
    bomb.body.setOffset((bomb.width - 16) / 2, bomb.height - 16);
    bomb.setFlipX(direction === -1);
    bomb.owner = 'player';
    bomb.setDepth(scene.player.depth ?? MAP_DEPTHS.PLAYER);
    // Dano próprio (upgrade 'bombDamage' da loja), não o bulletDamage das
    // outras armas — ver game/config/upgrades.js e explodeBomb.
    bomb.damage = Math.max(1, Math.round(player.status.bombDamage));
    // Reseta o estado de uma explosão anterior deste mesmo objeto pooled
    // (ver explodeBomb) — sem isso, o timer/flag antigos vazariam pro novo
    // lançamento.
    bomb._tickTimer?.remove();
    bomb._tickTimer = null;
    bomb._armed = false;
    bomb._bounceCount = 0;

    const gravityY = scene.physics.world.gravity.y || 600;
    const launchVelocityY = -Math.sqrt(2 * gravityY * BOMB_RISE_PX);
    bomb.body.setVelocity(BOMB_THROW_SPEED * direction, launchVelocityY);

    spendEnergy(player, scene);
    emitEnergyHud(scene, player);
    scene.sound.play('bullet_effect_1');
  };

  const fire = () => {
    const player = scene.player;
    if (!player || player.isDead) return;

    // Ainda nascendo: não deixa atirar por cima da animação de spawn.
    if (player.isSpawning) return;

    // Habilidade "Bomba" (isPump): um toque rápido (solta antes de
    // PUMP_HOLD_THRESHOLD_MS) ainda dispara a arma equipada normalmente —
    // só segurar além disso entra no modo de carga (ver fireUp() abaixo,
    // que decide entre as duas coisas na hora de soltar).
    if (player.status.isPump) {
      if (player._bombCharging || player._pumpPending) return;
      player._pumpPending = true;
      player._pumpHoldTimer = scene.time.delayedCall(PUMP_HOLD_THRESHOLD_MS, () => {
        if (!player._pumpPending) return; // já foi solto como toque rápido
        player._pumpPending = false;
        startBombCharge(player);
      });
      return;
    }

    if (player.isShooting) return;
    dischargeWeapon(player);
  };

  // Dispara a arma atualmente equipada (ACCESSORY_UPGRADE_IDS): toca a
  // animação e spawna bullet/onda/bola de fogo no frame de gatilho (ver
  // playWeaponAnimation). Usada tanto no disparo normal (fire(), sem a
  // habilidade "isPump") quanto no toque rápido com "isPump" equipada (ver
  // fireUp() abaixo).
  const dischargeWeapon = (player) => {
    player._shootDirection = computeShootDirection(player);
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

  // Soltar o botão: com "isPump" equipada, decide entre toque rápido (tiro
  // normal, ver dischargeWeapon) e lançamento da bomba (releaseBomb),
  // conforme o botão já tiver passado ou não de PUMP_HOLD_THRESHOLD_MS
  // pressionado (ver fire()). Sem "isPump" não faz nada — o disparo normal
  // já saiu no pointerdown (fire()).
  const fireUp = () => {
    const player = scene.player;
    if (!player || !player.status.isPump) return;

    if (player._pumpPending) {
      player._pumpPending = false;
      player._pumpHoldTimer?.remove();
      player._pumpHoldTimer = null;
      if (!player.isDead && !player.isSpawning && !player.isShooting) {
        dischargeWeapon(player);
      }
      return;
    }

    releaseBomb();
  };

  scene.input.on('pointerdown', fire);
  scene.input.on('pointerup', fireUp);

  return {
    fire,
    fireUp,
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

        if (player._bombCharging) {
          // Morreu/saiu de cena segurando a bomba: cancela em vez de deixar
          // o sprite/timer vazando por cima do respawn (scene.restart()
          // reaproveita esta mesma instância — ver GameScene.create()).
          if (player.isDead) {
            cancelBombCharge(player);
          } else {
            player._bombChargeSprite?.setPosition(player.x, player.y - 10);
            player._bombChargeSprite?.setFlipX(player._shootDirection === -1);
          }
        }
        // Morreu durante a pequena janela de PUMP_HOLD_THRESHOLD_MS (ver
        // fire()), antes de decidir entre toque rápido e carga: cancela o
        // timer pendente pra não disparar nada por cima do respawn.
        if (player._pumpPending && player.isDead) {
          player._pumpPending = false;
          player._pumpHoldTimer?.remove();
          player._pumpHoldTimer = null;
        }
      }

      // for clássico em vez de [...a, ...b].forEach(...): evita recriar dois
      // arrays novos (spread) + a arrow function a cada frame (CLAUDE.md
      // regra 5) — mesmo cuidado já tomado em GameScene.update().
      const bulletList = scene.bullets.getChildren();
      for (let i = 0; i < bulletList.length; i += 1) {
        cleanupProjectile(scene, bulletList[i]);
      }

      // Rastro de partículas atrás da meia lua enquanto ela avança — feito
      // no mesmo loop da limpeza pra não iterar swordWaves duas vezes.
      const waveList = scene.swordWaves.getChildren();
      for (let i = 0; i < waveList.length; i += 1) {
        const wave = waveList[i];
        cleanupProjectile(scene, wave);
        if (wave?.active) emitSwordWaveTrail(scene, wave);
      }

      // Bola de fogo do Cajado: não usa maxRangePx (o collider com
      // scene.platforms acima já cuida do repique/destruição em paredes,
      // teto e quedas de mais de 1 tile) — aqui só cobre o caso que o
      // collider não vê: sair da tela sem nunca ter colidido com nada.
      const fireballList = scene.fireballs.getChildren();
      for (let i = 0; i < fireballList.length; i += 1) {
        const fireball = fireballList[i];
        if (!fireball?.active) continue;
        emitFireballTrail(scene, fireball);

        if (fireball.x > scene.scale.width || fireball.x < 0) {
          destroyProjectile(fireball);
        }
      }

      // Bomba ainda em voo/quicando (não armada): rastro de fumaça (ver
      // emitBombTrail) + a mesma checagem de "saiu da tela sem nunca tocar
      // o cenário" das outras armas — sem isso o collider com
      // scene.platforms nunca chega a armar o pavio (ver armBomb), e ela
      // ficaria voando pra sempre. Destrói silenciosamente nesse caso, sem
      // contar como "colidiu com algo" (sem explosão/efeito).
      const bombList = scene.bombs.getChildren();
      for (let i = 0; i < bombList.length; i += 1) {
        const bomb = bombList[i];
        if (!bomb?.active || bomb._armed) continue;
        emitBombTrail(scene, bomb);
        if (bomb.x > scene.scale.width || bomb.x < 0 || bomb.y > scene.scale.height) {
          destroyProjectile(bomb);
        }
      }
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

// Mesma checagem de alcance/borda vale pra bullet (arco/arma) e sword wave
// (espada) — só bullets de player e a wave têm maxRangePx setado.
// IMPORTANTE: checa as duas bordas da tela. Bullets de player sempre têm
// maxRangePx como rede de segurança, mas bullets de INIMIGO não (ver
// createBulletSystem/fireEnemy) — um inimigo virado pra esquerda
// (facingDirection -1) atira bullets com velocity.x negativo, e sem checar
// `x < 0` eles nunca eram destruídos, vazando um slot do pool compartilhado
// `scene.bullets` (maxSize: 10) até ele esgotar e travar os tiros de todo
// mundo (player incluso).
function cleanupProjectile(scene, projectile) {
  if (!projectile || !projectile.active) return;

  if (projectile.x > scene.scale.width || projectile.x < 0) {
    destroyProjectile(projectile);
    return;
  }

  if (projectile.maxRangePx
    && Math.abs(projectile.x - projectile.spawnX) >= projectile.maxRangePx) {
    // Fim de alcance sem acertar nada: some sem efeito/som — a explosão e
    // o dust trail só acontecem em colisão de verdade (ver colliders acima).
    destroyProjectile(projectile);
  }
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

// Bomba da habilidade "isPump" (ver ABILITY_UPGRADE_IDS em
// game/config/upgrades.js): chamado pelo collider com scene.platforms (ver
// createBulletSystem()) no primeiro toque dela no cenário — pode ter
// voado por cima de vários tiles antes disso. Trava a bomba no lugar
// (zera velocidade, desliga gravidade/movimento) e passa a tocar a
// animação de "chiado" (cicla BOMB_CHARGE_FRAMES em loop) até
// BOMB_FUSE_MS depois, quando explode (ver explodeBomb). Idempotente: bater
// de novo no cenário enquanto já armada (ex: escorregando) não reinicia o
// pavio nem duplica o timer.
function armBomb(scene, bomb) {
  if (!bomb.active || bomb._armed) return;
  bomb._armed = true;
  bomb.body.setVelocity(0, 0);
  bomb.body.allowGravity = false;
  bomb.body.moves = false;

  let tickFrame = 0;
  bomb._tickTimer = scene.time.addEvent({
    delay: BOMB_TICK_FRAME_MS,
    loop: true,
    callback: () => {
      if (!bomb.active) return;
      tickFrame = (tickFrame + 1) % BOMB_CHARGE_FRAMES.length;
      bomb.setTexture(BOMB_CHARGE_FRAMES[tickFrame]);
    },
  });

  scene.time.delayedCall(BOMB_FUSE_MS, () => explodeBomb(scene, bomb));
}

// Dano em área: qualquer inimigo vivo dentro de BOMB_EXPLOSION_RADIUS_PX do
// centro da bomba recebe bomb.damage, sem knockback (bulletDirection 0 — a
// explosão não empurra o inimigo pro lado, diferente do dano de
// bullet/onda/bola de fogo).
function explodeBomb(scene, bomb) {
  if (!bomb.active) return;
  const x = bomb.x;
  const y = bomb.y;

  bomb._tickTimer?.remove();
  bomb._tickTimer = null;
  bomb._armed = false;
  destroyProjectile(bomb);

  const enemyList = scene.enemies?.getChildren() || [];
  for (let i = 0; i < enemyList.length; i += 1) {
    const enemy = enemyList[i];
    if (!enemy?.active || enemy.isDead) continue;
    const distance = Math.hypot(enemy.body.center.x - x, enemy.body.center.y - y);
    if (distance <= BOMB_EXPLOSION_RADIUS_PX) {
      damageEnemy(enemy, bomb.damage, 0);
    }
  }

  emitBombExplosion(scene, x, y, BOMB_EXPLOSION_RADIUS_PX);
  scene.sound.play('tap');
}
