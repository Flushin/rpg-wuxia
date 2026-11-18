# Textos e formulários das lojas (D8)

Rascunho para colar nos formulários da Google Play (e, no futuro, da App Store). Revise antes de enviar.

- **URL da política de privacidade:** `https://flushin.github.io/rpg-wuxia/privacidade.html`
  (PT e EN na mesma página; `#pt` e `#en` abrem direto no idioma).
- **E-mail de contato:** a Play Store exige um. A página ainda não tem (há um `<!-- TODO: e-mail de contato -->` em
  `public/privacidade.html`); o dono decide qual usar e então atualiza a página.

## O que o app envia (base das respostas abaixo)

O único envio de rede do jogo é o **Reportar bug** (`src/ui/bugReport.ts`), só quando o jogador toca em "Enviar",
para `https://api.web3forms.com/submit` (HTTPS), com: texto livre do jogador; nome/contato opcional (ou o nome do
personagem); versão e build; dados do personagem (nome, seita, nível, mapa, posição, vida, auto-combate, missão, alvo);
dados do aparelho (user agent, tamanho de tela/janela, DPR, orientação, toque/mouse, idioma); FPS dos últimos 10 s;
até 10 erros técnicos recentes. Não há conta, analytics, anúncios, SDK de terceiros nem rastreamento. O save e as
preferências ficam só no aparelho.

## Google Play — Data Safety (Segurança dos dados)

| Pergunta | Resposta |
| --- | --- |
| O app coleta ou compartilha algum dos tipos de dados exigidos? | **Sim** (só no report de bug, opcional) |
| Todos os dados são criptografados em trânsito? | **Sim** (HTTPS) |
| Oferece forma de o usuário pedir a exclusão dos dados? | **Sim** (pedindo por um novo Reportar bug; ver política) |
| O app exige conta? | Não |
| Anúncios? | Não |

Tipos de dados a declarar (todos: **coletados**, **não compartilhados** com terceiros para fins próprios deles,
**opcionais** — só se o jogador enviar o report; finalidade: **Funcionalidade do app / diagnóstico**; **não** usados
para publicidade, marketing, personalização ou análise):

- **Informações e desempenho do app → Registros de falhas / Diagnóstico:** mensagens de erro técnico e FPS.
- **Informações e desempenho do app → Diagnóstico:** versão do jogo, dados do aparelho (user agent, tela, idioma).
- **Mensagens / Outro conteúdo gerado pelo usuário:** o texto livre do relato.
- **Informações pessoais → Nome / Outras informações de contato:** somente se o jogador preencher o campo opcional
  "Seu nome ou contato".

Observações:

- Marque "Web3Forms" como prestador de serviço (processador) que recebe os dados em nome do desenvolvedor; por isso
  costuma-se responder **"não compartilhado"** (transferência a prestador de serviço não conta como compartilhamento
  na definição da Play). Confirme no formulário vigente.
- Não declarar: localização, contatos, fotos, áudio, arquivos, identificadores de publicidade, histórico, financeiros,
  saúde (nada disso é coletado).
- Público-alvo: não direcionado a crianças (ver a política). Se a classificação etária for baixa, revisar a seção
  "Crianças" da política antes de marcar "Famílias".

## Apple — Privacy Nutrition Labels (para quando houver iOS)

- **Data Used to Track You:** nenhum.
- **Data Linked to You:** nenhum.
- **Data Not Linked to You** (só no report de bug, opcional, finalidade **App Functionality**):
  - Diagnostics → Other Diagnostic Data (FPS, erros, versão, dados do aparelho);
  - User Content → Other User Content (texto do relato);
  - Contact Info → Name / Other (apenas se o jogador preencher o contato opcional).
- Privacy Policy URL: a mesma acima.

## Google Play — Classificação indicativa (questionário IARC)

Rascunho de 18/11/2026, para o jogo **sem anúncios e sem compras** (decisão do Lucas na mesma data). O questionário
muda de perguntas com o tempo: responda pelo que o jogo tem na versão enviada, sem minimizar. Categoria: **Jogo**.

