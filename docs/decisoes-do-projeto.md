# Decisões do projeto — Wanderers, RPG de navegador (inspiração: Dragon Oath)

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
- **Marco 6 (concluído, em teste): gráficos.** Definir o estilo de arte com **Tormenta + lobo + um trecho da floresta** antes de trocar o resto. Só depois estender para Geada, outros monstros, cidade e ruínas.
  - **Origem da arte:** pacotes gratuitos **CC0** (mesma linha do som). Créditos em `public/sprites/CREDITS.txt`.
  - **Primeira fatia (15/11/2026, feita):** Tormenta, lobo, árvores e piso da floresta já no jogo; retrato da Tormenta na mochila (fim da silhueta para ela). Detalhes em "Gráficos (marco 6)" abaixo.
  - **Geada (16/11/2026, feita):** Mage do KayKit recolorido em **branco e azul-gelo** (túnica branca, capa azul-gelo, cabelo prateado, sem chapéu), segurando um **leque de qi** gerado pelo script (nenhum pacote CC0 tem leque). Animações: parado, correr, ataque = `Spellcast_Shoot`, morte. Retrato na mochila (fim da silhueta para ela também).
  - **Cidade, NPCs e mestres (16/11/2026, feita):** Vila das Nuvens refeita (praça de pedra, casas wuxia, portão leste), 13 NPCs com sprite e falas em PT/EN, mestres das 4 seitas na criação e na praça. Detalhes em "Cidade, NPCs e mestres das seitas (marco 6)" abaixo.
  - **Para fechar o marco 6 (decidido pelo Lucas em 16/11/2026) — entram os 4 blocos:**
    1. **Bandidos e terracota:** espadachins, arqueiros, guerreiros de terracota e General com sprite KayKit recolorido.
       - **Bandidos:** roupa marrom e cinza, **lenço cobrindo a boca**; arqueiros com **chapéu de palha**.
       - **Terracota:** **barro alaranjado** (cor de argila) com armadura de placas; **General 1,5× maior com detalhes dourados**.
    2. **Ruínas, água e portais** com arte nova.
    3. **Efeitos visuais das skills** (raios, lâminas, gelo, névoa) no lugar dos efeitos simples.
    4. **Ícones de skills/itens** no lugar dos emojis + **medição de desempenho (FPS) no celular**.
  - **Fechamento (16/11/2026, feito):** os 4 blocos no jogo. Detalhes em "Fechamento do marco 6" abaixo.

### Roteiro dos próximos marcos (decidido pelo Lucas em 16/11/2026)
- **Ordem:** terminar o Marco 6 → **fechar a v1** → **novas seitas** → **conteúdo pós-nível-10** → online.
- **Marco 7 (concluído em 16/11/2026): fechar a v1 (versão 0.1).** Detalhes em "Fechamento do marco 7" abaixo.
  - Jogar do nível 1 ao 10 com as duas seitas e fechar os itens de "Em aberto" (curva de XP, drops, chefe). Atenção: a Geada morre ~2× mais que a Tormenta.
  - **Missões: cadeia principal do nível 1 ao 10 que guia o jogador até o General**, dada pelos NPCs que hoje só falam (ancião, guarda…). Sem missões repetíveis por enquanto. **Decidido em 16/11/2026** — ver "Missões (marco 7)" abaixo.
  - **Missões: feitas (16/11/2026).** Falta: jogar 1→10 com as duas seitas e fechar os itens de "Em aberto".
  - Polimento: tela de carregamento, instalar como app no celular (PWA) e versão na tela inicial — **feitos**.
  - **Save continua separado por aparelho** (sem exportar/importar e sem nuvem); resolver só no marco online.
