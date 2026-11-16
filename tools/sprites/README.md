# Sprites (marco 6)

Personagens, monstros e objetos do cenário são **modelos 3D CC0** renderizados em sprites
isométricos pelo Blender, todos com a mesma câmera e a mesma luz (estilo coeso).
Créditos: `public/sprites/CREDITS.txt`.

## Gerar de novo

Precisa de **Python 3.13** (o Blender 5.x como módulo só funciona nessa versão):

```bash
python3.13 -m venv .venv-blender
.venv-blender/bin/pip install bpy numpy pillow      # Windows: .venv-blender\Scripts\pip
PY=.venv-blender/bin/python tools/sprites/build.sh   # baixa os modelos na 1ª vez (fetch-assets.sh)
```

Leva menos de 1 minuto (Cycles na CPU). Os modelos baixados ficam em `tools/sprites/.cache` (fora do git).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `render_sprites.py` | Personagem/monstro animado → atlas `public/sprites/<nome>.png/.json` + `src/data/sprites/<nome>.json` (animações, âncora, altura) |
| `render_props.py` | Objetos parados (árvores, pedras…) → atlas `public/sprites/floresta.*` com o ponto do chão (pivot) |
| `render_town.py` | Cidade: casas wuxia, portão, lanternas, estandartes, incensário… gerados por script + cerejeiras → `public/sprites/cidade.*` |
| `ground_tiles.py` | Pisos 2D (grama, caminho, lajotas da praça) → `public/sprites/pisos.png` |
| `tormenta.json`, `geada.json`, `lobo.json`, `floresta.json` | Configuração de cada folha |
| `npc_*.json` | NPCs da cidade (KayKit recolorido). `dir_list: [0]` = só de frente (NPC parado); moradores têm as 8 direções |
| `fetch-assets.sh` | Baixa só os modelos usados (espelhos no GitHub) |

## Padrões fixados

- **Câmera:** ortográfica, isométrica 2:1 (igual aos tiles 64×32). Luz fixa de cima/esquerda.
- **8 direções:** 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW. No jogo: `dirFromDelta` em `src/render/sprites.ts`.
- **Animações:** `idle` (6 quadros), `walk` (8), `attack` (8, uma vez), `death` (6, uma vez).
- **Resolução:** renderizado em 2× e mostrado em 0,5 (nítido no celular e no zoom de 200%).
- **Tamanho:** personagem ~48 px de altura no zoom 100%. Escala dos objetos: 1 unidade do modelo = 1 tile.
- **Folhas:** quadros recortados e empacotados (atlas do Phaser, máx. 2048×4096), paleta de 256 cores.
- **Recolorir:** `texture.cells` troca blocos da paleta de texturas estilo KayKit (grade 8×4);
  `recolor` troca a cor de materiais por nome (modelos Kenney/Quaternius).
- **Objetos presos a ossos:** `attach` cria um objeto e prende num osso. Hoje só `kind: "fan"` (leque de qi da Geada,
  na `handslot.r`), com `rot` (graus), `scale`, `color` e `rib`.

- **Casas no jogo:** objetos `building` do mapa, desenhados em fatias verticais de 32 px com a profundidade da frente
  da casa em cada coluna (`src/render/mapView.ts`). Pegada da casa = tiles `house` (bloqueiam).
- **Enfeites:** objetos `decor` (`sprite`, `block` = bloqueia o tile, `top` = sempre por cima, como o topo do portão).

## Nova folha

1. Ache um modelo CC0 com animações (KayKit tem o mesmo esqueleto em todos os personagens).
2. Copie `tormenta.json`, troque `model`, `name` e as `action` de cada animação
   (liste as ações com o Blender: `bpy.data.actions`).
3. Rode o build e ligue a textura antiga à folha nova em `BY_TEXTURE` (`src/render/sprites.ts`).
