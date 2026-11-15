# Decisões do projeto — RPG de navegador (inspiração: Dragon Oath)

## Regras de trabalho
- Toda decisão tomada é registrada neste documento.
- Decisões que afetam a jogabilidade são sempre perguntadas ao Lucas antes de serem adotadas.
- Decisões são enviadas como perguntas de múltipla escolha ou confirmação, para o Lucas não precisar digitar.
- Sempre avisar o Lucas quando houver dicas para economizar tokens.
- Economia de tokens: tarefas que não precisam do Opus (código de rotina, scaffolding, conteúdo repetitivo) vão para um modelo mais leve (Sonnet/Haiku); o Opus fica com design, revisão e decisões.
- **Melhorias sugeridas pelo Lucas:** cada sugestão é analisada e só entra na lista "Melhorias — Futuro" (fim deste documento) se o Lucas aprovar. Nada dessa lista é implementado até o Lucas pedir explicitamente. Quando implementada, a melhoria passa para "Melhorias — Feitas".

## Repositório e publicação
- **Código:** GitHub `Flushin/rpg-wuxia`, branch `main`. Cópia deste documento em `docs/decisoes-do-projeto.md`.
- **Publicação:** GitHub Pages, automática a cada push na `main` (GitHub Actions) — `https://flushin.github.io/rpg-wuxia/` (funcionando).
- **Ambiente do Lucas:** Windows sem admin, Node portátil em `C:\nodejs`, VSCode. O repositório tem `.vscode/settings.json` que coloca `C:\nodejs` no PATH do terminal.

## Plano de desenvolvimento
- **Marco 1 (concluído):** estrutura do projeto, cidade e floresta com placeholders, criação de personagem (2 seitas), movimento PC/celular, seleção de alvo, ataque básico, lobos com IA, XP/nível até 10, pontos de atributo, morte → cidade, HUD, save no IndexedDB.
- **Marco 2 (concluído):** skills das duas seitas + nível por uso, hotbar, painel de skills (K).
- **Marco 3 (concluído):** itens, equipamentos, durabilidade, drops, ferreiro e vendedor de poções, interação com NPCs.
- **Marco 4 (concluído):** auto-combate (menu de skills, poções) e ganho offline.
- **Marco 5 (concluído, em teste):** bandidos, guerreiros de terracota e o General de Terracota; balanceamento; **vários personagens**:
  - Tela inicial com **4 espaços**; cada um mostra nome, seita, nível, mapa e último acesso, com botões Jogar e Apagar (apagar pede para digitar o nome). O personagem atual vira o primeiro espaço.
  - Ganho offline vale só para o **último personagem jogado**.
  - Personagens **não compartilham** nada por enquanto (baú/ouro compartilhado pode vir depois).
- **Marco 6 (em andamento): gráficos — fatia pequena.** Definir o estilo de arte com **Tormenta + lobo + um trecho da floresta** antes de trocar o resto. Só depois estender para Geada, outros monstros, cidade e ruínas.
  - **Origem da arte:** pacotes gratuitos **CC0** (mesma linha do som). Créditos em `public/sprites/CREDITS.txt`.
  - **Primeira fatia (15/11/2026, feita):** Tormenta, lobo, árvores e piso da floresta já no jogo; retrato da Tormenta na mochila (fim da silhueta para ela). Detalhes em "Gráficos (marco 6)" abaixo.
  - **Próximos passos:** Geada (Mage do KayKit, mesmo esqueleto), bandidos e guerreiros/General de terracota (personagens KayKit recoloridos), NPCs, cidade (casas, praça), ruínas, água e portais.


## Decididas

