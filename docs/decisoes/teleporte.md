# Teleporte (Mestre dos Caminhos)

Decidido com o Lucas em 20/11/2026. Motivo: as quatro saídas da vila estão ocupadas e virão mais regiões.

- **Sistema escolhido:** NPC de teleporte na vila (estilo MMO wuxia clássico), com janela "Viagem" listando os destinos
  por região. Comparado com: viajar pelo mapa-múndi, mapa-encruzilhada, estelas por região e juntar os portais de menu.
- **Nome:** Mestre dos Caminhos (EN: Wayfarer Master); janela "Viagem" (EN: Travel).
- **Visual:** lado leste da praça da vila; sprite próprio (Mage do KayKit em marfim e dourado, com cajado de orbe
  dourado) e um círculo dourado no chão ao lado (desenhado pelo jogo, não bloqueia a passagem).
- **Saídas atuais da vila:** não mudam (floresta a leste, montanha ao norte, masmorras a oeste, Trial ao sul).
- **Direção:** só da vila para fora. A volta é a pé ou com o Pergaminho de Retorno.
- **Liberação:** só nível mínimo; nunca menor que o nível exigido pelo caminho a pé (`npm run check:teleport`).
  Nada novo no save.
- **Custo:** 200 de ouro fixo por viagem (`TELEPORT_COST`), qualquer destino.
- **Destinos da primeira versão:** todos os mapas de caça (Floresta, Ruínas, Montanha, Bosque de Bambu, Pico),
  chegando no spawn de cada mapa. Lista em `src/core/teleport.ts`; regiões "Caminho do Leste" e "Caminho do Norte".
- **Auto:** sem opção no painel. Só usa o teleporte quando o mapa de caça **não tem caminho a pé** (hoje nenhum), com
  nível e ouro; senão caça onde dá para ir andando. Fora da vila, a caminho de um mapa só-teleporte, volta à vila e
  viaja de lá. Ganho offline não muda.
- **Mapa-múndi:** a rota é sempre a pé; o teleporte só entra quando não há caminho a pé ("fale com o Mestre dos
  Caminhos… · 200 ouro"). Sem linhas novas da vila; os cartões dos destinos ganham a marca ✦.
- **Fora por enquanto:** atalho "Viajar" na aba Mundo e estelas por região (possível evolução futura).
