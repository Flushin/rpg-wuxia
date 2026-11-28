# Registro de assets e licenças

Origem e licença de **tudo o que vai para o jogo** e não é código escrito no projeto: imagens, sons, músicas, fontes,
modelos 3D e bibliotecas. As provas (licenças baixadas, prints das páginas) ficam em [`docs/licencas/`](docs/licencas/README.md).
A análise completa está em [`docs/arquivo/AUDITORIA_DIREITOS.md`](docs/arquivo/AUDITORIA_DIREITOS.md).

## Regras

1. **Nenhum asset entra no repositório sem uma linha aqui** e sem a prova da licença em `docs/licencas/`.
2. **Licenças aceitas:** CC0 / domínio público; CC BY (com o crédito pedido); SIL OFL (fontes); MIT, Apache-2.0, BSD, ISC
   (código); licença comercial comprada (guardar o recibo em `docs/licencas/`).
3. **Proibidas:** CC BY-NC (não comercial), CC BY-ND (sem modificação), GPL/AGPL no código do app, "free for personal
   use", licença desconhecida, "achei na internet". CC BY-SA em arte só com análise caso a caso. **Créditos não
   substituem uma licença.**
4. **Baixar da fonte oficial** (site do autor ou repositório oficial). Se usar um espelho, anotar e conferir com o oficial.
5. **Anotar o nome do arquivo original** quando o arquivo do jogo for renomeado (ex.: `ui_click` = `click1`).
6. **IA generativa:** anotar a ferramenta, o plano e os termos vigentes e a data. Até 17/11/2026 nenhum asset usou IA generativa.
7. Ao adicionar um asset de terceiros, atualizar também o crédito visível: `public/audio/CREDITS.txt`,
   `public/sprites/CREDITS.txt` e a tela "Créditos e licenças" do jogo (`src/ui/credits.ts`: listas `ART`, `SOUND` e
   `LIBRARIES`).

**Risco:** 🟢 ok · 🟡 exige ação · 🔴 não pode ir para a loja · ❓ origem desconhecida (proibido até ter prova).

## Como adicionar uma linha

Copie a linha-modelo para a tabela do tipo certo e preencha todas as colunas:

```
| arquivo(s) no projeto | tipo | título / arquivo original | autor | link oficial | licença | crédito exigido? | modificação | prova em docs/licencas/ | adicionado em (AAAA-MM-DD) | por | risco |
```

---

## Pacotes de origem (terceiros)

