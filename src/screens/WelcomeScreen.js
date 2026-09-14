// Tela de Welcome (home) em HTML/Tailwind, exibida antes do Phaser existir
// (CLAUDE.md / GUIDELINES.md: UI fora do Phaser vive aqui). Mostra nome do
// player, nível/XP e recursos globais lendo direto de GameManager — não
// precisa da ponte de eventos do game.events porque roda sem nenhuma cena
// do Phaser ativa. O botão "Jogar" delega pra quem chamou ShowWelcomeScreen
// decidir quando instanciar o Phaser.Game (ver main.js).
import welcomeTemplate from './welcomeScreen.html?raw';
import {
  gameState,
  getLevelInfo,
  updateSetting,
  isMapUnlocked,
  getUpgradeState,
  purchaseUpgrade,
  getMapStars,
  isAbilityEquipped,
  equipAbility,
  isAccessoryEquipped,
  equipAccessory,
  resetDailyTicketsIfNeeded,
  consumeTicket,
  purchaseTicketWithCoins,
  purchaseTicketWithDiamant,
  grantTicketFromAd,
  TICKET_COST_COINS,
  TICKET_COST_DIAMANT,
} from '../managers/GameManager.js';
import { requestRewardedAd } from '../services/AdsService.js';
import { UPGRADES_CATALOG, ABILITY_UPGRADE_IDS, ACCESSORY_UPGRADE_IDS } from '../game/config/upgrades.js';
import { MAPS, FIRST_STAGE_MAP_KEY, getWorldsList, getDungeonsList } from '../game/config/maps.js';
import { getStageLabel } from './mapLabels.js';
import {
  isFullscreenSupported,
  isFullscreenActive,
  toggleFullscreen,
  onFullscreenChange,
  offFullscreenChange,
} from '../services/FullscreenService.js';
import { BESTIARY, getBestiaryEntry, getBehaviorTraitLabel } from '../game/config/bestiary.js';
import { getCollectionEntries } from '../managers/GameManager.js';
// Só a CONFIG de mobs/player (dados puros, sem Phaser) — nunca o Phaser em
// si, que fica proibido aqui (CLAUDE.md regra 1: WelcomeScreen é tela HTML).
import { getPlayerAnimationAsset, resolveMobFrameAsset } from '../game/config/entities.js';
import { applySpriteSheet, setSpriteSheetFrame, buildSpriteIconElement } from './spriteSheetDom.js';

let elements = null;
let idleAnimationTimer = null;
// Callback repassado pra ShowWelcomeScreen({ onPlay }) — ver handlePlayClick.
let onPlayCallback = null;
// Aba atualmente visível (ver switchView) — usado por updateTabAffordBadges()
// pra nunca mostrar a bolinha vermelha na aba em que o player já está: ela só
// faz sentido como aviso pra abrir uma aba que ele ainda não olhou.
let currentWelcomeView = 'home';
// Baseline pra detectar fases que acabaram de ser desbloqueadas (ver
// refreshStageGallery). Começa null: a primeira renderização da sessão só
// define a baseline, nunca anima/navega — só a partir da segunda é que uma
// key nova nesse conjunto significa "acabou de desbloquear" (voltou da Run
// que liberou uma gate/portal).
let knownUnlockedMapKeys = null;

// Galeria da Welcome (ver getWorldsList em game/config/maps.js): uma galeria
// VERTICAL de worlds e, DENTRO DE CADA SLOT dela, uma galeria HORIZONTAL de
// fases — "galeria de galeria" (ver renderWorldTrack/buildFaseGallery mais
// abaixo). Cada world guarda a própria fase selecionada em `world.faseIndex`
// (não um índice global), porque agora TODOS os worlds existem ao mesmo
// tempo no DOM (não é reconstruído a cada troca) e cada um lembra onde o
// player parou nele.
const WORLDS = getWorldsList();
WORLDS.forEach((world) => { world.faseIndex = 0; });
let selectedWorldIndex = 0;

function getSelectedWorld() {
  return WORLDS[selectedWorldIndex] || null;
}

function getSelectedMapKey() {
  const world = getSelectedWorld();
  return world?.maps[world.faseIndex] || FIRST_STAGE_MAP_KEY;
}

function findWorldFasePosition(mapKey) {
  for (let worldIndex = 0; worldIndex < WORLDS.length; worldIndex += 1) {
    const faseIndex = WORLDS[worldIndex].maps.indexOf(mapKey);
    if (faseIndex !== -1) return { worldIndex, faseIndex };
  }
  return null;
}

// Mesma arte/skin do player dentro do Phaser (ver PLAYER_SKINS em
// /src/game/config/entities.js) — cada animação é UMA spritesheet 16x24, só
// que aqui fora não tem nenhuma cena do Phaser pra ler/tocar essa
// spritesheet, então tocamos "na mão" via background-position de um <div>
// (ver applySpriteSheet/setSpriteSheetFrame em spriteSheetDom.js).
function toDomSpriteAsset(asset) {
  return { url: `/${asset.url}`, totalFrames: asset.totalFrames, frameRate: asset.frameRate };
}

const PLAYER_IDLE_SPRITE = toDomSpriteAsset(getPlayerAnimationAsset('player', 'idle'));
const PLAYER_RUN_SPRITE = toDomSpriteAsset(getPlayerAnimationAsset('player', 'run'));

const PLAYER_TOPBAR_SPRITE_HEIGHT_PX = 24; // bate com a classe h-6 do ícone da topbar

function startIdleAnimation() {
  if (!elements) return;
  applySpriteSheet(elements.playerSprite, PLAYER_IDLE_SPRITE, PLAYER_TOPBAR_SPRITE_HEIGHT_PX);
  let frameIndex = 0;
  idleAnimationTimer = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % PLAYER_IDLE_SPRITE.totalFrames;
    setSpriteSheetFrame(elements.playerSprite, frameIndex);
  }, 1000 / PLAYER_IDLE_SPRITE.frameRate);
}

function stopIdleAnimation() {
  window.clearInterval(idleAnimationTimer);
  idleAnimationTimer = null;
}

// Timers dos ícones animados do grid da Coleção (ver buildCollectionCard) —
// precisam ser limpos manualmente porque trocam img.src via setInterval,
// não uma anims.create() do Phaser que morre sozinha com a cena.
let collectionCardTimers = [];

function stopCollectionCardAnimations() {
  collectionCardTimers.forEach((timerId) => window.clearInterval(timerId));
  collectionCardTimers = [];
}

// Botão "Jogar" fica sempre visível — só dá um "yoyo" (pop + oscilação de
// escala, igual efeito yoyo:true de uma tween do Phaser) como feedback de
// que a fase selecionada mudou. Reinicia a classe pra permitir tocar de novo
// em seleções seguidas (animationend remove sozinha, como em stage-cell-unlock).
// Cada world tem o SEU PRÓPRIO botão "Jogar" (ver buildFaseGallery) — só o do
// world atual importa aqui.
function pulsePlayButton() {
  const btn = getSelectedWorld()?.playBtnEl;
  if (!btn) return;
  btn.classList.remove('play-btn-yoyo');
  void btn.offsetWidth; // força reflow pra poder re-adicionar a classe já removida
  btn.classList.add('play-btn-yoyo');
  btn.addEventListener('animationend', () => btn.classList.remove('play-btn-yoyo'), { once: true });
}

function parseTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return [...template.content.children];
}

function renderPlayerInfo() {
  if (!elements) return;
  const { level, percent } = getLevelInfo();
  elements.playerName.textContent = gameState.playerName;
  elements.playerLevel.textContent = `Lvl ${level}`;
  elements.expFill.style.width = `${percent}%`;
  elements.diamondTotal.textContent = String(gameState.diamant);
  elements.coinTotal.textContent = String(gameState.coins);
  renderTicketsDisplay();
  updateTabAffordBadges();
}

let ticketsCountdownTimer = null;

function stopTicketsCountdown() {
  window.clearInterval(ticketsCountdownTimer);
  ticketsCountdownTimer = null;
}

// Meia-noite local (não UTC) — precisa bater com o fuso usado por
// GameManager.resetDailyTicketsIfNeeded() (getLocalDateString), senão o
// contador chegaria a 00:00:00 num instante diferente do reset de verdade.
function getMsUntilNextLocalMidnight() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return nextMidnight - now;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Chamado a cada segundo enquanto as fichas estiverem zeradas — quando o
// contador chega em zero, aciona o reset diário na hora (sem esperar o
// player reabrir a Welcome) e some com o contador (renderPlayerInfo já
// reflete o número de fichas cheio de novo).
function tickTicketsCountdown() {
  if (!elements) return;
  const msLeft = getMsUntilNextLocalMidnight();
  if (msLeft <= 0) {
    resetDailyTicketsIfNeeded();
    renderPlayerInfo();
    return;
  }
  elements.ticketsCountdown.textContent = formatCountdown(msLeft);
}

// O número de fichas (inclusive "0") sempre fica visível; quando zeradas,
// mostra também o contador regressivo até a meia-noite local LOGO ABAIXO
// dele (ver tickTicketsCountdown), atualizado a cada segundo.
function renderTicketsDisplay() {
  if (!elements) return;
  elements.ticketsCount.textContent = String(gameState.tickets);

  if (gameState.tickets > 0) {
    stopTicketsCountdown();
    elements.ticketsCountdown.classList.add('hidden');
    return;
  }

  elements.ticketsCountdown.classList.remove('hidden');
  tickTicketsCountdown();
  if (!ticketsCountdownTimer) {
    ticketsCountdownTimer = window.setInterval(tickTicketsCountdown, 1000);
  }
}

