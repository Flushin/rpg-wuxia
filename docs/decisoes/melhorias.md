## Melhorias — Feitas
Implementadas a pedido do Lucas e publicadas no site.

### Interface (15/11/2026)
- **Botão fechar (X) no topo** *(PR #1)*: X fixo no canto superior direito (continua visível ao rolar) na mochila, atributos (C), skills (K), auto-combate e configurações; o botão de baixo continua. A janela de NPC/loja/ferreiro já tinha X. **Ficaram sem X:** tela de ganho offline e tela de criação.
- **Organizar mochila** *(PR #1)*: botão "Organizar" / "Sort". Ordem: equipamentos na ordem dos slots, depois poções; dentro disso, raridade (Raro > Incomum > Comum) e nível decrescente. Junta pilhas de poções iguais até 99.
- **Ícones nos slots de equipamento** *(PR #1)*: emoji no lugar das siglas — ⛑️ cabeça, 📿 colar, 👘 tronco, ⚔️ arma, 👖 calça, 👢 bota; esmaecidos nos slots vazios; o nome do slot continua no title/aria-label. Equipamentos na mochila também mostram o emoji (poções seguem HP/MP). Conferir como ficam no celular.
- **Atributos detalhados** *(PR #2)*: no painel C, cada atributo mostra o total e, embaixo, uma linha pequena "5 base + 14 níveis + 6 equip." (EN: base / levels / equip.). Níveis = pontos automáticos + livres; equipamento ignora itens com durabilidade 0. Função `attrBreakdown` em `src/core/stats.ts`. Conferir a largura em telas estreitas.
- **Abas na mochila** *(PR #3)*: abas **Equipamento** e **Poções** (com a quantidade de cada) acima da bolsa; cada aba mostra os itens dela e depois os espaços livres. O "Organizar" vale para a mochila toda; o contador (x/30) é da aba aberta, porque cada aba tem 30 espaços próprios. Craft e Gemas entram quando esses sistemas existirem.
- **Corpo do personagem na mochila** *(PR #3)*: silhueta no centro (na cor da seita) com os slots em volta — à esquerda cabeça, colar e tronco; à direita arma, calça e bota. **Marco 6:** Tormenta e Geada já mostram o retrato (sprite).

- **Minimapa** *(PR #8)*: no canto superior direito, acima do nome do mapa (os botões descem um pouco). Mapa em losango com as cores dos tiles; personagem (branco), monstros (pontinhos vermelhos minúsculos), chefe (laranja, maior), NPCs (amarelo) e portais (losango roxo). **Mapa grande:** tecla **M** ou toque/clique no minimapa; mostra também os nomes dos portais e NPCs e uma legenda; fecha com M, Esc, X ou tocando fora. Atualiza a cada 0,15 s. Código em `src/ui/minimap.ts`. Testado no PC e no celular (em pé e deitado).

- **Layout do celular deitado** *(PR #9)*: em telas deitadas com pouca altura (até 450 px, ex.: Galaxy Z Fold fechado ≈ 920×316) os botões se sobrepunham. Agora: topo direito numa linha só (minimapa menor, Auto, ☰, ⚙ e Skills/Atributos/Mochila como ícones 📜 💪 🎒; nome do mapa escondido); quadro do alvo abaixo do quadro do personagem; poções ao lado do joystick; arco de skills mais baixo e compacto; avisos menores. Em pé, o quadro do alvo foi para a esquerda, abaixo do quadro do personagem (o minimapa empurrava os botões para cima dele). Teste automático mede sobreposições em 4 tamanhos de celular.

### Câmera (15/11/2026)
- **Zoom** *(PR #3)*: roda do mouse no PC e pinça com dois dedos no celular. Só aproxima: 100% a 200% (gruda em 100%). Fica salvo no aparelho (`localStorage`, vale para todos os personagens).

### Gráficos (15/11/2026)
- **Nitidez no celular** *(PR #3)*: causa confirmada — o canvas era desenhado no tamanho CSS (modo `RESIZE` do Phaser) e o celular ampliava 2–3×. Agora o canvas é desenhado em tamanho × `devicePixelRatio` (limitado a 2×) e mostrado no tamanho CSS; a câmera compensa com zoom × DPR. Textos, nomes e efeitos ficam nítidos. Código em `src/render/display.ts`. **Marco 6:** os sprites novos são gerados em 2×, então ficam nítidos também; o que ainda é placeholder segue em 1×.

### Monstros (15/11/2026)
- **Renascimento com tempo** *(PR #3)*: corrigido o exploit de trocar de mapa para renascer todos. Cada monstro comum morto guarda o horário de renascimento (relógio real) pelo ponto de spawn (`mapa#índice`); o tempo continua fora do mapa e vai no save (`respawns`). Comuns: **30 s** (lobos eram 15 s; bandidos e terracota 35–40 s). General: 10 min, como já era. Simulação de balanceamento quase igual (Tormenta ~72 min, Geada ~52 min até o nível 10). Teste: `npm run check:respawn`.

### Interface (16/11/2026)
- **Recompensas fora do meio da tela** *(PR #11)*: o aviso no centro ao matar saiu.
  - **Ouro no quadro do personagem:** nova linha 💰 com o total; cada ganho mostra um "+12" pequeno ao lado, que some sozinho em ~2,5 s. Abates seguidos **somam** no mesmo número.
  - **XP:** a barra de XP brilha a cada ganho (sem aviso).
  - **Feed de itens** à esquerda, abaixo do quadro do personagem (ou do quadro do alvo, quando ele fica empilhado à esquerda). Cada linha some em ~3 s; itens iguais se agrupam ("×3"); cor pela raridade. **Fold fechado / celular deitado baixo:** até 2 linhas, texto menor; **demais telas e PC:** até 4.
  - **Filtro (⚙):** "Avisar todos os itens coletados" — desligado por padrão (só Incomum e Raro). Fica salvo no aparelho (`localStorage`). Tudo continua indo para a mochila normalmente.
  - Os outros avisos (nível, skill nova, mochila cheia, morte, chefe) continuam no centro.
  - Por causa da linha de ouro, o quadro do alvo empilhado à esquerda desceu um pouco (celular em pé e deitado).
  - **Teste de sobreposição** agora fica no repositório: `tools/layout-check.mjs` (6 tamanhos, incluindo **Fold fechado 920×316** e **Fold aberto 884×1028**, com o feed cheio e o quadro do alvo visível). Código do feed em `src/ui/rewards.ts`.

- **Reportar bug** *(PR #15, pedido pelo Lucas em 16/11/2026)*: botão **🐞 Reportar bug** em ⚙. Abre uma caixa onde o jogador
  escreve o que aconteceu (e, se quiser, nome/contato) e envia. O report chega **por e-mail** para o Lucas pelo **Web3Forms**
  (grátis, 250 envios/mês; o plano grátis não tem anexo, por isso **sem print** — escolha do Lucas).
  - **Vai junto automaticamente:** versão e commit do build; personagem, seita, nível, mapa, posição, HP, auto-combate, missão e alvo;
    navegador, tela/janela, DPR, em pé/deitado, toque/mouse, idioma; FPS médio e "pior 1%" dos últimos 10 s; últimos 10 erros do console.
  - Limite de **1 report por minuto** por aparelho. Digitar na caixa não aciona os atalhos do jogo.
  - **Chave:** `BUG_REPORT_KEY` em `src/ui/bugReport.ts` (é pública por natureza; só envia e-mail para o dono). Sem chave, o botão
    mostra "ainda não configurado".

- **Correções para iPhone e skills** *(PR #18, 16/11/2026)*: no iPhone deitado o Safari aumentava sozinho o texto
  (faltava `text-size-adjust: 100%`), cortando a interface; dicas no celular deitado baixo agora ficam embaixo, no meio, compactas.
  Nomes de monstros e do jogador ficam sempre por cima (árvores não cortam mais). Skills prontas não ficam mais apagadas (a camada
  escura de "bloqueada" cobria todas): **só ficam apagadas em recarga**; sem mana continua a borda azul.

- **Tamanho da interface e zoom do navegador** *(PR #19, pedido pelo Lucas em 16/11/2026)*: no celular deitado tudo ficava
  pequeno demais (telas até 450 px de altura entram no modo compacto), e no iPhone o pinça às vezes ampliava a página em vez do jogo,
  quebrando o HUD.
  - **⚙ "Tamanho da interface":** Automático (padrão) / Pequena (100%, como antes) / Normal (115%) / Grande (130%), salvo em cada
    aparelho (`localStorage` `rpg-ui-size`). O HUD inteiro (quadros, botões, skills, joystick, janelas) cresce na mesma proporção.
  - **Automático:** só no toque com o aparelho deitado: **120%** em celulares como o iPhone Pro Max (~932×430) e **115%** no Fold
    fechado (~920×316). Em pé, no Fold aberto e no PC continua 100%.
  - **Limite para caber:** a escala nunca passa do que cabe sem sobreposição (deitado: tela virtual com pelo menos 270 px de altura;
    em pé: 360 px de largura). Ex.: Grande no Fold fechado vira ~117%.
  - **Feed de itens:** se não houver espaço até o joystick, vai para o lado do quadro do personagem.
  - **Zoom do mundo continua em 100%** (pinça no mapa segue funcionando).
  - **Zoom do navegador bloqueado:** pinça (eventos de gesto do Safari e dois dedos) e toque duplo (`touch-action: manipulation`
    nos botões). Se a página ainda assim ficar ampliada, aparece um aviso ("Página ampliada — afaste dois dedos") e o gesto é
    liberado para o jogador voltar ao normal.
  - **Código:** `src/ui/uiScale.ts`, `src/ui/noBrowserZoom.ts`. `tools/layout-check.mjs` agora testa cada tamanho com interface
    Automática e Grande e inclui o **iPhone Pro Max deitado 932×430**.

- **Joystick flutuante** *(PR #20, pedido pelo Lucas em 17/11/2026 — em teste, pode voltar atrás)*: jogadores de iPhone
  reclamavam que o dedo "escapava" do joystick.
  - **Tocar em qualquer lugar da metade esquerda da tela** cria o joystick embaixo do dedo (área invisível `#joy-zone`, por baixo
    de todo o HUD; botões, quadros e poções continuam funcionando por cima dela).
  - **A base segue o dedo:** se o dedo passa do limite, o círculo vai junto em vez de o pino travar.
  - Parado, o círculo fica no lugar de sempre, meio transparente, como guia; ao soltar, volta para lá.
  - **Toque em monstro ou NPC na metade esquerda** continua selecionando/abrindo a conversa (não abre o joystick).
  - **Efeito colateral:** a pinça para dar zoom no jogo só funciona começando na metade direita da tela.
  - **Rollback:** reverter o PR #20. Ideias não feitas (B margens de segurança do iPhone, D área maior, E eventos de toque,
    F diagnóstico no report) ficam disponíveis se o problema continuar.
  - Código: `setupJoystick` em `src/ui/controls.ts`; `tapAt`/`pickAt` em `src/scenes/gameScene.ts`.

- **Skills sobrepostas no celular deitado** *(PR #21, 17/11/2026)*: erro antigo do layout deitado (PR #9), não da escala da
  interface: o arco usava botões de 46 px com só 28° entre eles, então um encostava no outro. Agora o espaço entre os botões é
  calculado para sobrar pelo menos 6 px (~36°). Em pé não mudou. O `layout-check` passou a comparar os botões redondos entre si
  (antes ignorava as skills umas com as outras, por isso não pegou).

- **Mochila voltando para o topo** *(PR #22, 17/11/2026)*: com o auto ligado, cada mudança no inventário (golpe recebido
  gastando durabilidade, item coletado, poção usada) redesenhava a mochila inteira, e a rolagem voltava para o topo.
  Agora a posição da rolagem é mantida, e mudanças vindas do jogo esperam o jogador parar de rolar (~0,7 s depois de soltar o
  dedo) para redesenhar. Ações do próprio jogador (tocar num item, equipar, trocar de aba) continuam na hora.
  - **Reforço (PR #23):** a moldura que rola (`.inv-card`) passou a ser criada uma vez só; a cada mudança só o conteúdo de dentro
    é trocado, então a rolagem nunca é perdida (antes a moldura inteira era recriada e a posição era restaurada depois).
  - **Centralizado (19/11/2026):** as outras janelas (Skills, Atributos, NPC, Masmorras) ainda voltavam ao topo com o auto
    atacando. Agora toda janela que se redesenha aberta usa `renderPanel()` (`src/ui/panelRender.ts`): compara o HTML novo com
    o da tela e só troca o que mudou, mantendo elementos, rolagem, foco e hover. Ajustes de redesenho valem para todas as janelas
    ali. Regra: eventos das janelas ficam no elemento raiz (delegação), nunca em elementos internos.

- **Tela "Créditos e licenças"** *(17/11/2026, pedida pelo Lucas a partir do `AUDITORIA_DIREITOS.md`)*: abre por um link
  discreto no rodapé da tela inicial (ao lado da versão) e pelo botão "Créditos e licenças" em ⚙. Mostra quem fez o jogo, os
  créditos de arte e som (todos CC0) e as bibliotecas com o texto completo da licença (toca para abrir). As licenças MIT e
  Apache-2.0 exigem esse aviso no app. Os textos vêm dos arquivos de `docs/licencas/`, sem cópia. Fecha com X, Fechar,
  toque fora ou Esc. Código: `src/ui/credits.ts`. Registro de assets: `ASSETS_LICENCAS.md`.

- **Novidades / "Édito da Seita"** *(19/11/2026, decidido pelo Lucas)*: anúncio do que há de novo para os jogadores.
  **Só conteúdo novo** (seita, mapa, monstro, item, sistema); correções de bug e ajustes de mecânica não entram.
  Anuncia **só quando a `version` do `package.json` sobe** (junta vários PRs). Fonte única: `src/data/novidades.json`
  (+ `en.json` "novidades"); cada PR com conteúdo novo põe um item em `"proxima"`, e ao subir a versão os itens viram
  uma entrada nova no topo de `"versoes"` com a data. No jogo: a janela abre sozinha **uma vez** na tela inicial após a
  atualização, para quem já tem personagem; quem não tem só vê o ponto dourado no botão "Novidades" (rodapé da tela
  inicial e ⚙). Título temático ("Édito da Seita · vX.Y.Z"), itens diretos, com "ver na wiki". Na wiki: página
  `#/novidades` com o histórico. Play Store: `npm run novidades:loja` gera o "O que há de novo" (pt-BR/en-US, até 500
  caracteres). `npm run check:novidades` exige entrada para a versão do `package.json`, links da wiki válidos e o limite
  da loja. Primeira entrada: v0.1.0 (o jogo atual). Código: `src/core/novidades.ts`, `src/ui/novidades.ts`,
  `src/wiki/novidades.ts`. Preferência no aparelho: `rpg-news-seen`.
- **iPhone (app na tela inicial)** *(27/11/2026)*: joystick por eventos de toque (`touch*`), que solta sozinho quando o
  dedo dele não está mais na tela (o Safari perdia o `pointerup` e o joystick travava); solta também em segundo plano.
  HUD usa 18px das margens laterais do iPhone deitado (`html.iphone`, ilha fica fora); janelas mantêm a margem inteira.
  `-webkit-touch-callout: none`. Letra Roboto no iPhone (a do Android; só latino, ~90 KB, baixada só lá). `check:layout` testa o 17 Pro Max real (956×440, margens 62/62/20, não entra na ilha).

## Melhorias — Futuro
Sugestões aprovadas pelo Lucas. **Só implementar quando ele pedir explicitamente.**

- **Monetização (18/11/2026):** anúncio com recompensa opcional e pacotes de diamantes para itens fixos da loja. Fora da
  1ª versão. Antes de fazer: Google Play Billing, consentimento (UMP), proteger os diamantes pagos (save só no aparelho)
  e refazer política, Data Safety e classificação indicativa (`AUDITORIA_DIREITOS.md` §4.5).