| Pacote | Autor | Link oficial | Licença | Crédito exigido? | Como foi baixado | Prova em `docs/licencas/` | Risco |
|---|---|---|---|---|---|---|---|
| KayKit Adventurers Character Pack 1.0 | Kay Lousberg | https://kaylousberg.com · https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 | Não (cortesia) | `tools/sprites/fetch-assets.sh`, do repositório oficial | `kaykit-adventurers-1.0-LICENSE.txt` | 🟢 |
| Ultimate Animated Animal Pack | Quaternius | https://quaternius.com/packs/ultimateanimatedanimals.html | CC0 1.0 | Não (cortesia) | `fetch-assets.sh`, do **espelho não oficial** `trebeljahr/quaternius-showcase` (cópia de dez/2022), fixado por commit e conferido por SHA-256 (`tools/sprites/models.sha256`); para provar que é igual ao oficial, rodar com `QUATERNIUS_ANIMALS_DIR` | `quaternius-espelho-trebeljahr-LICENSES.md` · **falta:** print da página oficial | 🟡 |
| Animal Pack Vol.2 ("Animated Animales Low Poly") | Quaternius | https://opengameart.org/content/animated-animales-low-poly | CC0 1.0 | Não (cortesia) | `fetch-assets.sh`, do .zip publicado pelo autor no OpenGameArt; só `Cat.fbx`, conferido por SHA-256 (`tools/sprites/models.sha256`) | `quaternius-animal-pack-vol2-oga.txt` | 🟢 |
| Nature Kit | Kenney | https://kenney.nl/assets/nature-kit | CC0 1.0 | Não (cortesia) | `fetch-assets.sh`, do **espelho não oficial** `shorepine/kenney`, fixado por commit e conferido por SHA-256 (`tools/sprites/models.sha256`); para provar que é igual ao oficial, rodar com `KENNEY_NATURE_DIR` | **falta:** `kenney-nature-kit-License.txt` | 🟡 |
| UI Audio ("UI SFX Set") | Kenney (Kenney Vleugels) | https://kenney.nl/assets/ui-audio | CC0 1.0 | Não (cortesia) | Original não registrado; os 3 sons foram identificados em 17/11/2026 comparando o áudio com `github.com/Calinou/kenney-ui-audio` (commit `8c3d81b`) | `kenney-ui-audio-LICENSE.txt` | 🟢 |
| RPG Audio | Kenney | https://kenney.nl/assets/rpg-audio | CC0 1.0 | Não (cortesia) | Não registrado; os títulos gravados nos arquivos batem com o pacote | **falta:** `kenney-rpg-audio-License.txt` | 🟡 |
| Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds | CC0 1.0 | Não (cortesia) | Não registrado; os arquivos têm `ARTIST=Kenney` | **falta:** `kenney-impact-sounds-License.txt` | 🟡 |
| "Oriental" (música) | Shadowfire452 | https://opengameart.org/node/15485 | CC0 1.0 | Não (cortesia) | Baixado da página do OpenGameArt (confirmado pelo Lucas; o original está guardado) | **falta:** print/PDF + link do Wayback; original | 🟢 |
| "Asian/Oriental 1" (música) | Tozan | https://opengameart.org/content/asianoriental1 | CC0 1.0 | Não (cortesia) | idem | **falta:** print/PDF + link do Wayback; original | 🟢 |

Texto completo da CC0: `docs/licencas/CC0-1.0.txt`.

## Imagens

Os sprites são renderizados no Blender pelos scripts de `tools/sprites/` (mesma câmera e luz). A coluna "modelo" diz qual
arquivo de pacote foi usado; a configuração de cada folha fica em `tools/sprites/<nome>.json`.

