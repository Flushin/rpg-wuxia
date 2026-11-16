#!/usr/bin/env bash
# Gera todos os sprites do marco 6. Precisa de Python 3.13 com bpy, numpy e pillow (veja README.md).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
[ -d .cache/kaykit ] || ./fetch-assets.sh
for c in tormenta geada lobo bandido_espadachim bandido_arqueiro terracota general npc_*; do SPRITE_CFG=${c%.json}.json $PY render_sprites.py; done
SPRITE_CFG=floresta.json $PY render_props.py
$PY render_town.py
$PY render_ruins.py
$PY icons.py
$PY ground_tiles.py ../../public/sprites/pisos.png ../../src/data/sprites/pisos.json
