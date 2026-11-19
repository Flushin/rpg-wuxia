# Decisões do projeto — Wanderers, RPG de navegador (inspiração: Dragon Oath)

## Regras de trabalho
- Toda decisão tomada é registrada neste documento.
- Decisões que afetam a jogabilidade são sempre perguntadas ao Lucas antes de serem adotadas.
- Decisões são enviadas como perguntas de múltipla escolha ou confirmação, para o Lucas não precisar digitar.
- Sempre avisar o Lucas quando houver dicas para economizar tokens.
- Economia de tokens: tarefas que não precisam do Opus (código de rotina, scaffolding, conteúdo repetitivo) vão para um modelo mais leve (Sonnet/Haiku); o Opus fica com design, revisão e decisões.
- **Melhorias sugeridas pelo Lucas:** cada sugestão é analisada e só entra na lista "Melhorias — Futuro" (fim deste documento) se o Lucas aprovar. Nada dessa lista é implementado até o Lucas pedir explicitamente. Quando implementada, a melhoria passa para "Melhorias — Feitas".

## Repositório e publicação
- **Código:** GitHub `Flushin/rpg-wuxia`, branch `main`. Cópia deste documento em `docs/decisoes-do-projeto.md`.
- **Publicação:** GitHub Pages, automática a cada push na `main` (GitHub Actions) — `https://flushin.github.io/rpg-wuxia/` (funcionando).
- **Ambiente do Lucas:** Windows sem admin, Node portátil em `C:\nodejs`, VSCode. O repositório tem `.vscode/settings.json` que coloca `C:\nodejs` no PATH do terminal.

## Plano de desenvolvimento
- **Marco 1 (concluído):** estrutura do projeto, cidade e floresta com placeholders, criação de personagem (2 seitas), movimento PC/celular, seleção de alvo, ataque básico, lobos com IA, XP/nível até 10, pontos de atributo, morte → cidade, HUD, save no IndexedDB.
- **Marco 2 (concluído):** skills das duas seitas + nível por uso, hotbar, painel de skills (K).
- **Marco 3 (concluído):** itens, equipamentos, durabilidade, drops, ferreiro e vendedor de poções, interação com NPCs.
- **Marco 4 (concluído):** auto-combate (menu de skills, poções) e ganho offline.
- **Marco 5 (concluído, em teste):** bandidos, guerreiros de terracota e o General de Terracota; balanceamento; **vários personagens**:
  - Tela inicial com **4 espaços**; cada um mostra nome, seita, nível, mapa e último acesso, com botões Jogar e Apagar (apagar pede para digitar o nome). O personagem atual vira o primeiro espaço.
  - Ganho offline vale só para o **último personagem jogado**.
  - Personagens **não compartilham** nada por enquanto (baú/ouro compartilhado pode vir depois).
