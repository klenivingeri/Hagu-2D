import Phaser from 'phaser';
import { MAPS, DEFAULT_MAP_KEY, DEFAULT_STAR_TIME_LIMIT_MS } from '../config/maps.js';
import { HUD_EVENTS, LOADING_EVENTS, RUN_EVENTS, PAUSE_EVENTS, SETTINGS_EVENTS, MAX_RUN_ATTEMPTS } from '../../constants.js';
import { gameState, unlockMap, recordMapStars, recordEnemyDefeat, unlockEnemySprite, addGlobalCoins, addGlobalDiamant } from '../../managers/GameManager.js';
import { createPlayer, preloadPlayerAssets, createPlayerAnimations, setupPlayerDamage, damagePlayer } from '../systems/create/createPlayer.js';
import { createEnemys, preloadEnemyAssets, createEnemyAnimations } from '../systems/create/createEnemy.js';
import { createControls } from '../systems/create/createControls.js';
import { createWorld } from '../systems/create/createWorld.js';
import { applyMobileFooter } from '../systems/create/createMobileFooter.js';

import { createBulletSystem } from '../systems/create/createBulletSystem.js';
import { updatePlayerMovement } from '../systems/upgrade/updatePlayerMovement.js'
import { updateEnemyMovement } from '../systems/upgrade/updateEnemyMovement.js'
import { createRails } from '../systems/create/createRails.js';
import { updateRailMovement } from '../systems/upgrade/updateRailMovement.js';
import { preloadCoinAssets, createCoinAnimations, createCoins } from '../systems/create/createCoins.js';
import { preloadDiamantAssets, createDiamantAnimations, createDiamants } from '../systems/create/createDiamants.js';
import { createSpriteDropGroup } from '../systems/create/createSpriteDrops.js';
import { preloadGoldBagAssets, createGoldBagDropGroup } from '../systems/create/createGoldBagDrops.js';
import { createLifes } from '../systems/create/createLifes.js';
import { updateGroundFakeVisibility } from '../systems/upgrade/updateGroundFakeVisibility.js';
import { preloadDustTexture, preloadSwordWaveTexture, preloadFireballTexture } from '../commons/dustTrail.js';
import { preloadPortalAssets, createPortalAnimations, createPortals } from '../systems/create/createPortals.js';
import { createGates } from '../systems/create/createGates.js';

// A opção "3x" em Configurações só escolhe o LAYOUT tela-cheia (ver
// .game-layout.zoom-3x/applyScaleModeForZoom) — o zoom de câmera real fica
// bem menor que 3: como o canvas nesse modo passa a ocupar a tela toda no
// formato real do aparelho (RESIZE, ver applyScaleModeForZoom), um zoom
// literal 3 deixaria a visão exageradamente grande.
// Esse valor é só o PISO do zoom: toda fase (ver createWorld.js/map.widthInPixels)
// tem exatamente 448x448, o mesmo tamanho da resolução lógica base — então em
// paisagem (tela bem mais larga que alta) 1.6 sozinho deixa a câmera menor
// que a tela, sobrando fundo vazio nas laterais porque o mapa não tem mais
// conteúdo pra mostrar ali. getEffectiveCameraZoom soma um zoom mínimo
// calculado a partir do viewport real (só disponível DEPOIS do RESIZE, ver
// applyScaleModeForZoom) pra garantir que a câmera cubra tela inteira nos
// dois eixos, não só o mais curto.
const FULLSCREEN_CAMERA_ZOOM = 1.6;

