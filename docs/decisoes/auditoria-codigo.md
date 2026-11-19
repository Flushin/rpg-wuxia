### Auditoria do código (17/11/2026)
Decidido pelo Lucas em 17/11/2026, a partir do `AUDITORIA.md` (relatório e plano de refatoração).
- **Geada:** Stamina inicial é **10** (não 8 como estava escrito no fechamento do marco 7; o código e o simulador usam 10).
- **Mapas:** gerados pelo script `tools/gen-maps.mjs` no formato JSON do Tiled (não são editados no Tiled).
- **Ganho offline no app:** ao voltar do segundo plano depois de **mais de 5 min** fora com o Auto ligado, aplica o mesmo cálculo offline e mostra o resumo (a fazer na etapa D5).
- **Formatação:** Prettier aplicado de uma vez, num PR só de formatação.
- **Nomes no código novo:** em inglês; comentários e docs em português; ids salvos e de dados (`lamina`, `colar`, `comum`…) não mudam.
- **Volumes de som:** **por aparelho** (feito na B6; antes eram por personagem).
- **Ordem do plano:** Fase A (rede de segurança) → B (legibilidade) → C (estrutura) → D (lojas). Nenhuma etapa começa sem o Lucas pedir.
- **Lojas:** **só Android por enquanto** (Google Play); o código fica preparado para iOS.
- **Política de privacidade:** página PT/EN no GitHub Pages do jogo, com link em ⚙ e na tela inicial.
- **Nome do jogo (18/11/2026):** **Mistpeak** (no jogo, tela inicial, PWA e app); na loja **"Mistpeak: Idle RPG"**.
  appId `io.github.flushin.mistpeak`. Escolhido entre ~75 nomes triados por busca na web (Play, App Store, Steam e
  marcas); sem jogo, app ou marca "Mistpeak" encontrados. Falta o Lucas conferir no INPI/USPTO/EUIPO antes de publicar.
  O repositório continua `rpg-wuxia` (o endereço do site não muda). Substitui "Wanderers" (conflito com "Wanderer",
  idle RPG no Google Play).
- **Report de bug no app:** continua pelo Web3Forms, declarado na política de privacidade e no Data Safety. Confirmado pelo Lucas em 18/11/2026 (a auditoria de direitos dizia que seria substituído; vale esta decisão).

**Fase A feita (17/11/2026, sem mudar regras do jogo):**
- **A1:** testes no GitHub Actions (ver "Contínuo" no roteiro); `esbuild` declarado no `package.json`; `npm test` roda os checks (8 desde o módulo de balanceamento).
- **A2:** simulador determinístico — o relógio dos renascimentos acompanha o tempo simulado e a luta do chefe usa a semente
  desde o começo. A medição mudou (Tormenta ~61 min, Geada ~43 min; Tormenta vence o chefe com Incomum 10/10): antes os
  monstros pareciam renascer mais devagar do que no jogo ao trocar de mapa. Detalhes em `docs/balanceamento.md`.
- **A3:** se o armazenamento não puder ser lido, a tela inicial mostra o aviso com "Tentar de novo" e nada é gravado
  (antes isso virava "sem personagens" e a próxima gravação apagava os 4 espaços). A leitura tenta 3 vezes.
- **Teste instável corrigido:** o `check:quests` falhava ~1 em 12 vezes (confundia um drop com a recompensa da missão).
- **A4:** README, `docs/balanceamento.md` e o `_doc` de `items.json` atualizados.

**Fase B em andamento:**
- **B1 (17/11/2026):** Prettier 3.6.2 aplicado em todo o código de uma vez (`.prettierrc.json`: 120 colunas, aspas simples)
  e `.editorconfig`. Não formata JSON (os de sprites são gerados pelos scripts do Blender e os de `src/data` ficam em
  tabelas de uma linha por item) nem Markdown. Comandos: `npm run format` (formata) e `npm run format:check` (confere);
  o `format:check` roda no CI dos PRs. No VSCode, a extensão Prettier formata ao salvar (recomendada em
  `.vscode/extensions.json`). O JS do build saiu idêntico (mesmo hash) e o simulador deu a mesma saída.
  Linhas com mais de 120 colunas: de 752 para 146 (o que sobrou são textos e comentários longos, que o Prettier não quebra).
