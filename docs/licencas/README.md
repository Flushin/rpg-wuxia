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
| `kenney-ui-audio-LICENSE.txt` | Kenney UI Audio ("UI SFX Set", Kenney Vleugels) é **CC0** | `ui_click` (= click1), `point_spent` (= click3), `tip` (= rollover3) em `public/audio/sfx/` | `https://github.com/Calinou/kenney-ui-audio`, commit `8c3d81b9159d058c444f89d12d518276b0b09345`, arquivo `addons/kenney_ui_audio/LICENSE.txt` (cópia do pacote original, sem alteração) | `4f88ab3c885c` |
| `CC0-1.0.txt` | Texto legal completo da CC0 1.0 Universal (todos os assets acima) | — | SPDX: `https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC0-1.0.txt` | `a2010f343487` |
| `phaser-3.90.0-LICENSE.md` | Phaser 3.90.0 — **MIT**, © 2024 Richard Davey, Phaser Studio Inc. | Motor do jogo (vai no bundle) | Pacote npm `phaser@3.90.0` (`npm pack`) | `080f3d5539e7` |
| `eventemitter3-5.0.4-LICENSE.txt` | eventemitter3 5.0.4 — **MIT**, © 2014 Arnout Kazemier | Dependência do Phaser (vai no bundle) | Pacote npm `eventemitter3@5.0.4` | `3aecc12b1cb2` |
| `idb-keyval-6.3.0-LICENCE.txt` | idb-keyval 6.3.0 — **Apache-2.0**, © 2016 Jake Archibald | Saves no IndexedDB (vai no bundle) | Pacote npm `idb-keyval@6.3.0` (o pacote não tem arquivo NOTICE) | `20c27d633961` |
| `Apache-2.0.txt` | Texto completo da Apache License 2.0 (o arquivo do idb-keyval só traz o cabeçalho) | idb-keyval | SPDX: `https://raw.githubusercontent.com/spdx/license-list-data/main/text/Apache-2.0.txt` | `074e6e32c86a` |
| `capacitor-8.6.2-LICENSE.txt` | Capacitor 8.6.2 (`@capacitor/core` e `@capacitor/android`) — **MIT**, © 2017-present Drifty Co. | App das lojas: ponte entre o jogo e o Android (core vai no bundle; android vai no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/core@8.6.2` (o de `@capacitor/android@8.6.2` é idêntico) | `9c6ebf3e5ab8` |
| `capacitor-plugins-app-haptics-status-bar-LICENSE.txt` | `@capacitor/app` 8.1.2, `@capacitor/haptics` 8.0.2, `@capacitor/status-bar` 8.0.4 — **MIT**, © 2020-present Ionic | App das lojas (vão no bundle e no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/app@8.1.2` (os outros dois são idênticos) | `de884404585e` |
| `capacitor-filesystem-8.1.5-LICENSE.txt` | `@capacitor/filesystem` 8.1.5 — **MIT**, © 2025 Ionic | Save em arquivo no app (vai no bundle e no APK). Obtido em 18/11/2026 | Pacote npm `@capacitor/filesystem@8.1.5` | `e8f989836e88` |

Para conferir se um arquivo não mudou: `sha256sum docs/licencas/*`.

## Falta guardar

Não deu para baixar desta sessão, porque `kenney.nl`, `opengameart.org` e `quaternius.com` estavam bloqueados na rede.
Baixe no seu computador e coloque aqui:

| O que | Onde conseguir | Nome sugerido |
|---|---|---|
| License.txt do **Kenney Nature Kit** (árvores, pedras, plantas, cerejeiras) | Download do pacote em `https://kenney.nl/assets/nature-kit` (o espelho usado no `fetch-assets.sh` não tem a licença do Nature Kit) | `kenney-nature-kit-License.txt` |
| License.txt do **Kenney RPG Audio** | `https://kenney.nl/assets/rpg-audio` | `kenney-rpg-audio-License.txt` |
| License.txt do **Kenney Impact Sounds** | `https://kenney.nl/assets/impact-sounds` | `kenney-impact-sounds-License.txt` |
| Página do OpenGameArt de **"Oriental"** (Shadowfire452), mostrando "License(s): CC0" | `https://opengameart.org/node/15485` → salvar como PDF/print e criar uma cópia em `https://web.archive.org/save` | `oga-15485-oriental.pdf` + link do Wayback |
| Página do OpenGameArt de **"Asian/Oriental 1"** (Tozan) | `https://opengameart.org/content/asianoriental1` → idem | `oga-asianoriental1.pdf` + link do Wayback |
| Página oficial do **Quaternius Ultimate Animated Animals** (CC0) | `https://quaternius.com/packs/ultimateanimatedanimals.html` → print/PDF | `quaternius-animals.pdf` |
| Os **arquivos originais das duas músicas**, que você guarda | Guardar aqui ou num lugar fora do repositório com backup (são ~5 MB). Se ficarem fora, anote onde | — |

Quando o Capacitor e o SDK de anúncios/Billing entrarem, guarde também as licenças deles (MIT/Apache-2.0) aqui.