// Reaproveita a mesma escala 1-3 de GameScene.completeRun()/GameManager.
// getMapStars() — ⭐ preenchida pra cada estrela já conquistada, ☆ vazia pro
// resto, igual ao critério usado em RunSummaryScreen.js.
function renderStageStars(stars) {
  return Array.from({ length: 3 }, (_, index) => (index < stars ? '⭐' : '☆')).join('');
}

// ==========================================
// Galeria de fases — a "imagem" que fica dentro de cada slot da galeria de
// worlds (ver mais abaixo): um <div> com scroll HORIZONTAL nativo (ver
// .fase-gallery/.fase-track em main.css, scroll-snap-type: x mandatory) — a
// rolagem em si já É a animação de passagem. Cada slot tem o mesmo tamanho/
// pitch fixo (FASE_SLOT_PITCH_PX), então dá pra calcular tudo (posição de
// scroll de cada índice, distância até o centro) só com aritmética, sem
// medir o DOM.
// ==========================================
// Responsivo: a galeria precisa ocupar toda a largura/altura disponível (não
// um tamanho fixo em px), então esses 4 viram `let` e são recalculados em
// measureGalleryMetrics() — chamada no mount e de novo a cada resize/giro de
// tela (ver handleGalleryResize) — a partir do tamanho REAL da viewport.
let FASE_SLOT_PX = 96;
let FASE_SLOT_GAP_PX = 20;
let FASE_SLOT_PITCH_PX = FASE_SLOT_PX + FASE_SLOT_GAP_PX;
let FASE_VIEWPORT_PX = FASE_SLOT_PX * 3 + FASE_SLOT_GAP_PX * 2; // até 3 slots visíveis por vez
// (FASE_VIEWPORT_PX - FASE_SLOT_PX) / 2 dá exatamente FASE_SLOT_PITCH_PX —
// por isso dá pra centralizar o índice N só com scrollLeft = N * PITCH (ver
// faseScrollLeftForIndex), sem nenhuma conta a mais.
// Responsivos também (ver measureGalleryMetrics) — em paisagem/telas largas
// a galeria expande de verdade (reflete a largura real da tela/div, sem
// travar num teto pequeno), e o bloco de chão + boneco crescem junto com o
// slot, na mesma proporção original (40/96 e 22/96), pra não sobrar um
// monte de espaço vazio ao redor de uma arte pixelada minúscula.
let FASE_TILE_PX = 40;
const FASE_TILE_RATIO = 40 / 96;
const GROUND_TILESET_COLS = 16; // world_tileset.png: 256px / 16px por tile
let FASE_SPRITE_HEIGHT_PX = 22;
const FASE_SPRITE_RATIO = 22 / 96;
const FASE_SCROLL_END_DEBOUNCE_MS = 120;
// Quanto o número/estrelas/label/cadeado "sobem" (translateY negativo) ao se
// afastar do centro, até sumirem de vez (opacity 0) — ver applyFaseScrollVisuals.
const FASE_OVERLAY_RISE_PX = 14;

// Cada galeria de fases (uma por world — ver buildFaseGallery) toca até 2
// animações do boneco em paralelo (a que tava "atual" voltando a idle + a
// nova "atual" virando run). Os timers de TODOS os worlds ficam aqui pra
// stopFaseCardAnimation limpar de uma vez (HideWelcomeScreen).
let faseCardAnimationTimers = [];

function stopFaseCardAnimation() {
  faseCardAnimationTimers.forEach((timerId) => window.clearInterval(timerId));
  faseCardAnimationTimers = [];
}

function buildGroundTileElement(tile, sizePx) {
  const el = document.createElement('div');
  el.className = 'pointer-events-none absolute inset-x-0 bottom-0 mx-auto [image-rendering:pixelated]';
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.style.backgroundImage = "url('assets/tiledmap/world_tileset.png')";
  el.style.backgroundSize = `${GROUND_TILESET_COLS * sizePx}px ${GROUND_TILESET_COLS * sizePx}px`;
  el.style.backgroundPosition = `-${(tile?.column || 0) * sizePx}px -${(tile?.row || 0) * sizePx}px`;
  return el;
}

// Boneco por cima do bloco de chão, marcado com .fase-slot-sprite pra dar
// pra trocar (idle <-> run, ver setFaseSlotRunning) sem precisar reconstruir
// o slot inteiro — toca sozinho em loop enquanto existir (ver
// stopFaseCardAnimation).
function buildPlayerOnTileElement(asset, spriteHeightPx, groundTilePx) {
  const el = document.createElement('div');
  el.className = 'fase-slot-sprite pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 [image-rendering:pixelated]';
  // Pés em cima da borda superior do bloco de chão (ver buildGroundTileElement),
  // não "dentro" dele — o bloco é flush com o fundo do slot, então o boneco
  // fica com bottom = altura do bloco.
  el.style.bottom = `${groundTilePx}px`;
  applySpriteSheet(el, asset, spriteHeightPx);
  let frameIndex = 0;
  const timerId = window.setInterval(() => {
    frameIndex = (frameIndex + 1) % asset.totalFrames;
    setSpriteSheetFrame(el, frameIndex);
  }, 1000 / asset.frameRate);
  faseCardAnimationTimers.push(timerId);
  return el;
}

// Troca o boneco de um slot entre correndo (fase atual) e parado (peek) —
// usado só na fase que está "travando"/"destravando" como atual, nunca
// durante o scroll em si (ver syncFaseSelectionVisuals).
function setFaseSlotRunning(slot, running) {
  slot.querySelector('.fase-slot-sprite')?.remove();
  slot.append(buildPlayerOnTileElement(running ? PLAYER_RUN_SPRITE : PLAYER_IDLE_SPRITE, FASE_SPRITE_HEIGHT_PX, FASE_TILE_PX));
}

// Um slot da galeria: bloco de chão + boneco parado (idle, vira run só
// quando "trava" como atual — ver syncFaseSelectionVisuals) + número/
// estrelas/label/cadeado, sempre presentes (pra CADA fase, não só a atual)
// mas com opacity/posição controlados ao vivo pelo scroll (ver
// applyFaseScrollVisuals): conforme a fase se aproxima do centro os dados
// vão aparecendo, e conforme se afasta eles vão subindo e sumindo.
function buildFaseSlot(mapKey, index) {
  const slot = document.createElement('div');
  slot.className = 'fase-slot relative flex-none';
  slot.style.width = `${FASE_SLOT_PX}px`;
  slot.style.height = `${FASE_SLOT_PX}px`;
  slot.dataset.mapKey = mapKey;
  slot.append(buildGroundTileElement(MAPS[mapKey]?.tile, FASE_TILE_PX));
  slot.append(buildPlayerOnTileElement(PLAYER_IDLE_SPRITE, FASE_SPRITE_HEIGHT_PX, FASE_TILE_PX));

  const number = document.createElement('span');
  number.className = 'fase-slot-overlay pointer-events-none absolute left-2 top-2 text-lg font-black leading-none text-white';
  number.textContent = String(index + 1);
  slot.append(number);

  const stars = document.createElement('span');
  stars.className = 'fase-slot-overlay pointer-events-none absolute right-2 top-2 flex gap-0.5 text-xs leading-none text-gray-300';
  stars.setAttribute('aria-hidden', 'true');
  stars.textContent = renderStageStars(getMapStars(mapKey));
  slot.append(stars);

  // -translate-x-1/2 vira "data-center-x" (não classe Tailwind): o
  // translateY ao vivo (ver applyFaseScrollVisuals) precisa escrever o
  // transform inteiro no inline style, o que apagaria uma classe utilitária
  // de transform se ela ficasse só no CSS.
  const label = document.createElement('span');
  label.className = 'fase-slot-overlay pointer-events-none absolute -bottom-6 left-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-gray-300';
  label.dataset.centerX = 'true';
  label.textContent = getStageLabel(mapKey);
  slot.append(label);

  if (!isMapUnlocked(mapKey)) {
    const lock = document.createElement('span');
    lock.className = 'fase-slot-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-gray-950/40 text-3xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]';
    lock.textContent = '🔒';
    slot.append(lock);
  }

  return slot;
}

function faseScrollLeftForIndex(index) {
  return index * FASE_SLOT_PITCH_PX;
}

function scrollFaseGalleryToIndex(world, index, smooth) {
  world.galleryEl.scrollTo({ left: faseScrollLeftForIndex(index), behavior: smooth ? 'smooth' : 'auto' });
}

