export const resizeCollider = (player) => {
  // --- AJUSTE DA ÁREA DE COLISÃO ---
    const originalWidth = player.width;
    const originalHeight = player.height;

    // Defina o novo tamanho (ex: 80% da largura e 70% da altura)
    const newWidth = originalWidth * 0.8;
    const newHeight = originalHeight * 0.7;

    // Calcula o offset para centralizar na horizontal e empurrar para baixo (reduzindo o topo)
    const offsetX = (originalWidth - newWidth) / 2;
    const offsetY = originalHeight - newHeight; // Faz a caixa ficar alinhada mais embaixo

    return {
      newWidth,
      newHeight,
      offsetX,
      offsetY
    }
}