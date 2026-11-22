# 06 · Roadmap de qualidade de vida (QoL)

QoL comum em outros MMORPGs que ainda **não existe** aqui (levantado em 2026-11-22). Já existem: organizar bolsa,
comparar com o equipado, Auto (compra poções, vende Comuns/Incomuns), teleporte entre cidades, mapa-múndi, minimapa,
rastreador de missões, destruir com confirmação, reset de atributos, trajes.

Itens que mudam regra de jogo (9, 10, 11, 15, 16) pedem consultar `docs/decisoes/` antes (podem chocar com o papel do Auto).
Tudo que aparecer na wiki atualiza a wiki no mesmo PR.

## Fase 1 · Barato e de impacto imediato

| # | Funcionalidade | Por quê / referência |
| --- | --- | --- |
| 1 | **Trancar item** (cadeado): bloqueia vender, destruir, desmontar e a venda do Auto | Padrão em Diablo, PoE, Lost Ark, MapleStory |
| 2 | **"Vender tudo"** no vendedor por raridade (respeita trancados) | Hoje só o Auto vende em lote |
| 3 | **Recomprar** os últimos ~10 itens vendidos | Desfaz venda errada |
| 4 | **Números de dano flutuantes** (opção; cor para crítico/cura) | Feedback de combate |
| 5 | **Marcar itens novos** na bolsa | Achar o drop recente |
| 6 | **Filtro da bolsa** (tipo, raridade, "só melhores que o equipado") | Bolsa cheia |
| 7 | **Tremor de tela e vibração** com opção liga/desliga (`haptics.ts` já existe) | Ver I18 e acessibilidade |

## Fase 2 · Conforto do dia a dia

| # | Funcionalidade | Observação |
| --- | --- | --- |
| 8 | **Remapear teclas** (PC) | Atalhos fixos em `src/ui/controls.ts` |
| 9 | **Poção automática** abaixo de X% de vida no jogo manual | Igual ao Auto |
| 10 | **Coleta automática** de ouro e itens a partir de uma raridade | — |
| 11 | **Equipar o melhor** com um toque / aviso de item melhor | — |
| 12 | **Viagem rápida a mapas visitados** + "voltar para onde eu estava" | Ver I16 em `03-lacunas.md` |
| 13 | **Repetir última masmorra/andar do Trial** direto da vila | — |
| 14 | **Modo daltônico** (raridades, áreas de ataque) e tamanho de fonte | Ver I17 |

## Fase 3 · Metas e organização

| # | Funcionalidade | Observação |
| --- | --- | --- |
| 15 | **Baú da conta** entre personagens | Ver I4 |
| 16 | **Conjuntos salvos** de equipamento + skills (farm × chefe) | — |
| 17 | **Bestiário / registro de itens** (o que cada monstro solta, visto ou não) | Conversa com a wiki |
| 18 | **Conquistas e títulos** | Ver I3 |
| 19 | **Diárias/semanais + login** | Ver I2; precisa do relógio do servidor |
| 20 | **Histórico de drops e log de combate** | "O que caiu / o que me matou" |

## Depende do online (pós-M1)
Correio/presentes, mercado/leilão, chat de frases prontas, push (Auto parou, mochila cheia, I13), save na nuvem (E3).

## Ordem sugerida
1+2+3 juntos (segurança de itens) → 4+7 (sensação de jogo) → 12 (cresce a cada mapa novo).
