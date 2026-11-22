# Roadmap do Mistpeak: resumo executivo

> Análise de 18/11/2026: inventário do código, benchmark com 12 RPGs online, lacunas e marcos.
> É uma **proposta**. Pela regra do `docs/decisoes/README.md`, cada item que muda a jogabilidade precisa da
> aprovação do Lucas antes de ser feito.
>
> **Premissa:** solo dev **sem experiência de lançar jogos ou apps nas lojas**; a **IA faz quase tudo** (código, testes,
> documentação, textos de loja, guias passo a passo) e o Lucas decide, testa jogando e cuida do que exige uma pessoa
> (contas, identidade, pagamentos, chaves). Cada tarefa do roadmap diz quem faz: 🤖 IA · 🤝 juntos · 👤 só o Lucas.

| Documento | Conteúdo |
| --- | --- |
| [`01-inventario.md`](01-inventario.md) | Tudo o que existe no código, com arquivos, status e dívida técnica |
| [`02-benchmark.md`](02-benchmark.md) | Matriz ✅/🟡/❌ contra WoW, FF14, GW2, ESO, OSRS, Tibia, RO, MapleStory, Albion, BDO, Lost Ark e PoE |
| [`03-lacunas.md`](03-lacunas.md) | O que falta: essencial, importante, diferencial ou adiar, com complexidade e riscos |
| [`04-marcos.md`](04-marcos.md) | M0 → M5+, com o critério de "pronto", métricas e checklist marcado com quem faz cada tarefa |
| [`05-guia-lancamento.md`](05-guia-lancamento.md) | Guia do primeiro lançamento: glossário, a jornada na Play Store em ordem, custos e armadilhas |
| [`06-qol.md`](06-qol.md) | Roadmap de qualidade de vida (QoL): o que outros MMORPGs têm e falta aqui, em fases |

## Onde o jogo está

O Mistpeak é um **ARPG wuxia isométrico single-player completo e bem cuidado**: 4 seitas, nível 1 a 20 (~3 h ativas),
4 mapas, 2 chefes, forja, mercador, auto-combate e ganho offline, rodando no navegador e no Android. A engenharia está
acima da média para um solo dev: o core é separado do Phaser e determinístico, há 9 suítes de teste (763 verificações,
todas passando), um simulador de balanceamento e um robô do caos.

O que falta para ser um **RPG online** é quase tudo da camada online: conta, save na nuvem, servidor que valide o
progresso e o social. Também falta um **loop de fim de jogo** que traga o jogador de volta depois das ~3 horas de conteúdo.

**Alvo definido:** online **assíncrono** (cada um no seu mundo; ranking, guildas, amigos e mercado pelo servidor), público
**casual PvE mobile**, **v1 grátis** e monetização ética depois. Mundo compartilhado em tempo real, raids e PvP em tempo
real ficam **fora do escopo** por decisão: é o que separa um jogo lançável de um clone de WoW que nunca sai.

## Diferenciais a proteger

1. **Auto-combate + ganho offline transparente.** Nenhum MMO ocidental famoso tem.
2. **Navegador + Android, sem instalar na web.** Com a conta, vira progresso cruzado (só OSRS e Albion fazem algo parecido).
3. **Core determinístico.** Permite ranking verificado por replay e validação barata no servidor.
4. **Forja "honesta"** (falhar não destrói o item) e o tema wuxia, que nenhuma referência explora.

## As 5 prioridades mais urgentes

| # | Prioridade | Por quê | Quem | Marco |
| :-: | --- | --- | :-: | :-: |
| **1** | **Preparar o core para o servidor e escolher o backend gerenciado:** relógio injetável no lugar dos 12 `Date.now()`, core rodando em Node na CI, protótipo Supabase × Firebase, `CLAUDE.md` | Tudo o que é online depende disto. Com o simulador, dá para provar que nada mudou no jogo. | 🤖 (você só escolhe o backend) | M0 |
| **2** | **Conteúdo e polimento offline (Trilha C):** música das zonas, vibração, viagem rápida, talentos, conquistas, Provação local, nível 20–30 | Você quer criar mais e jogar mais offline antes da loja. Nada disso depende do servidor: pode vir antes do M0, em paralelo ou intercalado. Cada mês aqui adia o online na mesma medida. | 🤖 (você escolhe a ordem e aprova) | Agora |
| **3** | **Conta convidado + save na nuvem** (com migração dos saves locais e tela de conflito) | Elimina o maior risco atual: perder o progresso ao trocar de celular ou limpar os dados. Entrega o progresso cruzado web ↔ Android. | 🤖 | M1 |
| **4** | **O servidor como juiz, com backups testados e telemetria:** offline e mercador pelo relógio do servidor, plausibilidade com limites do simulador, backup com ensaio de restauração, funil e retenção | Sem isso, ranking e compras viram trapaça, e um incidente pode apagar todo mundo. Os manuais ficam escritos para você pedir à IA "siga o manual". | 🤖 🤝 | M1 |
| **5** | **Loop de retorno:** diárias, recompensa de login e a **Provação da Seita** (torre solo com semente semanal e ranking verificado) | O jogo hoje "acaba" em ~3 h. A Provação dá um fim de jogo infinito com monstros e arenas que já existem. | 🤖 (você decide o design) | M2 |

**Decisões já tomadas (18/11/2026):** appId `io.github.flushin.mistpeak` · a loja **não** é antecipada: a conta na Play e
o teste fechado começam no início do M3. **Ainda em aberto:** a ordem entre a Trilha C e o M0 · o backend (depois do protótipo).

**O que ficou de fora de propósito** (precisa de uma pessoa operando todo dia): chat de texto livre, mercado e troca
entre jogadores. Voltam no M5+ se houver moderadores ou orçamento. Guildas usam frases prontas e uma guilda NPC da seita.

## Linha do tempo indicativa

**M0** Fundação (2–3 sem) → **M1** Vertical slice online (3–5 sem) → **M2** Alpha fechado (4–6 sem) →
**M3** Beta (5–7 sem) → **M4** Lançamento (3–4 sem) → **M5+** Live ops.

São ~4 a 6 meses de calendário até o lançamento, com a IA implementando. Seu tempo estimado vai de ~5 a ~10 h por semana,
conforme o marco (detalhes em `04-marcos.md`). A trilha da loja começa no início do M3. A Trilha C (conteúdo offline)
pode entrar antes ou em paralelo e soma ao calendário o tempo que você dedicar a ela.
