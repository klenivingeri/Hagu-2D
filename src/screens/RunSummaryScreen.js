// Tela de resumo da run em HTML/Tailwind, mostrada quando o player colide
// com um portal que encerra a fase (ver GameScene.completeRun() /
// RUN_EVENTS.COMPLETE em constants.js). UI fora do Phaser vive aqui
// (CLAUDE.md regra 1) — o Phaser só emite o evento com os dados, esta tela
// só escuta (ligada em main.js/BindRunEvents).
import runSummaryTemplate from './runSummaryScreen.html?raw';
import { getStageLabel } from './mapLabels.js';
import { getBestiaryEntry } from '../game/config/bestiary.js';

let elements = null;

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function formatTime(ms = 0) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Sprite de "run" (frame 0) de cada tipo de mob já é um PNG estático em
// /public/assets/mobs/ (ver preloadEnemyAssets em createEnemy.js — mesma
// convenção de pasta: config.path + (path || key)). Reaproveitar o mesmo
// arquivo aqui evita duplicar asset só pra esta tela, e não exige nenhum
// import de código do Phaser (CLAUDE.md regra 1 — esta tela só lê um
// arquivo estático, nunca uma textura do Phaser).
function getMonsterIconSrc({ key, path }) {
  const folder = path || key;
  return `/assets/mobs/${folder}/run/sprite_run_two_0.png`;
}

function renderStars(container, stars = 0) {
  container.innerHTML = '';
  for (let i = 1; i <= 3; i += 1) {
    const star = document.createElement('span');
    star.textContent = i <= stars ? '⭐' : '☆';
    star.className = i <= stars ? 'text-yellow-400' : 'text-gray-600';
    container.append(star);
  }
}

function renderMonsterKills(wrap, listEl, monsterKills = []) {
  listEl.innerHTML = '';
  if (!monsterKills.length) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');

  monsterKills.forEach(({ key, path, count }) => {
    const item = document.createElement('div');
    item.className = 'flex flex-col items-center gap-1';

    const img = document.createElement('img');
    img.src = getMonsterIconSrc({ key, path });
    img.alt = key;
    img.className = 'h-8 w-8 object-contain [image-rendering:pixelated]';
    // Sprite de mob genérico ("commun") sem run/sprite_run_two_0.png não
    // deve deixar o ícone quebrado visível — some com ele.
    img.onerror = () => { img.style.visibility = 'hidden'; };

    const countLabel = document.createElement('span');
    countLabel.className = 'text-xs font-bold text-white';
    countLabel.textContent = `x${count}`;

    item.append(img, countLabel);
    listEl.append(item);
  });
}

// Sprites de Coleção pegos NESTA run (ver createSpriteDrops.js/
// GameScene.completeRun) — mesmo ícone estático usado em renderMonsterKills,
// mas com nome da Coleção (ver game/config/bestiary.js) embaixo em vez da
// contagem, já que aqui é sempre "1 por espécie, pela primeira vez".
function renderCollectedSprites(wrap, listEl, collectedSprites = []) {
  listEl.innerHTML = '';
  if (!collectedSprites.length) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');

  collectedSprites.forEach(({ key, path }) => {
    const item = document.createElement('div');
    item.className = 'flex flex-col items-center gap-1';

    const img = document.createElement('img');
    img.src = getMonsterIconSrc({ key, path });
    img.alt = key;
    img.className = 'h-8 w-8 object-contain [image-rendering:pixelated]';
    img.onerror = () => { img.style.visibility = 'hidden'; };

    const nameLabel = document.createElement('span');
    nameLabel.className = 'max-w-[4rem] truncate text-[10px] font-bold text-amber-300';
    nameLabel.textContent = getBestiaryEntry(key).name;

    item.append(img, nameLabel);
    listEl.append(item);
  });
}

// `onBack` é quem decide o que fazer com a run terminada (ver main.js):
// destruir o Phaser.Game e voltar pra Welcome, já com o mapa liberado
// aparecendo no grid.
export function ShowRunSummaryScreen({
  coins = 0,
  diamonds = 0,
  diamondsTotal = 0,
  exp = 0,
  timeMs = 0,
  monsterKills = [],
  collectedSprites = [],
  stars = 0,
  unlockedMapKey,
  onBack,
} = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[RunSummaryScreen] #app não encontrado no DOM — resumo da run não será exibido.');
    return;
  }

  HideRunSummaryScreen();

  const root = parseTemplate(runSummaryTemplate);
  app.append(root);

  elements = {
    root,
    unlockedLabel: root.querySelector('.run-summary-unlocked'),
    stars: root.querySelector('.run-summary-stars'),
    exp: root.querySelector('.run-summary-exp'),
    coins: root.querySelector('.run-summary-coins'),
    diamonds: root.querySelector('.run-summary-diamonds'),
    time: root.querySelector('.run-summary-time'),
    monstersWrap: root.querySelector('.run-summary-monsters-wrap'),
    monsters: root.querySelector('.run-summary-monsters'),
    spritesWrap: root.querySelector('.run-summary-sprites-wrap'),
    sprites: root.querySelector('.run-summary-sprites'),
    backBtn: root.querySelector('.run-summary-back-btn'),
  };

  elements.unlockedLabel.textContent = unlockedMapKey
    ? `${getStageLabel(unlockedMapKey)} liberada!`
    : 'Fase concluída';
  renderStars(elements.stars, stars);
  elements.exp.textContent = String(exp);
  elements.coins.textContent = String(coins);
  elements.diamonds.textContent = diamondsTotal > 0 ? `${diamonds}/${diamondsTotal}` : String(diamonds);
  elements.time.textContent = formatTime(timeMs);
  renderMonsterKills(elements.monstersWrap, elements.monsters, monsterKills);
  renderCollectedSprites(elements.spritesWrap, elements.sprites, collectedSprites);
  elements.backBtn.addEventListener('click', () => onBack?.());
}

export function HideRunSummaryScreen() {
  if (!elements) return;
  elements.root.remove();
  elements = null;
}