- **Marco 8: Titã e Víbora (em andamento, 18/11/2026).** Skills aprovadas pelo Lucas em 18/11/2026 — ver "Titã e Víbora (marco 8)" abaixo. Sprites: Titã = Barbarian do KayKit com bastão; Víbora = Rogue encapuzado com agulhas.
- **Marco 9: pós-nível-10.** Nível máximo 20, mapa novo com 2–3 monstros e 1 chefe, novas bases de equipamento. **Sistemas escolhidos: craft** (fabricar/melhorar itens com materiais de monstros) e **mercador ambulante vendendo itens raros**. Gemas e baú/ouro compartilhado ficaram de fora por enquanto. Fase 0 (decisões) feita em 18/11/2026 — ver "Pós-nível-10 (marco 9)" abaixo. **Fases 3 a 9 feitas em 18/11/2026 (concluído, em teste).**
- **Marco 10: online.** Save na nuvem com conta e, depois, multiplayer.
- **Publicação na Play Store: depois de todos os marcos** (decidido pelo Lucas em 18/11/2026: primeiro a jogabilidade). O que falta está em "Pendências das auditorias (18/11/2026)".
- **Contínuo (feito em 17/11/2026, auditoria A1):** `npm test` (os `check:*`) e `typecheck` rodam no GitHub Actions em todo PR e antes de cada publicação; se falhar, o site não é atualizado. O `check:layout` e o `sim:balance` continuam manuais.


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
  de dano, HP máximo e bônus contra envenenado. Auto-combate usa a cura com a vida abaixo de 60% em combate.
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
mim (Claude) dentro das decisões da fase 0 e **precisam da confirmação do Lucas**.
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
    1 essência do +8 em diante; ouro (30+30n) × (1 + nível do item/5). **Falhou: perde só os materiais** (⚠ o ouro só é
    cobrado se der certo; o item não quebra nem volta).
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

### Auditoria do código (17/11/2026)
Decidido pelo Lucas em 17/11/2026, a partir do `AUDITORIA.md` (relatório e plano de refatoração).
- **Geada:** Stamina inicial é **10** (não 8 como estava escrito no fechamento do marco 7; o código e o simulador usam 10).
- **Mapas:** gerados pelo script `tools/gen-maps.mjs` no formato JSON do Tiled (não são editados no Tiled).
- **Ganho offline no app:** ao voltar do segundo plano depois de **mais de 5 min** fora com o Auto ligado, aplica o mesmo cálculo offline e mostra o resumo (a fazer na etapa D5).
- **Formatação:** Prettier aplicado de uma vez, num PR só de formatação.
- **Nomes no código novo:** em inglês; comentários e docs em português; ids salvos e de dados (`lamina`, `colar`, `comum`…) não mudam.
- **Volumes de som:** **por aparelho** (feito na B6; antes eram por personagem).
- **Ordem do plano:** Fase A (rede de segurança) → B (legibilidade) → C (estrutura) → D (lojas). Nenhuma etapa começa sem o Lucas pedir.
- **Lojas:** **só Android por enquanto** (Google Play); o código fica preparado para iOS.
- **Política de privacidade:** página PT/EN no GitHub Pages do jogo, com link em ⚙ e na tela inicial.
- **Nome do jogo (18/11/2026):** **Mistpeak** (no jogo, tela inicial, PWA e app); na loja **"Mistpeak: Idle RPG"**.
  appId `io.github.flushin.mistpeak`. Escolhido entre ~75 nomes triados por busca na web (Play, App Store, Steam e
  marcas); sem jogo, app ou marca "Mistpeak" encontrados. Falta o Lucas conferir no INPI/USPTO/EUIPO antes de publicar.
  O repositório continua `rpg-wuxia` (o endereço do site não muda). Substitui "Wanderers" (conflito com "Wanderer",
  idle RPG no Google Play).
- **Report de bug no app:** continua pelo Web3Forms, declarado na política de privacidade e no Data Safety. Confirmado pelo Lucas em 18/11/2026 (a auditoria de direitos dizia que seria substituído; vale esta decisão).

