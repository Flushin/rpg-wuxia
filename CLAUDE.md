# CLAUDE.md

## O projeto
Wanderers/Mistpeak: RPG wuxia de navegador (TypeScript, Vite, Capacitor/Android). Docs e textos em português do Brasil.

## Como rodar/testar
- `npm run dev` (servidor), `npm run build` (tsc + vite), `npm run typecheck`
- `npm test` (todos os `check:*`), `npm run check:layout`, `npm run maps`
- **Antes de todo commit:** `npm run format` (Prettier) e `npm run format:check`; o CI roda `format:check` antes dos testes
  e falha por qualquer arquivo fora do estilo, até um que você não mexeu.
- Screenshot de teste (Playwright): chame `semDicas(page)` de `tools/sem-dicas.mjs` antes, para a dica não cobrir a tela
- `npm run balance` / `sim:balance` (simulações de balanceamento)
- `npm run novidades:loja` (texto "O que há de novo" da Play Store)
- APK só sob pedido: Actions → "APK Android" → Run workflow (release com novidades desde o último APK; `npm run novidades:apk`)

## Mapa rápido
- `src/core/` lógica (combate, skills, itens, mapa, quests, save, masmorras em `dungeons.ts`, Trial em `trial.ts`, bots de combate (montagem, IA, luta simulada; masmorra em equipe e arena) em `bots.ts` (no mundo: `world/party.ts`), teleporte em `teleport.ts`, ultimate em `ultimate.ts` (+ `ultimates.json`), gemas/encaixes em `world/gems.ts` (+ `items.json` "gems", janelas em `ui/gemShop.ts`), rotas do mapa-múndi em `worldRoutes.ts`; noite do Porto Noturno (véu, halos, barcos) em `render/nightView.ts`; portal em portão de ferro que abre ao chegar perto (padrão reaproveitável, prop `gate: 'ferro'`; variante `'porta'` da Cidadela: portas abrem para fora) em `render/ironGate.ts`; `world/`)
- `src/data/` JSON de itens, monstros, skills, classes, NPCs, quests, balance, en; trajes (skins) por seita em `skins.json` (Governador Bai); montarias em `mounts.json` (Cavalariço Ma, estábulo do Porto Noturno); relíquias em `relics.json` (Antiquário Lao, janelas em `ui/relicShop.ts`)
- `src/scenes/`, `src/ui/`, `src/render/`, `src/platform/`, `src/styles/` telas, interface, desenho, Android, CSS
- HUD novo do celular: posições de Atacar/skills/poções/arco da ultimate em `src/ui/thumbLayout.ts`
- Janelas que se redesenham abertas usam `renderPanel()` de `src/ui/panelRender.ts` (mantém rolagem); nunca `innerHTML` direto
- `wiki/index.html` + `src/wiki/`: wiki para jogadores (PT), gerada dos JSON de `src/data/`; publicada em `<site>/wiki/`; `npm run check:wiki` confere contra o jogo
- `tools/` scripts de checagem e geração; `docs/` documentação (`docs/decisoes/` decisões por tema, `docs/roadmap/`, `docs/arquivo/` histórico)

## Wiki (regra)
Toda mudança no jogo que afete algo mostrado na wiki atualiza a wiki **no mesmo commit/PR**.
- Números e listas dos JSON (`src/data/`, `public/maps/`) já saem atualizados; confira a página afetada.
- Regras copiadas em `src/wiki/` (fórmulas de combate, forja, offline, skills, preços, constantes) e textos à mão
  (`src/wiki/mechanics.ts`, papéis dos NPCs em `src/wiki/npcs.ts`, comportamento de monstros) precisam ser editados junto.
- Conteúdo novo (item, monstro, NPC, mapa, skill, seita, mecânica) ganha página/entrada na wiki; `npm run check:wiki` deve passar.

## Novidades (regra)
PR com **conteúdo novo** para o jogador (não correção nem ajuste) acrescenta um item em `"proxima"` de `src/data/novidades.json`
(+ tradução em `en.json` "novidades"). Ao subir a `version` do `package.json`, mova os itens para uma entrada nova no topo de
`"versoes"` (com data); `npm run check:novidades` exige essa entrada. Se o texto da loja passar de 500 caracteres,
ponha um resumo em `"loja"` na entrada (PT e EN). Texto da Play Store: `npm run novidades:loja`.

## Economia de contexto
- Não leia docs grandes inteiros: use grep e leia só a seção relevante.
- Antes de mudar regras do jogo, leia só o arquivo do tema em `docs/decisoes/` (índice em `docs/decisoes/README.md`).
- Ignore `docs/arquivo/` e `package-lock.json` salvo pedido explícito.
- Não crie relatórios .md grandes sem pedido.
- Mantenha este CLAUDE.md curto e atualize-o no mesmo commit das mudanças que o afetem.
- Leitura: grep antes, depois só o intervalo de linhas relevante; não releia arquivo que acabou de editar.
  Nunca leia `node_modules/`, `dist/`, pastas `build/`, `*.min.js`, `*.map`.
- Buscas amplas (muitos arquivos): subagente Explore/haiku, trazendo só a conclusão.
- Testes: rode só o `check:*` afetado (ex.: `npm run check:items`), não `npm test` inteiro; `npm test` só antes de subir.
- Saídas longas sempre limitadas (`| tail -40`); em build/typecheck mostre só os erros. Não repita comando só para confirmar.
- Resposta final: resumo curto (arquivo alterado + 1 linha do que mudou); sem narrar passos, sem diffs/código salvo pedido.

## Uso de modelos (economia)
O modelo da sessão é escolhido pelo Lucas. Sempre que uma subtarefa não precisar do modelo principal, delegue-a a um subagente (ferramenta Agent) com modelo mais leve; este arquivo autoriza explicitamente definir `model` e `effort` nesses casos:
- `haiku`, esforço `low`: buscas, listar/ler arquivos, renomear, ajustar textos/números, formatação.
- `sonnet`, esforço `low` ou `medium`: edições mecânicas em vários arquivos, reorganizar docs, testes simples, bugs com causa conhecida.
- Modelo principal: arquitetura, regras de jogo/balanceamento, bugs difíceis, revisão final.

Só delegue tarefas autocontidas (o subagente começa sem contexto; tarefa minúscula sai mais barata feita direto). Dê instruções completas ao subagente e confira o resultado antes de subir. Se a sessão inteira for de tarefas simples, sugira ao Lucas trocar com `/model`.

## Perguntas ao Lucas
Sempre mande perguntas e decisões como opções clicáveis (ferramenta AskUserQuestion), nunca só em texto para ele digitar.

## Git
Desenvolva na branch indicada pela sessão; commits em português.
Antes de merge na `main`: `npm test` completo local e o check "Testes" do PR verde (o deploy roda `npm test` e não publica se falhar).
