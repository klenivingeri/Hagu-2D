import Phaser from 'phaser';
import './styles/main.css';
import { gameConfig } from './game/config/gameConfig.js';
import { GameScene } from './game/scenes/GameScene.js';
import { RUN_EVENTS } from './constants.js';
import { BindHudEvents } from './components/ui/Hud.js';
import { ShowLoadingScreen, HideLoadingScreen, BindLoadingEvents } from './screens/LoadingScreen.js';
import { ShowWelcomeScreen, HideWelcomeScreen } from './screens/WelcomeScreen.js';
import { ShowRunSummaryScreen, HideRunSummaryScreen } from './screens/RunSummaryScreen.js';
import { BindPauseEvents, HidePauseScreen } from './screens/PauseScreen.js';
import { BindSettingsEvents, HideSettingsScreen } from './screens/SettingsScreen.js';
import { BindGameOverEvents, HideGameOverScreen } from './screens/GameOverScreen.js';
import { loadPersistedState, gameState } from './managers/GameManager.js';
import { RegisterServiceWorker } from './services/registerServiceWorker.js';
import { startViewportSync } from './services/ViewportService.js';
import { initStatusBar } from './services/StatusBarService.js';
import {
  initCrazyGamesSdk,
  notifyLoadingStart,
  notifyLoadingStop,
  notifyGameplayStart,
  BindCrazyGamesEvents,
} from './services/CrazyGamesService.js';
import { initAdMob } from './services/AdMobService.js';

// Precisa rodar antes de qualquer tela ser mostrada: as unidades --app-vw/
// --app-vh (ver ViewportService.js) substituem vw/dvh no CSS pra evitar o
// gap ao girar a tela (ver main.css).
startViewportSync();
initStatusBar();

// O Phaser só é instanciado quando a partida realmente começa (CLAUDE.md
// regra 4), então o canvas e os controles ficam escondidos (via CSS, já no
// HTML inicial, evitando o flash da tela de jogo) enquanto a tela de
// Welcome está ativa.
const gameLayout = document.querySelector('.game-layout');
let activeGame = null;

// Zoom 3x troca pro layout de HUD/controles flutuantes sobre o canvas cheio
// (ver .game-layout.zoom-3x em main.css) — chamado no início da partida e de
// novo se o player mudar o zoom em Configurações com a Run em andamento
// (SettingsScreen.js/onCameraZoomChange), pra não precisar reabrir a fase.
function applyZoomLayout(zoom) {
  gameLayout?.classList.toggle('zoom-3x', zoom === 3);
}

// Skin visual do D-pad/ações/SELECT-START (aba "Botões" em Configurações,
// ver WelcomeScreen.js/SettingsScreen.js/main.css "TEMAS DE BOTÕES").
// Escopado em #app (não em .game-layout) porque os modais de Configurações
// ficam fora de .game-layout no DOM. Chamado aqui uma vez no boot pra os
// controles já nascerem com o tema salvo, antes de qualquer modal abrir —
// depois disso, cada tela de Configurações reaplica sozinha ao trocar o
// tema (não passa por main.js, é puramente CSS/DOM, sem nada do Phaser
// envolvido).
function applyControlsTheme(theme) {
  document.getElementById('app')?.setAttribute('data-controls-theme', theme);
}

