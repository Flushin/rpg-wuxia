# Trailer (vídeo promocional)

Grava o jogo de verdade, quadro a quadro, com câmera roteirizada, e monta o vídeo com textos, transições,
música e efeitos sonoros. Rode de novo sempre que o jogo mudar e o vídeo sai atualizado.

## Precisa de

- ffmpeg
- Playwright com Chromium: `npm i -D playwright` e `npx playwright install chromium`

## Como gerar

```bash
npx vite --port 5173                 # o jogo em modo dev (em outro terminal)
node tools/trailer/record.mjs        # grava todas as tomadas em trailer-out/frames/
node tools/trailer/build.mjs         # monta trailer-out/mistpeak-trailer-curto.mp4 e -longo.mp4
```

Opções úteis:

- `record.mjs --only combate_tormenta,general_final`: regrava só essas tomadas.
- `record.mjs --preview 30 --out /tmp/prev`: guarda 1 quadro a cada 30, para conferir o enquadramento rápido.
- `build.mjs --cut curto`: monta só um corte.

`trailer-out/` não vai para o git.

## Como funciona

- `record.mjs` abre o jogo no Chromium (sem janela), pausa o relógio do Phaser e avança 1/60 s por quadro
  (menos na câmera lenta) antes de fotografar o canvas. Por isso o vídeo sai a 60 fps lisos mesmo sem placa de
  vídeo. Só o canvas é gravado, sem o HUD em HTML. Nomes sobre as cabeças, nomes dos portais e "!" das missões
  ficam escondidos. O personagem não morre e não fica sem mana. Os efeitos sonoros são anotados com o número
  do quadro em `sfx.json`.
- `shots.mjs` é o roteiro: uma entrada por tomada, com `setup` (mapa, posição, monstros extras), `tick`
  (andar, alvo, skills em cada quadro), `cam` (câmera) e `speed` (câmera lenta). As funções rodam dentro da
  página e só usam o objeto `D` (helpers em `record.mjs`: `look`, `lookSafe`, `spawn`, `skill`, `nearest`…).
- `build.mjs` tem os cortes (`CUTS`: ordem das tomadas, trecho em quadros e textos), os textos em HTML, a
  cartela final, a música (`public/audio/music/floresta.mp3`, CC0) e a mixagem dos efeitos sonoros.

## Dicas para tomadas novas

- Coordenadas em tiles do mapa (32×32). Zoom relativo à visão normal do jogo (1 = como o jogador vê).
- Com zoom abaixo de ~1,45 a borda escura do mapa aparece nos cantos. Use `D.lookSafe` em tomadas que seguem
  o personagem: ele trava a câmera dentro do mapa.
- Combate fica melhor em área aberta (na floresta, a clareira em x 20–27, y 19–23). `D.spawn(id, x, y, vida×)`
  põe monstros extras com mais vida, para a luta durar na tela.
- Antes de gravar em resolução cheia, confira com `--preview` e uma folha de miniaturas:
  `ffmpeg -i trailer-out/frames/<tomada>/%05d.jpg -vf "select='not(mod(n\,30))',scale=480:-1,tile=5x4" -frames:v 1 folha.jpg`
