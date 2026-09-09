import Phaser from 'phaser';
import { MAP_DEPTHS } from '../../../constants.js';
import { getTiledProperty } from '../../commons/tiledUtils.js';

const PORTAL_FRAME_COUNT = 6;
const PORTAL_FRAME_SIZE = 32;
const PORTAL_ANIMATION_KEY = 'portal-animation';

export function preloadPortalAssets(scene) {
  for (let frame = 0; frame < PORTAL_FRAME_COUNT; frame += 1) {
    scene.load.image(`portal_${frame}`, `assets/portal/portal_${frame}.png`);
  }
}

export function createPortalAnimations(scene) {
  if (scene.anims.exists(PORTAL_ANIMATION_KEY)) return;

  scene.anims.create({
    key: PORTAL_ANIMATION_KEY,
    frames: Array.from({ length: PORTAL_FRAME_COUNT }, (_, frame) => ({
      key: `portal_${frame}`
    })),
    frameRate: 8,
    repeat: -1
  });
}

export function createPortals(scene, portalLayer) {
  const portals = [];
  if (!portalLayer?.objects) return portals;

  portalLayer.objects.forEach((objectData) => {
    const width = objectData.width || PORTAL_FRAME_SIZE;
    const height = objectData.height || PORTAL_FRAME_SIZE;
    // A altura do retângulo no Tiled define a altura final do portal. Como os
    // frames são quadrados, a largura acompanha essa altura e pode ultrapassar
    // as laterais estreitas do objeto.
    const spriteHeight = height;
    const spriteWidth = spriteHeight;
    const centerX = objectData.x + width / 2;
    const centerY = objectData.y + height / 2;
    const portal = scene.add.sprite(
      centerX,
      centerY,
      'portal_0'
    );

    // O frame permanece centralizado e a máscara mantém somente a área do
    // ObjectLayer portal visível.
    portal.setDisplaySize(spriteWidth, spriteHeight);
    const maskArea = scene.make.graphics({ add: false });
    maskArea.fillRect(objectData.x, objectData.y, width, height);
    portal.setMask(new Phaser.Display.Masks.GeometryMask(scene, maskArea));
    portal.setDepth(MAP_DEPTHS.PORTAL);
    portal.play(PORTAL_ANIMATION_KEY);

    // "key" (propriedade customizada do objeto no Tiled) é a map key que
    // esse portal libera na Welcome ao terminar a run — ver
    // GameScene.completeRun() e GameManager.unlockMap(). Sem "key" o portal
    // só é decorativo (não encerra a run).
    portal.unlockMapKey = getTiledProperty(objectData.properties, 'key') || null;
    if (portal.unlockMapKey) {
      scene.physics.add.existing(portal, true);
      portal.body.setSize(width, height);
      portal.body.setOffset((spriteWidth - width) / 2, (spriteHeight - height) / 2);
    }

    portals.push(portal);
  });

  return portals;
}
