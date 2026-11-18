# 01 · Inventário do que já existe

> Análise feita em 18/11/2026 lendo o código, os dados, as ferramentas, a CI e os documentos do repositório.
> Neste trabalho nenhum código foi alterado. Conferido na hora: `npm run typecheck` ✅, `npm test` ✅
> (9 suítes, 763 verificações) e `npm run build` ✅ (JS de 1,8 MB, 455 KB gzip). O `check:layout` e o
> `sim:balance` não foram rodados, porque precisam de navegador ou demoram.

## Contexto do jogo (deduzido do código e confirmado pelo Lucas)

| Item | Valor |
| --- | --- |
| **Nome** | Mistpeak (na loja: "Mistpeak: Idle RPG"); appId `io.github.flushin.mistpeak`, já em `capacitor.config.ts` |
| **Gênero/estilo** | ARPG isométrico wuxia com combate tab-target, **auto-combate e ganho offline** (inspiração: Dragon Oath). Hoje é **single-player**. |
| **Plataforma** | Web/PWA (GitHub Pages) e Android (Capacitor 8, com APK de teste gerado na CI). iOS só como PWA por enquanto. |
| **Público-alvo** | Casual PvE mobile: sessões curtas, Auto e ganho offline como pilares, PvP opcional e tardio. |
| **Time** | Solo dev (Lucas), **sem experiência de lançar jogos ou apps nas lojas**. A IA faz quase tudo (código, arte por script, testes, documentação, textos de loja); o Lucas decide, testa jogando e cuida do que exige uma pessoa (contas, identidade, pagamentos, assinaturas). |
| **Monetização** | A v1 sai grátis, sem anúncios e sem compras. F2P (anúncio com recompensa e diamantes/cosméticos) fica para o pós-lançamento. |
| **Modelo online alvo** | **Online assíncrono:** conta e save na nuvem com servidor validando, ranking, guilda/chat e mercado entre jogadores, mas cada jogador no seu próprio mundo. Sem mundo compartilhado em tempo real. |
| **Tamanho** | ~12,3 mil linhas de TS em `src/`, ~3,2 mil de CSS, ~13 mil linhas em `tools/` (testes, simulador, robô do caos, geradores) |
| **Conteúdo** | 4 seitas, 20 skills (4 ativas + 1 passiva por seita), 4 mapas, 9 tipos de monstro (2 chefes), 36 bases de equipamento, 3 raridades, 3 materiais, 14 missões, 13 NPCs, nível máximo 20 (~3 h de jogo ativo do 1 ao 20) |

Legenda de status: **Completa** (funciona e tem teste ou uso confirmado) · **Parcial** (funciona, mas falta parte importante) ·
**Esboço** (placeholder, interface vazia ou só texto).

---

## 1. Personagem

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Criação e escolha de personagem | Tela inicial com 4 espaços (nome, seita, nível, mapa, último acesso). Cada seita é apresentada pelo seu mestre. Apagar exige digitar o nome. | `src/ui/create.ts`, `src/scenes/createScene.ts`, `src/save.ts`, `src/core/saves.ts` | Completa | Não há aparência customizável (rosto, cor, gênero): o visual é fixo por seita. |
| 4 seitas (classes) | Tormenta (lâmina, trovão), Geada (leque, gelo, à distância), Titã (bastão, fogo, tanque) e Víbora (agulhas, veneno, à distância). | `src/data/classes.json`, `src/data/sprites/*.json` | Completa | Os ids internos antigos (`lamina`, `pavilhao`) ficam por compatibilidade com o save. |
| Atributos | 5 atributos (Força, Inteligência, Vigor, Agilidade, Vontade). Por nível: 2 pontos automáticos e 3 livres, com "Distribuir recomendado" e decomposição base/níveis/equip. | `src/core/stats.ts`, `src/core/distribute.ts`, `src/ui/attrsPanel.ts` | Completa | Os coeficientes de stats derivados estão no código (`stats.ts`), não no JSON. Não há reset de atributos (respec). |
| Progressão de nível | Do nível 1 ao 20, com curva de XP calibrada em simulador (~1 h até o 10, ~2 h do 10 ao 20). | `src/data/progression.json`, `src/core/world.ts` (`gainXp`) | Completa | O teto de 20 limita o tempo de vida do conteúdo (~3 h ativas). |
| Skills | 5 por seita: 4 ativas e 1 passiva, desbloqueadas nos níveis 1/3/5/7/9. Sobem de nível pelo uso (máx. 15, +8% por nível). Há hotbar e painel (K). | `src/core/skills.ts`, `src/data/skills.json`, `src/ui/hotbar.ts`, `src/ui/skillsPanel.ts` | Completa | Não existe árvore de talentos nem escolha de build: todos da mesma seita ficam iguais. |
| Elementos e status | Fogo, gelo, trovão e veneno. Lentidão, atordoar, escudo, veneno em tiques, regeneração e redução de defesa. | `src/core/types.ts` (`BuffKind`), `src/core/world.ts` (`tickBuffs`) | Completa | Resistência elemental por monstro ainda é simples (defesa física/espiritual). |
| Morte e penalidade | Volta à cidade e perde 10% da durabilidade máxima do equipamento. | `src/core/world.ts` (`onPlayerDeath`, `respawnPlayer`) | Completa | — |

