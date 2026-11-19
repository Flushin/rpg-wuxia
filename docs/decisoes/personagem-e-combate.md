### Atributos
- **Strength:** dano físico.
- **Intelligence:** dano espiritual.
- **Stamina:** HP + defesa física.
- **Agility:** hit (precisão) + chance de crítico + dano crítico.
- **Willpower:** mana + defesa espiritual.
- **Recurso das skills:** mana.
- **Pontos por nível:** 5 — **2 automáticos** (conforme a seita) + **3 livres** para o jogador distribuir.
- **Recomendação no painel:** cada atributo tem explicação; os recomendados da seita aparecem marcados com o porquê.
  - Tormenta: **Strength** (dano físico) e **Agility** (acerto e crítico, combina com golpes rápidos).
  - Geada: **Intelligence** (dano espiritual) e **Willpower** (mana para as skills de área).
  - **Stamina** aparece como opcional para as duas, para quem morre muito.
- **Botão "Distribuir recomendado":** gasta os pontos livres sozinho seguindo a proporção recomendada da seita (definida em `classes.json`).

### Aprender jogando
- **Dicas contextuais:** aparecem uma única vez, na primeira vez que a situação acontece (entrar no jogo, primeiro portal, primeiro abate, primeiro nível, primeira morte; depois primeiro item, primeira skill etc.). Podem ser desligadas nas configurações.

### Elementos
- **Fire, Ice, Thunder, Poison** — cada um com ataque e resistência.

### Classes (seitas)
4 seitas: duas melee, duas ranged.
- **Titã (Titan):** melee, tanque, bastão/punhos.
- **Tormenta (Tempest):** melee, espadas duplas, dano rápido, dano físico, elemento **Thunder**. *(v1)*
- **Geada (Frost):** ranged, magia de qi, dano em área, dano espiritual, elemento **Ice**. *(v1)*
- **Víbora (Viper):** ranged, agulhas e veneno, dano contínuo + cura leve.

### Combate e skills
- **Ataque básico:** igual para todas as classes (hit básico, como no Dragon Oath).
- **Skills por classe na v1:** 4 ativas + 1 passiva, além do ataque básico, liberadas nos níveis 1, 3, 5, 7 e 9.
- **Nível das skills ativas:** sobe **pelo uso** — quanto mais a skill é usada, mais experiência ela acumula.
- **Nível das skills passivas:** sobe **junto com o nível do personagem**.

- **Nível máximo da skill:** 10; **+8% de efeito por nível**. Cada uso dá 1 de experiência; o nível 2 pede ~20 usos e os seguintes pedem cada vez mais.
- **Uso:** skills de alvo único usam o alvo selecionado (tab-target); se o alvo estiver fora do alcance, o melee anda até ele antes de usar.
- **Skills de área nunca exigem alvo:** saem na hora, gastando mana e cooldown mesmo sem monstro perto. Tempestade de Lâminas: em volta do personagem. Nevasca: no alvo selecionado se estiver no alcance; senão, em volta do personagem. Só ganham experiência se acertarem algum monstro.
- **Hotbar:** PC — teclas 1–4 e clique; celular — 4 botões em arco ao redor do botão de ataque (canto inferior direito).
- **Números iniciais (aprovados, ajustáveis no balanceamento):**
  - Presas Gêmeas 2×80% · cd 4 s · 8 mana
  - Passo do Raio: avança até 8 tiles, 120% · cd 10 s · 12 mana
  - Tempestade de Lâminas: 170% em volta, raio 2,5 · cd 12 s · 18 mana
  - Quebra-Guarda: 220% e −30% defesa por 6 s · cd 15 s · 20 mana
  - Fluxo da Lâmina: +10% velocidade de ataque, +5% crítico
  - Orbe Gélido: 130% · cd 3 s · 8 mana
  - Flor de Gelo: 110% + lentidão 40% por 4 s · cd 10 s · 14 mana
  - Nevasca: 180% em área no alvo · cd 14 s · 22 mana
  - Véu de Névoa: absorve 25% do HP máx. por 8 s · cd 20 s · 20 mana
  - Mente Serena: regenera 1% de mana/s fora da cidade

**Tormenta (Tempest)**
1. Presas Gêmeas · Twin Fangs (nv 1) — dois golpes rápidos
2. Passo do Raio · Lightning Step (nv 3) — avança até o alvo e causa dano
3. Tempestade de Lâminas · Blade Storm (nv 5) — dano em área ao redor
4. Quebra-Guarda · Guardbreak (nv 7) — dano alto e reduz a defesa do alvo
5. Fluxo da Lâmina · Blade Flow (nv 9, passiva) — mais velocidade de ataque e crítico

**Geada (Frost)**
1. Orbe Gélido · Frost Orb (nv 1) — projétil de magia
2. Flor de Gelo · Icebloom (nv 3) — dano e lentidão
3. Nevasca · Blizzard (nv 5) — dano em área no alvo
4. Véu de Névoa · Mist Veil (nv 7) — absorve dano
5. Mente Serena · Serene Mind (nv 9, passiva) — regeneração de mana

### Progressão (v1)
- Nível de personagem — **nível máximo 10** na v1 (**20** desde o marco 9, fase 1).
- Nível de skills (ativas pelo uso, passivas pelo nível do personagem).
- Equipamentos: só alguns de cada tipo, para teste.

### Equipamentos e itens
- **Slots:** colar, tronco, arma, cabeça, calça, bota.
- Itens têm **durabilidade**.
- **Durabilidade 0:** o item para de dar atributos, mas não some.
- **Conserto:** ferreiro na cidade, por ouro — o ferreiro já funciona na v1.
- **Origem na v1:** equipamentos só caem de monstros (drop); poções caem de monstros e também são vendidas por um NPC na cidade.
- **Itens:** atributos fixos por base + raridade: **Comum** (branco), **Incomum** (verde, +1 bônus aleatório), **Raro** (azul, +2 bônus aleatórios). Nível mínimo para usar.
- **Lista de teste:** 2 bases por slot (nível 1 e nível 5). Arma separada por seita (espadas duplas / leque de qi).
- **Perda por morte:** −10% da durabilidade máxima em cada item equipado.
- **Desgaste por golpe:** cada golpe recebido tira 0,3 de durabilidade dos itens equipados (aprovado no marco 5).
- **Mochila:** 3 abas (Equipamento, Consumíveis, Materiais) com **30 espaços cada** (19/11/2026; antes eram 30 no total); poções iguais empilham até 99. **Coleta automática** dos drops, com aviso do que foi pego.
- **Ouro:** cai dos monstros. O **vendedor de poções também compra qualquer item**.
- **Poções:** recuperam **ao longo de 8 s** (estilo Dragon Oath); não acumulam (usar outra do mesmo tipo reinicia o efeito). **Pequena:** 30%. **Grande:** 60%, mais cara, cai de monstros nível 5+ (até os bandidos existirem, só na loja). Atalhos no PC (Q = HP, E = mana) e botões no celular.

