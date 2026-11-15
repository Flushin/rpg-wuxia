# Decisões do projeto — RPG de navegador (inspiração: Dragon Oath)

## Regras de trabalho
- Toda decisão tomada é registrada neste documento.
- Decisões que afetam a jogabilidade são sempre perguntadas ao Lucas antes de serem adotadas.
- Decisões são enviadas como perguntas de múltipla escolha ou confirmação, para o Lucas não precisar digitar.
- Sempre avisar o Lucas quando houver dicas para economizar tokens.
- Economia de tokens: tarefas que não precisam do Opus (código de rotina, scaffolding, conteúdo repetitivo) vão para um modelo mais leve (Sonnet/Haiku); o Opus fica com design, revisão e decisões.

## Repositório e publicação
- **Código:** GitHub `Flushin/rpg-wuxia`, branch `main`. Cópia deste documento em `docs/decisoes-do-projeto.md`.
- **Publicação:** GitHub Pages, automática a cada push na `main` (GitHub Actions) — `https://flushin.github.io/rpg-wuxia/` (funcionando).
- **Ambiente do Lucas:** Windows sem admin, Node portátil em `C:\nodejs`, VSCode. O repositório tem `.vscode/settings.json` que coloca `C:\nodejs` no PATH do terminal.

## Plano de desenvolvimento
- **Marco 1 (concluído):** estrutura do projeto, cidade e floresta com placeholders, criação de personagem (2 seitas), movimento PC/celular, seleção de alvo, ataque básico, lobos com IA, XP/nível até 10, pontos de atributo, morte → cidade, HUD, save no IndexedDB.
- **Marco 2 (concluído):** skills das duas seitas + nível por uso, hotbar, painel de skills (K).
- **Marco 3 (concluído):** itens, equipamentos, durabilidade, drops, ferreiro e vendedor de poções, interação com NPCs.
- **Marco 4 (concluído, em teste):** auto-combate (menu de skills, poções) e ganho offline.
- **Marco 5:** bandidos, guerreiros de terracota e o General de Terracota; balanceamento; **vários personagens**:
  - Tela inicial com **4 espaços**; o jogador escolhe qual personagem jogar (o personagem atual vira o primeiro espaço).
  - Ganho offline vale só para o **último personagem jogado**.
  - Personagens **não compartilham** nada por enquanto (baú/ouro compartilhado pode vir depois).


## Decididas

### Base (15/11/2026)
- **Escala:** single-player primeiro. Multiplayer fica para uma fase futura, então a lógica do jogo (combate, status, IA) fica separada da renderização.
- **Plataformas:** navegador no computador **e** no celular.
- **Combate:** tab-target estilo Dragon Oath (selecionar alvo, auto-ataque, skills com cooldown na hotbar).
- **Visual:** 2D com sprites isométricos.
- **Arte da v1:** placeholders (formas simples) para testar a jogabilidade; arte definitiva depois.
- **Ambientação:** wuxia, com seitas como classes.
- **Experiência do dev:** intermediário (já fez projetos web).
- **Save:** local em cada aparelho (PC e celular têm progresso separado por enquanto).

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
  - Lâmina Errante: **Strength** (dano físico) e **Agility** (acerto e crítico, combina com golpes rápidos).
  - Pavilhão das Nuvens: **Intelligence** (dano espiritual) e **Willpower** (mana para as skills de área).
  - **Stamina** aparece como opcional para as duas, para quem morre muito.
- **Botão "Distribuir recomendado":** gasta os pontos livres sozinho seguindo a proporção recomendada da seita (definida em `classes.json`).

### Aprender jogando
- **Dicas contextuais:** aparecem uma única vez, na primeira vez que a situação acontece (entrar no jogo, primeiro portal, primeiro abate, primeiro nível, primeira morte; depois primeiro item, primeira skill etc.). Podem ser desligadas nas configurações.

### Elementos
- **Fire, Ice, Thunder, Poison** — cada um com ataque e resistência.

