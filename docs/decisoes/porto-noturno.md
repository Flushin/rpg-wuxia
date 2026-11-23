# Cidade do Porto Noturno (etapa 5)

Decidido com o Lucas em 23/11/2026. Etapa 5 de 5 do Porto Noturno (nível 50). Planta: `docs/roadmap/cidade-porto-planta.svg`.

- **Mapa** `porto` (96×96, `tools/gen-maps.mjs` → `public/maps/porto.json`; `W`/`H` do gerador mudam só nele). Nome: Porto Noturno
  (EN Night Harbor). Bairros na posição da planta: portão no norte, avenidas em cruz, praça central (Mestre dos Caminhos),
  estábulo com cercado (NO), forja-mestre e joalheria (NE), casa de chá, jardim com lago, antiquário e banco/arena (S),
  três canais com pontes de tábuas (tile novo `deck`), cais com mercado noturno e trapiches, mar ao sul com juncos.
- **Entrada:** portão sul da Cidadela (portal `minLevel: 50`) e teleporte (destino `porto`, nível 50). O portão do Porto volta
  à Cidadela sem nível. Mapa-múndi: coluna 2, linha 4 (abaixo da Cidadela).
- **NPCs movidos** da Cidadela: Joalheiro Yu, Ferreiro-mestre Gang, Antiquário Lao e Cavalariço Ma (o cavalo passa a exigir
  chegar ao Porto, nível 50). Novos: Guarda do Portão (×2), Mestre do Cais, três vendedoras/vendedores do mercado (papel de
  vendedor de poções). Sprites próprios (KayKit CC0 recolorido, `tools/sprites/npc_*.json`).
- **Casa de chá e banco:** só cenário nesta etapa (buffs e depósito ficam para depois). A arena do banco tem o portal do Trial.
- **Noite** (`MapConfig.night`, `src/render/nightView.ts`): véu azul-escuro (alpha 0,6) preso à câmera e halos em ADD nas
  lanternas (enfeite com `light`); barcos (`boat`) balançam por tween. Pontes são enfeites `flat` (rente ao chão).
- **Sprites:** atlas `porto` gerado por script no Blender (`tools/sprites/render_porto.py`: casas, lojas, barracas, postes,
  pontes, estacas, cercas, juncos); muralha do atlas `cidadela`. Sem modelo de fora para barcos e lanternas (não havia junco
  CC0 no estilo): tudo procedural, sem licença nova.
- **Missões** (fim da cadeia, nível 50): "As luzes do porto" (chegar ao Porto), "Os bairros do porto" (falar com o Mestre do
  Cais), "Carga do palácio" (20 guardas celestes). Recompensas em ouro e XP (não há arma nível 40+).
- **Música:** "Samurai Nights", Majadroid, **CC-BY 4.0** (crédito obrigatório: tela de créditos, `public/audio/CREDITS.txt`,
  `docs/licencas/README.md`, `ASSETS_LICENCAS.md`); -20 LUFS.
- **Desempenho:** no mesmo navegador sem GPU, FPS do Porto igual ao da Cidadela (o culling por câmera já esconde o que está longe).
