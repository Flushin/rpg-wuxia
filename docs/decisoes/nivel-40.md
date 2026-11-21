# Nível máximo 40 (faixa 30–40)

Decidido com o Lucas em 21/11/2026. Etapas: 1 pesquisa e plano · 2 nível 40, curva, atributos e saves · 3 tier de itens
e forja · 4 mapas, monstros, chefe e missões · 5 simulação final e ajuste fino.

## Medição de referência (etapa 1)
`npm run sim:balance -- --m9 --seeds=3 --max=300` e `--m10 --seeds=3 --max=900` (o `--max` padrão, 120 min, corta a
faixa), jogo ativo:

| Seita | 10→20 | 20→30 | Razão | Só offline 20→30 |
|---|---|---|---|---|
| Tormenta | 116 min | 317 min | 2,73× | 10,7 h |
| Geada | 108 | 329 | 3,05× | 11,0 h |
| Titã | 149 | 548 | 3,68× | 18,8 h |
| Víbora | 122 | 320 | 2,62× | 10,8 h |

0 mortes no 20→30; ~11 idas à vila (todas para vender); ouro ~250 mil; conserto 18–61 mil. Pico da Névoa no nv 29:
~780 de XP por abate, ~8 abates/min. Senhor da Névoa no 30: 6/6 com Raro nv 25 (3–6/6 com Incomum).

## Decisões
- **Ritmo:** 30→40 custa **5× o tempo** do 20→30 **de cada seita**, margem **±20%** (4×–6×; média 4,5×–5,5×),
  medido só no jogo ativo ("já é meio de jogo, precisa começar a dificultar"). Meta ~26 h (Tormenta, Geada, Víbora) e
  ~46 h (Titã). Os monstros novos dão ~850–1.000 de XP por abate e morrem mais devagar (~6 abates/min).
- **Curva (provisória, etapa 2; final na etapa 5):** +18% por nível: 410k / 485k / 570k / 675k / 795k / 940k / 1,11M /
  1,31M / 1,545M / 1,82M (~9,66 milhões, 4,5× a XP do 20→30).
- **Atributos:** 4 pontos livres por nível do 31 ao 40 (o `freePointsHigh` do 21 já cobre; 137 no total no 40).
- **Saves:** versão 3 do personagem. Save v2 no nível 30 fica no **30 com XP 0** (0% da barra do 31).
- **Itens (etapa 3):** **um conjunto só, nv 35**, 9 peças, mesmos 6 espaços, arma uma por seita: arma **100**
  (~2,5× o nv 15), defesas e vida ~1,47× o nv 25. Do 30 ao 34 vale o nv 25. **Jade da Névoa** continua (2 por receita
  nv 35); ouro da forja ×8; +10 continua o máximo; Mercador vende o nv 35 a partir do nível 35.
- **Mapas (etapa 4):** pelo **portão leste da Cidadela de Jade**, a pé: **Vale das Cinzas Rubras** (nv 30–35, rocha
  vulcânica) e, ao fundo dele, **Ruínas do Palácio Celeste** (nv 35–40, terraços de mármore nas nuvens). O Mestre dos
  Caminhos leva aos dois. Offline **5/6** nos dois.
- **Cidade de apoio:** nos dois mapas novos, **morte, Pergaminho de Retorno e idas do Auto levam à Cidadela**.
- **Monstros (comportamentos existentes, nenhum recua):** Vale: **Andarilho das Cinzas** (corpo a corpo, golpes
  rápidos, defesa física moderada) e **Monge do Fogo Rubro** (projétil de fogo). Palácio: **Guarda Celeste** (tanque,
  golpe em área, defesa física ×0,6 por causa da Titã) e **Feiticeira da Lua Fria** (projétil de qi com lentidão).
  Todos com defesa espiritual alta (Geada) e resistência a veneno.
- **Chefe:** **Imperador Carmesim** nv 40 no Palácio (área, linha que vira leque, chama 2 Guardas Celestes a 50%,
  fúria a 30%; garante Raro nv 35; entra no Trial). **Missões:** 5 (31, 33, 35, 37, 39) com NPCs da Cidadela
  (Governador Bai, Monge do Pagode, Guardas de Jade), ~14% da XP da faixa. Sem NPC novo.
- **Trial:** níveis **11–20** (chefes 31–40), custo e XP pelas fórmulas atuais; bases nv 25 nos níveis 11–14 e nv 35
  nos 15–20. Masmorras sem mudança.
