# Roadmap do Mistpeak: resumo executivo

> Análise de 18/11/2026: inventário do código, benchmark com 12 RPGs online, lacunas e marcos.
> É uma **proposta**. Pela regra do `docs/decisoes-do-projeto.md`, cada item que muda a jogabilidade precisa da
> aprovação do Lucas antes de ser feito.

| Documento | Conteúdo |
| --- | --- |
| [`01-inventario.md`](01-inventario.md) | Tudo o que existe no código, com arquivos, status e dívida técnica |
| [`02-benchmark.md`](02-benchmark.md) | Matriz ✅/🟡/❌ contra WoW, FF14, GW2, ESO, OSRS, Tibia, RO, MapleStory, Albion, BDO, Lost Ark e PoE |
| [`03-lacunas.md`](03-lacunas.md) | O que falta: essencial, importante, diferencial ou adiar, com complexidade e riscos |
| [`04-marcos.md`](04-marcos.md) | M0 → M5+, com o critério de "pronto", métricas e checklist |

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

| # | Prioridade | Por quê | Marco | Compl. |
| :-: | --- | --- | :-: | :-: |
| **1** | **Preparar o core para o servidor e escolher o backend:** relógio injetável no lugar dos 12 `Date.now()`, core rodando em Node na CI, protótipo Supabase × Nakama | Tudo o que é online depende disto. Fazer agora, enquanto o código está fresco, e garantir com o simulador que nada mudou no jogo. | M0 | M |
| **2** | **Conta convidado + save na nuvem** (com migração dos saves locais e tela de conflito) | Elimina o maior risco atual: perder o progresso ao trocar de celular ou limpar os dados. De quebra, entrega o progresso cruzado web ↔ Android. | M1 | G |
| **3** | **O servidor como juiz:** ganho offline e mercador pelo relógio do servidor, e plausibilidade de XP/ouro/itens com limites tirados do simulador | Sem isso, ranking, mercado e compras viram trapaça (relógio adiantado, save editado). Precisa existir **antes** de qualquer recurso competitivo ou pago. | M1 | G |
| **4** | **Telemetria mínima com consentimento + backups testados** | Sem dados de funil e retenção, não dá para saber se o alpha funciona. Sem um ensaio de restauração, o primeiro incidente pode apagar todo mundo. | M1 | P/M |
| **5** | **Loop de retorno:** diárias, recompensa de login e a **Provação da Seita** (torre solo com semente semanal e ranking verificado) | O jogo hoje "acaba" em ~3 h. A Provação dá um fim de jogo infinito reaproveitando monstros e arenas que já existem, e usa o diferencial técnico do core determinístico. | M2 | G |

**Pendência de decisão que trava o M1:** **nome final e appId** (`io.github.flushin.wanderers` é provisório). Depois que
houver contas reais e um envio à Play Store, o appId não muda mais.

## Linha do tempo indicativa

**M0** Fundação (2–3 sem) → **M1** Vertical slice online (3–5 sem) → **M2** Alpha fechado (4–6 sem) →
**M3** Beta (6–8 sem) → **M4** Lançamento (3–4 sem) → **M5+** Live ops.

São ~4 a 6 meses de trabalho focado até o lançamento, mais o tempo de calendário dos testes com jogadores e das lojas.