## 2. Combate

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Combate tab-target | Seleção por toque/clique, Tab alterna, Espaço ataca o mais próximo. Acerto, erro e crítico, dano físico ou espiritual. | `src/core/combat.ts`, `src/core/world.ts` (`attack`), `src/ui/controls.ts` | Completa | O tick fixo de 1/60 s é determinístico com semente: boa base para um servidor validar depois. |
| **Auto-combate** | Escolhe alvos, usa skills e poções, foge de áreas marcadas, volta à vila para comprar poções e vender itens, e escolhe o mapa de caça pelo nível. | `src/core/auto.ts` (733 linhas), `src/ui/autoPanel.ts` | Completa | Diferencial central. A máquina de estados grande não tem diagrama (`visit`, `leaving`, `chase`, `ignore`). |
| **Ganho offline** | Usa o ritmo medido dos últimos ~30 min de Auto: 60% até 12 h, 40% até 18 h, 20% até 24 h. Vale ao abrir o jogo e ao voltar do segundo plano (5 min ou mais). | `src/core/offline.ts`, `src/core/world/offlineApply.ts` | Completa | Usa `Date.now()` do aparelho: quem adiantar o relógio ganha mais. Num jogo online, isso tem de ir para o servidor. |
| IA de monstros | Parado, passeando ou perseguindo, com aggro por distância. Arqueiro recua, o Espectro dá lentidão e o Yeti tem golpe em área marcado no chão. | `src/core/world.ts` (`tickMonster`, `aggro`) | Completa | Ainda está dentro do `World`. Um módulo `monsterAi` facilitaria o servidor. |
| Chefes | General de Terracota (nv 10, invoca guerreiros) e Abade Caído (nv 20, golpes marcados e invoca Discípulos), com arena, leash e renascimento por relógio. | `src/core/world/boss.ts`, `src/data/monsters.json` | Completa | Só 2 chefes. Não há mecânica de fase além de "metade da vida". |
| Dungeons/instâncias | Não existem. Os chefes ficam em arenas no mundo aberto. | — | Não existe | — |
| PvP | Não existe. | — | Não existe | — |
| Feedback visual e sonoro | Números flutuantes, efeitos por skill (raios, lâminas, gelo, névoa), sons, áreas de golpe marcadas no chão. | `src/render/skillFx.ts`, `src/render/eventFeedback.ts`, `src/render/audio.ts` | Completa | O módulo `haptics.ts` existe, mas não é usado em nenhum golpe (Esboço). |

## 3. Itens e economia

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Inventário | Mochila de 30 espaços, pilhas até 99, abas (Equipamento/Poções/Materiais), "Organizar" e retrato animado do personagem. | `src/core/world/inventory.ts`, `src/ui/inventory.ts` | Completa | Não há baú/banco nem expansão da mochila. |
| Equipamentos | 6 slots, 36 bases (níveis 1/5/10/15, arma por seita), durabilidade com desgaste e conserto. | `src/data/items.json`, `src/core/items.ts` | Completa | — |
| Raridade e bônus aleatórios | Comum, Incomum e Raro, com bônus sorteados de uma lista. | `src/core/items.ts` | Completa | Não há Épico/Lendário nem conjuntos com bônus de set. |
| Drops e coleta | Itens caem no chão por 60 s e o Auto coleta. O feed mostra o que entrou, com cor da raridade. | `src/core/world/inventory.ts`, `src/ui/rewards.ts` | Completa | — |
| Forja (crafting) | Melhorar de +1 a +10 com chance (falhar gasta os materiais e o ouro, mas o item não quebra nem volta de nível), subir raridade, trocar bônus e desmontar. | `src/core/world/forge.ts`, `src/ui/npcWindow.ts` | Completa | Não há coleta de recursos no mapa (mineração, ervas): os materiais vêm só de monstros. |
| Loja de NPC | Vendedor de poções (compra qualquer item), Ferreiro (conserto e forja) e Mercador Ambulante (estoque raro que renova a cada hora real). | `src/core/world/shop.ts`, `src/core/world/merchant.ts` | Completa | A renovação usa o relógio do aparelho (mesmo risco do offline). |
| Moeda | Só ouro (soft currency). | `src/core/world.ts` | Completa | Não há moeda premium (planejada: diamantes, no pós-lançamento). |
| Mercado/leilão e trocas | Não existem. | — | Não existe | Dependem de servidor e economia autoritativa. |
| Consumíveis | Poções de vida e mana (P/G), com Q/E e auto-uso por limite, e Pergaminho de Retorno. | `src/data/items.json` | Completa | — |

