import Phaser from 'phaser';
import './styles/main.css';
import { gameConfig } from './game/config/gameConfig.js';
import { BindHudEvents } from './components/ui/Hud.js';
import { ShowLoadingScreen, HideLoadingScreen, BindLoadingEvents } from './screens/LoadingScreen.js';
import { ShowWelcomeScreen, HideWelcomeScreen } from './screens/WelcomeScreen.js';
import { loadPersistedState } from './managers/GameManager.js';

// O Phaser só é instanciado quando a partida realmente começa (CLAUDE.md
// regra 4), então o canvas e os controles ficam escondidos (via CSS, já no
// HTML inicial, evitando o flash da tela de jogo) enquanto a tela de
// Welcome está ativa.
const gameLayout = document.querySelector('.game-layout');

function startMatch() {
  HideWelcomeScreen();
  if (gameLayout) gameLayout.classList.add('is-active');
  ShowLoadingScreen();

  const game = new Phaser.Game(gameConfig);
  BindHudEvents(game);
  BindLoadingEvents(game);
}

// Boot inicial: loading primeiro (aqui entra qualquer leitura de dado
// persistido — StorageService/futuro banco local), só depois a Welcome.
ShowLoadingScreen();
loadPersistedState().finally(() => {
  HideLoadingScreen();
  ShowWelcomeScreen({ onPlay: startMatch });
});
