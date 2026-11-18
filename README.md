# Mistpeak

RPG de ação wuxia no navegador (PC e celular), isométrico, com combate tab-target, auto-combate e ganho offline.
TypeScript + Vite + Phaser 3. Versão atual: ver `package.json` (aparece no canto da tela inicial).

- Jogar: https://flushin.github.io/rpg-wuxia/ (publicado a cada push na `main`).
- Decisões do projeto: [`docs/decisoes-do-projeto.md`](docs/decisoes-do-projeto.md) — **leia antes de mudar regras**.
- Auditoria e plano de refatoração: [`AUDITORIA.md`](AUDITORIA.md).

## Como rodar

```bash
npm install
npm run dev         # servidor de desenvolvimento
npm run build       # tsc --noEmit (strict) + build de produção em dist/
npm test            # os 8 testes de regra (check:*) — também rodam no GitHub Actions
npm run sim:balance # simulador de balanceamento (determinístico: mesma semente = mesmo resultado)
npm run balance     # módulo de balanceamento: lista ou muda em % (ex.: npm run balance -- xp.monstros +10%)
npm run maps        # regenera os mapas em public/maps/ a partir de tools/gen-maps.mjs
npm run format      # formata o código com o Prettier (format:check só confere; roda no CI)
```

Teste de sobreposição do HUD (precisa do Playwright e de um preview rodando):
`npm run build && npx vite preview --port 4173` e, em outro terminal, `npm run check:layout`.

Trailer (vídeo promocional gravado do próprio jogo): veja [`tools/trailer/README.md`](tools/trailer/README.md).

## Controles

- PC: `WASD`/setas ou clique no chão para andar, clique no monstro para selecionar, `Tab` alterna alvos, `Espaço` ataca o mais próximo,
  `1`–`4` skills, `Q`/`E` poções, `Z` auto-combate, `C` atributos, `K` skills, `I` mochila, `M` mapa, `Esc` fecha janelas.
- Celular: joystick flutuante na metade esquerda, toque no monstro para mirar, botão Atacar e skills em arco à direita.

## Estrutura

```
src/core/     regras do jogo, sem Phaser: World (estado + tick de 1/60 s), combate, auto-combate, itens, missões, offline, A*
src/data/     JSON de dados (PT) + en.json (traduções); src/data/sprites/ = animações e âncoras das folhas
src/render/   desenho no Phaser: mapa, entidades, efeitos de skill, áudio
src/scenes/   Boot (carrega), Create (tela inicial, 4 personagens), Game (loop: core → tela)
src/ui/       HUD e janelas em HTML (DOM) por cima do canvas
src/save.ts   saves no IndexedDB (idb-keyval)
public/       servido como está: maps/ (cidade, floresta, ruínas), sprites/ (atlas), audio/, icons/, manifest, sw.js
tools/        testes (*-check.ts), simulador (balance-sim.ts), gerador de mapas, teste de layout
tools/sprites/ renderiza os sprites a partir de modelos 3D CC0 no Blender — veja o README de lá
docs/         decisões, balanceamento, notas de música
```

O core roda com passo fixo via `World.advance(dt)`; a cena consome `world.events` para desenhar efeitos, sons e avisos.
Documentação fica em `docs/` ou na raiz: só vai para o site o que está em `public/` e o que o build gera.