## 4. Mundo

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Mapas e zonas | 4 mapas: Vila das Nuvens (cidade), Floresta (lobos e bandidos), Ruínas de Terracota (terracota e General) e Montanha Nevada (espectros, yetis e o Abade no templo). | `public/maps/*.json`, `tools/gen-maps.mjs`, `src/core/mapsConfig.ts` | Completa | Os mapas são **gerados por script** (formato Tiled), não editados à mão: rápido para iterar, mas fazer conteúdo artesanal fica caro. |
| Portais e níveis mínimos | Portais entre mapas, e o portal norte só abre no nível 10. | `src/core/world.ts` (`checkPortals`) | Completa | — |
| Viagem rápida | Só o Pergaminho de Retorno (para a vila). Não há teleporte livre entre mapas. | `src/data/items.json` (`consumables`) | Parcial | Com 4 mapas, ainda não faz falta. |
| Minimapa e mapa grande | Minimapa com jogador, monstros, chefe, NPCs e portais. Mapa grande na tecla M. | `src/ui/minimap.ts` | Completa | — |
| Pathfinding | A* em grade, com áreas a evitar e clique no chão para andar. | `src/core/pathfinding.ts` | Completa | — |
| Renascimento de monstros | Relógio real por ponto de spawn, que continua contando fora do mapa e vai no save (corrige o exploit de trocar de mapa). | `src/core/world.ts` | Completa | — |
| NPCs e moradores | 13 NPCs com sprite e falas PT/EN; moradores andam pela praça. | `src/data/npcs.json`, `src/core/world/npcs.ts` | Completa | — |
| Eventos de mundo, clima, dia/noite | Não existem. | — | Não existe | — |
| Housing | Não existe. | — | Não existe | — |
| Música por zona | 2 faixas (cidade e floresta). Ruínas e Montanha herdam a que já está tocando. | `src/data/audio.json`, `public/audio/music/` | Parcial | Falta música para as Ruínas, a Montanha e os chefes. |

## 5. Missões e conteúdo

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Cadeia principal | 14 missões do nível 1 ao 20 (falar, matar, chegar), com "!" e "?" sobre os NPCs, rastreador no HUD e recompensas de XP, ouro e itens. | `src/data/quests.json`, `src/core/quests.ts`, `src/core/world/quests.ts`, `src/ui/questTracker.ts` | Completa | É linear: não há missões secundárias nem repetíveis. A história é curta (falas de NPC). |
| Diárias/semanais | Não existem. | — | Não existe | — |
| Conquistas e coleções | Não existem. | — | Não existe | — |
| Dicas contextuais | Dicas que aparecem ao jogar ("aprender jogando"); os mestres dão 3 dicas por seita. | `src/ui/tips.ts`, `src/data/tips.json` | Completa | Servem de onboarding leve. Não há tutorial guiado passo a passo. |

## 6. Social

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Chat, amigos, party, guilda, ranking, guerra de guildas | Nenhum desses existe. | — | Não existe | Todos dependem do backend online (Marco 10 do plano atual). |

