# Visão Geral do Projeto
Jogo 2D (HTML5/CSS3/Tailwind/JS ESM/Vite/Phaser v3).

## Tech Stack & Ferramentas
- **Estilos/UI**: Tailwind CSS para menus e HUDs sobrepostos ao canvas.
- **Frontend/Telas (SPA)**: HTML5, Tailwind CSS, JavaScript moderno (ESM) para HUD, menus, loja, inventário e seleção de fases.
- **Game Engine (Run)**: Phaser v4.x, usado estritamente dentro da cena/fase de gameplay.
- **Bundler**:  Vite (assets estáticos em `/public/assets/`).

## Comandos
- `npm run dev` — Servidor de desenvolvimento.
- `npm run build` — Build de produção.

## Arquitetura e Organização de Pastas
- `/src/components/` ou telas HTML — Telas de Welcome, Shop, Atributos, Coleções e Pós-jogo.
- `/src/game/` — Código exclusivo do Phaser (Cenas de gameplay, entidades, física).
- `/src/managers/GameManager.js` — Gerenciador de estado global compartilhado entre as telas HTML e o Phaser.
- `/src/services/StorageService.js` — Camada de persistência desacoplada (preparada para Web/IndexedDB e futuro Android Native).

## Padrões e Regras de Desenvolvimento (OBRIGATÓRIO)
1. **Separação de Domínios**: Nunca misture elementos de DOM/HTML dentro do código do Phaser e vice-versa. A UI de fora é gerida por HTML/Tailwind; o canvas do Phaser gerencia apenas a "Run" do jogo.
2. **Estado Compartilhado**: Toda leitura e escrita de dados (moedas, progresso, fases) deve passar pelo `/src/managers/GameManager.js`.
3. **Storage Desacoplado**: Proibido usar `localStorage` direto nas telas ou no Phaser. Utilize sempre a camada de serviço (`storage.save` / `storage.load`) para garantir portabilidade futura para a Play Store (WebView/Capacitor).
4. **Ciclo de Vida do Phaser**: O Phaser (`Phaser.Game`) deve ser instanciado apenas quando a partida começar e destruído/removido do DOM (`game.destroy(true)`) quando o jogador voltar para os menus HTML, evitando vazamento de memória.
5. **Performance no Update**: **Nunca** crie novas instâncias (ex: `new Vector2()`, arrays) dentro do método `update()`. Reutilize objetos para evitar o Garbage Collector.
6. **Física e Colisões**: Prefira usar grupos do Phaser (`this.physics.add.group`) para gerenciar múltiplos elementos e otimizar colisões.
7. **Estilo & Funções**: Prefira funções curtas e limpas (early return, sem nesting profundo).

## Arquitetura Multiplataforma (Web -> Mobile / WebView)
2. **Ciclo de Vida do App**: O jogo deve pausar automaticamente (`this.scene.pause()`) quando o app for para segundo plano (essencial para Webviews no Android).
3. **Áudio e Assets**: O carregamento deve tolerar políticas restritivas de autoplay de áudio comuns em Webviews móveis (requer clique inicial do usuário).

## Diretrizes Gerais
- Siga também as regras de arquitetura e qualidade descritas em `GUIDELINES.md`.