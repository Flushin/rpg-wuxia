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
  }
}
