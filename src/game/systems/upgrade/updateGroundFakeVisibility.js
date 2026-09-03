const GROUND_FAKE_ALPHA = 1;
const INSIDE_GROUND_FAKE_ALPHA = 0;

/**
 * Esconde a ground-fake somente na área exclusiva dela (as células que não
 * existem na ground). Dessa forma, a camada continua visível no restante do
 * mapa e volta a aparecer quando o player sai da caverna.
 *
 * Roda todo frame incondicionalmente, então evitamos criar array/closure
 * aqui dentro (antes: `[[x,y],[x,y]].some(...)` alocava os dois a cada
 * chamada, 60x por segundo, mesmo quando o player está longe da caverna).
 */
export function updateGroundFakeVisibility(scene) {
  const fakeLayer = scene.groundFakeLayer;
  const groundLayer = scene.groundLayer;
  const player = scene.player;

  if (!fakeLayer || !groundLayer || !player?.body) return;

  const body = player.body;
  const centerX = body.center.x;

  const isInside = isPointInsideFake(fakeLayer, groundLayer, centerX, body.center.y)
    || isPointInsideFake(fakeLayer, groundLayer, centerX, body.bottom - 1);

  const targetAlpha = isInside ? INSIDE_GROUND_FAKE_ALPHA : GROUND_FAKE_ALPHA;
  if (fakeLayer.alpha !== targetAlpha) fakeLayer.setAlpha(targetAlpha);
}

function isPointInsideFake(fakeLayer, groundLayer, x, y) {
  const fakeTile = fakeLayer.getTileAtWorldXY(x, y);
  const groundTile = groundLayer.getTileAtWorldXY(x, y);

  return Boolean(fakeTile && fakeTile.index !== -1 && (!groundTile || groundTile.index === -1));
}
