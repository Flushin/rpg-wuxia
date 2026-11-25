## Decididas

### Roadmap online (18/11/2026)
Respondido pelo Lucas em 18/11/2026, ao pedir o roadmap em `docs/roadmap/` (o roadmap é uma proposta; cada item de
jogabilidade continua passando por pergunta antes de ser feito).
- **Modelo online:** **assíncrono**: conta e save na nuvem com o servidor validando, ranking, amigos e guildas, cada jogador
  no seu próprio mundo. Mundo compartilhado em tempo real, raids e PvP em tempo real ficam fora do escopo.
- **Monetização:** a v1 sai grátis, sem anúncios e sem compras (confirma a decisão de 18/11/2026); F2P ético depois do lançamento.
- **Público-alvo:** casual PvE mobile (Auto e ganho offline como pilares; PvP opcional e tardio).
- **Premissa de trabalho:** o Lucas é solo dev **sem experiência de lançar jogos ou apps nas lojas** e precisa da IA para
  quase tudo. Consequências no roadmap: só serviços gerenciados (nenhum servidor para operar), nada que exija moderação
  ou vigilância diária antes do pós-lançamento (chat de texto livre, mercado e troca entre jogadores), manuais escritos
  para a IA seguir com o Lucas, e cada tarefa marcada com quem faz (🤖 IA · 🤝 juntos · 👤 só o Lucas).
- **Loja não é antecipada (18/11/2026):** o Lucas quer criar mais e jogar mais offline antes de mandar para a loja. A conta
  no Play Console e o teste fechado (12 testadores por 14 dias) começam no **início do M3**, ~5 semanas antes do
  lançamento. O conteúdo que não depende de servidor fica na "Trilha C" do `docs/roadmap/04-marcos.md`.
- **appId confirmado (18/11/2026):** `io.github.flushin.mistpeak` (já em `capacitor.config.ts`); nada de "wanderers".

### Titã e Víbora (marco 8, 18/11/2026)
Aprovado pelo Lucas em 18/11/2026 (skills como propostas; Titã = Fogo; Víbora = físico com Agilidade). Números ajustados
com o simulador (6 execuções por seita): até o nível 10 — Tormenta ~61 min / 1,7 morte, Geada ~43 / 0,3,
**Titã ~66 / 0,2**, **Víbora ~59 / 0,7**; chefe 12/12 para as duas novas com equipamento Incomum.
- **Titã:** corpo a corpo, tanque, físico, **Fogo**. Força 8, Inteligência 3, Vigor 12, Agilidade 3, Vontade 4;
  por nível +1 Força e +1 Vigor; golpe a cada 1,0 s. Arma: Bastão de Ferro (nv 1) / Bastão da Brasa Eterna (nv 5).
  1. Punho da Montanha · Mountain Fist (nv 1): 180% · cd 4 s · 8 mana (era 150%/5 s na proposta; subiu no balanceamento)
  2. Tremor · Quake (nv 3): 120% em volta, raio 2,5, lentidão 30% por 4 s · cd 10 s · 14 mana
  3. Pele de Ferro · Iron Skin (nv 5): escudo de 30% do HP máx. por 8 s · cd 18 s · 18 mana
  4. Punho Vulcânico · Volcanic Fist (nv 7): 260% e **atordoa 1,5 s** · cd 15 s · 20 mana
  5. Corpo de Bronze · Bronze Body (nv 9, passiva): −10% de dano recebido, +10% HP máx.
- **Víbora:** à distância (alcance 6, ataca andando), físico, **Veneno**. Força 6, Inteligência 3, Vigor 9,
  Agilidade 8, Vontade 4; por nível +1 Força e +1 Agilidade; golpe a cada 1,1 s. Arma: Agulhas de Bronze (nv 1) /
  Agulhas de Jade Esmeralda (nv 5).
  1. Agulha Venenosa · Venom Needle (nv 1): 90% + veneno de 60% em 6 s · cd 3 s · 8 mana
  2. Chuva de Agulhas · Needle Rain (nv 3): 5 × 40% · cd 10 s · 16 mana
  3. Névoa Tóxica · Toxic Mist (nv 5): veneno de 150% em 6 s e lentidão 20% num raio de 2,5 no alvo · cd 12 s · 16 mana
  4. Seiva de Jade · Jade Sap (nv 7): cura 20% do HP máx. em 6 s · cd 20 s · 20 mana
  5. Sangue de Serpente · Serpent Blood (nv 9, passiva): +15% de dano em alvos envenenados
- **Mecânicas novas:** veneno (tiques de 1 s, calculado ao aplicar com o dano médio do golpe contra o alvo, sem
  acerto/erro; número verde), atordoar (o monstro não anda nem ataca), cura ao longo do tempo e passivas de redução
  de dano, HP máximo e bônus contra envenenado. Auto-combate usa a cura com a vida abaixo de 75% em combate.
