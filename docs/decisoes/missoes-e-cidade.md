### Fechamento do marco 7 (16/11/2026)
Decidido pelo Lucas em 16/11/2026, com base no simulador (`npm run sim:balance`, 6 execuções por seita).
- **Tormenta vs. General** (perdia 6/6 com o equipamento Incomum das missões): **Tormenta fortalecida, General igual.**
  - **Roubo de vida:** 8% do dano causado volta como vida (`lifeSteal` em `classes.json`; vale para golpe e skills). Descrição da seita avisa.
  - **Quebra-Guarda:** 220% → **280%** e −30% → **−40%** de defesa por 6 s.
  - Resultado: vence **10–11 de 12** com Incomum e 12/12 com Raro.
- **Geada mais resistente, continua a mais rápida:** Stamina inicial 5 → **10** (o texto dizia 8; o código e o simulador sempre usaram 10 — corrigido na auditoria de 17/11/2026). Mortes até o nível 10: ~4 → **~0–1**; ritmo igual (~47 min).
  Tormenta: ~66 min, ~1,5 morte. (A diferença de ritmo entre as seitas foi mantida de propósito: Geada rápida, Tormenta firme.)
- **Menos ouro:** ouro dos monstros comuns **pela metade** (lobo 2–5; bandidos 3–5 +0,8/nível; terracota 5–8 +1/nível; General igual)
  e venda de itens **25% → 15%** do valor. Recompensas de missão iguais (passam a pesar mais).
  Gasto com poções + conserto: Tormenta ~75% do ouro ganho (antes ~40%), Geada ~40% (antes ~20%).
- **Acabamentos:** tela de carregamento (WANDERERS + barra de progresso); **PWA** instalável (`public/manifest.webmanifest`, ícones em
  `public/icons/` gerados por `tools/icons/make_app_icons.py`, service worker `public/sw.js` que sempre busca a versão nova quando há
  internet e não intercepta o envio de bug); **versão** discreta (`v0.1.0 · commit`) no canto da tela inicial.
- **Itens de "Em aberto"** fechados para a v1 com esses números; o ajuste fino segue com os reports dos amigos.

### Missões (marco 7, 16/11/2026)
Decidido pelo Lucas em 16/11/2026.
- **Objetivos:** só **abater, falar e ir até um lugar** (sem itens de missão para coletar).
- **Recompensas:** XP e ouro em todas; **equipamento garantido em 2 etapas-chave** (4 e 7).
- **Ritmo:** continua **~1 hora até o nível 10**: o XP dos monstros diminui um pouco para compensar o XP das missões (conferido no simulador).
- **Acompanhamento:** **rastreador** pequeno no HUD (objetivo e progresso, ex.: Lobos 3/6) e **"!"/"?"** sobre o NPC (missão para pegar / para entregar).
- **Cadeia principal (8 etapas; a próxima só libera ao atingir o nível indicado):**
  1. Ancião (nv 1) — *Boas-vindas*: fale com o mestre da sua seita.
  2. Mestre da seita (nv 1) — *Primeiro treino*: derrote 5 lobos.
  3. Guarda do Portão (nv 2) — *Lobos na estrada*: derrote 8 lobos.
  4. Guarda do Portão (nv 4) — *Acampamentos*: derrote 6 bandidos espadachins → **arma Incomum nv 5 da seita**.
  5. Mercador Ambulante (nv 5) — *Carga roubada*: derrote 4 bandidos arqueiros.
  6. Ancião (nv 6) — *O portão antigo*: chegue às Ruínas de Terracota.
  7. Mestre da seita (nv 7) — *Barro e bronze*: derrote 8 guerreiros de terracota → **túnica/manto Incomum nv 5**.
  8. Ancião (nv 9) — *O General desperta*: derrote o General de Terracota → **bônus grande de ouro**.

**Como ficou (feito em 16/11/2026):**
- **Recompensas** (XP · ouro): 1) 100 · 20 · 2) 150 · 30 · 3) 300 · 50 · 4) 900 · 120 + **arma Incomum nv 5 da seita** ·
  5) 1.600 · 150 · 6) 1.500 · 150 · 7) 4.000 · 300 + **Manto de Seda Incomum nv 5** · 8) 6.000 · **800**. Total ~14.550 XP (~24% do XP até o nível 10).
  Mochila cheia: o item cai no chão (60 s), não se perde. No nível 10 a missão dá só o ouro.
