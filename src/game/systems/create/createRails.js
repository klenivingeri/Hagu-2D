import { getVirtualFrame } from '../../commons/textureUtils.js';

export function createRails(scene, col = 0, row = 0) {
  const rails = scene.physics.add.group({
    allowGravity: false,
    immovable: true
  }); 
  console.log(scene.railLayer)
  if (!scene.railLayer || !scene.railLayer.objects) return rails;

  // Usa a função reutilizável da pasta commons
  const frameName = getVirtualFrame(scene, 'tileset_image', col, row);

  scene.railLayer.objects.forEach((objectData) => {
    const width = objectData.width || 16;
    const height = objectData.height || 16;
    
    const x = objectData.x + width / 2;
    const y = objectData.y - height / 2;

    // Cria um TileSprite usando a textura 'tileset_image' e o recorte (frameName)
    const rail = scene.add.tileSprite(x, y + 16, width, height, 'tileset_image', frameName);
    
    // Adiciona a física ao TileSprite
    scene.physics.add.existing(rail);
    
    // Adiciona ao grupo para organização e herança
    rails.add(rail);
    
    // Para uma plataforma móvel funcionar perfeitamente, ela DEVE ser immovable e não ter gravidade.
    rail.body.setImmovable(true);
    rail.body.setAllowGravity(false);
    
    // Inicia o movimento
    rail.body.setVelocityX(40);
    
    // Colisões
    scene.physics.add.collider(rail, scene.limits);
    scene.physics.add.collider(rail, scene.platforms);
    scene.physics.add.collider(rail, scene.player);
  });

  return rails;
}