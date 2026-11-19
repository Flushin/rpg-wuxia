# Trial

Decidido com o Lucas em 19/11/2026. Código: `src/core/trial.ts`; números em `docs/balanceamento.md` (seção "Trial").

- **Entrada:** portal na saída sul da vila (o último ponto sem portal). Pisar nele abre o menu do Trial; afastar-se fecha.
  Personagem nível **20+**.
- **Escolha:** o jogador escolhe qualquer chefe do jogo (General de Terracota, Yeti Ancestral, Patriarca Profanado,
  Abade Caído, Rei dos Bandidos; chefe novo entra sozinho) e o nível do Trial.
- **Níveis:** 10. Nível 1 = chefe nível 21 … nível 10 = chefe nível 30 (cada nível sobe o chefe em 1).
- **Liberação:** vencer o nível N de um chefe libera o N+1 **daquele chefe** (progresso salvo em `trialProgress`).
- **Custo:** 1000 de ouro no nível 1, +200 por nível (2800 no 10).
- **Drop:** bônus sobre o drop normal do chefe do Trial: 12% no nível 1 e, a cada nível, +5% sobre o anterior
  (12,60%, 13,23%, 13,89%, 14,59%, 15,32%, 16,08%, 16,89%, 17,73%, 18,62%). Vale para equipamento e material;
  o que passa de 100% vira chance de mais um.
- **Drop normal do Trial (definido na implementação):** ouro (cobre a entrada com até 30% de sobra), 1 Raro nv 15
  garantido, 1 equipamento nv 15 (raridade sorteada) e os materiais do chefe. Os itens saem com o nível do chefe
  (21–30), com bônus maiores que os nv 15 comuns: é o que deixa o jogador mais forte para os níveis altos.
- **Ponto fraco:** no Trial todos os chefes têm a mesma vida e o mesmo dano por segundo no mesmo nível; cada um mantém
  as mecânicas (círculos, linha/leque, invocação, fúria, velocidade) e a defesa alta contra um tipo de dano e baixa
  contra o outro (o mesmo lado do jogo normal). Invocados vêm 3 níveis abaixo do chefe.
- **Instância:** como as masmorras (`dungeon: true` no mapa): Auto não funciona, nada renasce, sem ganho offline;
  morrer, sair ou fechar o jogo encerra a corrida (o save nunca fica no Trial).

Ideias para depois: níveis acima de 10, recorde de tempo por chefe/nível, recompensa da primeira vitória de cada nível.
