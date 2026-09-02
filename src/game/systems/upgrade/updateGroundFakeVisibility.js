const GROUND_FAKE_ALPHA = 1;
const INSIDE_GROUND_FAKE_ALPHA = 0;

/**
 * Esconde a ground-fake somente na área exclusiva dela (as células que não
 * existem na ground). Dessa forma, a camada continua visível no restante do
 * mapa e volta a aparecer quando o player sai da caverna.
 */
export function updateGroundFakeVisibility(scene) {
  const fakeLayer = scene.groundFakeLayer;
  const groundLayer = scene.groundLayer;
  const player = scene.player;

  if (!fakeLayer || !groundLayer || !player?.body) return;

  const body = player.body;
  const points = [
    [body.center.x, body.center.y],
    [body.center.x, body.bottom - 1],
  ];

  const isInside = points.some(([x, y]) => {
    const fakeTile = fakeLayer.getTileAtWorldXY(x, y);
    const groundTile = groundLayer.getTileAtWorldXY(x, y);

    return Boolean(fakeTile && fakeTile.index !== -1 && (!groundTile || groundTile.index === -1));
  });

  const targetAlpha = isInside ? INSIDE_GROUND_FAKE_ALPHA : GROUND_FAKE_ALPHA;
  if (fakeLayer.alpha !== targetAlpha) fakeLayer.setAlpha(targetAlpha);
}
