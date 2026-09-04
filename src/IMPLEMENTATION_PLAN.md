# Plano de implementação dos atributos globais

## Já implementado nesta etapa

- `gameState` persistente entre reinícios de cena para ouro, moedas, diamantes,
  XP, caminho do sprite e todos os atributos de upgrade.
- XP: cada inimigo morto concede `+1` XP.
- Camada Tiled `diamants`: cada tile vira um objeto coletável com emoji `💎`.
- Diamante coletado soma no contador global e no contador da fase.
- Inimigos podem soltar um diamante conforme `gameState.dropDiamant` (0 a 100).
- HUD mostra moedas e diamantes coletados na fase, além do XP global.

## Próximas implementações

1. **`isDoubleJump`**: controlar cargas de pulo no ar, resetando ao tocar o
   chão e consumindo uma carga ao segundo salto.
2. **`isJetpack`**: enquanto o botão de pulo estiver pressionado no ar,
   limitar a velocidade de queda.
3. **`bulluetDistance`**: guardar a distância percorrida em cada projétil e
   destruí-lo quando atingir esse limite.
4. **`BulletSequence`**: ao disparar, criar a quantidade de projéteis da
   sequência com espaçamento/direção definidos pelo sistema de tiro.
5. **`AljavaBullet`**: controlar munição disponível, impedindo disparos quando
   estiver vazia.
6. **`LoadingBullet`**: recarregar munição após o tempo configurado.
7. **`upgrade`**: definir catálogo, custo e aplicação dos upgrades usando
   `gold`, sem misturar moedas da fase com a carteira global.
8. **Persistência externa**: quando houver save/load, serializar `gameState`
   e validar os valores antes de restaurar.

Os itens acima estão somente planejados; os atributos já ficam disponíveis no
estado global sem ativar mecânicas novas.
