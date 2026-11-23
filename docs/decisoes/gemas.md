# Gemas e encaixes (Porto Noturno)

Decidido com o Lucas em 22/11/2026. Etapa 2 de 5 da cidade do Porto Noturno (nível 50). Números em `src/data/items.json` → `"gems"`;
lógica em `src/core/world/gems.ts`; janelas em `src/ui/gemShop.ts`.

- **7 gemas, níveis I–V** (atributos derivados): Rubi ataque físico 8/18/29/42/56; Ametista ataque espiritual (igual);
  Jade vida 60/130/215/310/420; Pérola mana 30/65/110/155/210; Safira crítico 1/2/3,5/5/7%;
  Ônix defesa física + espiritual 6/13/21/30/40; Topázio precisão + esquiva 5/11/18/26/35.
- **Joalheiro** vende só nível I (800 ouro) e Pó de Estrela (3.000). Fusão: 3 iguais → 1 do nível seguinte, custa 10% do valor
  da gema nova. Valor do nível n = 800 × 3^(n−1).
- **Ferreiro-mestre**: encaixes por raridade comum 1, incomum 1, raro 2, épico 3. Abrir: 2.000 / 6.000 / 15.000 + 1 Pó de Estrela.
  Colocar é grátis; retirar custa 20% do valor da gema, que volta para a mochila.
- Item com gema não se vende, destrói nem desmonta (nem pelo Auto). Item quebrado perde também o efeito das gemas.
- Visual: losango CSS na cor da gema com o nível em romano; encaixe vazio = losango tracejado.
- Save: campo opcional `gems` no item (id ou null por encaixe). Sem versão nova: saves antigos não têm o campo (= sem encaixes)
  e a leitura saneia (máximo da raridade, gema desconhecida vira vazio).
- Os dois NPCs ficam no bairro nordeste do Porto Noturno (etapa 5, `porto-noturno.md`), com sprites próprios;
  o Pó de Estrela passa a cair de monstros nv 45+ quando eles existirem.
