#!/usr/bin/env bash
# Baixa só os modelos CC0 usados pelos sprites para tools/sprites/.cache (fora do git).
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p .cache; cd .cache
get() { # repo pasta-destino arquivos...
  local repo=$1 dir=$2; shift 2
  [ -d "$dir.git" ] || git clone -q --depth 1 --filter=blob:none --no-checkout "https://github.com/$repo.git" "$dir.git"
  git -C "$dir.git" checkout -q HEAD -- "$@"
}
# KayKit Adventurers 1.0 (Kay Lousberg, CC0)
get KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 kaykit LICENSE.txt \
  addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb
# Quaternius Ultimate Animated Animals (CC0) — espelho do pacote
get trebeljahr/quaternius-showcase quaternius LICENSES.md public/glb/animals_pack/Wolf.glb
# Kenney Nature Kit (CC0) — espelho do pacote
N=3d/nature
get shorepine/kenney kenney LICENSE.txt $(for m in tree_oak tree_default tree_fat tree_pineRoundA rock_largeA rock_smallA \
  plant_bush plant_bushLarge grass grass_large flower_redA flower_yellowA mushroom_red stump_round log; do echo "$N/$m.glb"; done)
mkdir -p kaykit/Characters/gltf quaternius kenney-nature
cp kaykit.git/addons/kaykit_character_pack_adventures/Characters/gltf/{Rogue,Mage}.glb kaykit/Characters/gltf/
cp quaternius.git/public/glb/animals_pack/Wolf.glb quaternius/
cp kenney.git/$N/*.glb kenney-nature/
echo "ok: modelos em tools/sprites/.cache"