- **B2 (17/11/2026):** `src/ui/dom.ts` com `byId()` (pega elemento pelo id) e `escapeHtml()` (escapa `& < > " '`);
  apagadas as 13 cópias de `$` e as 4 de `esc` dos arquivos de `src/ui/`. Corrigido: o nome do personagem no painel de
  Atributos (C) não era escapado — um nome com `<` quebrava o painel. Testado com o nome `a<b&"c'>` (painel C, mochila e
  tela inicial).
- **B3 (17/11/2026):** camadas de desenho com nome em `src/render/depth.ts` (`DEPTH.GROUND`, `TELEGRAPH`, `NAME`,
  `SKILL_FX`, `FLOAT_TEXT`…) no lugar dos números soltos; em `gameScene.ts`, constantes para a área de clique/toque
  (`PICK`), a elipse do aviso do chefe derivada de `TILE_W/TILE_H` e as cores dos textos flutuantes (`FLOAT_COLOR`).
  Mesmos valores (a elipse muda 0,005 px por tile de raio, por usar √2 exato).
- **B4 (17/11/2026):** o painel do auto-combate (☰) lê os números das constantes do código em vez de repeti-los no
  texto: vida do Véu de Névoa (`SHIELD_HP`), tempo dos itens no chão (`groundSeconds`), janela do ritmo e mínimo de dados
  (`BUCKET_SEC × MAX_BUCKETS`, `RATE_MIN_SEC`) e faixas do ganho offline (`OFFLINE_TIERS`). **Corrigido:** a dica do Mestre
  Lei dizia que o Quebra-Guarda reduz a defesa em 30%; a skill reduz **40%** (`skills.json`). As dicas de `tips.json` ainda
  repetem números (durabilidade 10%, +8% por nível, faixas offline) — conferidos e iguais ao código.
- **B5 (17/11/2026):** `src/render/textures.ts` passou de 219 para ~35 linhas: só a sombra, o ponto de luz das
  partículas e uma **figura genérica** (`PLACEHOLDER`), usada por quem não tem folha de sprites (ex.: Titã e Víbora antes
  da arte do marco 8). Saíram os pisos, árvores, casas, lobo, bandidos, terracota, General, jogadores e NPCs desenhados
  em código (todos já tinham arte). Tipo de piso sem arte passa a mostrar grama em vez de buraco. `BY_TEXTURE` continua
  (liga os nomes de sprite dos dados às folhas). `public/maps/tiles.png` (1 KB) continua: é o tileset do formato Tiled.
- **B6 (17/11/2026):** preferências do aparelho num lugar só: `src/platform/prefs.ts` com `getPref`/`setPref` (o
  `try/catch` uma vez só) e a lista `PREF` de chaves documentada. **As chaves são as mesmas** (preferências atuais
  preservadas). **Volumes agora são por aparelho** (decisão P6): ficam em `rpg-audio`; na primeira vez, herdam os volumes
  do personagem que entrar. O campo `audio` do save continua igual (formato não muda), mas só é lido nessa primeira vez.

**Fase B concluída em 17/11/2026** (B1–B6). Fase C (estrutura):
- **C1 (17/11/2026):** o painel ⚙ saiu de `src/ui/tips.ts` para `src/ui/settingsPanel.ts` (`SettingsPanel`).
  `TipManager` ficou só com as dicas e ganhou `setEnabled()` e `resetSeen()`, que o painel chama. O comportamento é o mesmo.
