# Balanceamento

> **Este documento é o registro do marco 5** (método e resultados daquela época). Vários números mudaram depois
> (XP dos monstros −22%, ouro pela metade, respawn de 30 s, Tormenta com roubo de vida, Geada com Stamina 10…).
> Os valores atuais estão nos JSON de `src/data/` e as decisões em `docs/decisoes-do-projeto.md`.
> A seção "Situação atual" logo abaixo traz a última medição.

## Módulo de balanceamento (`npm run balance`)

Um lugar só para aumentar ou diminuir, em porcentagem, qualquer número do jogo. Os valores originais continuam nos JSON
de `src/data/`; o módulo guarda só **multiplicadores** em `src/data/balance.json` (com histórico de cada mudança) e o
código (`src/core/balance.ts`) aplica por cima ao carregar o jogo. Com tudo em 0%, nada muda.

```bash
npm run balance                                # lista todas as chaves e o valor atual de cada uma
npm run balance -- xp.monstros +10%            # +10% sobre o valor atual (duas vezes +10% = +21%)
npm run balance -- dano.monstros.lobo -15%     # só para um monstro (ou skill, seita, poção, missão, nível)
npm run balance -- xp.niveis =120%             # define direto: 120% do original (também aceita =1.2)
npm run balance -- xp.monstros +10% ouro.monstros -5%   # várias de uma vez
npm run balance -- ver ouro.monstros           # mostra os números de agora, sem mudar nada
npm run balance -- zerar xp.monstros           # volta ao original (zerar tudo = volta tudo)
npm run balance -- ids skill                   # ids aceitos: monstro, skill, seita, pocao, missao, nivel
```

Cada mudança mostra os números antes → depois (ex.: `Lobo: nv 1 8 XP → 9 XP`). Depois, confira o ritmo com
`npm run sim:balance`.

| Grupo | Chaves |
|---|---|
| Combate | `dano.jogador`, `dano.monstros`, `dano.skills`, `vida.jogador`, `vida.monstros`, `roubo_vida`, `cura.pocoes` |
| Progressão | `xp.monstros`, `xp.missoes`, `xp.niveis` (XP **necessário**), `xp.skills` (+ = skills sobem mais rápido), `skills.bonus_por_nivel`, `skills.mana`, `skills.recarga` |
| Economia | `ouro.monstros`, `ouro.missoes`, `precos.pocoes`, `venda.itens`, `conserto.custo`, `desgaste.equipamento` |
| Drops | `drop.pocoes`, `drop.equipamento`, `drop.raros` (peso de Incomum e Raro) |
| Mundo | `respawn.monstros` (+ = demora mais), `offline.eficiencia` (máximo 100%), `offline.teto_ouro` (teto de ouro por volta do offline; 1 = 3 h de caça) |

Observações:

- Uma chave com id (`xp.monstros.lobo`) multiplica junto com a global (`xp.monstros`).
- Os textos de descrição das skills (ex.: "130% do dano") são escritos à mão em `skills.json`/`en.json` e **não** mudam
  sozinhos com `dano.skills`; mana, recarga, preços e cura das poções aparecem já corrigidos na interface.
- Alguns testes conferem números fechados (ex.: `check:respawn` espera 30 s de respawn). Se mudar uma dessas chaves de
  propósito, atualize o teste junto.
- `npm run check:balance` (faz parte do `npm test`) recusa chave ou id com erro de digitação no `balance.json` e confere
  que cada chave muda o que diz.

## Números atuais (v1, conferidos com `src/data/` em 18/11/2026)

Resumo para não ler os valores antigos do registro do marco 5 por engano. A fonte é sempre o JSON.

| Monstro | Níveis | XP por abate (`xpBase + xpPerLevel × (nível − 1)`) | Ouro | Respawn |
|---|---|---|---|---|
| Lobo | 1–3 | 8 + 5 | 2–5 | 30 s |
| Bandido Espadachim | 4–6 | 23 + 6 | 3–5 (+0,8 por nível) | 30 s |
| Bandido Arqueiro | 4–6 | 26 + 7 | 3–5 (+0,8 por nível) | 30 s |
| Guerreiro de Terracota | 7–9 | 55 + 9 | 5–8 (+1 por nível) | 30 s |
| General de Terracota | 10 | 600 | 260–340 | 600 s |
| Espectro de Gelo | 11–13 / 15–17 (por ponto) | 80 + 18 | 8–12 (+1,2 por nível) | 30 s |
| Yeti | 12–14 / 16–18 (por ponto) | 110 + 22 | 10–16 (+1,5 por nível) | 30 s |
| Discípulo Caído (só na luta do Abade) | 18 | 300 | 15–25 | — |
| Abade Caído | 20 | 20000 | 900–1200 | 900 s |

