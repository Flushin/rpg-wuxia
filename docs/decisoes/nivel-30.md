# Nível máximo 30 (faixa 20–30)

Decidido com o Lucas em 19/11/2026. Etapas: 1 pesquisa e plano · 2 nível 30, curva, atributos e saves · 3 tier de itens
e forja · 4 mapas, monstros, chefe e missões · 5 simulação final e ajuste fino.

## Medição de referência (etapa 1)
Simulador `npm run sim:balance -- --m9 --seeds=3` (nível 10 com Incomum nv 5, Auto e missões), 10→20:
Tormenta ~111 min, Geada ~102, Titã ~165, Víbora ~128 (média ~126). XP 10→20 = 558,5 mil (missões ~136 mil).

## Decisões
- **Ritmo:** 20→30 custa **~3× o tempo** do 10→20 **de cada seita**, margem **±20%** (2,4×–3,6×; média das quatro
  2,7×–3,3×), medido **só no jogo ativo**. Monstros escalam com o tier novo de itens: o abate leva ~o mesmo tempo da
  montanha; o "mais forte" é dano recebido e quantidade de monstros, não abates 3× mais longos.
- **Curva (final, etapa 5):** 114,5k / 129,5k / 147k / 166,5k / 188k / 213k / 241k / 272k / 308k / 348k (~2,13 milhões;
  a provisória da etapa 2 era 8% menor). Missões 21–30: 300 mil (~14%).
- **Atributos:** do 21 ao 30, **4 pontos livres** por nível (`freePointsHigh` em `progression.json`) + os automáticos da seita.
- **Saves:** versão 2 do personagem. Save v1 no nível 20 (o antigo máximo) fica no **20 com XP 0** (0% da barra do 21).
- **Mapas (etapa 4), acesso por um passo no alto da Montanha Nevada:** Bosque de Bambu Sombrio (nv 20–25, liberado no
  20: Assassino das Sombras, Serpente de Jade) e Pico da Névoa (nv 25–30, liberado no 25: Grou Espiritual, Guardião de
  Jade). Chefe nv 30 **Senhor da Névoa** (entra sozinho no Trial). Sprites novos para os cinco.
- **Missões:** 4–5 novas do 21 ao 30 com os NPCs existentes (~15% da XP da faixa). Sem NPC novo.
- **Itens (etapa 3):** conjuntos **nv 20** (arma 54) e **nv 25** (arma 68), 9 peças cada; material raro novo **Jade da
  Névoa** (substitui o Cristal de Gelo na forja de itens nv 20+; o Mercador vende).
- **Offline nos mapas novos:** **50% / 33% / 17%** (5/6 da regra atual); o offline 20→30 fica ~3,6×, fora do critério.
- **Trial:** níveis 1–5 soltam bases nv 20 e 6–10 nv 25; XP do Trial fica como está. **Masmorras:** sem mudança.
- **Feito na etapa 3:** bases nv 20 (`colar_bambu`, `veste_bambu`, `espadas_folha_bambu`, `leque_bambu_negro`,
  `bastao_raiz_bambu`, `agulhas_espinho`, `chapeu_bambu`, `calca_cacador`, `botas_sombra`; ~1,35× o nv 15) e nv 25
  (`colar_nevoa`, `manto_nevoa`, `espadas_rasga_nevoa`, `leque_grou`, `bastao_pico`, `agulhas_jade_celeste`, `coroa_jade`,
  `calca_nuvens`, `botas_nebulosas`; ~1,7×). `jade_nevoa` (raro, valor 200, Mercador 750) substitui o cristal em todas
  as receitas de itens nv 20+ (`JADE_FROM_LEVEL` em `forge.ts`), inclusive desmontar. Ouro da forja: ×5 (nv 20), ×6 (nv 25).
  Trial: `trialEquipReqLevel` (nv 20 nos níveis 1–5, nv 25 nos 6–10). Mercador: estoque nv 20 a partir do nível 20 e nv 25
  a partir do 25. Drops de jade e do tier novo pelos monstros entram na etapa 4.