**Fase A feita (17/11/2026, sem mudar regras do jogo):**
- **A1:** testes no GitHub Actions (ver "Contínuo" no roteiro); `esbuild` declarado no `package.json`; `npm test` roda os checks (8 desde o módulo de balanceamento).
- **A2:** simulador determinístico — o relógio dos renascimentos acompanha o tempo simulado e a luta do chefe usa a semente
  desde o começo. A medição mudou (Tormenta ~61 min, Geada ~43 min; Tormenta vence o chefe com Incomum 10/10): antes os
  monstros pareciam renascer mais devagar do que no jogo ao trocar de mapa. Detalhes em `docs/balanceamento.md`.
- **A3:** se o armazenamento não puder ser lido, a tela inicial mostra o aviso com "Tentar de novo" e nada é gravado
  (antes isso virava "sem personagens" e a próxima gravação apagava os 4 espaços). A leitura tenta 3 vezes.
- **Teste instável corrigido:** o `check:quests` falhava ~1 em 12 vezes (confundia um drop com a recompensa da missão).
- **A4:** README, `docs/balanceamento.md` e o `_doc` de `items.json` atualizados.

**Fase B em andamento:**
- **B1 (17/11/2026):** Prettier 3.6.2 aplicado em todo o código de uma vez (`.prettierrc.json`: 120 colunas, aspas simples)
  e `.editorconfig`. Não formata JSON (os de sprites são gerados pelos scripts do Blender e os de `src/data` ficam em
  tabelas de uma linha por item) nem Markdown. Comandos: `npm run format` (formata) e `npm run format:check` (confere);
  o `format:check` roda no CI dos PRs. No VSCode, a extensão Prettier formata ao salvar (recomendada em
  `.vscode/extensions.json`). O JS do build saiu idêntico (mesmo hash) e o simulador deu a mesma saída.
  Linhas com mais de 120 colunas: de 752 para 146 (o que sobrou são textos e comentários longos, que o Prettier não quebra).
- **B2 (17/11/2026):** `src/ui/dom.ts` com `byId()` (pega elemento pelo id) e `escapeHtml()` (escapa `& < > " '`);
  apagadas as 13 cópias de `$` e as 4 de `esc` dos arquivos de `src/ui/`. Corrigido: o nome do personagem no painel de
  Atributos (C) não era escapado — um nome com `<` quebrava o painel. Testado com o nome `a<b&"c'>` (painel C, mochila e
  tela inicial).
- **B3 (17/11/2026):** camadas de desenho com nome em `src/render/depth.ts` (`DEPTH.GROUND`, `TELEGRAPH`, `NAME`,
  `SKILL_FX`, `FLOAT_TEXT`…) no lugar dos números soltos; em `gameScene.ts`, constantes para a área de clique/toque
  (`PICK`), a elipse do aviso do chefe derivada de `TILE_W/TILE_H` e as cores dos textos flutuantes (`FLOAT_COLOR`).
  Mesmos valores (a elipse muda 0,005 px por tile de raio, por usar √2 exato).
- **B4 (17/11/2026):** o painel do auto-combate (☰) lê os números das constantes do código em vez de repeti-los no
  texto: vida do Véu de Névoa (`SHIELD_HP`), tempo dos itens no chão (`groundSeconds`), janela do ritmo e mínimo de dados
  (`BUCKET_SEC × MAX_BUCKETS`, `RATE_MIN_SEC`) e faixas do ganho offline (`OFFLINE_TIERS`). **Corrigido:** a dica do Mestre
  Lei dizia que o Quebra-Guarda reduz a defesa em 30%; a skill reduz **40%** (`skills.json`). As dicas de `tips.json` ainda
  repetem números (durabilidade 10%, +8% por nível, faixas offline) — conferidos e iguais ao código.