### Gráficos (marco 6, 15/11/2026)
- **Método:** modelos **3D CC0** renderizados em sprites isométricos por um script do Blender. Motivo: quase não existem sprites 2D CC0 isométricos com cara de wuxia, e misturar pacotes 2D de autores diferentes quebra o estilo; renderizando tudo com a mesma câmera e luz, o estilo fica coeso.
- **Personagens:** linha **KayKit** (Kay Lousberg, CC0), estilo "cabeçudo" — escolhida no lugar da Quaternius porque já traz ataque com duas lâminas, mago (Geada) e esqueletos (base para os guerreiros de terracota), todos com o mesmo esqueleto e animações. **Tormenta = Rogue** recolorido (cabelo preto, túnica carmim, capa escura, cinto dourado).
- **Monstros:** lobo da Quaternius (Ultimate Animated Animals, CC0). Outros monstros: preferir KayKit recolorido.
- **Cenário:** **Nature Kit 3D da Kenney** (CC0) renderizado com a mesma câmera e luz dos personagens (em vez de pacotes 2D), com as cores trocadas para uma paleta de floresta. Piso (grama, caminho) em 2D gerado por script, sem frestas.
- **Estilo aprovado pelo Lucas:** personagem com **~48 px** de altura no zoom 100%; **sem contorno**; árvores do tamanho da prévia (bem mais altas que o personagem).
- **Padrões técnicos:** câmera isométrica 2:1 ortográfica; **8 direções**; animações **parado, andar, atacar, morrer**; render em **2×** mostrado em 0,5 (nitidez no celular/zoom); atlas recortado (máx. 2048×4096) com paleta de 256 cores. Render no Blender (Cycles na CPU, < 1 min no total). Como gerar: `tools/sprites/README.md`.
- **No jogo (só visual, sem mudar regras):** o personagem vira para onde anda e para o alvo em combate; golpe e skills tocam a animação de ataque; monstro morto mostra a queda (~1,4 s) antes de sumir; árvores na frente do jogador e do alvo ficam transparentes; alguns enfeites (grama, flores, cogumelos, pedrinhas) na grama da floresta, sem bloquear caminho.


### Base (15/11/2026)
- **Escala:** single-player primeiro. Multiplayer fica para uma fase futura, então a lógica do jogo (combate, status, IA) fica separada da renderização.
- **Plataformas:** navegador no computador **e** no celular.
- **Combate:** tab-target estilo Dragon Oath (selecionar alvo, auto-ataque, skills com cooldown na hotbar).
- **Visual:** 2D com sprites isométricos.
- **Arte da v1:** placeholders (formas simples) para testar a jogabilidade; arte definitiva depois.
- **Ambientação:** wuxia, com seitas como classes.
- **Experiência do dev:** intermediário (já fez projetos web).
- **Save:** local em cada aparelho (PC e celular têm progresso separado por enquanto).

### Idioma e nomes (15/11/2026)
- **Idioma:** o jogo terá **português e inglês**, escolhidos pelo jogador (textos separados por idioma).
- **Seitas:** nome de **uma palavra**, forte e conciso (como no Dragon Oath).
- **Skills:** nomes bonitos, mas curtos.
- **Troca de idioma:** botões PT | EN na tela inicial e nas configurações (⚙); trocar salva a escolha e recarrega a página. Na primeira vez, usa o idioma do navegador (português → PT; qualquer outro → EN).
- **Como funciona:** textos fixos usam `L('pt', 'en')` (`src/core/i18n.ts`); os JSON de dados continuam em PT e `src/data/en.json` traz só os textos em inglês. `npm run check:i18n` confere se falta alguma tradução.
- Os ids internos (`lamina`, `pavilhao`, `corte_duplo`…) continuam os mesmos para não quebrar saves; só os nomes exibidos mudaram.

| Antes | PT | EN |
|---|---|---|
| Montanha de Ferro | Titã | Titan |
| Lâmina Errante | Tormenta | Tempest |
| Pavilhão das Nuvens | Geada | Frost |
| Agulha Esmeralda | Víbora | Viper |

### Tecnologia (confirmada)
- TypeScript + Vite
- Phaser 3 para renderização/input (mouse e toque)
- Mapas isométricos feitos no Tiled (exportados em JSON)
- Dados de classes, skills, itens e monstros em arquivos JSON (data-driven)
- Save local em IndexedDB, com horário da última sessão (para calcular o ganho offline)

### Controles
- **PC:** clique para mover/selecionar alvo; Tab troca alvo; Espaço ataca o mais próximo; C abre atributos; skills na hotbar (teclado + clique).
- **Celular:** joystick virtual para mover; tocar no inimigo para selecionar; skills em botões na tela.
- Notebooks com tela touch: o mouse continua com clique-para-mover.
- **NPCs:** clicar/tocar no NPC → o personagem anda até ele e a janela de diálogo/loja abre sozinha (como no Dragon Oath).

