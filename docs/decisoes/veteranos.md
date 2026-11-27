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
**Lista manual no servidor** (o Lucas cadastra os amigos). O link novo não enxerga o save do link antigo, então não há
importação. Até o servidor existir, só o modo de desenvolvimento marca: `npm run dev` + `?fundador=1` na URL.
Falta no online: o servidor chamar `grantFounder()` para as contas da lista e guardar `founder` no banco.
