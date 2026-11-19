# Masmorras

Decidido com o Lucas em 19/11/2026.

- **Entrada:** Portal das Masmorras na saída oeste da vila. Pisar nele abre um menu com as masmorras (por enquanto uma);
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
- **Sem portal na arena:** a saída fica só na entrada; um portal atrás da arena fazia quem desviava dos golpes sair sem querer.
- Balanceamento do chefe: `docs/balanceamento.md` (seção "Masmorra").

Ideias para depois: mais masmorras no menu (outras faixas de nível), recorde de tempo por masmorra, baú no fim em vez do drop do chefe.