- **B5 (17/11/2026):** `src/render/textures.ts` passou de 219 para ~35 linhas: só a sombra, o ponto de luz das
  partículas e uma **figura genérica** (`PLACEHOLDER`), usada por quem não tem folha de sprites (ex.: Titã e Víbora antes
  da arte do marco 8). Saíram os pisos, árvores, casas, lobo, bandidos, terracota, General, jogadores e NPCs desenhados
  em código (todos já tinham arte). Tipo de piso sem arte passa a mostrar grama em vez de buraco. `BY_TEXTURE` continua
  (liga os nomes de sprite dos dados às folhas). `public/maps/tiles.png` (1 KB) continua: é o tileset do formato Tiled.
- **B6 (17/11/2026):** preferências do aparelho num lugar só: `src/platform/prefs.ts` com `getPref`/`setPref` (o
  `try/catch` uma vez só) e a lista `PREF` de chaves documentada. **As chaves são as mesmas** (preferências atuais
  preservadas). **Volumes agora são por aparelho** (decisão P6): ficam em `rpg-audio`; na primeira vez, herdam os volumes
  do personagem que entrar. O campo `audio` do save continua igual (formato não muda), mas só é lido nessa primeira vez.

**Fase B concluída em 17/11/2026** (B1–B6). Fase C (estrutura):
- **C1 (17/11/2026):** o painel ⚙ saiu de `src/ui/tips.ts` para `src/ui/settingsPanel.ts` (`SettingsPanel`).
  `TipManager` ficou só com as dicas e ganhou `setEnabled()` e `resetSeen()`, que o painel chama. O comportamento é o mesmo.
- **C2 (18/11/2026):** o painel de Atributos (C) saiu de `src/ui/hud.ts` para `src/ui/attrsPanel.ts` (`AttrsPanel`, com
  `open`, `set()` e `update()`, no mesmo molde do painel de skills). O `Hud` continua com `togglePanel()` e o som de abrir/fechar.
- **C3 (18/11/2026):** `showTitleScreen` (`src/ui/create.ts`) foi dividida em `setupSlotList`, `setupCreateView` e
  `setupDeleteView`, que dividem um estado único (`TitleState`: arquivo de saves, espaço e seita escolhidos).
- **C4 (18/11/2026):** o `<style>` do `index.html` (2.200 linhas) foi para `src/styles/`, em 10 arquivos por assunto,
  ligados por `src/styles/index.css` (`<link>` no `<head>`, então a tela de carregamento continua com estilo antes do JS).
  **A ordem dos arquivos é a ordem original das regras e importa.** Conferido no navegador: as 405 regras carregadas são
  as mesmas, na mesma ordem. A folha de ícones passou a `url(/sprites/icones.png)` (o Vite reescreve para relativo no
  build). O build agora minifica o CSS (antes ia sem minificar dentro do HTML). Juntar regras do mesmo elemento que estão
  espalhadas fica para depois, uma de cada vez, porque aí a ordem muda.
- **Defeito visto e não corrigido na C4:** no celular deitado baixo (Fold fechado, 920×316), os botões de "Tamanho da
  interface" no ⚙ não cabem e "Grande" fica cortado. Já era assim antes.
- **C5 (18/11/2026):** o que o código sabe de cada mapa está em `src/core/mapsConfig.ts` (`MAPS_CONFIG`): mapas
  carregados, quais são cidade, música, tipo de árvore, enfeites na grama, arena do chefe (braseiros) e por onde o Auto
  sai quando não há portal direto para a cidade (`autoExitVia`, ruínas → floresta). `HOME_MAP` é onde o personagem começa
  e renasce. O campo `map` das músicas saiu do `audio.json`. **Mapa novo = JSON gerado + uma entrada no `MAPS_CONFIG`.**
  Conferido: mesmos enfeites, braseiros e música em cada mapa, e simulador idêntico.
- **C6 (18/11/2026):** a reação aos eventos do mundo (textos que sobem, toasts, golpes, flechas, brilho de drop, efeitos
  de skill) saiu da `GameScene` para `src/render/eventFeedback.ts` (`EventFeedback`), com uma função por grupo: combate,
  skills, recompensas e avisos. A cena ficou com 426 linhas (eram 694). `skillById()` em `core/skills.ts` substitui as
  buscas repetidas, e `TEXT_RES` foi para `render/display.ts`. Conferido disparando os 33 tipos de evento: mesmo resultado.
