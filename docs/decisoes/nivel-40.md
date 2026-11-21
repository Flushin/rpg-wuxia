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