### Modo idle
- **Auto-combate:** com o jogo aberto, o personagem caça monstros sozinho no mapa.
- **Menu do auto-combate:** o jogador escolhe quais habilidades o auto-combate usa.
- **Poções no auto-combate:** usa poções de HP e mana sozinho, com limites configuráveis no menu (padrão sugerido: HP abaixo de 40%, mana abaixo de 30%).
- **Morte no auto-combate:** o personagem volta para a cidade e retorna ao mapa para continuar caçando **somente se todos os itens equipados ainda tiverem durabilidade**. Se algum item chegar a 0, o auto-combate para e espera o jogador.
- **Área do auto-combate:** o mapa inteiro; ataca o monstro mais próximo **com nível até 2 acima do personagem**.
- **Ligar:** botão "Auto" no HUD + tecla Z; botão de engrenagem ao lado abre o menu (skills usadas, limites de poção, quantidade de poções a comprar, vender Incomuns). Qualquer movimento manual pausa o auto.
- **Sem poções (online):** volta à cidade, compra a quantidade definida no menu (se tiver ouro) e retorna a caçar; sem ouro, continua sem poção.
- **Mochila cheia (online):** vende automaticamente itens Comuns (opção no menu para vender também Incomuns); Incomuns/Raros que não couberem ficam no chão (60 s).
- **Ganho offline:** ao voltar, o jogador recebe XP, ouro e itens pelo tempo fora (o navegador não roda o jogo com a aba fechada), e gasta poções.
  - Só conta se o jogador saiu com o auto-combate ligado num mapa de caça.
  - **Cálculo pelo ritmo real:** mede monstros por minuto, XP/ouro/drops por abate e poções gastas por abate durante o auto-combate antes de sair.
  - **Eficiência por faixa de tempo:** 60% até 12 h · 40% de 12 h a 18 h · 20% de 18 h a 24 h · 0 depois de 24 h.
  - Sem morte e sem perda de durabilidade offline. Itens que não cabem na mochila são vendidos automaticamente. Se as poções acabarem offline, os ganhos continuam.
  - Tela de resumo "Enquanto você esteve fora" ao voltar.
- **Skills no idle:** ganham experiência de uso no auto-combate, mas **não** no ganho offline.

### Atributos
- **Strength:** dano físico.
- **Intelligence:** dano espiritual.
- **Stamina:** HP + defesa física.
- **Agility:** hit (precisão) + chance de crítico + dano crítico.
- **Willpower:** mana + defesa espiritual.
- **Recurso das skills:** mana.
- **Pontos por nível:** 5 — **2 automáticos** (conforme a seita) + **3 livres** para o jogador distribuir.
- **Recomendação no painel:** cada atributo tem explicação; os recomendados da seita aparecem marcados com o porquê.
  - Tormenta: **Strength** (dano físico) e **Agility** (acerto e crítico, combina com golpes rápidos).
  - Geada: **Intelligence** (dano espiritual) e **Willpower** (mana para as skills de área).
  - **Stamina** aparece como opcional para as duas, para quem morre muito.
- **Botão "Distribuir recomendado":** gasta os pontos livres sozinho seguindo a proporção recomendada da seita (definida em `classes.json`).

### Aprender jogando
- **Dicas contextuais:** aparecem uma única vez, na primeira vez que a situação acontece (entrar no jogo, primeiro portal, primeiro abate, primeiro nível, primeira morte; depois primeiro item, primeira skill etc.). Podem ser desligadas nas configurações.

### Elementos
- **Fire, Ice, Thunder, Poison** — cada um com ataque e resistência.

### Classes (seitas)
4 seitas: duas melee, duas ranged.
- **Titã (Titan):** melee, tanque, bastão/punhos.
- **Tormenta (Tempest):** melee, espadas duplas, dano rápido, dano físico, elemento **Thunder**. *(v1)*
- **Geada (Frost):** ranged, magia de qi, dano em área, dano espiritual, elemento **Ice**. *(v1)*
- **Víbora (Viper):** ranged, agulhas e veneno, dano contínuo + cura leve.

### Combate e skills
- **Ataque básico:** igual para todas as classes (hit básico, como no Dragon Oath).
- **Skills por classe na v1:** 4 ativas + 1 passiva, além do ataque básico, liberadas nos níveis 1, 3, 5, 7 e 9.
- **Nível das skills ativas:** sobe **pelo uso** — quanto mais a skill é usada, mais experiência ela acumula.
- **Nível das skills passivas:** sobe **junto com o nível do personagem**.

