export function createRails(scene) {
  const rails = scene.physics.add.group({
    allowGravity: false,
    immovable: true
  }); 
  console.log(scene.railLayer)
  if (!scene.railLayer || !scene.railLayer.objects) return rails;

  scene.railLayer.objects.forEach((objectData) => {
    const width = objectData.width || 16;
    const height = objectData.height || 16;
    
    const x = objectData.x + width / 2;
    const y = objectData.y - height / 2;

    // Criamos direto pelo grupo para já herdar as configurações
    const rail = rails.create(x, y + 16, 'blue_block');
    
    rail.setDisplaySize(width, height);
    
    // Para uma plataforma móvel funcionar perfeitamente, ela DEVE ser immovable e não ter gravidade.
    rail.setImmovable(true);
    rail.body.setAllowGravity(false);
    
    // Inicia o movimento
    rail.setVelocityX(40);
    
    // Colisões
    scene.physics.add.collider(rail, scene.limits);
    scene.physics.add.collider(rail, scene.platforms);
    scene.physics.add.collider(rail, scene.player);
  });

  return rails;
}