Curva de XP (`progression.json`): 250 / 455 / 850 / 1800 / 4000 / 6200 / 12000 / 15500 / 20000 (nível 1→2 até 9→10).
Desde o marco 9 o nível máximo é 20, com 27000 / 31500 / 37000 / 42500 / 49500 / 56000 / 64000 / 73000 / 83000 /
94000 do 10→11 ao 19→20 (calibrado na fase 9: ~2 h jogando ativo; `npm run sim:balance -- --m9`). Venda de itens: 15% do valor. O respawn conta mesmo fora do mapa.

## Situação atual (17/11/2026)

`npm run sim:balance -- --seeds=5` com os dados do marco 7 e o **simulador corrigido** (auditoria, etapa A2):
o relógio dos renascimentos agora acompanha o tempo simulado e a luta do chefe usa a semente desde o começo,
então **a mesma semente dá sempre o mesmo resultado**. Nenhuma regra do jogo mudou.

| Seita | Nível 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Mortes | Ouro/h | Ouro/h (nv 7+) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tormenta | 0.6 | 1.6 | 5.8 | 8.1 | 13.5 | 27.1 | 34.0 | 46.9 | 61.3 | 1.8 | 8801 | 14818 |
| Geada | 0.5 | 1.5 | 4.7 | 6.5 | 10.5 | 20.1 | 24.1 | 32.8 | 43.0 | 0.2 | 12130 | 20900 |

| Seita | Gasto em poções | Gasto em conserto | Conserto / ouro ganho |
|---|---|---|---|
| Tormenta | 4934 | 1606 | 16.6% |
| Geada | 3046 | 295 | 3.0% |

| Seita | Equipamento nv 5 | Vitórias | Tempo médio (s) | Poções usadas | Mortes |
|---|---|---|---|---|---|
| Tormenta | incomum | 10/10 | 61 | 14.7 | 0.0 |
| Tormenta | raro | 10/10 | 52 | 10.0 | 0.0 |
| Geada | incomum | 10/10 | 43 | 0.6 | 0.0 |
| Geada | raro | 10/10 | 40 | 0.1 | 0.0 |

**Por que os números mudaram em relação ao marco 7** (Tormenta ~65 → ~61 min, Geada ~47 → ~43 min; Tormenta vence o chefe
com Incomum 10/10 em vez de ~10/12): antes, o simulador usava o relógio real do computador para o renascimento de monstros
ao trocar de mapa. Como a simulação roda muito mais rápido que o tempo real, os monstros pareciam demorar muito mais para
voltar do que no jogo. Agora o simulador mede o que o jogador realmente vê. Na luta do chefe, os guerreiros das Ruínas
nasciam com sorteio não controlado. O ritmo continua dentro da meta de ~1 hora.

---

# Registro do marco 5

> Nomes antigos usados neste documento: Lâmina Errante = **Tormenta**, Pavilhão das Nuvens = **Geada**, Corte Duplo = Presas Gêmeas, Golpe Rompe-Guarda = Quebra-Guarda.

Meta: **cerca de 1 hora de jogo ativo** do nível 1 ao 10, caçando monstros do nível certo (auto-combate), com poucas mortes, ouro suficiente para poções e conserto custando ~10-15% do ouro ganho. Tudo é guiado por dados (`src/data/*.json`) e conferido por `npm run sim:balance`.

## Como medir

`tools/balance-sim.ts` roda o `World` real (core + `auto.ts`, sem Phaser) em passos de 1/30 s:

