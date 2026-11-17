# Auditoria de direitos e políticas da loja — Wanderers

Data: 17/11/2026 · Escopo: tudo o que está no repositório `Flushin/rpg-wuxia` (branch `main`, commit `5a91c46`) e o que vai
para o pacote do app (`public/` + o JS gerado pelo build). Nenhum arquivo de código ou asset foi alterado nesta etapa.

> **Aviso:** este relatório é uma triagem técnica, não um parecer jurídico. Os pontos marcados com 🔴, o nome do jogo (seção 3)
> e a adequação à LGPD/ECA Digital da política de privacidade devem ser revistos por um advogado antes da publicação.

**Como a evidência foi conferida**

- Lidos: `README.md`, `docs/decisoes-do-projeto.md`, `docs/musica.md`, `AUDITORIA.md`, `public/audio/CREDITS.txt`,
  `public/sprites/CREDITS.txt`, `tools/sprites/README.md`, `tools/sprites/fetch-assets.sh`, todos os scripts de geração
  (`tools/sprites/*.py`, `tools/icons/make_app_icons.py`, `tools/gen-maps.mjs`), `package.json`/`package-lock.json`,
  `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `src/ui/bugReport.ts` e os JSON de `src/data/`.
- Metadados dos arquivos de áudio lidos com `ffprobe` (tags ARTIST/TITLE/COMMENTS).
- Licenças conferidas na web em 17/11/2026: KayKit (LICENSE.txt do repositório oficial — CC0), espelho Quaternius
  (`LICENSES.md` — CC0 upstream), espelho Kenney (`LICENSE.txt` — CC0), páginas do OpenGameArt das duas músicas (CC0, via
  resultado de busca).
- **Limitação:** desta sessão não foi possível abrir diretamente `opengameart.org` nem `support.google.com` (rede bloqueada).
  As licenças das músicas e o estado atual das políticas do Google Play foram conferidos por mecanismo de busca e por fontes
  secundárias. **Confira você mesmo** as páginas citadas antes de publicar (links na seção 4 e 5).
- Não há `CLAUDE.md` no repositório; as decisões estão em `docs/decisoes-do-projeto.md`.

---

## 1. Resumo executivo

**Veredito: PRONTO COM AJUSTES — hoje BLOQUEADO até resolver os itens abaixo.**

> Atualizado em 17/11/2026 com as suas respostas (seção 8): músicas confirmadas com originais guardados; nenhum uso de IA
> generativa; nome será trocado; público 13+; **anúncio com recompensa e diamantes (itens fixos) já na 1ª versão**; conta
> pessoal ainda a criar; desenvolvedor com nome pessoal; o report por Web3Forms será substituído no app da loja.

A parte de direitos autorais está em situação boa para um projeto indie: toda a arte é renderizada por scripts próprios a
partir de modelos 3D **CC0** (KayKit, Quaternius, Kenney) ou desenhada por código; os sons são Kenney **CC0**; as duas músicas
são **CC0** no OpenGameArt; não há fontes externas, CDN, analytics, anúncios nem SDKs de terceiros no app; as dependências
de produção são MIT/Apache-2.0. Nenhum asset tem licença não comercial, sem derivação ou GPL.

**O que BLOQUEIA a publicação hoje:**

| # | Bloqueio | Por quê |
|---|---|---|
| B1 | **Não existe política de privacidade publicada** nem link para ela dentro do app. | Obrigatória para **todo** app no Google Play (mesmo os que não coletam nada), com URL pública, ativa, não-PDF e não geobloqueada, e link no Play Console **e** dentro do app. O app ainda envia dados a um terceiro (Web3Forms) no report de bug. |
| B2 | **Seção Segurança dos dados (Data Safety) não preenchida/planejada por escrito.** | Obrigatória; tem de bater com a política de privacidade e com o que o report de bug realmente envia (seção 4). |
| B3 | **Nome do jogo:** você decidiu **trocar "Wanderers"** (17/11/2026). Falta escolher o novo nome e pesquisá-lo. | Risco de denúncia por marca e remoção. O `applicationId` não pode ser mudado depois de publicado, então só deve ser criado com o nome final (seção 3). |
| B4 | **Monetização na 1ª versão** (anúncio com recompensa + pacotes de diamantes comprados com dinheiro real — resposta de 17/11/2026) **ainda sem nada preparado**: SDK de anúncios, consentimento, Google Play Billing, proteção das compras com save só local. | Muda Data Safety, política de privacidade, classificação (IARC), permissões e exige Billing. Ver seção 4.5. |

**Exige ação, mas não bloqueia sozinho (🟡):**

- Avisos de licença das bibliotecas (Phaser — MIT, idb-keyval — Apache-2.0, eventemitter3 — MIT) não aparecem em lugar
  nenhum do app. MIT/Apache **exigem** que o aviso acompanhe a distribuição.
- Créditos dos assets CC0 existem só em arquivos `.txt` dentro de `public/` (o jogador não vê). CC0 não exige crédito, mas
  as músicas e a documentação de origem ficam frágeis sem prova arquivada.
- Dois pacotes de modelos 3D baixados de **espelhos não oficiais** no GitHub (Quaternius e Kenney Nature Kit) — falta
  arquivar a página oficial como prova. (Os 3 sons sem tag foram **identificados** como Kenney UI Audio, CC0 — seção 2.2.1.)
- Visual "chibi"/cartunesco pode ser considerado atraente para crianças → defina o público-alvo com cuidado (seção 4).
- Imagens da loja (screenshots, ícone 512, *feature graphic* 1024×500) ainda não existem.

---

## 2. Inventário

Legenda de risco: 🟢 ok · 🟡 exige ação · 🔴 bloqueia · ❓ origem desconhecida (tratar como proibido até prova).

### 2.1 Imagens

| Item | Caminho | Tipo | Origem | Licença | Evidência | Risco | Ação necessária |
|---|---|---|---|---|---|---|---|
| Tormenta (jogador) | `public/sprites/tormenta.png/.json`, `tormenta_retrato.png` | Sprite renderizado | "Rogue" — KayKit Adventurers 1.0 (Kay Lousberg), recolorido por `tools/sprites/render_sprites.py` | CC0 1.0 | `public/sprites/CREDITS.txt`; `tools/sprites/fetch-assets.sh` (repo oficial `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`); LICENSE.txt do repo = CC0 (conferido) | 🟢 | Guardar cópia do LICENSE.txt (ver plano) |
| Geada (jogador) | `public/sprites/geada.*`, `geada_retrato.png` | Sprite renderizado | "Mage" KayKit + leque gerado por script | CC0 1.0 | idem | 🟢 | — |
| NPCs (13) e retratos dos mestres | `public/sprites/npc_*.png/.json`, `npc_*_retrato.png` | Sprite renderizado | Rogue, Rogue_Hooded, Mage, Knight, Barbarian — KayKit, recoloridos | CC0 1.0 | idem; configs em `tools/sprites/npc_*.json` | 🟢 | — |
| Bandidos | `public/sprites/bandido_espadachim.*`, `bandido_arqueiro.*` | Sprite renderizado | Knight / Rogue KayKit + lenço e chapéu gerados por script | CC0 1.0 | idem | 🟢 | — |
| Terracota e General | `public/sprites/terracota.*`, `general.*` | Sprite renderizado | Knight KayKit recolorido | CC0 1.0 | idem | 🟢 | — |
| Lobo | `public/sprites/lobo.*` | Sprite renderizado | "Wolf" — Quaternius, Ultimate Animated Animal Pack | CC0 1.0 | `CREDITS.txt`; baixado do **espelho não oficial** `trebeljahr/quaternius-showcase` (cópia de dez/2022; `LICENSES.md` diz CC0 upstream) | 🟡 | Arquivar a página oficial quaternius.com do pacote (CC0) como prova; trocar o `fetch-assets.sh` para a fonte oficial quando possível |
| Árvores, pedras, plantas, flores, cogumelos, toco, tronco, cerejeiras | `public/sprites/floresta.*`, parte de `cidade.*` | Sprite renderizado | Nature Kit — Kenney, recolorido | CC0 1.0 | `CREDITS.txt`; baixado do **espelho não oficial** `shorepine/kenney` (o `LICENSE.txt` na raiz do espelho é do *Castle Kit*, CC0 — não do Nature Kit) | 🟡 | Arquivar a página oficial kenney.nl do Nature Kit (CC0) e o License.txt do próprio pacote |
| Casas, portão, lanternas, estandartes etc. | `public/sprites/cidade.*` | Sprite renderizado | Gerados por `tools/sprites/render_town.py` (geometria própria) | Própria | `CREDITS.txt`; código do script | 🟢 | — |
| Ruínas e portal | `public/sprites/ruinas.*` | Sprite renderizado | `tools/sprites/render_ruins.py` | Própria | idem | 🟢 | — |
| Pisos e água | `public/sprites/pisos.png` | Textura 2D | `tools/sprites/ground_tiles.py` | Própria | idem | 🟢 | — |
| Ícones de itens e skills | `public/sprites/icones.png` | UI | `tools/sprites/icons.py` | Própria | idem | 🟢 | — |
| Tileset do Tiled | `public/maps/tiles.png` | Textura | `tools/gen-maps.mjs` (`tilesetPng()`) | Própria | código | 🟢 | (não é carregado pelo jogo; pode ficar fora do pacote) |
| Ícone do app / PWA | `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` | Ícone | `tools/icons/make_app_icons.py` (duas lâminas sobre lua, desenhado por código) | Própria | código | 🟢 | Gerar versão 512×512 para a loja e o ícone adaptativo a partir do mesmo script |
| Splash / tela de carregamento | `index.html` (texto "WANDERERS" + barra, CSS) | UI | Própria | Própria | código | 🟢 | Splash nativo do Android 12+ ainda não existe (gerar do ícone) |
| Emojis na interface (📜 💪 🎒 ⚙ 🐞 ☰ …) | `index.html`, `src/ui/*.ts` | UI (glifos do sistema) | Renderizados pela fonte de emoji **do aparelho** (não são arquivos do app) | Não se aplica (não são distribuídos) | código | 🟢 | Não usar emojis em imagens da loja (prints) de forma destacada — são arte do Google/Apple/Samsung |
| Screenshots, banner (*feature graphic*), vídeo da loja | — (não existem) | Imagens da loja | — | — | — | 🟡 | Criar a partir do próprio jogo (seção 4.8) |

### 2.2 Áudio

| Item | Caminho | Origem | Licença | Evidência | Risco | Ação |
|---|---|---|---|---|---|---|
| hit, crit, level_up, monster_attack, monster_death, player_death, spell | `public/audio/sfx/*.ogg/.mp3` | Kenney (tags `ARTIST=Kenney`, "Sound generated by GameSynth from Tsugi") | CC0 | `public/audio/CREDITS.txt` + tags nos arquivos | 🟢 | — |
| miss (`clothBelt`), portal (`door4`), ui_open (`bookOpen`), ui_close (`bookClose`) | `public/audio/sfx/` | Kenney **RPG Audio** (os títulos batem com os nomes dos arquivos desse pacote) | CC0 | `CREDITS.txt` + tag TITLE | 🟢 | — |
| point_spent, tip, ui_click | `public/audio/sfx/` | **Kenney UI Audio** ("UI SFX Set", Kenney Vleugels): `ui_click` = **click1**, `point_spent` = **click3**, `tip` = **rollover3** (identificados em 17/11/2026, ver 2.2.1) | CC0 1.0 | Comparação do áudio com o pacote (correlação 0,96–0,996) + `LICENSE.txt` do pacote | 🟢 | Registrar o nome original em `ASSETS_LICENCAS.md`; guardar o `LICENSE.txt` do pacote em `docs/licencas/` |
| Música da cidade | `public/audio/music/cidade.ogg/.mp3` (22,5 s, loop) | "Oriental" — Shadowfire452 — opengameart.org/node/15485 | CC0 (página do OGA) | `CREDITS.txt`; licença CC0 conferida por busca em 17/11/2026; **você confirmou que baixou dessa página e guarda o original** | 🟢 | Copiar o original para `docs/licencas/` (ou guardar fora do repo) + print/Wayback da página. Risco residual baixo: o OGA não verifica se quem envia é o autor |
| Música da floresta | `public/audio/music/floresta.ogg/.mp3` (1 min 43 s) | "Asian/Oriental 1" — Tozan — opengameart.org/content/asianoriental1 | CC0 (página do OGA) | idem | 🟢 | idem |
| Vozes | — | Não há | — | — | 🟢 | — |

#### 2.2.1 Como os 3 sons sem tag foram identificados (17/11/2026)

O site do Kenney estava bloqueado nesta sessão, então usei a cópia do pacote **Kenney UI Audio** publicada no GitHub para
a Godot (`github.com/Calinou/kenney-ui-audio`, commit `8c3d81b`). Ela traz os 50 sons convertidos sem perda de OGG para WAV
e o `LICENSE.txt` original ("UI SFX Set by Kenney Vleugels (Kenney.nl) — License (Creative Commons Zero, CC0) — You may
use these assets in personal and commercial projects"). Também comparei com o pacote **Interface Sounds** do Kenney
(`Calinou/kenney-interface-sounds`, 100 sons).

Método: cada arquivo do jogo (ogg **e** mp3) e cada som dos pacotes foi convertido para mono 22 050 Hz, sem os silêncios
do começo e do fim. Depois calculei a **correlação cruzada normalizada** (1,0 = forma de onda idêntica). Os resultados:

| Arquivo do jogo | Melhor correspondência | Nota (ogg / mp3) | 2º lugar | Duração útil (jogo × original) |
|---|---|---|---|---|
| `ui_click` | UI Audio `click1` | **0,996 / 0,994** | 0,57 | 0,044 s × 0,044 s |
| `point_spent` | UI Audio `click3` | **0,989 / 0,994** | 0,57 | 0,046 s × 0,048 s |
| `tip` | UI Audio `rollover3` | **0,961 / 0,972** | 0,28 | 0,078 s × 0,077 s |
| *controle:* `miss` (`clothBelt`, RPG Audio) | — | 0,29 | — | — |
| *controle:* `hit` (Impact Sounds) | — | 0,38 | — | — |

A distância para o 2º lugar e os controles baixos (sons de outros pacotes) mostram que a correspondência é única. As
pequenas diferenças vêm da recompressão em ogg/mp3. O script fica no scratchpad da sessão e pode ser refeito quando houver
um som novo sem origem.

Os pacotes **RPG Audio** e **Impact Sounds** não foram encontrados no GitHub. Os outros sons já tinham prova pelas tags
(ARTIST=Kenney ou TITLE com o nome do arquivo original do RPG Audio).

### 2.3 Fontes

| Item | Onde | Origem | Risco |
|---|---|---|---|
| Fonte da interface | `index.html` (`font: 14px/1.3 system-ui, sans-serif`) | Fonte **do sistema** do aparelho — nada é empacotado nem baixado | 🟢 |
| Google Fonts / CDN / arquivos .ttf/.woff | — | **Não há** (procurei `@import`, `<link>`, URLs e arquivos de fonte) | 🟢 |

### 2.4 Código

| Item | Onde | Licença | Exigência | Risco | Ação |
|---|---|---|---|---|---|
| Phaser 3.90.0 | `package.json` (produção, vai no bundle) | MIT | Incluir o aviso de copyright + texto da licença MIT em toda cópia distribuída | 🟡 | Incluir em "Licenças de terceiros" (tela de créditos + arquivo no pacote) |
| eventemitter3 5.0.4 | transitiva do Phaser (vai no bundle) | MIT | idem | 🟡 | idem |
| idb-keyval 6.3.0 | `package.json` (produção) | Apache-2.0 | Incluir cópia da licença Apache-2.0 e o arquivo NOTICE se existir | 🟡 | idem |
| vite, typescript, esbuild, prettier + 69 transitivas | `devDependencies` | MIT (57), MPL-2.0 (12, `lightningcss*`), Apache-2.0 (2), ISC (1), BSD-3 (1) | Só ferramentas de build: **não vão para o app**. MPL-2.0 não afeta o seu código (e o lightningcss nem é usado no build) | 🟢 | — |
| Capacitor (planejado, `AUDITORIA.md` D2) | futuro | MIT; bibliotecas AndroidX/Google: Apache-2.0 | Avisos de licença no app | 🟡 | Ao adicionar, incluir na mesma tela de licenças |
| GPL/AGPL | — | **Nenhuma** dependência GPL/AGPL | — | 🟢 | — |
| Código do jogo (`src/`, `tools/`) | — | Autoria do Lucas, com assistência do Claude (Anthropic) — commits de "Lucas Silva" e "Claude" | Pelos termos da Anthropic, o resultado pertence ao usuário | 🟢 | — |
| Trechos copiados de tutoriais/StackOverflow/outros jogos | — | Nenhum indício: sem cabeçalhos de licença, sem comentários de origem, estilo uniforme (Prettier), comentários em português explicando o porquê. A\* e passo fixo são algoritmos de domínio comum | 🟢 | — |
| Serviço Web3Forms (report de bug) | `src/ui/bugReport.ts` (`api.web3forms.com/submit`) | Serviço de terceiro, não biblioteca | Termos de uso e privacidade do Web3Forms; declarar no Data Safety e na política | 🟡 | Ver seção 4 |

### 2.5 Dados e textos

| Item | Onde | Origem | Risco | Observação |
|---|---|---|---|---|
| Nomes de seitas, skills, itens, monstros, missões, NPCs, falas e dicas (PT/EN) | `src/data/*.json`, `src/data/en.json` | Escritos no projeto (Lucas + Claude) | 🟢 | Nomes genéricos ("Tormenta/Tempest", "Geada/Frost", "Colar do Dragão Sereno", "Mestre Lei", "Aldeã Mei"…). Nenhum nome de personagem de obra conhecida, nenhuma pessoa real. "Guerreiros de Terracota" = fato histórico (domínio público) |
| Mapas | `public/maps/*.json` | Gerados por `tools/gen-maps.mjs` | 🟢 | — |
| Traduções | `src/data/en.json` | Escritas no projeto | 🟢 | — |
| Referências a "Dragon Oath" | **só em `docs/`** (`decisoes-do-projeto.md`: "inspiração: Dragon Oath", "estilo Dragon Oath") | Documentação interna | 🟡 | Não aparece no jogo nem no pacote. **Nunca** usar em título, descrição, palavras-chave ou anúncios da loja |

### 2.6 Assets gerados por IA

Não encontrei nenhum indício de imagem, música ou voz gerada por IA generativa (Midjourney, DALL·E, Stable Diffusion, Suno,
ElevenLabs etc.): a arte vem de scripts Blender/Pillow documentados e os sons trazem tags do Kenney. O **código e os
textos** foram escritos com ajuda do Claude (assistente de código) — isso não é "conteúdo gerado por IA dentro do app" para a
política do Google Play (que trata de apps que *geram* conteúdo por IA para o usuário). **Confirmado por você em
17/11/2026: nenhum asset usou IA generativa.**

---

## 3. Marcas, personagens e propriedade intelectual

### 3.1 O que encontrei

| Ponto | Risco | Análise |
|---|---|---|
| **Nome do jogo "Wanderers"** | 🟡 alto → tratar como bloqueio até pesquisar | Palavra comum em inglês (marca "fraca"), e já existem títulos parecidos: **"The Wanderers"** (WanderLabs, roguelite no Steam/Epic — store.steampowered.com/app/2650360), **"Wanderer"** (idle RPG multiplayer no Google Play, pacote `online.playwanderer` — **mesmo gênero**, risco real de confusão), **"The Wanderer: Survival RPG"** (Parish Digital, Google Play/App Store). Um nome só "Wanderers" também fica difícil de achar na busca da loja. |
| `applicationId` (nome do pacote) | 🟡 | Ainda não existe (não há projeto Android). É **permanente**: depois de publicado não muda. Use um domínio que você controla, ex.: `io.github.flushin.wanderers` (o site do jogo é `flushin.github.io`). Não use `com.google…`, `com.android…` nem nome de outra empresa. |
| Inspiração em **Dragon Oath** (Changyou; baseado em *Demi-Gods and Semi-Devils*, de Jin Yong) | 🟢 no jogo / 🟡 na loja | Mecânicas (tab-target, poções com cura no tempo, seitas como classes) **não são protegidas por direito autoral**. Os nomes, a história, os mapas e a arte do Wanderers são próprios e não copiam o Dragon Oath. O risco está só em **citar** Dragon Oath/Jin Yong na ficha, nas palavras-chave ou em anúncios (política de metadados e de falsificação de identidade). |
| Estilo visual KayKit | 🟢 | CC0 permite uso e modificação; muitos jogos usam os mesmos modelos. Não é problema legal. Risco só de *percepção* ("asset flip") — os recoloridos, leque, lenços, chapéus e a cidade própria ajudam. |
| Elementos culturais (wuxia, qi, terracota, pailou, telhados curvos) | 🟢 | Gêneros e elementos culturais/históricos não são de ninguém. |
| Pessoas reais / celebridades | 🟢 | Nenhuma encontrada. |
| Logos/marcas de empresas | 🟢 | Nenhuma no jogo. |

### 3.2 O que você precisa pesquisar manualmente (eu não consigo confirmar registros de marca)

1. **Google Play:** buscar "Wanderers", "Wanderer", "Wanderers RPG", "Wanderers wuxia" — anotar apps com o mesmo nome ou
   parecido, desenvolvedor e gênero.
2. **App Store:** a mesma busca (o lançamento no iOS vem depois, mas o nome precisa servir nas duas).
3. **Steam / Epic / itch.io:** "Wanderers", "The Wanderers".
4. **INPI (Brasil)** — busca.inpi.gov.br → Marcas → "WANDERERS" e "WANDERER", **classes NCL 9** (software/jogos baixáveis),
   **41** (entretenimento/jogos online) e **28** (jogos).
5. **USPTO** (EUA) — tmsearch.uspto.gov, mesmas palavras e classes 9/41/28.
6. **WIPO Global Brand Database** (branddb.wipo.int) e **EUIPO** (TMview) — mesmas palavras e classes.
7. **Domínio e redes:** se pretende ter site/redes com o nome, verificar disponibilidade.

**Decisão (17/11/2026): o nome "Wanderers" será trocado.** Para o novo nome:

- Prefira um nome **inventado ou composto** (marca "forte"), não uma palavra comum do inglês.
- Faça as buscas 1–7 acima **com o nome novo** antes de usá-lo em qualquer lugar (tela inicial, manifest, ficha, pacote).
- Só então defina o `applicationId` (ex.: `io.github.flushin.<nomenovo>`).
- Avalie com um advogado se vale **registrar a marca no INPI** (classes 9 e 41) antes de investir em divulgação —
  com monetização, o nome passa a ter valor comercial.
- Hoje o nome aparece em: `index.html` (título e tela de carregamento), `public/manifest.webmanifest`, `package.json`
  (`name`), `public/sw.js` (nome do cache) e documentos. A troca é uma etapa de código separada.

---

## 4. Checklist de políticas do Google Play

Fontes consultadas (confira as versões atuais — elas mudam): Developer Policy Center (play.google/developer-content-policy),
anúncios de política de 15/04/2026 e 29/10/2026 na Ajuda do Play Console, página de requisitos de target SDK
(developer.android.com/google/play/requirements/target-sdk).

Legenda: ✅ ok · ⚠️ exige ação · ❌ falta / bloqueia.

### 4.1 Política de privacidade — ❌

- **Situação:** não existe. A decisão já tomada (`docs/decisoes-do-projeto.md`, "Auditoria do código") é publicar uma página
  PT/EN no GitHub Pages com link em ⚙ e na tela inicial — **ainda não feito**.
- **Por que é obrigatória:** o Google exige política de privacidade para todos os apps; além disso o report de bug envia dados
  a um terceiro.
- **Requisitos:** URL pública, ativa, em HTML (não PDF), não editável por terceiros, não geobloqueada; nome do app ou do
  desenvolvedor (o mesmo da ficha) na página; link no Play Console **e** dentro do app.
- **O que ela precisa dizer (mínimo):**
  - Quem é o responsável (seu nome ou nome de desenvolvedor como na ficha) e um e-mail de contato.
  - Que o progresso fica **só no aparelho** (IndexedDB + `localStorage`: saves, idioma, zoom, tamanho da interface, FPS, volume
    de áudio, horário do último report) e não é enviado a ninguém.
  - Que **só quando o jogador toca em "Reportar bug" e envia**, vão ao Web3Forms (e de lá ao seu e-mail): o texto digitado,
    o nome/contato opcional, o nome, a seita, o nível, o mapa, a posição e o estado do personagem, o navegador (*user agent*), a
    tela, a janela, o DPR, toque/mouse, o idioma, o FPS e os últimos 10 erros do console. O servidor do Web3Forms também
    recebe o **IP** (como qualquer requisição).
  - Finalidade (corrigir erros), base legal LGPD (consentimento por ação do usuário / legítimo interesse — **advogado**),
    retenção (quanto tempo você guarda os e-mails), como pedir exclusão, que não há anúncios, analytics nem venda de dados.
  - Link para a política do Web3Forms como operador.
  - Menores de idade (de acordo com o público-alvo que você escolher).

### 4.2 Segurança dos dados (Data Safety) — ❌ (preencher)

O que declarar, com base em `src/ui/bugReport.ts` (único ponto que envia dados para fora do aparelho):

| Pergunta do formulário | Resposta sugerida |
|---|---|
| O app coleta ou compartilha dados? | **Sim** (coleta, pelo report de bug) |
| Dados criptografados em trânsito? | **Sim** (HTTPS para `api.web3forms.com`) |
| Os usuários podem pedir exclusão? | Sim, por e-mail (informar na política) |
| Compartilhamento com terceiros | **Não** — o Web3Forms age como prestador de serviço (operador) em seu nome, o que o Google não conta como "compartilhamento". Confirme isso nos termos do Web3Forms. |
| **Informações pessoais → Nome** | Coletado, **opcional**, finalidade "Funcionalidade do app" (o campo "nome ou contato" e o nome do personagem, que pode ser um nome real) |
| **Informações pessoais → E-mail / Telefone** | Coletado, **opcional** (o campo de contato aceita texto livre; se o jogador digitar e-mail/telefone, ele é coletado). Alternativa: trocar o campo por um aviso "não coloque dados pessoais" — decisão sua |
| **Atividade no app → Outros conteúdos gerados pelo usuário** | Coletado, opcional (texto do report) |
| **Atividade no app → Ações no app** | Coletado, opcional (missão, alvo, auto-combate, mapa, posição enviados no report) |
| **Informações e desempenho do app → Registros de falhas e Diagnóstico** | Coletado, opcional (erros do console, FPS, versão) |
| **Dispositivo ou outros IDs** | Não (o *user agent* não é um identificador único). O IP fica nos registros do Web3Forms — verifique na política deles e, se houver dúvida, declare |
| Localização, contatos, fotos, áudio, arquivos, calendário, saúde, finanças, navegação | **Não** |
| Coleta efêmera? | Não (vira e-mail e fica guardado) |
| Coleta obrigatória? | **Não** — tudo é opcional e só ocorre por ação do usuário |

SDKs de terceiros: **nenhum** hoje. Se entrar Capacitor, confira os plugins usados (os oficiais básicos não coletam dados).

> **Report de bug:** você vai **substituir o Web3Forms** antes do app ir para a loja. A tabela acima vale para o site atual;
> refaça as linhas do report conforme a nova forma (ex.: Firebase Crashlytics coleta IDs de instalação e registros de
> falha automaticamente — isso precisa ser declarado; um simples link `mailto:` não coleta nada pelo app).

**Com a monetização da 1ª versão (anúncio com recompensa + diamantes) — acrescentar:**

| Origem | Tipo de dado (formulário) | Coletado / compartilhado | Finalidade |
|---|---|---|---|
| SDK de anúncios (ex.: Google AdMob) | **Dispositivo ou outros IDs** (ID de publicidade, ID do app) | Coletado **e compartilhado** com a rede de anúncios | Publicidade ou marketing; Análise; Prevenção de fraudes |
| SDK de anúncios | **Localização aproximada** (derivada do IP) | Coletado e compartilhado | Publicidade; Prevenção de fraudes |
| SDK de anúncios | **Atividade no app → Interações com o app** (impressões, cliques, visualização do anúncio) | Coletado e compartilhado | Publicidade; Análise |
| SDK de anúncios | **Informações e desempenho do app → Diagnóstico / Registros de falhas** | Coletado | Análise; Funcionalidade |
| Google Play Billing | **Informações financeiras → Histórico de compras** | Coletado (se você guardar/verificar compras em servidor ou num serviço como RevenueCat) | Funcionalidade do app |
| Serviço de validação de compras (se usar RevenueCat, Firebase etc.) | IDs de usuário/app, histórico de compras | Conforme a documentação do serviço | Funcionalidade; Prevenção de fraudes |

Use a página oficial de **"Data disclosure"** do SDK escolhido (o Google AdMob publica uma lista exata para copiar no
formulário) — não declare de memória. Os dados de pagamento (cartão) ficam com o Google e **não** são declarados por você.

### 4.3 Público-alvo e Famílias — ⚠️ (decidido: **13+**)

> **Decisão (17/11/2026): público-alvo 13+.** Fica fora da política de Famílias, mas **13–17 anos continuam sendo
> adolescentes** para a lei brasileira — com anúncios e compras na 1ª versão, o ECA Digital pesa mais (ver abaixo).

- O visual KayKit é **"cabeçudo"/cartunesco** e o tema é aventura sem sangue — **pode ser considerado atraente para
  crianças** na análise do Google, mesmo que você não marque crianças como público.
- **Recomendação:** público-alvo **13+** (ou 16+/18+ se preferir), responder honestamente "o app pode atrair crianças?" e
  manter a ficha/screenshots sem apelo infantil. Se marcar qualquer faixa abaixo de 13 anos, entra na **Política de
  Famílias**: o report de bug que envia *user agent*, texto livre e contato de crianças precisaria ser revisto (coleta de
  dados de criança exige consentimento e limita SDKs/anúncios a certificados para Famílias).
- **Brasil:** o **ECA Digital (Lei 15.211/2025)** impõe deveres a produtos digitais com acesso provável por crianças e
  adolescentes (verificação de idade, configurações protetivas, proibição de *loot boxes* para menores, limites à
  publicidade com perfilamento para menores). Com **anúncios e compras** na 1ª versão, isso deixa de ser teórico:
  🔴 **ponto para o advogado** — o que o jogo precisa fazer para usuários de 13–17 (ex.: anúncios **não personalizados**
  para menores, controle de compras). O Google lançou globalmente em out/2026 a **Play Age Signals API**, que pode
  informar a faixa etária ao app.

### 4.4 Classificação indicativa (questionário IARC) — ⚠️ (preencher)

Conteúdo relevante encontrado:

| Tema | O que existe no jogo | Resposta provável |
|---|---|---|
| Violência | Combate corpo a corpo e mágico contra **animais (lobos)** e **humanos (bandidos)** e guerreiros de terracota; animação de queda/morte; personagem do jogador morre e volta à cidade | Violência de fantasia contra personagens humanoides; estilo cartunesco |
| Sangue | Não há (efeitos são faíscas, raios, gelo, névoa) | Não |
| Linguagem imprópria | Não encontrada nos textos | Não |
| Temas sexuais, drogas, álcool, tabaco | Não encontrados | Não |
| Jogo de azar | Drops aleatórios de itens de monstros (sem dinheiro real, sem compra) | Não é jogo de azar; não é *loot box* |
| Compras digitais | **Na 1ª versão: pacotes de diamantes com dinheiro real** (itens fixos, sem aleatoriedade) | **Sim** — a ficha recebe o aviso "Compras no app" |
| Anúncios | **Na 1ª versão: anúncio com recompensa, opcional** | Declarar "Contém anúncios" no Play Console |
| Interação entre usuários / chat / UGC compartilhado | Não há (single-player) | Não |
| Compartilha localização | Não | Não |
| Compartilha informações do usuário com terceiros | Report de bug opcional (ver 4.2) | Responder conforme o formulário pergunta — normalmente "não" para compartilhamento com outros usuários |

Expectativa (não garantida): algo como ClassInd 10–12 / PEGI 7–12 / ESRB E10+–T. Responda pelo que o jogo tem, sem minimizar.

### 4.5 Monetização — ❌ (decidido: anúncio com recompensa + diamantes **na 1ª versão**)

Decisão de 17/11/2026: o jogador **pode escolher ver um anúncio para ganhar algo** e **pode comprar pacotes de
"diamantes"** para comprar **itens fixos** na loja do jogo (sem baús/sorteios pagos). Nada disso existe no código ainda.

**Anúncio com recompensa (rewarded):**
- ⚠️ Tem de ser **opcional e iniciado pelo jogador** (botão claro "Ver anúncio para ganhar X"), com a recompensa dita antes.
  Nunca abrir anúncio sozinho, ao sair do jogo, no meio do combate ou ao tocar em outro botão.
- ⚠️ Sem anúncios intrusivos: nada de intersticial inesperado, anúncio que bloqueia a tela sem fechar, ou que imita botões
  do jogo. Não dar recompensa por **clicar** no anúncio (só por assistir) — violaria a política da rede de anúncios.
- ⚠️ **Consentimento:** para usuários do Espaço Econômico Europeu, Reino Unido e Suíça o Google exige uma **plataforma de
  consentimento certificada** (ex.: UMP do AdMob). No Brasil, a LGPD exige informar e ter base legal para anúncios
  personalizados. Para menores (13–17), preferir **anúncios não personalizados** (advogado — seção 4.3).
- ⚠️ Classificar o conteúdo máximo dos anúncios no AdMob compatível com a classificação do jogo (evitar anúncios adultos).
- ⚠️ O SDK de anúncios adiciona `com.google.android.gms.permission.AD_ID` → declarar "**Usa ID de publicidade**" no Play
  Console, atualizar Data Safety (4.2) e a política de privacidade (listar a rede de anúncios e o link da política dela).
- ⚠️ Verificar se o SDK escolhido funciona no Capacitor (há plugins comunitários para AdMob — confira licença e manutenção).

**Diamantes (compra no app):**
- ❌ **Obrigatório Google Play Billing** para vender diamantes (bem digital). Proibido qualquer botão, link ou texto que leve
  a pagar fora (Pix, site, PayPal) — exceto pelos programas oficiais de faturamento alternativo, que têm regras próprias.
- ❌ **Save só no aparelho x compra com dinheiro real** (risco jurídico e de reclamações): hoje o save fica só no IndexedDB do
  aparelho. Se o jogador trocar de celular, limpar dados ou reinstalar, **perde os diamantes pagos**. Pelo Código de Defesa do
  Consumidor isso tende a gerar reclamações e pedidos de reembolso. Antes de vender: confirmar compras no servidor ou guardar o
  saldo de forma recuperável (conta/nuvem), ou no mínimo avisar com clareza antes da compra. **Advogado.**
- ⚠️ **Confirmar (acknowledge) toda compra em até 3 dias**, ou o Google reembolsa automaticamente. Tratar compras pendentes
  (boleto/Pix no Play) e reembolsos (tirar diamantes estornados).
- ⚠️ Mostrar o **preço em moeda real** que vem do Google (não escrever preço fixo no código) e quantos diamantes cada pacote dá.
- ⚠️ Itens comprados com diamantes: mostrar exatamente o que vem e quanto custa em diamantes; nada de "oferta por tempo
  limitado" falsa ou contagem regressiva enganosa.
- ✅ **Itens fixos** (sem aleatoriedade): **não** entra na regra de divulgação de probabilidades nem na restrição de
  *loot boxes* do ECA Digital. **Se um dia vender baús/sorteios,** essa análise volta.
- ⚠️ **Conta de comerciante (payments profile):** vender exige perfil de pagamentos; o Google pode **exibir publicamente o
  seu endereço** na ficha quando o app tem compras. Verifique as regras atuais no Play Console e fale com um contador sobre
  impostos sobre a receita.
- ⚠️ O **ganho offline/auto-combate** não é problema de política, mas **não venda aceleração** que pareça dar algo que o
  jogo não entrega (descrição exata do efeito).

### 4.6 Conteúdo gerado por usuários, chat, multiplayer — ✅ (não se aplica hoje)

- O nome do personagem e o texto do report **não são vistos por outros jogadores** → não é UGC para a política.
- **Marco 10 (online/multiplayer)** vai exigir: moderação, filtro de nomes, mecanismo de denúncia e bloqueio no app, termos de
  uso, e revisão de Data Safety, público-alvo e classificação (interação entre usuários).

### 4.7 Permissões do Android — ✅ (com cuidado ao empacotar)

- O jogo só precisa de **INTERNET** (report de bug; o jogo em si roda offline).
- Ao criar o projeto Capacitor, conferir o `AndroidManifest.xml` final: **não** deve conter
  `com.google.android.gms.permission.AD_ID`, localização, contatos, câmera, microfone, armazenamento externo. Se usar o
  plugin Haptics, entra `VIBRATE` (permissão normal, ok).
- Com a monetização decidida: **`com.android.vending.BILLING`** (Google Play Billing) e
  **`com.google.android.gms.permission.AD_ID`** (SDK de anúncios) — ambas justificadas. Declaração de ID de publicidade no
  Play Console: **"Usa"** (finalidade: publicidade).

### 4.8 Metadados da loja — ⚠️ (ainda não criados)

- Título, descrição curta/longa, ícone e prints **sem** "Dragon Oath", "Jin Yong", "Tian Long Ba Bu", nomes de outros jogos
  ou marcas, mesmo como comparação ("parecido com…").
- Sem palavras-chave repetidas ou enganosas ("melhor RPG", "#1", "grátis" no título, emojis no título).
- Prints **do jogo real**, sem prometer o que não existe: **não mostrar Titã e Víbora como jogáveis** (estão "em breve"), não
  falar em multiplayer/online, nível máximo é 10.
- O texto "PC e celular" vale para o site, não para o app Android — ajustar.
- Ícone 512×512 PNG (32 bits) e *feature graphic* 1024×500, gerados a partir de `tools/icons/make_app_icons.py` e capturas.

### 4.9 Comportamento enganoso e outras — ✅

- Não há botões falsos, imitação de diálogos do sistema, links externos de pagamento ou redirecionamentos.
- O app empacotará o próprio jogo (não é um WebView de site de terceiros) → ok para a política de WebView/spam.
- Tela cheia (`display: fullscreen`) é permitido em jogo.

### 4.10 Requisitos técnicos e de conta (não são "políticas de conteúdo", mas podem impedir a publicação)

- ⚠️ **Target API:** apps novos e atualizações precisam mirar **Android 16 (API 36)** desde 31/08/2026.
- ⚠️ **Conta pessoal criada após nov/2023:** teste fechado com **12 testadores por 14 dias seguidos** antes de pedir acesso à
  produção.
- ⚠️ **Verificação de desenvolvedor Android** (identidade): em implantação desde 30/09/2026 no Brasil (fonte secundária —
  confirme no Play Console).
- ⚠️ **Dados públicos do desenvolvedor:** e-mail de contato fica público na ficha; se um dia monetizar, o Google pode exibir
  endereço físico. Considere um e-mail só para o jogo.

### 4.11 O que preencher no Play Console (resumo)

| Seção | Resposta |
|---|---|
| Política de privacidade | URL da página no GitHub Pages (a criar) |
| Acesso ao app | Toda a funcionalidade disponível sem login |
| Anúncios | **Contém anúncios** |
| Classificação do conteúdo | Questionário IARC (seção 4.4), com **compras digitais = sim** |
| Público-alvo e conteúdo | **13+** e resposta honesta sobre apelo infantil |
| Segurança dos dados | Seção 4.2, **incluindo o SDK de anúncios e o Billing** |
| ID de publicidade | **Usa** (publicidade) |
| Produtos no app | Pacotes de diamantes (produtos consumíveis) cadastrados em "Monetizar → Produtos" |
| Perfil de pagamentos | Criar (necessário para vender) |
| Apps governamentais / financeiros / saúde / notícias | Não |
| Categoria | Jogo → RPG (ou Ação) |
| Contato | E-mail (público) e, opcionalmente, site |

---

## 5. Plano de correção por prioridade

### Prioridade 1 — antes de enviar a primeira versão (bloqueios)

1. **Escolher o novo nome**, pesquisar a marca (seção 3.2) e só então fixar o `applicationId` definitivo
   (sugestão: `io.github.flushin.<nomenovo>`).
1b. **Monetização (seção 4.5):** escolher a rede de anúncios (e o plugin Capacitor), integrar o consentimento (UMP), integrar o
   Google Play Billing com confirmação de compras e reembolsos, e **resolver a perda de diamantes pagos com save só local**
   (servidor/nuvem ou, no mínimo, aviso claro) — com revisão de advogado (CDC, LGPD e ECA Digital para 13–17).
1c. **Trocar o report de bug** (decidido) e declarar a nova forma no Data Safety e na política.
2. **Política de privacidade** PT/EN publicada no GitHub Pages (ex.: `public/privacidade.html`) + link em ⚙ e na tela
   inicial (etapa D8 do `AUDITORIA.md`). Fazer revisar por advogado (LGPD, menores).
3. **Data Safety** preenchido conforme 4.2 e anotado em `docs/` (para manter igual à política).
4. **Público-alvo e IARC** respondidos (4.3 e 4.4).

### Prioridade 2 — junto com a primeira versão (exigências de licença e prova)

5. **Tela "Créditos e licenças"** no app (em ⚙ e na tela inicial), com o conteúdo do rascunho da seção 6, incluindo o texto
   completo das licenças MIT (Phaser, eventemitter3) e Apache-2.0 (idb-keyval) — e, quando entrar, Capacitor/AndroidX.
   Também gerar um `THIRD_PARTY_LICENSES.txt` no pacote (ex.: com `npx license-checker --production` ou
   `rollup-plugin-license`), conferido à mão.
6. **Arquivar as provas de licença** numa pasta `docs/licencas/` (fora do pacote). **Em andamento (17/11/2026):** já estão lá
   as licenças do KayKit, do espelho Quaternius, do Kenney UI Audio, do Phaser, do eventemitter3 e do idb-keyval, mais os
   textos completos da CC0 e da Apache-2.0. O que falta (Kenney Nature Kit/RPG Audio/Impact Sounds, páginas do OpenGameArt
   e do Quaternius, originais das músicas) está listado em `docs/licencas/README.md`. Lista original:
   - `kaykit-adventurers-1.0-LICENSE.txt` (do repositório oficial);
   - cópia/print da página oficial do **Kenney Nature Kit**, **Kenney RPG Audio**, **Impact Sounds**, **UI Audio** (kenney.nl,
     com o License.txt de cada pacote);
   - cópia/print da página do **Quaternius Ultimate Animated Animal Pack** (quaternius.com);
   - capturas das duas páginas do **OpenGameArt** e um link do **Wayback Machine** (web.archive.org/save) com data.
7. **Corrigir a origem** do `tools/sprites/fetch-assets.sh` para fontes oficiais (download do kenney.nl / quaternius.com) ou,
   no mínimo, documentar que os espelhos foram conferidos byte a byte com os pacotes oficiais.
8. ~~Identificar a origem de `point_spent`, `tip` e `ui_click`~~ — **feito** (Kenney UI Audio `click3`, `rollover3`,
   `click1`; seção 2.2.1). Nomes originais já registrados em `public/audio/CREDITS.txt` e em `ASSETS_LICENCAS.md`.
9. ~~Começar o `ASSETS_LICENCAS.md`~~ — **feito (17/11/2026)**, na raiz do repositório, com todos os itens da tabela 2.

### Prioridade 3 — antes de monetizar ou de entrar online

10. Rever Data Safety, política, público-alvo e IARC a cada SDK novo (anúncios, analytics, login, nuvem).
11. Compras só via Google Play Billing; probabilidades divulgadas se houver itens aleatórios pagos.
12. Multiplayer: moderação, denúncia, bloqueio, termos de uso.

### Fontes de assets com licença comercial clara (para novos conteúdos)

| Tipo | Fonte | Licença | Observação |
|---|---|---|---|
| Modelos 3D (mesmo estilo atual) | **KayKit** (kaylousberg.com / itch.io) | CC0 | Mantém a coerência; pacotes pagos também têm licença comercial — leia cada um |
| Modelos 3D | **Quaternius** (quaternius.com) | CC0 | Baixar do site oficial |
| Modelos 3D, 2D, áudio, UI | **Kenney** (kenney.nl) | CC0 | Baixar do site oficial |
| Áudio | **Sonniss GDC Game Audio Bundle** | Licença própria royalty-free comercial | Leia a licença do bundle do ano |
| Música | OpenGameArt filtrando **somente CC0** | CC0 | Evitar CC-BY-SA e GPL; checar autoria |
| Música | **Freesound** filtrando **CC0** | CC0 | Evitar "Attribution NonCommercial" |
| Fontes (se um dia trocar a do sistema) | **Google Fonts** baixadas e empacotadas | SIL OFL 1.1 | Incluir o OFL.txt no app; não renomear com o nome reservado |
| Evitar | "free for personal use", CC BY-NC, CC BY-ND, sprites "rippados", assets de asset store que proíbem redistribuição sem ler a licença, músicas do YouTube "sem copyright" | — | Créditos não substituem licença |

---

## 6. Rascunho de `CREDITOS.md`

> Sugestão de onde mostrar: botão **"Créditos e licenças"** em ⚙ (configurações) e um link pequeno na tela inicial, ao
> lado da versão. O mesmo texto pode ir na descrição longa da loja (opcional). CC0 não exige crédito, mas é boa prática e
> reforça a prova de origem. As licenças MIT/Apache-2.0 **exigem** o texto completo da licença — coloque-o nessa tela
> (rolagem) ou num arquivo `THIRD_PARTY_LICENSES.txt` aberto por ela.

```markdown
# Créditos — Wanderers

Jogo criado por Lucas Silva.

## Arte
Personagens e monstros renderizados a partir de modelos 3D:
- KayKit Adventurers Character Pack 1.0 — Kay Lousberg (kaylousberg.com) — CC0 1.0
- Ultimate Animated Animal Pack — Quaternius (quaternius.com) — CC0 1.0
Cenário:
- Nature Kit — Kenney (kenney.nl) — CC0 1.0
Casas, ruínas, portais, pisos, ícones e ícone do app: criados para o jogo.

## Som
- Efeitos sonoros: Kenney (kenney.nl) — RPG Audio, Impact Sounds e UI Audio — CC0 1.0
- Música da cidade: "Oriental" — Shadowfire452 (OpenGameArt.org) — CC0 1.0
- Música da floresta: "Asian/Oriental 1" — Tozan (OpenGameArt.org) — CC0 1.0

## Software de terceiros
- Phaser 3 — © Phaser Studio Inc. (e contribuidores) — Licença MIT
- eventemitter3 — © Arnout Kazemier — Licença MIT
- idb-keyval — © Jake Archibald — Licença Apache 2.0
(texto completo das licenças abaixo / em THIRD_PARTY_LICENSES.txt)

## Ferramentas
Feito com TypeScript, Vite e Blender.
```

*Confira os nomes exatos dos titulares de copyright no arquivo `LICENSE` de cada pacote em `node_modules/` antes de publicar.*

---

## 7. Proposta de `ASSETS_LICENCAS.md` (registro daqui em diante)

Regra: **nenhum asset entra no repositório sem uma linha neste arquivo** e sem a prova da licença salva em `docs/licencas/`.

```markdown
# Registro de assets e licenças

Regras
- Só entram licenças que permitem uso comercial e modificação: CC0, domínio público, CC BY (com crédito), OFL (fontes),
  MIT/Apache/BSD (código) ou licença comercial comprada (guardar o recibo).
- Proibido: CC BY-NC, CC BY-ND, CC BY-SA em arte (avaliar caso a caso), GPL/AGPL no código do app, "free for personal use",
  origem desconhecida.
- Baixar sempre da fonte oficial. Salvar a licença e um print/arquivo da página (com data) em docs/licencas/.
- Se for gerado por IA: anotar a ferramenta, o plano/termos vigentes e a data.

| Arquivo(s) no projeto | Tipo | Título original / arquivo original | Autor | Fonte (link oficial) | Licença | Exige crédito? | Modificado? Como | Prova (docs/licencas/…) | Adicionado em | Por |
|---|---|---|---|---|---|---|---|---|---|---|
| public/sprites/tormenta.* | sprite 3D renderizado | Rogue.glb (KayKit Adventurers 1.0) | Kay Lousberg | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 | Não (cortesia) | Recolorido, renderizado | kaykit-adventurers-1.0-LICENSE.txt | 2026-11-15 | Lucas |
| public/audio/music/cidade.* | música | "Oriental" | Shadowfire452 | https://opengameart.org/node/15485 | CC0 1.0 | Não (cortesia) | Convertido para ogg/mp3, cortado para loop | oga-15485-2026-11-17.png + link Wayback | 2026-11-15 | Lucas |
| … | | | | | | | | | | |
```

---

## 8. Perguntas e respostas (respondidas em 17/11/2026)

| # | Pergunta | Resposta | Efeito no relatório |
|---|---|---|---|
| Q1 | As músicas vieram exatamente das páginas do OpenGameArt citadas? | **Sim, e você guarda os originais** | Músicas passam a 🟢; falta só arquivar a prova |
| Q2 | De onde vieram `point_spent`, `tip` e `ui_click`? | **Não sabia — investigado em 17/11/2026** | **Identificados:** Kenney UI Audio `click3`, `rollover3` e `click1` (CC0) → 🟢 (seção 2.2.1) |
| Q3 | Há assets fora do git? | **Não** (imagens da loja serão feitas a partir do jogo) | Inventário completo |
| Q4 | Nome do jogo | **Trocar "Wanderers"** | B3: escolher e pesquisar o nome novo antes do `applicationId` |
| Q5 | Usou IA generativa em assets? | **Não** | Seção 2.6 confirmada |
| Q6 | Público-alvo | **13+** | Fora de Famílias; ECA Digital ainda vale para 13–17 |
| Q7 | Monetização | **Anúncio com recompensa opcional + pacotes de diamantes para itens da loja** | Novo bloqueio B4 (seção 4.5) |
| Q7b | Itens aleatórios pagos? | **Não — só itens fixos** | Sem divulgação de probabilidades nem regra de *loot box* |
| Q7c | Quando entra a monetização? | **Na 1ª versão** | Data Safety, IARC, permissões e Billing já no lançamento |
| Q8 | Tipo de conta do Play | **Pessoal, ainda a criar** | Teste fechado com 12 testadores por 14 dias + verificação de identidade |
| Q9 | Nome do desenvolvedor | **Seu nome pessoal** | Mesmo nome na ficha e na política de privacidade |
| Q10 | Retenção dos reports de bug | **O report por Web3Forms será trocado no app da loja** | Definir a nova forma e a retenção na política |
| Q11 | O repositório é público? | Não perguntado: o GitHub Pages grátis exige repositório público, então ele deve ser | Manter em `docs/` a linguagem de "inspiração em mecânicas" ao citar Dragon Oath |

### Ainda em aberto
- Novo nome do jogo (e resultado das buscas de marca).
- Rede de anúncios e forma de proteger os diamantes pagos (servidor/nuvem).
- Nova forma de reportar bug no app e por quanto tempo os reports serão guardados.

---

**Lembrete final:** este relatório não substitui a análise de um advogado. Em especial: o novo nome/marca (B3), a monetização com save só no
aparelho (B4), o texto da política de privacidade frente à LGPD e ao ECA Digital, e qualquer futura monetização com itens aleatórios.
