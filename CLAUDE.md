# CLAUDE.md

## O projeto
Wanderers/Mistpeak: RPG wuxia de navegador (TypeScript, Vite, Capacitor/Android). Docs e textos em português do Brasil.

## Como rodar/testar
- `npm run dev` (servidor), `npm run build` (tsc + vite), `npm run typecheck`
- `npm test` (todos os `check:*`), `npm run check:layout`, `npm run maps`
- `npm run balance` / `sim:balance` (simulações de balanceamento)

## Mapa rápido
- `src/core/` lógica (combate, skills, itens, mapa, quests, save; `world/`)
- `src/data/` JSON de itens, monstros, skills, classes, NPCs, quests, balance, en
- `src/scenes/`, `src/ui/`, `src/render/`, `src/platform/`, `src/styles/` telas, interface, desenho, Android, CSS
- `wiki/index.html` + `src/wiki/`: wiki para jogadores (PT), gerada dos JSON de `src/data/`; publicada em `<site>/wiki/`; `npm run check:wiki` confere contra o jogo
- `tools/` scripts de checagem e geração; `docs/` documentação (`docs/decisoes/` decisões por tema, `docs/roadmap/`, `docs/arquivo/` histórico)

## Economia de contexto
- Não leia docs grandes inteiros: use grep e leia só a seção relevante.
- Antes de mudar regras do jogo, leia só o arquivo do tema em `docs/decisoes/` (índice em `docs/decisoes/README.md`).
- Ignore `docs/arquivo/` e `package-lock.json` salvo pedido explícito.
- Não crie relatórios .md grandes sem pedido.
- Mantenha este CLAUDE.md curto e atualize-o no mesmo commit das mudanças que o afetem.

## Uso de modelos (economia)
O modelo da sessão é escolhido pelo Lucas. Sempre que uma subtarefa não precisar do modelo principal, delegue-a a um subagente (ferramenta Agent) com modelo mais leve; este arquivo autoriza explicitamente definir `model` e `effort` nesses casos:
- `haiku`, esforço `low`: buscas, listar/ler arquivos, renomear, ajustar textos/números, formatação.
- `sonnet`, esforço `low` ou `medium`: edições mecânicas em vários arquivos, reorganizar docs, testes simples, bugs com causa conhecida.
- Modelo principal: arquitetura, regras de jogo/balanceamento, bugs difíceis, revisão final.

Só delegue tarefas autocontidas (o subagente começa sem contexto; tarefa minúscula sai mais barata feita direto). Dê instruções completas ao subagente e confira o resultado antes de subir. Se a sessão inteira for de tarefas simples, sugira ao Lucas trocar com `/model`.

## Git
Desenvolva na branch indicada pela sessão; commits em português.
