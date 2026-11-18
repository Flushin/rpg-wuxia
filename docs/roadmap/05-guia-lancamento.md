# 05 · Guia do primeiro lançamento (para quem nunca publicou)

> Feito para o Lucas, que nunca lançou um app. Explica **o que acontece, em que ordem, quem faz e onde costuma dar
> errado**. Regras e valores das lojas mudam com frequência: antes de cada etapa, peça à IA para **conferir a regra vigente**
> na documentação oficial. O que está aqui é o mapa do caminho, não a palavra final.
>
> Marcas: 🤖 a IA faz · 🤝 juntos (a IA guia, você clica) · 👤 só você.

## Glossário rápido

| Termo | O que é |
| --- | --- |
| **Play Console** | O site do Google onde você cadastra o app, sobe as versões e responde aos formulários. |
| **appId** (nome do pacote) | O "RG" do app, no Mistpeak, `io.github.flushin.mistpeak` (já decidido e configurado). **Nunca muda** depois do primeiro envio. |
| **AAB** | O formato de arquivo que a Play exige para enviar o app (o APK que a CI gera hoje serve só para teste direto). |
| **Assinatura do app** | A chave criptográfica que prova que a atualização veio de você. Com o *Play App Signing*, o Google guarda a chave principal e você guarda a de envio. |
| **versionCode** | Número inteiro que precisa subir a cada envio. O projeto já calcula a partir do `package.json` (`tools/android-version.mjs`). |
| **Faixas (tracks)** | Teste interno → teste fechado → teste aberto → produção. Cada faixa tem o seu público. |
| **Teste fechado** | Versão que só os testadores convidados instalam. **Não é publicação.** |
| **Data Safety** | Formulário que declara que dados o app coleta. Os rascunhos estão em `docs/lojas.md`. |
| **IARC** | Questionário que gera a classificação indicativa (rascunho em `docs/lojas.md`). |
| **Android Vitals** | Painel da Play com taxa de crash e ANR (app travado). Números ruins diminuem a visibilidade na loja. |
| **Lançamento escalonado** | Liberar a versão para 10%, depois 50%, depois 100% dos jogadores, para pegar problemas cedo. |

## A jornada na Play Store, em ordem

| # | Etapa | Quem | Tempo de calendário | Observações |
| :-: | --- | :-: | --- | --- |
| 1 | ~~Decidir o nome e o appId~~ | — | — | **Feito:** Mistpeak, `io.github.flushin.mistpeak`. Falta só a busca de marca formal (M4). |
| 2 | Criar o **e-mail do jogo** | 👤 | 1 dia | Vai na ficha da loja e na política de privacidade. |
| 3 | Criar a **conta de desenvolvedor** no Play Console (conta pessoal) | 👤 🤝 | 1 dia + verificação (dias, às vezes semanas) | Taxa única, documento de identidade, verificação de telefone e endereço. **Comece cedo.** |
| 4 | Gerar o **AAB assinado** e ativar o Play App Signing | 🤖 🤝 | 1 dia | A IA prepara o build e o passo a passo da chave. **Guarde a chave de envio e a senha em dois lugares seguros** (por exemplo, um gerenciador de senhas e um pendrive). |
| 5 | Criar o app no Console e preencher **ficha, Data Safety, IARC, público-alvo, anúncios (não), acesso ao app** | 🤝 | 1–2 dias | Os textos já estão em `docs/lojas.md`; a IA atualiza o que mudou. |
| 6 | **Teste fechado:** subir o AAB e convidar 12+ testadores | 🤝 👤 | **14 dias seguidos**, no mínimo | Contas pessoais novas precisam disso antes de pedir produção. Os testadores precisam **aceitar o convite (opt-in)** e ficar os 14 dias. Convide 15–20 pessoas. |
| 7 | Pedir **acesso à produção** (questionário sobre o teste) | 🤝 | Dias para a resposta | A IA ajuda a responder com base no que aconteceu no teste. |
| 8 | **Produção** com lançamento escalonado | 🤝 | Revisão de horas a dias por versão | Só no M4. Até lá, as versões continuam nas faixas de teste. |