- Cada seita cria o personagem, liga o Auto e caça sozinha. O "jogador médio" simulado só decide o que o auto não decide: gasta pontos com **Distribuir recomendado**, veste upgrades (pontuação simples por atributo útil), conserta e vende sobras na vila, e vai às Ruínas ao chegar no nível 7.
- Mede minutos por nível, mortes, ouro ganho por hora, gasto em poções e conserto.
- Depois simula o chefe no nível 10 com equipamento nível 5 Incomum ou Raro em todos os slots, 18 poções e um jogador ativo: esquiva dos círculos (reação de 0,45 s), bebe poção com vida baixa; a Lâmina luta de perto, o Pavilhão recua dando a volta na arena.
- Flags: `--seeds=N`, `--max=min`, `--detail` (tabela por nível), `--deaths` (contexto de cada morte), `--trace --class=lamina` (linha do tempo do chefe).

## Curva de XP (`progression.json`)

Calibrada por iteração até as duas seitas fecharem perto de 1 hora (tempo por nível alvo: 2,5 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 min, média das seitas).

| Nível → próximo | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 |
|---|---|---|---|---|---|---|---|---|---|
| XP necessário | 250 | 455 | 850 | 1800 | 4000 | 6200 | 12000 | 15500 | 20000 |

XP por abate = `xpBase + xpPerLevel × (nível − 1)`: lobo 10+6, bandido espadachim 30+8, arqueiro 33+9, terracota 70+12, General 600. Os saltos na curva acompanham a troca de área (lobos → bandidos no nível ~4-5, bandidos → terracota no nível 7).

## Monstros

Atributos por nível = `base + perLevel × (nível − 1)`; HP = 50 + 10 × Vigor; defesa física = Vigor, espiritual = Vontade (depois do multiplicador `defMul`).

| Monstro | Nv | HP | Ataque | Def. fís. | Def. esp. | Intervalo | XP | Ouro |
|---|---|---|---|---|---|---|---|---|
| Lobo | 1 | 100 | 8 | 5 | 3 | 1,6 s | 10 | 4-9 |
| Lobo | 3 | 140 | 12 | 9 | 6 | 1,6 s | 22 | 4-9 |
| Bandido Espadachim | 4 | 140 | 8 | 9 | 6 | 1,6 s | 54 | 11-15 |
| Bandido Espadachim | 6 | 170 | 10 | 12 | 9 | 1,6 s | 70 | 14-18 |
| Bandido Arqueiro (alcance 6, recua se chegar a 3,5) | 4 | 110 | 8 | 6 | 4 | 2,2 s | 60 | 11-15 |
| Bandido Arqueiro | 6 | 130 | 10 | 8 | 6 | 2,2 s | 78 | 14-18 |
| Guerreiro de Terracota (def. fís. ×2,4, esp. ×0,7; vel. 2,4) | 7 | 260 | 22 | 50 | 4 | 2,2 s | 142 | 22-28 |
| Guerreiro de Terracota | 9 | 310 | 26 | 62 | 4 | 2,2 s | 166 | 26-32 |
| General de Terracota (def. fís. ×0,2, esp. ×1; vel. 1,8) | 10 | 2750 | 14 | 62 | 100 | 2,8 s | 600 | 260-340 |

Regra de projeto: um monstro do nível certo tira ~10-20% da vida do jogador por abate (o grupo de bandidos, ~60-70% se for enfrentado junto). A defesa de terracota é ×2,4 e ×0,7 (e não ×3 / ×0,5 do exemplo) para as seitas ficarem equilibradas; o dano espiritual causa ~1,45× o físico nelas.

Respawn: lobo 15 s, bandido 35 s, terracota 40 s, General 600 s. O respawn mais lento dos bandidos/terracota limita o ritmo do Pavilhão, que mata mais rápido que a Lâmina.

## Ouro, poções e conserto

- Ouro por abate (marco 7, reduzido à metade): lobo 2-5, bandido 3-5 (+0,8 por nível), terracota 5-8 (+1 por nível), General 260-340 (igual). Itens vendem por 15% do valor (antes 25%).
- Poções (preço da vila): vida P 12, G 36; mana P 14, G 40. Gasto com poções + conserto (simulador, marco 7): Tormenta ~75% do ouro ganho, Geada ~40%.
- Conserto: `durabilidade faltante × nível do item × 0,5`. A durabilidade agora também cai em combate: **cada golpe recebido gasta 0,3 ponto** de um item equipado aleatório (`wearPerHit` em `items.json`), além dos −10% por morte. Resultado: conserto = 12% (Lâmina) e 6% (Pavilhão) do ouro ganho; o Pavilhão apanha menos.
- Drops de nível 5+: monstros nível 5 ou mais soltam equipamento nível 5 (espadachim/arqueiro 8%, terracota 12%) e poções grandes (10% vida, 6% mana). Abaixo disso, equipamento nível 1 (5-6%).

