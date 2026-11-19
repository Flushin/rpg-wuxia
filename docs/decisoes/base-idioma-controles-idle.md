### Base (15/11/2026)
- **Escala:** single-player primeiro. Multiplayer fica para uma fase futura, então a lógica do jogo (combate, status, IA) fica separada da renderização.
- **Plataformas:** navegador no computador **e** no celular.
- **Combate:** tab-target estilo Dragon Oath (selecionar alvo, auto-ataque, skills com cooldown na hotbar).
- **Visual:** 2D com sprites isométricos.
- **Arte da v1:** placeholders (formas simples) para testar a jogabilidade; arte definitiva depois.
- **Ambientação:** wuxia, com seitas como classes.
- **Experiência do dev:** intermediário (já fez projetos web).
- **Save:** local em cada aparelho (PC e celular têm progresso separado por enquanto). Confirmado em 16/11/2026: continua assim até o marco online.

### Idioma e nomes (15/11/2026)
- **Nome do jogo: Wanderers** (decidido pelo Lucas em 16/11/2026) — nome único, igual em PT e EN (título da aba e tela inicial). Antes era "RPG Wuxia". O repositório e o endereço do site continuam `rpg-wuxia`; o assunto dos e-mails de bug continua `[RPG bug]` (filtro do Gmail).
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
- Mapas isométricos no formato JSON do Tiled, **gerados pelo script** `tools/gen-maps.mjs` (`npm run maps`), não editados no Tiled (confirmado em 17/11/2026)
- Dados de classes, skills, itens e monstros em arquivos JSON (data-driven)
- Save local em IndexedDB, com horário da última sessão (para calcular o ganho offline)

### Controles
- **PC:** WASD/setas ou clique para mover (WASD é relativo à tela, como o joystick); clique seleciona alvo; Tab troca alvo; Espaço ataca o mais próximo; C abre atributos; skills na hotbar (teclado + clique).
- **Celular:** joystick virtual para mover; tocar no inimigo para selecionar; skills em botões na tela.
- Notebooks com tela touch: o mouse continua com clique-para-mover.
- **NPCs:** clicar/tocar no NPC → o personagem anda até ele e a janela de diálogo/loja abre sozinha (como no Dragon Oath).

### Modo idle
- **Auto-combate:** com o jogo aberto, o personagem caça monstros sozinho no mapa.
- **Menu do auto-combate:** o jogador escolhe quais habilidades o auto-combate usa.
- **Poções no auto-combate:** usa poções de HP e mana sozinho, com limites configuráveis no menu (padrão sugerido: HP abaixo de 40%, mana abaixo de 30%).
- **Morte no auto-combate:** o personagem volta para a cidade e retorna ao mapa para continuar caçando **somente se todos os itens equipados ainda tiverem durabilidade**. Se algum item chegar a 0, o auto-combate para e espera o jogador.
- **Área do auto-combate:** o mapa inteiro; ataca o monstro mais próximo dentro da faixa de nível escolhida no menu (padrão: **até 2 acima do personagem**).
- **Opções de alvo e revide (aprovadas pelo Lucas em 18/11/2026; substituem a ideia de só "não revidar monstros 3+ níveis acima"):**
  seção **Alvos** no menu do auto-combate. Os padrões reproduzem o comportamento de antes, então saves antigos não mudam.
  - **Nível máximo acima do seu:** slider de +0 a +5 (padrão +2). Vale para escolher alvo e para o revide "só até o nível máximo".
  - **Monstros fracos (2+ níveis abaixo, "cinzas"):** só se não houver outro (padrão) / ignorar / normal.
  - **Revidar quem ataca:** sempre (padrão) / só até o nível máximo (os mais fracos são sempre revidados, mesmo com cinzas
    ignorados) / nunca.
  - **Se um monstro acima do nível máximo atacar** (só aparece se o revide não for "sempre"): continuar caçando (padrão) /
    se afastar (anda para longe dele e da casa dele até ele desistir pelo leash; nunca atravessa portal; se ficar
    encurralado, revida) / voltar à vila (mesma saída da compra de poções; depois volta a caçar).
  - **Evitar atrair grupos:** não / pouco (padrão, o `CROWD_PENALTY` aprovado em 15/11) / muito (peso ×3).
  - Com o revide diferente de "sempre", alvos na visão de um monstro acima do nível máximo ficam em último caso
    (para não voltar logo para perto do monstro do qual fugiu).
  - Chefes e monstros na arena continuam proibidos (não é opção). A seleção manual de alvo não muda.
  - Ganho offline: não precisa de ajuste, porque usa o ritmo medido com as opções em uso. O simulador de balanceamento usa os padrões.
- **Ligar:** botão "Auto" no HUD + tecla Z; botão ☰ ao lado (▾ no HUD Novo do celular) abre o menu (skills usadas, limites de poção, quantidade de poções a comprar, vender Incomuns). Qualquer movimento manual pausa o auto.
- **Sem poções (online):** volta à cidade, compra a quantidade definida no menu (se tiver ouro) e retorna a caçar; sem ouro, continua sem poção.
- **Mochila cheia (online):** o auto só olha a **aba de equipamentos**: quando ela lota e há algo vendável (Comuns; Incomuns com a opção do menu), volta à vila, vende no vendedor (aproveita e compra poções se precisar) e retorna ao mapa de caça (19/11/2026; antes vendia na hora). Raros nunca são vendidos: sem nada vendável, continua caçando e o que não couber fica no chão (60 s).
- **Ganho offline:** ao voltar, o jogador recebe XP, ouro e itens pelo tempo fora (o navegador não roda o jogo com a aba fechada), e gasta poções.
  - **Teto de ouro (19/11/2026):** cada volta do offline dá no máximo **3 h de ouro de caça** no ritmo medido pelo auto (`offlineGoldCap` em `core/offline.ts`), somando ouro dos abates e das vendas automáticas; o que passa disso se perde e o resumo mostra "Teto de ouro atingido". Ajuste: `npm run balance -- offline.teto_ouro +x%`.
  - **Itens offline (19/11/2026):** só caem **poções e equipamentos Comuns**. Materiais, consumíveis e equipamentos Incomuns/Raros ficam de fora (`offlineDropAllowed` em `core/offline.ts`), para o offline não bancar refino e equipamento bom sem jogar.
  - Só conta se o jogador saiu com o auto-combate ligado num mapa de caça.
  - **Cálculo pelo ritmo real:** mede monstros por minuto, XP/ouro/drops por abate e poções gastas por abate durante o auto-combate antes de sair.
  - **Eficiência por faixa de tempo:** 60% até 12 h · 40% de 12 h a 18 h · 20% de 18 h a 24 h · 0 depois de 24 h.
  - Sem morte e sem perda de durabilidade offline. Aba de equipamentos cheia: vende de uma vez todo equipamento que o auto vende (Comuns; Incomuns se a opção estiver ligada) e segue caçando; o que ainda não couber também é vendido. Tudo entra em "Vendido automaticamente" no resumo. Poções que não cabem na aba de consumíveis ficam para trás (o auto não olha as outras abas). Se as poções acabarem offline, os ganhos continuam.
  - Tela de resumo "Enquanto você esteve fora" ao voltar.
- **Skills no idle:** ganham experiência de uso no auto-combate, mas **não** no ganho offline.