**Quando começar:** no **início do M3** (decidido em 18/11/2026: primeiro criar mais e jogar mais offline). As etapas 2 a 7
levam ~3 a 5 semanas de calendário, então começar no M3 deixa folga antes do lançamento do M4. Se algo travar
(verificação de identidade, recusa de formulário, testadores sumindo), ainda dá tempo de resolver sem adiar a data.

## Custos esperados

| Item | Custo | Quando |
| --- | --- | --- |
| Conta Google Play (desenvolvedor) | Taxa única de US$ 25 (confira o valor vigente) | M0 |
| Supabase | Grátis no desenvolvimento e no alpha; plano pago (~US$ 25/mês) do beta em diante | M3 |
| Domínio próprio (opcional, para e-mail e site) | ~R$ 40–100/ano | Quando quiser |
| E-mail do jogo | Grátis (Gmail) ou junto do domínio | M0 |
| Revisão jurídica da política e dos termos | Variável (orçamento com advogado) | M4 |
| Apple Developer (só se for fazer iOS nativo) | US$ 99/ano | M5+ |
| Ferramentas de IA | O que você já usa | Contínuo |

**Regra:** todo serviço pago com **limite de gastos e alerta** ligados no primeiro dia (🤝 a IA mostra onde).

## Armadilhas comuns de quem publica pela primeira vez

1. **Perder a chave de envio ou a senha.** Com o Play App Signing dá para pedir a troca ao Google, mas é um processo chato.
   Guarde em dois lugares.
2. **Mudar o appId depois.** Não dá: seria outro app, sem as avaliações e sem os jogadores.
3. **Testadores que não aceitam o convite** ou desinstalam antes dos 14 dias. O que conta é o opt-in, não só o convite.
4. **Formulários desatualizados.** Toda vez que o app passa a coletar algo novo (conta, telemetria, anúncios, compras),
   o Data Safety e a política precisam mudar **antes** da versão nova ir para a loja. A IA avisa no PR.
5. **Exclusão de conta.** Quando houver conta (M1), a Play exige excluir **dentro do app e também por um link na web**.
6. **Acesso para os revisores.** Se alguma parte do jogo exigir login, a loja pede instruções ou uma conta de teste. A conta
   convidado automática evita isso, mas vale declarar no formulário "Acesso ao app".
7. **Conta pessoal com compras.** Em contas pessoais, o Google pode exibir publicamente dados de contato ou endereço do
   desenvolvedor quando o app tem compras (confira a regra vigente antes do M5a). Pode valer a pena um endereço comercial.
8. **Nível de API exigido.** A Play exige que o app mire uma versão recente do Android; isso sobe todo ano. A IA confere
   antes de cada envio (o Capacitor 8 já ajuda).
9. **Nome com marca de outra pessoa.** Faça a busca de marca antes do lançamento público (M4).
10. **Responder às reviews.** Responder com educação e rapidez, mesmo às injustas, melhora a nota. A IA rascunha, você posta.

## E a web e o iOS?

- **Web (GitHub Pages):** já está publicada e continua sendo a porta de entrada mais fácil ("manda o link"). Com a conta
  (M1), o progresso passa a ser o mesmo da Play.
- **iPhone:** por enquanto pela web, instalando como app (PWA). O app nativo na App Store exige a conta Apple paga e um Mac
  (ou um runner macOS na CI), e fica para o M5+ (A10).

## Frases prontas para pedir à IA

- "Faça a próxima tarefa da Trilha C (conteúdo offline) do roadmap."
- "Faça a próxima tarefa 🤖 do M0 do roadmap."
- "Me guie passo a passo para criar a conta no Play Console. Eu nunca fiz isso."
- "Confira as regras atuais da Play para teste fechado e me diga se mudou algo no guia."
- "Prepare o AAB do teste fechado e me diga exatamente o que eu faço com ele."
- "O que eu testo neste PR? Me dê o roteiro de 5 minutos."
- "Deu este erro no Play Console: [cole o texto]. O que faço?"
- "Algo deu errado com os saves. Siga o manual de incidentes comigo."