- **Nível máximo da skill:** 10; **+8% de efeito por nível**. Cada uso dá 1 de experiência; o nível 2 pede ~20 usos e os seguintes pedem cada vez mais.
- **Uso:** skills de alvo único usam o alvo selecionado (tab-target); se o alvo estiver fora do alcance, o melee anda até ele antes de usar.
- **Skills de área nunca exigem alvo:** saem na hora, gastando mana e cooldown mesmo sem monstro perto. Tempestade de Lâminas: em volta do personagem. Nevasca: no alvo selecionado se estiver no alcance; senão, em volta do personagem. Só ganham experiência se acertarem algum monstro.
- **Hotbar:** PC — teclas 1–4 e clique; celular — 4 botões em arco ao redor do botão de ataque (canto inferior direito).
- **Números iniciais (aprovados, ajustáveis no balanceamento):**
  - Presas Gêmeas 2×80% · cd 4 s · 8 mana
  - Passo do Raio: avança até 8 tiles, 120% · cd 10 s · 12 mana
  - Tempestade de Lâminas: 170% em volta, raio 2,5 · cd 12 s · 18 mana
  - Quebra-Guarda: 220% e −30% defesa por 6 s · cd 15 s · 20 mana
  - Fluxo da Lâmina: +10% velocidade de ataque, +5% crítico
  - Orbe Gélido: 130% · cd 3 s · 8 mana
  - Flor de Gelo: 110% + lentidão 40% por 4 s · cd 10 s · 14 mana
  - Nevasca: 180% em área no alvo · cd 14 s · 22 mana
  - Véu de Névoa: absorve 25% do HP máx. por 8 s · cd 20 s · 20 mana
  - Mente Serena: regenera 1% de mana/s fora da cidade

**Tormenta (Tempest)**
1. Presas Gêmeas · Twin Fangs (nv 1) — dois golpes rápidos
2. Passo do Raio · Lightning Step (nv 3) — avança até o alvo e causa dano
3. Tempestade de Lâminas · Blade Storm (nv 5) — dano em área ao redor
4. Quebra-Guarda · Guardbreak (nv 7) — dano alto e reduz a defesa do alvo
5. Fluxo da Lâmina · Blade Flow (nv 9, passiva) — mais velocidade de ataque e crítico

**Geada (Frost)**
1. Orbe Gélido · Frost Orb (nv 1) — projétil de magia
2. Flor de Gelo · Icebloom (nv 3) — dano e lentidão
3. Nevasca · Blizzard (nv 5) — dano em área no alvo
4. Véu de Névoa · Mist Veil (nv 7) — absorve dano
5. Mente Serena · Serene Mind (nv 9, passiva) — regeneração de mana

### Progressão (v1)
- Nível de personagem — **nível máximo 10** na v1.
- Nível de skills (ativas pelo uso, passivas pelo nível do personagem).
- Equipamentos: só alguns de cada tipo, para teste.

### Equipamentos e itens
- **Slots:** colar, tronco, arma, cabeça, calça, bota.
- Itens têm **durabilidade**.
- **Durabilidade 0:** o item para de dar atributos, mas não some.
- **Conserto:** ferreiro na cidade, por ouro — o ferreiro já funciona na v1.
- **Origem na v1:** equipamentos só caem de monstros (drop); poções caem de monstros e também são vendidas por um NPC na cidade.
- **Itens:** atributos fixos por base + raridade: **Comum** (branco), **Incomum** (verde, +1 bônus aleatório), **Raro** (azul, +2 bônus aleatórios). Nível mínimo para usar.
- **Lista de teste:** 2 bases por slot (nível 1 e nível 5). Arma separada por seita (espadas duplas / leque de qi).
- **Perda por morte:** −10% da durabilidade máxima em cada item equipado.
- **Desgaste por golpe:** cada golpe recebido tira 0,3 de durabilidade dos itens equipados (aprovado no marco 5).
- **Mochila:** 30 espaços; poções iguais empilham até 99. **Coleta automática** dos drops, com aviso do que foi pego.
- **Ouro:** cai dos monstros. O **vendedor de poções também compra qualquer item**.
- **Poções:** recuperam **ao longo de 8 s** (estilo Dragon Oath); não acumulam (usar outra do mesmo tipo reinicia o efeito). **Pequena:** 30%. **Grande:** 60%, mais cara, cai de monstros nível 5+ (até os bandidos existirem, só na loja). Atalhos no PC (Q = HP, E = mana) e botões no celular.

