import { getNextMapKey } from '../../config/maps.js';
import { unlockMap } from '../../../managers/GameManager.js';

// Lê a camada de objetos "gate" (ver game/config/maps.js) e cria uma zona de
// overlap pra cada porta. Quando o player passa por ela, libera de imediato
// (antes de chegar no portal do fim da run) a próxima fase da sequência
// (world.id, fase) — ver getNextMapKey(). Sem propriedade customizada
// nenhuma no Tiled.
export function createGates(scene) {
  const gateLayer = scene.gateLayer;
  const gates = [];
  if (!gateLayer?.objects?.length || !scene.player) return gates;

  const mapKeyToUnlock = getNextMapKey(scene.mapKey);
  if (!mapKeyToUnlock) return gates;

  gateLayer.objects.forEach((objectData) => {
    const zone = scene.add.zone(
      objectData.x + objectData.width / 2,
      objectData.y + objectData.height / 2,
      objectData.width,
      objectData.height
    );
    scene.physics.add.existing(zone, true);
    zone.body.setSize(objectData.width, objectData.height);

    scene.physics.add.overlap(scene.player, zone, () => {
      unlockMap(mapKeyToUnlock);
    });

    gates.push(zone);
  });

  return gates;
}
