export function getVirtualFrame(scene, textureKey, col, row, totalCols = 16, totalRows = 16) {
  const texture = scene.textures.get(textureKey);
  const frameName = `${textureKey}_frame_${col}_${row}`;
  
  // Se ainda não criamos esse recorte, nós criamos agora
  if (!texture.has(frameName)) {
    // Calcula o tamanho de cada bloco dividindo a imagem total
    const frameWidth = texture.source[0].width / totalCols;
    const frameHeight = texture.source[0].height / totalRows;
    
    const cropX = col * frameWidth;
    const cropY = row * frameHeight;
    
    // Cria um frame virtual dentro da textura original
    texture.add(frameName, 0, cropX, cropY, frameWidth, frameHeight);
  }
  
  return frameName;
}