// Efeito "coverflow" ao vivo: quanto mais perto do centro da viewport, maior/
// mais opaco o slot fica E mais os dados dele (número/estrelas/label/
// cadeado, ver .fase-slot-overlay) aparecem; quanto mais longe, mais eles
// sobem (translateY) e somem — tudo puramente matemático a partir do
// scrollLeft atual (sem medir DOM), então acompanha o dedo/mouse frame a
// frame. Chamado a cada evento de 'scroll' E de novo ao "pousar" (ver
// handleFaseGalleryScrollEnd), pra fixar os valores exatos do slot central.
//
// O botão "Jogar" (o DESTE world — ver world.playBtnEl/buildFaseGallery)
// segue o mesmo espírito: soma a proximidade de cada slot DESBLOQUEADO (as
// proximidades dos 2 slots relevantes sempre somam 1, já que a função é um
// "tent" linear com base PITCH) — assim ele já vai sumindo ANTES do player
// chegar numa fase bloqueada, em vez de sumir de repente só quando o scroll
// "trava" nela (ver syncFaseSelectionVisuals, que só fixa o valor final exato).
function applyFaseScrollVisuals(world) {
  const scrollLeft = world.galleryEl.scrollLeft;
  let playBtnWeight = 0;

  [...world.trackEl.children].forEach((slot, index) => {
    const distance = Math.abs(index * FASE_SLOT_PITCH_PX - scrollLeft);
    const proximity = Math.max(0, 1 - distance / FASE_SLOT_PITCH_PX);
    slot.style.transform = `scale(${(0.6 + proximity * 0.9).toFixed(3)})`;
    slot.style.opacity = (0.5 + proximity * 0.5).toFixed(3);

    const riseY = (-FASE_OVERLAY_RISE_PX * (1 - proximity)).toFixed(2);
    slot.querySelectorAll('.fase-slot-overlay').forEach((overlay) => {
      const centerX = overlay.dataset.centerX ? 'translateX(-50%) ' : '';
      overlay.style.transform = `${centerX}translateY(${riseY}px)`;
      overlay.style.opacity = proximity.toFixed(3);
    });

    if (isMapUnlocked(slot.dataset.mapKey)) playBtnWeight += proximity;
  });

  world.playBtnEl.style.opacity = playBtnWeight.toFixed(3);
  // Só clicável perto do fim do fade-in — antes disso ele ainda "pertence"
  // mais à fase anterior/bloqueada do que à atual pra fins de clique.
  world.playBtnEl.classList.toggle('pointer-events-none', playBtnWeight < 0.9);
}

// "Trava" o slot no índice `world.faseIndex` como a fase atual (deste
// world): destrava o anterior (volta a idle) e bota o novo pra correr —
// número/estrelas/label/cadeado não mudam aqui, eles já existem sempre (ver
// buildFaseSlot) e só têm a opacidade/posição atualizada pelo scroll (ver
// applyFaseScrollVisuals).
function syncFaseSelectionVisuals(world) {
  const mapKey = world.maps[world.faseIndex];
  const slot = world.trackEl.children[world.faseIndex];
  if (!slot) return;

  // Opacidade/clicabilidade do botão "Jogar" já foram ajustadas ao vivo
  // durante o scroll (ver applyFaseScrollVisuals, chamada logo antes desta
  // função) — aqui só fixa o "disabled" de verdade pro estado final
  // (teclado/leitor de tela).
  const faseUnlocked = isMapUnlocked(mapKey);
  world.playBtnEl.disabled = !faseUnlocked;

  if (world.lockedFaseSlot === slot) return; // já travada, nada novo pra fazer

  if (world.lockedFaseSlot) {
    world.lockedFaseSlot.classList.remove('fase-slot-current', 'opacity-50', 'stage-cell-unlock');
    setFaseSlotRunning(world.lockedFaseSlot, false);
  }

  slot.classList.add('fase-slot-current');
  slot.classList.toggle('opacity-50', !faseUnlocked);
  setFaseSlotRunning(slot, true);
  world.lockedFaseSlot = slot;
}

// Roda a cada 'scroll' — dá o feedback ao vivo (applyFaseScrollVisuals) e
// agenda o "pouso" (debounce: só reage depois de ~120ms sem scroll nenhum,
// ver FASE_SCROLL_END_DEBOUNCE_MS — o próprio scroll-snap do navegador já
// garante que ele sempre pousa exatamente num múltiplo de PITCH).
function handleFaseGalleryScroll(world) {
  applyFaseScrollVisuals(world);
  window.clearTimeout(world.faseScrollEndTimer);
  world.faseScrollEndTimer = window.setTimeout(() => handleFaseGalleryScrollEnd(world), FASE_SCROLL_END_DEBOUNCE_MS);
}

function handleFaseGalleryScrollEnd(world) {
  const rawIndex = Math.round(world.galleryEl.scrollLeft / FASE_SLOT_PITCH_PX);
  const index = Math.max(0, Math.min(world.maps.length - 1, rawIndex));
  const changed = index !== world.faseIndex;
  world.faseIndex = index;
  applyFaseScrollVisuals(world); // fixa os valores exatos (proximity 1) do slot que pousou no centro
  syncFaseSelectionVisuals(world);
  if (changed) pulsePlayButton();
}

// Constrói a galeria de fases INTEIRA de UM world — a .fase-gallery/
// .fase-track de sempre, MAIS o próprio botão "Jogar" desse world (ver
// pulsePlayButton: cada world tem o seu) — e guarda tudo direto no objeto do
// world (galleryEl/trackEl/playBtnEl/faseIndex/lockedFaseSlot/
// faseScrollEndTimer). É criada UMA VEZ só e persiste enquanto a Welcome
// estiver aberta (nunca é reconstruída ao trocar de world) — é essa
// persistência que faz cada world lembrar onde o player parou nele, e é o
// que faz a galeria de fases ser, literalmente, só "uma imagem" dentro do
// slot da galeria de worlds (ver buildWorldSlot).
function buildFaseGallery(world) {
  const gallery = document.createElement('div');
  gallery.className = 'fase-gallery';
  // Responsivo: largura calculada AGORA a partir do espaço real disponível
  // (ver measureGalleryMetrics) — encolhe em retrato, expande de verdade em
  // paisagem (reflete a largura real da tela/div, sem teto).
  gallery.style.width = `${FASE_VIEWPORT_PX}px`;
  // padding-top/bottom também respondem ao tamanho do slot (ver comentário
  // em main.css sobre por que precisam existir: o slot atual escala 1.5x, e
  // o label some por baixo se não sobrar espaço suficiente) — as mesmas
  // proporções calculadas pro tamanho original (slot 96px -> top 24px,
  // bottom 60px), só que agora acompanham FASE_SLOT_PX em vez de fixas.
  gallery.style.paddingTop = `${Math.round(FASE_SLOT_PX * 0.25)}px`;
  gallery.style.paddingBottom = `${Math.round(FASE_SLOT_PX * 0.625)}px`;

  const track = document.createElement('div');
  track.className = 'fase-track';
  // Responsivo: gap/padding precisam bater com o que measureGalleryMetrics
  // calculou AGORA — o gap é o que sobra da largura disponível depois da
  // arte (fixa, ver FASE_SLOT_FIXED_PX), então é ele quem cresce em
  // paisagem, nunca o tamanho da arte (ver pedido "só a distância").
  track.style.gap = `${FASE_SLOT_GAP_PX}px`;
  track.style.paddingInline = `${FASE_SLOT_PITCH_PX}px`;
  gallery.append(track);

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'play-btn gap-2 shrink-0 flex items-center rounded-full bg-emerald-500 px-10 py-3 text-sm font-extrabold uppercase tracking-wide text-gray-950 shadow-lg transition-transform active:scale-95';
  playBtn.textContent = 'Jogar';
  playBtn.addEventListener('click', () => handlePlayClick(playBtn, onPlayCallback));

  world.galleryEl = gallery;
  world.trackEl = track;
  world.playBtnEl = playBtn;
  world.lockedFaseSlot = null;
  world.faseScrollEndTimer = null;

  world.maps.forEach((mapKey, index) => {
    const slot = buildFaseSlot(mapKey, index);
    slot.addEventListener('click', () => scrollFaseGalleryToIndex(world, index, true));
    track.append(slot);
  });

  gallery.scrollLeft = faseScrollLeftForIndex(world.faseIndex);
  gallery.addEventListener('scroll', () => handleFaseGalleryScroll(world), { passive: true });
  applyFaseScrollVisuals(world);
  syncFaseSelectionVisuals(world);

  const card = document.createElement('div');
  card.className = 'world-card flex w-full flex-col items-center gap-3';
  card.append(gallery, playBtn);
  return card;
}

// ==========================================
// Galeria de worlds — MESMA mecânica de scroll nativo + scroll-snap da
// galeria de fases acima, só no eixo vertical e "uma galeria dentro da
// outra": cada slot dela não é um ícone, é a própria galeria de fases
// daquele world inteira (ver buildFaseGallery). Mas aqui só UM slot por vez
// ocupa a tela inteira (ver pedido: "vertical deve mostrar apenas 1, só o
// mundo atual") — é um paginador de página cheia (como um feed vertical),
// não um coverflow com prévia dos vizinhos: cada world é uma "página" do
// tamanho exato da viewport, então scrollTop = índice * altura da viewport,
// sem nenhum deslocamento a mais.
// ==========================================
const WORLD_SCROLL_END_DEBOUNCE_MS = 120;
// Responsivo — ver measureGalleryMetrics(): a viewport (e cada slot) ocupam
// 100% da altura disponível de verdade, medida em tempo de execução.
let WORLD_VIEWPORT_PX = 400;

let worldScrollEndTimer = null;
let galleryResizeTimer = null;
// ResizeObserver (não só 'window.resize'): o tamanho real da viewport pode
// só ficar certo um instante DEPOIS do mount (ex.: --app-vh do
// ViewportService.js ainda não tinha sido aplicado na hora do primeiro
// measureGalleryMetrics — ver comentário no topo de main.css), e só um
// resize de janela nunca dispararia essa correção. ResizeObserver dispara
// sozinho toda vez que o tamanho observado muda de verdade, inclusive essa
// primeira correção — sem isso a galeria de fases ficava com a largura do
// "chute" inicial (não a tela toda) e os slots da galeria de worlds podiam
// nascer com altura errada (um em cima do outro, sem separação nenhuma).
let galleryResizeObserver = null;
// Slot com a classe "world-slot-current" no momento — ver syncWorldSelectionVisuals.
let lockedWorldSlot = null;