### Classes (seitas)
4 seitas: duas melee, duas ranged.
- **Montanha de Ferro:** melee, tanque, bastão/punhos.
- **Lâmina Errante:** melee, espadas duplas, dano rápido, dano físico, elemento **Thunder**. *(v1)*
- **Pavilhão das Nuvens:** ranged, magia de qi, dano em área, dano espiritual, elemento **Ice**. *(v1)*
- **Agulha Esmeralda:** ranged, agulhas e veneno, dano contínuo + cura leve.

### Combate e skills
- **Ataque básico:** igual para todas as classes (hit básico, como no Dragon Oath).
- **Skills por classe na v1:** 4 ativas + 1 passiva, além do ataque básico, liberadas nos níveis 1, 3, 5, 7 e 9.
- **Nível das skills ativas:** sobe **pelo uso** — quanto mais a skill é usada, mais experiência ela acumula.
- **Nível das skills passivas:** sobe **junto com o nível do personagem**.

- **Nível máximo da skill:** 10; **+8% de efeito por nível**. Cada uso dá 1 de experiência; o nível 2 pede ~20 usos e os seguintes pedem cada vez mais.
- **Uso:** skills de alvo único usam o alvo selecionado (tab-target); se o alvo estiver fora do alcance, o melee anda até ele antes de usar.
- **Skills de área nunca exigem alvo:** saem na hora, gastando mana e cooldown mesmo sem monstro perto. Tempestade de Lâminas: em volta do personagem. Chuva de Qi: no alvo selecionado se estiver no alcance; senão, em volta do personagem. Só ganham experiência se acertarem algum monstro.
- **Hotbar:** PC — teclas 1–4 e clique; celular — 4 botões em arco ao redor do botão de ataque (canto inferior direito).
- **Números iniciais (aprovados, ajustáveis no balanceamento):**
  - Corte Duplo 2×70% · cd 4 s · 8 mana
  - Passo Fantasma: avança até 8 tiles, 120% · cd 10 s · 12 mana
  - Tempestade de Lâminas: 150% em volta, raio 2,5 · cd 12 s · 18 mana
  - Golpe Rompe-Guarda: 200% e −30% defesa por 6 s · cd 15 s · 20 mana
  - Fluxo da Lâmina: +10% velocidade de ataque, +5% crítico
  - Esfera de Qi: 130% · cd 3 s · 8 mana
  - Lótus Congelante: 110% + lentidão 40% por 4 s · cd 10 s · 14 mana
  - Chuva de Qi: 180% em área no alvo · cd 14 s · 22 mana
  - Escudo de Nuvem: absorve 25% do HP máx. por 8 s · cd 20 s · 20 mana
  - Meditação Celeste: regenera 1% de mana/s fora da cidade

**Lâmina Errante**
1. Corte Duplo (nv 1) — dois golpes rápidos
2. Passo Fantasma (nv 3) — avança até o alvo e causa dano
3. Tempestade de Lâminas (nv 5) — dano em área ao redor
4. Golpe Rompe-Guarda (nv 7) — dano alto e reduz a defesa do alvo
5. Fluxo da Lâmina (nv 9, passiva) — mais velocidade de ataque e crítico

**Pavilhão das Nuvens**
1. Esfera de Qi (nv 1) — projétil de magia
2. Lótus Congelante (nv 3) — dano e lentidão
3. Chuva de Qi (nv 5) — dano em área no alvo
4. Escudo de Nuvem (nv 7) — absorve dano
5. Meditação Celeste (nv 9, passiva) — regeneração de mana

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
- **Lobos:** níveis 1–3. Visão (aggro) de 3 tiles.
- **Bandidos:** níveis 4–6.
- **Guerreiros de Terracota:** níveis 7–9.
- **Chefe — General de Terracota (nv 10):** lento e resistente; ataques em área que o jogador consegue desviar.

### Escopo da primeira versão jogável
- 1 cidade com NPCs — funcionais: **ferreiro** (conserto) e **vendedor de poções**; os demais sem função.
- 1 mapa de monstros com os 3 tipos acima + o chefe.
- 2 classes: Lâmina Errante e Pavilhão das Nuvens.

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