## O General de Terracota

- 2750 HP, ataque corpo a corpo lento (2,8 s) e golpe em área: círculo de raio 2,5 no chão, 1,5 s de aviso, dano de 1,6× o ataque só se o jogador ainda estiver dentro no impacto (a cada 7 s; a cada 5 s abaixo de 50%).
- Aos 50% de HP invoca 2 Guerreiros de Terracota nível 7 (uma vez por combate).
- Leash: arena de raio 7; se o jogador sai, o General volta e cura tudo. Renasce 10 min depois (horário gravado no save).
- Drop: 1 Raro nível 5 de slot aleatório (arma só da seita do jogador) + 260-340 de ouro.
- Auto-combate ignora o General, os monstros dentro da arena e nunca cria caminho para dentro dela.

## Resultados da simulação

Média de 10 execuções por seita (`npm run sim:balance -- --seeds=10 --detail`). Minutos acumulados até cada nível.

| Seita | Nível 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Mortes | Ouro/h | Ouro/h (nv 7+) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Lâmina Errante | 2.6 | 5.9 | 10.6 | 15.9 | 25.0 | 37.1 | 45.9 | 56.1 | 68.7 | 3.3 | 12107 | 24243 |
| Pavilhão das Nuvens | 2.0 | 4.7 | 7.2 | 10.9 | 16.4 | 23.9 | 30.9 | 39.3 | 49.5 | 7.5 | 16673 | 29650 |

Mortes = total até ~5 min depois do nível 10. Ouro/h inclui venda de sobras; "nv 7+" é o ritmo nas Ruínas.

| Seita | Gasto em poções | Gasto em conserto | Conserto / ouro ganho |
|---|---|---|---|
| Lâmina Errante | 5403 | 1843 | 12.4% |
| Pavilhão das Nuvens | 3852 | 926 | 6.1% |

| Seita | Equipamento nv 5 | Vitórias | Tempo médio (s) | Poções usadas | Mortes | Vida restante do chefe se perdeu |
|---|---|---|---|---|---|---|
| Lâmina Errante | incomum | 8/20 | 59 | 15.8 | 0.6 | 22% |
| Lâmina Errante | raro | 15/20 | 51 | 11.8 | 0.3 | 17% |
| Pavilhão das Nuvens | incomum | 20/20 | 45 | 0.4 | 0.0 | - |
| Pavilhão das Nuvens | raro | 20/20 | 42 | 0.0 | 0.0 | - |

Leitura:

- **Lâmina: nível 10 em ~69 min; Pavilhão: ~50 min** (meta: 50-70). O Pavilhão é mais rápido porque ataca de longe e mata antes de apanhar; os respawns lentos e a defesa espiritual dos bandidos reduzem a diferença, mas não a eliminam (a razão fica em ~1,4).
- **Mortes:** ~3 (Lâmina) e ~7-8 (Pavilhão, menos vida) por jogo completo, concentradas nos níveis 3-6, quando o auto encara acampamentos de bandidos com equipamento inicial.
- **Chefe:** Lâmina com tudo Incomum vence 40% das vezes (~60 s, ~16 poções) e com tudo Raro 75% (~50 s, ~12 poções); o Pavilhão vence todas recuando e dando a volta na arena (quase sem poções). Quem fica parado no círculo vermelho perde ~30 de vida por golpe.

## Mudanças para chegar nesses números

- `AUTO_GRAY_GAP`: o auto prefere monstros com nível ≥ seu nível − 1 (os mais baixos só entram se não houver outros) e escolhe o alvo pelo caminho real, não pela linha reta.
- O auto desce à vila para **descansar** (sem poção de vida e abaixo de 35% de vida, até 90%, no máximo 50 s) e bebe poção mais cedo (+15 pontos) contra 2+ monstros.
- Skills da Lâmina: Corte Duplo 2×80%, Tempestade de Lâminas 170%, Golpe Rompe-Guarda 220% (antes 70% / 150% / 200%).
- Lobos: dano menor (força 3 +1/nível) e ouro 4-9.
