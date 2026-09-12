export const resizeCollider = (player) => {
    const originalWidth = player.width;
    const originalHeight = player.height;

    const newWidth = originalWidth * 0.8;
    const newHeight = originalHeight * 0.6;

    const offsetX = (originalWidth - newWidth) / 2;
    const offsetY = originalHeight - newHeight;

    return {
      newWidth,
      newHeight,
      offsetX,
      offsetY
    }
}