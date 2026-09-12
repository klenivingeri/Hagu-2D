// Tela de resumo da run em HTML/Tailwind, mostrada quando o player colide
// com um portal que encerra a fase (ver GameScene.completeRun() /
// RUN_EVENTS.COMPLETE em constants.js). UI fora do Phaser vive aqui
// (CLAUDE.md regra 1) — o Phaser só emite o evento com os dados, esta tela
// só escuta (ligada em main.js/BindRunEvents).
import runSummaryTemplate from './runSummaryScreen.html?raw';
import { getStageLabel } from './mapLabels.js';
import { getBestiaryEntry } from '../game/config/bestiary.js';
import { resolveMobFrameAsset } from '../game/config/entities.js';
import { buildSpriteIconElement } from './spriteSheetDom.js';

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

// Ícone estático (frame 0 do "run" REAL daquela pasta — cada mob tem seu
// próprio arquivo/grid, ver MOB_SPRITE_SETS em game/config/entities.js).
// resolveMobFrameAsset é config pura (sem Phaser) — não fere CLAUDE.md
// regra 1 (esta tela só lê um arquivo estático, nunca uma textura do
// Phaser); buildSpriteIconElement decide <img> ou <div> conforme o mob já
// foi convertido pra spritesheet única ou ainda usa uma imagem por frame.
function buildMonsterIcon({ key, path, behavior }, className) {
  const folder = path || key;
  const asset = resolveMobFrameAsset(behavior, folder, 'run');
  return buildSpriteIconElement(asset, 32, className).element;
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

  monsterKills.forEach(({ key, path, behavior, count }) => {
    const item = document.createElement('div');
    item.className = 'flex flex-col items-center gap-1';

    const icon = buildMonsterIcon({ key, path, behavior }, 'h-8 w-8 object-contain [image-rendering:pixelated]');
    icon.alt = key;

    const countLabel = document.createElement('span');
    countLabel.className = 'text-xs font-bold text-white';
    countLabel.textContent = `x${count}`;

    item.append(icon, countLabel);
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

  collectedSprites.forEach(({ key, path, behavior }) => {
    const item = document.createElement('div');
    item.className = 'flex flex-col items-center gap-1';

    const icon = buildMonsterIcon({ key, path, behavior }, 'h-8 w-8 object-contain [image-rendering:pixelated]');
    icon.alt = key;

    const nameLabel = document.createElement('span');
    nameLabel.className = 'max-w-[4rem] truncate text-[10px] font-bold text-amber-300';
    nameLabel.textContent = getBestiaryEntry(key).name;

    item.append(icon, nameLabel);
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
