// Compras dentro do app. Não há compras hoje. Se vierem, nas lojas têm de ser IAP nativo
// (StoreKit / Google Play Billing); este é o ponto onde a implementação entra.
export interface Purchases {
  /** false enquanto não houver loja ligada. */
  readonly available: boolean;
}

export const purchases: Purchases = { available: false };