- **Skills:** nível máximo continua 15.
- **Economia:** sem regra nova; ajustar na etapa 5 se o conserto passar de ~30% do ouro ganho em alguma seita.
- **Arte:** sprites e tiles novos no Blender (KayKit, como no 20–30).
- **Feito na etapa 2:** `levelCap` 40 e a curva acima em `progression.json`; migração 2 → 3 em `saveFormat.ts`
  (teste em `check:m5`); tooltip da barra de skills mostrava "/10" fixo (corrigido para `SKILL_MAX_LEVEL`).
- **Feito na etapa 3:** bases nv 35 `colar_sol_carmesim`, `tunica_palacio`, `espadas_asa_fenix`, `leque_aurora`
  (Leque de Qi da Aurora Carmesim), `bastao_pilar_celeste`, `agulhas_escarlates`, `coroa_celeste`, `calca_nuvens_rubras`,
  `botas_degrau_imperial` (Botas do Degrau Imperial); os nomes Lua Fria e Passo Celeste já existiam (nv 10/15) e foram
  trocados pelo Lucas. Valor ~1,47× o nv 25 (arma 2.000). `RARE_DOUBLE_FROM_LEVEL` = 35 em `forge.ts`: material raro em
  dobro em toda receita e no desmonte (wiki em `mechanics.ts`). Ouro ×8 sai da fórmula 1 + nível/5. Mercador e Épico
  passam ao nv 35 no nível 35 sem código novo. Ícones em `tools/sprites/icons.py`. Teste: `npm run check:m11`. Drops
  nos monstros e no Trial entram na etapa 4.
- **Feito na etapa 4a (conteúdo):** mapas `vale` e `palacio` (`tools/gen-maps.mjs`; tiles novos no fim da lista:
  `ash`, `basalt`, `lava`, `marble`, `cloud`; pisos em `ground_tiles.py`; objetos do Vale em `tools/sprites/vale.json`,
  atlas `props-vale`). Portal no portão leste da Cidadela (minLevel 30) e saída noroeste do Vale (minLevel 35), longe
  das clareiras. `MAPS_CONFIG`: `autoFromLevel` 30/35, `offlineMul` 5/6, `homeTown: 'cidadela'` (morte e Pergaminho de
  Retorno; `homeTownOf` em `mapsConfig.ts`), `pillarGround` (mármore sob as colunas do Palácio). Teleporte: região
  "Além da Cidadela" (30/35). Monstros `andarilho_cinzas`, `monge_fogo_rubro` (projétil novo `fire`, só visual),
  `guarda_celeste` (golpe em área, defesa física ×0,6) e `feiticeira_lua_fria` (projétil `ice`, lentidão); nenhum recua;
  sprites KayKit recoloridos (Rogue, Mage, Knight, Mage com chapéu). No nível 30 o Auto vai ao Vale (antes: Pico).
  Simulador: `--m11` (30→40; troca para o conjunto nv 35 Incomum no 35; `--ref` mede o 20→30), e o jogador simulado
  conserta e vende também na Cidadela. Teste: `npm run check:m11`.
- **Primeira medição da 4a** (`--m11 --seeds=1`, ainda sem as missões 31–40): Tormenta 2.018 min (6,4×), Geada 2.090
  (6,4×), Víbora 2.191 (6,8×), Titã parou no 38 aos 3.438 min (465 idas à cidade por mana). Conserto 15–64% do ouro
  ganho (~1,3 milhão). Ajuste fino na etapa 5.
- **Feito na etapa 4b:** chefe `imperador_carmesim` (nv 40, dano físico, vida ~2× o Senhor da Névoa; golpe em área,
  golpe em linha que vira leque de 3 a 50%, chama 2 Guardas Celestes nv 37 a 50%, fúria a 30%; garante Raro nv 35;
  150 mil de XP, 6–8 mil de ouro, 8–12 jades) no Salão do Trono (16,6); sprite Mage com cajado em carmesim e dourado.
  Missões (`quests.json`, ~15% da XP da faixa): O portão do leste (31, Governador, chegar ao Vale), Os que andam nas
  cinzas (33, Guarda de Jade, 15 andarilhos), O fogo rubro (35, Monge do Pagode, 15 monges; arma nv 35), A lua fria
  (37, Monge, 15 feiticeiras) e O Imperador Carmesim (39, Governador; túnica nv 35): 1,35 milhão de XP. Falas do
  Governador e do Guarda atualizadas (portão leste aberto). Trial: `TRIAL_TIERS` 20, `trialEquipReqLevel` nv 25 nos
  níveis 6–14 e nv 35 nos 15–20; custo e XP pelas fórmulas (4.800 de ouro e 28 mil de XP no 20). Simulador:
  `--imperador` (nível 38/40, conjunto nv 35) e, no `--m11`, a cadeia começa na primeira missão do 31.