- **Marco 6 (concluído, em teste): gráficos.** Definir o estilo de arte com **Tormenta + lobo + um trecho da floresta** antes de trocar o resto. Só depois estender para Geada, outros monstros, cidade e ruínas.
  - **Origem da arte:** pacotes gratuitos **CC0** (mesma linha do som). Créditos em `public/sprites/CREDITS.txt`.
  - **Primeira fatia (15/11/2026, feita):** Tormenta, lobo, árvores e piso da floresta já no jogo; retrato da Tormenta na mochila (fim da silhueta para ela). Detalhes em "Gráficos (marco 6)" abaixo.
  - **Geada (16/11/2026, feita):** Mage do KayKit recolorido em **branco e azul-gelo** (túnica branca, capa azul-gelo, cabelo prateado, sem chapéu), segurando um **leque de qi** gerado pelo script (nenhum pacote CC0 tem leque). Animações: parado, correr, ataque = `Spellcast_Shoot`, morte. Retrato na mochila (fim da silhueta para ela também).
  - **Cidade, NPCs e mestres (16/11/2026, feita):** Vila das Nuvens refeita (praça de pedra, casas wuxia, portão leste), 13 NPCs com sprite e falas em PT/EN, mestres das 4 seitas na criação e na praça. Detalhes em "Cidade, NPCs e mestres das seitas (marco 6)" abaixo.
  - **Para fechar o marco 6 (decidido pelo Lucas em 16/11/2026) — entram os 4 blocos:**
    1. **Bandidos e terracota:** espadachins, arqueiros, guerreiros de terracota e General com sprite KayKit recolorido.
       - **Bandidos:** roupa marrom e cinza, **lenço cobrindo a boca**; arqueiros com **chapéu de palha**.
       - **Terracota:** **barro alaranjado** (cor de argila) com armadura de placas; **General 1,5× maior com detalhes dourados**.
    2. **Ruínas, água e portais** com arte nova.
    3. **Efeitos visuais das skills** (raios, lâminas, gelo, névoa) no lugar dos efeitos simples.
    4. **Ícones de skills/itens** no lugar dos emojis + **medição de desempenho (FPS) no celular**.
  - **Fechamento (16/11/2026, feito):** os 4 blocos no jogo. Detalhes em "Fechamento do marco 6" abaixo.

### Roteiro dos próximos marcos (decidido pelo Lucas em 16/11/2026)
- **Ordem:** terminar o Marco 6 → **fechar a v1** → **novas seitas** → **conteúdo pós-nível-10** → online.
- **Marco 7 (concluído em 16/11/2026): fechar a v1 (versão 0.1).** Detalhes em "Fechamento do marco 7" abaixo.
  - Jogar do nível 1 ao 10 com as duas seitas e fechar os itens de "Em aberto" (curva de XP, drops, chefe). Atenção: a Geada morre ~2× mais que a Tormenta.
  - **Missões: cadeia principal do nível 1 ao 10 que guia o jogador até o General**, dada pelos NPCs que hoje só falam (ancião, guarda…). Sem missões repetíveis por enquanto. **Decidido em 16/11/2026** — ver "Missões (marco 7)" abaixo.
  - **Missões: feitas (16/11/2026).** Falta: jogar 1→10 com as duas seitas e fechar os itens de "Em aberto".
  - Polimento: tela de carregamento, instalar como app no celular (PWA) e versão na tela inicial — **feitos**.
  - **Save continua separado por aparelho** (sem exportar/importar e sem nuvem); resolver só no marco online.
- **Marco 8: Titã e Víbora (em andamento, 18/11/2026).** Skills aprovadas pelo Lucas em 18/11/2026 — ver "Titã e Víbora (marco 8)" abaixo. Sprites: Titã = Barbarian do KayKit com bastão; Víbora = Rogue encapuzado com agulhas.
- **Marco 9: pós-nível-10.** Nível máximo 20, mapa novo com 2–3 monstros e 1 chefe, novas bases de equipamento. **Sistemas escolhidos: craft** (fabricar/melhorar itens com materiais de monstros) e **mercador ambulante vendendo itens raros**. Gemas e baú/ouro compartilhado ficaram de fora por enquanto. Fase 0 (decisões) feita em 18/11/2026 — ver "Pós-nível-10 (marco 9)" abaixo. **Fases 3 a 9 feitas em 18/11/2026. Concluído em 18/11/2026** (pontos ⚠ confirmados pelo Lucas; só o ouro da forja mudou: agora é sempre cobrado).
- **Marco 10: online.** Save na nuvem com conta e, depois, multiplayer.
- **Publicação na Play Store: depois de todos os marcos** (decidido pelo Lucas em 18/11/2026: primeiro a jogabilidade). O que falta está em "Pendências das auditorias (18/11/2026)".
- **Contínuo (feito em 17/11/2026, auditoria A1):** `npm test` (os `check:*`) e `typecheck` rodam no GitHub Actions em todo PR e antes de cada publicação; se falhar, o site não é atualizado. O `check:layout` e o `sim:balance` continuam manuais.


