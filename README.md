# RPG Wuxia (Marco 1)

RPG isométrico no navegador (TypeScript + Vite + Phaser 3), combate tab-target.

## Como rodar

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # tsc --noEmit (strict) + build de produção em dist/
npm run maps      # regenera os mapas Tiled em public/maps/
```

## Controles

- PC: clique no chão para andar, clique no monstro para selecionar, `Tab` alterna alvos próximos, `Espaço` ataca o mais próximo, `C` abre atributos.
- Celular (detectado por toque): joystick à esquerda, toque no monstro para mirar, botão Atacar à direita.

## Estrutura

```
src/core/     lógica pura (sem Phaser): entidades, stats, combate, IA, A*, World.tick
src/data/     JSON: classes, monstros, progressão
src/render/   texturas geradas em runtime, views de mapa e entidades (Phaser)
src/scenes/   Boot, Create, Game (Phaser; só lê o estado do core e envia comandos)
src/ui/       HUD, painel de atributos, criação de personagem, controles (DOM)
src/save.ts   save em IndexedDB (idb-keyval)
tools/        gen-maps.mjs: gera os mapas isométricos (JSON Tiled) e tiles.png
public/maps/  cidade.json, floresta.json
```

O core roda com passo fixo (1/60 s) via `World.advance(dt)`; a renderização consome `world.events`.
Gancho de morte: `World.onPlayerDeath()` (TODO: perda de durabilidade).
