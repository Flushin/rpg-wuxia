// Texto (PT/EN) para os códigos de erro que as regras de inventário, loja e ferreiro devolvem (ActionError).
import { L } from '../core/i18n';
import { CLASSES } from '../core/data';
import type { ActionError } from '../core/types';

export function actionErrorText(e: ActionError): string {
  switch (e.code) {
    case 'notEquippable':
      return L('Este item não é equipável', 'This item cannot be equipped');
    case 'needLevel':
      return L(`Requer nível ${e.level}`, `Requires level ${e.level}`);
    case 'sectOnly': {
      const name = CLASSES[e.sect]?.name ?? e.sect;
      return L(`Apenas para ${name}`, `Only for ${name}`);
    }
    case 'bagFull':
      return L('Mochila cheia', 'Bag full');
    case 'noGold':
      return L('Ouro insuficiente', 'Not enough gold');
    case 'talkToSeller':
      return L('Fale com o vendedor', 'Talk to the seller');
    case 'talkToBlacksmith':
      return L('Fale com o ferreiro', 'Talk to the blacksmith');
    case 'cannotForge':
      return L('O ferreiro não pode fazer isso neste item', 'The blacksmith cannot do that to this item');
    case 'noMaterials':
      return L('Materiais insuficientes', 'Not enough materials');
    case 'talkToMerchant':
      return L('Fale com o Mercador Ambulante', 'Talk to the Traveling Merchant');
    case 'soldOut':
      return L('Já vendido', 'Already sold');
    case 'trialLocked':
      return L('Vença o nível anterior deste chefe', 'Beat the previous level of this boss');
    case 'epicLocked':
      return L('Itens épicos não podem ser vendidos', 'Epic items cannot be sold');
    case 'itemLocked':
      return L('Item trancado: destranque na mochila', 'Item locked: unlock it in your bag');
    case 'talkToMonk':
      return L('Fale com o Monge do Pagode', 'Talk to the Pagoda Monk');
    case 'nothingToReset':
      return L('Nenhum ponto distribuído para devolver', 'No distributed points to return');
    case 'talkToGovernor':
      return L('Fale com o Governador Bai', 'Talk to Governor Bai');
    case 'skinOwned':
      return L('Você já tem este traje', 'You already own this outfit');
    case 'talkToStable':
      return L('Fale com o Cavalariço Ma', 'Talk to Stablemaster Ma');
    case 'talkToAntiquary':
      return L('Fale com o Antiquário Lao', 'Talk to Antiquarian Lao');
    case 'talkToArena':
      return L('Fale com o Mestre da Arena', 'Talk to the Arena Master');
    case 'founderOnly':
      return L(
        'Exclusivo dos Fundadores (veteranos da primeira versão).',
        'Founders exclusive (veterans of the first version).',
      );
    case 'titleOwned':
      return L('Você já tem este título', 'You already own this title');
    case 'arenaPoints':
      return L(`Requer ${e.points} pontos de arena`, `Requires ${e.points} arena points`);
    case 'arenaCoins':
      return L('Moedas de arena insuficientes', 'Not enough arena coins');
    case 'relicOwned':
      return L('Você já tem esta relíquia', 'You already own this relic');
    case 'relicShards':
      return L(`Faltam fragmentos (precisa de ${e.need})`, `Not enough fragments (needs ${e.need})`);
    case 'relicNotOwned':
      return L('Você não tem esta relíquia', 'You do not own this relic');
    case 'noMount':
      return L(
        'Você não tem montaria (Cavalariço Ma, no Porto Noturno)',
        'You have no mount (Stableman Ma, Night Harbor)',
      );
    case 'mountCombat':
      return L('Saia do combate para montar', 'Leave combat to mount');
    case 'mountOwned':
      return L('Você já tem esta montaria', 'You already own this mount');
    case 'talkToJeweler':
      return L('Fale com o Joalheiro', 'Talk to the Jeweler');
    case 'talkToMasterSmith':
      return L('Fale com o Ferreiro-mestre', 'Talk to the Master Smith');
    case 'hasGems':
      return L('Retire as gemas antes (Ferreiro-mestre)', 'Remove the gems first (Master Smith)');
    case 'gemDuplicate':
      return L('Este item já tem uma gema desse tipo', 'This item already has a gem of this type');
    case 'noSocket':
      return L('Nenhum encaixe vazio', 'No empty socket');
    case 'socketsMax':
      return L('Todos os encaixes desta raridade já estão abertos', 'All sockets for this rarity are open');
    case 'gemMaxLevel':
      return L('A gema já está no nível máximo', 'The gem is already at max level');
  }
}