- **C2 (18/11/2026):** o painel de Atributos (C) saiu de `src/ui/hud.ts` para `src/ui/attrsPanel.ts` (`AttrsPanel`, com
  `open`, `set()` e `update()`, no mesmo molde do painel de skills). O `Hud` continua com `togglePanel()` e o som de abrir/fechar.
- **C3 (18/11/2026):** `showTitleScreen` (`src/ui/create.ts`) foi dividida em `setupSlotList`, `setupCreateView` e
  `setupDeleteView`, que dividem um estado único (`TitleState`: arquivo de saves, espaço e seita escolhidos).
- **C4 (18/11/2026):** o `<style>` do `index.html` (2.200 linhas) foi para `src/styles/`, em 10 arquivos por assunto,
  ligados por `src/styles/index.css` (`<link>` no `<head>`, então a tela de carregamento continua com estilo antes do JS).
  **A ordem dos arquivos é a ordem original das regras e importa.** Conferido no navegador: as 405 regras carregadas são
  as mesmas, na mesma ordem. A folha de ícones passou a `url(/sprites/icones.png)` (o Vite reescreve para relativo no
  build). O build agora minifica o CSS (antes ia sem minificar dentro do HTML). Juntar regras do mesmo elemento que estão
  espalhadas fica para depois, uma de cada vez, porque aí a ordem muda.
- **Defeito visto e não corrigido na C4:** no celular deitado baixo (Fold fechado, 920×316), os botões de "Tamanho da
  interface" no ⚙ não cabem e "Grande" fica cortado. Já era assim antes.
- **C5 (18/11/2026):** o que o código sabe de cada mapa está em `src/core/mapsConfig.ts` (`MAPS_CONFIG`): mapas
  carregados, quais são cidade, música, tipo de árvore, enfeites na grama, arena do chefe (braseiros) e por onde o Auto
  sai quando não há portal direto para a cidade (`autoExitVia`, ruínas → floresta). `HOME_MAP` é onde o personagem começa
  e renasce. O campo `map` das músicas saiu do `audio.json`. **Mapa novo = JSON gerado + uma entrada no `MAPS_CONFIG`.**
  Conferido: mesmos enfeites, braseiros e música em cada mapa, e simulador idêntico.
- **C6 (18/11/2026):** a reação aos eventos do mundo (textos que sobem, toasts, golpes, flechas, brilho de drop, efeitos
  de skill) saiu da `GameScene` para `src/render/eventFeedback.ts` (`EventFeedback`), com uma função por grupo: combate,
  skills, recompensas e avisos. A cena ficou com 426 linhas (eram 694). `skillById()` em `core/skills.ts` substitui as
  buscas repetidas, e `TEXT_RES` foi para `render/display.ts`. Conferido disparando os 33 tipos de evento: mesmo resultado.
- **C7 (18/11/2026):** o `World` (1.841 linhas) virou fachada (~1.270) e o corpo de cada assunto foi para
  `src/core/world/`: `inventory.ts`, `shop.ts`, `quests.ts`, `boss.ts`, `npcs.ts`, `offlineApply.ts`, `saveCodec.ts`
  (e `geometry.ts` com `dist`). São funções que recebem o `World` como `w`; **o `World` continua com os mesmos métodos**
  (só repassam), então UI, Auto e testes não mudaram. Os corpos foram movidos sem mudança, e o simulador deu saída
  idêntica em cada passo (mesma ordem de sorteios). Campos que os módulos precisam deixaram de ser `private` e estão
  agrupados como "estado interno"; métodos internos têm comentário. `pf` → `findPathFor`; `quest` declarado com os campos.
  **Regras devolvem códigos de erro** (`ActionError` em `core/types.ts`: `noGold`, `bagFull`, `needLevel`, `sectOnly`…)
  e a interface traduz em `src/ui/actionError.ts` (mesmos textos de antes).
