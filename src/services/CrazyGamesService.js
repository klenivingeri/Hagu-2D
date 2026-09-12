// Camada de integração com o SDK da CrazyGames (crazygames.com) — CLAUDE.md
// regra 3, mesmo esquema de StorageService/HapticsService: nenhuma tela ou
// cena deve importar window.CrazyGames direto. Fora da plataforma CrazyGames
// (dev local, build hospedado em outro lugar) o script do SDK nem chega a
// carregar (ver <script> em index.html), então toda função aqui precisa
// tolerar window.CrazyGames ausente sem quebrar o jogo.
import { LOADING_EVENTS, RUN_EVENTS, PAUSE_EVENTS, SETTINGS_EVENTS, GAME_OVER_EVENTS } from '../constants.js';

let ready = false;

function getSdk() {
  return typeof window !== 'undefined' ? window.CrazyGames?.SDK : null;
}

// Chamado uma única vez, no boot (ver main.js), antes de qualquer tela
// aparecer. Precisa terminar (await) antes das outras funções deste módulo
// terem efeito — enquanto isso, elas ficam silenciosamente sem fazer nada.
export async function initCrazyGamesSdk() {
  const sdk = getSdk();
  if (!sdk) return false;

  try {
    await sdk.init();
    ready = true;
  } catch (error) {
    console.warn('[CrazyGamesService] Falha ao iniciar o SDK:', error);
    ready = false;
  }
  return ready;
}

function callSdk(fn) {
  const sdk = ready ? getSdk() : null;
  if (!sdk) return;
  try {
    fn(sdk);
  } catch (error) {
    console.warn('[CrazyGamesService] Falha ao chamar o SDK:', error);
  }
}

// Marca o carregamento inicial do app e o de cada fase (tela de loading, ver
// LoadingScreen.js) — usado pela plataforma só pra métricas de performance.
export function notifyLoadingStart() {
  callSdk((sdk) => sdk.game.loadingStart());
}

export function notifyLoadingStop() {
  callSdk((sdk) => sdk.game.loadingStop());
}

// Chamado sempre que o player está de fato jogando (run em andamento, sem
// nenhum modal de pausa/configurações/resumo/game over aberto) — a
// plataforma usa isso pra decidir quando pode exibir anúncios midroll sem
// interromper a jogatina.
export function notifyGameplayStart() {
  callSdk((sdk) => sdk.game.gameplayStart());
}

export function notifyGameplayStop() {
  callSdk((sdk) => sdk.game.gameplayStop());
}

// Confete no site da CrazyGames — reservado pra conquistas grandes (aqui:
// fechar uma fase com as 3 estrelas, ver GameScene.completeRun()). Usar com
// moderação (recomendação da própria CrazyGames), nunca em toda fase.
export function celebrate() {
  callSdk((sdk) => sdk.game.happytime());
}

// Progresso geral do jogo (0-100) reportado à plataforma.
export function reportCompletionPercentage(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  callSdk((sdk) => sdk.game.reportGameCompletedPercentage(clamped));
}

// Anúncio recompensado (ver WelcomeScreen.js/handleWatchAdForTicket). Devolve
// uma Promise que resolve `true` só quando o player assistiu até o fim;
// fechar/errar resolve `false`. Fora da CrazyGames (SDK não inicializado)
// não existe anúncio nenhum pra mostrar, então resolve `true` — preserva o
// comportamento antigo de conceder a ficha de graça nesses ambientes em vez
// de travar a função pra sempre.
export function requestRewardedAd() {
  return new Promise((resolve) => {
    const sdk = ready ? getSdk() : null;
    if (!sdk) {
      resolve(true);
      return;
    }

    try {
      sdk.ad.requestAd('rewarded', {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    } catch (error) {
      console.warn('[CrazyGamesService] Falha ao solicitar anúncio recompensado:', error);
      resolve(false);
    }
  });
}

// Anúncio midroll, chamado entre fases (nunca durante a run) — ver main.js/
// backToWelcome. Sem retorno: o próprio SDK cuida de pausar o jogo em volta
// do anúncio.
export function requestMidrollAd() {
  callSdk((sdk) => sdk.ad.requestAd('midroll', {}));
}

const boundGames = new WeakSet();

// Liga os eventos do jogo (Phaser) ao lifecycle do SDK. Chame uma vez por
// Phaser.Game (main.js chama a cada startMatch, um Game novo por partida) —
// mesmo esquema de BindLoadingEvents/BindHudEvents.
export function BindCrazyGamesEvents(game) {
  if (boundGames.has(game)) return;
  boundGames.add(game);

  // Loading da fase (ver GameScene.create()) termina = gameplay realmente
  // começa. Dispara de novo em cada scene.restart() (respawn), exatamente
  // quando a CrazyGames espera um novo gameplayStart() ("resumes after a
  // break"/revive — ver docs.crazygames.com/sdk/game).
  game.events.on(LOADING_EVENTS.COMPLETE, () => {
    notifyLoadingStop();
    notifyGameplayStart();
  });

  // Qualquer modal em HTML que pausa a run (pausa manual, configurações,
  // resumo da fase, game over) conta como interrupção pro SDK.
  game.events.on(PAUSE_EVENTS.OPEN, notifyGameplayStop);
  game.events.on(SETTINGS_EVENTS.OPEN, notifyGameplayStop);
  game.events.on(RUN_EVENTS.COMPLETE, notifyGameplayStop);
  game.events.on(GAME_OVER_EVENTS.OPEN, notifyGameplayStop);
}
