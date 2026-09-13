import Phaser from 'phaser';

// Referência mutável pra cena ativa. Os handlers de DOM abaixo (botões
// fora do canvas — CLAUDE.md regra 1) são ligados UMA ÚNICA VEZ pra vida
// inteira da página (ver bindDomControlsOnce): indireciona por aqui em vez
// de fechar sobre uma `scene` fixa, pra sempre agir na partida/cena
// realmente ativa no momento do clique/toque.
let activeScene = null;
let domControlsBound = false;

export function createControls(scene) {
  activeScene = scene;

  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keys = scene.input.keyboard.addKeys('W,A,S,D');
  scene.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  scene.lastDirection = 1;

  scene.controlState = {
    left: false,
    right: false,
    jump: false,
    // Diferente de `jump` (disparo único), reflete se o botão continua
    // pressionado. Usado por mecânicas que dependem de segurar, como o paraquedas.
    jumpHeld: false
  };

  // --- Sistema de Teclado com Disparo Único (Evita pulo infinito ao segurar W/Espaço/Seta) ---
  // scene.cursors/keys/spaceKey são recriados do zero a cada create() (ver
  // acima), então estes listeners nascem e morrem junto com o Key antigo —
  // não acumulam entre restarts (diferente dos addEventListener de DOM
  // abaixo, ligados nos botões HTML persistentes).
  const triggerJumpOnce = () => {
    scene.controlState.jump = true;
  };

  scene.spaceKey.on('down', triggerJumpOnce);
  scene.keys.W.on('down', triggerJumpOnce);
  if (scene.cursors.up) {
    scene.cursors.up.on('down', triggerJumpOnce);
  }

  bindDomControlsOnce();
}

// Os botões de HTML (#dpadPad, #actionPad...) vivem em
// index.html e nunca são destruídos entre respawns (scene.restart()) nem
// entre partidas (novo Phaser.Game a cada "Jogar" — ver main.js). createControls()
// rodava a cada create(), então cada respawn empilhava mais um
// addEventListener nos MESMOS elementos, sem nunca remover os antigos —
// um vazamento que cresce com cada morte do player. Ligar isso uma única
// vez pra vida da página (guardado por domControlsBound) resolve, desde
// que os handlers leiam a cena atual via `activeScene` (atualizada a cada
// createControls()) em vez de fechar sobre a cena do momento do bind.
function bindDomControlsOnce() {
  if (domControlsBound) return;
  domControlsBound = true;

  const btnEsquerda = document.querySelector('#btnEsquerda');
  const btnDireita = document.querySelector('#btnDireita');
  const dpadPad = document.querySelector('#dpadPad');

  const btnA = document.querySelector('#btnA');
  const btnB = document.querySelector('#btnB');
  const actionPad = document.querySelector('#actionPad');

  // O botão de engrenagem vive dentro do HUD (ver hud.html/Hud.js), que é
  // recriado a cada partida/troca de mapa (CreateHud() via HUD_EVENTS.RESET)
  // — delega no #hud-bar (persistente, definido em index.html) em vez de
  // buscar o botão direto, senão o clique nunca funcionaria na primeira
  // partida (createControls roda antes do primeiro CreateHud) nem depois de
  // qualquer recriação do HUD.
  const hudBar = document.querySelector('#hud-bar');
  hudBar?.addEventListener('click', (e) => {
    if (e.target.closest('.hud-settings-btn')) activeScene?.openSettingsMenu();
  });

  // --- Sistema de Joystick Deslizável para o D-Pad (< | >) ---
  const updateDpadFromTouch = (clientX, clientY) => {
    if (!activeScene) return;
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
      activeScene.controlState.left = true;
      activeScene.controlState.right = false;
      btnEsquerda.classList.add('pressed');
      btnDireita.classList.remove('pressed');
    } else if (isOverRight) {
      activeScene.controlState.right = true;
      activeScene.controlState.left = false;
      btnDireita.classList.add('pressed');
      btnEsquerda.classList.remove('pressed');
    } else {
      activeScene.controlState.left = false;
      activeScene.controlState.right = false;
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
    if (!activeScene) return;
    activeScene.controlState.left = false;
    activeScene.controlState.right = false;
    btnEsquerda.classList.remove('pressed');
    btnDireita.classList.remove('pressed');
  };

  dpadPad.addEventListener('pointerup', resetDpad);
  dpadPad.addEventListener('pointercancel', resetDpad);
  dpadPad.addEventListener('pointerleave', resetDpad);

  // --- Sistema de Joystick Deslizável para Ações (A e B) ---
  let activeActionTarget = null;

  const updateActionFromTouch = (clientX, clientY) => {
    if (!activeScene) return;
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

      // Só dispara o pulo se o dedo acabou de entrar no botão de pulo (evita pulo contínuo ao segurar)
      if (activeActionTarget !== 'jump') {
        activeScene.controlState.jump = true;
        activeActionTarget = 'jump';
      }
      activeScene.controlState.jumpHeld = true;
    } else if (isOverFire) {
      btnA.classList.add('pressed');
      btnB.classList.remove('pressed');

      // Só dispara o tiro se o dedo acabou de entrar no botão de tiro
      if (activeActionTarget !== 'fire') {
        if (activeScene.bulletSystem && typeof activeScene.bulletSystem.fire === 'function') {
          activeScene.bulletSystem.fire();
        }
        activeActionTarget = 'fire';
      }
      activeScene.controlState.jumpHeld = false;
    } else {
      btnB.classList.remove('pressed');
      btnA.classList.remove('pressed');
      // Dedo saiu do botão de tiro sem passar pelo pointerup (ex: arrastou
      // pra fora): solta a bomba em carga, se houver (ver habilidade
      // "isPump"/releaseBomb em createBulletSystem.js). Sem efeito pra
      // qualquer outra arma.
      if (activeActionTarget === 'fire') {
        activeScene.bulletSystem?.fireUp?.();
      }
      activeActionTarget = null;
      activeScene.controlState.jumpHeld = false;
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
    if (!activeScene) return;
    // Soltou o botão de tiro de verdade: solta a bomba em carga, se houver
    // (ver comentário equivalente em updateActionFromTouch acima).
    if (activeActionTarget === 'fire') {
      activeScene.bulletSystem?.fireUp?.();
    }
    btnA.classList.remove('pressed');
    btnB.classList.remove('pressed');
    activeActionTarget = null;
    activeScene.controlState.jumpHeld = false;
  };

  actionPad.addEventListener('pointerup', resetAction);
  actionPad.addEventListener('pointercancel', resetAction);
  actionPad.addEventListener('pointerleave', resetAction);
}