- **C7 (18/11/2026):** o `World` (1.841 linhas) virou fachada (~1.270) e o corpo de cada assunto foi para
  `src/core/world/`: `inventory.ts`, `shop.ts`, `quests.ts`, `boss.ts`, `npcs.ts`, `offlineApply.ts`, `saveCodec.ts`
  (e `geometry.ts` com `dist`). São funções que recebem o `World` como `w`; **o `World` continua com os mesmos métodos**
  (só repassam), então UI, Auto e testes não mudaram. Os corpos foram movidos sem mudança, e o simulador deu saída
  idêntica em cada passo (mesma ordem de sorteios). Campos que os módulos precisam deixaram de ser `private` e estão
  agrupados como "estado interno"; métodos internos têm comentário. `pf` → `findPathFor`; `quest` declarado com os campos.
  **Regras devolvem códigos de erro** (`ActionError` em `core/types.ts`: `noGold`, `bagFull`, `needLevel`, `sectOnly`…)
  e a interface traduz em `src/ui/actionError.ts` (mesmos textos de antes).
- **C8 (18/11/2026):** versões do save com nome, em `src/core/saveFormat.ts`. `SAVE_FILE_VERSION = 2` é o arquivo
  inteiro (4 espaços); `CHARACTER_SAVE_VERSION = 1` é um personagem (`SaveData`). Ao carregar, cada personagem passa
  por `migrateCharacter`, que aplica em ordem as funções de `CHARACTER_MIGRATIONS` (hoje vazia: nada muda nos saves
  atuais). Save sem versão conta como 1; save de versão mais nova (app mais novo em outro aparelho) não é mexido.
  **Regra:** campo novo opcional não precisa de versão (a leitura corrige o que falta); campo que muda de sentido,
  nome ou formato sobe `CHARACTER_SAVE_VERSION` e ganha uma migração. Necessário antes do marco online.

**Fase C concluída em 18/11/2026** (C1–C8). Próxima: Fase D (preparação para as lojas), quando o Lucas pedir.

**Fase D (preparação para as lojas)** — iniciada em 18/11/2026.
- **D1 (18/11/2026):** camada de plataforma em `src/platform/`: único lugar do código que sabe se o jogo roda no
  navegador ou no app das lojas (`isNative`). Hoje só existe a implementação web, igual ao comportamento anterior:
  save (`storage.ts`, IndexedDB), preferências (`prefs.ts`), segundo plano (`lifecycle.ts`: `onPause`/`onResume`),
  voltar (`backButton.ts`, usa `backGuard.ts`), `isTouch` (`input.ts`), `restartApp()` e `registerServiceWorker()`
  (`index.ts`, o service worker não é registrado no nativo), vibração (`haptics.ts`, vazia) e compras (`purchases.ts`,
  vazia). **Regra:** `localStorage`, `idb-keyval`, `location.reload`, `serviceWorker` e eventos de ciclo de vida só
  dentro de `src/platform/`. A implementação nativa (Capacitor) entra na D2 nesses mesmos arquivos.
- **D2 (18/11/2026):** app Android com **Capacitor 8** (`capacitor.config.ts`, guia em `docs/android.md`).
  - **APK de teste gerado pelo GitHub Actions** em todo PR (`.github/workflows/android.yml`), decidido pelo Lucas:
    o ambiente de desenvolvimento não baixa o Android SDK.
  - ~~**appId provisório** `io.github.flushin.wanderers` e nome "Wanderers"~~ (resolvido: **Mistpeak**, appId
    `io.github.flushin.mistpeak`; ver "Nome do jogo"). Texto original: em espera, o Lucas pode mudar o nome
    do jogo. Decidir antes do primeiro envio à Play Store (depois disso o appId nunca muda).
  - A pasta `android/` é gerada na hora (`npm run android:prepare`) e não fica no repositório, para o appId ficar
    num lugar só; passa a ser versionada quando precisar de arquivos nativos próprios (D7).
  - Implementações nativas em `src/platform/`: save em arquivo JSON (gravação atômica + 1 backup), pause/resume e
    botão Voltar pelo `@capacitor/app`, barra de status escondida, vibração pelo `@capacitor/haptics` (ainda sem uso).
  - Licenças do Capacitor (MIT) na tela de créditos e em `docs/licencas/`.
