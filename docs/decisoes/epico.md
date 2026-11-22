# Equipamento Épico

Decidido pelo Lucas (20/11/2026). Código: `src/core/items.ts` (`EPIC_*`, `epicTierBase`, `epicBonuses`, `itemStats`),
drop em `src/core/world/inventory.ts` (`rollEpic`), forja em `src/core/world/forge.ts`. Teste: `npm run check:epic`.
Wiki: `#/mecanicas/epico`.

## Raridade
- `epico`, nome Épico / Epic, cor `#b45cff`, acima do Raro. Peso 0: nunca sai no sorteio normal de raridade.

## Drop
- 0,5% por abate em qualquer monstro; 1% em chefe (todo monstro com `boss`: mapa, masmorra e Trial).
- Só jogando: auto-combate ligado (`auto.state === 'on'`) e ganho offline não dão. Com o auto pausado, conta.
- Ajudantes invocados por chefes não dão. O monstro precisa ter nível ≥ nível do personagem − 10.
- Sorteio em `w.epicRng` (separado de `w.rng`): os outros drops e o combate têm a mesma sequência de antes.
- Peça sorteada entre todas as que o personagem usa (armas só da própria seita). Sem garantia (pity) de propósito.
- Mochila cheia: fica 10 min no chão (os outros itens, 60 s). Sair do mapa limpa o chão, como já era.

## Força
- Sem nível próprio: usa a base do mesmo slot (arma: mesma seita) com o maior nível exigido ≤ nível do personagem,
  a mesma que um Raro daquele nível teria. Muda a cada 5 níveis. Nome e ícone são fixos por épico (ícones `epico_*` desenhados em `tools/sprites/icons.py`).
- Stats da base: `round(stat com a melhoria (+N) × 1,3)`. A forja soma por cima como no Raro, então +N épico ≈ 1,3 × +N raro.
- 2 bônus fixos: 1,3 × o máximo que um Raro sortearia no nível do personagem (`max × (1 + 0,2 × (nível − 1)) × 1,3`).
  - Tormenta, Titã e Víbora: Força + elemento da seita; Geada: Inteligência + Gelo. Motivo: elemento soma direto ao
    dano (só cai com resistência) e Força/Inteligência dão +2 de ataque; os dois escalam com as skills.
  - Os bônus seguem a classe de quem usa (troca de classe nunca deixa o item errado) enquanto não forem trocados.
- Equipa em qualquer nível; a arma continua presa à seita.

## Forja e economia
- Cai +0; melhora até +10 com os materiais e as chances do Raro da faixa e o ouro × 2 (`FORGE.epicGoldMul`).
- Não sobe raridade e não vende, nem pelo auto (erro `epicLocked`).
- Trocar bônus (Lucas, 22/11/2026): sorteia 2 atributos diferentes do pool (`bonusPool`), evitando repetir o par atual;
  valor = mesma fórmula épica, pelo nível de quem usa. O item guarda só o `stat` do pool (`elemAtk` vira o elemento da
  classe de quem usa) com `value: 0`; `bonuses` vazio = bônus da classe. Custo: 3× materiais e ouro da troca do Raro da
  faixa (`FORGE.epicRerollMul`; sem o ×2 da melhoria).
- Desmontar (Lucas, 22/11/2026): liberado para o épico repetido não travar a mochila. Rende como um Raro da faixa + 1
  Essência de Qi. A janela do ferreiro pede confirmação duas vezes.
- Conserto pelo nível do personagem.

## Nomes (um por slot; arma por seita)
Colar do Lótus Violeta, Manto do Imperador Celeste, Coroa das Mil Névoas, Calça do Dragão Adormecido, Botas do Vento Sem
Rastro; armas: Espadas do Trovão Celestial (Tormenta), Leque da Geada Eterna (Geada), Bastão do Monte Inabalável (Titã),
Agulhas da Víbora Imperial (Víbora). Inglês em `src/data/en.json`.

## Aviso
- Aviso no centro, maior e com borda roxa ("Item Épico! <nome>"), som `boss_defeated`, linha roxa no feed (passa pelo
  filtro) e brilho de drop maior.

## Saves
- O item guarda `baseId`, `rarity: 'epico'`, `plus`, `durability`, `ilvl` (informativo) e, se trocados, os bônus.
  Saves antigos carregam idênticos. Um save com Épico aberto numa versão antiga vira Comum (sem conserto).
