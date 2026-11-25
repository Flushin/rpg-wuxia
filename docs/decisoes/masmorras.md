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
- A IA dos bots é a mesma base usada na arena ([arena.md](arena.md)).

Ideias para depois: mais masmorras no menu (outras faixas de nível, ex.: uma de nível 5+), recorde de tempo por masmorra, baú no fim em vez do drop do chefe.
