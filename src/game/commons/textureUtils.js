export function getVirtualFrame(scene, textureKey, col, row, totalCols = 16, totalRows = 16) {
  const texture = scene.textures.get(textureKey);
  if (!texture || !texture.source?.[0]) {
    throw new Error(`Textura "${textureKey}" não encontrada.`);
  }
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

export function getTextureKeyByImageName(scene, imageName, fallbackKey) {
  if (!imageName) return fallbackKey;

  const normalizedImageName = imageName.replace(/\\/g, '/').split('/').pop();
  const matchingKey = Object.keys(scene.textures.list).find((key) => {
    const source = scene.textures.get(key)?.source?.[0]?.image;
    const sourceName = source?.src?.replace(/\\/g, '/').split('/').pop();
    return sourceName === normalizedImageName;
  });

  return matchingKey || fallbackKey;
}
