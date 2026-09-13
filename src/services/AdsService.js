// Fachada que decide qual backend de anúncio usar conforme onde o jogo
// está rodando — pensada pra ser reaproveitada em jogos futuros sem mudar
// nada nas telas que pedem anúncio (elas só importam DAQUI, nunca de
// CrazyGamesService.js ou AdMobService.js diretamente):
//   - App nativo empacotado (Capacitor/Android/iOS) -> AdMobService.js
//   - Navegador (CrazyGames ou qualquer outro host)  -> CrazyGamesService.js
// Fora dos dois ambientes (dev local sem SDK nenhum), cai no fallback de
// "conceder de graça" já existente em CrazyGamesService.requestRewardedAd().
import { Capacitor } from '@capacitor/core';
import { requestRewardedAd as requestCrazyGamesRewardedAd } from './CrazyGamesService.js';
import { requestRewardedAd as requestAdMobRewardedAd } from './AdMobService.js';

export function requestRewardedAd() {
  if (Capacitor.isNativePlatform()) return requestAdMobRewardedAd();
  return requestCrazyGamesRewardedAd();
}
