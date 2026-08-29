import Phaser from 'phaser';

function bindHold(element, onStart, onEnd) {
  if (!element) return;

  const start = (event) => {
    event.preventDefault();
    onStart();
  };

  const end = (event) => {
    event.preventDefault();
    onEnd();
  };

  element.addEventListener('pointerdown', start);
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('pointerleave', end);
}

export function createControls(scene) {
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keys = scene.input.keyboard.addKeys('W,A,S,D');
  scene.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  scene.lastDirection = 1
  scene.controlState = { left: false, right: false, jump: false };

  bindHold(
    document.querySelector('#btnEsquerda'),
    () => { scene.controlState.left = true; },
    () => { scene.controlState.left = false; },
  );

  bindHold(
    document.querySelector('#btnDireita'),
    () => { scene.controlState.right = true; },
    () => { scene.controlState.right = false; },
  );

  bindHold(
    document.querySelector('#btnPular'),
    () => { scene.controlState.jump = true; },
    () => { scene.controlState.jump = false; },
  );

  const fireButton = document.querySelector('#btnAtirar');
  fireButton?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    scene.bulletSystem.fire();
  });
}
