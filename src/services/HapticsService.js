// Camada de vibração desacoplada (CLAUDE.md regra 3, mesmo esquema de
// StorageService.js) — nenhuma cena/tela deve chamar navigator.vibrate()
// direto. navigator.vibrate só existe em alguns navegadores mobile (não
// existe no desktop nem no Safari/iOS), então tudo aqui precisa tolerar a
// API ausente sem quebrar o jogo.
import { gameState } from '../managers/GameManager.js';

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern) {
  if (!gameState.settings.vibrationEnabled) return;
  if (!canVibrate()) return;

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('[HapticsService] Falha ao vibrar:', error);
  }
}

export function vibrateDamage() {
  vibrate(40);
}

export function vibrateDeath() {
  vibrate([80, 50, 80]);
}