## 7. Interface e qualidade de vida

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| HUD | Quadros do jogador e do alvo, barra de XP, ouro com "+N" e feed de itens. Há o "HUD Novo" no celular (joystick flutuante, arco de skills) e o Clássico. | `src/ui/hud.ts`, `src/ui/hudLayout.ts`, `src/styles/*.css` | Completa | Muito trabalho já investido em celular deitado, Fold e iPhone. O `check:layout` com Playwright cobre 7 tamanhos de tela. |
| Controles | PC: WASD, clique e atalhos. Celular: joystick flutuante, toque para mirar, pinça para zoom. | `src/ui/controls.ts`, `src/platform/input.ts` | Completa | — |
| Configurações | Volumes, idioma, tamanho da interface, FPS, filtro do feed, layout do HUD, créditos, privacidade e Reportar bug. | `src/ui/settingsPanel.ts` | Completa | Não há remapeamento de teclas. |
| Idiomas | PT e EN, com `check:i18n` garantindo que todas as chaves existem. | `src/core/i18n.ts`, `src/data/en.json` | Completa | — |
| Acessibilidade | Escala da UI (Auto/P/M/G), `aria-label` nos botões, bloqueio de zoom acidental do navegador. | `src/ui/uiScale.ts`, `src/ui/noBrowserZoom.ts` | Parcial | Não há modo daltônico, opção para reduzir efeitos/tremor nem tamanho de fonte independente. |
| Onboarding | Mestre da seita na criação, dicas contextuais e a primeira missão guiando. | `src/ui/tips.ts`, `src/data/quests.json` | Parcial | Não há tutorial interativo nem medição de onde o jogador desiste. |
| Botão Voltar (Android) e safe areas | Voltar fecha a janela de cima; "Sair do jogo?" aparece quando não há janela aberta. Notch e cantos respeitados. | `src/ui/backAction.ts`, `src/platform/backButton.ts` | Completa | — |
| Medição de desempenho | Contador de FPS (média e "pior 1%"); folhas de sprite carregadas por mapa (−60% de memória). | `src/ui/perf.ts`, `src/render/sheetLoader.ts` | Completa | O bundle JS tem 1,8 MB num arquivo só (Phaser ~1,2 MB). |

## 8. Infraestrutura

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Separação lógica × renderização | `src/core` não importa Phaser, UI nem render. O `World` roda com passo fixo e emite eventos. | `src/core/`, `src/scenes/gameScene.ts` | Completa | **É a maior vantagem para o online:** o mesmo core pode rodar em Node para validar ações no servidor. |
| Save local | IndexedDB na web; no app, arquivo JSON com gravação atômica e 1 backup. Leitura à prova de falha, versão explícita e migrações. | `src/save.ts`, `src/platform/storage.ts`, `src/core/saveFormat.ts`, `src/core/world/saveCodec.ts` | Completa | Fica só no aparelho: trocar de celular ou limpar dados perde tudo. |
| Camada de plataforma | Único ponto que sabe se o jogo roda na web ou no app: storage, prefs, ciclo de vida, voltar, haptics, compras. | `src/platform/` | Completa (compras e haptics: Esboço) | O `purchases.ts` é uma interface vazia de propósito. |
| Contas e login | Não existem. | — | Não existe | — |
| Servidor/backend | Não existe. O único envio de rede é o Reportar bug (Web3Forms, 250 envios por mês). | `src/ui/bugReport.ts` | Não existe | A chave do Web3Forms é pública por natureza: qualquer um pode lotar a cota mensal. |
| Anti-cheat | Não existe. O save é editável no aparelho e o relógio pode ser adiantado. | — | Não existe | Irrelevante no single-player, crítico quando houver ranking ou mercado. |
| Telemetria e analytics | Não existem (decisão de privacidade). Há só o report de bug manual, com FPS e erros. | `src/ui/bugReport.ts` | Esboço | Sem dados de retenção/funil, não dá para validar marcos de beta. |
| Testes automáticos | 9 suítes (`check:*`, 763 verificações): itens, auto, skills, i18n, M5, missões, respawn, balanceamento e M9. Rodam em todo PR e antes de publicar. | `tools/*-check.ts`, `.github/workflows/testes.yml`, `deploy.yml` | Completa | Os `tools/*.ts` não passam pelo `tsc` (o `tsconfig` inclui só `src/`). |
| Simulador de balanceamento | Bots jogam com Auto do 1 ao 20 com semente fixa. `npm run balance` aplica ajustes percentuais com histórico. | `tools/balance-sim.ts`, `tools/balance.ts`, `src/data/balance.json` | Completa | É raro um solo dev ter isso: acelera muito o ajuste de economia. |
| Robô do caos | Playwright que joga de forma bagunçada por horas (gira a tela, fecha o app, mexe no relógio). | `tools/chaos-bot.mjs`, `docs/robo-do-caos.md` | Completa | Manual (não roda na CI). |
| Publicação | GitHub Pages a cada push na `main` e APK Android de teste em todo PR. | `.github/workflows/deploy.yml`, `android.yml` | Completa | Ainda não há canal de beta separado da produção na web. |
| PWA/offline | Manifest, ícones e service worker (rede primeiro). | `public/manifest.webmanifest`, `public/sw.js` | Completa | — |
| Pipeline de arte | Modelos 3D CC0 renderizados no Blender em atlas 8 direções; ícones e mapas gerados por script, com checksum dos modelos. | `tools/sprites/`, `tools/gen-maps.mjs` | Completa | Escala bem para um solo dev, mas depende de haver modelo CC0 (o Yeti virou humanoide por falta de modelo). |
| Ferramentas de divulgação | Gravador de trailer a partir do próprio jogo. | `tools/trailer/` | Completa | — |

