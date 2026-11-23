# Relíquias (Porto Noturno, etapa 4)

Decidido pelo Lucas em 22/11/2026. Dados em `src/data/relics.json`; regras em `src/core/world.ts` (`buyRelic`, `equipRelic`,
`relicEffect`, `rollRelicDrop`); telas em `src/ui/relicShop.ts`.

- **1 espaço** de relíquia no personagem (abaixo do corpo), a partir do nível 50.
- Cada relíquia: **atributos fixos** (somam em `gearStats`, como equipamento) + **1 efeito único**:
  roubo de vida, velocidade de ataque, recarga das skills (−%) ou vida máxima (%).
- **3 raridades:** comum (40.000) e rara (120.000) à venda no **Antiquário Lao**; **lendária** só de chefes.
- Drop lendário: cada chefe derrotado (mundo, masmorra, Trial) com o jogador no nível 50 tem 3% de dar uma lendária
  que ele ainda não tem (os chefes vão só até o nível 40, então a regra olha o nível do jogador).
- Coleção, como as montarias: fica para sempre, troca sem custo; sem mochila, venda, durabilidade, forja nem gemas.
- Save: campos opcionais `relics`/`relic`, saneados na leitura (sem versão nova).
- Antiquário no bairro sul do Porto Noturno (etapa 5, `porto-noturno.md`), com sprite próprio.
