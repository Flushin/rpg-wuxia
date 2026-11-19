## Em aberto (detalhes para a fase de balanceamento)
*Fechados para a v1 em 16/11/2026 (ver "Fechamento do marco 7"); revisar com o retorno dos jogadores.*
- Curva de XP até o nível 10
- Números de dano, cooldown e custo de mana das skills
- Lista de equipamentos de teste e taxas de drop
- Taxa exata do idle/offline e limite de horas
- Comportamento do chefe em detalhe (padrão de ataques, frequência de invocação/área)

## Notas de implementação (marco 3)
- Q/E usam a poção pequena primeiro, depois a grande. Um efeito ativo por tipo (HP/mana).
- Equipamentos dropam no nível do monstro; armas só da seita do personagem.
- Janela de NPC não bloqueia o movimento; fecha a mais de 3 tiles.
- Conserto custa `durabilidade faltante × nível do item × 0,5` (placeholder; lobo dá 2–6 de ouro). Preços: poção de vida P 12, G 36; mana P 14, G 40.

## Notas de implementação (marco 4)
- Offline usa valores esperados por abate (não sorteio individual), a partir dos últimos ~30 min de auto-combate (mínimo 2 min de dados).
- Viagem para comprar: só poções pequenas; dispara quando falta qualquer tipo e há ouro; intervalo mínimo de 120 s entre viagens.
- Ligar o Auto na cidade leva o personagem até o mapa de caça.
- Menu do auto-combate: botão ☰ ao lado do Auto (a engrenagem ⚙ é das configurações).

