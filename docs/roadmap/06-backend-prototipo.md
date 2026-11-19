# 06 · Relatório do protótipo do backend (M0)

> 19/11/2026. Base para a decisão 👤 "Escolher o backend" do M0. Código em [`backend/`](../../backend/README.md).
> Os números de planos e preços vieram de fontes secundárias em 19/11/2026: **conferir nas páginas oficiais na hora de
> criar a conta** (supabase.com/pricing e firebase.google.com/pricing).

## O que foi construído (igual nos dois)

- **Login convidado** (anônimo): o jogador não vê tela de login.
- **Salvar e ler o save**, com **versão** (conflito se o aparelho mandar uma versão velha), **checksum SHA-256** e
  **histórico das 5 últimas versões**.
- **Função do servidor que importa o core do jogo** (`backend/shared/saveSync.ts` + `dist-headless`): saneia o save,
  carimba com o **relógio do servidor**, aplica o **ganho offline** com esse relógio ao abrir o personagem e confere a
  **plausibilidade** (XP/h, ouro/h, nível de item do `src/data/plausibility.json`), só **marcando** o suspeito.
- O aparelho só **lê** o que é dele; **gravar** passa sempre pela função (o relógio e a conferência ficam no servidor).

## O que já foi testado (sem conta)

| Teste | Resultado |
| --- | --- |
| `npm run check:backend`: lógica do servidor (primeiro envio, jogo normal de 15 min, 4 trapaças, missão, ganho offline com relógio do servidor, determinismo) | ✅ 18/18 |
| `npm run check:backend-sql`: tabelas e RLS do Supabase num Postgres 16 local (só o dono lê; ninguém grava direto; sem login não vê nada; histórico com 5 versões; apagar a conta apaga tudo) | ✅ 10/10 |
| `npm run check:headless`: o core no servidor dá **exatamente** o resultado do navegador | ✅ |
| Ponta a ponta no Supabase de verdade (`npm run smoke:backend`): login, salvar, conflito, ler, latência | ⏳ amanhã, com a conta |
| Firebase no emulador | ⏸️ não rodado (código pronto; ver a recomendação) |

## Comparação

| Critério | Supabase | Firebase |
| --- | --- | --- |
| Custo para começar | **Grátis sem cartão** | Firestore e Auth grátis, mas **Cloud Functions exigem o plano Blaze (cartão)** |
| Cota grátis (fontes secundárias) | 500 MB de banco, 50 mil usuários ativos/mês, 500 mil chamadas de função/mês | Firestore 50 mil leituras e 20 mil gravações/dia; funções ~2 mi/mês no Blaze |
| Pegadinha do grátis | Projeto **pausa após 7 dias sem uso** (some quando houver jogadores ou no Pro, US$ 25/mês) | Conta com cartão: um erro (laço de leituras) vira cobrança; precisa configurar alerta de orçamento |
| Banco | Postgres (SQL): ranking, consultas e relatórios fáceis (M1 I1a, painel de telemetria E6) | Documentos (NoSQL): ranking exige índices e contadores à mão |
| Regras de acesso | RLS em SQL, testável localmente (já testado) | Regras próprias do Firestore, testáveis no emulador (Java) |
| Função com o core | Edge Function (Deno) importando o pacote headless | Cloud Function (Node 22) importando o mesmo pacote |
| Login convidado → Google/e-mail (M1 E2) | Sim (vincular identidade à conta anônima) | Sim (`linkWithCredential`) |
| Backup (M1 E7) | Backup diário pelo painel é do Pro (conferir); no Free, a IA faz um backup próprio (exportação agendada) | Exportação agendada exige Blaze + bucket |
| Excluir conta (M1 E5) | `on delete cascade` já apaga tudo (testado) | Precisa de função para apagar as subcoleções |
| Região | São Paulo | São Paulo (`southamerica-east1`) |
| Saída (lock-in) | Postgres comum: dá para levar para outro lugar | Formato próprio do Google |
| Operação diária | Nenhuma | Nenhuma |

## Recomendação da IA

**Supabase.** Começa sem cartão (nenhum risco de cobrança surpresa para quem nunca operou um serviço), o banco SQL deixa
o ranking, a telemetria e a exclusão de conta do M1 bem mais simples, e as regras de acesso já estão testadas. A pausa de
7 dias só atrapalha durante o desenvolvimento (basta clicar em *Restore*) e deixa de existir com jogadores ativos.

O Firebase só valeria a pena se o Lucas quisesse muito ficar no ecossistema do Google (Play Games, Analytics); mesmo
assim, o login com Google funciona igual no Supabase.

## Decisão (👤 Lucas, múltipla escolha amanhã)

1. **Supabase** (recomendado): criar a conta amanhã, rodar o `smoke:backend` e registrar a decisão.
2. **Firebase**: criar a conta, ativar o Blaze com alerta de orçamento e rodar o protótipo no emulador antes.
3. **Testar os dois ao vivo** antes de decidir (+~1 h do Lucas, e o Firebase pede cartão).

Depois da escolha, a IA registra em `docs/decisoes-do-projeto.md` o backend e o **modelo de dados** (tabelas
`characters` e `character_history` acima) e apaga do protótipo a parte que não foi escolhida.
