import Phaser from 'phaser';

export function createControls(scene) {
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keys = scene.input.keyboard.addKeys('W,A,S,D');
  scene.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  scene.lastDirection = 1;
  
  scene.controlState = { 
    left: false, 
    right: false, 
    jump: false
  };

  const btnEsquerda = document.querySelector('#btnEsquerda');
  const btnDireita = document.querySelector('#btnDireita');
  const dpadPad = document.querySelector('#dpadPad');

  const btnA = document.querySelector('#btnA');
  const btnB = document.querySelector('#btnB');
  const actionPad = document.querySelector('#actionPad');

  // --- Sistema de Joystick Deslizável para o D-Pad (< | >) ---
  const updateDpadFromTouch = (clientX, clientY) => {
    const leftRect = btnEsquerda.getBoundingClientRect();
    const rightRect = btnDireita.getBoundingClientRect();

    const isOverLeft = (
      clientX >= leftRect.left && clientX <= leftRect.right &&
      clientY >= leftRect.top && clientY <= leftRect.bottom
    );

    const isOverRight = (
      clientX >= rightRect.left && clientX <= rightRect.right &&
      clientY >= rightRect.top && clientY <= rightRect.bottom
    );

    if (isOverLeft) {
      scene.controlState.left = true;
      scene.controlState.right = false;
      btnEsquerda.classList.add('pressed');
      btnDireita.classList.remove('pressed');
    } else if (isOverRight) {
      scene.controlState.right = true;
      scene.controlState.left = false;
      btnDireita.classList.add('pressed');
      btnEsquerda.classList.remove('pressed');
    } else {
      scene.controlState.left = false;
      scene.controlState.right = false;
      btnEsquerda.classList.remove('pressed');
      btnDireita.classList.remove('pressed');
    }
  };

  dpadPad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    updateDpadFromTouch(e.clientX, e.clientY);
  });

  dpadPad.addEventListener('pointermove', (e) => {
    e.preventDefault();
    updateDpadFromTouch(e.clientX, e.clientY);
  });

  const resetDpad = (e) => {
    e.preventDefault();
    scene.controlState.left = false;
    scene.controlState.right = false;
    btnEsquerda.classList.remove('pressed');
    btnDireita.classList.remove('pressed');
  };

  dpadPad.addEventListener('pointerup', resetDpad);
  dpadPad.addEventListener('pointercancel', resetDpad);
  dpadPad.addEventListener('pointerleave', resetDpad);

  // --- Sistema de Joystick Deslizável para Ações (A e B) ---
  let activeActionTarget = null; // Guarda qual botão está sendo pressionado no momento

  const updateActionFromTouch = (clientX, clientY) => {
    const fireRect = btnA.getBoundingClientRect();
    const jumpRect = btnB.getBoundingClientRect();


    const isOverJump = (
      clientX >= jumpRect.left && clientX <= jumpRect.right &&
      clientY >= jumpRect.top && clientY <= jumpRect.bottom
    );

    const isOverFire = (
      clientX >= fireRect.left && clientX <= fireRect.right &&
      clientY >= fireRect.top && clientY <= fireRect.bottom
    );

    if (isOverJump) {
      btnB.classList.add('pressed');
      btnA.classList.remove('pressed');

      // Se mudou para o botão de pulo agora
      if (activeActionTarget !== 'jump') {
        scene.controlState.jump = true; // Aciona o pulo
        activeActionTarget = 'jump';
      }
    } else if (isOverFire) {
      btnA.classList.add('pressed');
      btnB.classList.remove('pressed');

      // Se mudou para o botão de tiro agora
      if (activeActionTarget !== 'fire') {
        if (scene.bulletSystem && typeof scene.bulletSystem.fire === 'function') {
          scene.bulletSystem.fire(); // Dispara o tiro
        }
        activeActionTarget = 'fire';
      }
    } else {
      // Dedo fora dos botões, mas ainda dentro do painel de ação
      btnB.classList.remove('pressed');
      btnA.classList.remove('pressed');
      activeActionTarget = null;
    }
  };

  actionPad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activeActionTarget = null;
    updateActionFromTouch(e.clientX, e.clientY);
  });

  actionPad.addEventListener('pointermove', (e) => {
    e.preventDefault();
    updateActionFromTouch(e.clientX, e.clientY);
  });

  const resetAction = (e) => {
    e.preventDefault();
    btnA.classList.remove('pressed');
    btnB.classList.remove('pressed');
    activeActionTarget = null;
  };

  actionPad.addEventListener('pointerup', resetAction);
  actionPad.addEventListener('pointercancel', resetAction);
  actionPad.addEventListener('pointerleave', resetAction);
}