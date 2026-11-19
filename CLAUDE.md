# CLAUDE.md · regras do projeto Mistpeak

Leia isto antes de qualquer tarefa. Vale para toda sessão de IA neste repositório.

## Quem é quem

- **Lucas** é o dono do projeto: solo dev, **sem experiência de lançar apps nas lojas**. Decide, testa **jogando** (não
  lê código) e cuida do que exige uma pessoa (contas, identidade, pagamentos, chaves).
- **A IA faz quase tudo**: código, testes, documentação, textos de loja e guias passo a passo.
- Responda e escreva em **português do Brasil** (código, comentários, commits e documentos também).

## Regras da casa (de `docs/decisoes-do-projeto.md`, "Regras de trabalho")

1. **Toda decisão que muda a jogabilidade é perguntada ao Lucas antes**, como **múltipla escolha** ou confirmação (use a
   ferramenta de pergunta; ele não precisa digitar). Isso inclui números de balanceamento, recompensas, regras de combate,
   textos que o jogador lê e qualquer coisa que ele perceba jogando. Refatoração que não muda nada no jogo não precisa.
2. **Toda decisão tomada é registrada** em `docs/decisoes-do-projeto.md` (seção "Decididas", com a data).
3. Sugestões de melhoria do Lucas só vão para "Melhorias — Futuro" (fim do mesmo documento) se ele aprovar, e só são
   feitas quando ele pedir.
4. Avise o Lucas quando houver dica para economizar tokens; trabalho de rotina pode ir para um modelo mais leve.
5. Nada de segredo no repositório (chaves de API, senhas, `service_role` do Supabase, `.env`). Chave **pública** de
   cliente (ex.: `anon key` do Supabase) pode ir no código; mesmo assim, prefira variável de ambiente do Vite.

## Roadmap

O plano está em `docs/roadmap/` (M0 a M5+ e a Trilha C de conteúdo offline). Cada tarefa tem um código (E1a, I15…) e
diz quem faz: 🤖 IA · 🤝 juntos · 👤 só o Lucas. Ao concluir um item, marque a caixa em `docs/roadmap/04-marcos.md`.
Os "Marcos 1–9" de `docs/decisoes-do-projeto.md` são outra numeração (já concluídos).

Fluxo de cada tarefa: perguntar o que for jogabilidade → implementar num PR pequeno → rodar os testes (abaixo) → escrever
no PR **o que testar jogando** (roteiro de ~5 minutos) → o Lucas joga o APK da CI ou o site e aprova → registrar a decisão.

## Como rodar

```bash
npm install
npm run dev              # jogo em http://localhost:5173
npm run typecheck        # tsc do jogo (src/) e dos scripts de teste (tools/*.ts, tsconfig.tools.json)
npm test                 # todos os check:* (regras, i18n, M0, core headless): rodam na CI em todo PR
npm run format           # Prettier (a CI roda format:check)
npm run sim:balance      # simulador de balanceamento (determinístico; -- --m9 = níveis 10–20 e o Abade)
npm run sim:plausibility # regenera src/data/plausibility.json (depois de mudar balanceamento)
npm run check:headless   # core em Node puro = resultado do navegador (gabarito em tools/fixtures/)
npm run golden:headless  # regenera esse gabarito no Chromium (só quando uma regra mudar de propósito)
npm run check:layout     # sobreposição do HUD (precisa de `npm run build && npx vite preview --port 4173`)
```

**Antes de abrir PR:** `npm run format && npm run typecheck && npm test`. Quando a interface mudar, também o
`check:layout`. Quando mudar regra, número ou dado do jogo, compare o `sim:balance` antes e depois e diga a diferença no PR
(refatoração tem de dar **saída idêntica**).

## Arquitetura (o essencial)

- `src/core/`: regras do jogo, **sem Phaser e sem navegador**. Precisa rodar em Node (servidor e testes):
  - horário real só por `Clock` (`src/core/clock.ts`); `Date.now()` só lá. O `World` usa `world.clock.now()`;
  - sorteio só por `Rng` com semente (`src/core/rng.ts`); nada de `Math.random()`;
  - idioma entra por `initLang` (`src/core/i18n.ts`); detectar/trocar idioma fica em `src/ui/lang.ts`;
  - uid de item por `src/core/uid.ts` (relógio + Rng próprio + prefixo do aparelho);
  - XP, ouro e itens ganhos/gastos passam por `world.econ(...)` (registro econômico, `src/core/world/ledger.ts`): todo
    ganho ou gasto novo precisa ser anotado ali (o `check:m0` confere que o registro bate com o save);
  - o `check:headless` reprova `window`, `document`, `navigator`, storage, `Date.now()` e `Math.random()` no core.
- `src/core/headless.ts`: ponto de entrada do servidor (`npm run build:headless` → `dist-headless/`).
- `src/boot.ts`: primeiro import do `src/main.ts`; injeta no core o que vem do navegador. Precisa continuar primeiro.
- `src/platform/`: tudo o que muda entre web e app (Capacitor). `src/ui/`: HUD em DOM. `src/render/`: Phaser.
- `src/data/*.json`: dados em português; `en.json` espelha só os textos em inglês. Texto fixo de interface: `L('pt', 'en')`.

## Cuidados

- Save dos jogadores: mudar `SaveData` exige migração em `src/core/saveFormat.ts` (save antigo tem de abrir).
- Não renomear chaves de preferência (`src/platform/prefs.ts`): já estão gravadas nos aparelhos.
- Assets só CC0 ou com licença registrada em `ASSETS_LICENCAS.md` e nos `CREDITS.txt`.
- Branch: trabalhe na branch indicada pela sessão; PR só quando o Lucas pedir.