- **Etapa 4 (conteúdo):** mapas `bambu` e `pico` (`tools/gen-maps.mjs`; tile novo `bamboo` no fim da lista), portal
  no passo leste da montanha (minLevel 20) e na saída norte do Bosque (minLevel 25); `MAPS_CONFIG`: `autoFromLevel`
  20/25, `autoExitVia` e `offlineMul` 5/6. Monstros `assassino_sombras`, `serpente_jade` (projétil `poison`, lentidão),
  `grou_espiritual` (projétil `qi`), `guardiao_jade` (golpe em área) e o chefe `senhor_nevoa` (nv 30: área, chama 2 grous
  com metade da vida, fúria a 30%; garante Raro nv 25). Serpente e Grou são humanos de seita (os pacotes 3D não têm cobra
  nem ave; decidido pelo Lucas). Sprites: `tools/sprites/<id>.json`; moitas de bambu: `tools/sprites/render_bambu.py`.
  Missões: O passo do leste (20), Sombras entre o bambu (21), O veneno de jade (23, arma nv 20), Penas de grou (26) e
  O Senhor da Névoa (28, tronco nv 25): 300 mil de XP. Teste: `npm run check:m10`. Simulador: `--m10` (`--only=<seita>`).
- **Ajuste da etapa 4 (simulador `--m10`, 1 execução por seita):** vida dos monstros novos ×1,8 e XP ×0,8 sobre o
  rascunho; assassino mais lento (golpe a cada 1,9 s) e guardião com menos força; defesa espiritual alta em todos
  (a Geada não atravessa tudo); poção de vida grande 30% e de mana grande 40% (as idas à vila eram quase todas por falta
  de mana, e a vila fica a 2–3 mapas). 20→30 / 10→20: Tormenta ~3,5×, Geada ~2,9×, Titã ~3,7×, Víbora ~2,25× (média
  ~3,1×). Senhor da Névoa no nível 30, equipamento nv 25 Incomum/Raro: 4–5 vitórias em 5 para todas as seitas.
  Titã e Víbora ficam para o ajuste fino da etapa 5.
- **Etapa 5 (ajuste fino, 19/11/2026):** inimigos da faixa resistem a veneno (`poisonRes`: assassino 40%, serpente 60%,
  grou 30%, guardião 50%; reduz o veneno das skills e o dano elemental de veneno; decidido pelo Lucas para a Víbora).
  Serpente e Grou sem recuo (`keepDistance`): quem luta de perto passava a luta correndo atrás deles. Guardião com defesa
  física ×0,6 (a Titã travava no Pico). Poção de mana grande 75% nos monstros novos (as idas à vila eram por mana). Passo
  da montanha para o Bosque mudado para o sudeste (junto da entrada) e trilha do Pico junto da entrada do Bosque: quem
  atravessava era puxado para lutas no caminho. XP por abate dos monstros novos −10%.
- **Resultado final** (`npm run sim:balance -- --m10 --seeds=3`, referência `--m9 --seeds=3` no mesmo código):

  | Seita | 10→20 | 20→30 | Razão | Só offline 10→20 / 20→30 (estimativa) |
  |---|---|---|---|---|
  | Tormenta | 117 min | 331 min | 2,83× | 3,2 h / 11,0 h (3,4×) |
  | Geada | 105 min | 327 min | 3,12× | 3,1 h / 10,9 h (3,5×) |
  | Titã | 168 min | 577 min | 3,43× | 4,3 h / 19,6 h (4,6×) |
  | Víbora | 116 min | 317 min | 2,73× | 3,1 h / 10,7 h (3,5×) |

  Média 3,03× (margem ±20% por seita: ok). Mortes 0–0,3 no trecho. Ouro ganho ~250 mil (10→20: ~49 mil); conserto
  20–125 mil (a Titã gasta metade do que ganha). Offline acima de 3× por causa da taxa 5/6 nos mapas novos (decidido).
  Senhor da Névoa (`--senhor`): no nível 30, 4–5 vitórias em 5 para todas as seitas com equipamento nv 25.
- **Economia (revisão, 19/11/2026):** no 20→30 todas as seitas ganham ~250 mil de ouro; o conserto levava 8–18% (Víbora,
  Geada, Tormenta) e **50%** da Titã (21% no 10→20), porque todo golpe recebido gastava durabilidade, mesmo absorvido.
  Decidido pelo Lucas (opção A): **golpe todo absorvido por escudo não desgasta** (vale em todos os níveis e no chefe).
  Simulador (2 execuções): Titã 125 mil → ~70 mil (28%); Tormenta igual (~44 mil); tempos de 20→30 iguais.
  Testadas e não adotadas: desgaste proporcional ao dano (Titã ~8%, mas muda a economia do 1 ao 30) e teto do custo de
  conserto no nível 20 do item.
- Fora do escopo: skills ou níveis de skill novos, masmorras/fases do Trial novas, mudar a progressão 1–20.
