import Phaser from 'phaser';
import { MAP_DEPTHS, HUD_EVENTS } from '../../../constants.js';
import { GOLD_BAG_MIN_COINS, GOLD_BAG_MAX_COINS } from '../../../managers/GameManager.js';
import { emitDustTrail } from '../../commons/dustTrail.js';

// Item colecionável que um inimigo pode soltar ao morrer (ver
// EnemyBase.killEnemy()/GOLD_BAG_DROP_CHANCE_PERCENT em GameManager.js).
// Ao cair toca o som de drop (drop_bag_gold) e, como qualquer outro corpo
// físico, tem gravidade e colide com plataformas/limites (mesmas layers do
// EnemyBase.js) — solta poeira ao aterrissar. Ao ser coletado NÃO toca esse
// som de novo — em vez disso dispara a animação/som de coleta de moeda
// ('coin', mesma da createCoins.js) uma vez pra cada moeda guardada dentro
// do saco, em sequência.
const COIN_POP_DELAY_MS = 150; // intervalo entre cada "pop" de moeda ao abrir o saco
const BAG_SCALE = 0.7; // bag_of_gold.png é 16x16 — um pouco menor que um tile cheio

export function preloadGoldBagAssets(scene) {
  scene.load.image('bag_of_gold', 'assets/tiledmap/bag_of_gold.png');
  scene.load.audio('drop_bag_gold', 'assets/sounds/drop_bag_gold.mp3');
}

export function createGoldBagDropGroup(scene) {
  // Precisa cair de verdade (gravidade) e colidir com o cenário — mesmas
  // duas layers que qualquer inimigo usa (ver EnemyBase.spawnEnemyBase).
  // `immovable` só impede que o saco seja empurrado por outros corpos
  // (ex: o player encostando), não afeta a queda pela gravidade.
  const bags = scene.physics.add.group({ allowGravity: true, immovable: true });

  scene.physics.add.collider(bags, scene.limits);
  scene.physics.add.collider(bags, scene.platforms, (bag) => {
    if (!bag.active || bag.hasLanded) return;
    bag.hasLanded = true;
    emitDustTrail(scene, bag, 'horizontal', true);
  });

  scene.physics.add.overlap(scene.player, bags, (_player, bag) => {
    // Stomp mata o inimigo com o player já em cima da posição de queda —
    // sem essa trava, a coleta rolaria por overlap antes da bag encostar no
    // chão (nunca chegando a "aparecer" caindo pro jogador).
    if (!bag.active || bag.isCollecting || !bag.hasLanded) return;
    bag.isCollecting = true;
    bag.body.enable = false;
    bag.setVisible(false);

    popCoinsSequentially(scene, bag.x, bag.y, bag.coinAmount, () => bag.destroy());
  });

  scene.goldBags = bags;
  return bags;
}

export function spawnGoldBagDrop(scene, x, y) {
  if (!scene.goldBags) return;

  const bag = scene.goldBags.create(x, y, 'bag_of_gold');
  bag.setDepth(MAP_DEPTHS.GOLD_BAG);
  bag.setScale(BAG_SCALE);
  bag.body.setAllowGravity(true);
  bag.hasLanded = false;
  bag.coinAmount = Phaser.Math.Between(GOLD_BAG_MIN_COINS, GOLD_BAG_MAX_COINS);

  // Volume um pouco acima do padrão (1) — o áudio original do drop_bag_gold.mp3
  // soa baixo perto dos outros efeitos (tiro/impacto).
  scene.sound.play('drop_bag_gold', { volume: 1.6 });
}

// Dá as moedas do saco uma de cada vez, cada uma com seu próprio efeito
// visual (sprite 'coin' animado subindo/sumindo) e som de coleta — em vez
// de creditar tudo de uma vez, deixa claro pro jogador quantas moedas
// vieram do saco.
function popCoinsSequentially(scene, x, y, amount, onComplete) {
  let collected = 0;

  const popOne = () => {
    if (collected >= amount || !scene.player?.status) {
      onComplete?.();
      return;
    }
    collected += 1;

    // Só acumula em levelCoins (sessão da run) — commit no saldo persistido
    // (GameManager.addGlobalCoins) só em GameScene.completeRun(), mesma
    // regra da Coleção/moedas normais (ver createCoins.js).
    const value = scene.player.status.coinValue || 1;
    scene.player.levelCoins = (scene.player.levelCoins || 0) + value;
    scene.player.status.totalCoins += value;
    scene.sound.play('coin');
    scene.game.events.emit(HUD_EVENTS.COINS_CHANGED, scene.player.levelCoins);

    const burst = scene.add.sprite(x, y, 'coin').setDepth(MAP_DEPTHS.COINS);
    burst.anims.play('coin');
    scene.tweens.add({
      targets: burst,
      y: y - 24,
      scale: 0.9,
      alpha: 0,
      duration: 300,
      onComplete: () => burst.destroy(),
    });

    scene.time.delayedCall(COIN_POP_DELAY_MS, popOne);
  };

  popOne();
}
