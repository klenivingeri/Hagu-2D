import Phaser from 'phaser';
import './styles/main.css';
import { gameConfig } from './game/config/gameConfig.js';
import { BindHudEvents } from './components/ui/Hud.js';

const game = new Phaser.Game(gameConfig);
BindHudEvents(game);