| Arquivo(s) no projeto | Tipo | Modelo / arquivo original | Pacote | Licença | Modificação | Adicionado em | Por | Risco |
|---|---|---|---|---|---|---|---|---|
| `public/sprites/tormenta.*`, `tormenta_retrato.png` | Personagem jogável | `Rogue.glb` | KayKit Adventurers | CC0 | Recolorido (cabelo, túnica, capa, cinto) e renderizado | 2026-11-15 | Lucas/Claude | 🟢 |
| `public/sprites/geada.*`, `geada_retrato.png` | Personagem jogável | `Mage.glb` | KayKit Adventurers | CC0 | Recolorido, sem chapéu/cajado/livro; leque de qi gerado por script | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/bandido_espadachim.*` | Monstro | `Knight.glb` | KayKit Adventurers | CC0 | Sem elmo/escudo, recolorido; lenço gerado por script | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/bandido_arqueiro.*` | Monstro | `Rogue.glb` (com besta) | KayKit Adventurers | CC0 | Recolorido; lenço e chapéu de palha gerados por script | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/terracota.*` | Monstro | `Knight.glb` | KayKit Adventurers | CC0 | Recolorido em barro alaranjado | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/general.*` | Chefe | `Knight.glb` | KayKit Adventurers | CC0 | Recolorido com detalhes dourados, elmo e capa; 1,5× | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/lobo.*` | Monstro | `Wolf.glb` | Quaternius Ultimate Animated Animals | CC0 | Renderizado | 2026-11-15 | Lucas/Claude | 🟡 (prova oficial) |
| `public/sprites/cavalo.*` | Montaria | `Horse.glb` | Quaternius Ultimate Animated Animals | CC0 | Renderizado | 2026-11-22 | Lucas/Claude | 🟡 (prova oficial) |
| `public/sprites/tigre_de_jade.*` | Montaria (Fundador) | `Cat.fbx` + enfeites por script (`tools/sprites/mounts/`) | Quaternius Animal Pack Vol.2 | CC0 | Aumentado, recolorido e renderizado | 2026-11-28 | Lucas/Claude | 🟢 |
| `public/sprites/qilin_jovem.*` | Montaria (Fundador) | `Stag.glb` + enfeites por script (`tools/sprites/mounts/`) | Quaternius Ultimate Animated Animals | CC0 | Recolorido e renderizado | 2026-11-28 | Lucas/Claude | 🟡 (prova oficial) |
| `public/sprites/grou_celestial.*` | Montaria (Fundador) | Modelo e animação feitos por script (`tools/sprites/mounts/grou_celestial.py`) | Original do projeto | Próprio | Renderizado | 2026-11-28 | Lucas/Claude | 🟢 |
| `public/sprites/npc_mestre_tormenta.*` (+ retrato), `npc_morador1.*` | NPC | `Rogue.glb` | KayKit Adventurers | CC0 | Recolorido | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/npc_mestra_geada.*` (+ retrato), `npc_anciao.*`, `npc_vendedor.*`, `npc_morador2.*`, `npc_morador4.*` | NPC | `Mage.glb` | KayKit Adventurers | CC0 | Recolorido | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/npc_mestre_tita.*` (+ retrato), `npc_ferreiro.*`, `npc_morador3.*` | NPC | `Barbarian.glb` | KayKit Adventurers | CC0 | Recolorido | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/npc_mestra_vibora.*` (+ retrato), `npc_mercador.*` | NPC | `Rogue_Hooded.glb` | KayKit Adventurers | CC0 | Recolorido | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/npc_guarda.*` | NPC | `Knight.glb` | KayKit Adventurers | CC0 | Recolorido (armadura vermelha) | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/npc_ferreira_lin.*`, `npc_guarda_jade.*` (Knight), `npc_boticario_wen.*`, `npc_governador.*` (Mage), `npc_mercadora_jin.*` (Rogue_Hooded), `npc_monge_pagode.*` (Barbarian) | NPC (Cidadela) | KayKit `.glb` indicados | KayKit Adventurers | CC0 | Recoloridos (jade, dourado, açafrão) | 2026-11-21 | Lucas/Claude | 🟢 |
| `public/sprites/floresta.*` | Cenário | `tree_oak`, `tree_default`, `tree_fat`, `tree_pineRoundA`, `rock_largeA`, `rock_smallA`, `plant_bush`, `plant_bushLarge`, `grass`, `grass_large`, `flower_redA`, `flower_yellowA`, `mushroom_red`, `stump_round`, `log` (.glb) | Kenney Nature Kit | CC0 | Cores trocadas para a paleta da floresta | 2026-11-15 | Lucas/Claude | 🟡 (prova oficial) |
| `public/sprites/cidade.*` | Cenário | Cerejeiras/carvalhos: árvores do Nature Kit · casas, portão, lanternas, estandartes, incensário, poço, carroça: **geometria própria** (`render_town.py`) | Kenney Nature Kit + próprio | CC0 + próprio | Folhas recoloridas em rosa | 2026-11-16 | Lucas/Claude | 🟡 (prova do Nature Kit) |
| `public/sprites/fx/title-wing-*.svg` | Efeito (asas dos títulos de Fundador: branca, celeste, noite) | **desenho próprio** (`tools/title-wing-svg.mjs`, de `previews/asas-titulo.html`) | próprio | próprio | — | 2026-11-28 | Lucas/Claude | 🟢 |
| `public/sprites/cidadela.*` | Cenário | Casas, salão, pagode, muralha, torres, portões, colunas (huabiao), lanternas duplas: **geometria própria** (`render_cidadela.py`) | Próprio | Próprio | — | 2026-11-21 | Lucas/Claude | 🟢 |
| `public/sprites/ruinas.*` | Cenário | Geometria própria (`render_ruins.py`) | — | Própria | — | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/sprites/pisos.png` | Pisos e água | Desenho por código (`ground_tiles.py`) | — | Própria | — | 2026-11-15 | Lucas/Claude | 🟢 |
| `public/sprites/icones.png` | Ícones de itens e skills | Desenho por código (`icons.py`) | — | Própria | — | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/icons/*.png` | Ícone do app (PWA) | Desenho por código (`tools/icons/make_app_icons.py`) | — | Própria | — | 2026-11-16 | Lucas/Claude | 🟢 |
| `public/maps/tiles.png` | Tileset do formato Tiled | Gerado por `tools/gen-maps.mjs` | — | Própria | — | 2026-11-15 | Lucas/Claude | 🟢 |
| Imagens da loja (prints, ícone 512, banner 1024×500) | Loja | **ainda não existem** — fazer a partir do jogo | — | Própria | — | — | — | 🟡 |