## 9. Retenção e monetização

| Funcionalidade | Descrição | Arquivos principais | Status | Observações técnicas |
| --- | --- | --- | --- | --- |
| Ganho offline/idle | Ver Combate. É o principal motivo hoje para o jogador voltar. | `src/core/offline.ts` | Completa | — |
| Mercador que renova por hora | Motivo leve para voltar ao jogo. | `src/core/world/merchant.ts` | Completa | — |
| Recompensa de login, battle pass, eventos sazonais, cosméticos | Nenhum desses existe. | — | Não existe | — |
| Compras (IAP) e anúncios | Interface vazia, decidido que ficam fora da v1. | `src/platform/purchases.ts` | Esboço | Exigem Google Play Billing, consentimento (UMP) e o save protegido no servidor. |
| Notificações push | Não existem (por exemplo, "seu Auto encheu a mochila" ou "o mercador renovou"). | — | Não existe | — |

---

## 10. Dívida técnica e riscos (consolidado)

| # | Risco | Onde | Impacto | Gravidade |
| --- | --- | --- | --- | --- |
| R1 | **Tudo confia no cliente.** Save, relógio e RNG ficam no aparelho. | `save.ts`, `offline.ts`, `merchant.ts`, `Date.now()` em 12 pontos | Bloqueia ranking, mercado, trocas e compras: quem editar o save ou o relógio ganha. | 🔴 Alta (para o online) |
| R2 | **Save só local**, sem nuvem. | `src/platform/storage.ts` | Trocar de celular ou desinstalar o app perde o progresso. Gera reviews ruins na loja. | 🔴 Alta |
| R3 | **Pouco conteúdo de fim de jogo.** No nível 20 não há o que fazer além de farmar o Abade e a forja. | `progression.json`, `quests.json` | Retenção D7/D30 baixa. | 🟠 Média-alta |
| R4 | **Sem telemetria.** | — | Impossível medir funil, retenção e onde o jogador trava. | 🟠 Média |
| R5 | **`World` ainda é o centro de tudo** (1.451 linhas, mesmo após dividir em 9 módulos). | `src/core/world.ts` | Toda feature passa por ele, e o servidor vai precisar de uma fatia "headless" bem definida. | 🟡 Média |
| R6 | **Bundle único de 1,8 MB** e 14 MB de assets. | `vite.config.ts`, `public/` | Primeiro carregamento lento em rede móvel ruim. | 🟡 Média |
| R7 | **Cota e chave pública do Web3Forms** no report de bug. | `src/ui/bugReport.ts` | Alguém pode lotar a cota e os reports reais deixam de chegar. | 🟢 Baixa |
| R8 | **Ferramentas fora do `tsc`.** | `tsconfig.json` | Teste quebrado só aparece ao rodar. | 🟢 Baixa |
| R9 | **Dependência de modelos CC0 para arte nova.** | `tools/sprites/` | Monstros temáticos (yeti, dragão) podem ficar genéricos. | 🟡 Média |
| R10 | **Pendências antes da loja:** e-mail de contato e busca de marca no INPI/USPTO/EUIPO (nome e appId já decididos). | `docs/decisoes-do-projeto.md` | O appId não pode mudar depois do primeiro envio à Play Store. | 🟠 Média |

### A confirmar
- Desempenho real em celulares de 2–3 GB de RAM com a Montanha (o D6 mediu 27–33 MB de folhas por mapa no navegador do PC).
- Se o `check:layout` continua passando com o HUD Novo nos 7 tamanhos (não foi rodado nesta análise).
- O comportamento do iOS instalado como PWA ao ficar dias sem abrir. O Safari pode limpar o IndexedDB depois de 7 dias sem uso,
  e o `navigator.storage.persist()`, recomendado na auditoria, não é chamado em nenhum lugar do código (conferido com grep).
