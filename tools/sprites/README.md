# Sprites (marco 6)

Personagens, monstros e objetos do cenário são **modelos 3D CC0** renderizados em sprites
isométricos pelo Blender, todos com a mesma câmera e a mesma luz (estilo coeso).
Créditos: `public/sprites/CREDITS.txt`.

## Gerar de novo

Precisa de **Python 3.13** (o Blender 5.x como módulo só funciona nessa versão):

```bash
python3.13 -m venv .venv-blender
.venv-blender/bin/pip install "bpy==5.2.4" numpy pillow   # Windows: .venv-blender\Scripts\pip  (o 5.3.0 trava no Linux: "InitGoogleLogging() twice")
PY=.venv-blender/bin/python tools/sprites/build.sh   # baixa os modelos na 1ª vez (fetch-assets.sh)
```

Leva menos de 1 minuto (Cycles na CPU). Os modelos baixados ficam em `tools/sprites/.cache` (fora do git).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `render_sprites.py` | Personagem/monstro animado → atlas `public/sprites/<nome>.png/.json` + `src/data/sprites/<nome>.json` (animações, âncora, altura) |
| `render_props.py` | Objetos parados (árvores, pedras…) → atlas `public/sprites/floresta.*` com o ponto do chão (pivot) |
| `render_town.py` | Cidade: casas wuxia, portão, lanternas, estandartes, incensário… gerados por script + cerejeiras → `public/sprites/cidade.*` |
| `render_cidadela.py` | Cidadela de Jade: casas de dois andares com telhado de jade, salão, pagode, muralha (trechos, torres, portões), colunas e lanternas duplas, com as peças de `render_town.py` → `public/sprites/cidadela.*` (no mapa: prop `atlas: 'cidadela'`) |
| `render_ruins.py` | Ruínas e portais: colunas de pedra, entulho, cacos, braseiros e a porta-lua do portal → `public/sprites/ruinas.*` |
| `ground_tiles.py` | Pisos 2D (grama, caminho, lajotas da praça e das ruínas, 3 quadros de água, neve e lago congelado) → `public/sprites/pisos.png` |
| `icons.py` | Ícones de itens e skills (2D, por script) → `public/sprites/icones.png` + `src/data/sprites/icones.json` |
| `portrait_dirs` (em `tormenta`, `geada`, `tita`, `vibora` e skins) | Retrato das 8 direções em alta resolução (`<nome>_retrato_dirs.png`) para girar o personagem na janela Personagem, na loja de trajes e em tela cheia. Só ele: `PORTRAIT_DIRS_ONLY=1 SPRITE_CFG=... python tools/sprites/render_sprites.py` |
| `tormenta_celeste.json` | Traje (skin) da Tormenta: `parts` (peças de outros KayKit, mesmo esqueleto), `textures` (recolorir várias texturas), `glow_mesh`/`glow_halo` (arma brilhando), `look` (luz AgX + contorno), chapéu com `straw` e `ribbons`, `outline` |
| `bandido_*.json`, `terracota.json`, `general.json` | Monstros KayKit recoloridos (lenço/chapéu gerados com `attach`) |
| `espectro_gelo.json`, `yeti.json`, `discipulo_caido.json`, `abade_caido.json` | Montanha Nevada (marco 9): Mage, Barbarian, Rogue e Mage (com cajado) recoloridos |
| `assassino_sombras.json`, `serpente_jade.json`, `grou_espiritual.json`, `guardiao_jade.json`, `senhor_nevoa.json` | Nível 30: Rogue_Hooded (facas), Mage, Mage, Knight (com elmo) e Mage (com cajado) recoloridos |
| `render_bambu.py` | Bosque de Bambu Sombrio (nível 30): moitas de bambu, brotos e folhas por script → `public/sprites/bambu.*` |
| `montanha.json` | Objetos da montanha (`render_props.py`): pinheiros em 3 tons e rochas nevadas → `public/sprites/montanha.*` |
| `tormenta.json`, `geada.json`, `tita.json`, `vibora.json`, `lobo.json`, `floresta.json` | Configuração de cada folha (Titã: Barbarian + bastão, golpe `2H_Melee_Attack_Chop`; Víbora: Rogue_Hooded + agulhas, `Throw`) |
| `npc_*.json` | NPCs da cidade (KayKit recolorido). `dir_list: [0]` = só de frente (NPC parado); moradores têm as 8 direções |
| `fetch-assets.sh` | Baixa só os modelos usados (KayKit oficial; lobo e natureza de espelhos no GitHub fixados por commit) e confere com `models.sha256`. Aceita os pacotes oficiais em `QUATERNIUS_ANIMALS_DIR` / `KENNEY_NATURE_DIR` |
| `models.sha256` | SHA-256 de cada modelo usado (prova de que é sempre o mesmo arquivo) |

