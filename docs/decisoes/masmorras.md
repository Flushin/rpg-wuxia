# Masmorras

Decidido com o Lucas em 19/11/2026.

- **Entrada:** Portal das Masmorras na saída oeste da vila. Pisar nele abre um menu com as masmorras ;
  afastar-se fecha o menu. Lista em `src/core/dungeons.ts`.
- **Formato:** instância. Cada entrada é uma corrida nova; os monstros não renascem; chefe no fim com item garantido.
  Morrer, sair pelo portal ou fechar o jogo encerra a corrida (o save nunca fica dentro da masmorra).
- **Custo:** ouro por entrada (Desfiladeiro do Gelo Eterno: 250), sem limite de entradas.
- **Drop:** chance de equipamento dos monstros × 1,25 (`DUNGEON_EQUIP_DROP_MUL`); raridade igual à dos mapas.
- **Auto:** não funciona de jeito nenhum (não liga, entrar desliga, o tick desliga se algo ligar); masmorra não é mapa de
  caça do Auto e não rende ganho offline.
- **Primeira masmorra:** Desfiladeiro do Gelo Eterno (`gruta`), nível 10+, Espectros de Gelo e Yetis nv 11–14,
  chefe Yeti Ancestral nv 15 (invoca 2 Yetis a 50% da vida; Raro nv 10 garantido + 40% de item nv 15).
  Monstros reaproveitam sprites existentes (sem arte nova).
- **Segunda masmorra (19/11/2026):** Mosteiro Profanado (`mosteiro`), nível 16+, 500 de ouro. Monges Profanados,
  Almas Penadas e Guardiões de Pedra nv 16–19 (14 monstros); chefe Patriarca Profanado nv 20 com **fúria** a 30% da vida
  (golpes ~54% mais rápidos, +30% de dano, +25% de passo; acaba se a luta recomeçar), sem invocação.
  Raro nv 15 garantido + 40% de item nv 15. Sprites reaproveitados (Discípulo, Espectro, Terracota, Abade), sem arte nova.
- **Terceira masmorra (19/11/2026):** Covil dos Bandidos (`covil`), nível 20+ (fim de jogo), 1000 de ouro. Salteadores,
  Besteiros e Brutamontes nv 20–22 (14 monstros; os de cada acampamento entram em combate juntos); chefe Rei dos Bandidos
  nv 22 com **golpe em linha**: os golpes marcados alternam círculo e uma faixa que sai dele na direção do jogador
  (9 × 1,8, 2,2× o dano); com 50% da vida a linha vira leque de 3. Raro nv 15 garantido + 1 item nv 15 garantido.
  Sprites de bandido reaproveitados (Brutamontes e Rei maiores), sem arte nova.
- **Sem portal na arena:** a saída fica só na entrada; um portal atrás da arena fazia quem desviava dos golpes sair sem querer.
- Balanceamento do chefe: `docs/balanceamento.md` (seção "Masmorra").

- **Masmorras difíceis (26/11/2026, pedido do Lucas):** sem nível mínimo (`minLevel: 1`; o menu mostra "qualquer nível"),
  mesmo traçado (`deepDungeon` em `tools/gen-maps.mjs`): entrada, dois braços de duas câmaras, antecâmara e pátio do chefe;
  cada câmara é um grupo que entra em combate junto. Monstros novos com sprites reaproveitados (+30% de vida em média).
  - Santuário de Jade (`santuario`), 3000 de ouro, 21 monstros nv 30–32 (Serpente/Grou do Santuário, Sentinela de Jade);
    Ancião da Névoa nv 32 (sprite Senhor da Névoa): círculo, 2 Sentinelas a 50%, fúria a 30%. Raro nv 25 + item nv 25 + 50% item nv 35.
  - Templo das Cinzas (`templo`), 6000, 25 monstros nv 40–42 (Andarilho do Templo, Monge Incandescente, Assassino Rubro,
    Colosso de Cinzas); Marechal das Cinzas nv 42 (sprite General): círculo, linha (leque a 60%), 2 Colossos a 50%, fúria a 30%.
    Raro nv 35 + item nv 35.
  - Corte da Lua Fria (`corte_lua`), 10000, 26 monstros nv 50–52 (Lobo da Lua Fria, Feiticeira da Corte, Guarda da Lua);
    Imperador Espectral nv 52 (sprite Imperador Carmesim, dano espiritual): círculo, linha (leque de 5 a 50%), 2 Guardas,
    fúria a 25%. Raro nv 35 + 2 itens nv 35.
  - Simulação (`npm run sim:balance -- --masmorra=<mapa> [--equipe] [--comuns]`): chefes com vitória parecida ou menor que a
    do Senhor da Névoa/Imperador no nível da faixa; Corte da Lua em equipe ~4–5 min de luta e ~50–80% de vitória;
    os comuns do Templo levam 4–8 min solo (Covil: ~45 s).

## Masmorra em equipe (bots) — decidido 25/11/2026, a implementar

- Na porta da masmorra, menu: **Sozinho** (como hoje) ou **Equipe (bots)**.
- Equipe = jogador + 3 bots de classes **sorteadas**, diferentes da do jogador (e entre si, quando houver classes).
  O jogador escolhe só o modo; os bots agem sozinhos, sem comandos.
- Bots: nível = meio da faixa da masmorra, limitado ao nível do jogador; equipamento incomum com no máximo 1 peça rara;
  sem upgrade, gemas ou relíquias. Usam as skills da classe e só poções **pequenas** de HP e de mana; não usam ultimate.
- Bot morto: o jogador pode reviver segurando perto dele por ~3 s (sem atacar); volta com 50% da vida;
  1 vez por bot por sala/luta de chefe.
- A run só falha se o jogador morrer.
- Monstros e chefe: só a **vida** aumenta (ataque e defesa iguais). Multiplicador separado para comuns e chefe,
  definido por simulação (`npm run balance`): tempo para matar em equipe parecido com o do solo.
- Recompensa: igual ao modo solo.
- A IA dos bots é a mesma base usada na arena ([arena.md](arena.md)). **Base feita** em `src/core/bots.ts` (montagem, IA, luta simulada; `npm run check:bots`); nível das skills ativas = nível/4 (1–15). Integrado no jogo em `src/core/world/party.ts`
  (`npm run check:party`): menu com Sozinho/Equipe; bots só lutam com monstros já em combate (ou o alvo do jogador),
  não puxam sozinhos; monstro persegue quem bateu primeiro; bots regeneram 1% da mana/s; "luta" para o reviver =
  enquanto algum monstro está em combate (acabou, a contagem zera); reviver: ✚ no HUD (celular: `thumbLayout.ts`
  `revive`) ou tecla F, até 1,8 tile; vida dos bots no quadro do jogador. Vida extra em `balance.json`:
  `equipe.vida_comuns` 3.5 e `equipe.vida_chefe` 4.5 (simulação no World real, `npm run sim:balance -- --masmorra=<mapa>
  [--comuns] --equipe`: com esses valores o tempo médio em equipe empata com o solo nas 3 masmorras; escolhido pelo Lucas
  em 25/11/2026, sabendo que no Mosteiro Titã e Tormenta vencem menos em equipe, porque o chefe bate só no jogador).
  Golpes marcados do chefe pegam os bots também; cada bot percebe a marca com 70% de chance e sai dela.

Ideias para depois: mais masmorras no menu (outras faixas de nível, ex.: uma de nível 5+), recorde de tempo por masmorra, baú no fim em vez do drop do chefe.