- **Imperador (4b, `--imperador`):** 6/6 vitórias para todas as seitas, com Incomum e Raro, nos níveis 38 e 40
  (70–140 s; Titã 235–355 s). Fácil demais: ajustar na etapa 5.
- **Medição ao fim da 4b** (`--m11 --seeds=1`, com as missões): Tormenta 1.835 min (5,8×), Geada 2.367 (7,2×; 1.233
  idas à cidade por vida no Palácio), Víbora 2.125 (6,6×), Titã parou no 38 (1.196 idas por mana). Conserto: Titã
  86% do ouro, Tormenta 35%. Tudo isso fica para o ajuste fino da etapa 5.
- **Etapa 5 (ajuste fino, 21/11/2026):** a Titã quebrava o equipamento e ficava sem ouro para o conserto (86% do ouro);
  decidido pelo Lucas: **itens nv 35+ gastam metade da durabilidade por golpe** (`LOW_WEAR_FROM_LEVEL`/`LOW_WEAR_MUL` em
  `world/inventory.ts`; o Épico conta pela faixa do nível). Monstros novos: vida −12% (Vale) e −15% (Palácio), depois
  defesa física ×0,8 com vida +10% (Guarda ×0,5; Feiticeira ×0,55: a defesa física alta deixava a Titã com 40% do
  ritmo de abate da Tormenta, contra 58% no Pico, porque o dano elemental passa por fora da defesa); Guarda e Andarilho
  batem um pouco mais fraco e a Feiticeira ~12% mais fraco (Geada); poção de vida grande 40% (Vale) e 45% (Palácio) e de
  mana grande 90% (os laços de ida à cidade da Geada e da Titã: o Auto compra 10 poções pequenas). Testadas e não
  adotadas: XP por abate +7% (média 4,6×, perto do piso) e mais vida na Feiticeira (prendia a Geada no Palácio).
  Imperador Carmesim com força 80 (era 48). Simulador: `abates/min` na linha de resumo; o jogador simulado sobe ao
  Palácio no 35.
- **Resultado final** (`npm run sim:balance -- --m11 --seeds=3`, referência `--m10 --seeds=3` no mesmo código):

  | Seita | 20→30 | 30→40 | Razão | Só offline 20→30 / 30→40 (estimativa) |
  |---|---|---|---|---|
  | Tormenta | 317 min | 1.437 min | 4,53× | 10,7 h / 48,4 h (4,5×) |
  | Geada | 329 min | 1.692 min | 5,14× | 11,0 h / 57,5 h (5,2×) |
  | Titã | 548 min | 3.168 min | 5,78× | 18,8 h / 105,5 h (5,6×) |
  | Víbora | 320 min | 1.457 min | 4,55× | 10,8 h / 49,5 h (4,6×) |

  Média 5,0× (margem 4×–6× por seita: ok). Mortes 0–1 na faixa. Ouro ganho ~1,3 milhão; conserto: Titã 30%,
  Tormenta 14%, Geada 9%, Víbora 7%. ~40 idas à cidade (quase todas para vender). Imperador (`--imperador`): com Raro
  nv 35, 6/6 para todas nos níveis 38 e 40; com Incomum, Geada 4–5/6 e as outras 6/6 (Titã leva ~350 s e ~21 poções).
- **Mapa-múndi (21/11/2026, decidido pelo Lucas):** para manter 4 colunas (cartões legíveis no celular), a Cidadela de
  Jade desce para baixo da Floresta Sombria (col 2, linha 3), o Vale fica à direita dela (col 3, linha 3) e o Palácio
  abaixo do Vale (col 3, linha 4). Minimapa com as cores dos tiles novos (e do bambu, que faltava); a legenda do ✦
  cita o Mestre dos Caminhos da vila e da Cidadela.