- **C8 (18/11/2026):** versões do save com nome, em `src/core/saveFormat.ts`. `SAVE_FILE_VERSION = 2` é o arquivo
  inteiro (4 espaços); `CHARACTER_SAVE_VERSION = 1` é um personagem (`SaveData`). Ao carregar, cada personagem passa
  por `migrateCharacter`, que aplica em ordem as funções de `CHARACTER_MIGRATIONS` (hoje vazia: nada muda nos saves
  atuais). Save sem versão conta como 1; save de versão mais nova (app mais novo em outro aparelho) não é mexido.
  **Regra:** campo novo opcional não precisa de versão (a leitura corrige o que falta); campo que muda de sentido,
  nome ou formato sobe `CHARACTER_SAVE_VERSION` e ganha uma migração. Necessário antes do marco online.

**Fase C concluída em 18/11/2026** (C1–C8). Próxima: Fase D (preparação para as lojas), quando o Lucas pedir.

**Fase D (preparação para as lojas)** — iniciada em 18/11/2026.
- **D1 (18/11/2026):** camada de plataforma em `src/platform/`: único lugar do código que sabe se o jogo roda no
  navegador ou no app das lojas (`isNative`). Hoje só existe a implementação web, igual ao comportamento anterior:
  save (`storage.ts`, IndexedDB), preferências (`prefs.ts`), segundo plano (`lifecycle.ts`: `onPause`/`onResume`),
  voltar (`backButton.ts`, usa `backGuard.ts`), `isTouch` (`input.ts`), `restartApp()` e `registerServiceWorker()`
  (`index.ts`, o service worker não é registrado no nativo), vibração (`haptics.ts`, vazia) e compras (`purchases.ts`,
  vazia). **Regra:** `localStorage`, `idb-keyval`, `location.reload`, `serviceWorker` e eventos de ciclo de vida só
  dentro de `src/platform/`. A implementação nativa (Capacitor) entra na D2 nesses mesmos arquivos.
- **D2 (18/11/2026):** app Android com **Capacitor 8** (`capacitor.config.ts`, guia em `docs/android.md`).
  - **APK de teste gerado pelo GitHub Actions** em todo PR (`.github/workflows/android.yml`), decidido pelo Lucas:
    o ambiente de desenvolvimento não baixa o Android SDK.
  - ~~**appId provisório** `io.github.flushin.wanderers` e nome "Wanderers"~~ (resolvido: **Mistpeak**, appId
    `io.github.flushin.mistpeak`; ver "Nome do jogo"). Texto original: em espera, o Lucas pode mudar o nome
    do jogo. Decidir antes do primeiro envio à Play Store (depois disso o appId nunca muda).
  - A pasta `android/` é gerada na hora (`npm run android:prepare`) e não fica no repositório, para o appId ficar
    num lugar só; passa a ser versionada quando precisar de arquivos nativos próprios (D7).
  - Implementações nativas em `src/platform/`: save em arquivo JSON (gravação atômica + 1 backup), pause/resume e
    botão Voltar pelo `@capacitor/app`, barra de status escondida, vibração pelo `@capacitor/haptics` (ainda sem uso).
  - Licenças do Capacitor (MIT) na tela de créditos e em `docs/licencas/`.
- **D3 (18/11/2026):** botão/gesto de voltar fecha a janela de cima (Sair do jogo? → créditos → report → ⚙ → resumo
  offline → dica → janelas do HUD), em `src/ui/backAction.ts`. Sem janela aberta: no app Android aparece **"Sair do
  jogo?"** (salva antes de fechar); na web/PWA continua o aviso + segundo voltar para sair. Também vale na web: antes
  o voltar com uma janela aberta mostrava o aviso de saída em vez de fechá-la.
- **D4 (18/11/2026):** telas cheias (`#create`, `#loading`, `#bigmap`, painéis, créditos, report, offline) respeitam
  o notch e os cantos arredondados (`max(12px, env(safe-area-inset-*))`). Sem notch, igual a antes.