### Som
- **Origem:** pacotes gratuitos CC0 (Kenney: RPG Audio, Impact Sounds, UI Audio). Créditos em `public/audio/CREDITS.txt`.
- **Escopo:** efeitos de combate, progressão e interface + música ambiente (uma faixa para a cidade, outra para a floresta, com transição suave).
- **Controle:** volumes separados de efeitos e música + mudo, na engrenagem de configurações (padrão: efeitos 80, música 50).

### Regeneração e movimento em combate
- **HP e mana só regeneram na cidade:** 3% por segundo (após 5 s sem tomar dano). No mapa de caça, só poções (e passivas).
- **Ranged atacam andando:** o ataque básico continua no alvo enquanto o personagem anda (joystick ou clique). As skills dos ranged também poderão ser usadas andando (marco 2). Melee param para atacar.

### Morte
- O personagem volta para a cidade e os itens equipados perdem durabilidade.

### Monstros (v1)
- **Floresta:** lobos (nv 1–3, visão de 3 tiles) e bandidos (nv 4–6).
- **Renascimento:** monstros comuns renascem **30 s** após morrer; o General, 10 min. O tempo continua contando fora do mapa e fica no save.
- **Bandidos:** mistura de espadachins (andam em grupos de 2–3) e arqueiros (atacam de longe).
- **Novo mapa "Ruínas de Terracota"** (ligado à floresta): guerreiros de terracota (nv 7–9) e o General no fundo.
- **Guerreiros de Terracota:** defesa física ×2,4 e espiritual ×0,7 (ensina tipos de dano: Geada leva vantagem; Tormenta usa o Quebra-Guarda).
- **Chefe — General de Terracota (nv 10):** lento e resistente; golpe em área marcado no chão com círculo vermelho 1,5 s antes (dá para sair). Com 50% de HP invoca 2 guerreiros. Renasce 10 min após morrer. Drop garantido de item Raro nível 5.
- **Auto-combate ignora o chefe** e evita a área dele.
- **Escolha de alvo do auto (refeita em 15/11/2026, aprovada):**
  - **Revidar primeiro:** monstro que está atacando o personagem vira o alvo (o mais perto), mesmo acima do limite de nível; só depois procura monstros novos. Se o alvo atual já está na briga, termina ele.
  - **Evita atrair vários:** prefere alvos cujo caminho (e o próprio alvo) não fica na visão de outros monstros; pode escolher um um pouco mais longe.
  - **Perto primeiro:** prefere monstros até ~12 tiles de caminho; só atravessa o mapa se não houver nenhum perto.
  - **Correção do "parar do nada":** confere o caminho de até 16 candidatos (antes 4) e larga o alvo que não fica mais perto em 4 s (ignora por 15 s). Simulação: ritmo igual (Tormenta ~72 min, Geada ~46 min até o nível 10) e menos mortes (Tormenta ~1,3, Geada ~4,7).
- **Auto-combate (ajustes do marco 5, aprovados):** prefere monstros com nível ≥ (nível do personagem − 1), os mais fracos só se não houver outros; volta à cidade para descansar com HP < 35% e sem poção de vida; bebe poção mais cedo contra 2+ monstros.

### Balanceamento
- **Ritmo:** ~1 hora de jogo ativo para chegar ao nível 10.
- **Resultado da simulação:** Tormenta ~69 min (~3 mortes), Geada ~50 min (~7 mortes). Chefe: Tormenta vence 40% (Incomum) / 75% (Raro); Geada vence sempre recuando. Aceito por enquanto; ajustar depois de jogar. Detalhes em `docs/balanceamento.md`. Lobos ficaram mais fracos e com mais ouro.

### Escopo da primeira versão jogável
- 1 cidade com NPCs — funcionais: **ferreiro** (conserto) e **vendedor de poções**; os demais sem função.
- Floresta (lobos + bandidos) e Ruínas de Terracota (guerreiros + General).
- 2 classes: Tormenta e Geada.

## Em aberto (detalhes para a fase de balanceamento)
- Curva de XP até o nível 10
- Números de dano, cooldown e custo de mana das skills
- Lista de equipamentos de teste e taxas de drop
- Taxa exata do idle/offline e limite de horas
- Comportamento do chefe em detalhe (padrão de ataques, frequência de invocação/área)

## Notas de implementação (marco 3)
- Q/E usam a poção pequena primeiro, depois a grande. Um efeito ativo por tipo (HP/mana).
- Equipamentos dropam no nível do monstro; armas só da seita do personagem.
- Janela de NPC não bloqueia o movimento; fecha a mais de 3 tiles.
- Conserto custa `durabilidade faltante × nível do item × 0,5` (placeholder; lobo dá 2–6 de ouro). Preços: poção de vida P 12, G 36; mana P 14, G 40.

