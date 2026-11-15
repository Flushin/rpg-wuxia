# Decisões do projeto — RPG de navegador (inspiração: Dragon Oath)

## Regras de trabalho
- Toda decisão tomada é registrada neste documento.
- Decisões que afetam a jogabilidade são sempre perguntadas ao Lucas antes de serem adotadas.
- Decisões são enviadas como perguntas de múltipla escolha ou confirmação, para o Lucas não precisar digitar.
- Economia de tokens: tarefas que não precisam do Opus (código de rotina, scaffolding, conteúdo repetitivo) vão para um modelo mais leve (Sonnet/Haiku); o Opus fica com design, revisão e decisões.

## Repositório e publicação
- **Código:** GitHub `Flushin/rpg-wuxia`, branch `main`. Cópia deste documento em `docs/decisoes-do-projeto.md`.
- **Publicação:** GitHub Pages, automática a cada push na `main` (GitHub Actions) — `https://flushin.github.io/rpg-wuxia/` (funcionando).
- **Ambiente do Lucas:** Windows sem admin, Node portátil em `C:\nodejs`, VSCode. O repositório tem `.vscode/settings.json` que coloca `C:\nodejs` no PATH do terminal.

## Plano de desenvolvimento
- **Marco 1 (concluído, em teste):** estrutura do projeto, cidade e floresta com placeholders, criação de personagem (2 seitas), movimento PC/celular, seleção de alvo, ataque básico, lobos com IA, XP/nível até 10, pontos de atributo, morte → cidade, HUD, save no IndexedDB.
- **Marco 2:** skills das duas seitas + nível por uso, hotbar.
- **Marco 3:** itens, equipamentos, durabilidade, drops, ferreiro e vendedor de poções, interação com NPCs.
- **Marco 4:** auto-combate (menu de skills, poções) e ganho offline.
- **Marco 5:** bandidos, guerreiros de terracota e o General de Terracota; balanceamento.

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
- **Ganho offline:** ao voltar, o jogador recebe XP/itens calculados pelo tempo fora (o navegador não roda o jogo com a aba fechada).
- **Eficiência:** idle/offline rende menos que jogar ativo (referência: ~50–70%), com limite de horas offline (referência: 8–12h). Valores exatos a definir no balanceamento.
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