function getEffectiveCameraZoom(zoomSetting, scene) {
  if (zoomSetting !== 3) return zoomSetting;

  const { width: viewportWidth, height: viewportHeight } = scene.scale.gameSize;
  const { widthInPixels: mapWidth, heightInPixels: mapHeight } = scene.map;
  const zoomToCoverWidth = viewportWidth / mapWidth;
  const zoomToCoverHeight = viewportHeight / mapHeight;

  return Math.max(FULLSCREEN_CAMERA_ZOOM, zoomToCoverWidth, zoomToCoverHeight);
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    // Definido no construtor (roda só UMA vez por Phaser.Game, mesmo que
    // scene.restart() reaproveite esta instância a cada respawn — ver
    // createPlayer.killPlayer()) pra sobreviver aos respawns dentro da
    // mesma partida e só voltar a valer MAX_RUN_ATTEMPTS quando o player
    // realmente começar uma partida nova (novo Phaser.Game, ver main.js).
    this.attemptsLeft = MAX_RUN_ATTEMPTS;
  }

  init(data = {}) {
    this.mapKey = MAPS[data.mapKey] ? data.mapKey : DEFAULT_MAP_KEY;
    this.mapConfig = MAPS[this.mapKey];
    // Key própria por mapa: cada .tmj precisa do seu slot no cache do Phaser,
    // senão trocar de mapa (scene.restart) reaproveitaria o JSON do mapa
    // anterior em vez de recarregar o novo.
    this.tilemapCacheKey = `tilemap_${this.mapKey}`;
  }

  preload() {
    this.load.image(this.mapConfig.tilesetImageKey, this.mapConfig.tilesetImageUrl);
    this.load.image('background_tileset_image', 'assets/tiledmap/world_tileset_background.png');
    this.load.image('platforms_image', 'assets/tiledmap/platforms.png');
    this.load.image('world_tileset_shadow_16_image', 'assets/tiledmap/world_tileset_shadow_16.png');
    this.load.image('world_tileset_shadow_32_image', 'assets/tiledmap/world_tileset_shadow_32.png');
    this.load.image('world_tileset_32_image', 'assets/tiledmap/world_tileset_32.png');
    this.load.tilemapTiledJSON(this.tilemapCacheKey, this.mapConfig.tilemapUrl);

    // O mapa precisa carregar primeiro para descobrirmos quais mobs existem.
    // O Phaser aceita novos arquivos enquanto o loader ainda está processando.
    this.load.once(`filecomplete-tilemapJSON-${this.tilemapCacheKey}`, (_key, _type, mapData) => {
      this.enemyDefinitions = getEnemyDefinitionsFromMap(mapData);
      this.enemyAssetKeys = this.enemyDefinitions.map(({ key }) => key);
      preloadEnemyAssets(this, this.enemyDefinitions);
      if (mapData?.layers?.some((layer) => layer.name === 'portal')) {
        preloadPortalAssets(this);
      }
    });

    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
    // Habilidade "Bomba" (isPump, ver ABILITY_UPGRADE_IDS em
    // game/config/upgrades.js): 4 sprites crescentes usados tanto na
    // animação de carga (segurar o botão) quanto no visual da bomba lançada
    // (ver createBulletSystem.js).
    this.load.image('bomb_charge_0', 'assets/bullet/pump/01.png');
    this.load.image('bomb_charge_1', 'assets/bullet/pump/02.png');
    this.load.image('bomb_charge_2', 'assets/bullet/pump/03.png');
    this.load.image('bomb_charge_3', 'assets/bullet/pump/04.png');
    this.load.audio('bullet_effect_1', 'assets/sounds/bullet_effect_6.mp3');
    // Som do tiro do Arco (ver ACCESSORY_UPGRADE_IDS em game/config/upgrades.js
    // e BOW_WEAPON_ID em createBulletSystem.js) — cada arma tem o próprio som.
    this.load.audio('bullet_effect_bow', 'assets/sounds/bullet_effect_7.mp3');
    // Som do golpe da Espada (ver WEAPONS_CONFIG.sword em game/config/weapons.js).
    this.load.audio('sword_swing', 'assets/sounds/sword-sound.mp3');
    // Som de impacto do Arco (a flecha "explode" ao colidir, ver
    // WEAPONS_CONFIG.bowWeapon.impactSoundKey em game/config/weapons.js).
    this.load.audio('bow_arrow_explosion', 'assets/sounds/bow-arrow-explosion.mp3');
    this.load.audio('dry_fire_1', 'assets/sounds/dry_fire_1.mp3');
    this.load.audio('coin', 'assets/sounds/coin.wav');
    this.load.audio('jump', 'assets/sounds/jump.wav');
    this.load.audio('tap', 'assets/sounds/tap.wav');

    preloadPlayerAssets(this)
    preloadCoinAssets(this)
    preloadDiamantAssets(this)
    preloadGoldBagAssets(this)

    // Log de qualquer asset que falhar ao carregar (ajuda a depurar caminhos errados)
    this.load.on('loaderror', (file) => {
      console.error('[Phaser] Falha ao carregar asset:', file.key, file.src);
    });

    // Progresso da tela de loading em HTML (ver /src/screens/LoadingScreen.js).
    this.load.on('progress', (value) => {
      this.game.events.emit(LOADING_EVENTS.PROGRESS, value);
    });
  }

  create() {
    // scene.restart() (respawn via killPlayer) REAPROVEITA esta mesma
    // instância de GameScene — não cria
    // uma nova. Qualquer propriedade que não seja reatribuída aqui em
    // create() sobrevive de um mapa pro outro como "vestígio". runCompleted
    // é a única flag que create() não recria do zero (tudo mais já é
    // reatribuído por createWorld/createPlayer/createPortals/etc. abaixo),
    // então ela precisa ser resetada explicitamente.
    this.runCompleted = false;
    // A faixa preta do modo Mobile (ver createMobileFooter.js) é um
    // GameObject normal — some sozinha quando scene.restart() (respawn)
    // recria a cena, mas a referência em si sobreviveria "fantasma" na
    // instância reaproveitada se não for zerada aqui.
    this.mobileFooter = null;

    // Estado da run atual, usado só pro resumo em RunSummaryScreen.js
    // (tempo de fase, dano recebido, monstros derrotados). Reatribuído do
    // zero aqui pelo mesmo motivo do runCompleted acima: create() reaproveita
    // a instância em scene.restart().
    this.runStartTime = this.time.now;
    this.runDamageTaken = false;
    this.enemyKills = new Map();
    // Espécies cujo item de sprite (ver createSpriteDrops.js) foi pego nesta
    // run — alimenta o resumo em RunSummaryScreen.js, mesma ideia do
    // enemyKills acima.
    this.collectedSprites = new Map();

    // Gera a textura de 2x2px da poeira uma única vez, antes de qualquer
    // emitDustTrail/emitBulletImpactDust ser chamado.
    preloadDustTexture(this);
    // Gera a textura da meia lua da Espada (ver createBulletSystem.js).
    preloadSwordWaveTexture(this);
    // Gera a textura da bola de fogo do Cajado (ver createBulletSystem.js).
    preloadFireballTexture(this);

    createWorld(this);

    // Cada fase (ver createWorld.js) tem exatamente o tamanho da resolução
    // lógica do jogo (448x448 — ver gameConfig.js), então zoom 1 (default)
    // mostra o mapa inteiro parado, sem follow. Zoom 2 (Configurações, ver
    // WelcomeScreen.js) mostra só 1/4 da fase, e a câmera passa a seguir o
    // player em vez de ficar estática enquadrando tudo.
    const cameraZoom = gameState.settings.cameraZoom || 1;
    // Só no modo Mobile (zoom 3x): estende os bounds da câmera com uma
    // faixa preta abaixo do mapa real, pra "descolar" a última linha
    // jogável de baixo dos controles flutuantes (ver createMobileFooter.js
    // e .game-layout.zoom-3x .controls-panel em main.css). Precisa rodar
    // logo após createWorld (usa scene.map/scene.cameras.main) e antes do
    // setZoom/centerOn abaixo, pra já nascer com os bounds corretos.
    applyMobileFooter(this, cameraZoom === 3);

    createControls(this);

    createPlayerAnimations(this);
    this.player = createPlayer(this);

    // Precisa rodar ANTES do setZoom/centerOn: no zoom 3x ela troca o canvas
    // pra RESIZE, o que muda o tamanho da área visível da câmera pro formato
    // real da tela — getEffectiveCameraZoom lê esse tamanho (scene.scale.
    // gameSize) pra calcular o zoom mínimo que cobre a tela toda, então
    // precisa do RESIZE já aplicado. Centralizar antes disso usa o viewport
    // antigo (FIT) e a câmera nasce enquadrada errada assim que o resize
    // entra em vigor.
    this.applyScaleModeForZoom(cameraZoom);
    this.cameras.main.setZoom(getEffectiveCameraZoom(cameraZoom, this));
    if (cameraZoom > 1) {
      // lerp < 1 faz a câmera "atrasar" atrás do player em vez de grudar
      // nele a cada frame (comportamento seco/instantâneo do default 1).
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      // Sem isso a câmera nasce enquadrando o canto (0,0) do mapa e só
      // alcança o player depois de vários frames de lerp — startFollow não
      // faz esse snap inicial sozinho.
      this.cameras.main.centerOn(this.player.x, this.player.y);
    } else {
      this.cameras.main.stopFollow();
    }

    this.game.events.emit(HUD_EVENTS.RESET, {
      initialCoins: this.player.levelCoins,
      initialDiamonds: this.player.levelDiamants,
      // attemptsLeft NÃO é resetado aqui (ver constructor) — precisa
      // continuar refletindo o valor real mesmo depois de um respawn
      // (scene.restart chama create() de novo, mas não o constructor).
      attemptsLeft: this.attemptsLeft,
      maxAttempts: MAX_RUN_ATTEMPTS,
    });
    this.game.events.emit(HUD_EVENTS.HEALTH_CHANGED, this.player.status.life, gameState.maxlife);
    this.game.events.emit(HUD_EVENTS.ENERGY_CHANGED, this.player.status.currentEnergy, this.player.status.maxEnergy);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 10 });
    // Efeito de "meia lua" do acessório Espada (ver ACCESSORY_UPGRADE_IDS em
    // game/config/upgrades.js) — grupo próprio porque não usa munição da
    // aljava nem a textura genérica 'bullet' (ver createBulletSystem.js).
    this.swordWaves = this.physics.add.group({ maxSize: 4 });
    // Bola de fogo do Cajado (ver ACCESSORY_UPGRADE_IDS em
    // game/config/upgrades.js) — grupo próprio porque, ao contrário de
    // bullets/swordWaves, tem gravidade ligada e quica nas plataformas (ver
    // createBulletSystem.js).
    this.fireballs = this.physics.add.group({ maxSize: 4 });
    // Bomba da habilidade "isPump" (ver ABILITY_UPGRADE_IDS em
    // game/config/upgrades.js) — sem corpo físico ativo em voo (o trajeto é
    // feito por tween em createBulletSystem.js, não por velocidade/gravidade
    // do Arcade Physics), só usa o grupo pra pooling.
    this.bombs = this.physics.add.group({ maxSize: 2 });
    this.bulletSystem = createBulletSystem(this);
    this.damagePlayer = (damage) => damagePlayer(this, damage);

    createDiamantAnimations(this);
    createDiamants(this);
    createSpriteDropGroup(this);
    createGoldBagDropGroup(this);
    createLifes(this);

    createEnemyAnimations(this)
    this.enemies = createEnemys(this);
    this.rails = createRails(this)

    if (this.portalLayer) {
      createPortalAnimations(this);
      this.portals = createPortals(this, this.portalLayer);
    } else {
      this.portals = [];
    }
    this.portals.filter((portal) => portal.unlockMapKey).forEach((portal) => {
      this.physics.add.overlap(this.player, portal, () => this.completeRun(portal.unlockMapKey));
    });

    window.__debugScene = this;
    createCoinAnimations(this);
    this.coins = createCoins(this);

    setupPlayerDamage(this, this.player, this.enemies);
    this.gates = createGates(this);

    // Fase montada: esconde a tela de loading em HTML (ver
    // /src/screens/LoadingScreen.js).
    this.game.events.emit(LOADING_EVENTS.COMPLETE);
  }

  update() {
    updatePlayerMovement(this)
    updateGroundFakeVisibility(this);

    // for clássico em vez de getChildren().forEach(...): evita recriar uma
    // arrow function nova a cada chamada de update() (60x/segundo).
    if (this.enemies) {
      const enemyList = this.enemies.getChildren();
      for (let i = 0; i < enemyList.length; i += 1) {
        updateEnemyMovement(this, enemyList[i]);
      }
    }
    if (this.rails) {
      const railList = this.rails.getChildren();
      for (let i = 0; i < railList.length; i += 1) {
        updateRailMovement(this, railList[i]);
      }
    }
    this.bulletSystem.update();
  }

  // Chamado quando o player encosta num portal com "key" (ver
  // createPortals.js). Libera o mapa correspondente, pausa a "Run" e delega
  // a exibição do resumo pra tela de HTML (ver RunSummaryScreen.js) — o
  // Phaser só emite o evento, nunca mexe em DOM (CLAUDE.md regra 1).
  completeRun(unlockMapKey) {
    if (this.runCompleted) return;
    this.runCompleted = true;

    unlockMap(unlockMapKey);
    this.scene.pause();

    const timeMs = this.time.now - this.runStartTime;
    const totalMonsters = (this.enemyDefinitions || []).length;
    const monsterKills = Array.from(this.enemyKills.values());
    const totalMonstersKilled = monsterKills.reduce((sum, entry) => sum + entry.count, 0);
    const totalDiamants = this.totalDiamants || 0;

    // Critérios de 3 estrelas (ver ShowRunSummaryScreen): derrotou todo
    // mundo, coletou 100% dos diamantes da layer, não levou dano e terminou
    // dentro do tempo-alvo do mapa. Mapa sem inimigo/diamante nenhum não
    // pode travar o critério em falso — conta como "cumprido".
    const allMonstersDefeated = totalMonsters === 0 || totalMonstersKilled >= totalMonsters;
    const allDiamantsCollected = totalDiamants === 0 || (this.player.levelDiamants || 0) >= totalDiamants;
    const noDamageTaken = !this.runDamageTaken;
    const timeLimitMs = this.mapConfig.starTimeLimitMs || DEFAULT_STAR_TIME_LIMIT_MS;
    const withinTimeLimit = timeMs <= timeLimitMs;
    const stars = computeStars({ allMonstersDefeated, allDiamantsCollected, noDamageTaken, withinTimeLimit });
    // Registra no mapa que ACABOU de ser jogado (this.mapKey), não no que a
    // gate liberou (unlockMapKey) — são fases diferentes.
    recordMapStars(this.mapKey, stars);

    // Só agora, com a run efetivamente concluída (chegou no portal e vai
    // pra tela de pós-jogo), tudo é persistido de verdade — Coleção (ver
    // EnemyBase.killEnemy()/createSpriteDrops.js) e moedas/diamantes (ver
    // createCoins.js/createDiamants.js/createGoldBagDrops.js), que durante a
    // run só acumulam em campos locais (scene.enemyKills/collectedSprites,
    // player.levelCoins/levelDiamants). Morrer ou sair no meio da run nunca
    // chama completeRun(), então nunca commita nada disso.
    monsterKills.forEach(({ key, path, behavior, count }) => {
      recordEnemyDefeat({ key, path, behavior, count });
    });
    this.collectedSprites.forEach(({ key, path, behavior }) => {
      unlockEnemySprite({ key, path, behavior });
    });
    addGlobalCoins(this.player.levelCoins || 0);
    addGlobalDiamant(this.player.levelDiamants || 0);

    this.game.events.emit(RUN_EVENTS.COMPLETE, {
      mapKey: this.mapKey,
      unlockedMapKey: unlockMapKey,
      coins: this.player.levelCoins,
      diamonds: this.player.levelDiamants,
      diamondsTotal: totalDiamants,
      exp: this.player.levelExp || 0,
      timeMs,
      monsterKills,
      collectedSprites: Array.from(this.collectedSprites.values()),
      totalMonsters,
      totalMonstersKilled,
      stars,
    });
  }

  // Chamado pelos botões START/SELECT (ver createControls.js). Pausa a
  // "Run" e delega a exibição do modal de pausa pra tela de HTML (ver
  // PauseScreen.js) — o Phaser só emite o evento, nunca mexe em DOM
  // (CLAUDE.md regra 1).
  openPauseMenu() {
    if (this.scene.isPaused()) return;

    this.scene.pause();
    this.game.events.emit(PAUSE_EVENTS.OPEN, { mapKey: this.mapKey });
  }

  // Chamado pelo botão SELECT (ver createControls.js). Pausa a "Run" e
  // delega a exibição do modal de configurações (som/vibração/daltonismo/
  // câmera) pra tela de HTML (ver SettingsScreen.js).
  openSettingsMenu() {
    if (this.scene.isPaused()) return;

    this.scene.pause();
    this.game.events.emit(SETTINGS_EVENTS.OPEN, { mapKey: this.mapKey });
  }

  // Chamado pelo SettingsScreen (ver main.js) quando o player muda o zoom da
  // câmera com a Run em andamento — sem isso, a escolha só valeria a partir
  // da próxima partida (ver create(), que só lê gameState.settings.cameraZoom
  // uma vez).
  applyCameraZoom(zoom) {
    // Mesma ordem de create(): RESIZE precisa estar aplicado ANTES de
    // getEffectiveCameraZoom ler scene.scale.gameSize, senão calcularia o
    // zoom mínimo de tela cheia em cima do tamanho antigo (FIT).
    this.applyScaleModeForZoom(zoom);
    this.cameras.main.setZoom(getEffectiveCameraZoom(zoom, this));
    // Liga/desliga a faixa preta do rodapé (ver createMobileFooter.js) se o
    // player trocar entre Game Boy e Mobile com a run em andamento.
    applyMobileFooter(this, zoom === 3);
    if (zoom > 1) {
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.centerOn(this.player.x, this.player.y);
    } else {
      this.cameras.main.stopFollow();
    }
  }

  // FIT (default) letterboxa dentro do parent pra nunca cortar o mapa —
  // essencial no zoom 1/2, onde a área visível da fase importa pro
  // gameplay. No zoom 3x o canvas vira tela cheia (.game-layout.zoom-3x, ver
  // main.css); usamos RESIZE em vez de ENVELOP porque a câmera (setBounds em
  // createWorld.js) é sempre um quadrado 448x448, e ENVELOP escala esse
  // quadrado até cobrir a tela cortando o eixo que sobra (retrato corta
  // esquerda/direita, paisagem corta cima/baixo) — como o corte é sempre em
  // torno do CENTRO do canvas, e não do player, ele "engole" a câmera
  // sempre que o player está perto de uma borda do mapa (ver relato: câmera
  // "no meio" com o player embaixo/nas laterais). RESIZE faz o canvas
  // assumir o formato real da tela (sem cortar nada) e o zoom passa a
  // mostrar mais mapa no eixo mais comprido, em vez de esconder pedaço dele.
  applyScaleModeForZoom(zoom) {
    const scale = this.scale;
    const mode = zoom === 3 ? Phaser.Scale.RESIZE : Phaser.Scale.FIT;
    if (scale.scaleMode === mode) return;
    const leavingResize = scale.scaleMode === Phaser.Scale.RESIZE;
    scale.scaleMode = mode;
    // Size (a classe por trás de displaySize) só reconhece aspectMode 0-4
    // (NONE/WIDTH_CONTROLS_HEIGHT/HEIGHT_CONTROLS_WIDTH/FIT/ENVELOP) — não
    // existe um case pra RESIZE (5) no switch dela, então setAspectMode(5)
    // vira um no-op silencioso e o displaySize FICA TRAVADO no último
    // tamanho quadrado calculado pelo FIT anterior. RESIZE não usa aspecto
    // nenhum (o canvas assume width/height do parent direto), então o modo
    // certo aqui é NONE.
    scale.displaySize.setAspectMode(mode === Phaser.Scale.RESIZE ? Phaser.Scale.NONE : mode);
    if (leavingResize) {
      // RESIZE reescreveu gameSize/baseSize pro tamanho real da tela cheia
      // anterior. setGameSize restaura a resolução lógica 448x448 (a mesma
      // do mapa) antes do FIT recalcular o letterbox do zoom 1/2 — senão o
      // FIT letterboxaria com a proporção errada (a da tela, não a do mapa).
      scale.setGameSize(448, 448);
      return;
    }
    // updateScale() do Phaser (ScaleManager) só escreve canvas.style.width/
    // height explicitamente nos modos FIT/NONE/EXPAND — no RESIZE ela mexe
    // só nos atributos canvas.width/height (resolução interna) e deixa o
    // style inline como estava. Sem isso o canvas herda o style em px que o
    // FIT anterior deixou (o quadrado pequeno do zoom 1/2) e o
    // getBoundingClientRect() usado por updateCenter() também lê esse
    // tamanho errado — resultado: canvas travado no tamanho antigo, boiando
    // no meio da tela em vez de ocupá-la inteira. Limpar aqui deixa o
    // atributo width/height (que RESIZE define certo) mandar no tamanho
    // renderizado, como um canvas HTML normal sem style explícito.
    scale.canvas.style.width = '';
    scale.canvas.style.height = '';
    // refresh() calcula o novo tamanho a partir do parentSize já conhecido,
    // que só é atualizado no FIM do próprio refresh — sem reler o
    // .game-screen aqui antes, ele usaria as medidas de antes da troca de
    // layout (main.js já trocou a classe zoom-3x, mas o Scale Manager ainda
    // não sabe), deixando o canvas com tamanho/centralização errados.
    scale.getParentBounds();
    scale.refresh();
  }
}

// 3 estrelas exige TUDO: todos os monstros mortos, todos os diamantes da
// layer coletados, zero dano recebido e dentro do tempo-alvo do mapa.
// 2 estrelas é uma versão mais branda (só limpou a fase: monstros +
// diamantes). Qualquer outra combinação vale 1 estrela (só completou).
function computeStars({ allMonstersDefeated, allDiamantsCollected, noDamageTaken, withinTimeLimit }) {
  if (allMonstersDefeated && allDiamantsCollected && noDamageTaken && withinTimeLimit) return 3;
  if (allMonstersDefeated && allDiamantsCollected) return 2;
  return 1;
}

function getEnemyDefinitionsFromMap(mapData) {
  const enemyLayer = mapData?.layers?.find((layer) => layer.name === 'enemy');
  return enemyLayer?.objects?.map((object) => {
    const property = object.properties?.find(({ name }) => name === 'key');
    const type = object.properties?.find(({ name }) => name === 'type');
    const path = object.properties?.find(({ name }) => name === 'path');
    return property?.value
      ? { key: property.value, path: path?.value, type: type?.value }
      : null;
  }).filter(Boolean) || [];
}
