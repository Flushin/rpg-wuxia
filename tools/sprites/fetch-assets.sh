#!/usr/bin/env bash
# Baixa só os modelos CC0 usados pelos sprites para tools/sprites/.cache (fora do git) e confere cada arquivo com
# tools/sprites/models.sha256. Não faz o render (isso é o build.sh).
#
# Origem (auditoria de direitos, 18/11/2026): o KayKit vem do repositório oficial. O lobo (Quaternius) e o Nature Kit
# (Kenney) vêm de espelhos não oficiais no GitHub, porque os autores só distribuem .zip pelo site. Os espelhos ficam
# fixados em commits exatos e cada modelo é conferido pelo SHA-256, então o resultado é sempre o mesmo.
#
# Para usar os pacotes OFICIAIS (e provar que são idênticos aos espelhos), baixe e descompacte o .zip do site e passe a
# pasta. O script procura cada modelo pelo nome dentro dela e avisa se algum arquivo for diferente:
#   QUATERNIUS_ANIMALS_DIR=~/Downloads/Ultimate_Animated_Animals  (https://quaternius.com/packs/ultimateanimatedanimals.html)
#   KENNEY_NATURE_DIR=~/Downloads/kenney_nature-kit                (https://kenney.nl/assets/nature-kit)
set -euo pipefail
cd "$(dirname "$0")"
SUMS="$PWD/models.sha256"
mkdir -p .cache
cd .cache

get() { # repo commit pasta-destino arquivos...
  local repo=$1 commit=$2 dir=$3
  shift 3
  if [ ! -d "$dir.git" ]; then
    git init -q "$dir.git"
    git -C "$dir.git" remote add origin "https://github.com/$repo.git"
  fi
  git -C "$dir.git" cat-file -e "$commit^{commit}" 2>/dev/null ||
    git -C "$dir.git" fetch -q --depth 1 --filter=blob:none origin "$commit"
  git -C "$dir.git" checkout -q "$commit" -- "$@"
}

# copia um modelo do pacote oficial (se a pasta foi dada); senão, do espelho
from_official_or_mirror() { # pasta-oficial arquivo-do-espelho destino
  local official=$1 mirror=$2 dest=$3 found=''
  if [ -n "$official" ]; then
    found=$(find "$official" -type f -name "$(basename "$mirror")" | head -n 1)
    [ -n "$found" ] || { echo "erro: $(basename "$mirror") não encontrado em $official" >&2; exit 1; }
    cp "$found" "$dest"
  else
    cp "$mirror" "$dest"
  fi
}

# KayKit Adventurers 1.0 (Kay Lousberg, CC0) — repositório oficial
KAYKIT=(Rogue Rogue_Hooded Mage Knight Barbarian)
get KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 672074b73ba276876a19e8816ecdc5241817ab47 kaykit LICENSE.txt \
  $(for c in "${KAYKIT[@]}"; do echo "addons/kaykit_character_pack_adventures/Characters/gltf/$c.glb"; done)

# Quaternius Ultimate Animated Animals (CC0) — espelho trebeljahr/quaternius-showcase (Wolf.glb igual desde 06/12/2022)
get trebeljahr/quaternius-showcase 0128ca510d653bb04d6d1e4885bd8890b5050b4f quaternius LICENSES.md \
  public/glb/animals_pack/Wolf.glb

# Kenney Nature Kit (CC0) — espelho shorepine/kenney
N=3d/nature
NATURE=(tree_oak tree_default tree_fat tree_pineRoundA rock_largeA rock_smallA plant_bush plant_bushLarge grass grass_large
  flower_redA flower_yellowA mushroom_red stump_round log)
get shorepine/kenney 3694c6879e487c108f55677be7dd2ca75b07cc3b kenney LICENSE.txt \
  $(for m in "${NATURE[@]}"; do echo "$N/$m.glb"; done)

mkdir -p kaykit/Characters/gltf quaternius kenney-nature
for c in "${KAYKIT[@]}"; do
  cp "kaykit.git/addons/kaykit_character_pack_adventures/Characters/gltf/$c.glb" kaykit/Characters/gltf/
done
from_official_or_mirror "${QUATERNIUS_ANIMALS_DIR:-}" quaternius.git/public/glb/animals_pack/Wolf.glb quaternius/Wolf.glb
for m in "${NATURE[@]}"; do
  from_official_or_mirror "${KENNEY_NATURE_DIR:-}" "kenney.git/$N/$m.glb" "kenney-nature/$m.glb"
done

# confere tudo com a lista guardada no repositório
if ! grep -v '^#' "$SUMS" | sha256sum --check --quiet; then
  echo "AVISO: algum modelo é diferente do registrado em tools/sprites/models.sha256 (ver acima)." >&2
  echo "Se veio do pacote oficial, os espelhos não eram idênticos: anote em docs/licencas/README.md antes de renderizar." >&2
  exit 1
fi
echo "ok: modelos em tools/sprites/.cache (SHA-256 conferidos)"
