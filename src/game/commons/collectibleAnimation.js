export function animateCollectible(scene, target) {
  target.collectibleTween = scene.tweens.add({
    targets: target, y: target.y - 3, scaleX: 0.68, scaleY: 1.12,
    duration: 650, ease: 'Sine.inOut', yoyo: true, repeat: -1,
  });
  return target.collectibleTween;
}

export function stopCollectibleAnimation(target) {
  if (target.collectibleTween) {
    target.collectibleTween.stop();
    target.collectibleTween = null;
  }
}