## Áudio

| Arquivo(s) no projeto (`.ogg` + `.mp3`) | Tipo | Arquivo original | Pacote / autor | Licença | Modificação | Adicionado em | Por | Risco |
|---|---|---|---|---|---|---|---|---|
| `public/audio/sfx/ui_click.*` | Efeito (UI) | `click1` | Kenney UI Audio | CC0 | Convertido para ogg/mp3 | 2026-11-15 | Lucas/Claude | 🟢 |
| `public/audio/sfx/point_spent.*` | Efeito (UI) | `click3` | Kenney UI Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟢 |
| `public/audio/sfx/tip.*` | Efeito (UI) | `rollover3` | Kenney UI Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟢 |
| `public/audio/sfx/miss.*` | Efeito | `clothBelt` | Kenney RPG Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟡 (licença do pacote) |
| `public/audio/sfx/portal.*` | Efeito | `door4` | Kenney RPG Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟡 (licença do pacote) |
| `public/audio/sfx/ui_open.*` | Efeito (UI) | `bookOpen` | Kenney RPG Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟡 (licença do pacote) |
| `public/audio/sfx/ui_close.*` | Efeito (UI) | `bookClose` | Kenney RPG Audio | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟡 (licença do pacote) |
| `public/audio/sfx/hit.*`, `crit.*`, `level_up.*`, `spell.*`, `monster_attack.*`, `monster_death.*`, `player_death.*` | Efeitos | **não registrado** (os arquivos têm `ARTIST=Kenney`) | Kenney (Impact Sounds ou RPG Audio) | CC0 | idem | 2026-11-15 | Lucas/Claude | 🟡 (descobrir o arquivo original e guardar a licença do pacote) |
| `public/audio/music/cidade.*` | Música (loop, 22,5 s) | "Oriental" | Shadowfire452 (OpenGameArt) | CC0 | Convertido e cortado para loop | 2026-11-15 | Lucas/Claude | 🟢 (falta arquivar a página) |
| `public/audio/music/floresta.*` | Música (1 min 43 s) | "Asian/Oriental 1" | Tozan (OpenGameArt) | CC0 | Convertido | 2026-11-15 | Lucas/Claude | 🟢 (falta arquivar a página) |
| `public/audio/music/porto.*` | Música (1 min 9 s) | "Samurai Nights" | Majadroid / Maik Hoffmann (OpenGameArt) | **CC-BY 4.0** | Convertido, -20 LUFS; crédito na tela de créditos e em `public/audio/CREDITS.txt` | 2026-11-22 | Lucas/Claude | 🟢 (atribuição obrigatória feita) |

## Fontes

| Fonte | Onde | Licença | Risco |
|---|---|---|---|
| Fonte do sistema (`system-ui, sans-serif`) | `index.html` | Não é distribuída pelo jogo | 🟢 |

Se um dia entrar uma fonte própria: baixar o arquivo (ex.: do Google Fonts), colocar no projeto, guardar o `OFL.txt` em
`docs/licencas/` e mostrar o aviso na tela de créditos. Não carregar fonte de CDN.

## Bibliotecas que vão para o app

As dependências só de desenvolvimento (Vite, TypeScript, esbuild, Prettier) **não** vão para o app e não entram aqui.