## Notas de implementação (marco 4)
- Offline usa valores esperados por abate (não sorteio individual), a partir dos últimos ~30 min de auto-combate (mínimo 2 min de dados).
- Viagem para comprar: só poções pequenas; dispara quando falta qualquer tipo e há ouro; intervalo mínimo de 120 s entre viagens.
- Ligar o Auto na cidade leva o personagem até o mapa de caça.
- Menu do auto-combate: botão ☰ ao lado do Auto (a engrenagem ⚙ é das configurações).

## Melhorias — Feitas
Implementadas a pedido do Lucas e publicadas no site.

### Interface (15/11/2026)
- **Botão fechar (X) no topo** *(PR #1)*: X fixo no canto superior direito (continua visível ao rolar) na mochila, atributos (C), skills (K), auto-combate e configurações; o botão de baixo continua. A janela de NPC/loja/ferreiro já tinha X. **Ficaram sem X:** tela de ganho offline e tela de criação.
- **Organizar mochila** *(PR #1)*: botão "Organizar" / "Sort". Ordem: equipamentos na ordem dos slots, depois poções; dentro disso, raridade (Raro > Incomum > Comum) e nível decrescente. Junta pilhas de poções iguais até 99.
- **Ícones nos slots de equipamento** *(PR #1)*: emoji no lugar das siglas — ⛑️ cabeça, 📿 colar, 👘 tronco, ⚔️ arma, 👖 calça, 👢 bota; esmaecidos nos slots vazios; o nome do slot continua no title/aria-label. Equipamentos na mochila também mostram o emoji (poções seguem HP/MP). Conferir como ficam no celular.
- **Atributos detalhados** *(PR #2)*: no painel C, cada atributo mostra o total e, embaixo, uma linha pequena "5 base + 14 níveis + 6 equip." (EN: base / levels / equip.). Níveis = pontos automáticos + livres; equipamento ignora itens com durabilidade 0. Função `attrBreakdown` em `src/core/stats.ts`. Conferir a largura em telas estreitas.
- **Abas na mochila** *(PR #3)*: abas **Equipamento** e **Poções** (com a quantidade de cada) acima da bolsa; cada aba mostra os itens dela e depois os espaços livres. O contador (x/30) e o "Organizar" continuam valendo para a mochila toda. Craft e Gemas entram quando esses sistemas existirem.
- **Corpo do personagem na mochila** *(PR #3)*: silhueta no centro (na cor da seita) com os slots em volta — à esquerda cabeça, colar e tronco; à direita arma, calça e bota. **Marco 6:** a Tormenta já mostra o retrato (sprite); a Geada troca quando ganhar arte.

### Câmera (15/11/2026)
- **Zoom** *(PR #3)*: roda do mouse no PC e pinça com dois dedos no celular. Só aproxima: 100% a 200% (gruda em 100%). Fica salvo no aparelho (`localStorage`, vale para todos os personagens).

### Gráficos (15/11/2026)
- **Nitidez no celular** *(PR #3)*: causa confirmada — o canvas era desenhado no tamanho CSS (modo `RESIZE` do Phaser) e o celular ampliava 2–3×. Agora o canvas é desenhado em tamanho × `devicePixelRatio` (limitado a 2×) e mostrado no tamanho CSS; a câmera compensa com zoom × DPR. Textos, nomes e efeitos ficam nítidos. Código em `src/render/display.ts`. **Marco 6:** os sprites novos são gerados em 2×, então ficam nítidos também; o que ainda é placeholder segue em 1×.

### Monstros (15/11/2026)
- **Renascimento com tempo** *(PR #3)*: corrigido o exploit de trocar de mapa para renascer todos. Cada monstro comum morto guarda o horário de renascimento (relógio real) pelo ponto de spawn (`mapa#índice`); o tempo continua fora do mapa e vai no save (`respawns`). Comuns: **30 s** (lobos eram 15 s; bandidos e terracota 35–40 s). General: 10 min, como já era. Simulação de balanceamento quase igual (Tormenta ~72 min, Geada ~52 min até o nível 10). Teste: `npm run check:respawn`.

## Melhorias — Futuro
Sugestões aprovadas pelo Lucas. **Só implementar quando ele pedir explicitamente.**

*(nenhuma pendente)*