// Track é renderizada em ORDEM INVERSA (ver renderWorldTrack): o world 0
// fica no slot de baixo (maior scrollTop) e o último world no topo (scrollTop
// 0), pra avançar de world precisar rolar/arrastar PRA CIMA, não pra baixo.
function worldChildIndexForWorldIndex(index) {
  return WORLDS.length - 1 - index;
}

function worldScrollTopForIndex(index) {
  return worldChildIndexForWorldIndex(index) * WORLD_VIEWPORT_PX;
}

// Mede o espaço de verdade disponível (ver .world-viewport com width/height:
// 100% em main.css) e recalcula os tamanhos de slot/pitch das duas galerias
// a partir disso — chamado no mount e de novo a cada resize/giro de tela
// (ver handleGalleryResize), pra galeria sempre preencher a tela toda,
// responsivo de verdade, não um tamanho fixo em px.
function measureGalleryMetrics() {
  if (!elements) return;
  const viewportWidth = elements.worldViewport.clientWidth || FASE_VIEWPORT_PX;
  const viewportHeight = elements.worldViewport.clientHeight || WORLD_VIEWPORT_PX;

  // Fase: a ARTE (bloco de chão + boneco) tem tamanho fixo (ver
  // FASE_SLOT_FIXED_PX) — ela não cresce em paisagem/tela larga, pedido foi
  // "não deve aumentar o tamanho na horizontal, só a distância". O que
  // reflete a largura real da tela é o ESPAÇAMENTO entre os slots (ver
  // FASE_SLOT_GAP_PX): sobrando largura, os slots só se afastam mais uns
  // dos outros, sem crescer. Só encolhe (nunca cresce) quando a tela é
  // estreita demais pra caber os 3 slots no tamanho fixo + o espaçamento
  // mínimo (retrato apertado).
  const FASE_SLOT_FIXED_PX = 96;
  const FASE_SLOT_MIN_GAP_PX = 20;
  const minTotalWidth = FASE_SLOT_FIXED_PX * 3 + FASE_SLOT_MIN_GAP_PX * 2;

  if (viewportWidth < minTotalWidth) {
    FASE_SLOT_PX = Math.max(48, Math.floor((viewportWidth - FASE_SLOT_MIN_GAP_PX * 2) / 3));
    FASE_SLOT_GAP_PX = FASE_SLOT_MIN_GAP_PX;
  } else {
    FASE_SLOT_PX = FASE_SLOT_FIXED_PX;
    // /3, não /2: a distância sobrando (viewport - as 3 artes) se divide em
    // 3 partes iguais — 1 delas vira o espaço extra nas duas pontas (a
    // metade de cada lado), as outras 2 viram os espaços entre os slots.
    FASE_SLOT_GAP_PX = Math.floor((viewportWidth - FASE_SLOT_FIXED_PX * 3) / 3);
  }
  FASE_SLOT_PITCH_PX = FASE_SLOT_PX + FASE_SLOT_GAP_PX;
  FASE_VIEWPORT_PX = FASE_SLOT_PX * 3 + FASE_SLOT_GAP_PX * 2;
  FASE_TILE_PX = Math.round(FASE_SLOT_PX * FASE_TILE_RATIO);
  FASE_SPRITE_HEIGHT_PX = Math.round(FASE_SLOT_PX * FASE_SPRITE_RATIO);

  // World: 1 página = a altura inteira disponível (ver pedido "vertical
  // deve mostrar apenas 1, só o mundo atual").
  WORLD_VIEWPORT_PX = Math.max(viewportHeight, 1);
}

// Slot da galeria de worlds: ocupa a viewport INTEIRA (ver
// measureGalleryMetrics) e contém a galeria de fases completa daquele world
// (ver buildFaseGallery) — como só um slot fica visível por vez (scroll-snap
// de página cheia), não precisa de scale/opacity de coverflow nem de
// clicar num vizinho pra navegar (ele nem aparece); só rolar pra cima/baixo
// (ver handleWorldGalleryScroll) já troca de world.
function buildWorldSlot(world) {
  const slot = document.createElement('div');
  slot.className = 'world-slot relative flex-none';
  slot.style.height = `${WORLD_VIEWPORT_PX}px`;
  slot.append(buildFaseGallery(world));
  return slot;
}

// "Trava" o índice como o world atual: liga o pointer-events só na galeria
// de fases DESSE world (as outras ficam inertes — não tem sentido mexer
// numa fase de um world que nem está na tela) e marca a classe visual (ver
// .world-slot-current, útil pra achar o slot atual/pop de desbloqueio).
function syncWorldSelectionVisuals(index) {
  WORLDS.forEach((world, i) => {
    world.galleryEl?.classList.toggle('pointer-events-none', i !== index);
  });
  const slot = elements.worldTrack.children[worldChildIndexForWorldIndex(index)];
  if (!slot || lockedWorldSlot === slot) return;
  lockedWorldSlot?.classList.remove('world-slot-current');
  slot.classList.add('world-slot-current');
  lockedWorldSlot = slot;
}

// Roda a cada 'scroll' — só precisa agendar o "pouso" (debounce: reage
// depois de ~120ms sem scroll nenhum, ver WORLD_SCROLL_END_DEBOUNCE_MS — o
// scroll-snap de página cheia do navegador já garante que sempre pousa
// exatamente num world inteiro).
function handleWorldGalleryScroll() {
  if (!elements) return;
  window.clearTimeout(worldScrollEndTimer);
  worldScrollEndTimer = window.setTimeout(handleWorldGalleryScrollEnd, WORLD_SCROLL_END_DEBOUNCE_MS);
}

function handleWorldGalleryScrollEnd() {
  if (!elements) return;
  const rawChildIndex = Math.round(elements.worldViewport.scrollTop / WORLD_VIEWPORT_PX);
  const childIndex = Math.max(0, Math.min(WORLDS.length - 1, rawChildIndex));
  const index = WORLDS.length - 1 - childIndex;
  syncWorldSelectionVisuals(index);
  if (index === selectedWorldIndex) return;

  selectedWorldIndex = index;
  pulsePlayButton();
}

// Constrói a fileira de worlds — cada slot já nasce com a galeria de fases
// completa dele (ver buildWorldSlot/buildFaseGallery) — e pula o scroll pro
// `selectedWorldIndex` atual, sem animação. Chamado no mount/refresh da
// galeria (ver refreshStageGallery) e de novo a cada resize (ver
// handleGalleryResize), sempre depois de measureGalleryMetrics().
function renderWorldTrack() {
  stopFaseCardAnimation(); // limpa os timers de sprite das galerias antigas antes de descartá-las
  const track = elements.worldTrack;
  track.innerHTML = '';
  lockedWorldSlot = null;
  // Ordem inversa no DOM (ver worldChildIndexForWorldIndex): world 0 vai pro
  // último slot (embaixo), o de maior índice vai pro primeiro (topo).
  [...WORLDS].reverse().forEach((world) => {
    track.append(buildWorldSlot(world));
  });
  elements.worldViewport.scrollTop = worldScrollTopForIndex(selectedWorldIndex);
  syncWorldSelectionVisuals(selectedWorldIndex);
}

// Ponto de entrada da galeria: chamado no mount (ShowWelcomeScreen) e
// sempre que o player pode ter voltado de uma Run com fase nova liberada.
// Detecta o que mudou desde a última leva conhecida (ver
// knownUnlockedMapKeys) e, se for o caso, pula a galeria até a fase recém-
// liberada antes de desenhar (mesmo espírito do runner antigo).
function refreshStageGallery() {
  if (!elements || !WORLDS.length) return;

  const allStageKeys = WORLDS.flatMap((world) => world.maps);
  const unlockedStageKeys = allStageKeys.filter((mapKey) => isMapUnlocked(mapKey));
  const newlyUnlockedKeys = knownUnlockedMapKeys
    ? unlockedStageKeys.filter((mapKey) => !knownUnlockedMapKeys.has(mapKey))
    : [];
  knownUnlockedMapKeys = new Set(unlockedStageKeys);

  if (newlyUnlockedKeys.length) {
    const position = findWorldFasePosition(newlyUnlockedKeys[0]);
    if (position) {
      selectedWorldIndex = position.worldIndex;
      WORLDS[position.worldIndex].faseIndex = position.faseIndex;
    }
  }

  measureGalleryMetrics();
  renderWorldTrack();

  if (newlyUnlockedKeys.includes(getSelectedMapKey())) {
    const slot = getSelectedWorld()?.lockedFaseSlot;
    slot?.classList.add('stage-cell-unlock');
    slot?.addEventListener('animationend', () => slot.classList.remove('stage-cell-unlock'), { once: true });
  }
}