- **XP dos monstros −22%** para compensar: lobo 8 + 5/nível, espadachim 23 + 6, arqueiro 26 + 7, terracota 55 + 9 (General igual).
  **Simulador** (com as missões, sem contar a caminhada até os NPCs): Tormenta **64,6 min** (antes 64,3), Geada **46,6 min** (antes 46,4).
  Os níveis 2 e 3 chegam bem rápido (as duas primeiras missões), como um tutorial.
- **Janela do NPC:** em cima aparece a missão daquele NPC: oferta com **Aceitar**, conclusão com **Entregar** (com a fala de entrega),
  ou o andamento. Abaixo continuam a loja, o ferreiro ou as falas de sempre. Com nível baixo o NPC avisa: "Volte quando estiver no nível X".
- **Marcas:** "!" amarelo sobre quem tem missão para dar; "?" verde sobre quem recebe (e sobre o mestre na missão de conversa). Balançam devagar.
- **Rastreador:** canto direito, logo abaixo dos botões do topo (funciona no Fold fechado): nome da missão e objetivo com progresso
  ("Derrote lobos 3/5"), "Fale com …", "✓ Volte a …" ou "Próxima missão no nível X". Some quando a cadeia termina.
- **Avisos:** "Missão aceita", "Objetivo cumprido" (com som) e "Missão concluída".
- **Regras:** abates do auto-combate contam; o **ganho offline não conta** para missões. Saves antigos começam a cadeia do zero
  (personagens de nível alto conseguem fazer as etapas antigas rapidamente).
- **Código:** `src/core/quests.ts` (dados e tipos), estado e regras em `World` (`questView`, `questMark`, `questAccept`, `questTurnIn`),
  textos em `src/data/quests.json` + seção `quests` do `en.json`. Teste: `npm run check:quests`. O simulador faz a cadeia
  (`--sem-missoes` para comparar).
- **Teste instável corrigido:** o `check:m5` falhava quando um guerreiro atacava o personagem de nível 1 (o auto revida, o que é permitido).

### Fechamento do marco 6 (16/11/2026)
Decidido pelo Lucas em 16/11/2026: entram os 4 blocos (bandidos/terracota, ruínas/água/portais, efeitos das skills, ícones + FPS).
- **Regra de cor (pedida pelo Lucas):** o terreno e as estruturas fixas **nunca usam a cor dos inimigos do mesmo mapa**, para os
  monstros se destacarem. Por isso as ruínas são de **pedra cinza-azulada** (sem argila nem laca vermelha) e não têm estátuas de
  terracota no cenário. Vale para os próximos mapas.
- **Bandidos** (KayKit recolorido): espadachim = Knight sem elmo/escudo, couro marrom e pano cinza, **lenço no rosto**; arqueiro =
  Rogue com besta, **chapéu de palha** e lenço. Lenço e chapéu são gerados pelo script (`attach` `mask` e `hat`).
- **Terracota:** guerreiros = Knight em **barro alaranjado** com espada de duas mãos (o esqueleto KayKit não tem armas e parecia
  menos com os guerreiros de terracota). **General** = mesmo modelo com elmo, capa vermelha e **detalhes dourados**, **1,5×** maior
  (era 1,7× no placeholder; só visual).
- **Ruínas** (`render_ruins.py`): colunas de pedra inteiras e quebradas, entulho, cacos, mato seco; os pilares em volta do General
  viram **braseiros acesos**. Piso de lajotas gastas com rachaduras e musgo.
- **Água:** 3 quadros animados (reflexos que se movem, cada tile com sua fase) e espuma clara na margem.
- **Portais:** porta-lua de pedra com véu de luz roxa, chão brilhando e faíscas subindo; nome por cima. Iguais em todos os mapas.
- **Efeitos das skills** (`src/render/skillFx.ts`, só visual): Tormenta em amarelo/violeta de trovão (cortes cruzados com faíscas,
  relâmpago no Passo do Raio, lâminas girando com raios na Tempestade, corte pesado com onda de choque e rachaduras no Quebra-Guarda);
  Geada em azul/branco de gelo (orbe com rastro de flocos que estoura em cristais, flor de cristais, nevasca com cristais caindo,
  névoa que se fecha em bolha).
