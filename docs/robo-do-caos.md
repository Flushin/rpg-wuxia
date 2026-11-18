# Robô do caos: tutorial

O robô do caos abre o Mistpeak num navegador e joga como um jogador muito bagunceiro. Ele aperta tudo, clica em
qualquer lugar, gira a tela, fecha o app no meio da luta, muda a hora do celular e recarrega a página no meio do
salvamento. Enquanto isso, ele anota tudo o que quebrar. Pode deixar rodando por horas.

O código fica em `tools/chaos-bot.mjs`.

## 1. Preparar (só na primeira vez)

Você precisa do Node.js (o mesmo que já usa no projeto). Na pasta do projeto, rode:

```bash
npm install
```

```bash
npm install --no-save playwright
```

```bash
npx playwright install chromium
```

O Playwright é o que controla o navegador. Ele não entra no `package.json`. Se um `npm install` ou `npm ci`
apagar o Playwright depois, rode de novo os dois últimos comandos.

## 2. Rodar

O robô precisa de **dois terminais** abertos na pasta do projeto.

**Terminal 1**: deixe o jogo rodando no modo de desenvolvimento.

```bash
npm run dev
```

Confira se o endereço mostrado é `http://localhost:5173/`. Se for outro, passe esse endereço com `--url` (veja abaixo).

**Terminal 2**: solte o robô.

```bash
npm run chaos
```

Por padrão ele roda por 60 minutos, sem mostrar o navegador. Para parar antes, aperte **Ctrl+C** uma vez: ele
termina a ação atual e grava o relatório. Ctrl+C duas vezes sai na hora.

> Tem de ser o `npm run dev`, não o `npm run build` + `preview`. Só no modo dev o jogo expõe o estado interno
> (`window.__game`), que o robô usa para conferir vida, ouro, mochila e posição.

### Exemplos

Rodar a noite toda (8 horas):

```bash
npm run chaos -- --minutos 480
```

Rodar sem fim, até você apertar Ctrl+C:

```bash
npm run chaos -- --minutos 0
```

Ver o robô jogando (abre a janela do navegador):

```bash
npm run chaos -- --janela --minutos 10
```

Ver em câmera lenta, para entender o que ele faz:

```bash
npm run chaos -- --janela --ritmo 0.3
```

Só celular deitado, sem as trapaças:

```bash
npm run chaos -- --perfil celular-deitado --sem-trapaca
```

Repetir uma execução que achou um bug (a semente aparece no relatório):

```bash
npm run chaos -- --semente 123456789
```

### Todas as opções

O `--` depois de `npm run chaos` é obrigatório quando você passa opções.

| Opção               | O que faz                                                                                  | Padrão                   |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| `--minutos N`       | Quanto tempo rodar. `0` = sem fim.                                                         | 60                       |
| `--janela`          | Mostra o navegador na tela.                                                                | escondido                |
| `--ritmo N`         | Velocidade entre ações. `2` = 2× mais rápido, `0.3` = bem devagar.                         | 1                        |
| `--semente N`       | Número que define a sequência de escolhas do robô.                                         | aleatório                |
| `--sessao-min N`    | A cada N minutos, fecha tudo e recomeça do zero com outro aparelho e saves limpos.         | 15                       |
| `--perfil NOME`     | Fixa um aparelho (lista abaixo).                                                           | sorteia a cada sessão    |
| `--sem-trapaca`     | Desliga as ações "de deus" (teleporte, ouro infinito, matar o jogador...).                 | ligadas                  |
| `--url URL`         | Endereço do jogo.                                                                          | `http://localhost:5173/` |
| `--saida PASTA`     | Onde gravar os relatórios.                                                                 | `chaos-reports/`         |
| `--ajuda`           | Mostra este tutorial.                                                                      |                          |

Aparelhos para `--perfil`: `celular-em-pe`, `celular-deitado`, `celular-pequeno`, `fold-fechado`, `fold-aberto`,
`tablet`, `pc`, `pc-grande`, `janela-minuscula`.

Para usar o Chrome instalado no seu PC em vez do Chromium do Playwright, defina a variável `CHROME` com o caminho dele.

## 3. Ler o resultado

Cada execução cria uma pasta nova:

```
chaos-reports/
  2026-11-18T22-10-05-semente123456789/
    relatorio.md      ← comece por aqui (é atualizado a cada minuto, mesmo durante a execução)
    bugs.jsonl        ← um problema por linha (fácil de ler por outro programa)
    metricas.csv      ← memória e número de objetos ao longo do tempo (abra no Excel/Sheets)
    bugs/
      001-erro-js-cannot-read-properties-of-undefined/
        LEIA.md       ← o erro e as ~120 últimas ações do robô antes dele
        tela.png      ← print da tela na hora
        info.json     ← tudo junto, incluindo o estado do jogo (vida, mapa, mochila...)
```

A pasta `chaos-reports/` está no `.gitignore` e não vai para o Git.

O mesmo bug que acontece várias vezes aparece **uma vez só** no relatório, com o número de vezes. O print e o
histórico são da primeira vez.

### Tipos de problema

