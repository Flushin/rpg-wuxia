# Arena (PvP contra bot) — decidido e feito em 25/11/2026

Preparação para o PvP online: por enquanto o jogador luta contra um bot.

- **Local:** Porto Noturno, espaço banco/arena no sul (onde fica o portal do Trial).
- **Formato:** 1v1 contra um bot de outra classe, com a mesma IA dos bots da masmorra em equipe ([masmorras.md](masmorras.md)).
- **Poder:** o do jogador **nunca** é alterado. O bot recebe de **80% a 130%** do "poder total" do jogador
  (vida, dano, crítico, elemento, relíquia), conforme os pontos de arena.
- **Ranking:** pontos estilo ELO; vitória sobe, derrota desce; meta de ~50% de vitórias em qualquer build.
- **Prêmio:** pontos de arena + ranking; a moeda de arena compra só cosméticos/títulos (sem poder).
- **Pontos (decidido 25/11/2026):** ELO, todos começam em 1000; vitória +10 a +30, derrota −10 a −30, conforme a força
  do bot (vencer um bot mais forte vale mais). Sem limite de lutas por dia.
- **Loja (decidido 25/11/2026):** moeda de arena separada (toda luta dá, vitória mais). Vende **títulos** mostrados
  acima do nome (alguns exigem ranking mínimo) e **trajes exclusivos** da arena (1 por seita, como os do Governador Bai).

## Implementação
- Regras em `src/core/arena.ts`, luta no mundo em `src/core/world/arena.ts`, janela em `src/ui/arenaShop.ts`,
  títulos em `src/data/arena.json`; `npm run check:arena` (com `--sim`, a tabela completa).
- NPC: **Mestre da Arena Tie** (`mestre_arena`, papel `arena`) no Porto (80, 68), ao lado do portal do Trial. A luta é no
  círculo do mapa do Trial, sem chefe; depois o jogador volta ao lado do NPC.
- "Poder" = vida × dano do golpe normal (com crítico). O bot copia as defesas, a esquiva, o acerto e as resistências do
  jogador; vida e dano = raiz(poder) × os do jogador. Calibragem por seita do jogador em `balance.json`
  (`arena.poder_bot.<seita>`: Tormenta 0,85, Geada 1,2, Titã 1,6, Víbora 1,05), medida na simulação para que 100% seja
  luta equilibrada. Resultado: ~85% de vitórias com o bot a 80%, ~58% a 100% e ~12% a 130%, então o ponto de 50% fica
  dentro da faixa.
- Todo dano na arena vale 25% (`ARENA_DAMAGE`), igual para os dois lados. Sem isso, no nível 50 uma skill tira quase a
  vida inteira e a luta acaba em 1–2 s.
- Contagem de 3 s em que ninguém anda nem ataca; limite de 120 s (vence quem tem mais vida em %).
- Perder não é morrer: sem penalidade, o jogador volta com vida e mana cheias. Sair do mapa no meio da luta conta como
  derrota.
- Força do bot sorteada em ±150 pontos em volta dos do jogador; ELO com K 40 (de 10 a 30 por luta). Moeda: 30 na
  vitória e 10 na derrota. Faixas: Bronze, Prata 900, Ouro 1100, Jade 1300, Lenda 1500.
- Títulos (6, de 150 a 2500 moedas; 4 pedem pontos mínimos) aparecem acima do nome. **Falta:** os trajes exclusivos
  da arena (1 por seita), que precisam de arte nova no Blender (`tools/sprites`).