- **D3 (18/11/2026):** botão/gesto de voltar fecha a janela de cima (Sair do jogo? → créditos → report → ⚙ → resumo
  offline → dica → janelas do HUD), em `src/ui/backAction.ts`. Sem janela aberta: no app Android aparece **"Sair do
  jogo?"** (salva antes de fechar); na web/PWA continua o aviso + segundo voltar para sair. Também vale na web: antes
  o voltar com uma janela aberta mostrava o aviso de saída em vez de fechá-la.
- **D4 (18/11/2026):** telas cheias (`#create`, `#loading`, `#bigmap`, painéis, créditos, report, offline) respeitam
  o notch e os cantos arredondados (`max(12px, env(safe-area-inset-*))`). Sem notch, igual a antes.
- **D5 (18/11/2026):** **ganho offline ao voltar do segundo plano** (P3): se o jogo ficou fora da tela 5 min ou mais
  (`RESUME_OFFLINE_MIN_MS` em `core/offline.ts`) com o auto ligado, aplica o mesmo cálculo de quando o jogo abre
  (`World.applyResumeOffline`) e mostra o resumo; o auto espera o resumo ser fechado. Vale no app e na web (aba escondida).
- **D6 (18/11/2026):** memória. As folhas de personagens e monstros (as imagens mais pesadas) são carregadas **por
  mapa** (`src/render/sheetLoader.ts`): ficam só a seita do jogador e quem aparece no mapa (monstros, invocação do
  chefe, NPCs); as do mapa anterior são liberadas. Na troca de mapa o jogo espera as folhas chegarem (fração de
  segundo; nada anda nesse meio-tempo). Medido no navegador: folhas na memória de ~81 MB (todas) para 27–33 MB por
  mapa. Cenários, pisos e ícones continuam carregados no início. No APK vão só os sons `.ogg` (−1,8 MB;
  `tools/android-trim-audio.mjs`).
- **D8 (18/11/2026):** política de privacidade PT/EN em `public/privacidade.html` (publicada em
  `https://flushin.github.io/rpg-wuxia/privacidade.html`), com link na tela inicial e em ⚙ (no app abre no navegador do
  celular). Declara o report de bug pelo Web3Forms (P10) com a lista exata do que é enviado. Respostas do Data Safety
  (Play) e das privacy labels (Apple) e rascunho da descrição da loja em `docs/lojas.md`.
  **Pendente com o Lucas:** e-mail de contato (a Play exige; `TODO` na página) e público-alvo (a página diz que o
  jogo não é direcionado a crianças).

**Fase D concluída em 18/11/2026** (D1–D8). Pendências antes da Play Store: ver "Pendências das auditorias (18/11/2026)" logo abaixo.
- **D7 (18/11/2026):** ícone e tela de abertura do app gerados de `assets/` (`tools/icons/make_app_icons.py` →
  `@capacitor/assets`). Versão do app lida do `package.json`: `versionCode = MAJOR*10000 + MINOR*100 + PATCH`
  (`tools/android-version.mjs`). **Regra:** subir a `version` do `package.json` antes de cada envio à loja.

**Pendências das auditorias (18/11/2026, antes do marco 9).** Decidido pelo Lucas em 18/11/2026:
- **Monetização:** a **1ª versão sai sem anúncios e sem compras** (substitui a resposta de 17/11/2026 na auditoria de
  direitos, que previa anúncio com recompensa + diamantes). A política de privacidade e o Data Safety continuam dizendo
  "sem anúncios". A monetização foi para "Melhorias — Futuro".
