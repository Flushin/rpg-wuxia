# Veteranos ("Fundadores")

Pacote para quem jogou a primeira versão (offline, save no navegador) quando o jogo virar online com banco de dados.
Os personagens antigos não migram: todos começam do zero, e o veterano ganha só coisas que não dão poder direto.
Código: `src/core/founder.ts`, janela em `src/ui/founder.ts`, teste em `tools/m11-check.ts`.

## O pacote
- **Título:** «Discípulo Fundador» (`arena.json`, `exclusive: "fundador"`). Dado na hora e vestido se não usa outro.
- **Montaria:** uma das três, à escolha e **definitiva**: Grou Celestial, Qilin Jovem ou Tigre de Jade
  (`mounts.json`, `exclusive: "fundador"`). +30%, igual ao Cavalo; vale desde o nível 1.
  Arte provisória: o Cavalo recolorido (`public/sprites/<id>.png`); trocar pelos PNGs finais no mesmo formato.
- **Bônus:** XP em dobro até o nível 30; ouro ganho (monstros, Trial, missões, offline) em dobro até o 50.
  Venda de itens não dobra. Vale também no offline.

## Escolha da montaria
Janela "Bem-vindo de volta, Fundador" ao entrar (uma vez por sessão, enquanto não escolher). "Escolher depois" deixa a
escolha no Cavalariço Ma (estábulo do Porto Noturno).

## Exclusivos
Aparecem no estábulo, na arena e na wiki como "Exclusivo dos Fundadores", sem venda. O save só mantém título e
montaria exclusivos se tiver a marca de veterano.

## Quem é veterano
**A conta é Fundadora, não o personagem.** No banco, a tabela de contas tem um campo `fundador` (sim/não), e o
Lucas o marca **direto no banco** (sem painel de admin nem lista na build). O link novo não enxerga o save do link
antigo, então não há importação.
- Todo personagem da conta é Fundador, inclusive os criados depois de excluir outro: ao carregar ou criar um
  personagem, o servidor lê a conta e chama `grantFounder()`.
- **Cada personagem escolhe a própria montaria** (a janela abre para cada personagem novo); `founder.mount` fica
  salvo no personagem.
- O bônus de XP e de ouro vale para cada personagem da conta.
- Quem decide é o servidor: o cliente nunca se marca sozinho no online. Até lá, só o modo de desenvolvimento marca
  (`npm run dev` + `?fundador=1` na URL).
