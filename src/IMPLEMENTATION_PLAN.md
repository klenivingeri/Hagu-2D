# Plano de implementação dos atributos globais

## Já implementado nesta etapa

- `gameState` (agora em `/src/managers/GameManager.js`, conforme CLAUDE.md/
  GUIDELINES.md) persistente entre reinícios de cena para ouro, moedas,
  diamantes, XP, caminho do sprite e todos os atributos de upgrade.
- XP: cada inimigo morto concede `+1` XP.
- Camada Tiled `diamants`: cada tile vira um objeto coletável com emoji `💎`.
- Diamante coletado soma no contador global e no contador da fase.
- Inimigos podem soltar um diamante conforme `gameState.dropDiamant` (0 a 100).
- HUD mostra moedas e diamantes coletados na fase, além do XP global.
- `isDoubleJump`: pulo extra disponível uma vez por período no ar, resetado
  ao tocar o chão (ver `hasUsedDoubleJump` em `updatePlayerMovement.js`).
- `isParachute`: segurar o pulo enquanto cai no ar abre o paraquedas, que
  reduz a velocidade de queda pra evitar morte por queda. Sem limite de uso/
  combustível — some ao tocar o chão ou tomar dano (ver `updatePlayerMovement.js`).
- `isJetpack`: segurar o pulo no ar impulsiona o player pra cima
  (`jetpackLiftSpeed`), consumindo `jetpackFuelMs` de combustível. Pousar
  recarrega. Uma barra ao lado do player (`game/commons/jetpackBar.js`)
  mostra o combustível restante.

## Próximas implementações

1. **`bulluetDistance`**: guardar a distância percorrida em cada projétil e
   destruí-lo quando atingir esse limite.
2. **`BulletSequence`**: ao disparar, criar a quantidade de projéteis da
   sequência com espaçamento/direção definidos pelo sistema de tiro.
3. **`AljavaBullet`**: controlar munição disponível, impedindo disparos quando
   estiver vazia.
4. **`LoadingBullet`**: recarregar munição após o tempo configurado.
5. **`upgrade`**: definir catálogo, custo e aplicação dos upgrades usando
   `gold`, sem misturar moedas da fase com a carteira global.
6. **Persistência externa**: quando houver save/load, serializar `gameState`
   e validar os valores antes de restaurar, usando exclusivamente
   `/src/services/StorageService.js` (já criado, ainda não conectado ao
   `GameManager`).

Os itens acima estão somente planejados; os atributos já ficam disponíveis no
estado global sem ativar mecânicas novas.