function startMatch(mapKey) {
  HideWelcomeScreen();
  if (gameLayout) gameLayout.classList.add('is-active');
  applyZoomLayout(gameState.settings.cameraZoom);
  notifyLoadingStart();
  ShowLoadingScreen('Criando mapa...');

  const game = new Phaser.Game(gameConfig);
  activeGame = game;
  window.__debugGame = game;
  BindHudEvents(game);
  BindLoadingEvents(game);
  BindCrazyGamesEvents(game);
  BindPauseEvents(game, {
    onResume: () => {
      HidePauseScreen();
      game.scene.resume('GameScene');
      notifyGameplayStart();
    },
    onBackToMap: () => {
      HidePauseScreen();
      backToWelcome();
    },
  });
  BindSettingsEvents(game, {
    onClose: () => {
      HideSettingsScreen();
      game.scene.resume('GameScene');
      notifyGameplayStart();
    },
    onCameraZoomChange: (zoom) => {
      // Precisa trocar o layout ANTES de mexer na câmera/scale mode do
      // Phaser: applyCameraZoom->applyScaleModeForZoom lê o tamanho atual do
      // .game-screen pra recalcular o canvas, e se isso rodar com a classe
      // zoom-3x ainda não aplicada ele mede o container quadrado antigo,
      // deixando o canvas gigante e descentralizado.
      applyZoomLayout(zoom);
      game.scene.getScene('GameScene')?.applyCameraZoom(zoom);
    },
    onVisualFilterChange: () => {
      game.scene.getScene('GameScene')?.refreshVisualFilters();
    },
  });
  BindGameOverEvents(game, {
    // "Tentar novamente": tentativas só resetam num Phaser.Game novo (ver
    // GameScene constructor/MAX_RUN_ATTEMPTS), então precisa destruir este
    // e começar outro do zero, igual à Welcome mandando pra mesma fase.
    onRetry: () => {
      HideGameOverScreen();
      activeGame?.destroy(true);
      activeGame = null;
      startMatch(mapKey);
    },
    onBackToMap: backToWelcome,
  });
  // gameConfig não lista nenhuma cena (ver game/config/gameConfig.js) — é
  // aqui que a GameScene sobe pela primeira vez, já com a fase escolhida no
  // grid de mapas da Welcome (ver WelcomeScreen.js).
  game.scene.add('GameScene', GameScene, true, { mapKey });

  // Disparado por GameScene.completeRun() quando o player passa por um
  // portal que encerra a fase (ver constants.js). O Phaser só emite os
  // dados; quem decide o que mostrar é a tela de HTML (CLAUDE.md regra 1).
  game.events.once(RUN_EVENTS.COMPLETE, (summary) => {
    ShowRunSummaryScreen({ ...summary, onBack: backToWelcome });
  });
}

// Ciclo de vida do Phaser (CLAUDE.md regra 4): destrói o Game e some com o
// canvas assim que o player volta pros menus, evitando vazamento de memória
// entre runs.
function backToWelcome() {
  HideRunSummaryScreen();
  HideGameOverScreen();
  activeGame?.destroy(true);
  activeGame = null;
  if (gameLayout) {
    gameLayout.classList.remove('is-active');
    gameLayout.classList.remove('zoom-3x');
  }
  ShowWelcomeScreen({ onPlay: startMatch });
}

// Pausa automaticamente a Run quando o app vai pra segundo plano (CLAUDE.md,
// arquitetura multiplataforma item 2) — essencial em WebViews Android/iOS,
// que não pausam JS/áudio sozinhas ao minimizar, e é o mesmo sinal que a
// CrazyGames usa pra decidir se o jogo ainda está "gameplay ativo". Só
// resume quem foi pausado por ESTA função (pausedByVisibility) — nunca
// reabre a Run por baixo de um modal de pausa/configurações/game over já
// aberto pelo próprio player.
let pausedByVisibility = false;

function handleVisibilityChange() {
  const scene = activeGame?.scene.getScene('GameScene');
  if (!scene) return;

  if (document.hidden) {
    if (activeGame.scene.isPaused('GameScene')) return;
    pausedByVisibility = true;
    scene.scene.pause();
    return;
  }

  if (!pausedByVisibility) return;
  pausedByVisibility = false;
  scene.scene.resume();
  notifyGameplayStart();
}

document.addEventListener('visibilitychange', handleVisibilityChange);

RegisterServiceWorker();

// Boot inicial: loading primeiro (aqui entra qualquer leitura de dado
// persistido — StorageService/futuro banco local — e a inicialização do SDK
// da CrazyGames), só depois a Welcome.
notifyLoadingStart();
ShowLoadingScreen('Carregando jogo...', 'player');
Promise.all([initCrazyGamesSdk(), initAdMob(), loadPersistedState()]).finally(() => {
  applyControlsTheme(gameState.settings.controlsTheme);
  HideLoadingScreen();
  notifyLoadingStop();
  ShowWelcomeScreen({ onPlay: startMatch });
});
