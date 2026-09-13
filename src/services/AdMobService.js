// Camada de integração com o Google AdMob via Capacitor
// (@capacitor-community/admob) — CLAUDE.md regra 3, mesmo esquema de
// CrazyGamesService.js: só funciona dentro do app nativo empacotado
// (Capacitor), nunca no navegador (web/CrazyGames), onde o plugin nativo
// nem existe. Fora do app nativo, toda função aqui vira um no-op silencioso
// — quem decide o fallback pro navegador é AdsService.js, não este arquivo.
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

// "rewarded" é o ID REAL da unidade "Anúncio que faz o usuário ganhar
// fichas", criada no console do AdMob pro HAGU. "banner"/"interstitial"
// ainda são os IDs de EXEMPLO do Google (nenhuma unidade real criada ainda
// pra esses formatos) — troque quando criar as suas.
//
// Usar o ID real aqui é seguro mesmo em teste: com `isTesting: true` (ver
// abaixo), o plugin só usa o ID real quando o APARELHO está cadastrado como
// "testing device" (AdMobInitializationOptions.testingDevices, em
// initAdMob()) — em qualquer outro aparelho ele troca sozinho pelo ID de
// exemplo do Google. Ou seja: sem cadastrar nenhum aparelho, é IMPOSSÍVEL
// gerar tráfego inválido sem querer, mesmo com o ID real no código.
const AD_UNIT_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-5974398786569434/9262774704',
};

// Cadastre aqui o ID do(s) seu(s) aparelho(s) de teste pra poder testar com
// o anúncio de verdade da unidade "rewarded" acima (não o de exemplo do
// Google) sem risco de tráfego inválido. Pra descobrir o ID: rode o app uma
// vez, filtre o logcat por "Ads" — a primeira tentativa de anúncio imprime
// uma linha tipo `Use RequestConfiguration.Builder().setTestDeviceIds(...)`
// com o ID hexadecimal do aparelho. Cole aqui dentro das aspas.
const TEST_DEVICE_IDS = [];

let ready = false;

function isSupported() {
  return Capacitor.isNativePlatform();
}

// IMPORTANTE: nunca devolva o objeto `AdMob` (importado no topo) de dentro
// de um `.then()`/`async function` sem antes ele já ter sido "esperado" —
// esse objeto é um proxy do Capacitor que responde a QUALQUER propriedade
// acessada, inclusive `.then`. Se ele for o valor de retorno de um
// `.then()`, o motor de Promises acha que é "thenable" e tenta encadear
// chamando `.then()` NELE — o que não existe de verdade no lado nativo e
// trava a Promise pra sempre (foi exatamente esse bug: "AdMob.then() is
// not implemented on android" travando o boot na tela de loading). Por
// isso getPlugin() é síncrona, nunca devolve o AdMob dentro de uma Promise.
function getPlugin() {
  return isSupported() ? AdMob : null;
}

// Nunca deixa o boot do app (ver main.js/Promise.all) travado esperando o
// AdMob pra sempre — se o SDK nativo demorar mais que isso (ou nunca
// responder, ex: Play Services desatualizado no aparelho), initAdMob()
// desiste e segue em frente com `ready = false`.
const INIT_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Chamado uma única vez, no boot do app (ver main.js) — precisa terminar
// antes das outras funções deste módulo terem efeito. Nunca rejeita (só
// resolve true/false) mesmo se o plugin nativo falhar ao carregar ou
// travar — todo o corpo roda dentro do try/catch, inclusive getPlugin().
export async function initAdMob() {
  try {
    const plugin = getPlugin();
    if (!plugin) return false;

    await withTimeout(
      plugin.initialize({
        initializeForTesting: TEST_DEVICE_IDS.length > 0,
        testingDevices: TEST_DEVICE_IDS,
      }),
      INIT_TIMEOUT_MS
    );
    ready = true;
  } catch (error) {
    console.warn('[AdMobService] Falha ao iniciar o AdMob:', error);
    ready = false;
  }
  return ready;
}

export async function showBannerAd() {
  const plugin = ready ? getPlugin() : null;
  if (!plugin) return;

  try {
    await plugin.showBanner({ adId: AD_UNIT_IDS.banner, isTesting: true });
  } catch (error) {
    console.warn('[AdMobService] Falha ao exibir banner:', error);
  }
}

export async function hideBannerAd() {
  const plugin = ready ? getPlugin() : null;
  if (!plugin) return;

  try {
    await plugin.hideBanner();
  } catch (error) {
    console.warn('[AdMobService] Falha ao esconder banner:', error);
  }
}

// Anúncio intersticial (tela cheia, sem recompensa) — chamado entre fases,
// nunca durante a run (mesma regra do requestMidrollAd em
// CrazyGamesService.js).
export async function showInterstitialAd() {
  const plugin = ready ? getPlugin() : null;
  if (!plugin) return;

  try {
    await plugin.prepareInterstitial({ adId: AD_UNIT_IDS.interstitial, isTesting: true });
    await plugin.showInterstitial();
  } catch (error) {
    console.warn('[AdMobService] Falha ao exibir intersticial:', error);
  }
}

// Anúncio recompensado. Devolve uma Promise que resolve `true` só quando o
// player assistiu até o fim e ganhou a recompensa, `false` em qualquer
// outro caso (fechou antes, erro ao carregar/exibir).
//
// showRewardVideoAd() do plugin SÓ resolve a própria Promise quando o
// prêmio é ganho — se o player fecha o anúncio antes, ela nunca resolve
// sozinha (fica pendurada pra sempre). Por isso escuta os eventos de
// "fechou"/"falhou ao mostrar" em paralelo e resolve por eles quando é o
// caso, sem esperar a Promise original.
//
// Diferente de CrazyGamesService.requestRewardedAd(), esta função NÃO cai
// pra `true` quando o AdMob está indisponível — quem decide esse fallback
// é AdsService.js, que escolhe qual serviço usar conforme a plataforma.
export function requestRewardedAd() {
  return new Promise((resolve) => {
    (async () => {
      const plugin = ready ? getPlugin() : null;
      if (!plugin) {
        resolve(false);
        return;
      }

      let settled = false;
      const listeners = [];
      const finish = (earned) => {
        if (settled) return;
        settled = true;
        listeners.forEach((listener) => listener.remove());
        resolve(earned);
      };

      try {
        listeners.push(await plugin.addListener('onRewardedVideoAdDismissed', () => finish(false)));
        listeners.push(await plugin.addListener('onRewardedVideoAdFailedToShow', () => finish(false)));

        await plugin.prepareRewardVideoAd({ adId: AD_UNIT_IDS.rewarded, isTesting: true });
        const reward = await plugin.showRewardVideoAd();
        finish(Boolean(reward));
      } catch (error) {
        console.warn('[AdMobService] Falha ao exibir anúncio recompensado:', error);
        finish(false);
      }
    })();
  });
}
