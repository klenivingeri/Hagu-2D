#Camadas de Fundo (Background Layers)

Essas camadas servem para criar a atmosfera, o cenário distante e dar profundidade ao mundo. O jogador não interage fisicamente com elas.

## Sky / Horizon (Céu e Fundo Distante):
A camada mais ao fundo. Em jogos 2D, costuma usar o efeito de Parallax Scrolling (movimento mais lento que a câmera) para simular horizonte ou estrelas.

## Far Background / Parallax (Cenário Secundário):
Montanhas distantes, silhuetas de prédios ou árvores longínquas.

## Near Background (Decoração de Fundo):
Paredes de cavernas, papel de parede de uma casa, janelas, vinhas na parede ou pilastras. Fica logo atrás dos personagens, mas não bloqueia o movimento.

# Camadas de Jogo (Gameplay & Collision Layers)
O coração interativo do mapa. É onde as regras do jogo, a física e a navegação acontecem.

## Ground / Floor (Chão Base):
A camada principal onde o jogador e os inimigos andam. Geralmente recebe a Tilemap Collider (colisão física).

## Walls / Obstacles (Paredes e Barreiras):
Paredes sólidas, troncos grossos, pedras e limites de mapa que impedem a passagem.

## Mid-Ground / Interactables (Elementos na altura do jogador):
Coisas que ficam na mesma altura dos personagens, como portas, baús, placas e interruptores.

# Camadas de Primeiro Plano (Foreground Layers)
Essas camadas ficam na frente do jogador e dos NPCs, criando um efeito de imersão e profundidade (o personagem passa "por trás" do objeto).

## Over-Player / Canopy (Cobertura):
 Copas de árvores densas, vigas de telhado, lâmpadas penduradas ou arcos de pedra. Quando o jogador passa por baixo, ele fica parcialmente encoberto.

## Foreground Parallax / Dust (Detalhes da Câmera):
 Folhas caindo, partículas de poeira na lente, grades ou molduras de janelas coladas na tela para simular que a câmera está escondida.