- **Ícones** (`tools/sprites/icons.py`, atlas `icones.png`): um por item (14 equipamentos + 4 poções) e um por skill (10), na mochila,
  slots vazios (peça mais simples do slot, em cinza), botões de poção, hotbar, painel de skills e menu do auto-combate.
  Os botões do topo no celular deitado (📜 💪 🎒) continuam emoji.
- **Desempenho:** ⚙ **"Mostrar FPS"** (salvo no aparelho) mostra no topo FPS atual, média e "pior 1%" dos últimos 10 s e o número de
  objetos. Objetos do mapa fora da tela deixam de ser desenhados. Medição aqui (CPU 4× mais lenta, tela de celular deitado): o JS
  gasta ~6–8 ms por quadro (p95 ~11–14 ms na floresta), dentro dos 16,7 ms de 60 FPS. A medida real é no celular do Lucas com o
  contador (o ambiente de teste não tem placa de vídeo).
- **Observação:** o teste `check:m5` ("nv 1 não ataca terracota nv 7+") falhava às vezes (~1 em 3); corrigido no marco 7.

### Cidade, NPCs e mestres das seitas (marco 6, 16/11/2026)
Decidido pelo Lucas em 16/11/2026.
- **Mapa da cidade:** mesmo tamanho; reorganizado com **praça central**, casas wuxia de **telhado curvo**, piso de pedra e enfeites, e espaço na praça para os 4 mestres. Ferreiro, vendedor de poções e portal para a floresta continuam na cidade.
- **Mestres das seitas — onde explicam:** **na criação e na cidade.**
  - **Criação de personagem:** cada seita é apresentada pelo seu mestre (retrato + fala curta explicando estilo de luta, elemento, atributos recomendados) antes da escolha.
  - **Cidade:** o mesmo mestre fica na praça; ao falar com ele, repete a apresentação e dá dicas da seita.
- **Quais mestres:** **os 4.** Tormenta e Geada jogáveis; **Titã e Víbora aparecem como "em breve"** (bloqueados na criação; na cidade só falam, apresentando a seita).
- **NPCs novos (só falas, sem função por enquanto):**
  - **Guarda do portão** — perto do portal da floresta; avisa sobre os perigos de cada mapa (lobos, bandidos, ruínas).
  - **Ancião da vila** — conta a história da cidade e do General de Terracota.
  - **Moradores andando** — 2 a 4 aldeões que caminham pela praça, com falas curtas.
  - **Mercador ambulante** — só fala por enquanto; no futuro pode vender itens raros.
- **Arte:** mesmo método do marco 6 (modelos 3D CC0 renderizados no Blender com a mesma câmera e luz; personagens KayKit recoloridos). Falas em PT e EN.

