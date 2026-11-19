# Protótipo do backend (roadmap M0)

Protótipo para **escolher** o backend (Supabase ou Firebase). **Nada daqui está ligado no jogo**: o jogo continua salvando
só no aparelho. O relatório da comparação está em [`docs/roadmap/06-backend-prototipo.md`](../docs/roadmap/06-backend-prototipo.md).

| Pasta | O que é |
| --- | --- |
| `shared/saveSync.ts` | Lógica do servidor, igual nos dois: saneia o save pelo core, confere plausibilidade (só marca), carimba com o relógio do servidor, versão + checksum, ganho offline ao abrir |
| `supabase/migrations/` | Tabelas `characters` e `character_history` (5 últimas versões), RLS: o jogador só **lê** o que é dele |
| `supabase/functions/save-sync/` | Edge Function (Deno): `list`, `open`, `save` (com conflito de versão) |
| `firebase/` | O mesmo no Firebase: `firestore.rules` + Cloud Function `saveSync` (Node 22) |

Testes que rodam sem conta: `npm run check:backend` (lógica, entra no `npm test`) e `npm run check:backend-sql` (SQL e RLS
num Postgres local; precisa do Postgres instalado). Com a conta criada: `npm run smoke:backend` (ponta a ponta).

---

## Roteiro para fazer juntos (🤝 ~1 h)

> **Regra de ouro das chaves:** a **URL do projeto** e a **anon key** (também chamada de "publishable key") são públicas:
> vão no app. A **service_role key** (ou "secret key") é a chave-mestra: **nunca** cole no chat, no código, no Discord ou num
> print. Ela só existe dentro do Supabase (a Edge Function recebe sozinha) e, se um dia precisar, nos *Secrets* do GitHub.

### 1. Criar a conta e o projeto (👤 Lucas, ~10 min)

1. Abrir https://supabase.com → **Start your project** → entrar com a conta do GitHub (a mesma do repositório).
2. **New organization**: nome `Mistpeak`, tipo *Personal*, plano **Free**. Não precisa de cartão.
3. **New project**: nome `mistpeak`, **senha do banco**: clicar em *Generate a password* e guardar num gerenciador de
   senhas (não mandar para a IA), região **South America (São Paulo)**. Esperar ~2 min.
4. Em **Authentication → Sign In / Providers**: ligar **Allow anonymous sign-ins** (é o "login convidado").
5. Em **Project Settings → API** (ou **API Keys**): copiar a **Project URL** e a **anon / publishable key**. Essas duas a IA
   pode ver.

### 2. Instalar a ferramenta e publicar (🤝, ~20 min)

No Windows do Lucas (Node portátil em `C:\nodejs`), no terminal do VSCode, na pasta do repositório:

```bash
npx supabase@latest login          # abre o navegador para autorizar
npx supabase@latest init --workdir backend   # só na primeira vez (cria backend/supabase/config.toml; responder "N" às perguntas)
npm run build:backend              # gera backend/supabase/functions/_shared/mistpeak-server.mjs
npx supabase@latest link --project-ref <id do projeto>   # o id é o pedaço xxxx de https://xxxx.supabase.co
npx supabase@latest db push --workdir backend            # cria as tabelas (pede a senha do banco do passo 1.3)
npx supabase@latest functions deploy save-sync --workdir backend
```

A Edge Function recebe `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente: **não é
preciso colar a chave secreta em lugar nenhum**.

### 3. Testar (🤝, ~5 min)

```bash
set SUPABASE_URL=https://xxxx.supabase.co
set SUPABASE_ANON_KEY=eyJ...
npm run smoke:backend
```

Tem de terminar com "Tudo certo" e mostrar os tempos de cada chamada (vão para o relatório).

### 4. Ligar o limite de gastos (👤, 2 min)

No plano Free não há cobrança. Se um dia passar para o Pro, deixar o **Spend Cap** ligado (Organization → Billing).

### Observações

- Projeto Free **pausa depois de 7 dias sem uso** (os dados ficam; é só clicar em *Restore*). Durante o protótipo, tudo bem.
- Onde guardar as chaves no futuro: a URL e a anon key num `.env.local` (já está no `.gitignore`) e, para o build da CI,
  em *GitHub → Settings → Secrets and variables → Actions*. A IA prepara isso no M1.

## Firebase (só para comparar; não precisa criar)

O código está pronto, mas **publicar Cloud Functions exige o plano Blaze** (cadastrar cartão, cobrança por uso). Por isso
a proposta é **não** criar a conta do Firebase, a menos que o Lucas queira comparar ao vivo. Detalhes no relatório.