| Biblioteca | Versão | Licença | Titular | Exigência | Prova em `docs/licencas/` | Risco |
|---|---|---|---|---|---|---|
| Phaser | 3.90.0 | MIT | © 2024 Richard Davey, Phaser Studio Inc. | Aviso + licença em toda cópia distribuída | `phaser-3.90.0-LICENSE.md` | 🟢 (na tela de créditos) |
| eventemitter3 | 5.0.4 | MIT | © 2014 Arnout Kazemier | idem | `eventemitter3-5.0.4-LICENSE.txt` | 🟢 (na tela de créditos) |
| idb-keyval | 6.3.0 | Apache-2.0 | © 2016 Jake Archibald | Cópia da licença Apache-2.0 (o pacote não tem NOTICE) | `idb-keyval-6.3.0-LICENCE.txt` + `Apache-2.0.txt` | 🟢 (na tela de créditos) |
| Fonte Roboto (`@fontsource-variable/roboto`, só usada no iPhone) | 5.3.0 | OFL-1.1 | © 2011 The Roboto Project Authors | Licença junto da fonte; não vender a fonte sozinha | `roboto-5.3.0-OFL.txt` | 🟢 (na tela de créditos) |
| Capacitor (`@capacitor/core`, `@capacitor/android`) | 8.6.2 | MIT | © 2017-present Drifty Co. | idem | `capacitor-8.6.2-LICENSE.txt` | 🟢 (na tela de créditos) |
| `@capacitor/app`, `/haptics`, `/status-bar` | 8.1.2, 8.0.2, 8.0.4 | MIT | © 2020-present Ionic | idem | `capacitor-plugins-app-haptics-status-bar-LICENSE.txt` | 🟢 (na tela de créditos) |
| `@capacitor/filesystem` | 8.1.5 | MIT | © 2025 Ionic | idem | `capacitor-filesystem-8.1.5-LICENSE.txt` | 🟢 (na tela de créditos) |
| AndroidX (appcompat, core, core-splashscreen, activity, fragment, coordinatorlayout, webkit e transitivas) | 1.7.1, 1.17.0, 1.2.0, 1.11.0, 1.8.9, 1.3.0, 1.14.0 | Apache-2.0 | © The Android Open Source Project | Cópia da licença Apache-2.0 (sem NOTICE) | `Apache-2.0.txt` | 🟢 só no APK (na tela de créditos); confirmar a lista exata com o Gradle antes de publicar (`docs/licencas/README.md`) |
| Apache Cordova Android (`org.apache.cordova:framework`) | 14.0.1 | Apache-2.0 | © 2015-2020 The Apache Software Foundation | Licença + NOTICE | `cordova-android-14.0.1-NOTICE.txt` + `Apache-2.0.txt` | 🟢 só no APK (na tela de créditos) |
| ionfilesystem-android | 1.1.1 | MIT | © 2025 Ionic | Aviso + licença | `ionfilesystem-android-1.1.1-LICENSE.txt` | 🟢 só no APK (na tela de créditos) |
| Kotlin stdlib, kotlinx-coroutines-core | ~2.2, 1.10.2 | Apache-2.0 | © JetBrains s.r.o. | Cópia da licença Apache-2.0 (sem NOTICE) | `Apache-2.0.txt` | 🟢 só no APK (na tela de créditos) |

Ao atualizar a versão de uma biblioteca (inclusive o Capacitor e os plugins, que mudam as do APK), troque a linha e o
arquivo da licença. SDK de anúncios e Billing entram aqui se um dia forem adicionados (fora da 1ª versão, decisão de
18/11/2026).

## Serviços externos usados pelo jogo

Não são assets, mas recebem dados do jogador e precisam aparecer na política de privacidade e no Data Safety.

| Serviço | Para quê | Onde no código | Situação |
|---|---|---|---|
| Web3Forms (`api.web3forms.com`) | Report de bug por e-mail | `src/ui/bugReport.ts` | Só no site; será trocado antes do app ir para a loja (decisão de 17/11/2026) |