## Padrões fixados

- **Câmera:** ortográfica, isométrica 2:1 (igual aos tiles 64×32). Luz fixa de cima/esquerda.
- **8 direções:** 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW. No jogo: `dirFromDelta` em `src/render/sprites.ts`.
- **Animações:** `idle` (6 quadros), `walk` (8), `attack` (8, uma vez), `death` (6, uma vez).
- **Resolução:** renderizado em 2× e mostrado em 0,5 (nítido no celular e no zoom de 200%).
- **Retratos** (`portrait_png`, `<nome>_retrato.png`: mochila, criação, diálogo): renderização à parte em alta resolução
  (`portrait_scale`, padrão 10 px por px do jogo, ~550 px de altura), nítida em tela de DPR 3. Só os retratos:
  `PORTRAIT_ONLY=1 SPRITE_CFG=tita.json .venv-blender/bin/python render_sprites.py` (dentro de `tools/sprites`).
- **Retrato animado** (`portrait_anim`, só as 4 seitas): a animação parada inteira (`portrait_frames`, padrão 12) na mesma
  resolução do retrato, numa tira `<nome>_retrato_idle.png` + `src/data/sprites/<nome>_retrato_idle.json` (quadros, fps com o
  mesmo ciclo do sprite). É a respiração do personagem na mochila. Sai junto com o retrato (`PORTRAIT_ONLY=1`).
- **Tamanho:** personagem ~48 px de altura no zoom 100%. Escala dos objetos: 1 unidade do modelo = 1 tile.
- **Folhas:** quadros recortados e empacotados (atlas do Phaser, máx. 2048×4096), paleta de 256 cores.
- **Recolorir:** `texture.cells` troca blocos da paleta de texturas estilo KayKit (grade 8×4);
  `recolor` troca a cor de materiais por nome (modelos Kenney/Quaternius).
- **Objetos presos a ossos:** `attach` cria um objeto e prende num osso: `kind: "fan"` (leque de qi da Geada, bastão `"staff"` da Titã e agulhas `"needles"` da Víbora, na
  `handslot.r`; `rot` em graus, `scale`, `color`, `rib`), `"mask"` (lenço no rosto, osso `head`; `radius`, `height`, `color`)
  e `"hat"` (chapéu de palha cônico, osso `head`; `radius`, `height`, `color`, `band`).
- **Cores do cenário x inimigos:** o cenário não usa as cores dos monstros do mesmo mapa (ex.: ruínas em pedra
  cinza-azulada, nada de argila, porque os guerreiros de terracota são laranja). Confira com uma captura antes de fechar.

- **Casas no jogo:** objetos `building` do mapa, desenhados em fatias verticais de 32 px com a profundidade da frente
  da casa em cada coluna (`src/render/mapView.ts`). Pegada da casa = tiles `house` (bloqueiam).
- **Enfeites:** objetos `decor` (`sprite`, `block` = bloqueia o tile, `top` = sempre por cima, como o topo do portão).

## Nova folha

1. Ache um modelo CC0 com animações (KayKit tem o mesmo esqueleto em todos os personagens).
2. Copie `tormenta.json`, troque `model`, `name` e as `action` de cada animação
   (liste as ações com o Blender: `bpy.data.actions`).
3. Rode o build e ligue a textura antiga à folha nova em `BY_TEXTURE` (`src/render/sprites.ts`).