// Reage ao ResizeObserver da viewport (ver galleryResizeObserver): remede e
// reconstrói a galeria inteira do zero com os novos tamanhos — debounced pra
// não reconstruir a cada pixel durante um resize contínuo (arrastar a borda
// da janela, ou a correção de tamanho logo depois do mount).
// selectedWorldIndex/world.faseIndex sobrevivem (são estado, não DOM), então
// o player não perde o lugar onde estava.
function handleGalleryResize() {
  window.clearTimeout(galleryResizeTimer);
  galleryResizeTimer = window.setTimeout(() => {
    if (!elements) return;
    measureGalleryMetrics();
    renderWorldTrack();
  }, 150);
}

// Barrinha de "pips" (um quadradinho por nível) usada nos upgrades da loja
// que têm mais de 1 nível — os upgrades booleanos (pulo duplo, paraquedas) não
// chamam esta função, eles só mostram um badge de bloqueado/comprado.
function renderUpgradePips(maxLevel, level) {
  return Array.from({ length: maxLevel }, (_, index) => {
    const filled = index < level;
    return `<span class="h-2 flex-1 rounded-sm ${filled ? 'bg-emerald-400' : 'bg-gray-700'}"></span>`;
  }).join('');
}

// Pulo duplo/paraquedas/jetpack/parede/armas saíram da Loja pra aba "Equip."
// (ver renderEquipmentAbilities/renderEquipmentAccessories) — usado tanto por
// renderShop() quanto por hasAffordableShopItem() pra filtrar o mesmo jeito.
const EXCLUDED_FROM_SHOP = new Set([...ABILITY_UPGRADE_IDS, ...ACCESSORY_UPGRADE_IDS]);

// Bolinha vermelha nas abas "Loja"/"Equip." (ver welcomeScreen.html
// [data-afford-badge]) — sinaliza que há saldo suficiente pra comprar algo
// nessa aba, sem precisar entrar pra descobrir. Chamado sempre que
// renderPlayerInfo() roda, ou seja, toda vez que moeda/diamante mudam.
function hasAffordableShopItem() {
  return UPGRADES_CATALOG.filter((def) => !EXCLUDED_FROM_SHOP.has(def.id)).some((def) => {
    const state = getUpgradeState(def.id);
    return !state.isMaxed && gameState[state.currency] >= state.cost;
  });
}

function hasAffordableEquipItem() {
  return [...ABILITY_UPGRADE_IDS, ...ACCESSORY_UPGRADE_IDS].some((id) => {
    const state = getUpgradeState(id);
    return state.level === 0 && gameState[state.currency] >= state.cost;
  });
}

function updateTabAffordBadges() {
  if (!elements) return;
  const showShopBadge = currentWelcomeView !== 'shop' && hasAffordableShopItem();
  const showEquipmentBadge = currentWelcomeView !== 'equipment' && hasAffordableEquipItem();
  elements.shopTabBadge?.classList.toggle('hidden', !showShopBadge);
  elements.equipmentTabBadge?.classList.toggle('hidden', !showEquipmentBadge);
}

function renderShop() {
  if (!elements) return;

  elements.shopList.innerHTML = '';

  UPGRADES_CATALOG.filter((def) => !EXCLUDED_FROM_SHOP.has(def.id)).forEach((def) => {
    const state = getUpgradeState(def.id);
    const canAfford = !state.isMaxed && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const row = document.createElement('div');
    row.className = 'shop-item flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900/60 px-3 py-2';

    const statusLine = def.boolean
      ? (state.isMaxed ? 'Comprado' : 'Bloqueado')
      : `Nível ${state.level}/${def.maxLevel} · ${state.value}${def.unit ? ` ${def.unit}` : ''}`;

    const bar = def.boolean
      ? ''
      : `<div class="shop-item-pips mt-1.5 flex gap-0.5">${renderUpgradePips(def.maxLevel, state.level)}</div>`;

    const buttonLabel = state.isMaxed ? 'Máximo' : `${state.cost} ${currencyIcon}`;

    row.innerHTML = `
      <span class="text-xl leading-none shrink-0">${def.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}</p>
        ${bar}
      </div>
      <button
        type="button"
        data-upgrade-id="${def.id}"
        class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          state.isMaxed
            ? 'cursor-not-allowed bg-gray-800 text-gray-500'
            : canAfford
              ? 'bg-emerald-500 text-gray-950'
              : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }"
        ${state.isMaxed || !canAfford ? 'disabled' : ''}
      >${buttonLabel}</button>
    `;

    elements.shopList.append(row);
  });
}

function handleShopBuyClick(event) {
  const button = event.target.closest('.shop-buy-btn');
  if (!button || button.disabled) return;

  const bought = purchaseUpgrade(button.dataset.upgradeId);
  if (!bought) return;

  renderPlayerInfo();
  renderShop();
}

// Aba "Masmorra": lista simples (sem galeria/scroll horizontal, ver
// getDungeonsList() em game/config/maps.js) — cada item já É o botão de
// jogar aquela masmorra específica.
function buildDungeonCard(mapKey) {
  const row = document.createElement('button');
  row.type = 'button';
  row.dataset.mapKey = mapKey;
  row.className = 'dungeon-item flex w-full items-center gap-3 rounded-xl border border-white/10 bg-gray-900/60 px-3 py-2 text-left transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
  row.disabled = !isMapUnlocked(mapKey);

  const icon = buildGroundTileElement(MAPS[mapKey]?.tile, 32);
  icon.classList.add('shrink-0', 'rounded-md', 'overflow-hidden');
  row.append(icon);

  const info = document.createElement('div');
  info.className = 'min-w-0 flex-1';
  info.innerHTML = `
    <p class="truncate text-xs font-bold">${getStageLabel(mapKey)}</p>
    <p class="truncate text-[10px] text-gray-300">${renderStageStars(getMapStars(mapKey))}</p>
  `;
  row.append(info);

  if (!isMapUnlocked(mapKey)) {
    const lock = document.createElement('span');
    lock.className = 'shrink-0 text-lg leading-none';
    lock.textContent = '🔒';
    row.append(lock);
  }

  return row;
}

function renderDungeon() {
  if (!elements) return;

  elements.dungeonList.innerHTML = '';
  getDungeonsList().forEach((mapKey) => {
    elements.dungeonList.append(buildDungeonCard(mapKey));
  });
}

function handleDungeonListClick(event) {
  const button = event.target.closest('.dungeon-item');
  if (!button) return;

  handlePlayClick(button, onPlayCallback, button.dataset.mapKey);
}

// Habilidades (ver ABILITY_UPGRADE_IDS) têm 3 estados na aba Equip.:
// bloqueada (ainda não comprada, mostra o botão de compra igual à Loja),
// comprada-mas-guardada (mostra "Equipar") e equipada (mostra badge
// desabilitado, destacada com borda verde) — só uma fica equipada por vez
// (ver GameManager.equipAbility).
function renderEquipmentAbilities() {
  if (!elements) return;

  elements.abilityList.innerHTML = '';

  ABILITY_UPGRADE_IDS.forEach((id) => {
    const state = getUpgradeState(id);
    const owned = state.level > 0;
    const equipped = isAbilityEquipped(id);
    const canAfford = !owned && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const statusLine = !owned ? 'Bloqueado' : equipped ? 'Equipado' : 'No inventário';

    const actionHtml = !owned
      ? `<button type="button" data-buy-ability-id="${id}" class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          canAfford ? 'bg-emerald-500 text-gray-950' : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }" ${canAfford ? '' : 'disabled'}>${state.cost} ${currencyIcon}</button>`
      : equipped
        ? `<button type="button" class="ability-equip-btn shrink-0 cursor-not-allowed rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white" disabled>Equipado</button>`
        : `<button type="button" data-equip-ability-id="${id}" class="ability-equip-btn shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-gray-950 transition-transform active:scale-95">Equipar</button>`;

    const row = document.createElement('div');
    row.className = [
      'shop-item flex items-center gap-3 rounded-xl border-2 bg-gray-900/60 px-3 py-2',
      equipped ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10',
    ].join(' ');
    row.innerHTML = `
      <span class="relative inline-block shrink-0">
        <span class="text-xl leading-none">${state.def.icon}</span>
        ${canAfford ? '<span class="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-gray-900"></span>' : ''}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${state.def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}</p>
      </div>
      ${actionHtml}
    `;
    elements.abilityList.append(row);
  });
}

function handleAbilityListClick(event) {
  const buyBtn = event.target.closest('[data-buy-ability-id]');
  if (buyBtn && !buyBtn.disabled) {
    const bought = purchaseUpgrade(buyBtn.dataset.buyAbilityId);
    if (bought) {
      renderPlayerInfo();
      renderEquipmentAbilities();
    }
    return;
  }

  const equipBtn = event.target.closest('[data-equip-ability-id]');
  if (equipBtn) {
    equipAbility(equipBtn.dataset.equipAbilityId);
    renderEquipmentAbilities();
  }
}