| Tipo          | O que é                                                                                         | Gravidade             |
| ------------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| **CRASH**     | A aba do navegador morreu.                                                                      | 🔴 alta               |
| **TRAVOU**    | A página parou de responder, parou de desenhar ou ficou presa no "Carregando…".                 | 🔴 alta               |
| **XSS**       | Um nome de personagem com HTML foi executado como código.                                       | 🔴 alta               |
| **SAVE**      | Depois de recarregar, o save não bate com o jogo (ouro, itens, nível...) ou o personagem sumiu. | 🔴 alta               |
| **ERRO-JS**   | Erro de JavaScript no console.                                                                  | 🟠 quase sempre é bug |
| **ESTADO**    | Valor impossível: vida negativa ou NaN, item duplicado, personagem dentro da parede, etc.       | 🟠 quase sempre é bug |
| **VAZAMENTO** | Memória ou objetos crescendo sem parar na mesma sessão.                                         | 🟡 importa em sessões longas |
| **AVISO**     | Suspeito, mas pode ser normal (ex.: o tempo do jogo parou por 90s).                             | ⚪ dê uma olhada      |

### Como investigar um bug

1. Abra o `LEIA.md` do bug. Leia as **últimas ações** de baixo para cima: a última linha é o que o robô fez logo
   antes do problema.
2. Olhe o `tela.png`.
3. No `info.json`, `estadoDoJogo` mostra mapa, vida, mochila, janelas abertas etc. naquele momento.
4. Tente repetir à mão. Se não conseguir, rode o robô com a mesma `--semente` e `--janela` para ver de perto.

> A semente repete as **escolhas** do robô (que tecla, onde clicar, em que ordem). O jogo tem sorte própria
> (dano, loot) e o tempo nunca é idêntico, então a repetição chega perto, mas não é exata.

Se as ações marcadas `trapaca-…` aparecem logo antes do bug, ele pode ter sido causado por uma situação que um
jogador normal não alcança. Confirme rodando com `--sem-trapaca`.

## 4. O que o robô faz

**Na tela de personagens:** cria personagens com nomes estranhos (vazio, 300 letras, emoji, árabe, HTML,
`__proto__`...), clica "Começar" várias vezes seguidas, entra no jogo, apaga personagens digitando o nome certo ou
errado.

**Dentro do jogo:**

- aperta teclas do jogo e teclas aleatórias, às vezes 60 de uma vez
- anda pelo teclado e "dá Alt+Tab" com a tecla ainda apertada
- clica e toca em qualquer lugar, e em qualquer botão visível, às vezes 40 vezes seguidas
- arrasta o joystick até a borda da tela; vários dedos ao mesmo tempo (aparelhos de toque)
- zoom com a roda do mouse, sem parar
- abre todas as janelas ao mesmo tempo
- spam de habilidades e poções
- mexe nos controles do menu de auto-combate com valores absurdos
- fala com NPCs, ataca monstros, anda até portais e até lugares impossíveis (água, fora do mapa)
- liga e desliga o auto sem parar, ou deixa o auto jogar por até 40 s (assim o personagem evolui nas sessões longas)
- redimensiona a janela (até 200×150) e gira a tela
- manda o app para o segundo plano e volta
- muda a hora do "celular" para frente e para trás (ganho offline, renascimento de monstros)
- aperta "voltar" do navegador, fica sem internet, recarrega a página no meio do jogo
- recarrega a página de propósito e confere se o save voltou igual
- **trapaças** (desligáveis com `--sem-trapaca`): teleporta entre mapas, dá muito ouro e XP, enche a mochila,
  mata o jogador ou deixa com 1 de vida

**O que ele confere o tempo todo (a cada ~2 s):** vida, mana, XP, ouro, nível e pontos válidos; jogador e monstros
dentro do mapa e fora das paredes; nenhum item duplicado na mochila ou no equipamento; recargas e níveis de
habilidade válidos; o save sem números inválidos; eventos, itens no chão e bonecos da cena sem acumular. A cada
minuto mede memória, elementos HTML e objetos da cena para achar vazamentos.

Para evitar falso alarme, a maioria das regras só vira bug se continuar quebrada na checagem seguinte. As regras
que nunca podem falhar, nem por um instante (NaN, item duplicado, save inválido), viram bug na hora.

## 5. Segurança

- O robô usa um navegador separado, com armazenamento próprio e limpo a cada sessão. **Seus personagens de verdade
  não são tocados.**
- Todo pedido para fora do `localhost` é bloqueado. O botão "Reportar bug" não manda e-mail de verdade.
- Abas novas (ex.: o link de privacidade) são fechadas na hora.

## 6. Problemas comuns

**"Playwright não está instalado"**: rode `npm install --no-save playwright` e `npx playwright install chromium`.

**"Não consegui abrir http://localhost:5173/"**: o `npm run dev` não está rodando, ou está em outra porta (use `--url`).

**Fica preso na criação de personagem / nenhum bug de ESTADO aparece**: confira se você usou `npm run dev` e não o
`preview`. Sem o modo dev o robô não enxerga o estado do jogo.

**O PC fica lento**: use `--ritmo 0.5`. Sem `--janela` ele também gasta menos.

**Quero deixar rodando sem o PC dormir**: no Windows, ajuste "Energia e suspensão" para nunca suspender enquanto
estiver na tomada. No Mac, rode `caffeinate -i npm run chaos -- --minutos 480`.
