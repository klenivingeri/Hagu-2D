# Phaser + Vite + Tailwind — Template

Template base para continuar um jogo com **Vite + JavaScript Vanilla + Phaser + Tailwind CSS**.

## Stack

- Vite
- JavaScript Vanilla / ES Modules
- Phaser 4
- Tailwind CSS 4
- `@tailwindcss/vite`

## Rodar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Estrutura

```text
src/
├── components/          # UI reutilizável
├── screens/             # Telas/estados de UI
├── styles/
│   └── main.css         # Tailwind + layout global
├── game/
│   ├── config/
│   │   └── gameConfig.js
│   ├── scenes/
│   │   └── GameScene.js
│   └── systems/
│       ├── createBulletSystem.js
│       ├── createControls.js
│       ├── createEnemy.js
│       ├── createPlayer.js
│       └── createWorld.js
└── main.js
```

## Onde continuar o jogo

A cena principal está em `src/game/scenes/GameScene.js`.

A ideia é manter a cena responsável por orquestrar o jogo e deixar cada responsabilidade em `game/systems/`.

### Tiled

Quando o mapa Tiled entrar no projeto, substitua a implementação de `createWorld.js` pelo carregamento do `.tmj` e tileset. A separação já está preparada para isso.

## Controles

### Teclado

- `A` / `←` — esquerda
- `D` / `→` — direita
- `W` / `↑` — pular
- `Espaço` — atirar

### Mobile

Os botões HTML usam Pointer Events e funcionam com mouse e touch.

## Observação

O template usa formas desenhadas pelo Phaser em vez de imagens externas para funcionar imediatamente após `npm install`.