// Armas (ver ACCESSORY_UPGRADE_IDS): mesmos 3 estados das habilidades acima,
// só que a já equipada nunca aparece "desequipável" (sempre tem uma arma
// ativa — ver GameManager.equipAccessory) e cada linha mostra a descrição
// do efeito (ainda sem mecânica de gameplay ligada, só o catálogo).
function renderEquipmentAccessories() {
  if (!elements) return;

  elements.accessoryList.innerHTML = '';

  ACCESSORY_UPGRADE_IDS.forEach((id) => {
    const state = getUpgradeState(id);
    const owned = state.level > 0;
    const equipped = isAccessoryEquipped(id);
    const canAfford = !owned && gameState[state.currency] >= state.cost;
    const currencyIcon = state.currency === 'diamant' ? '💎' : '🪙';

    const statusLine = !owned ? 'Bloqueado' : equipped ? 'Equipado' : 'No inventário';

    const actionHtml = !owned
      ? `<button type="button" data-buy-accessory-id="${id}" class="shop-buy-btn shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-transform active:scale-95 ${
          canAfford ? 'bg-emerald-500 text-gray-950' : 'cursor-not-allowed bg-gray-800 text-gray-500'
        }" ${canAfford ? '' : 'disabled'}>${state.cost} ${currencyIcon}</button>`
      : equipped
        ? `<button type="button" class="ability-equip-btn shrink-0 cursor-not-allowed rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white" disabled>Equipado</button>`
        : `<button type="button" data-equip-accessory-id="${id}" class="ability-equip-btn shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-gray-950 transition-transform active:scale-95">Equipar</button>`;

    const row = document.createElement('div');
    row.className = [
      'shop-item flex items-center gap-3 rounded-xl border-2 bg-gray-900/60 px-3 py-2',
      equipped ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10',
    ].join(' ');
    row.innerHTML = `
      <span class="relative inline-block shrink-0">
        <span class="text-xl leading-none">${state.def.icon}</span>
        ${canAfford ? '<span class="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-gray-900"></span>' : ''}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-bold">${state.def.label}</p>
        <p class="truncate text-[10px] text-gray-400">${statusLine}${state.def.description ? ` · ${state.def.description}` : ''}</p>
      </div>
      ${actionHtml}
    `;
    elements.accessoryList.append(row);
  });
}

function handleAccessoryListClick(event) {
  const buyBtn = event.target.closest('[data-buy-accessory-id]');
  if (buyBtn && !buyBtn.disabled) {
    const bought = purchaseUpgrade(buyBtn.dataset.buyAccessoryId);
    if (bought) {
      renderPlayerInfo();
      renderEquipmentAccessories();
    }
    return;
  }

  const equipBtn = event.target.closest('[data-equip-accessory-id]');
  if (equipBtn) {
    equipAccessory(equipBtn.dataset.equipAccessoryId);
    renderEquipmentAccessories();
  }
}

// Poses "de identidade" do mob (o que ele parece fora de combate/reação) —
// deixa fora 'stomp'/'spark', que são feedback de dano/morte, não um jeito
// de mostrar o bicho na galeria. Ordem fixa pra galeria não pular de posição
// entre espécies diferentes.
const GALLERY_POSE_ORDER = ['idle', 'run', 'bow', 'attack'];
const GALLERY_POSE_LABELS = { idle: 'Parado', run: 'Run', bow: 'Arco', attack: 'Ataque' };

// entry.behavior é a mesma key usada em MOBS_CONFIG (ver
// EnemyBase.killEnemy -> recordEnemyDefeat, que grava enemy.entityConfig.behavior
// vindo de getMobConfig(type, mobFolder)) — dá pra buscar de volta os assets
// REAIS daquela pasta (entry.path || entry.key) a partir só do que já está
// salvo na Coleção (sem precisar de nenhuma cena do Phaser ativa) via
// resolveMobFrameAsset, que já sabe se aquela animação é uma spritesheet
// única ou o sistema antigo de uma imagem por frame.
function getGalleryPoses(entry) {
  if (!entry) return [];
  const folder = entry.path || entry.key;

  return GALLERY_POSE_ORDER
    .map((poseKey) => ({ key: poseKey, asset: resolveMobFrameAsset(entry.behavior, folder, poseKey) }))
    .filter(({ asset }) => asset);
}

function buildGallerySpriteSlot({ key, asset }, spriteUnlocked) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center gap-1';

  const frame = document.createElement('div');
  frame.className = 'flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-gray-900/80';

  const label = GALLERY_POSE_LABELS[key] || key;
  const { element } = buildSpriteIconElement(
    asset,
    40,
    `h-10 w-10 object-contain [image-rendering:pixelated] ${getSpriteFilterClass(spriteUnlocked)}`
  );
  element.alt = `Sprite de ${label}`;

  const caption = document.createElement('span');
  caption.className = 'text-[9px] font-semibold text-gray-400';
  caption.textContent = label;

  frame.append(element);
  wrapper.append(frame, caption);
  return wrapper;
}

// Sprite ainda não dropado (ver GameManager.hasCollectedSprite): vira
// silhueta preta em vez de sumir, pra dar a mesma sensação de "quem é esse
// bicho?" tanto no card quanto no modal — ver EnemyBase.killEnemy() pra
// onde a chance de drop rola de verdade.
function getSpriteFilterClass(spriteUnlocked) {
  return spriteUnlocked ? '' : '[filter:brightness(0)] opacity-70';
}

// Card da aba Coleção: espécie nunca derrotada (sem entrada em
// GameManager.gameState.collection ou kills === 0) fica travada com "❔",
// sem nome nem clique — só depois de derrotar pelo menos uma vez é que o
// nome aparece (com a sprite em silhueta até dropar o item, ver
// createSpriteDrops.js).
function buildCollectionCard(speciesKey, entry) {
  const discovered = Boolean(entry && entry.kills > 0);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = [
    'collection-card flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-transform',
    discovered ? 'border-white/15 bg-gray-900/60 active:scale-95' : 'cursor-default border-white/5 bg-gray-900/30',
  ].join(' ');

  if (!discovered) {
    const icon = document.createElement('span');
    icon.className = 'flex h-10 w-10 items-center justify-center text-xl text-gray-600';
    icon.textContent = '❔';
    const label = document.createElement('span');
    label.className = 'truncate text-[9px] font-bold text-gray-600';
    label.textContent = '???';
    card.append(icon, label);
    return card;
  }

  // O card do grid revela o bicho assim que ele é derrotado pelo menos uma
  // vez — mas só conta se a run em que ele morreu chegou até o fim (ver
  // GameManager.recordEnemyDefeat, commitado só em GameScene.completeRun()).
  // A silhueta de "quem é esse bicho?" fica só dentro do modal (ver
  // openCollectionModal), na galeria de sprites, até o item colecionável ser
  // pego em campo NUMA RUN CONCLUÍDA (ver GameManager.unlockEnemySprite).
  const bestiaryEntry = getBestiaryEntry(speciesKey);
  const folder = entry.path || entry.key;
  const asset = resolveMobFrameAsset(entry.behavior, folder, 'run');
  const { element, totalFrames, frameRate, setFrame } = buildSpriteIconElement(
    asset, 40, 'h-10 w-10 object-contain [image-rendering:pixelated]'
  );
  element.alt = bestiaryEntry.name;

  if (totalFrames > 1) {
    let frameIndex = 0;
    const timerId = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % totalFrames;
      setFrame(frameIndex);
    }, 1000 / frameRate);
    collectionCardTimers.push(timerId);
  }

  const label = document.createElement('span');
  label.className = 'truncate text-[9px] font-bold text-white';
  label.textContent = bestiaryEntry.name;

  card.append(element, label);
  card.addEventListener('click', () => openCollectionModal(speciesKey, entry));
  return card;
}

// União do bestiário (espécies conhecidas de antemão, ver
// game/config/bestiary.js) com o que já foi encontrado em jogo — mob novo
// derrotado antes de ganhar entrada no bestiário ainda aparece no grid (ver
// getBestiaryEntry, cai no fallback genérico).
function renderCollection() {
  if (!elements) return;
  stopCollectionCardAnimations();
  const entries = getCollectionEntries();
  const speciesKeys = Array.from(new Set([...Object.keys(BESTIARY), ...Object.keys(entries)]));

  elements.collectionGrid.innerHTML = '';
  speciesKeys.forEach((speciesKey) => {
    elements.collectionGrid.append(buildCollectionCard(speciesKey, entries[speciesKey]));
  });
}

function openCollectionModal(speciesKey, entry) {
  if (!elements || !entry) return;
  const bestiaryEntry = getBestiaryEntry(speciesKey);
  const spriteUnlocked = Boolean(entry.spriteUnlocked);

  elements.collectionModalName.textContent = bestiaryEntry.name;
  elements.collectionModalDescription.textContent = bestiaryEntry.description;

  elements.collectionModalTraits.innerHTML = '';
  if (entry.behavior) {
    const badge = document.createElement('span');
    badge.className = 'rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300';
    badge.textContent = getBehaviorTraitLabel(entry.behavior);
    elements.collectionModalTraits.append(badge);
  }

  elements.collectionModalSpriteGallery.innerHTML = '';
  getGalleryPoses(entry).forEach((pose) => {
    elements.collectionModalSpriteGallery.append(buildGallerySpriteSlot(pose, spriteUnlocked));
  });
  elements.collectionModalSpriteHint.classList.toggle('hidden', spriteUnlocked);
  elements.collectionModalKills.textContent = `Derrotados nas runs: ${entry.kills}`;

  elements.collectionModal.classList.remove('hidden');
  elements.collectionModal.classList.add('flex');
}

function closeCollectionModal() {
  elements?.collectionModal.classList.add('hidden');
  elements?.collectionModal.classList.remove('flex');
}

