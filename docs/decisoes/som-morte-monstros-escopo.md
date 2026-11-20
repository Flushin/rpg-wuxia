### Som
- **Origem (redefinida em 20/11/2026, cada som escolhido pelo Lucas):** só CC0/domínio público, do Freesound, OpenGameArt e Wikimedia Commons. Créditos em `public/audio/CREDITS.txt`; licença conferida de cada som em `docs/licencas/README.md`.
- **Escopo:** efeitos de combate, progressão, interface, itens, forja e missões (cada evento com som próprio) + ataque com som por família de monstro e por chefe (`monsterAttack` em `src/data/audio.json`; sem entrada = `monster_attack`) + música ambiente (cidade: "Hot Springs Town"; floresta e bambu: "Bamboo Blitz"; mesmo volume, −20 LUFS; transição suave).
- **Arquivos:** mono, ogg + mp3 (o APK leva só o ogg), até 30 KB por efeito e 1,5 MB por música.
- **Controle:** volumes separados de efeitos e música + mudo, na engrenagem de configurações (padrão: efeitos 80, música 50). Por aparelho desde a B6 (17/11/2026).

### Regeneração e movimento em combate
- **HP e mana só regeneram na cidade:** 3% por segundo (após 5 s sem tomar dano). No mapa de caça, só poções (e passivas).
- **Ranged atacam andando:** o ataque básico continua no alvo enquanto o personagem anda (joystick ou clique). As skills dos ranged também poderão ser usadas andando (marco 2). Melee param para atacar.

### Morte
- O personagem volta para a cidade e os itens equipados perdem durabilidade.

### Monstros (v1)
- **Floresta:** lobos (nv 1–3, visão de 3 tiles) e bandidos (nv 4–6).
- **Renascimento:** monstros comuns renascem **30 s** após morrer; o General, 10 min. O tempo continua contando fora do mapa e fica no save.
- **Bandidos:** mistura de espadachins (andam em grupos de 2–3) e arqueiros (atacam de longe).
- **Novo mapa "Ruínas de Terracota"** (ligado à floresta): guerreiros de terracota (nv 7–9) e o General no fundo.
- **Guerreiros de Terracota:** defesa física ×2,4 e espiritual ×0,7 (ensina tipos de dano: Geada leva vantagem; Tormenta usa o Quebra-Guarda).
- **Chefe — General de Terracota (nv 10):** lento e resistente; golpe em área marcado no chão com círculo vermelho 1,5 s antes (dá para sair). Com 50% de HP invoca 2 guerreiros. Renasce 10 min após morrer. Drop garantido de item Raro nível 5.
- **Auto-combate ignora o chefe** e evita a área dele.
- **Escolha de alvo do auto (refeita em 15/11/2026, aprovada):**
  - **Revidar primeiro:** monstro que está atacando o personagem vira o alvo (o mais perto), mesmo acima do limite de nível; só depois procura monstros novos. Se o alvo atual já está na briga, termina ele.
  - **Evita atrair vários:** prefere alvos cujo caminho (e o próprio alvo) não fica na visão de outros monstros; pode escolher um um pouco mais longe.
  - **Perto primeiro:** prefere monstros até ~12 tiles de caminho; só atravessa o mapa se não houver nenhum perto.
  - **Correção do "parar do nada":** confere o caminho de até 16 candidatos (antes 4) e larga o alvo que não fica mais perto em 4 s (ignora por 15 s). Simulação: ritmo igual (Tormenta ~72 min, Geada ~46 min até o nível 10) e menos mortes (Tormenta ~1,3, Geada ~4,7).
- **Auto-combate (ajustes do marco 5, aprovados):** prefere monstros com nível ≥ (nível do personagem − 1), os mais fracos só se não houver outros; volta à cidade para descansar com HP < 35% e sem poção de vida; bebe poção mais cedo contra 2+ monstros.

### Balanceamento
- **Ritmo:** ~1 hora de jogo ativo para chegar ao nível 10.
- **Resultado da simulação:** Tormenta ~69 min (~3 mortes), Geada ~50 min (~7 mortes). Chefe: Tormenta vence 40% (Incomum) / 75% (Raro); Geada vence sempre recuando. Aceito por enquanto; ajustar depois de jogar. Detalhes em `docs/balanceamento.md`. Lobos ficaram mais fracos e com mais ouro.
- **Módulo de balanceamento (18/11/2026):** ajustes de número passam por `npm run balance -- <chave> +10%`, que grava multiplicadores em `src/data/balance.json` (com histórico) sem mexer nos outros JSON. `src/core/balance.ts` aplica ao carregar; tudo em 0% = jogo igual (simulador idêntico). Lista de chaves e uso em `docs/balanceamento.md`.

### Escopo da primeira versão jogável
- 1 cidade com NPCs — funcionais: **ferreiro** (conserto) e **vendedor de poções**; os demais sem função (mestres das 4 seitas, guarda do portão, ancião, moradores e mercador ambulante — só falas). No Marco 7, parte deles passa a dar as missões da cadeia principal.
- Floresta (lobos + bandidos) e Ruínas de Terracota (guerreiros + General).
- 2 classes: Tormenta e Geada.

