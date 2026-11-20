# Provas de licença

Cópias das licenças dos assets e das bibliotecas de terceiros usados no jogo, guardadas como prova de origem.
Esta pasta não vai para o site nem para o app (só `public/` e o build são publicados).
O que o jogador vê fica em `public/audio/CREDITS.txt`, `public/sprites/CREDITS.txt` e, no futuro, na tela de créditos.

Regra: todo asset ou biblioteca nova entra aqui com a licença **baixada da fonte**, a data e o link.
Não escreva uma licença de memória e não copie de outro pacote: se não conseguir baixar, anote em "Falta guardar".

## Arquivos guardados (obtidos em 17/11/2026)

| Arquivo | O que prova | Usado em | Fonte de onde foi baixado | SHA-256 (primeiros 12) |
|---|---|---|---|---|
| `kaykit-adventurers-1.0-LICENSE.txt` | KayKit Adventurers Character Pack 1.0 (Kay Lousberg) é **CC0** | Tormenta, Geada, NPCs, bandidos, terracota, General (`public/sprites/`) | `https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/LICENSE.txt` (repositório oficial, o mesmo de `tools/sprites/fetch-assets.sh`) | `ae3221418140` |
| `quaternius-espelho-trebeljahr-LICENSES.md` | Ultimate Animated Animal Pack (Quaternius) é **CC0** upstream | Lobo (`public/sprites/lobo.*`) | `https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/LICENSES.md` — **espelho não oficial** (o mesmo de `fetch-assets.sh`); aponta para a página oficial `https://quaternius.com/packs/ultimateanimatedanimals.html` | `a59ca1463ae0` |
| `kenney-ui-audio-LICENSE.txt` | Kenney UI Audio ("UI SFX Set", Kenney Vleugels) é **CC0** | `action_click` (= click1; era `ui_click`), `coin` (= click3; era `point_spent`), `quest_ready` (= rollover3; era `tip`) em `public/audio/sfx/` | `https://github.com/Calinou/kenney-ui-audio`, commit `8c3d81b9159d058c444f89d12d518276b0b09345`, arquivo `addons/kenney_ui_audio/LICENSE.txt` (cópia do pacote original, sem alteração) | `4f88ab3c885c` |
| `CC0-1.0.txt` | Texto legal completo da CC0 1.0 Universal (todos os assets acima) | — | SPDX: `https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC0-1.0.txt` | `a2010f343487` |
| `phaser-3.90.0-LICENSE.md` | Phaser 3.90.0 — **MIT**, © 2024 Richard Davey, Phaser Studio Inc. | Motor do jogo (vai no bundle) | Pacote npm `phaser@3.90.0` (`npm pack`) | `080f3d5539e7` |
| `eventemitter3-5.0.4-LICENSE.txt` | eventemitter3 5.0.4 — **MIT**, © 2014 Arnout Kazemier | Dependência do Phaser (vai no bundle) | Pacote npm `eventemitter3@5.0.4` | `3aecc12b1cb2` |
| `idb-keyval-6.3.0-LICENCE.txt` | idb-keyval 6.3.0 — **Apache-2.0**, © 2016 Jake Archibald | Saves no IndexedDB (vai no bundle) | Pacote npm `idb-keyval@6.3.0` (o pacote não tem arquivo NOTICE) | `20c27d633961` |
| `Apache-2.0.txt` | Texto completo da Apache License 2.0 (o arquivo do idb-keyval só traz o cabeçalho) | idb-keyval | SPDX: `https://raw.githubusercontent.com/spdx/license-list-data/main/text/Apache-2.0.txt` | `074e6e32c86a` |
| `capacitor-8.6.2-LICENSE.txt` | Capacitor 8.6.2 (`@capacitor/core` e `@capacitor/android`) — **MIT**, © 2017-present Drifty Co. | App das lojas: ponte entre o jogo e o Android (core vai no bundle; android vai no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/core@8.6.2` (o de `@capacitor/android@8.6.2` é idêntico) | `9c6ebf3e5ab8` |
| `capacitor-plugins-app-haptics-status-bar-LICENSE.txt` | `@capacitor/app` 8.1.2, `@capacitor/haptics` 8.0.2, `@capacitor/status-bar` 8.0.4 — **MIT**, © 2020-present Ionic | App das lojas (vão no bundle e no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/app@8.1.2` (os outros dois são idênticos) | `de884404585e` |
| `capacitor-filesystem-8.1.5-LICENSE.txt` | `@capacitor/filesystem` 8.1.5 — **MIT**, © 2025 Ionic | Save em arquivo no app (vai no bundle e no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/filesystem@8.1.5` | `e8f989836e88` |
| `ionfilesystem-android-1.1.1-LICENSE.txt` | `io.ionic.libs:ionfilesystem-android` 1.1.1 — **MIT**, © 2025 Ionic | Puxada pelo `@capacitor/filesystem` (vai no APK). Obtido em 18/11/2026 | `https://raw.githubusercontent.com/ionic-team/ion-android-filesystem/1.1.1/LICENSE` (o POM no Maven Central aponta para esse arquivo) | `de884404585e` |
| `cordova-android-14.0.1-NOTICE.txt` | `org.apache.cordova:framework` 14.0.1 — **Apache-2.0** (POM no Maven Central), com o NOTICE exigido pela licença | Puxada pelo `@capacitor/android` (vai no APK). Obtido em 18/11/2026; texto da licença: `Apache-2.0.txt` | `https://raw.githubusercontent.com/apache/cordova-android/rel/14.0.1/NOTICE` | `e94707080ab2` |

### Sons de combate (verificados em 20/11/2026)

Licença conferida na página de origem (OpenGameArt: campo "License(s)"; Wikimedia Commons: caixa de licença). Texto legal: `CC0-1.0.txt`.

| Arquivo do jogo (`public/audio/sfx/`) | Origem | Autor | Licença na página |
|---|---|---|---|
| `hit` | `https://opengameart.org/content/machete-vs-spatula` (machete_vs_spatula_7.wav) | CYBERDEViL | CC0 |
| `crit` | `https://opengameart.org/content/blacksmiths-hammer` (blacksmithhammer_0.mp3) | VishwaJai | CC0 |
| `miss` | `https://opengameart.org/content/various-sound-effects-0` (snd_throw1.wav) | Spring Spring | CC0 |
| `spell` | `https://opengameart.org/content/magic-spell-sfx` (magical_6_0.ogg) | JaggedStone | CC0 |
| `monster_death` | `https://opengameart.org/content/slimy-monster-or-murder-sounds9` (slimy_monster_or_murderd_sound_3.mp3) | pauliuw | CC0 |
| `player_death` | `https://commons.wikimedia.org/wiki/File:Gong55.ogg` | stephan | CC0 |

### Ataque de cada monstro (verificados em 20/11/2026)

Licença conferida na página de cada som no Freesound (link da licença `publicdomain/zero/1.0`). Texto legal: `CC0-1.0.txt`.

| Arquivo do jogo (`public/audio/sfx/`) | Monstro | Origem | Autor | Licença na página |
|---|---|---|---|---|
| `atk_lobo` | Lobo | `https://freesound.org/people/Mrthenoronha/sounds/420449/` | Mrthenoronha | CC0 |
| `atk_bandido` | Bandidos de espada (e reserva monster_attack) | `https://freesound.org/people/GaussTheWizard/sounds/367182/` | GaussTheWizard | CC0 |
| `atk_arqueiro` | Arqueiros | `https://freesound.org/people/Ali_6868/sounds/384919/` | Ali_6868 | CC0 |
| `atk_pedra` | Terracota/pedra | `https://freesound.org/people/CamoMano/sounds/431019/` | CamoMano | CC0 |
| `atk_espectro` | Espectros | `https://freesound.org/people/LilMati/sounds/519438/` | LilMati | CC0 |
| `atk_yeti` | Yeti | `https://freesound.org/people/Christopherderp/sounds/342204/` | Christopherderp | CC0 |
| `atk_monge` | Monges caídos | `https://freesound.org/people/Sadiquecat/sounds/786323/` | Sadiquecat | CC0 |
| `atk_assassino` | Assassino das Sombras | `https://freesound.org/people/erkanozan/sounds/51755/` | erkanozan | CC0 |
| `atk_serpente` | Serpente de Jade | `https://freesound.org/people/TheKingOfGeeks360/sounds/846337/` | TheKingOfGeeks360 | CC0 |
| `atk_grou` | Grou Espiritual | `https://freesound.org/people/qubodup/sounds/60013/` | qubodup | CC0 |
| `atk_jade` | Guardião de Jade | `https://freesound.org/people/mark205/sounds/580649/` | mark205 | CC0 |
| `atk_general` | General de Terracota | `https://freesound.org/people/AudioPapkin/sounds/541029/` | AudioPapkin | CC0 |
| `atk_abade` | Abade Caído | `https://freesound.org/people/Nightflame/sounds/422513/` | Nightflame | CC0 |
| `atk_yeti_ancestral` | Yeti Ancestral | `https://freesound.org/people/el_boss/sounds/751713/` | el_boss | CC0 |
| `atk_patriarca` | Patriarca Profanado | `https://freesound.org/people/LilMati/sounds/659762/` | LilMati | CC0 |
| `atk_rei_bandidos` | Rei dos Bandidos | `https://freesound.org/people/julianmateo_/sounds/522701/` | julianmateo_ | CC0 |
| `atk_senhor_nevoa` | Senhor da Névoa | `https://freesound.org/people/PrdiChlp/sounds/181889/` | PrdiChlp | CC0 |

### Progressão (verificados em 20/11/2026)

Licença conferida na página de cada som no Freesound (link `publicdomain/zero/1.0`). Texto legal: `CC0-1.0.txt`.

| Arquivo do jogo (`public/audio/sfx/`) | Origem | Autor | Licença na página |
|---|---|---|---|
| `level_up` (mistura, parte 1) | `https://freesound.org/people/qubodup/sounds/161654/` | qubodup | CC0 |
| `level_up` (mistura, parte 2) | `https://freesound.org/people/Breviceps/sounds/444491/` | Breviceps | CC0 |
| `point_spent` | `https://freesound.org/people/hollandm/sounds/692828/` | hollandm | CC0 |

### Interface (verificados em 20/11/2026)

Licença conferida na página de cada som no Freesound (link `publicdomain/zero/1.0`). Texto legal: `CC0-1.0.txt`.

| Arquivo do jogo (`public/audio/sfx/`) | Origem | Autor | Licença na página |
|---|---|---|---|
| `ui_click` | `https://freesound.org/people/NenadSimic/sounds/268108/` | NenadSimic | CC0 |
| `ui_open` | `https://freesound.org/people/LilMati/sounds/397548/` | LilMati | CC0 |
| `ui_close` | `https://freesound.org/people/tia666/sounds/156927/` | tia666 | CC0 |
| `tip` | `https://freesound.org/people/marcusgar/sounds/360948/` | marcusgar | CC0 |
| `portal` | `https://freesound.org/people/LilMati/sounds/441225/` | LilMati | CC0 |

### Músicas (verificadas em 20/11/2026)

Licença conferida no campo "License(s)" da página do OpenGameArt. Texto legal: `CC0-1.0.txt`.

| Arquivo do jogo (`public/audio/music/`) | Origem | Autor | Licença na página |
|---|---|---|---|
| `cidade` | `https://opengameart.org/content/hot-springs-town` (hot_spring_town.flac) | Kistol | CC0 |
| `floresta` | `https://opengameart.org/content/bamboo-blitz` (bamboo_blitz_solo.flac) | Tsorthan Grove | CC0 |

Para conferir se um arquivo não mudou: `sha256sum docs/licencas/*`.

## Bibliotecas nativas do APK (Android)

Levantadas em 18/11/2026 nos `build.gradle` do `@capacitor/android` 8.6.2, dos plugins e do modelo de app do
`@capacitor/cli` (a pasta `android/` é gerada na hora). Todas aparecem na tela de créditos (`src/ui/credits.ts`).

| Biblioteca | Versão | Licença | Quem puxa | Prova |
|---|---|---|---|---|
| AndroidX appcompat, core, core-splashscreen, activity, fragment, coordinatorlayout, webkit | 1.7.1, 1.17.0, 1.2.0, 1.11.0, 1.8.9, 1.3.0, 1.14.0 | Apache-2.0 | Capacitor e modelo de app | `Apache-2.0.txt` (sem NOTICE nos pacotes) |
| Apache Cordova Android (`org.apache.cordova:framework`) | 14.0.1 | Apache-2.0 | `@capacitor/android` | `cordova-android-14.0.1-NOTICE.txt` + `Apache-2.0.txt` |
| ionfilesystem-android | 1.1.1 | MIT | `@capacitor/filesystem` | `ionfilesystem-android-1.1.1-LICENSE.txt` |
| Kotlin stdlib, kotlinx-coroutines-core | ~2.2, 1.10.2 | Apache-2.0 (POM no Maven Central; os .jar não têm NOTICE) | `@capacitor/filesystem` | `Apache-2.0.txt` |

As dependências transitivas das bibliotecas AndroidX (lifecycle, savedstate, collection, annotation…) também são
Apache-2.0, sem NOTICE, e ficam cobertas pela entrada "AndroidX" dos créditos. Ao subir a versão do Capacitor ou
de um plugin, refazer esta tabela.

## Falta guardar

Não deu para baixar desta sessão, porque `kenney.nl`, `opengameart.org` e `quaternius.com` estavam bloqueados na rede.
Baixe no seu computador e coloque aqui:

| O que | Onde conseguir | Nome sugerido |
|---|---|---|
| License.txt do **Kenney Nature Kit** (árvores, pedras, plantas, cerejeiras) | Download do pacote em `https://kenney.nl/assets/nature-kit` (o espelho usado no `fetch-assets.sh` não tem a licença do Nature Kit) | `kenney-nature-kit-License.txt` |
| License.txt do **Kenney RPG Audio** | `https://kenney.nl/assets/rpg-audio` | `kenney-rpg-audio-License.txt` |
| License.txt do **Kenney Impact Sounds** | `https://kenney.nl/assets/impact-sounds` | `kenney-impact-sounds-License.txt` |
| Página oficial do **Quaternius Ultimate Animated Animals** (CC0) | `https://quaternius.com/packs/ultimateanimatedanimals.html` → print/PDF | `quaternius-animals.pdf` |
| Os **arquivos originais das duas músicas**, que você guarda | Guardar aqui ou num lugar fora do repositório com backup (são ~5 MB). Se ficarem fora, anote onde | — |

| Lista exata das dependências do APK (com as transitivas) | Rodar `./gradlew app:dependencies --configuration releaseRuntimeClasspath` na pasta `android/` (precisa do Android SDK; não roda nesta sessão). Conferir com a tabela "Bibliotecas nativas do APK" | — |
| POMs das bibliotecas AndroidX (licença Apache-2.0) | `https://maven.google.com` (bloqueado nesta sessão) | — |

Se um dia entrar SDK de anúncios ou Billing, guarde também as licenças deles aqui.