**Como ficou (feito em 16/11/2026):**
- **Mapa** (`tools/gen-maps.mjs`): praça de lajotas 10×10 com o **incensário de bronze** no centro (bloqueia 2×2); estrada de pedra da praça até o **portão leste** (pailou vermelho sobre a estrada, antes do portal da floresta); estradas de terra para norte, sul e oeste; 8 casas, **ferraria** (chaminé, forja acesa, bigorna, barril) e **loja de poções** (telhado verde, bancada com frascos) na beira da praça; lanternas de papel e de pedra, poço, barris, caixotes, vasos e a carroça do mercador; cerejeiras e carvalhos na grama. O jogador chega da floresta embaixo do portão.
- **Arte nova:** `tools/sprites/render_town.py` gera as casas e enfeites por script no Blender (nenhum pacote CC0 tem arquitetura chinesa): base de pedra, paredes de reboco, colunas e viga vermelhas, janelas de treliça e **telhado côncavo com as pontas levantadas**. Cerejeiras = árvores do Nature Kit com folhas rosa. Lajotas da praça em `ground_tiles.py`. Atlas `public/sprites/cidade.*`.
- **Profundidade das casas:** cada casa é desenhada em fatias verticais de 32 px, cada uma com a profundidade do ponto mais à frente da casa naquela coluna — o personagem passa na frente e atrás sem erro. Se a casa cobre o jogador, **a casa inteira fica transparente**. O topo do portão fica sempre por cima.
- **NPCs (13, todos com sprite KayKit recolorido):** Ferreiro, Vendedor de Poções, Ancião (com cajado), Guarda do Portão (armadura vermelha), Mercador Ambulante (capuz), **Mestre Lei** (Tormenta, cabelo branco, túnica carmim), **Mestra Shuang** (Geada, azul, com leque), **Mestre Gang** (Titã, careca, laranja), **Mestra Du** (Víbora, capuz verde) e 4 moradores que andam: **Aldeã Mei, Velho Pescador Hu, Menino Tao, Cozinheira Lan** (EN: Master Lei, Mistress Shuang, Master Gang, Mistress Du…). NPCs parados só têm a animação parada de frente (folhas pequenas); moradores andam nas 8 direções.
- **Moradores andando:** passeiam até ~4 tiles do ponto de origem, param 2–6 s e escolhem outro lugar; param quando o jogador vai falar com eles. Sorteio próprio (não mexe no combate; simulação de balanceamento igual).
- **Cada mestre fica ao lado do estandarte da sua seita**, um em cada canto da praça (vermelho Tormenta, azul-gelo Geada, ocre Titã, verde Víbora).
- **Janela de conversa:** mestres mostram retrato, título, saudação, a apresentação da seita, **3 dicas** (Tormenta/Geada) ou o aviso de que os portões ainda estão fechados (Titã/Víbora); mostra "sua seita" no mestre do personagem. Guarda, ancião, mercador e moradores falam **uma fala por vez** com "Continuar ›" (volta ao começo no fim).
- **Criação de personagem:** os 4 cartões mostram o retrato e o nome do mestre e a apresentação dele; Titã e Víbora esmaecidos com "Em breve" (não dá para escolher).
- **Nomes dos NPCs** ficam sempre por cima (casas e portão não cortam o nome).
- **Textos:** `src/data/npcs.json` (PT) e seção `npcs` do `en.json`; `npm run check:i18n` confere as falas também.

### Gráficos (marco 6, 15/11/2026)
- **Método:** modelos **3D CC0** renderizados em sprites isométricos por um script do Blender. Motivo: quase não existem sprites 2D CC0 isométricos com cara de wuxia, e misturar pacotes 2D de autores diferentes quebra o estilo; renderizando tudo com a mesma câmera e luz, o estilo fica coeso.
- **Personagens:** linha **KayKit** (Kay Lousberg, CC0), estilo "cabeçudo" — escolhida no lugar da Quaternius porque já traz ataque com duas lâminas, mago (Geada) e esqueletos (base para os guerreiros de terracota), todos com o mesmo esqueleto e animações. **Tormenta = Rogue** recolorido (cabelo preto, túnica carmim, capa escura, cinto dourado). **Geada = Mage** recolorido (túnica branca, detalhes azul-gelo, cabelo prateado, sem chapéu) com **leque de qi** — decidido pelo Lucas em 16/11/2026.
- **Monstros:** lobo da Quaternius (Ultimate Animated Animals, CC0). Outros monstros: preferir KayKit recolorido.
- **Cenário:** **Nature Kit 3D da Kenney** (CC0) renderizado com a mesma câmera e luz dos personagens (em vez de pacotes 2D), com as cores trocadas para uma paleta de floresta. Piso (grama, caminho) em 2D gerado por script, sem frestas.
- **Estilo aprovado pelo Lucas:** personagem com **~48 px** de altura no zoom 100%; **sem contorno**; árvores do tamanho da prévia (bem mais altas que o personagem).
- **Padrões técnicos:** câmera isométrica 2:1 ortográfica; **8 direções**; animações **parado, andar, atacar, morrer**; render em **2×** mostrado em 0,5 (nitidez no celular/zoom); atlas recortado (máx. 2048×4096) com paleta de 256 cores. Render no Blender (Cycles na CPU, < 1 min no total). Como gerar: `tools/sprites/README.md`.
- **No jogo (só visual, sem mudar regras):** o personagem vira para onde anda e para o alvo em combate; golpe e skills tocam a animação de ataque; monstro morto mostra a queda (~1,4 s) antes de sumir; árvores na frente do jogador e do alvo ficam transparentes; alguns enfeites (grama, flores, cogumelos, pedrinhas) na grama da floresta, sem bloquear caminho.


