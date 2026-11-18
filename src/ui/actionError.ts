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
  }
}