| Tema | O que existe no jogo | Resposta sugerida |
| --- | --- | --- |
| Violência | Combate corpo a corpo e mágico contra animais (lobos), humanos (bandidos) e guerreiros de terracota; monstros caem e somem; o personagem do jogador morre e volta à cidade. Visual cartunesco, câmera de cima | **Sim**: violência de fantasia contra personagens humanos e animais, sem detalhes realistas |
| Sangue e mutilação | Não há (efeitos são faíscas, raios, gelo, névoa, veneno verde) | **Não** |
| Medo / horror | Não há | **Não** |
| Linguagem imprópria | Não há nos textos do jogo | **Não** |
| Temas sexuais, nudez | Não há | **Não** |
| Drogas, álcool, tabaco | Não há (poções de vida e mana são itens de cura; o veneno da Víbora é uma skill de dano) | **Não** |
| Jogo de azar (simulado ou real) | Drops aleatórios de monstros, sem dinheiro real e sem compra | **Não** |
| Compras digitais | Não há | **Não** |
| Anúncios | Não há | **Não** (no Play Console: "Não contém anúncios") |
| Interação entre usuários, chat, conteúdo de outros jogadores | Não há (single-player) | **Não** |
| Compartilha a localização | Não | **Não** |
| Compartilha informações pessoais com terceiros | Só o report de bug opcional (ver Data Safety acima); nada é mostrado a outros jogadores | **Não** (a pergunta é sobre compartilhar com outros usuários) |

Expectativa (não garantida): ClassInd 10 ou 12 / PEGI 7 / ESRB E10+. Se entrar anúncio, compra, chat ou
multiplayer (marco 10), refazer o questionário antes de enviar a atualização.

## Rascunho de descrição da loja

### Português (pt-BR)

**Título:** Mistpeak: Idle RPG

**Descrição curta (≤ 80 caracteres):**
`RPG de ação wuxia: combate, auto-combate e ganho offline.` (57)

**Descrição longa:**

Mistpeak é um RPG de ação em visão isométrica inspirado nos contos de artes marciais da China antiga. Escolha o seu
personagem entre as seitas disponíveis e viaje pela Vila das Nuvens, pela floresta e pelas ruínas até enfrentar o
General de Terracota.

O combate é por alvo: toque no monstro para mirar, use o botão Atacar e as skills em arco na tela (no computador,
mouse e teclado). Suas skills evoluem com o uso, e você equipa armas e armaduras que ganham desgaste e podem ser
reparadas com o ferreiro.

Não quer ficar tocando o tempo todo? Ligue o auto-combate: o personagem luta sozinho, usa skills e poções, e quando
você volta ao jogo recebe o resumo do que ganhou enquanto estava fora. Uma cadeia de missões guia você do nível 1 ao 10.

Jogo gratuito, sem anúncios e sem conta. Seu progresso fica salvo no próprio aparelho, com até 4 personagens. Se
encontrar um problema, o botão Reportar bug (em ⚙) envia o relato para o desenvolvedor; veja a política de privacidade.

### English

**Title:** Mistpeak: Idle RPG

**Short description (≤ 80 characters):**
`Wuxia action RPG: tab-target combat, auto-combat and offline gains.` (66)

**Long description:**

Mistpeak is an isometric action RPG inspired by ancient Chinese martial-arts tales. Pick your character from the
available sects and travel through Cloud Village, the forest and the ruins until you face the Terracotta General.

Combat is target-based: tap a monster to aim, use the Attack button and the skills arranged in an arc on screen (on a
computer, mouse and keyboard). Your skills level up with use, and you equip weapons and armor that wear down and can
be repaired by the blacksmith.

Don't want to keep tapping? Turn on auto-combat: your character fights on its own, using skills and potions, and when
you come back you get a summary of what you earned while away. A questline guides you from level 1 to 10.

Free game, no ads and no account. Your progress is saved on your own device, with up to 4 characters. If you find a
problem, the Report a bug button (in ⚙) sends your report to the developer; see the privacy policy.

> Antes de publicar: conferir se os nomes das seitas e mapas na descrição batem com o jogo da versão enviada, e se o
> jogo continua gratuito e sem compras (a descrição afirma isso).