// Confere se o .tmj do mapa realmente existe antes de deixar o player entrar
// na fase (ver MAPS/tilemapUrl em game/config/maps.js) — alguns mapas
// cadastrados ainda não têm o arquivo publicado em public/assets/tiledmap/,
// e sem essa checagem o player só descobre isso com a tela de loading presa
// (GameScene.preload -> load.tilemapTiledJSON falhando silenciosamente).
async function isMapReachable(mapKey) {
  const mapConfig = MAPS[mapKey];
  if (!mapConfig) return false;

  try {
    const response = await fetch(mapConfig.tilemapUrl, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function openMapUnavailableModal() {
  elements?.mapUnavailableModal.classList.remove('hidden');
  elements?.mapUnavailableModal.classList.add('flex');
}

function closeMapUnavailableModal() {
  elements?.mapUnavailableModal.classList.add('hidden');
  elements?.mapUnavailableModal.classList.remove('flex');
}

// Atualiza o texto/estado (afford ou não) dos botões de comprar ficha —
// chamado toda vez que o modal abre e de novo após cada compra, já que
// comprar gasta moeda/diamante e pode "desabilitar" o próprio botão que
// acabou de ser clicado (ver renderTicketsEmptyModal).
function renderTicketsEmptyModal() {
  if (!elements) return;
  const isEmpty = gameState.tickets <= 0;
  elements.ticketsEmptyTitle.textContent = isEmpty ? 'Sem fichas' : 'Fichas';
  elements.ticketsEmptyDescription.textContent = isEmpty
    ? 'Você não tem mais fichas pra jogar. Elas voltam amanhã, ou consiga mais uma agora:'
    : 'Consiga mais fichas com ouro, diamante ou assistindo um anúncio.';

  const canAffordCoins = gameState.coins >= TICKET_COST_COINS;
  const canAffordDiamant = gameState.diamant >= TICKET_COST_DIAMANT;

  elements.ticketsBuyCoinsCost.textContent = String(TICKET_COST_COINS);
  elements.ticketsBuyCoinsBtn.disabled = !canAffordCoins;
  elements.ticketsBuyCoinsBtn.classList.toggle('opacity-40', !canAffordCoins);

  elements.ticketsBuyDiamantCost.textContent = String(TICKET_COST_DIAMANT);
  elements.ticketsBuyDiamantBtn.disabled = !canAffordDiamant;
  elements.ticketsBuyDiamantBtn.classList.toggle('opacity-40', !canAffordDiamant);
}

function openTicketsEmptyModal() {
  renderTicketsEmptyModal();
  elements?.ticketsEmptyModal.classList.remove('hidden');
  elements?.ticketsEmptyModal.classList.add('flex');
}

function closeTicketsEmptyModal() {
  elements?.ticketsEmptyModal.classList.add('hidden');
  elements?.ticketsEmptyModal.classList.remove('flex');
}

// Número de fichas "caindo" a cada compra confirmada (ver spawnTicketsRain).
const TICKETS_RAIN_DROP_COUNT = 14;

// Dispara a chuva de fichas sobre o modal como feedback visual de compra
// confirmada — o modal fica aberto (ver handleBuyTicketWithCoins etc.) pra
// permitir comprar de novo em seguida, então a única forma de mostrar que a
// compra funcionou é essa animação, e não fechando o modal.
function spawnTicketsRain() {
  const container = elements?.ticketsRain;
  if (!container) return;
  for (let i = 0; i < TICKETS_RAIN_DROP_COUNT; i += 1) {
    const drop = document.createElement('img');
    drop.src = 'assets/image/tickets.png';
    drop.alt = '';
    drop.className = 'tickets-rain-drop';
    drop.style.left = `${Math.random() * 92}%`;
    drop.style.width = `${16 + Math.random() * 16}px`;
    drop.style.animationDuration = `${900 + Math.random() * 600}ms`;
    drop.style.animationDelay = `${Math.random() * 300}ms`;
    drop.addEventListener('animationend', () => drop.remove());
    container.append(drop);
  }
}

// Handlers dos 3 jeitos de conseguir 1 ficha extra fora do reset diário (ver
// GameManager.purchaseTicketWithCoins/purchaseTicketWithDiamant/
// grantTicketFromAd) — todos atualizam o HUD (moeda/diamante/fichas) e o
// próprio modal, e disparam a chuva de fichas quando a compra realmente
// acontece, mas o modal permanece aberto pra permitir comprar de novo.
function handleBuyTicketWithCoins() {
  if (!purchaseTicketWithCoins()) return;
  renderPlayerInfo();
  renderTicketsEmptyModal();
  spawnTicketsRain();
}

function handleBuyTicketWithDiamant() {
  if (!purchaseTicketWithDiamant()) return;
  renderPlayerInfo();
  renderTicketsEmptyModal();
  spawnTicketsRain();
}

async function handleWatchAdForTicket() {
  // AdsService.requestRewardedAd() escolhe sozinho o backend certo (AdMob
  // no app nativo, CrazyGames no navegador) — ver AdsService.js. Fora dos
  // dois (dev local sem SDK nenhum) cai no fallback de sempre conceder de
  // graça. Só bloqueia a ficha se o player realmente assistir um anúncio de
  // verdade e fechar/pular antes do fim.
  const watched = await requestRewardedAd();
  if (!watched) return;

  grantTicketFromAd();
  renderPlayerInfo();
  renderTicketsEmptyModal();
  spawnTicketsRain();
}

// Handler do botão "Jogar": só entrega o controle pra quem chamou
// ShowWelcomeScreen (ver onPlay) depois de confirmar que o mapa selecionado
// está disponível e que há ficha disponível (ver GameManager.consumeTicket)
// — senão mostra o modal correspondente e mantém o player na Welcome. `btn` é
// o botão do world atual que disparou o clique (ver buildFaseGallery — cada
// world tem o seu próprio, só o do world atual fica clicável).
async function handlePlayClick(btn, onPlay, mapKey = getSelectedMapKey()) {
  if (!btn || btn.disabled) return;

  if (gameState.tickets <= 0) {
    openTicketsEmptyModal();
    return;
  }

  btn.disabled = true;
  const reachable = await isMapReachable(mapKey);
  btn.disabled = false;

  if (!reachable) {
    openMapUnavailableModal();
    return;
  }

  consumeTicket();
  renderPlayerInfo();
  onPlay?.(mapKey);
}

function switchEquipmentSubview(subview) {
  if (!elements) return;
  elements.equipmentSubviews.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.subview !== subview);
  });
  elements.equipmentSubtabButtons.forEach((button) => {
    const active = button.dataset.subview === subview;
    button.classList.toggle('equipment-subtab-active', active);
    button.classList.toggle('border-emerald-400', active);
    button.classList.toggle('bg-emerald-500/10', active);
    button.classList.toggle('text-emerald-400', active);
    button.classList.toggle('border-white/15', !active);
    button.classList.toggle('bg-gray-900/60', !active);
    button.classList.toggle('text-gray-400', !active);
  });
}

function renderSettings() {
  if (!elements) return;
  elements.settingToggles.forEach((toggle) => {
    toggle.checked = Boolean(gameState.settings[toggle.dataset.setting]);
  });

  // Navegadores sem Fullscreen API (ex: Safari iOS) escondem a opção em vez
  // de mostrar um toggle que nunca funciona.
  elements.fullscreenRow?.classList.toggle('hidden', !isFullscreenSupported());
  if (elements.fullscreenToggle) {
    elements.fullscreenToggle.checked = isFullscreenActive();
  }
}

function openSettings() {
  elements?.settingsModal.classList.remove('hidden');
  elements?.settingsModal.classList.add('flex');
}

function closeSettings() {
  elements?.settingsModal.classList.add('hidden');
  elements?.settingsModal.classList.remove('flex');
}

function handleSettingChange(event) {
  const { setting } = event.target.dataset;
  updateSetting(setting, event.target.checked);
}

// Não usa updateSetting/gameState.settings: fullscreen não é uma preferência
// persistível (o navegador exige gesto do usuário pra entrar, então não dá
// pra restaurar sozinho num reload) — o estado real é sempre
// document.fullscreenElement (ver FullscreenService.js).
function handleFullscreenToggle() {
  // document.documentElement (default do FullscreenService), nunca um nó da
  // tela atual: screenRoot é substituído a cada troca de view/tela e sairia
  // do fullscreen sozinho se fosse removido do DOM.
  toggleFullscreen();
}

// Loja/Coleção ainda não têm tela própria (ver IMPLEMENTATION_PLAN.md) —
// por enquanto só trocam qual <section> fica visível dentro do shell da
// Welcome (header e tabbar continuam fixos, só o miolo do <main> muda). O
// preview do mapa e o botão de zoom ficam DENTRO da <section data-view="home">
// de propósito: assim eles somem junto com a aba, em vez de vazar por cima
// das outras (ver welcomeScreen.html).
function switchView(view) {
  if (!elements) return;
  currentWelcomeView = view;
  elements.views.forEach((section) => {
    section.classList.toggle('hidden', section.dataset.view !== view);
  });
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('tab-active', active);
    button.classList.toggle('text-emerald-400', active);
    button.classList.toggle('text-gray-400', !active);
  });
  if (view === 'shop') renderShop();
  if (view === 'equipment') {
    renderEquipmentAbilities();
    renderEquipmentAccessories();
  }
  if (view === 'collection') {
    renderCollection();
  } else {
    stopCollectionCardAnimations();
  }
  if (view === 'dungeon') renderDungeon();
  // A aba clicada não deve mais mostrar a própria bolinha (ver
  // updateTabAffordBadges) — os itens ali dentro já sinalizam individualmente.
  updateTabAffordBadges();
}