- **E-mail de contato:** será criado um e-mail só do jogo (não o pessoal); o `TODO` em `public/privacidade.html` fica
  até lá.
- **Tarefas de loja fora do código ficam para depois de todos os marcos:** busca de marca "Mistpeak" (INPI/USPTO/EUIPO),
  conta no Play Console e verificação de identidade, chave de assinatura, teste fechado (12 testadores por 14 dias),
  provas de licença que faltam baixar (`docs/licencas/README.md`), imagens da loja, revisão por advogado, conferir a
  lista exata de bibliotecas do APK com o Gradle. O público-alvo continua **13+** (resposta de 17/11/2026).
- **Feito no PR desta data:** bibliotecas nativas do APK (AndroidX, Apache Cordova, ionfilesystem, Kotlin) na tela de
  créditos e em `docs/licencas/`; `tools/sprites/fetch-assets.sh` com os espelhos fixados por commit e cada modelo
  conferido por SHA-256 (`tools/sprites/models.sha256`), aceitando os pacotes oficiais para provar que são iguais;
  rascunho do questionário de classificação indicativa (IARC) em `docs/lojas.md`; tabela "Números atuais" em
  `docs/balanceamento.md`; `AUDITORIA.md` e `AUDITORIA_DIREITOS.md` atualizados.

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
- Nível de personagem — **nível máximo 10** na v1 (**20** desde o marco 9, fase 1).
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
- **Controle:** volumes separados de efeitos e música + mudo, na engrenagem de configurações (padrão: efeitos 80, música 50). Por aparelho desde a B6 (17/11/2026).

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
- **Módulo de balanceamento (18/11/2026):** ajustes de número passam por `npm run balance -- <chave> +10%`, que grava multiplicadores em `src/data/balance.json` (com histórico) sem mexer nos outros JSON. `src/core/balance.ts` aplica ao carregar; tudo em 0% = jogo igual (simulador idêntico). Lista de chaves e uso em `docs/balanceamento.md`.

### Escopo da primeira versão jogável
- 1 cidade com NPCs — funcionais: **ferreiro** (conserto) e **vendedor de poções**; os demais sem função (mestres das 4 seitas, guarda do portão, ancião, moradores e mercador ambulante — só falas). No Marco 7, parte deles passa a dar as missões da cadeia principal.
- Floresta (lobos + bandidos) e Ruínas de Terracota (guerreiros + General).
- 2 classes: Tormenta e Geada.

## Em aberto (detalhes para a fase de balanceamento)
*Fechados para a v1 em 16/11/2026 (ver "Fechamento do marco 7"); revisar com o retorno dos jogadores.*
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

- **Tela "Créditos e licenças"** *(17/11/2026, pedida pelo Lucas a partir do `AUDITORIA_DIREITOS.md`)*: abre por um link
  discreto no rodapé da tela inicial (ao lado da versão) e pelo botão "Créditos e licenças" em ⚙. Mostra quem fez o jogo, os
  créditos de arte e som (todos CC0) e as bibliotecas com o texto completo da licença (toca para abrir). As licenças MIT e
  Apache-2.0 exigem esse aviso no app. Os textos vêm dos arquivos de `docs/licencas/`, sem cópia. Fecha com X, Fechar,
  toque fora ou Esc. Código: `src/ui/credits.ts`. Registro de assets: `ASSETS_LICENCAS.md`.

## Melhorias — Futuro
Sugestões aprovadas pelo Lucas. **Só implementar quando ele pedir explicitamente.**

- **Monetização (18/11/2026):** anúncio com recompensa opcional e pacotes de diamantes para itens fixos da loja. Fora da
  1ª versão. Antes de fazer: Google Play Billing, consentimento (UMP), proteger os diamantes pagos (save só no aparelho)
  e refazer política, Data Safety e classificação indicativa (`AUDITORIA_DIREITOS.md` §4.5).