- **D5 (18/11/2026):** **ganho offline ao voltar do segundo plano** (P3): se o jogo ficou fora da tela 5 min ou mais
  (`RESUME_OFFLINE_MIN_MS` em `core/offline.ts`) com o auto ligado, aplica o mesmo cálculo de quando o jogo abre
  (`World.applyResumeOffline`) e mostra o resumo; o auto espera o resumo ser fechado. Vale no app e na web (aba escondida).
- **D6 (18/11/2026):** memória. As folhas de personagens e monstros (as imagens mais pesadas) são carregadas **por
  mapa** (`src/render/sheetLoader.ts`): ficam só a seita do jogador e quem aparece no mapa (monstros, invocação do
  chefe, NPCs); as do mapa anterior são liberadas. Na troca de mapa o jogo espera as folhas chegarem (fração de
  segundo; nada anda nesse meio-tempo). Medido no navegador: folhas na memória de ~81 MB (todas) para 27–33 MB por
  mapa. Cenários, pisos e ícones continuam carregados no início. No APK vão só os sons `.ogg` (−1,8 MB;
  `tools/android-trim-audio.mjs`).
- **D8 (18/11/2026):** política de privacidade PT/EN em `public/privacidade.html` (publicada em
  `https://flushin.github.io/rpg-wuxia/privacidade.html`), com link na tela inicial e em ⚙ (no app abre no navegador do
  celular). Declara o report de bug pelo Web3Forms (P10) com a lista exata do que é enviado. Respostas do Data Safety
  (Play) e das privacy labels (Apple) e rascunho da descrição da loja em `docs/lojas.md`.
  **Pendente com o Lucas:** e-mail de contato (a Play exige; `TODO` na página) e público-alvo (a página diz que o
  jogo não é direcionado a crianças).

**Fase D concluída em 18/11/2026** (D1–D8). Pendências antes da Play Store: ver "Pendências das auditorias (18/11/2026)" logo abaixo.
- **D7 (18/11/2026):** ícone e tela de abertura do app gerados de `assets/` (`tools/icons/make_app_icons.py` →
  `@capacitor/assets`). Versão do app lida do `package.json`: `versionCode = MAJOR*10000 + MINOR*100 + PATCH`
  (`tools/android-version.mjs`). **Regra:** subir a `version` do `package.json` antes de cada envio à loja.

**Pendências das auditorias (18/11/2026, antes do marco 9).** Decidido pelo Lucas em 18/11/2026:
- **Monetização:** a **1ª versão sai sem anúncios e sem compras** (substitui a resposta de 17/11/2026 na auditoria de
  direitos, que previa anúncio com recompensa + diamantes). A política de privacidade e o Data Safety continuam dizendo
  "sem anúncios". A monetização foi para "Melhorias — Futuro".
- **E-mail de contato:** será criado um e-mail só do jogo (não o pessoal); o `TODO` em `public/privacidade.html` fica
  até lá.
- **Tarefas de loja fora do código ficam para depois de todos os marcos:** busca de marca "Mistpeak" (INPI/USPTO/EUIPO),
  conta no Play Console e verificação de identidade, chave de assinatura, teste fechado (12 testadores por 14 dias),
  provas de licença que faltam baixar (`docs/licencas/README.md`), imagens da loja, revisão por advogado, conferir a
  lista exata de bibliotecas do APK com o Gradle. O público-alvo continua **13+** (resposta de 17/11/2026).
- **Feito no PR desta data:** bibliotecas nativas do APK (AndroidX, Apache Cordova, ionfilesystem, Kotlin) na tela de
  créditos e em `docs/licencas/`; `tools/sprites/fetch-assets.sh` com os espelhos fixados por commit e cada modelo
  conferido por SHA-256 (`tools/sprites/models.sha256`), aceitando os pacotes oficiais para provar que são iguais;
  rascunho do questionário de classificação indicativa (IARC) em `docs/lojas.md`; tabela "Números atuais" em
  `docs/balanceamento.md`; `AUDITORIA.md` e `AUDITORIA_DIREITOS.md` atualizados.

