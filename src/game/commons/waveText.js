import { MAP_DEPTHS } from '../../constants.js';

// Coreografia da animação de "onda" das letras: nasce com um pequeno atraso
// entre uma letra e outra, sobe, desce, e entra num bob infinito ao final
// (ver createPlayer.showDeathText, primeiro lugar que usou esse efeito).
const DEFAULT_LETTER_SPACING = 7;
const DEFAULT_FONT_SIZE = '12px';
const DEFAULT_STROKE_THICKNESS = 2;
const LETTER_STAGGER_MS = 110;
const RISE_DURATION_MS = 260;
const RISE_OFFSET_PX = 18;
const IDLE_BOB_DURATION_MS = 850;
const IDLE_BOB_OFFSET_PX = 10;

// Cria um texto em "onda" (uma letra por vez, subindo/descendo) dentro de um
// Container — assim quem chama pode seguir um alvo que se move (setPosition)
// sem perder a fase/tween de cada letra individual. Quem cria é responsável
// por chamar destroy() quando o texto não fizer mais sentido (ex: carga
// cancelada, player morreu).
export function createWaveText(scene, word, x, y, {
  color = '#ffffff',
  fontSize = DEFAULT_FONT_SIZE,
  spacing = DEFAULT_LETTER_SPACING,
  strokeThickness = DEFAULT_STROKE_THICKNESS,
  riseOffset = RISE_OFFSET_PX,
  idleBobOffset = IDLE_BOB_OFFSET_PX,
} = {}) {
  const container = scene.add.container(x, y);
  container.setDepth(MAP_DEPTHS.LIMITS + 1);

  const startX = -((word.length - 1) * spacing) / 2;
  const timers = [];

  [...word].forEach((letter, index) => {
    const timer = scene.time.delayedCall(index * LETTER_STAGGER_MS, () => {
      const text = scene.add.text(startX + index * spacing, 0, letter, {
        color,
        fontFamily: 'Arial Black, sans-serif',
        fontSize,
        stroke: '#1b0b0b',
        strokeThickness,
      });
      text.setOrigin(0.5, 1);
      container.add(text);

      scene.tweens.add({
        targets: text,
        y: -riseOffset,
        duration: RISE_DURATION_MS,
        ease: 'Sine.Out',
        onComplete: () => {
          scene.tweens.add({
            targets: text,
            y: 0,
            duration: RISE_DURATION_MS,
            ease: 'Sine.In',
            onComplete: () => {
              scene.tweens.add({
                targets: text,
                y: -idleBobOffset,
                duration: IDLE_BOB_DURATION_MS,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1,
              });
            },
          });
        },
      });
    });
    timers.push(timer);
  });

  return {
    setPosition(nx, ny) {
      container.setPosition(nx, ny);
    },
    destroy() {
      timers.forEach((timer) => timer.remove());
      scene.tweens.killTweensOf(container.list);
      container.destroy();
    },
  };
}
