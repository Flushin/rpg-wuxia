# Relíquias (Porto Noturno, etapa 4)

Decidido pelo Lucas em 22/11/2026. Dados em `src/data/relics.json`; regras em `src/core/world.ts` (`buyRelic`, `equipRelic`,
`relicEffect`, `relicStat`, `rollRelicDrop`, `assembleRelic`, `sellRelicShards`, `tickRelic`, `relicRhythm`); telas em `src/ui/relicShop.ts`.

- **1 espaço** de relíquia no personagem (abaixo do corpo), a partir do nível 50.
- Cada relíquia: **atributos fixos** (somam em `gearStats`, como equipamento) + **1 efeito único**:
  roubo de vida, velocidade de ataque, recarga das skills (−%) ou vida máxima (%).
- **3 raridades:** comum (40.000) e rara (120.000) à venda no **Antiquário Lao**; **lendária** só de chefes.
- **Lendárias refeitas (27/11/2026, Lucas), pensando no PvP futuro:**
  - Cada uma tem o seu chefe (`boss`): Coração do Dragão = Imperador Carmesim, Selo de Jade = Marechal das Cinzas,
    Pérola do Qilin = Imperador Espectral. Com o jogador no nível 50+, o chefe dá 1 fragmento (2 em masmorra);
    25 fragmentos montam a peça no Antiquário Lao; 2% de cair inteira; sobras vendidas ao Lao (3.000 cada).
    Os outros chefes e o Trial não dão mais lendária.
  - Atributos com orçamento menor (~60% de uma arma de topo; o poder fica no efeito). `primary` = Força ou
    Inteligência conforme o tipo de dano da seita. Atributos de PvP (um por lendária): Tenacidade (stun/lentidão
    duram menos no jogador), Resiliência (corta essa fração do bônus do crítico recebido), Penetração (ignora essa
    fração da defesa do alvo).
  - Efeitos iguais no PvE e no PvP: Último fôlego (abaixo de 30% da vida cura 25% em 3 s, recarga 120 s), Muralha
    imperial (escudo de 8% a cada 30 s), Ritmo do qilin (a cada 4 skills, a seguinte +25% de dano; buff visível).
  - Comuns e raras ainda sem mudança (redesenho depois).
- Coleção, como as montarias: fica para sempre, troca sem custo; sem mochila, venda, durabilidade, forja nem gemas.
- Save: campos opcionais `relics`/`relic`, saneados na leitura (sem versão nova).
- Antiquário no bairro sul do Porto Noturno (etapa 5, `porto-noturno.md`), com sprite próprio.