export function ShowWelcomeScreen({ onPlay } = {}) {
  const app = document.getElementById('app');
  if (!app) {
    console.warn('[WelcomeScreen] #app não encontrado no DOM — tela de welcome não será exibida.');
    return;
  }

  HideWelcomeScreen();
  // Guardado num módulo-level porque cada botão "Jogar" (um por world, ver
  // buildFaseGallery) é criado bem depois deste ponto, dentro de
  // refreshStageGallery() — precisa estar acessível na hora do clique.
  onPlayCallback = onPlay;

  const [screenRoot, modalRoot, collectionModalRoot, ticketsEmptyModalRoot, mapUnavailableModalRoot] = parseTemplate(welcomeTemplate);
  app.append(screenRoot, modalRoot, collectionModalRoot, ticketsEmptyModalRoot, mapUnavailableModalRoot);

  elements = {
    screenRoot,
    modalRoot,
    playerSprite: screenRoot.querySelector('.player-idle-sprite'),
    playerName: screenRoot.querySelector('.player-name'),
    playerLevel: screenRoot.querySelector('.player-level'),
    expFill: screenRoot.querySelector('.exp-bar-fill'),
    diamondTotal: screenRoot.querySelector('.diamond-total'),
    coinTotal: screenRoot.querySelector('.coin-total'),
    ticketsCount: screenRoot.querySelector('.tickets-count'),
    ticketsCountdown: screenRoot.querySelector('.tickets-countdown'),
    ticketsIconCard: screenRoot.querySelector('.tickets-icon-card'),
    gearBtn: screenRoot.querySelector('.settings-gear-btn'),
    worldViewport: screenRoot.querySelector('.world-viewport'),
    worldTrack: screenRoot.querySelector('.world-track'),
    settingsModal: modalRoot,
    closeBtn: modalRoot.querySelector('.settings-close-btn'),
    settingToggles: [...modalRoot.querySelectorAll('.setting-toggle')],
    fullscreenRow: modalRoot.querySelector('.fullscreen-setting-row'),
    fullscreenToggle: modalRoot.querySelector('.fullscreen-toggle'),
    views: [...screenRoot.querySelectorAll('.welcome-view')],
    tabButtons: [...screenRoot.querySelectorAll('.tab-btn')],
    shopTabBadge: screenRoot.querySelector('[data-afford-badge="shop"]'),
    equipmentTabBadge: screenRoot.querySelector('[data-afford-badge="equipment"]'),
    shopList: screenRoot.querySelector('.shop-list'),
    abilityList: screenRoot.querySelector('.equipment-ability-list'),
    accessoryList: screenRoot.querySelector('.equipment-accessory-list'),
    equipmentSubviews: [...screenRoot.querySelectorAll('.equipment-subview')],
    equipmentSubtabButtons: [...screenRoot.querySelectorAll('.equipment-subtab-btn')],
    collectionGrid: screenRoot.querySelector('.collection-grid'),
    dungeonList: screenRoot.querySelector('.dungeon-list'),
    collectionModalRoot,
    collectionModal: collectionModalRoot,
    collectionModalClose: collectionModalRoot.querySelector('.collection-modal-close'),
    collectionModalName: collectionModalRoot.querySelector('.collection-modal-name'),
    collectionModalTraits: collectionModalRoot.querySelector('.collection-modal-traits'),
    collectionModalDescription: collectionModalRoot.querySelector('.collection-modal-description'),
    collectionModalSpriteGallery: collectionModalRoot.querySelector('.collection-modal-sprite-gallery'),
    collectionModalSpriteHint: collectionModalRoot.querySelector('.collection-modal-sprite-hint'),
    collectionModalKills: collectionModalRoot.querySelector('.collection-modal-kills'),
    mapUnavailableModalRoot,
    mapUnavailableModal: mapUnavailableModalRoot,
    mapUnavailableClose: mapUnavailableModalRoot.querySelector('.map-unavailable-close'),
    ticketsEmptyModalRoot,
    ticketsEmptyModal: ticketsEmptyModalRoot,
    ticketsEmptyClose: ticketsEmptyModalRoot.querySelector('.tickets-empty-close'),
    ticketsEmptyTitle: ticketsEmptyModalRoot.querySelector('.tickets-empty-title'),
    ticketsEmptyDescription: ticketsEmptyModalRoot.querySelector('.tickets-empty-description'),
    ticketsRain: ticketsEmptyModalRoot.querySelector('.tickets-rain'),
    ticketsBuyCoinsBtn: ticketsEmptyModalRoot.querySelector('.tickets-buy-coins-btn'),
    ticketsBuyCoinsCost: ticketsEmptyModalRoot.querySelector('.tickets-buy-coins-cost'),
    ticketsBuyDiamantBtn: ticketsEmptyModalRoot.querySelector('.tickets-buy-diamant-btn'),
    ticketsBuyDiamantCost: ticketsEmptyModalRoot.querySelector('.tickets-buy-diamant-cost'),
    ticketsWatchAdBtn: ticketsEmptyModalRoot.querySelector('.tickets-watch-ad-btn'),
  };

  elements.gearBtn.addEventListener('click', openSettings);
  elements.closeBtn.addEventListener('click', closeSettings);
  elements.settingsModal.addEventListener('click', (event) => {
    if (event.target === elements.settingsModal) closeSettings();
  });
  elements.settingToggles.forEach((toggle) => {
    toggle.addEventListener('change', handleSettingChange);
  });
  elements.fullscreenToggle?.addEventListener('change', handleFullscreenToggle);
  // O player pode sair do fullscreen sem usar o toggle (Esc, gesto do
  // navegador) — resincroniza o checkbox nesses casos.
  onFullscreenChange(renderSettings);
  elements.shopList.addEventListener('click', handleShopBuyClick);
  elements.dungeonList.addEventListener('click', handleDungeonListClick);
  elements.abilityList.addEventListener('click', handleAbilityListClick);
  elements.accessoryList.addEventListener('click', handleAccessoryListClick);
  elements.equipmentSubtabButtons.forEach((button) => {
    button.addEventListener('click', () => switchEquipmentSubview(button.dataset.subview));
  });
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.collectionModalClose.addEventListener('click', closeCollectionModal);
  elements.collectionModal.addEventListener('click', (event) => {
    if (event.target === elements.collectionModal) closeCollectionModal();
  });
  elements.mapUnavailableClose.addEventListener('click', closeMapUnavailableModal);
  elements.mapUnavailableModal.addEventListener('click', (event) => {
    if (event.target === elements.mapUnavailableModal) closeMapUnavailableModal();
  });
  elements.ticketsEmptyClose.addEventListener('click', closeTicketsEmptyModal);
  elements.ticketsEmptyModal.addEventListener('click', (event) => {
    if (event.target === elements.ticketsEmptyModal) closeTicketsEmptyModal();
  });
  elements.ticketsBuyCoinsBtn.addEventListener('click', handleBuyTicketWithCoins);
  elements.ticketsBuyDiamantBtn.addEventListener('click', handleBuyTicketWithDiamant);
  elements.ticketsWatchAdBtn.addEventListener('click', handleWatchAdForTicket);
  elements.ticketsIconCard.addEventListener('click', () => openTicketsEmptyModal());
  // Galeria de worlds: scroll nativo real (ver .world-viewport em main.css)
  // — o próprio navegador trata drag/touch/trackpad; só precisamos reagir ao
  // 'scroll' pra travar o world que parou no centro (ver
  // handleWorldGalleryScroll/handleWorldGalleryScrollEnd). Cada galeria de
  // fases (uma por world) já liga o próprio listener de 'scroll' sozinha, ao
  // ser construída (ver buildFaseGallery). { passive: true }: só leitura,
  // nunca preventDefault, então o navegador não precisa esperar o listener
  // rodar pra decidir se rola.
  elements.worldViewport.addEventListener('scroll', handleWorldGalleryScroll, { passive: true });
  // Responsivo: a galeria precisa preencher toda a largura/altura
  // disponível de verdade — um ResizeObserver na viewport (não só
  // 'window.resize') pega tanto resize/giro de tela quanto a correção do
  // tamanho logo depois do mount (ver comentário em galleryResizeObserver).
  galleryResizeObserver = new ResizeObserver(handleGalleryResize);
  galleryResizeObserver.observe(elements.worldViewport);

  // Pega a virada do dia mesmo se a aba tiver ficado aberta (loadPersistedState
  // já chama isso uma vez no boot, mas a Welcome pode reaparecer horas depois).
  resetDailyTicketsIfNeeded();

  renderPlayerInfo();
  renderSettings();
  refreshStageGallery();
  renderShop();
  startIdleAnimation();
}

export function HideWelcomeScreen() {
  if (!elements) return;
  stopIdleAnimation();
  stopTicketsCountdown();
  stopFaseCardAnimation();
  window.clearTimeout(worldScrollEndTimer);
  worldScrollEndTimer = null;
  window.clearTimeout(galleryResizeTimer);
  galleryResizeTimer = null;
  galleryResizeObserver?.disconnect();
  galleryResizeObserver = null;
  WORLDS.forEach((world) => window.clearTimeout(world.faseScrollEndTimer));
  offFullscreenChange(renderSettings);
  elements.screenRoot.remove();
  elements.modalRoot.remove();
  elements.collectionModalRoot.remove();
  elements.ticketsEmptyModalRoot.remove();
  elements.mapUnavailableModalRoot.remove();
  elements = null;
}
