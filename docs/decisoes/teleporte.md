# Teleporte (Mestre dos Caminhos)

Decidido com o Lucas em 20/11/2026. Motivo: as quatro saídas da vila estão ocupadas e virão mais regiões.

- **Sistema escolhido:** NPC de teleporte na vila (estilo MMO wuxia clássico), com janela "Viagem" listando os destinos
  por região. Comparado com: viajar pelo mapa-múndi, mapa-encruzilhada, estelas por região e juntar os portais de menu.
- **Nome:** Mestre dos Caminhos (EN: Wayfarer Master); janela "Viagem" (EN: Travel).
- **Visual:** NPC com um círculo/estela de teleporte ao lado, na vila (posição exata a definir no item da janela).
- **Saídas atuais da vila:** não mudam (floresta a leste, montanha ao norte, masmorras a oeste, Trial ao sul).
- **Direção:** só da vila para fora. A volta é a pé ou com o Pergaminho de Retorno.
- **Liberação:** só nível mínimo; nunca menor que o nível exigido pelo caminho a pé (`npm run check:teleport`).
  Nada novo no save.
- **Custo:** 200 de ouro fixo por viagem (`TELEPORT_COST`), qualquer destino.
- **Destinos da primeira versão:** todos os mapas de caça (Floresta, Ruínas, Montanha, Bosque de Bambu, Pico),
  chegando no spawn de cada mapa. Lista em `src/core/teleport.ts`; regiões "Caminho do Leste" e "Caminho do Norte".
- **Fora por enquanto:** atalho "Viajar" na aba Mundo e estelas por região (possível evolução futura).
