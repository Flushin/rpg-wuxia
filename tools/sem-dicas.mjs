// Antes de toda screenshot de teste: desliga as dicas e esconde o cartão aberto, para a dica não cobrir a tela.
// No modo dev (window.__game) desliga de vez no mundo; em qualquer modo esconde o cartão #tip-card.
export async function semDicas(page) {
  await page
    .evaluate(() => {
      const w = window.__game?.world;
      if (w) w.tipsEnabled = false;
      document.getElementById('tip-card')?.classList.add('hidden');
    })
    .catch(() => {});
}