- Os mestres Gang e Du passam a dar 3 dicas, como os outros; as duas seitas saem do "Em breve" na criação.

### Pós-nível-10 (marco 9, 18/11/2026)
Fase 0 (decisões de design), respondida pelo Lucas em 18/11/2026. Números exatos saem do simulador nas fases seguintes.
- **Fases:** 0 decisões · 1 progressão até o nível 20 · 2 mapa novo (lógica) · 3 monstros e chefe · 4 arte · 5 bases de
  equipamento · 6 craft · 7 mercador · 8 missões 11–20 · 9 balanceamento e fechamento. O Lucas decide quando cada uma é feita.
- **Progressão:** nível máximo 20; do 10 ao 20 leva **~2 horas** jogando ativo (o dobro do trecho 1–10).
- **Skills:** **nenhuma skill nova**; o nível máximo das skills sobe de 10 para **15** (continua +8% de efeito por nível).
- **Mapa novo:** **montanha nevada com templo abandonado** no topo (neve, pinheiros). Entrada por um **portal novo na
  cidade (saída norte), liberado no nível 10**; o Auto vai para lá a partir do nível 10.
- **Monstros (nv 11–18):** **Espectro de gelo** (à distância, dano espiritual, deixa lento) e **Yeti / Macaco da neve**
  (grande, lento, golpe forte em área).
- **Chefe (nv 20):** **Abade Caído**, mestre de artes marciais corrompido no templo. Com metade da vida chama
  **Discípulos** (monstro que só aparece na luta do chefe).
- **Novas bases de equipamento:** conjuntos nos **níveis 10 e 15** (6 slots, arma de cada uma das 4 seitas).
- **Craft (no Ferreiro, aba "Forjar"):**
  - **Melhorar item (+1 a +10):** gasta materiais e ouro; a chance de sucesso cai a cada nível; **ao falhar perde só os
    materiais** (o item não quebra nem volta de nível).
  - **Subir raridade:** Comum → Incomum → Raro, com custo alto.
  - **Trocar bônus aleatórios** de um item Incomum ou Raro.
  - **Materiais de todos os monstros, por tier:** mapas antigos dão material comum, a montanha dá material raro, os
    chefes dão material especial; desmontar itens também dá material.
- **Mercador Ambulante:** estoque de 4–6 itens sorteados (quase todos Raros, do nível do jogador) que **renova a cada
  1 hora real** (conta também com o jogo fechado). Vende ainda **materiais raros de craft** (caros) e **pergaminho de
  retorno** (teleporta para a vila).
- **Missões:** **sim**, cadeia curta (5–6 missões) do nível 11 ao 20 guiando pela montanha até o Abade (fase 8).

**Fase 1 feita (18/11/2026): progressão até o nível 20.**
- `progression.json`: nível máximo **20**. Curva do 10 ao 20 **provisória**: 24000 / 28000 / 33000 / 38000 / 44000 /
  50000 / 57000 / 65000 / 74000 / 84000 (nível 10→11 até 19→20; total ~497 mil XP, ~8× o trecho 1–10). Pensada para
  ~2 h com os monstros da montanha; será calibrada no simulador na fase 9, quando eles existirem.
- Skills: nível máximo **15** (`SKILL_MAX_LEVEL`). Curva de XP das skills: até o 10 continua `20 × 1,5^(nível−1)` usos;
  **do 10 ao 15 cresce ×1,4 por nível** em vez de ×1,5 (decidido pelo Lucas em 18/11/2026: "levemente mais rápido, mas não
  tanto"): 718 / 1005 / 1407 / 1969 / 2757 usos (total 7856, ~22% menos que os 10139 da curva antiga). No simulador, as
  ativas estão entre os níveis 3 e 7 quando o personagem chega ao nível 10.
  Passivas acompanham o nível do personagem (a do nível 9 chega ao 12 no nível 20). Painel de skills mostra "x/15" e a
  dica fala em "máximo 15".
- Até a fase 2/3, quem passa do nível 10 continua caçando terracota (127–199 XP por abate) e o General: sobe devagar.
  Saves antigos no nível 10 (XP zerado) continuam de onde estão.
- **Simulador consertado:** desde a mudança "Auto volta ao mapa de caça certo", o `sim:balance` parava no nível 7 — ele
  teleportava para as Ruínas, mas o Auto lembrava a Floresta e voltava. Agora o simulador marca as Ruínas como mapa de
  caça (como o jogador que liga o Auto lá). O jogo não mudou.
  Medição (5 execuções, até o nível 10): Tormenta ~53 min / 0 mortes, Geada ~43 / 0,6, Titã ~62 / 0,2, Víbora ~61 / 1,2;
  chefe 10/10 para todas com Incomum.
- Testes ajustados para o nível máximo vir do `progression.json` (offline, missões, robô do caos).

**Fase 2 feita (18/11/2026): mapa novo (lógica).**
- **Montanha Nevada** (`montanha`, 32×32, gerada em `tools/gen-maps.mjs`): entrada no sul; trilha em zigue-zague entre
  pinheiros e pedras; 4 clareiras de caça para a fase 3 (encosta baixa a leste e a oeste, com um lago, e encosta alta no
  meio e a leste); no topo, o **Templo Abandonado**: muro de pilares com portão no sul e pátio de lajes com 6 braseiros
  (arena do Abade, centro 16,6). Ainda **sem monstros** (fase 3) e **sem música própria** (continua a da vila).
- **Tiles novos:** `snow` (andável) e `pine` (bloqueia), no fim do tileset (os mapas antigos não mudam).
  Arte provisória até a fase 4: neve = lajotas clareadas; pinheiro = o pinheiro da floresta.
- **Portal norte da vila** (fim da estrada de terra, 15–16,1) com `minLevel: 10`: abaixo do nível 10 não leva e avisa
  "Montanha Nevada: só a partir do nível 10" (um aviso a cada 3 s parado em cima). Volta da montanha: portal no sul.
- **Auto:** ligado na vila, vai para o mapa com o maior `autoFromLevel` (em `mapsConfig.ts`) que o nível permite —
  floresta = 1, montanha = 10 —, **desde que o mapa tenha monstros**. Até a fase 3 continua indo para a floresta.
  Ligado fora da vila, continua caçando onde foi ligado (como antes). O Auto não usa portais trancados.
- Testes em `check:auto` (portal trancado/aberto, chegada andável, templo alcançável, escolha do mapa pelo Auto).

**Fases 3 a 9 feitas (18/11/2026): monstros, arte, equipamentos, forja, mercador, missões e balanceamento.**
Números calibrados com o simulador (`npm run sim:balance -- --m9 --seeds=3`). Pontos marcados com ⚠ foram escolhidos por
mim (Claude) dentro das decisões da fase 0 e **confirmados pelo Lucas em 18/11/2026** (exceto o ouro da forja, alterado).
- **Monstros (fase 3):**
  - **Espectro de Gelo** (`espectro_gelo`): à distância (alcance 5,5), dano **espiritual**, golpe a cada 2,4 s que deixa o
    alvo **25% mais lento por 2 s**; não recua (⚠ recuar como o arqueiro tornava a caça impossível para Tormenta e Titã).
    Defesa física baixa (×0,55) e espiritual alta (×2,6): fraco contra físico.
  - **Yeti** (`yeti`): corpo a corpo, grande (×1,4), lento (2,3), golpe forte a cada 2,6 s e **golpe em área marcado no
    chão em volta dele** (raio 2,3, 1,3 s de aviso, 180% do ataque, a cada 9 s). Defesa física ×0,5, espiritual ×2,0:
    fraco contra físico também, mas aguenta mais (bastante vida). ⚠ O **Auto sai do círculo** (qualquer círculo).
  - **Níveis por ponto do mapa** (propriedades `minLevel`/`maxLevel` do spawn): encosta baixa (sul) espectros 11–13 /
    yetis 12–14; encosta alta (cantos noroeste e nordeste, longe da trilha) espectros 15–17 / yetis 16–18. 14 monstros.
  - **Abade Caído** (nv 20, ×1,5) no pátio do templo: golpes marcados no chão (raio 2,6, 200%, a cada 6,5 s; 4,5 s com
    metade da vida) e, com metade da vida, chama **2 Discípulos Caídos** (nv 18, rápidos, só aparecem nessa luta).
    ~11 mil de vida; renasce em **15 min** (⚠). Solta 900–1200 de ouro, 1 Raro nv 15 garantido, 3–4 cristais e 2 essências.
    No simulador (nv 20, equipamento nv 15): 47/48 vitórias, 63–142 s.
  - **Renascimento por chefe**: cada chefe tem o seu relógio (`bossRespawns` no save); save antigo (`bossRespawnAt`)
    vale para o General.
- **Arte (fase 4):** Espectro (Mage azul-gelo), Yeti (Barbarian de pelagem branca, sem armas, soco), Discípulo (Rogue de
  roupa escura, chute) e Abade (Mage com cajado, manto vinho), todos KayKit CC0 recoloridos no Blender. Pinheiros
  (3 tons: escuro, com geada e com neve) e rochas nevadas do Nature Kit recoloridos; piso de neve (3 variações) e lago
  congelado gerados em 2D. Pedras soltas da encosta viram rochas nevadas; os pilares do templo continuam colunas.
  Estilhaço de gelo no lugar da flecha para o espectro. Ícones novos para os 18 equipamentos, materiais e pergaminho.
  ⚠ Não há modelo CC0 de yeti/macaco: o Yeti é um humanoide grande e branco.
- **Equipamentos (fase 5):** conjuntos **nv 10** ("da montanha") e **nv 15** ("do templo") nos 6 slots, arma de cada seita.
  Valores ~1,9× e ~2,9× o conjunto nv 5 (ex.: arma 26 e 40 de ataque contra 14). Caem dos monstros da montanha (nv 15 só
  de monstros nv 15+); o Abade garante um Raro nv 15.
- **Forja (fase 6), aba "Forjar" no Ferreiro:**
  - **Materiais** (empilham, aba "Materiais" da mochila): **Minério de Ferro** (comum: lobos 10%, bandidos 14%,
    terracota 20%, General 4–6; espectro/yeti 25–30%), **Cristal de Gelo Eterno** (raro: espectro 8%, yeti 12%,
    discípulo 25%, Abade 3–4) e **Essência de Qi Ancestral** (especial: General 1, Abade 2).
  - **Melhorar +1 a +10:** cada nível soma **6% dos stats da base** (não dos bônus; inteiros sobem pelo menos 1 a cada
    3 níveis). Chance 100/95/90/80/70/60/50/40/30/20%. Custo: 2+2n minérios, cristais a partir do +5 (1 a 6) e
    1 essência do +8 em diante; ouro (30+30n) × (1 + nível do item/5). **Falhou: perde os materiais e o ouro** (o ouro é
    sempre cobrado, decidido pelo Lucas em 18/11/2026; o item não quebra nem volta).
  - **Subir raridade:** Comum→Incomum (12 minérios, 1 cristal, ouro) e Incomum→Raro (20 minérios, 4 cristais,
    1 essência, ouro): ganha um bônus aleatório novo (sem repetir) e mantém os que tinha.
  - **Trocar bônus** de Incomum/Raro: sorteia todos de novo (6–10 minérios, 1–2 cristais, ouro).
  - **Desmontar** (só da mochila): 1 + nível/5 minérios (+2 Incomum, +3 Raro, +metade do +N) e cristal para itens nv 10+,
    Raros e itens +6 ou mais.
- **Mercador Ambulante (fase 7):** o NPC que já existia ("Mercador Ambulante") virou loja. **4–6 equipamentos** sorteados
  do maior nível de base que o personagem pode usar (1, 5, 10 ou 15), **85% Raros** (resto Incomum), arma só da própria
  seita, preço = valor × raridade × 2 (⚠ ~2,5 mil por um Raro nv 15). Renova **a cada hora cheia do relógio real**
  (conta com o jogo fechado; o estoque fica no save). Sempre vende **Cristal de Gelo** (450) e **Pergaminho de Retorno**
  (80: usar na mochila leva à vila; não funciona na vila). As falas dele mudaram (antes "não tenho nada à venda").
- **Missões (fase 8):** 6 etapas novas na cadeia (14 no total): Ancião "A trilha do norte" (nv 10, chegar à montanha) →
  Guarda "Vultos na neve" (nv 11, 10 espectros) → Mestre "A fera branca" (nv 13, 6 yetis, arma Incomum nv 10) →
  Mercador "Cristais perdidos" (nv 14, 12 espectros) → Mestre "Guardiões do templo" (nv 16, 10 yetis, tronco Incomum
  nv 15) → Ancião "O Abade Caído" (nv 18). XP das 6: ~136 mil (~24% do trecho 10–20).
- **Balanceamento (fase 9):** curva do 10 ao 20 = a provisória **+12%**: 27000 / 31500 / 37000 / 42500 / 49500 / 56000 /
  64000 / 73000 / 83000 / 94000 (total ~558 mil). Simulador do 10 ao 20 (3 execuções, começando no nível 10 com
  equipamento Incomum nv 5, Auto ligado e missões): **Tormenta ~110 min, Geada ~109, Titã ~148, Víbora ~111** (média
  ~2 h, como decidido), mortes 0–6 no trecho todo. Ouro ganho ~50 mil; conserto 1–19% dele (corpo a corpo gasta mais).
  O trecho 1–10 não mudou (Tormenta ~57 min, Geada ~44, Titã ~60, Víbora ~63; General 48/48).
  Novos botões no `npm run balance`: `drop.materiais`, `forja.ouro`, `forja.chance`, `mercador.precos`.
- Testes: `npm run check:m9` (monstros, Abade, equipamentos, forja, materiais, mercador, pergaminho e save).

